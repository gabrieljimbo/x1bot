'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { apiClient } from '@/lib/api-client'
import { wsClient } from '@/lib/websocket'
import { WorkflowNode, WorkflowEdge, EventType, WorkflowNodeType } from '@n9n/shared'
import NodeConfigModal from '@/components/NodeConfigModal'
import ExecutionHistory from '@/components/ExecutionHistory'
import NodeExecutionPanel from '@/components/NodeExecutionPanel'
import NodesSidebar from '@/components/NodesSidebar'

const WorkflowCanvas = dynamic(() => import('@/components/WorkflowCanvas'), {
  ssr: false,
})

export default function WorkflowPage() {
  const params = useParams()
  const router = useRouter()
  const workflowId = params.id as string
  const tenantId = 'demo-tenant'

  const [workflow, setWorkflow] = useState<any>(null)
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null)
  const [executionStatus, setExecutionStatus] = useState<'idle' | 'running' | 'waiting' | 'completed' | 'failed'>('idle')
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null)
  const [inspectedNode, setInspectedNode] = useState<WorkflowNode | null>(null)
  const [showNodesSidebar, setShowNodesSidebar] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [executedNodes, setExecutedNodes] = useState<Set<string>>(new Set())
  const [failedNodes, setFailedNodes] = useState<Set<string>>(new Set())
  
  // Refs to keep track of latest nodes and edges
  const currentNodesRef = useRef<WorkflowNode[]>([])
  const currentEdgesRef = useRef<WorkflowEdge[]>([])

  useEffect(() => {
    loadWorkflow()
    wsClient.connect(tenantId)

    // Listen for execution events
    const handleExecutionStarted = (event: any) => {
      console.log('[DEBUG] Execution started event:', event)
      if (event.workflowId === workflowId) {
        console.log('[DEBUG] Setting execution ID:', event.executionId)
        setExecutionStatus('running')
        setCurrentNodeId(null)
        setCurrentExecutionId(event.executionId)
        // Clear previous execution tracking
        setExecutedNodes(new Set())
        setFailedNodes(new Set())
      }
    }

    const handleNodeExecuted = (event: any) => {
      if (event.workflowId === workflowId) {
        setCurrentNodeId(event.nodeId)
        // Mark node as executed successfully
        setExecutedNodes(prev => new Set([...prev, event.nodeId]))
      }
    }

    const handleExecutionWaiting = (event: any) => {
      if (event.workflowId === workflowId) {
        setExecutionStatus('waiting')
        setCurrentNodeId(event.currentNodeId)
      }
    }

    const handleExecutionResumed = (event: any) => {
      if (event.workflowId === workflowId) {
        setExecutionStatus('running')
      }
    }

    const handleExecutionCompleted = (event: any) => {
      if (event.workflowId === workflowId) {
        setExecutionStatus('completed')
        // Keep the execution ID for a while so users can inspect nodes
        setTimeout(() => {
          setCurrentNodeId(null)
          setExecutionStatus('idle')
        }, 3000)
        // Clear execution ID after 30 seconds
        setTimeout(() => {
          setCurrentExecutionId(null)
        }, 30000)
      }
    }

    const handleExecutionError = (event: any) => {
      if (event.workflowId === workflowId) {
        setExecutionStatus('failed')
        // Mark current node as failed
        if (event.nodeId) {
          setFailedNodes(prev => new Set([...prev, event.nodeId]))
        }
        setTimeout(() => {
          setCurrentNodeId(null)
          setExecutionStatus('idle')
        }, 5000)
      }
    }

    wsClient.on(EventType.EXECUTION_STARTED, handleExecutionStarted)
    wsClient.on(EventType.NODE_EXECUTED, handleNodeExecuted)
    wsClient.on(EventType.EXECUTION_WAITING, handleExecutionWaiting)
    wsClient.on(EventType.EXECUTION_RESUMED, handleExecutionResumed)
    wsClient.on(EventType.EXECUTION_COMPLETED, handleExecutionCompleted)
    wsClient.on(EventType.EXECUTION_ERROR, handleExecutionError)

    return () => {
      wsClient.off(EventType.EXECUTION_STARTED, handleExecutionStarted)
      wsClient.off(EventType.NODE_EXECUTED, handleNodeExecuted)
      wsClient.off(EventType.EXECUTION_WAITING, handleExecutionWaiting)
      wsClient.off(EventType.EXECUTION_RESUMED, handleExecutionResumed)
      wsClient.off(EventType.EXECUTION_COMPLETED, handleExecutionCompleted)
      wsClient.off(EventType.EXECUTION_ERROR, handleExecutionError)
    }
  }, [workflowId, tenantId])

  const loadWorkflow = async () => {
    try {
      const data = await apiClient.getWorkflow(tenantId, workflowId)
      setWorkflow(data)
      
      // Initialize refs with loaded data
      currentNodesRef.current = data.nodes || []
      currentEdgesRef.current = data.edges || []
    } catch (error) {
      console.error('Error loading workflow:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (nodes: WorkflowNode[], edges: WorkflowEdge[]) => {
    // Update refs with latest data
    currentNodesRef.current = nodes
    currentEdgesRef.current = edges
    
    try {
      setSaveStatus('saving')
      await apiClient.updateWorkflow(tenantId, workflowId, { nodes, edges })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      console.error('Error saving workflow:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const handleNodeDoubleClick = (node: WorkflowNode) => {
    console.log('[DEBUG] Node double clicked:', node.id)
    console.log('[DEBUG] Current execution ID:', currentExecutionId)
    
    // If there's an active or recent execution, show execution panel
    if (currentExecutionId) {
      console.log('[DEBUG] Opening execution panel')
      setInspectedNode(node)
    } else {
      // Otherwise show config modal
      console.log('[DEBUG] Opening config modal')
      setSelectedNode(node)
    }
  }

  const handleNodeConfigSave = async (nodeId: string, config: any) => {
    try {
      setSaveStatus('saving')
      
      // Use the latest nodes and edges from refs
      const currentNodes = currentNodesRef.current.length > 0 ? currentNodesRef.current : workflow.nodes
      const currentEdges = currentEdgesRef.current.length > 0 ? currentEdgesRef.current : workflow.edges
      
      const updatedNodes = currentNodes.map((node: WorkflowNode) =>
        node.id === nodeId ? { ...node, config } : node
      )
      
      await apiClient.updateWorkflow(tenantId, workflowId, { nodes: updatedNodes, edges: currentEdges })
      
      // Update refs
      currentNodesRef.current = updatedNodes
      
      // Update state
      setWorkflow({ ...workflow, nodes: updatedNodes, edges: currentEdges })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      console.error('Error updating node config:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const handleAddNode = async (type: WorkflowNodeType, position?: { x: number; y: number }) => {
    console.log('[handleAddNode] Received type:', type);
    console.log('[handleAddNode] Type of type:', typeof type);
    
    if (!type) {
      console.error('[handleAddNode] ERROR: type is undefined!');
      return;
    }
    
    const newNode: WorkflowNode = {
      id: `${String(type).toLowerCase()}-${Date.now()}`,
      type,
      position: position || { x: 250, y: 250 },
      config: {},
    }
    
    console.log('[handleAddNode] Created node:', newNode);

    // Use the latest nodes and edges from refs (updated by React Flow)
    const currentNodes = currentNodesRef.current.length > 0 ? currentNodesRef.current : workflow.nodes
    const currentEdges = currentEdgesRef.current.length > 0 ? currentEdgesRef.current : workflow.edges
    
    const updatedNodes = [...currentNodes, newNode]
    
    console.log('[DEBUG] Adding node:', { type, position, newNode })
    console.log('[DEBUG] Current nodes:', currentNodes)
    console.log('[DEBUG] Current edges:', currentEdges)
    console.log('[DEBUG] Updated nodes:', updatedNodes)
    
    try {
      setSaveStatus('saving')
      console.log('[DEBUG] Calling API to update workflow...')
      
      const result = await apiClient.updateWorkflow(tenantId, workflowId, { 
        nodes: updatedNodes, 
        edges: currentEdges // Use current edges from ref
      })
      
      console.log('[DEBUG] API response:', result)
      
      // Update refs
      currentNodesRef.current = updatedNodes
      
      // Update state
      setWorkflow({ ...workflow, nodes: updatedNodes, edges: currentEdges })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error: any) {
      console.error('[ERROR] Failed to add node:', error)
      console.error('[ERROR] Error details:', error.response?.data || error.message)
      setSaveStatus('error')
      
      // Show error message to user
      alert(`Erro ao adicionar nó: ${error.response?.data?.message || error.message}`)
      
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const toggleActive = async () => {
    try {
      const updated = await apiClient.updateWorkflow(tenantId, workflowId, {
        isActive: !workflow.isActive,
      })
      setWorkflow(updated)
    } catch (error) {
      console.error('Error toggling workflow:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (!workflow) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Workflow not found</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-surface border-b border-border p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-surface border border-border rounded hover:border-primary transition"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-2xl font-bold">{workflow.name}</h1>
            {workflow.description && (
              <p className="text-sm text-gray-400">{workflow.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Save Status Indicator */}
          {saveStatus !== 'idle' && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded border ${
              saveStatus === 'saving' ? 'bg-blue-500/10 border-blue-500' :
              saveStatus === 'saved' ? 'bg-green-500/10 border-green-500' :
              'bg-red-500/10 border-red-500'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                saveStatus === 'saving' ? 'bg-blue-500 animate-pulse' :
                saveStatus === 'saved' ? 'bg-green-500' :
                'bg-red-500'
              }`} />
              <span className={`text-sm ${
                saveStatus === 'saving' ? 'text-blue-400' :
                saveStatus === 'saved' ? 'text-green-400' :
                'text-red-400'
              }`}>
                {saveStatus === 'saving' ? 'Salvando...' :
                 saveStatus === 'saved' ? 'Salvo!' :
                 'Erro ao salvar'}
              </span>
            </div>
          )}

          {/* Execution Status Indicator */}
          {executionStatus !== 'idle' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded">
              <div className={`w-2 h-2 rounded-full ${
                executionStatus === 'running' ? 'bg-blue-500 animate-pulse' :
                executionStatus === 'waiting' ? 'bg-yellow-500 animate-pulse' :
                executionStatus === 'completed' ? 'bg-primary' :
                executionStatus === 'failed' ? 'bg-red-500' :
                'bg-gray-500'
              }`} />
              <span className="text-sm">
                {executionStatus === 'running' ? 'Running' :
                 executionStatus === 'waiting' ? 'Waiting for reply' :
                 executionStatus === 'completed' ? 'Completed' :
                 executionStatus === 'failed' ? 'Failed' :
                 'Idle'}
              </span>
            </div>
          )}

          {currentExecutionId && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500 rounded">
              <span className="text-sm text-blue-400">
                💡 Double-click nodes to inspect execution data
              </span>
            </div>
          )}

          <button
            onClick={() => setShowNodesSidebar(!showNodesSidebar)}
            className="px-4 py-2 bg-surface border border-border rounded hover:border-primary transition flex items-center gap-2"
          >
            <span>➕</span>
            <span>Add Node</span>
          </button>

          <button
            onClick={() => setShowHistory(true)}
            className="px-4 py-2 bg-surface border border-border rounded hover:border-primary transition"
          >
            📊 History
          </button>

          <button
            onClick={toggleActive}
            className={`px-4 py-2 rounded transition ${
              workflow.isActive
                ? 'bg-primary text-black hover:bg-primary/80'
                : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
          >
            {workflow.isActive ? 'Active' : 'Inactive'}
          </button>
        </div>
      </div>

      {/* Canvas with Sidebar */}
      <div className="flex-1 flex relative">
        {/* Sidebar Overlay */}
        {showNodesSidebar && (
          <>
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/50 z-40 backdrop-blur-sm"
              onClick={() => setShowNodesSidebar(false)}
            />
            
            {/* Sidebar */}
            <div className="absolute right-0 top-0 bottom-0 z-50 animate-slide-in-right">
              <NodesSidebar 
                onAddNode={(type: WorkflowNodeType, position?: { x: number; y: number }) => {
                  handleAddNode(type, position)
                  setShowNodesSidebar(false)
                }} 
                onClose={() => setShowNodesSidebar(false)}
              />
            </div>
          </>
        )}

        {/* Canvas */}
        <div className="flex-1">
          <WorkflowCanvas
            initialNodes={workflow.nodes}
            initialEdges={workflow.edges}
            onChange={handleSave}
            currentNodeId={currentNodeId}
            executionStatus={executionStatus}
            onNodeDoubleClick={handleNodeDoubleClick}
            onAddNode={handleAddNode}
            executedNodes={executedNodes}
            failedNodes={failedNodes}
          />
        </div>
      </div>

      {/* Modals & Panels */}
      {selectedNode && (
        <NodeConfigModal
          node={selectedNode}
          tenantId={tenantId}
          onClose={() => setSelectedNode(null)}
          onSave={handleNodeConfigSave}
        />
      )}

      {inspectedNode && (
        <NodeExecutionPanel
          node={inspectedNode}
          executionId={currentExecutionId}
          tenantId={tenantId}
          onClose={() => setInspectedNode(null)}
        />
      )}

      {showHistory && (
        <ExecutionHistory
          workflowId={workflowId}
          tenantId={tenantId}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  )
}

