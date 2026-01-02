'use client'

import { useState, useEffect, useMemo } from 'react'
import { WorkflowNode } from '@n9n/shared'
import { X, ChevronRight, Search } from 'lucide-react'
import NodeConfigModal from './NodeConfigModal'
import { apiClient } from '@/lib/api-client'

interface NodeExecutionPanelProps {
  node: WorkflowNode
  executionId: string | null
  tenantId: string
  onClose: () => void
  onSave?: (nodeId: string, config: any) => Promise<void>
}

type ViewMode = 'json' | 'table' | 'schema'

export default function NodeExecutionPanel({
  node,
  executionId,
  tenantId,
  onClose,
  onSave,
}: NodeExecutionPanelProps) {
  const [inputCollapsed, setInputCollapsed] = useState(false)
  const [outputCollapsed, setOutputCollapsed] = useState(false)
  const [viewModeInput, setViewModeInput] = useState<ViewMode>('json')
  const [viewModeOutput, setViewModeOutput] = useState<ViewMode>('json')
  const [viewModeConfig, setViewModeConfig] = useState<ViewMode>('schema')
  const [executionData, setExecutionData] = useState<any>(null)
  const [executionLogs, setExecutionLogs] = useState<any[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string>(node.id)
  const [configNodeId] = useState<string>(node.id) // Fixed node for config - never changes
  const [loading, setLoading] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNode[]>([])

  useEffect(() => {
    if (executionId) {
      loadExecutionData()
    }
  }, [executionId])

  // DON'T update selectedNodeId when node.id changes - we manage it manually
  // useEffect(() => {
  //   setSelectedNodeId(node.id)
  // }, [node.id])

  useEffect(() => {
    if (executionData?.workflowId) {
      loadWorkflowNodes()
    }
  }, [executionData?.workflowId])

  const loadExecutionData = async () => {
    if (!executionId) return

    try {
      setLoading(true)

      // Load execution details
      try {
        const data = await apiClient.getExecution(tenantId, executionId)
        setExecutionData(data)
      } catch (error: any) {
        if (error.response?.status !== 404) {
          console.error('Failed to load execution:', error)
        }
      }

      // Load execution logs to get node-specific data
      try {
        const logs = await apiClient.getExecutionLogs(tenantId, executionId)
        logs.forEach((log: any, index: number) => {
          // Process logs
        })
        setExecutionLogs(logs)
      } catch (error: any) {
        if (error.response?.status !== 404) {
          console.error('Failed to load logs:', error)
        }
      }
    } catch (error) {
      console.error('[loadExecutionData] Error loading execution data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadWorkflowNodes = async () => {
    if (!executionData?.workflowId) {
      return
    }

    try {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.n9n.archcode.space').replace(/\/$/, '')
      const workflowUrl = `${API_URL}/api/workflows/${executionData.workflowId}?tenantId=${tenantId}`
      const response = await fetch(workflowUrl)
      if (response.ok) {
        const workflow = await response.json()
        setWorkflowNodes(workflow.nodes || [])
      }
    } catch (error) {
      console.error('[loadWorkflowNodes] Error:', error)
    }
  }

  const getCurrentNodeData = () => {
    const nodeExecutedLog = executionLogs.find(
      (log) => {
        const logType = log.eventType || log.type
        return logType === 'node.executed' && log.nodeId === selectedNodeId
      }
    )

    if (nodeExecutedLog?.data) {
      // The backend saves the entire event in the 'data' field
      // The event itself is stored directly in log.data
      const eventData = nodeExecutedLog.data

      // Return the event data directly - it contains output, variables, etc.
      return eventData
    }

    return executionData?.context || {}
  }

  const getNodeInputData = () => {
    // If a different node is selected, show its OUTPUT
    if (selectedNodeId !== node.id) {
      const nodeExecutedLog = executionLogs.find(
        (log) => {
          const logType = log.eventType || log.type
          return logType === 'node.executed' && log.nodeId === selectedNodeId
        }
      )

      if (nodeExecutedLog?.data) {
        const eventData = nodeExecutedLog.data
        const nodeType = eventData?.nodeType || nodeExecutedLog.nodeType
        
        // Special handling for LOOP node - show the current item with all properties
        if (nodeType === 'LOOP') {
          // Get variables from context to find the current item
          const variables = eventData?.variables || eventData?.data?.variables || {}
          const loopItemVar = variables._loopItemVariable || 'item'
          const loopIndexVar = variables._loopIndexVariable || 'index'
          
          // Build result with item and index
          const result: Record<string, any> = {}
          
          if (variables[loopItemVar]) {
            result[loopItemVar] = variables[loopItemVar]
          }
          if (variables[loopIndexVar] !== undefined) {
            result[loopIndexVar] = variables[loopIndexVar]
          }
          
          // Also include loop metadata if available
          if (eventData?.output) {
            const output = eventData.output
            // Include non-internal metadata
            Object.entries(output).forEach(([key, value]) => {
              if (!key.startsWith('_') && !result[key]) {
                result[key] = value
              }
            })
          }
          
          if (Object.keys(result).length > 0) {
            return result
          }
        }
        
        // For other nodes, show only the OUTPUT (clean, no internal vars)
        if (eventData?.output && typeof eventData.output === 'object' && Object.keys(eventData.output).length > 0) {
          return eventData.output
        }
      }
      return {}
    }

    // For the current node, show INPUT (output from previous node + loop variables if inside loop)
    const nodeExecutedLog = executionLogs.find(
      (log) => {
        const logType = log.eventType || log.type
        return logType === 'node.executed' && log.nodeId === node.id
      }
    )

    if (nodeExecutedLog?.data) {
      const eventData = nodeExecutedLog.data
      
      // Get variables from context (includes loop variables like item, index)
      const variables = eventData?.variables || eventData?.data?.variables || {}
      
      // Extract loop variables (item, index) if we're inside a loop
      const loopItemVar = variables._loopItemVariable || 'item'
      const loopIndexVar = variables._loopIndexVariable || 'index'
      const loopVariables: Record<string, any> = {}
      
      if (variables[loopItemVar]) {
        loopVariables[loopItemVar] = variables[loopItemVar]
      }
      if (variables[loopIndexVar] !== undefined) {
        loopVariables[loopIndexVar] = variables[loopIndexVar]
      }
      
      // Find previous node's output
      const currentNodeIndex = executionLogs.findIndex(
        (log) => {
          const logType = log.eventType || log.type
          return logType === 'node.executed' && log.nodeId === node.id
        }
      )

      let previousOutput: Record<string, any> = {}
      if (currentNodeIndex > 0) {
        const previousLogs = executionLogs.slice(0, currentNodeIndex).reverse()
        for (const log of previousLogs) {
          const logType = log.eventType || log.type
          if (logType === 'node.executed' && log.data?.output) {
            const output = log.data.output
            // Filter out internal variables
            previousOutput = Object.fromEntries(
              Object.entries(output).filter(([key]) => !key.startsWith('_'))
            )
            if (Object.keys(previousOutput).length > 0) {
              break
            }
          }
        }
      }
      
      // Combine: previous output + loop variables (loop variables take precedence)
      // This matches n8n behavior - shows previous output but loop vars are available
      return { ...previousOutput, ...loopVariables }
    }

    // Fallback: use context output (filtered)
    const context = executionData?.context || {}
    const contextOutput = context.output || {}
    const contextVariables = context.variables || {}
    
    // Extract loop variables if inside loop
    const loopItemVar = contextVariables._loopItemVariable || 'item'
    const loopIndexVar = contextVariables._loopIndexVariable || 'index'
    const loopVars: Record<string, any> = {}
    if (contextVariables[loopItemVar]) {
      loopVars[loopItemVar] = contextVariables[loopItemVar]
    }
    if (contextVariables[loopIndexVar] !== undefined) {
      loopVars[loopIndexVar] = contextVariables[loopIndexVar]
    }
    
    const cleanOutput = Object.fromEntries(
      Object.entries(contextOutput).filter(([key]) => !key.startsWith('_'))
    )
    
    return { ...cleanOutput, ...loopVars }
  }

  const getNodeOutputData = () => {
    const nodeData = getCurrentNodeData()

    if (nodeData?.output && Object.keys(nodeData.output).length > 0) {
      return nodeData.output
    }

    // Fallback para variables se output estiver vazio
    const variables = nodeData?.variables || {}
    return variables
  }

  const getExecutedNodes = () => {
    const nodeMap = new Map<string, any>()

    executionLogs.forEach((log) => {
      // Use eventType (from DB) or type (from WebSocket)
      const logType = log.eventType || log.type

      if (logType === 'node.executed' && log.nodeId) {
        nodeMap.set(log.nodeId, {
          id: log.nodeId,
          type: log.data?.nodeType || log.nodeType || 'UNKNOWN',
          timestamp: log.timestamp || log.createdAt,
        })
      }
    })

    let result = Array.from(nodeMap.values()).sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    // Fallback: se não houver nodes executados, adicione pelo menos o node atual
    if (result.length === 0 && node) {
      result = [{
        id: node.id,
        type: node.type,
        timestamp: new Date().toISOString()
      }]
    }

    return result
  }

  const getCurrentNode = () => {
    const executed = getExecutedNodes().find(n => n.id === selectedNodeId)
    if (executed) return executed

    // Fallback to the node prop if not in executed list yet
    return {
      id: node.id,
      type: node.type,
      timestamp: new Date().toISOString()
    }
  }

  const getNodeConfig = () => {
    // Use configNodeId (fixed) instead of selectedNodeId
    const workflowNode = workflowNodes.find(n => n.id === configNodeId)
    return workflowNode?.config || {}
  }

  // Memoize the config node to prevent re-renders
  // This ensures the PARAMETERS section always shows the same node
  const configNode = useMemo(() => {
    // Always use configNodeId (fixed) for the configuration, not selectedNodeId
    const foundNode = workflowNodes.find(n => n.id === configNodeId)

    // Fallback: if not found in workflowNodes, use the initial node prop
    if (!foundNode) {
      return node
    }

    return foundNode
  }, [workflowNodes, configNodeId, node]) // Dependencies: workflowNodes and configNodeId (NOT selectedNodeId!)

  const renderConfigVisual = () => {
    // Use configNode (fixed) instead of selectedNode
    const workflowNode = configNode
    if (!workflowNode) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
          <div className="text-4xl opacity-20">⚙️</div>
          <p className="text-xs">Node configuration not available</p>
        </div>
      )
    }

    const config = workflowNode.config || {}
    const nodeType = workflowNode.type

    // Render configuration UI similar to NodeConfigModal
    return (
      <div className="space-y-4">
        {/* EDIT_FIELDS Node */}
        {nodeType === 'EDIT_FIELDS' && (
          <>
            <div>
              <label className="block text-[11px] font-medium text-gray-300 mb-1.5">Modo</label>
              <div className="w-full px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded text-xs text-white">
                {config.mode === 'fields' ? 'Campos (Visual)' : 'JSON'}
              </div>
            </div>

            {config.mode === 'fields' && config.operations && (
              <div>
                <label className="block text-[11px] font-medium text-gray-300 mb-2">Campos</label>
                <div className="space-y-3">
                  {config.operations.map((op: any, index: number) => (
                    <div key={index} className="bg-[#0d0d0d] border border-gray-700 rounded p-3 space-y-2">
                      <div className="text-[10px] text-gray-400 font-semibold">Campo {index + 1}</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[10px] text-gray-400 mb-1">Nome do Campo</div>
                          <div className="px-2 py-1.5 bg-[#1a1a1a] border border-gray-800 rounded text-[11px] text-white font-mono">
                            {op.name}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-400 mb-1">Tipo</div>
                          <div className="px-2 py-1.5 bg-[#1a1a1a] border border-gray-800 rounded text-[11px] text-white">
                            {op.type || 'string'}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 mb-1">Valor</div>
                        <div className="px-2 py-1.5 bg-[#1a1a1a] border border-gray-800 rounded text-[11px] text-white font-mono">
                          {op.value}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {config.mode === 'json' && config.jsonBody && (
              <div>
                <label className="block text-[11px] font-medium text-gray-300 mb-1.5">JSON Body</label>
                <pre className="px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded text-[10px] text-white font-mono overflow-x-auto">
                  {config.jsonBody}
                </pre>
              </div>
            )}

            {config.keepExistingFields !== undefined && (
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded ${config.keepExistingFields ? 'bg-blue-500' : 'bg-gray-600'} flex items-center justify-center`}>
                  {config.keepExistingFields && <span className="text-white text-[10px]">✓</span>}
                </div>
                <span className="text-[11px] text-gray-300">Incluir outros campos do input</span>
              </div>
            )}
          </>
        )}

        {/* CODE Node */}
        {nodeType === 'CODE' && (
          <>
            <div>
              <label className="block text-[11px] font-medium text-gray-300 mb-1.5">Código JavaScript</label>
              <pre className="px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded text-[10px] text-white font-mono overflow-x-auto max-h-48">
                {config.code || '// No code'}
              </pre>
            </div>
            {config.outputVariable && (
              <div>
                <label className="block text-[11px] font-medium text-gray-300 mb-1.5">Output Variable</label>
                <div className="px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded text-xs text-white font-mono">
                  {config.outputVariable}
                </div>
              </div>
            )}
          </>
        )}

        {/* HTTP_REQUEST Node */}
        {nodeType === 'HTTP_REQUEST' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-300 mb-1.5">Method</label>
                <div className="px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded text-xs text-white font-semibold">
                  {config.method || 'GET'}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-300 mb-1.5">Save Response As</label>
                <div className="px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded text-xs text-white font-mono">
                  {config.saveResponseAs || 'httpResponse'}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-300 mb-1.5">URL</label>
              <div className="px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded text-[11px] text-white font-mono break-all">
                {config.url}
              </div>
            </div>
          </>
        )}

        {/* HTTP_SCRAPE Node */}
        {nodeType === 'HTTP_SCRAPE' && (
          <>
            <div>
              <label className="block text-[11px] font-medium text-gray-300 mb-1.5">URL</label>
              <div className="px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded text-[11px] text-white font-mono break-all">
                {config.url}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-300 mb-1.5">Wait For</label>
                <div className="px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded text-xs text-white font-semibold">
                  {config.waitFor || 'networkidle2'}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-300 mb-1.5">Save Response As</label>
                <div className="px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded text-xs text-white font-mono">
                  {config.saveResponseAs || 'scrapeResponse'}
                </div>
              </div>
            </div>
            {config.extractSelector && (
              <div>
                <label className="block text-[11px] font-medium text-gray-300 mb-1.5">Extract Selector</label>
                <div className="px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded text-[11px] text-white font-mono break-all">
                  {config.extractSelector}
                </div>
              </div>
            )}
            {config.screenshot && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">📸 Screenshot habilitado</span>
              </div>
            )}
          </>
        )}

        {/* SEND_MESSAGE Node */}
        {nodeType === 'SEND_MESSAGE' && config.message && (
          <div>
            <label className="block text-[11px] font-medium text-gray-300 mb-1.5">Mensagem</label>
            <div className="px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded text-xs text-white whitespace-pre-wrap">
              {config.message}
            </div>
          </div>
        )}

        {/* CONDITION Node */}
        {nodeType === 'CONDITION' && (
          <>
            <div>
              <label className="block text-[11px] font-medium text-gray-300 mb-1.5">Value 1</label>
              <div className="px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded text-xs text-white font-mono">
                {config.value1}
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-300 mb-1.5">Operator</label>
              <div className="px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded text-xs text-white">
                {config.operator}
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-300 mb-1.5">Value 2</label>
              <div className="px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded text-xs text-white font-mono">
                {config.value2}
              </div>
            </div>
          </>
        )}

        {/* Default fallback for other nodes */}
        {!['EDIT_FIELDS', 'CODE', 'HTTP_REQUEST', 'HTTP_SCRAPE', 'SEND_MESSAGE', 'CONDITION'].includes(nodeType || '') && (
          <>
            {Object.keys(config).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(config).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-[11px] font-medium text-gray-300 mb-1.5 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                    <div className="px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded text-xs text-white">
                      {typeof value === 'object' ? (
                        <pre className="text-[10px] font-mono overflow-x-auto">
                          {JSON.stringify(value, null, 2)}
                        </pre>
                      ) : typeof value === 'boolean' ? (
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded ${value ? 'bg-green-500' : 'bg-gray-600'}`} />
                          <span>{value ? 'Enabled' : 'Disabled'}</span>
                        </div>
                      ) : (
                        <span className="font-mono">{String(value)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500 gap-2">
                <div className="text-3xl opacity-20">📝</div>
                <p className="text-xs">No configuration parameters</p>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  const renderJsonView = (data: any, isInput = false) => {
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
          <div className="text-4xl opacity-20">📭</div>
          <p className="text-xs">
            {isInput
              ? 'No input data (this might be the first node)'
              : 'No output data available'}
          </p>
        </div>
      )
    }

    // Renderizar JSON com campos arrastáveis
    const renderDraggableJson = (obj: any, path = '', level = 0) => {
      return Object.entries(obj).map(([key, value]) => {
        const currentPath = path ? `${path}.${key}` : key
        const isObject = typeof value === 'object' && value !== null && !Array.isArray(value)
        const isArray = Array.isArray(value)

        return (
          <div key={currentPath} className="ml-4">
            <div className="flex items-center gap-2 group">
              <span
                draggable={true}
                onDragStart={(e) => {
                  // Se for um valor primitivo, usa o path completo
                  // Se for um objeto/array, também permite arrastar para pegar o path
                  e.dataTransfer.setData('text/plain', `{{${currentPath}}}`)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                className={`text-primary font-semibold cursor-move hover:bg-primary/20 px-1 rounded`}
                title={`Drag to use: {{${currentPath}}}`}
              >
                "{key}"
              </span>
              <span className="text-gray-500">:</span>
              {!isObject && !isArray && (
                <span
                  className="text-gray-300 cursor-move hover:bg-gray-700/30 px-1 rounded"
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', `{{${currentPath}}}`)
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                  title={`Drag to use: {{${currentPath}}}`}
                >
                  {typeof value === 'string' ? `"${value}"` : String(value)}
                </span>
              )}
              {(isObject || isArray) && (
                <span className="text-gray-500">{isArray ? '[' : '{'}</span>
              )}
            </div>
            {isObject && renderDraggableJson(value, currentPath, level + 1)}
            {isArray && value.length > 0 && (
              <div className="ml-4">
                {value.map((item: any, index: number) => (
                  <div key={index} className="mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{index}:</span>
                      {typeof item === 'object' ? (
                        <span className="text-gray-500">{'{'}</span>
                      ) : (
                        <span
                          className="text-gray-300 cursor-move hover:bg-gray-700/30 px-1 rounded"
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', `{{${currentPath}[${index}]}}`)
                            e.dataTransfer.effectAllowed = 'copy'
                          }}
                          title={`Drag to use: {{${currentPath}[${index}]}}`}
                        >
                          {typeof item === 'string' ? `"${item}"` : String(item)}
                        </span>
                      )}
                    </div>
                    {typeof item === 'object' && (
                      <>
                        {renderDraggableJson(item, `${currentPath}[${index}]`, level + 1)}
                        <span className="text-gray-500 ml-4">{'}'}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            {(isObject || isArray) && (
              <span className="text-gray-500 ml-4">{isArray ? ']' : '}'}</span>
            )}
          </div>
        )
      })
    }

    return (
      <div className="text-[11px] text-gray-300 font-mono leading-relaxed">
        <div className="text-gray-500">{'{'}</div>
        {renderDraggableJson(data)}
        <div className="text-gray-500">{'}'}</div>
      </div>
    )
  }

  const renderTableView = (data: any) => {
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          <p>No data available</p>
        </div>
      )
    }

    // If data is an array
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>Empty array</p>
          </div>
        )
      }

      const keys = Object.keys(data[0])
      return (
        <div className="overflow-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-[#0d0d0d] sticky top-0">
              <tr className="border-b border-gray-800">
                {keys.map((key) => (
                  <th key={key} className="px-3 py-1.5 text-left text-[10px] font-semibold text-gray-400 uppercase">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row: any, index: number) => (
                <tr key={index} className="border-b border-gray-800 hover:bg-[#151515]">
                  {keys.map((key) => (
                    <td key={key} className="px-3 py-1.5 text-gray-300">
                      {typeof row[key] === 'object' ? JSON.stringify(row[key]) : String(row[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    // If data is an object, show as key-value pairs
    return (
      <div className="overflow-auto">
        <table className="w-full text-[11px]">
          <thead className="bg-[#0d0d0d] sticky top-0">
            <tr className="border-b border-gray-800">
              <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-gray-400 uppercase w-1/3">
                Key
              </th>
              <th className="px-3 py-1.5 text-left text-[10px] font-semibold text-gray-400 uppercase">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data).map(([key, value]) => (
              <tr key={key} className="border-b border-gray-800 hover:bg-[#151515]">
                <td className="px-3 py-1.5 text-primary font-mono font-semibold">
                  {key}
                </td>
                <td className="px-3 py-1.5 text-gray-300 font-mono">
                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderSchemaView = (data: any) => {
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          <p>No data available</p>
        </div>
      )
    }

    const getType = (value: any): string => {
      if (value === null) return 'null'
      if (Array.isArray(value)) return 'array'
      return typeof value
    }

    const renderSchema = (obj: any, level = 0) => {
      return Object.entries(obj).map(([key, value]) => (
        <div key={key} className="border-b border-gray-800 last:border-0">
          <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#151515]">
            <span className="text-primary font-mono font-semibold text-[11px]" style={{ paddingLeft: `${level * 16}px` }}>
              {key}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded">
              {getType(value)}
            </span>
          </div>
          {typeof value === 'object' && value !== null && !Array.isArray(value) && (
            <div>{renderSchema(value, level + 1)}</div>
          )}
        </div>
      ))
    }

    return (
      <div className="overflow-auto">
        {renderSchema(data)}
      </div>
    )
  }

  const executedNodes = getExecutedNodes()
  const currentNode = getCurrentNode()
  const inputData = getNodeInputData() // Muda com selectedNodeId - mostra output do node selecionado

  // OUTPUT - muda com selectedNodeId para mostrar output do node selecionado
  const getOutputData = () => {
    const nodeExecutedLog = executionLogs.find(
      (log) => {
        const logType = log.eventType || log.type
        return logType === 'node.executed' && log.nodeId === selectedNodeId
      }
    )

    if (nodeExecutedLog?.data) {
      const eventData = nodeExecutedLog.data
      const nodeType = eventData?.nodeType || nodeExecutedLog.nodeType

      // Special handling for LOOP node - show the current item with all properties
      if (nodeType === 'LOOP') {
        // Get variables from context to find the current item
        const variables = eventData?.variables || eventData?.data?.variables || {}
        const loopItemVar = variables._loopItemVariable || 'item'
        const loopIndexVar = variables._loopIndexVariable || 'index'
        
        // Build result with item and index
        const result: Record<string, any> = {}
        
        if (variables[loopItemVar]) {
          result[loopItemVar] = variables[loopItemVar]
        }
        if (variables[loopIndexVar] !== undefined) {
          result[loopIndexVar] = variables[loopIndexVar]
        }
        
        // Also include loop metadata if available
        if (eventData?.output) {
          const output = eventData.output
          // Include non-internal metadata
          Object.entries(output).forEach(([key, value]) => {
            if (!key.startsWith('_') && !result[key]) {
              result[key] = value
            }
          })
        }
        
        if (Object.keys(result).length > 0) {
          return result
        }
      }

      // Get output from node execution
      let output = eventData?.output || eventData?.data?.output || {}

      // Filter out internal variables (starting with _) - like n8n does
      const cleanOutput = Object.fromEntries(
        Object.entries(output).filter(([key]) => !key.startsWith('_'))
      )

      if (Object.keys(cleanOutput).length > 0) {
        return cleanOutput
      }
    }

    return {}
  }

  const outputData = getOutputData() // Muda com selectedNodeId - mostra output do node selecionado

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 z-50"
        onClick={onClose}
      />

      {/* Modal - Full Screen Style */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-[#1a1a1a] w-full h-full max-w-[98vw] max-h-[95vh] flex flex-col rounded-lg overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-[#0d0d0d] border-b border-gray-800">
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition flex items-center gap-1.5 text-xs"
              >
                ← Back to canvas
              </button>
              <div className="w-px h-4 bg-gray-700" />
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-orange-600 rounded flex items-center justify-center text-white text-[10px] font-bold">
                  {(configNode?.type || 'NODE').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <span className="text-white font-medium text-xs">
                    {(configNode?.type || 'Node').replace(/_/g, ' ')}
                  </span>
                  <div className="text-[10px] text-gray-500 font-mono">
                    {configNodeId.substring(0, 22)}...
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition p-1"
            >
              <X size={18} />
            </button>
          </div>

          {/* Main Content - 3 COLUNAS */}
          <div className="flex flex-1 overflow-hidden">
            {/* LEFT COLUMN - INPUT */}
            <div className="w-[400px] flex flex-col bg-[#0d0d0d] border-r border-gray-800 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-[#0d0d0d] border-b border-gray-800">
                <span className="text-xs font-medium text-white">INPUT</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setViewModeInput('json')}
                    className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition ${viewModeInput === 'json' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => setViewModeInput('table')}
                    className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition ${viewModeInput === 'table' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                  >
                    Table
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-[#111111]">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-gray-400 text-xs">Loading...</div>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {/* INPUT DATA - Clean, like n8n */}
                    <div className="border-b border-gray-800">
                      <div className="px-3 py-2 bg-[#0d0d0d] border-b border-gray-800">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase">Input</span>
                      </div>
                      <div className="p-3">
                        {viewModeInput === 'json' && renderJsonView(inputData, true)}
                        {viewModeInput === 'table' && renderTableView(inputData)}
                        {viewModeInput === 'schema' && renderSchemaView(inputData)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Lista de nodes executados EMBAIXO do INPUT */}
              <div className="border-t border-gray-800 bg-[#0d0d0d]">
                <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase">Executed Nodes</span>
                  {selectedNodeId !== node.id && (
                    <button
                      onClick={() => setSelectedNodeId(node.id)}
                      className="text-[10px] text-primary hover:text-primary/80 font-medium transition"
                      title="Back to current node"
                    >
                      ← Current
                    </button>
                  )}
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {executedNodes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-gray-500 gap-2">
                      <p className="text-[10px] text-center">No executed nodes yet</p>
                    </div>
                  ) : (
                    executedNodes.map((executedNode, index) => (
                      <button
                        key={executedNode.id}
                        onClick={() => setSelectedNodeId(executedNode.id)}
                        className={`
                          w-full px-3 py-1.5 flex items-center gap-2 border-b border-gray-800 transition text-left
                          ${selectedNodeId === executedNode.id
                            ? 'bg-[#1a1a1a] border-l-2 border-l-primary'
                            : 'hover:bg-[#151515]'
                          }
                        `}
                      >
                        <div className="flex items-center justify-center w-4 h-4 rounded-full bg-green-500/20 text-green-400 text-[9px] font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-white font-medium truncate">
                            {executedNode.type.replace(/_/g, ' ')}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* CENTER COLUMN - PARAMETERS */}
            <div className="flex-1 flex flex-col bg-[#111111] border-r border-gray-800 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-[#0d0d0d] border-b border-gray-800">
                <span className="text-xs font-medium text-white">PARAMETERS</span>
                <span className="text-[10px] text-gray-500">
                  {configNode?.type?.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex-1 overflow-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-gray-400 text-xs">Loading...</div>
                  </div>
                ) : configNode ? (
                  <div className="h-full" key={configNodeId}>
                    <NodeConfigModal
                      node={configNode}
                      tenantId={tenantId}
                      onClose={() => { }}
                      onSave={async (nodeId, config) => {
                        if (onSave) {
                          await onSave(nodeId, config)
                          loadWorkflowNodes()
                        }
                      }}
                      embedded={true}
                      inputData={inputData}
                      executionData={executionData}
                      executionLogs={executionLogs}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
                    <div className="text-4xl opacity-20">⚙️</div>
                    <p className="text-xs">Node configuration not available</p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN - OUTPUT */}
            <div className="w-[400px] flex flex-col bg-[#0d0d0d] overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-[#0d0d0d] border-b border-gray-800">
                <span className="text-xs font-medium text-white">OUTPUT</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setViewModeOutput('json')}
                    className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition ${viewModeOutput === 'json' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => setViewModeOutput('table')}
                    className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition ${viewModeOutput === 'table' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                  >
                    Table
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-3 bg-[#111111]">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-gray-400 text-xs">Loading...</div>
                  </div>
                ) : (
                  <>
                    {viewModeOutput === 'json' && renderJsonView(outputData, false)}
                    {viewModeOutput === 'table' && renderTableView(outputData)}
                    {viewModeOutput === 'schema' && renderSchemaView(outputData)}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

    </>
  )
}
