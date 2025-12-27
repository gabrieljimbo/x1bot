'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { WorkflowNode, WorkflowEdge, WorkflowNodeType } from '@n9n/shared'
import CustomNode from './nodes/CustomNode'

const nodeTypes: NodeTypes = {
  custom: CustomNode,
}

interface WorkflowCanvasProps {
  initialNodes: WorkflowNode[]
  initialEdges: WorkflowEdge[]
  onChange?: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void
  readonly?: boolean
  currentNodeId?: string | null
  executionStatus?: 'idle' | 'running' | 'waiting' | 'completed' | 'failed'
  onNodeDoubleClick?: (node: WorkflowNode) => void
  onAddNode?: (type: WorkflowNodeType, position?: { x: number; y: number }) => void
  executedNodes?: Set<string>
  failedNodes?: Set<string>
}

export default function WorkflowCanvas({
  initialNodes,
  initialEdges,
  onChange,
  readonly = false,
  currentNodeId,
  executionStatus = 'idle',
  onNodeDoubleClick,
  onAddNode,
  executedNodes = new Set(),
  failedNodes = new Set(),
}: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  // Convert to React Flow format
  useEffect(() => {
    const flowNodes: Node[] = initialNodes.map((node) => ({
      id: node.id,
      type: 'custom',
      position: node.position || { x: 0, y: 0 },
      data: {
        type: node.type,
        config: node.config,
        isActive: currentNodeId === node.id,
        executionStatus,
        hasExecuted: executedNodes.has(node.id),
        executionSuccess: executedNodes.has(node.id) && !failedNodes.has(node.id),
      },
    }))

    const flowEdges: Edge[] = initialEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.condition || undefined, // Use condition as sourceHandle for CONDITION nodes
      label: edge.label || (edge.condition === 'true' ? 'True' : edge.condition === 'false' ? 'False' : undefined),
      animated: currentNodeId === edge.source,
      style: currentNodeId === edge.source 
        ? { stroke: '#00FF88', strokeWidth: 2 }
        : edge.condition === 'true'
        ? { stroke: '#4ade80', strokeWidth: 2 } // Green for True
        : edge.condition === 'false'
        ? { stroke: '#f87171', strokeWidth: 2 } // Red for False
        : undefined,
    }))

    setNodes(flowNodes)
    setEdges(flowEdges)
  }, [initialNodes, initialEdges, currentNodeId, executionStatus, executedNodes, failedNodes])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readonly) return

      const newEdge = {
        ...connection,
        id: `edge-${Date.now()}`,
      }
      
      setEdges((eds) => {
        const updatedEdges = addEdge(newEdge, eds)
        
        if (onChange) {
          // Convert current nodes to WorkflowNode format
          const workflowNodes: WorkflowNode[] = nodes.map((node) => ({
            id: node.id,
            type: node.data.type,
            config: node.data.config,
            position: node.position,
          }))
          
          // Convert updated edges to WorkflowEdge format
          const workflowEdges: WorkflowEdge[] = updatedEdges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: typeof e.label === 'string' ? e.label : undefined,
            condition: e.sourceHandle || undefined, // Save sourceHandle as condition (for CONDITION nodes)
          }))
          
          onChange(workflowNodes, workflowEdges)
        }
        
        return updatedEdges
      })
    },
    [readonly, nodes, onChange]
  )

  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes)

      if (onChange && !readonly) {
        // Only save on position changes (when user stops dragging)
        const hasPositionChange = changes.some((c: any) => c.type === 'position' && c.dragging === false)
        
        if (hasPositionChange) {
          // Update positions
          const updatedNodes: WorkflowNode[] = nodes.map((node) => {
            const change = changes.find((c: any) => c.id === node.id && c.type === 'position')
            if (change && change.position) {
              return {
                id: node.id,
                type: node.data.type,
                config: node.data.config,
                position: change.position,
              }
            }
            return {
              id: node.id,
              type: node.data.type,
              config: node.data.config,
              position: node.position,
            }
          })
          
          // Convert current edges to WorkflowEdge format
          const workflowEdges: WorkflowEdge[] = edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: typeof e.label === 'string' ? e.label : undefined,
            condition: e.sourceHandle || undefined, // Save sourceHandle as condition (for CONDITION nodes)
          }))
          
          onChange(updatedNodes, workflowEdges)
        }
      }
    },
    [nodes, edges, onChange, readonly, onNodesChange]
  )

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (onNodeDoubleClick) {
        // Find the original workflow node
        const workflowNode = initialNodes.find((n) => n.id === node.id)
        if (workflowNode) {
          onNodeDoubleClick(workflowNode)
        }
      }
    },
    [onNodeDoubleClick, initialNodes]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/reactflow') as WorkflowNodeType
      
      if (typeof type === 'undefined' || !type || !reactFlowWrapper.current) {
        return
      }

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      }

      if (onAddNode) {
        onAddNode(type, position)
      }
    },
    [onAddNode]
  )

  return (
    <div ref={reactFlowWrapper} className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={handleNodeDoubleClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
      >
        <Controls />
        <Background />
        <MiniMap
          nodeColor={(node) => {
            if (node.data.isActive) return '#00FF88'
            return '#333'
          }}
        />
      </ReactFlow>
    </div>
  )
}

