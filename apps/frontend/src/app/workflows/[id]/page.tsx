'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { apiClient } from '@/lib/api-client'
import { wsClient } from '@/lib/websocket'
import { WorkflowNode, WorkflowEdge, EventType, WorkflowNodeType } from '@n9n/shared'
import NodeConfigModal from '@/components/NodeConfigModal'
import ExecutionHistory from '@/components/ExecutionHistory'
import NodeExecutionPanel from '@/components/NodeExecutionPanel'
import NodesSidebar from '@/components/NodesSidebar'
import { useAuth } from '@/contexts/AuthContext'
import { AuthGuard } from '@/components/AuthGuard'
import AppHeader from '@/components/AppHeader'
import { Copy } from 'lucide-react'

const WorkflowCanvas = dynamic(() => import('@/components/WorkflowCanvas'), {
  ssr: false,
})

function WorkflowPageContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const workflowId = params.id as string
  const { tenant, token } = useAuth()

  // Get tenantId from URL query param (for SUPERADMIN viewing other workspaces) or from auth context
  const tenantIdFromUrl = searchParams?.get('tenantId')
  const tenantId = tenantIdFromUrl || tenant?.id

  const [workflow, setWorkflow] = useState<any>(null)
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null)
  const [executionStatus, setExecutionStatus] = useState<'idle' | 'running' | 'waiting' | 'completed' | 'failed'>('idle')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null)
  const [inspectedNode, setInspectedNode] = useState<WorkflowNode | null>(null)
  const [showNodesSidebar, setShowNodesSidebar] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [executedNodes, setExecutedNodes] = useState<Set<string>>(new Set())
  const [failedNodes, setFailedNodes] = useState<Set<string>>(new Set())
  const [executedEdges, setExecutedEdges] = useState<Set<string>>(new Set())
  const [failedEdges, setFailedEdges] = useState<Set<string>>(new Set())
  const [previousNodeId, setPreviousNodeId] = useState<string | null>(null)
  const [isViewingHistory, setIsViewingHistory] = useState(false)
  const [historicalExecutionId, setHistoricalExecutionId] = useState<string | null>(null)

  // Refs to keep track of latest nodes and edges
  const currentNodesRef = useRef<WorkflowNode[]>([])
  const currentEdgesRef = useRef<WorkflowEdge[]>([])

  useEffect(() => {
    if (tenantId && token) {
      loadWorkflow()
      // Connect websocket with the actual tenantId being used
      wsClient.connect(tenantId, token)
    }

    // Listen for execution events
    const handleExecutionStarted = (event: any) => {
      if (event.workflowId === workflowId) {
        setExecutionStatus('running')
        setCurrentNodeId(null)
        setCurrentExecutionId(event.executionId)
        // Clear previous execution tracking
        setExecutedNodes(new Set())
        setFailedNodes(new Set())
        setExecutedEdges(new Set())
        setFailedEdges(new Set())
        setPreviousNodeId(null)
      }
    }

    const handleNodeExecuted = (event: any) => {
      if (event.workflowId === workflowId) {
        // Throttle: ignore if we're processing too many events (possible infinite loop)
        const now = Date.now()
        if (!handleNodeExecuted.lastProcessedTime) {
          handleNodeExecuted.lastProcessedTime = now
          handleNodeExecuted.eventCount = 0
        }

        handleNodeExecuted.eventCount++

        // If we're receiving more than 5 events per second, throttle aggressively
        if (now - handleNodeExecuted.lastProcessedTime < 200) {
          if (handleNodeExecuted.eventCount > 5) {
            console.warn(`[WORKFLOW] Too many node executed events (${handleNodeExecuted.eventCount} in ${now - handleNodeExecuted.lastProcessedTime}ms), throttling...`)
            // If we're getting too many events, stop processing and show error
            if (handleNodeExecuted.eventCount > 50) {
              setExecutionStatus('failed')
              console.error('[WORKFLOW] Detected infinite loop - stopping execution tracking')
              return
            }
            return
          }
        } else {
          handleNodeExecuted.lastProcessedTime = now
          handleNodeExecuted.eventCount = 0
        }

        // Additional check: if same node is executed more than 100 times, it's likely a loop
        if (!handleNodeExecuted.nodeExecutionCount) {
          handleNodeExecuted.nodeExecutionCount = new Map()
        }
        const nodeCount = handleNodeExecuted.nodeExecutionCount.get(event.nodeId) || 0
        if (nodeCount > 100) {
          console.error(`[WORKFLOW] Node ${event.nodeId} executed ${nodeCount} times - likely infinite loop`)
          setExecutionStatus('failed')
          return
        }
        handleNodeExecuted.nodeExecutionCount.set(event.nodeId, nodeCount + 1)

        const prevNodeId = currentNodeId || previousNodeId
        setCurrentNodeId(event.nodeId)
        // Mark node as executed successfully
        setExecutedNodes(prev => new Set([...prev, event.nodeId]))

        // Track executed edges: when a node executes, the edge from previous to current was executed
        // Use currentEdgesRef to ensure we have the latest edges
        const currentEdges = currentEdgesRef.current.length > 0 ? currentEdgesRef.current : (workflow?.edges || [])

        if (prevNodeId && currentEdges.length > 0) {
          // Find the edge that connects previous node to current node
          const executedEdge = currentEdges.find((e: WorkflowEdge) =>
            e.source === prevNodeId && e.target === event.nodeId
          )

          if (executedEdge) {
            const edgeId = `${executedEdge.source}-${executedEdge.target}`
            setExecutedEdges(prev => {
              const newSet = new Set([...prev, edgeId])
              return newSet
            })
          }
        } else if (!prevNodeId) {
          // First node execution - no edge to track yet
          setPreviousNodeId(event.nodeId)
        }

        // Update previous node ID for next iteration
        setPreviousNodeId(event.nodeId)
      }
    }

    // Initialize throttling variables
    handleNodeExecuted.lastProcessedTime = 0
    handleNodeExecuted.eventCount = 0
    handleNodeExecuted.nodeExecutionCount = new Map()

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

    const handleExecutionCompleted = async (event: any) => {
      if (event.workflowId === workflowId) {
        setExecutionStatus('completed')

        // Reset node execution count on completion
        if (handleNodeExecuted.nodeExecutionCount) {
          handleNodeExecuted.nodeExecutionCount.clear()
        }

        // Load execution logs to reconstruct the full execution path
        if (event.executionId) {
          try {
            const logs = await apiClient.getExecutionLogs(event.executionId)
            const executedNodeIds: string[] = []

            // Extract node execution sequence from logs
            logs.forEach((log: any) => {
              const logType = log.eventType || log.type
              if (logType === 'node.executed' && log.nodeId) {
                executedNodeIds.push(log.nodeId)
              }
            })

            // Use currentEdgesRef to ensure we have the latest edges
            const currentEdges = currentEdgesRef.current.length > 0 ? currentEdgesRef.current : (workflow?.edges || [])

            // Reconstruct executed edges from node sequence
            const executedEdgesSet = new Set<string>()
            for (let i = 0; i < executedNodeIds.length - 1; i++) {
              const sourceNodeId = executedNodeIds[i]
              const targetNodeId = executedNodeIds[i + 1]

              // Find edge connecting these nodes
              const edge = currentEdges.find((e: WorkflowEdge) =>
                e.source === sourceNodeId && e.target === targetNodeId
              )

              if (edge) {
                const edgeId = `${edge.source}-${edge.target}`
                executedEdgesSet.add(edgeId)
              }
            }

            setExecutedEdges(executedEdgesSet)
          } catch (error) {
            console.error('Error loading execution logs:', error)
          }
        }

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

          // Mark edges from failed node as failed
          const currentEdges = currentEdgesRef.current.length > 0 ? currentEdgesRef.current : (workflow?.edges || [])
          if (currentEdges.length > 0) {
            const edgesFromNode = currentEdges.filter((e: WorkflowEdge) => e.source === event.nodeId)
            edgesFromNode.forEach((edge: WorkflowEdge) => {
              const edgeId = `${edge.source}-${edge.target}`
              setFailedEdges(prev => new Set([...prev, edgeId]))
            })
          }
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
  }, [workflowId, tenantId, token])

  const loadWorkflow = async () => {
    try {
      setError(null)
      // Pass tenantId if available (for SUPERADMIN viewing other workspaces)
      const data = await apiClient.getWorkflow(workflowId, tenantId || undefined)
      setWorkflow(data)

      // Initialize refs with loaded data
      currentNodesRef.current = data.nodes || []
      currentEdgesRef.current = data.edges || []
    } catch (err: any) {
      console.error('Error loading workflow:', err)
      if (err.response?.status === 404) {
        setError('Workflow not found')
      } else {
        setError(err.response?.data?.message || 'Failed to load workflow')
      }
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
      // Pass tenantId if available (for SUPERADMIN viewing other workspaces)
      await apiClient.updateWorkflow(workflowId, { nodes, edges }, tenantId || undefined)
      // Sync parent state so initialNodes/initialEdges stay current
      // This is critical for pasted/deleted nodes to be recognized by the parent
      setWorkflow((prev: any) => ({ ...prev, nodes, edges }))
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

      // Pass tenantId if available (for SUPERADMIN viewing other workspaces)
      await apiClient.updateWorkflow(workflowId, { nodes: updatedNodes, edges: currentEdges }, tenantId || undefined)

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

  const handleManualTrigger = async (nodeId: string) => {
    try {
      console.log('[MANUAL TRIGGER] Starting workflow manually from node:', nodeId)

      // Find the trigger node to get its config
      const triggerNode = workflow.nodes.find((n: WorkflowNode) => n.id === nodeId)
      if (!triggerNode) {
        alert('Node not found')
        return
      }

      // Check if it's a LOOP node (or any other node type we want to test in isolation)
      if (triggerNode.type === WorkflowNodeType.LOOP) {
        console.log('[TEST NODE] Testing LOOP node with current context')
        // Pass currentExecutionId if available to continue from that context
        await apiClient.testNode(workflowId, nodeId, currentExecutionId || undefined)
        console.log('[TEST NODE] Node execution started')
      } else {
        // Default behavior for manual triggers (starts fresh execution)
        await apiClient.triggerManualExecution(workflowId, nodeId)
        console.log('[MANUAL TRIGGER] Workflow started successfully')
      }

    } catch (error: any) {
      console.error('[MANUAL TRIGGER] Error starting workflow:', error)
      alert(`Erro ao executar workflow: ${error.message || 'Unknown error'}`)
    }
  }

  const handleAddNode = async (type: WorkflowNodeType, position?: { x: number; y: number }) => {
    console.log('[handleAddNode] Received type:', type);
    console.log('[handleAddNode] Type of type:', typeof type);

    if (!type) {
      console.error('[handleAddNode] ERROR: type is undefined!');
      return;
    }

    // Compute smart position: near the last node in the workflow
    let defaultPosition = { x: 250, y: 250 }
    if (!position) {
      const currentNodes = currentNodesRef.current.length > 0 ? currentNodesRef.current : workflow.nodes
      if (currentNodes && currentNodes.length > 0) {
        // Find the last node (most recently added)
        const lastNode = currentNodes[currentNodes.length - 1]
        if (lastNode?.position) {
          defaultPosition = {
            x: lastNode.position.x,
            y: lastNode.position.y + 150, // Below the last node
          }
        }
      }
    }

    const newNode: WorkflowNode = {
      id: `${String(type).toLowerCase()}-${Date.now()}`,
      type,
      position: position || defaultPosition,
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

      // Pass tenantId if available (for SUPERADMIN viewing other workspaces)
      const result = await apiClient.updateWorkflow(
        workflowId,
        {
          nodes: updatedNodes,
          edges: currentEdges // Use current edges from ref
        },
        tenantId || undefined
      )

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

  const handleViewHistoricalExecution = (executionId: string, logs: any[]) => {
    // Clear current execution state
    setIsViewingHistory(true)
    setHistoricalExecutionId(executionId)
    setCurrentExecutionId(executionId)
    setExecutionStatus('idle')

    // Process logs to extract executed and failed nodes
    const executed = new Set<string>()
    const failed = new Set<string>()
    const executedNodeIds: string[] = []

    logs.forEach((log: any) => {
      // Check both type and eventType fields
      const eventType = log.type || log.eventType || ''

      // Try to get nodeId from different possible locations
      let nodeId = log.nodeId

      // If nodeId is not directly available, try to get it from the data field
      if (!nodeId && log.data) {
        nodeId = log.data.nodeId
      }

      // For node.executed events
      if (eventType.includes('node.executed') && nodeId) {
        executed.add(nodeId)
        executedNodeIds.push(nodeId)
      }

      // For error/failed events
      if ((eventType.includes('error') || eventType.includes('failed')) && nodeId) {
        failed.add(nodeId)
      }
    })

    setExecutedNodes(executed)
    setFailedNodes(failed)

    // Reconstruct executed edges from node sequence
    if (workflow?.edges && executedNodeIds.length > 1) {
      const executedEdgesSet = new Set<string>()
      for (let i = 0; i < executedNodeIds.length - 1; i++) {
        const sourceNodeId = executedNodeIds[i]
        const targetNodeId = executedNodeIds[i + 1]

        // Find edge connecting these nodes
        const edge = workflow.edges.find((e: WorkflowEdge) =>
          e.source === sourceNodeId && e.target === targetNodeId
        )

        if (edge) {
          const edgeId = `${edge.source}-${edge.target}`
          executedEdgesSet.add(edgeId)
        }
      }

      setExecutedEdges(executedEdgesSet)
    }
  }

  const clearHistoricalView = () => {
    setIsViewingHistory(false)
    setHistoricalExecutionId(null)
    setCurrentExecutionId(null)
    setExecutedNodes(new Set())
    setFailedNodes(new Set())
  }

  const toggleActive = async () => {
    try {
      // Pass tenantId if available (for SUPERADMIN viewing other workspaces)
      const updated = await apiClient.updateWorkflow(
        workflowId,
        {
          isActive: !workflow.isActive,
        },
        tenantId || undefined
      )
      setWorkflow(updated)
    } catch (error) {
      console.error('Error toggling workflow:', error)
    }
  }

  const handleDuplicate = async () => {
    try {
      setSaveStatus('saving')
      const duplicated = await apiClient.duplicateWorkflow(workflowId, tenantId || undefined)
      setSaveStatus('saved')
      // Redirect to the new workflow after a short delay
      setTimeout(() => {
        router.push(`/workflows/${duplicated.id}${tenantIdFromUrl ? `?tenantId=${tenantIdFromUrl}` : ''}`)
      }, 500)
    } catch (error) {
      console.error('Error duplicating workflow:', error)
      setSaveStatus('error')
      alert('Failed to duplicate workflow')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-400">Loading workflow...</p>
        </div>
      </div>
    )
  }

  if (error || !workflow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-400">Workflow not found</h1>
          <p className="text-gray-400 mb-4">{error || 'The workflow you are looking for does not exist or you do not have permission to access it.'}</p>
          <button
            onClick={() => {
              // If came from workspace, go back to workspace, otherwise go to home
              if (tenantIdFromUrl) {
                router.push(`/workspaces/${tenantIdFromUrl}?tab=workflows`)
              } else {
                router.push('/')
              }
            }}
            className="px-4 py-2 bg-primary text-black rounded hover:bg-primary/80 transition"
          >
            {tenantIdFromUrl ? 'Back to Workspace' : 'Go Home'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      <AppHeader />
      {/* Header */}
      <div className="bg-surface border-b border-border p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              // If came from workspace, go back to workspace, otherwise go to home
              if (tenantIdFromUrl) {
                router.push(`/workspaces/${tenantIdFromUrl}?tab=workflows`)
              } else {
                router.push('/')
              }
            }}
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
            <div className={`flex items-center gap-2 px-4 py-2 rounded border ${saveStatus === 'saving' ? 'bg-blue-500/10 border-blue-500' :
              saveStatus === 'saved' ? 'bg-green-500/10 border-green-500' :
                'bg-red-500/10 border-red-500'
              }`}>
              <div className={`w-2 h-2 rounded-full ${saveStatus === 'saving' ? 'bg-blue-500 animate-pulse' :
                saveStatus === 'saved' ? 'bg-green-500' :
                  'bg-red-500'
                }`} />
              <span className={`text-sm ${saveStatus === 'saving' ? 'text-blue-400' :
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
              <div className={`w-2 h-2 rounded-full ${executionStatus === 'running' ? 'bg-blue-500 animate-pulse' :
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

          {isViewingHistory && (
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500 rounded">
              <span className="text-sm text-purple-400">
                📜 Viewing historical execution
              </span>
              <button
                onClick={clearHistoricalView}
                className="ml-2 px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 rounded text-xs transition"
              >
                Clear
              </button>
            </div>
          )}

          {currentExecutionId && !isViewingHistory && (
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
            onClick={handleDuplicate}
            className="px-4 py-2 bg-surface border border-border rounded hover:border-primary transition flex items-center gap-2"
          >
            <Copy size={16} className="text-primary" />
            <span>Duplicate</span>
          </button>

          <button
            onClick={toggleActive}
            className={`px-4 py-2 rounded transition ${workflow.isActive
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
            onManualTrigger={handleManualTrigger}
            executedNodes={executedNodes}
            failedNodes={failedNodes}
            executedEdges={executedEdges}
            failedEdges={failedEdges}
          />
        </div>
      </div>

      {/* Modals & Panels */}
      {selectedNode && tenantId && (
        <NodeConfigModal
          node={selectedNode}
          tenantId={tenantId}
          onClose={() => setSelectedNode(null)}
          onSave={handleNodeConfigSave}
        />
      )}

      {inspectedNode && tenantId && (
        <NodeExecutionPanel
          node={inspectedNode}
          executionId={isViewingHistory ? historicalExecutionId : currentExecutionId}
          tenantId={tenantId}
          onClose={() => setInspectedNode(null)}
          onSave={handleNodeConfigSave}
        />
      )}

      {showHistory && tenantId && (
        <ExecutionHistory
          workflowId={workflowId}
          tenantId={tenantId}
          onClose={() => setShowHistory(false)}
          onSelectExecution={handleViewHistoricalExecution}
        />
      )}
    </div>
  )
}

export default function WorkflowPage() {
  return (
    <AuthGuard>
      <WorkflowPageContent />
    </AuthGuard>
  )
}
