'use client'

import { useState, useEffect } from 'react'
import { WorkflowNode, WorkflowNodeType } from '@n9n/shared'
import { apiClient } from '@/lib/api-client'

interface NodeConfigModalProps {
  node: WorkflowNode | null
  tenantId: string
  onClose: () => void
  onSave: (nodeId: string, config: any) => void
}

export default function NodeConfigModal({
  node,
  tenantId,
  onClose,
  onSave,
}: NodeConfigModalProps) {
  const [activeTab, setActiveTab] = useState<'parameters' | 'settings'>('parameters')
  const [config, setConfig] = useState<any>({})
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (node) {
      setConfig(node.config || {})
      
      // Load sessions if it's a trigger node
      if (node.type === WorkflowNodeType.TRIGGER_MESSAGE) {
        loadSessions()
      }
    }
  }, [node])

  const loadSessions = async () => {
    try {
      setLoading(true)
      const data = await apiClient.getWhatsappSessions(tenantId)
      setSessions(data.filter((s: any) => s.status === 'CONNECTED'))
    } catch (error) {
      console.error('Error loading sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    if (node) {
      onSave(node.id, config)
      onClose()
    }
  }

  if (!node) return null

  const renderConfigFields = () => {
    switch (node.type) {
      case 'TRIGGER_MESSAGE':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                WhatsApp Session
              </label>
              <select
                value={config.sessionId || ''}
                onChange={(e) => setConfig({ ...config, sessionId: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                disabled={loading}
              >
                <option value="">All Sessions</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name} ({session.phoneNumber})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1.5">
                Leave empty to listen on all sessions
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Message Pattern
              </label>
              <input
                type="text"
                value={config.pattern || ''}
                onChange={(e) => setConfig({ ...config, pattern: e.target.value })}
                placeholder="e.g., hello, start, menu"
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                The message that triggers this workflow
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Match Type
              </label>
              <select
                value={config.matchType || 'exact'}
                onChange={(e) => setConfig({ ...config, matchType: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
              >
                <option value="exact">Exact Match</option>
                <option value="contains">Contains</option>
                <option value="startsWith">Starts With</option>
                <option value="regex">Regex</option>
              </select>
            </div>
          </div>
        )

      case 'SEND_MESSAGE':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Message
              </label>
              <textarea
                value={config.message || ''}
                onChange={(e) => setConfig({ ...config, message: e.target.value })}
                placeholder="Type your message here..."
                rows={8}
                className="w-full px-4 py-3 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary resize-none text-white placeholder-gray-500 font-mono text-sm"
              />
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-gray-500">
                  Use <code className="px-1.5 py-0.5 bg-gray-800 rounded text-primary">{`{{variables.name}}`}</code> to insert variables
                </span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Delay (ms)
              </label>
              <input
                type="number"
                value={config.delay || 0}
                onChange={(e) => setConfig({ ...config, delay: parseInt(e.target.value) || 0 })}
                placeholder="0"
                min="0"
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Optional delay before sending (in milliseconds)
              </p>
            </div>
          </div>
        )

      case 'WAIT_REPLY':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Save Reply As
              </label>
              <input
                type="text"
                value={config.saveAs || ''}
                onChange={(e) => setConfig({ ...config, saveAs: e.target.value })}
                placeholder="e.g., userName, email, choice"
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Variable name to store the user's reply
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Timeout (seconds)
              </label>
              <input
                type="number"
                value={config.timeoutSeconds || 300}
                onChange={(e) => setConfig({ ...config, timeoutSeconds: parseInt(e.target.value) || 300 })}
                placeholder="300"
                min="10"
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                How long to wait for a reply (default: 300s)
              </p>
            </div>
          </div>
        )

      case 'CONDITION':
        // Parse existing expression or use defaults
        const parseExpression = (expr: string) => {
          if (!expr) return { value1: '', operator: '==', value2: '' }
          
          // Try to parse expressions like "variables.opcao == 2"
          const operators = ['===', '!==', '==', '!=', '>=', '<=', '>', '<', '.includes(', '.startsWith(', '.endsWith(']
          for (const op of operators) {
            if (expr.includes(op)) {
              const parts = expr.split(op)
              if (parts.length === 2) {
                return {
                  value1: parts[0].trim(),
                  operator: op,
                  value2: parts[1].trim().replace(/[()'"]/g, '')
                }
              }
            }
          }
          
          return { value1: expr, operator: '==', value2: '' }
        }

        const conditionParts = parseExpression(config.expression || '')
        
        const updateCondition = (field: string, value: string) => {
          const parts = { ...conditionParts, [field]: value }
          let expression = ''
          
          if (parts.operator.includes('(')) {
            // For methods like includes, startsWith, endsWith
            expression = `${parts.value1}${parts.operator}"${parts.value2}")`
          } else {
            expression = `${parts.value1} ${parts.operator} ${parts.value2}`
          }
          
          setConfig({ ...config, expression })
        }

        return (
          <div className="space-y-6">
            <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-200 mb-4">Conditions</h3>
              
              <div className="space-y-3">
                {/* Value 1 */}
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-400">
                    Value 1
                  </label>
                  <input
                    type="text"
                    value={conditionParts.value1}
                    onChange={(e) => updateCondition('value1', e.target.value)}
                    placeholder="variables.opcao"
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono"
                  />
                </div>

                {/* Operator */}
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-400">
                    Operator
                  </label>
                  <select
                    value={conditionParts.operator}
                    onChange={(e) => updateCondition('operator', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white"
                  >
                    <optgroup label="Comparison">
                      <option value="==">is equal to (==)</option>
                      <option value="===">is equal to (===)</option>
                      <option value="!=">is not equal to (!=)</option>
                      <option value="!==">is not equal to (!==)</option>
                      <option value=">">is greater than (&gt;)</option>
                      <option value=">=">is greater or equal (&gt;=)</option>
                      <option value="<">is less than (&lt;)</option>
                      <option value="<=">is less or equal (&lt;=)</option>
                    </optgroup>
                    <optgroup label="String">
                      <option value=".includes(">contains (.includes)</option>
                      <option value=".startsWith(">starts with (.startsWith)</option>
                      <option value=".endsWith(">ends with (.endsWith)</option>
                    </optgroup>
                  </select>
                </div>

                {/* Value 2 */}
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-400">
                    Value 2
                  </label>
                  <input
                    type="text"
                    value={conditionParts.value2}
                    onChange={(e) => updateCondition('value2', e.target.value)}
                    placeholder="2"
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono"
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="mt-4 pt-4 border-t border-gray-700">
                <label className="block text-xs font-medium mb-1.5 text-gray-400">
                  Expression Preview
                </label>
                <div className="px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded text-sm text-primary font-mono">
                  {config.expression || 'No expression set'}
                </div>
              </div>
            </div>

            {/* Help Text */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-xs text-blue-300 leading-relaxed">
                💡 <strong>Tip:</strong> Use <code className="bg-blue-500/20 px-1 py-0.5 rounded">variables.name</code> to access saved variables, 
                or <code className="bg-blue-500/20 px-1 py-0.5 rounded">globals.contactId</code> for global values.
              </p>
            </div>
          </div>
        )

      case 'SWITCH':
        const switchRules = config.rules || []
        
        const addRule = () => {
          const newRule = {
            id: `rule-${Date.now()}`,
            value1: '',
            operator: '==',
            value2: '',
            outputKey: String(switchRules.length),
          }
          setConfig({ ...config, rules: [...switchRules, newRule] })
        }
        
        const updateRule = (index: number, field: string, value: string) => {
          const updated = [...switchRules]
          updated[index] = { ...updated[index], [field]: value }
          setConfig({ ...config, rules: updated })
        }
        
        const removeRule = (index: number) => {
          const updated = switchRules.filter((_: any, i: number) => i !== index)
          setConfig({ ...config, rules: updated })
        }

        return (
          <div className="space-y-6">
            <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-200">Regras de Roteamento</h3>
                <button
                  onClick={addRule}
                  className="px-3 py-1.5 bg-primary text-black rounded text-xs font-semibold hover:bg-primary/80 transition"
                >
                  + Adicionar Regra
                </button>
              </div>
              
              <div className="space-y-4">
                {switchRules.map((rule: any, index: number) => (
                  <div key={rule.id} className="bg-[#0a0a0a] border border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-indigo-400">Saída {index}</span>
                      <button
                        onClick={() => removeRule(index)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        ✕ Remover
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      {/* Value 1 */}
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-gray-400">
                          Valor 1
                        </label>
                        <input
                          type="text"
                          value={rule.value1}
                          onChange={(e) => updateRule(index, 'value1', e.target.value)}
                          placeholder="variables.opcao"
                          className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono"
                        />
                      </div>

                      {/* Operator */}
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-gray-400">
                          Operador
                        </label>
                        <select
                          value={rule.operator}
                          onChange={(e) => updateRule(index, 'operator', e.target.value)}
                          className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white"
                        >
                          <optgroup label="Comparação">
                            <option value="==">é igual a (==)</option>
                            <option value="===">é igual a (===)</option>
                            <option value="!=">não é igual a (!=)</option>
                            <option value="!==">não é igual a (!==)</option>
                            <option value=">">é maior que (&gt;)</option>
                            <option value=">=">é maior ou igual (&gt;=)</option>
                            <option value="<">é menor que (&lt;)</option>
                            <option value="<=">é menor ou igual (&lt;=)</option>
                          </optgroup>
                          <optgroup label="Texto">
                            <option value=".includes(">contém (.includes)</option>
                            <option value=".startsWith(">começa com (.startsWith)</option>
                            <option value=".endsWith(">termina com (.endsWith)</option>
                          </optgroup>
                        </select>
                      </div>

                      {/* Value 2 */}
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-gray-400">
                          Valor 2
                        </label>
                        <input
                          type="text"
                          value={rule.value2}
                          onChange={(e) => updateRule(index, 'value2', e.target.value)}
                          placeholder="1"
                          className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Default Output (always present) */}
                <div className="bg-[#0a0a0a] border-2 border-yellow-600/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-yellow-400">🔸 Saída Padrão (Default)</span>
                    <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded">SEMPRE ATIVO</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Esta saída será usada quando <strong>nenhuma regra</strong> corresponder. É obrigatória e sempre estará disponível.
                  </p>
                </div>
              </div>
            </div>

            {/* Help Text */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-xs text-blue-300 leading-relaxed">
                💡 <strong>Dica:</strong> As regras são avaliadas em ordem. A primeira regra que corresponder determina o caminho de saída. 
                Se nenhuma regra corresponder, a <strong>Saída Padrão</strong> será usada. 
                Use <code className="bg-blue-500/20 px-1 py-0.5 rounded">variables.nome</code> para acessar variáveis salvas.
              </p>
            </div>
          </div>
        )

      default:
        return (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm">
              Nenhuma configuração disponível para este tipo de nó.
            </p>
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-green-400 rounded-lg flex items-center justify-center text-xl">
              {node.type === WorkflowNodeType.TRIGGER_MESSAGE ? '📨' :
               node.type === WorkflowNodeType.SEND_MESSAGE ? '💬' :
               node.type === WorkflowNodeType.WAIT_REPLY ? '⏳' :
               node.type === WorkflowNodeType.CONDITION ? '🔀' : '⚙️'}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {node.type ? String(node.type).replace(/_/g, ' ') : 'Node'}
              </h2>
              <p className="text-xs text-gray-400">Node ID: {node.id.substring(0, 8)}...</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 bg-[#151515]">
          <button
            onClick={() => setActiveTab('parameters')}
            className={`px-6 py-3 text-sm font-medium transition relative ${
              activeTab === 'parameters'
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Parâmetros
            {activeTab === 'parameters' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-6 py-3 text-sm font-medium transition relative ${
              activeTab === 'settings'
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Configurações
            {activeTab === 'settings' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'parameters' ? renderConfigFields() : (
            <div className="space-y-4">
              <div className="text-sm text-gray-400">
                <p>Additional settings for this node.</p>
              </div>
              <div className="bg-[#151515] border border-gray-700 rounded p-4">
                <label className="flex items-center justify-between">
                  <span className="text-sm font-medium">Always Output Data</span>
                  <input type="checkbox" className="w-4 h-4" />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 bg-[#151515]">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-gray-300 hover:text-white transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-8 py-2 bg-primary text-black rounded font-semibold hover:bg-primary/90 transition shadow-lg"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

