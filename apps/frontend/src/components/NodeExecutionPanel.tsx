'use client'

import { useState, useEffect } from 'react'
import { WorkflowNode } from '@n9n/shared'

interface NodeExecutionPanelProps {
  node: WorkflowNode
  executionId: string | null
  tenantId: string
  onClose: () => void
}

export default function NodeExecutionPanel({
  node,
  executionId,
  tenantId,
  onClose,
}: NodeExecutionPanelProps) {
  const [activeTab, setActiveTab] = useState<'input' | 'output' | 'config'>('output')
  const [executionData, setExecutionData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (executionId) {
      loadExecutionData()
    }
  }, [executionId, node.id])

  const loadExecutionData = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `http://localhost:3001/api/executions/${executionId}?tenantId=${tenantId}`
      )
      if (response.ok) {
        const data = await response.json()
        setExecutionData(data)
      }
    } catch (error) {
      console.error('Error loading execution data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getNodeInputData = () => {
    if (!executionData?.context) return null
    
    // For the first node after trigger, show trigger data
    if (node.type === 'SEND_MESSAGE' && executionData.context.input) {
      return executionData.context.input
    }
    
    return executionData.context.input || {}
  }

  const getNodeOutputData = () => {
    if (!executionData?.context) return null
    return executionData.context.output || {}
  }

  const getNodeVariables = () => {
    if (!executionData?.context) return null
    return executionData.context.variables || {}
  }

  const renderJsonData = (data: any, label: string) => {
    if (!data || Object.keys(data).length === 0) {
      return (
        <div className="text-center py-8 text-gray-400">
          <p className="mb-2">No {label} data</p>
          <p className="text-sm">
            {executionId ? 'This node hasn\'t been executed yet' : 'Execute the workflow to see data'}
          </p>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="bg-background border border-border rounded p-3">
            <div className="flex items-start justify-between mb-2">
              <span className="text-sm font-semibold text-primary">{key}</span>
              <span className="text-xs text-gray-500">
                {typeof value}
              </span>
            </div>
            <div className="bg-surface border border-border rounded p-2">
              <pre className="text-xs overflow-x-auto">
                {typeof value === 'object' 
                  ? JSON.stringify(value, null, 2)
                  : String(value)}
              </pre>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderConfigData = () => {
    if (!node.config || Object.keys(node.config).length === 0) {
      return (
        <div className="text-center py-8 text-gray-400">
          <p>No configuration</p>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {Object.entries(node.config).map(([key, value]) => (
          <div key={key} className="bg-background border border-border rounded p-3">
            <div className="flex items-start justify-between mb-2">
              <span className="text-sm font-semibold text-primary">{key}</span>
              <span className="text-xs text-gray-500">
                {typeof value}
              </span>
            </div>
            <div className="bg-surface border border-border rounded p-2">
              <pre className="text-xs overflow-x-auto">
                {typeof value === 'object' 
                  ? JSON.stringify(value, null, 2)
                  : String(value)}
              </pre>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[500px] bg-surface border-l border-border shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="text-lg font-bold">{node.type.replace(/_/g, ' ')}</h3>
            <p className="text-xs text-gray-400 font-mono">{node.id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition text-xl"
          >
            ✕
          </button>
        </div>

        {executionId && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-primary"></span>
            <span>Execution: {executionId.substring(0, 8)}...</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('output')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition ${
            activeTab === 'output'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Output
        </button>
        <button
          onClick={() => setActiveTab('input')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition ${
            activeTab === 'input'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Input
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition ${
            activeTab === 'config'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Config
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">Loading...</div>
          </div>
        ) : (
          <>
            {activeTab === 'output' && renderJsonData(getNodeOutputData(), 'output')}
            {activeTab === 'input' && renderJsonData(getNodeInputData(), 'input')}
            {activeTab === 'config' && renderConfigData()}
          </>
        )}

        {/* Variables Section (always visible at bottom) */}
        {executionData?.context?.variables && Object.keys(executionData.context.variables).length > 0 && (
          <div className="mt-6 pt-6 border-t border-border">
            <h4 className="text-sm font-semibold mb-3 text-gray-300">Variables</h4>
            <div className="space-y-2">
              {Object.entries(getNodeVariables()).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between bg-background border border-border rounded px-3 py-2">
                  <span className="text-sm font-mono text-primary">{key}</span>
                  <span className="text-sm text-gray-400 truncate ml-2 max-w-[200px]">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {!executionId && (
        <div className="p-4 border-t border-border bg-yellow-500/10">
          <p className="text-sm text-yellow-500 flex items-center gap-2">
            <span>⚠️</span>
            <span>Execute the workflow to see runtime data</span>
          </p>
        </div>
      )}
    </div>
  )
}


