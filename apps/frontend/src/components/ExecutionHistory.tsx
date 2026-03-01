'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'

interface ExecutionHistoryProps {
  workflowId: string
  tenantId: string // Kept for backward compatibility but not used in API calls
  onClose: () => void
  onSelectExecution?: (executionId: string, logs: any[]) => void
}

export default function ExecutionHistory({
  workflowId,
  tenantId: _tenantId, // Not used anymore, kept for compatibility
  onClose,
  onSelectExecution,
}: ExecutionHistoryProps) {
  const [executions, setExecutions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadExecutions()
  }, [workflowId])

  const loadExecutions = async () => {
    try {
      setLoading(true)
      const data = await apiClient.getWorkflowExecutions(workflowId)
      setExecutions(data)
    } catch (error) {
      console.error('Error loading executions:', error)
      setExecutions([])
    } finally {
      setLoading(false)
    }
  }

  const handleSelectExecution = async (execution: any) => {
    if (onSelectExecution) {
      try {
        const executionLogs = await apiClient.getExecutionLogs(execution.id)
        onSelectExecution(execution.id, executionLogs)
        onClose()
      } catch (error) {
        console.error('Error loading execution logs:', error)
      }
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-500'
      case 'RUNNING':
        return 'text-blue-500'
      case 'WAITING':
        return 'text-yellow-500'
      case 'ERROR':
        return 'text-red-500'
      case 'EXPIRED':
        return 'text-orange-500'
      default:
        return 'text-gray-400'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-lg w-full max-w-2xl h-[70vh] mx-4 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h2 className="text-xl font-bold">Histórico de Execuções</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Executions List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              Carregando...
            </div>
          ) : executions.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <div className="text-4xl mb-4">📋</div>
              <p>Nenhuma execução ainda</p>
              <p className="text-sm mt-2">Execute o workflow para ver o histórico</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {executions.map((execution) => (
                <button
                  key={execution.id}
                  onClick={() => handleSelectExecution(execution)}
                  className="w-full p-4 text-left hover:bg-background transition group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold ${getStatusColor(execution.status)}`}>
                      {execution.status === 'COMPLETED' && '✓ '}
                      {execution.status === 'ERROR' && '✗ '}
                      {execution.status === 'RUNNING' && '⟳ '}
                      {execution.status === 'WAITING' && '⏸ '}
                      {execution.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      {execution.createdAt
                        ? new Date(execution.createdAt).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                        : 'N/A'}
                    </span>
                  </div>

                  <div className="text-xs text-gray-400 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Contato:</span>
                      <span className="font-mono">
                        {(execution.contactPhone || execution.contactId || '')?.split('@')[0] || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Sessão:</span>
                      <span className="font-mono">{execution.sessionId?.substring(0, 8) || 'N/A'}...</span>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-gray-500 group-hover:text-primary transition">
                    Clique para visualizar no fluxo →
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
