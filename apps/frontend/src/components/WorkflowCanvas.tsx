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
  EdgeTypes,
  ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { WorkflowNode, WorkflowEdge, WorkflowNodeType } from '@n9n/shared'
import CustomNode from './nodes/CustomNode'
import CustomEdge from './edges/CustomEdge'
import { Trash2, ZoomIn, ZoomOut, Maximize, MousePointer2, Plus } from 'lucide-react'

const nodeTypes: NodeTypes = {
  custom: CustomNode,
}

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
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
  onManualTrigger?: (nodeId: string) => void
  onDuplicateNode?: (nodeId: string) => void
  executedNodes?: Set<string>
  failedNodes?: Set<string>
  executedEdges?: Set<string>
  failedEdges?: Set<string>
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
  onManualTrigger,
  onDuplicateNode,
  executedNodes = new Set(),
  failedNodes = new Set(),
  executedEdges = new Set(),
  failedEdges = new Set(),
}: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const [selectedEdges, setSelectedEdges] = useState<string[]>([])
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null)
  const [zoom, setZoom] = useState(100)
  const [menu, setMenu] = useState<{ id: string; top?: number; left?: number; right?: number; bottom?: number; type: 'node' | 'pane'; data?: any } | null>(null)

  // Track whether this is the first render (initial load)
  const isInitialLoad = useRef(true)
  // Track the last initialNodes reference to detect real prop changes
  const lastInitialNodesRef = useRef<WorkflowNode[]>(initialNodes)
  const lastInitialEdgesRef = useRef<WorkflowEdge[]>(initialEdges)

  const onRemoveNode = useCallback((nodeId: string) => {
    if (readonly) return

    setNodes((nds) => {
      const updatedNodes = nds.filter((n) => n.id !== nodeId)

      // Also remove edges connected to this node
      setEdges((eds) => {
        const updatedEdges = eds.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId
        )

        if (onChange) {
          const workflowNodes: WorkflowNode[] = updatedNodes.map((n) => ({
            id: n.id,
            type: n.data.type,
            config: n.data.config,
            position: n.position,
          }))

          const workflowEdges: WorkflowEdge[] = updatedEdges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: typeof e.label === 'string' ? e.label : undefined,
            condition: e.sourceHandle || undefined,
          }))

          onChange(workflowNodes, workflowEdges)
        }

        return updatedEdges
      })

      return updatedNodes
    })
  }, [readonly, onChange, setNodes, setEdges])

  // Build React Flow nodes from workflow nodes
  const buildFlowNodes = useCallback((workflowNodes: WorkflowNode[]): Node[] => {
    return workflowNodes.map((node) => ({
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
        onManualTrigger,
        onDuplicateNode,
        onRemoveNode,
      },
    }))
  }, [currentNodeId, executionStatus, executedNodes, failedNodes, onManualTrigger, onDuplicateNode, onRemoveNode])

  // Build React Flow edges from workflow edges
  const buildFlowEdges = useCallback((workflowEdges: WorkflowEdge[]): Edge[] => {
    return workflowEdges.map((edge) => {
      const edgeId = edge.id || `${edge.source}-${edge.target}`
      const edgeKey = `${edge.source}-${edge.target}`
      const isExecuted = executedEdges.has(edgeKey) || executedEdges.has(edgeId)
      const isFailed = failedEdges.has(edgeKey) || failedEdges.has(edgeId)
      const isCurrentlyActive = currentNodeId === edge.source

      let edgeStyle: any = {}

      if (isFailed) {
        edgeStyle.stroke = '#ef4444'
        edgeStyle.strokeWidth = 3
      } else if (isExecuted) {
        edgeStyle.stroke = '#22c55e'
        edgeStyle.strokeWidth = 3
      } else if (isCurrentlyActive) {
        edgeStyle.stroke = '#00FF88'
        edgeStyle.strokeWidth = 2.5
      } else if (edge.condition === 'true') {
        edgeStyle.stroke = '#4ade80'
        edgeStyle.strokeWidth = 2
      } else if (edge.condition === 'false') {
        edgeStyle.stroke = '#f87171'
        edgeStyle.strokeWidth = 2
      } else {
        edgeStyle.stroke = '#3a3a3a'
        edgeStyle.strokeWidth = 2
      }

      return {
        id: edge.id,
        type: 'custom',
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.condition || undefined,
        label: edge.label || (edge.condition === 'true' ? 'True' : edge.condition === 'false' ? 'False' : undefined),
        animated: isCurrentlyActive,
        style: edgeStyle,
      }
    })
  }, [executedEdges, failedEdges, currentNodeId])

  // INITIAL LOAD: Set nodes/edges from initialNodes/initialEdges when they actually change
  useEffect(() => {
    // Check if initialNodes/initialEdges reference actually changed
    // (real prop update from parent, e.g. after save or external update)
    const nodesChanged = initialNodes !== lastInitialNodesRef.current
    const edgesChanged = initialEdges !== lastInitialEdgesRef.current

    if (isInitialLoad.current || nodesChanged || edgesChanged) {
      isInitialLoad.current = false
      lastInitialNodesRef.current = initialNodes
      lastInitialEdgesRef.current = initialEdges

      const flowNodes = buildFlowNodes(initialNodes)
      const flowEdges = buildFlowEdges(initialEdges)
      setNodes(flowNodes)
      setEdges(flowEdges)
    }
  }, [initialNodes, initialEdges, buildFlowNodes, buildFlowEdges, setNodes, setEdges])

  // UPDATE DATA ONLY: When execution state changes, update node data in-place
  // This avoids recreating nodes (which destroys selection state)
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isActive: currentNodeId === node.id,
          executionStatus,
          hasExecuted: executedNodes.has(node.id),
          executionSuccess: executedNodes.has(node.id) && !failedNodes.has(node.id),
          onManualTrigger,
          onDuplicateNode,
          onRemoveNode,
        },
      }))
    )
  }, [currentNodeId, executionStatus, executedNodes, failedNodes, onManualTrigger, onDuplicateNode, onRemoveNode, setNodes])

  // UPDATE EDGE STYLES: When execution state changes, update edge styles in-place
  useEffect(() => {
    setEdges((eds) =>
      eds.map((edge) => {
        const edgeKey = `${edge.source}-${edge.target}`
        const isExecuted = executedEdges.has(edgeKey) || executedEdges.has(edge.id)
        const isFailed = failedEdges.has(edgeKey) || failedEdges.has(edge.id)
        const isCurrentlyActive = currentNodeId === edge.source

        let edgeStyle: any = {}
        if (isFailed) {
          edgeStyle.stroke = '#ef4444'
          edgeStyle.strokeWidth = 3
        } else if (isExecuted) {
          edgeStyle.stroke = '#22c55e'
          edgeStyle.strokeWidth = 3
        } else if (isCurrentlyActive) {
          edgeStyle.stroke = '#00FF88'
          edgeStyle.strokeWidth = 2.5
        } else if (edge.sourceHandle === 'true') {
          edgeStyle.stroke = '#4ade80'
          edgeStyle.strokeWidth = 2
        } else if (edge.sourceHandle === 'false') {
          edgeStyle.stroke = '#f87171'
          edgeStyle.strokeWidth = 2
        } else {
          edgeStyle.stroke = '#3a3a3a'
          edgeStyle.strokeWidth = 2
        }

        return {
          ...edge,
          animated: isCurrentlyActive,
          style: edgeStyle,
        }
      })
    )
  }, [executedEdges, failedEdges, currentNodeId, setEdges])

  const onViewportChange = useCallback((viewport: { x: number, y: number, zoom: number }) => {
    setZoom(Math.round(viewport.zoom * 100))
  }, [])

  const handleZoomIn = () => reactFlowInstanceRef.current?.zoomIn()
  const handleZoomOut = () => reactFlowInstanceRef.current?.zoomOut()
  const handleFitView = () => reactFlowInstanceRef.current?.fitView({ padding: 0.2 })

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    if (!reactFlowWrapper.current) return

    const rect = reactFlowWrapper.current.getBoundingClientRect()
    setMenu({
      id: 'pane-menu',
      top: event.clientY - rect.top,
      left: event.clientX - rect.left,
      type: 'pane'
    })
  }, [])

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault()
    if (!reactFlowWrapper.current) return

    // Explicitly select the node on right click
    setNodes((nds) => nds.map((n) => ({
      ...n,
      selected: n.id === node.id
    })))
    setSelectedNodes([node.id])

    const rect = reactFlowWrapper.current.getBoundingClientRect()
    setMenu({
      id: node.id,
      top: event.clientY - rect.top,
      left: event.clientX - rect.left,
      type: 'node',
      data: node
    })
  }, [setNodes])

  const closeMenu = useCallback(() => setMenu(null), [])

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
          const workflowNodes: WorkflowNode[] = nodes.map((node) => ({
            id: node.id,
            type: node.data.type,
            config: node.data.config,
            position: node.position,
          }))

          const workflowEdges: WorkflowEdge[] = updatedEdges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: typeof e.label === 'string' ? e.label : undefined,
            condition: e.sourceHandle || undefined,
          }))

          onChange(workflowNodes, workflowEdges)
        }

        return updatedEdges
      })
    },
    [readonly, nodes, onChange, setEdges]
  )

  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes)

      if (onChange && !readonly) {
        const hasSignificantChange = changes.some(
          (c: any) => (c.type === 'position' && c.dragging === false) || c.type === 'remove'
        )

        if (hasSignificantChange) {
          // Wait for state to settle
          setTimeout(() => {
            setNodes((currentNodes) => {
              const workflowNodes: WorkflowNode[] = currentNodes.map((node) => ({
                id: node.id,
                type: node.data.type,
                config: node.data.config,
                position: node.position,
              }))

              setEdges((currentEdges) => {
                const workflowEdges: WorkflowEdge[] = currentEdges.map((e) => ({
                  id: e.id,
                  source: e.source,
                  target: e.target,
                  label: typeof e.label === 'string' ? e.label : undefined,
                  condition: e.sourceHandle || undefined,
                }))

                onChange(workflowNodes, workflowEdges)
                return currentEdges
              })

              return currentNodes
            })
          }, 0)
        }
      }
    },
    [onChange, readonly, onNodesChange, setNodes, setEdges]
  )

  const handleEdgesChange = useCallback(
    (changes: any) => {
      onEdgesChange(changes)

      if (onChange && !readonly) {
        const hasRemove = changes.some((c: any) => c.type === 'remove')

        if (hasRemove) {
          setTimeout(() => {
            setEdges((currentEdges) => {
              const workflowNodes: WorkflowNode[] = nodes.map((node) => ({
                id: node.id,
                type: node.data.type,
                config: node.data.config,
                position: node.position,
              }))

              const workflowEdges: WorkflowEdge[] = currentEdges.map((e) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                label: typeof e.label === 'string' ? e.label : undefined,
                condition: e.sourceHandle || undefined,
              }))

              onChange(workflowNodes, workflowEdges)
              return currentEdges
            })
          }, 0)
        }
      }
    },
    [nodes, onChange, readonly, onEdgesChange]
  )

  // Double-click handler: use current ReactFlow nodes to find the node
  // (not initialNodes which may be stale)
  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (onNodeDoubleClick) {
        const workflowNode: WorkflowNode = {
          id: node.id,
          type: node.data.type,
          config: node.data.config,
          position: node.position,
        }
        onNodeDoubleClick(workflowNode)
      }
    },
    [onNodeDoubleClick]
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

      // Convert screen position to flow position if instance is available
      let position: { x: number; y: number }
      if (reactFlowInstanceRef.current) {
        position = reactFlowInstanceRef.current.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        })
      } else {
        const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect()
        position = {
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top,
        }
      }

      if (onAddNode) {
        onAddNode(type, position)
      }
    },
    [onAddNode]
  )

  const onSelectionChange = useCallback(({ nodes: selectedNodes, edges: selectedEdges }: { nodes: Node[], edges: Edge[] }) => {
    setSelectedNodes(selectedNodes.map(n => n.id))
    setSelectedEdges(selectedEdges.map(e => e.id))
  }, [])

  const handleDelete = useCallback(() => {
    if (readonly) return

    if (selectedNodes.length > 0) {
      const updatedNodes = nodes.filter(n => !selectedNodes.includes(n.id))
      const updatedEdges = edges.filter(e => !selectedNodes.includes(e.source) && !selectedNodes.includes(e.target))

      setNodes(updatedNodes)
      setEdges(updatedEdges)

      if (onChange) {
        const workflowNodes: WorkflowNode[] = updatedNodes.map((node) => ({
          id: node.id,
          type: node.data.type,
          config: node.data.config,
          position: node.position,
        }))

        const workflowEdges: WorkflowEdge[] = updatedEdges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: typeof e.label === 'string' ? e.label : undefined,
          condition: e.sourceHandle || undefined,
        }))

        onChange(workflowNodes, workflowEdges)
      }

      setSelectedNodes([])
    }

    if (selectedEdges.length > 0) {
      const updatedEdges = edges.filter(e => !selectedEdges.includes(e.id))

      setEdges(updatedEdges)

      if (onChange) {
        const workflowNodes: WorkflowNode[] = nodes.map((node) => ({
          id: node.id,
          type: node.data.type,
          config: node.data.config,
          position: node.position,
        }))

        const workflowEdges: WorkflowEdge[] = updatedEdges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: typeof e.label === 'string' ? e.label : undefined,
          condition: e.sourceHandle || undefined,
        }))

        onChange(workflowNodes, workflowEdges)
      }

      setSelectedEdges([])
    }
  }, [readonly, selectedNodes, selectedEdges, nodes, edges, onChange])

  const clipboard = useRef<{ nodes: Node[], edges: Edge[] } | null>(null)

  const handleCopy = useCallback(() => {
    const nodesToCopy = nodes.filter(n => n.selected || selectedNodes.includes(n.id))
    const edgesToCopy = edges.filter(e => e.selected || selectedEdges.includes(e.id))

    if (nodesToCopy.length > 0) {
      clipboard.current = { nodes: nodesToCopy, edges: edgesToCopy }
    }
  }, [nodes, edges, selectedNodes, selectedEdges])

  const handlePaste = useCallback(() => {
    if (!clipboard.current || readonly) return

    const { nodes: copiedNodes, edges: copiedEdges } = clipboard.current
    const timestamp = Date.now()
    const idMap: Record<string, string> = {}

    // Create new nodes with offset position
    const newNodes: Node[] = copiedNodes.map(node => {
      const newId = `${node.data.type?.toLowerCase() || 'node'}-${timestamp}-${Math.random().toString(36).substring(2, 7)}`
      idMap[node.id] = newId

      return {
        ...node,
        id: newId,
        position: {
          x: node.position.x + 40,
          y: node.position.y + 40,
        },
        selected: true,
        data: {
          ...node.data,
          onManualTrigger,
          onDuplicateNode,
          onRemoveNode,
        },
      }
    })

    // Create new edges for the new nodes
    const newEdges: Edge[] = copiedEdges
      .filter(edge => idMap[edge.source] && idMap[edge.target])
      .map(edge => ({
        ...edge,
        id: `edge-${timestamp}-${Math.random().toString(36).substring(2, 7)}`,
        source: idMap[edge.source],
        target: idMap[edge.target],
        selected: true,
      }))

    // Build the combined node/edge lists
    setNodes((nds) => {
      const allNodes = [...nds.map(n => ({ ...n, selected: false })), ...newNodes]

      setEdges((eds) => {
        const allEdges = [...eds.map(e => ({ ...e, selected: false })), ...newEdges]

        if (onChange) {
          const workflowNodes: WorkflowNode[] = allNodes.map((node) => ({
            id: node.id,
            type: node.data.type,
            config: node.data.config,
            position: node.position,
          }))

          const workflowEdges: WorkflowEdge[] = allEdges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: typeof e.label === 'string' ? e.label : undefined,
            condition: e.sourceHandle || undefined,
          }))

          onChange(workflowNodes, workflowEdges)
        }
        return allEdges
      })

      return allNodes
    })
  }, [nodes, edges, readonly, onChange, onManualTrigger, onDuplicateNode, onRemoveNode, setNodes, setEdges])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // Delete/Backspace
      if ((event.key === 'Delete' || event.key === 'Backspace') && !readonly) {
        event.preventDefault()
        handleDelete()
      }

      // Copy (Ctrl+C or Cmd+C)
      if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        handleCopy()
      }

      // Paste (Ctrl+V or Cmd+V)
      if ((event.ctrlKey || event.metaKey) && event.key === 'v' && !readonly) {
        handlePaste()
      }

      // Escape to deselect
      if (event.key === 'Escape') {
        setNodes((nds) => nds.map((n) => ({ ...n, selected: false })))
        setEdges((eds) => eds.map((e) => ({ ...e, selected: false })))
        setSelectedNodes([])
        setSelectedEdges([])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleDelete, handleCopy, handlePaste, readonly, setNodes, setEdges])

  return (
    <div ref={reactFlowWrapper} className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={handleNodeDoubleClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onSelectionChange={onSelectionChange}
        onInit={(instance) => { reactFlowInstanceRef.current = instance }}
        onMove={(e, viewport) => onViewportChange(viewport)}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={closeMenu}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        selectNodesOnDrag={false}
        deleteKeyCode={null}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'custom',
          animated: true,
        }}
      >
        <Background />

        {/* Real-time MiniMap */}
        <div className="absolute bottom-4 right-4 z-50 pointer-events-auto">
          <div className="bg-[#1a1a1a]/80 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden shadow-2xl p-1">
            <MiniMap
              style={{
                width: 200,
                height: 150,
                background: 'transparent',
                borderRadius: '8px',
              }}
              ariaLabel="Mini visualizador do workflow"
              maskColor="rgba(0, 0, 0, 0.4)"
              nodeStrokeColor="#00FF88"
              nodeColor={(node) => {
                if (node.data.isActive) return '#00FF88'
                return '#333'
              }}
              pannable
              zoomable
            />
          </div>
        </div>

        {/* Custom Zoom Controls */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#1a1a1a]/80 backdrop-blur-md border border-white/5 p-1.5 rounded-full shadow-2xl">
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut size={18} />
          </button>
          <div className="px-3 border-x border-white/10 text-xs font-bold font-mono text-gray-400 min-w-[60px] text-center">
            {zoom}%
          </div>
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={handleFitView}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white ml-1"
            title="Fit View"
          >
            <Maximize size={18} />
          </button>
        </div>

        {/* Action Menu (Floating button to show sidebar if closed) */}
        {!readonly && (
          <div className="absolute top-6 left-6 z-50">
            {/* Note: In page.tsx we already have a button to toggle sidebar. 
                 This could be a quick-add node menu as well if needed. */}
          </div>
        )}

        {/* Context Menu Rendering */}
        {menu && (
          <div
            className="absolute z-[100] bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl py-2 min-w-[200px] backdrop-blur-md animate-fade-in"
            style={{ top: menu.top, left: menu.left }}
          >
            {menu.type === 'pane' ? (
              <>
                <div className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Adicionar Node</div>
                <button
                  onClick={() => { onAddNode?.(WorkflowNodeType.TRIGGER_MESSAGE, reactFlowInstanceRef.current?.screenToFlowPosition({ x: menu.left! + 50, y: menu.top! + 50 })); closeMenu() }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-blue-500/10 hover:text-blue-400 transition-colors text-sm text-gray-300"
                >
                  <Plus size={16} /> Novo Trigger
                </button>
                <div className="h-px bg-white/5 my-1" />
                <button
                  onClick={() => { onAddNode?.(WorkflowNodeType.SEND_MESSAGE, reactFlowInstanceRef.current?.screenToFlowPosition({ x: menu.left! + 50, y: menu.top! + 50 })); closeMenu() }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-green-500/10 hover:text-green-400 transition-colors text-sm text-gray-300"
                >
                  <Plus size={16} /> Enviar Mensagem
                </button>
                <button
                  onClick={() => { onAddNode?.(WorkflowNodeType.CONDITION, reactFlowInstanceRef.current?.screenToFlowPosition({ x: menu.left! + 50, y: menu.top! + 50 })); closeMenu() }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-yellow-500/10 hover:text-yellow-400 transition-colors text-sm text-gray-300"
                >
                  <Plus size={16} /> Condição
                </button>
                <div className="h-px bg-white/5 my-2" />
                <button
                  onClick={() => { handleFitView(); closeMenu() }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-white/5 transition-colors text-sm text-gray-300"
                >
                  <Maximize size={16} /> Centralizar Fluxo
                </button>
                {clipboard.current && (
                  <button
                    onClick={() => { handlePaste(); closeMenu() }}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-white/5 transition-colors text-sm text-gray-300 border-t border-white/5 mt-2"
                  >
                    📋 Colar Node
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Ações do Node</div>
                <button
                  onClick={() => {
                    if (onNodeDoubleClick && menu.data) {
                      const workflowNode: WorkflowNode = {
                        id: menu.data.id,
                        type: menu.data.data.type,
                        config: menu.data.data.config,
                        position: menu.data.position,
                      }
                      onNodeDoubleClick(workflowNode)
                    }
                    closeMenu()
                  }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-primary/10 hover:text-primary transition-colors text-sm text-gray-300"
                >
                  ✏️ Editar Node
                </button>
                <button
                  onClick={() => { handleCopy(); closeMenu() }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-white/5 transition-colors text-sm text-gray-300"
                >
                  📋 Copiar Node
                </button>
                <button
                  onClick={() => { handleDelete(); closeMenu() }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-red-500/10 hover:text-red-500 transition-colors text-sm text-gray-400"
                >
                  🗑️ Deletar Node
                </button>
                <div className="h-px bg-red-500/20 my-2" />
                <button
                  onClick={() => {
                    const newEdges = edges.filter(e => e.source !== menu.id && e.target !== menu.id)
                    setEdges(newEdges)

                    if (onChange) {
                      const workflowNodes: WorkflowNode[] = nodes.map((node) => ({
                        id: node.id,
                        type: node.data.type,
                        config: node.data.config,
                        position: node.position,
                      }))

                      const workflowEdges: WorkflowEdge[] = newEdges.map((e) => ({
                        id: e.id,
                        source: e.source,
                        target: e.target,
                        label: typeof e.label === 'string' ? e.label : undefined,
                        condition: e.sourceHandle || undefined,
                      }))

                      onChange(workflowNodes, workflowEdges)
                    }

                    closeMenu()
                  }}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-red-500/10 hover:text-red-500 transition-colors text-sm text-gray-400"
                >
                  🔗 Desconectar Tudo
                </button>
              </>
            )}
          </div>
        )}
      </ReactFlow>
    </div>
  )
}
