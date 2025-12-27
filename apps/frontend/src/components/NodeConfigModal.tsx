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
  const [availableLabels, setAvailableLabels] = useState<any[]>([])
  const [loadingLabels, setLoadingLabels] = useState(false)

  useEffect(() => {
    if (node) {
      setConfig(node.config || {})
      
      // Load sessions if it's a trigger node or manage labels node
      if (node.type === WorkflowNodeType.TRIGGER_MESSAGE || node.type === 'MANAGE_LABELS') {
        loadSessions()
      }
    }
  }, [node])

  useEffect(() => {
    console.log('[LABELS EFFECT] node?.type:', node?.type, 'config.action:', config.action, 'sessions.length:', sessions.length)
    // Load labels when it's a MANAGE_LABELS node and action is not 'list'
    if (node?.type === 'MANAGE_LABELS' && config.action !== 'list' && sessions.length > 0) {
      console.log('[LABELS EFFECT] Calling loadLabels()')
      loadLabels()
    }
  }, [node?.type, config.action, sessions])

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

  const loadLabels = async () => {
    console.log('[LABELS] loadLabels called, sessions:', sessions)
    if (!sessions || sessions.length === 0) {
      console.log('[LABELS] No sessions available')
      return
    }
    
    setLoadingLabels(true)
    try {
      // Use the first connected session to get labels
      const connectedSession = sessions.find((s: any) => s.status === 'CONNECTED')
      console.log('[LABELS] Connected session:', connectedSession)
      if (connectedSession) {
        console.log('[LABELS] Loading labels for session:', connectedSession.id)
        const labels = await apiClient.getSessionLabels(connectedSession.id)
        console.log('[LABELS] Received labels:', labels)
        console.log('[LABELS] Setting availableLabels to:', labels)
        setAvailableLabels(labels || [])
      } else {
        console.log('[LABELS] No connected session found')
      }
    } catch (error) {
      console.error('[LABELS] Error loading labels:', error)
    } finally {
      console.log('[LABELS] Setting loadingLabels to false')
      setLoadingLabels(false)
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

            <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">Filtro de Mensagens</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-200">
                    Padrão da Mensagem
                  </label>
                  <input
                    type="text"
                    value={config.pattern || ''}
                    onChange={(e) => setConfig({ ...config, pattern: e.target.value })}
                    placeholder="Deixe vazio para aceitar todas as mensagens"
                    className="w-full px-4 py-2.5 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500 font-mono"
                  />
                  <p className="text-xs text-gray-400 mt-1.5">
                    {config.pattern && config.pattern.trim() !== '' 
                      ? 'A mensagem que dispara este workflow' 
                      : '⚠️ Sem filtro: Este trigger aceitará TODAS as mensagens recebidas'}
                  </p>
                </div>

                {config.pattern && config.pattern.trim() !== '' && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-200">
                      Tipo de Correspondência
                    </label>
                    <select
                      value={config.matchType || 'exact'}
                      onChange={(e) => setConfig({ ...config, matchType: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                    >
                      <option value="exact">Correspondência Exata</option>
                      <option value="contains">Contém</option>
                      <option value="regex">Expressão Regular (Regex)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Help Text */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-xs text-blue-300 leading-relaxed">
                💡 <strong>Dica:</strong> Se você deixar o padrão vazio, este workflow será acionado para <strong>todas as mensagens</strong> recebidas. 
                Isso é útil para criar um chatbot que responde a qualquer mensagem. 
                Se você definir um padrão, apenas mensagens que correspondam serão processadas.
              </p>
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

      case 'SEND_BUTTONS':
        const buttons = config.buttons || []
        
        const addButton = () => {
          setConfig({ ...config, buttons: [...buttons, { id: `btn-${Date.now()}`, text: '' }] })
        }
        
        const updateButton = (index: number, field: string, value: string) => {
          const updated = [...buttons]
          updated[index] = { ...updated[index], [field]: value }
          setConfig({ ...config, buttons: updated })
        }
        
        const removeButton = (index: number) => {
          const updated = buttons.filter((_: any, i: number) => i !== index)
          setConfig({ ...config, buttons: updated })
        }

        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Mensagem
              </label>
              <textarea
                value={config.message || ''}
                onChange={(e) => setConfig({ ...config, message: e.target.value })}
                placeholder="Digite sua mensagem aqui..."
                rows={4}
                className="w-full px-4 py-3 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary resize-none text-white placeholder-gray-500 font-mono text-sm"
              />
            </div>

            <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-200">Botões</h3>
                <button
                  onClick={addButton}
                  className="px-3 py-1.5 bg-primary text-black rounded text-xs font-semibold hover:bg-primary/80 transition"
                  disabled={buttons.length >= 3}
                >
                  + Adicionar Botão
                </button>
              </div>
              
              {buttons.length >= 3 && (
                <p className="text-xs text-yellow-400 mb-3">⚠️ Máximo de 3 botões permitido pelo WhatsApp</p>
              )}
              
              <div className="space-y-2">
                {buttons.map((button: any, index: number) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={button.text}
                      onChange={(e) => updateButton(index, 'text', e.target.value)}
                      placeholder={`Botão ${index + 1}`}
                      maxLength={20}
                      className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500"
                    />
                    <button
                      onClick={() => removeButton(index)}
                      className="px-3 py-2 text-red-400 hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {buttons.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-4">Nenhum botão adicionado</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Rodapé (opcional)
              </label>
              <input
                type="text"
                value={config.footer || ''}
                onChange={(e) => setConfig({ ...config, footer: e.target.value })}
                placeholder="Texto do rodapé"
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500"
              />
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-xs text-blue-300 leading-relaxed">
                💡 <strong>Dica:</strong> Os botões aparecem abaixo da mensagem. Quando o usuário clicar em um botão, 
                a resposta será o ID do botão (btn-xxx). Use um node WAIT_REPLY após este para capturar a resposta.
              </p>
            </div>
          </div>
        )

      case 'SEND_LIST':
        const listSections = config.sections || []
        
        const addSection = () => {
          setConfig({ ...config, sections: [...listSections, { title: '', rows: [] }] })
        }
        
        const updateSection = (index: number, field: string, value: string) => {
          const updated = [...listSections]
          updated[index] = { ...updated[index], [field]: value }
          setConfig({ ...config, sections: updated })
        }
        
        const removeSection = (index: number) => {
          const updated = listSections.filter((_: any, i: number) => i !== index)
          setConfig({ ...config, sections: updated })
        }
        
        const addRow = (sectionIndex: number) => {
          const updated = [...listSections]
          updated[sectionIndex].rows.push({ id: `row-${Date.now()}`, title: '', description: '' })
          setConfig({ ...config, sections: updated })
        }
        
        const updateRow = (sectionIndex: number, rowIndex: number, field: string, value: string) => {
          const updated = [...listSections]
          updated[sectionIndex].rows[rowIndex] = { ...updated[sectionIndex].rows[rowIndex], [field]: value }
          setConfig({ ...config, sections: updated })
        }
        
        const removeRow = (sectionIndex: number, rowIndex: number) => {
          const updated = [...listSections]
          updated[sectionIndex].rows = updated[sectionIndex].rows.filter((_: any, i: number) => i !== rowIndex)
          setConfig({ ...config, sections: updated })
        }

        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Mensagem
              </label>
              <textarea
                value={config.message || ''}
                onChange={(e) => setConfig({ ...config, message: e.target.value })}
                placeholder="Digite sua mensagem aqui..."
                rows={4}
                className="w-full px-4 py-3 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary resize-none text-white placeholder-gray-500 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Texto do Botão
              </label>
              <input
                type="text"
                value={config.buttonText || ''}
                onChange={(e) => setConfig({ ...config, buttonText: e.target.value })}
                placeholder="Ver opções"
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Texto que aparece no botão que abre a lista
              </p>
            </div>

            <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-200">Seções da Lista</h3>
                <button
                  onClick={addSection}
                  className="px-3 py-1.5 bg-primary text-black rounded text-xs font-semibold hover:bg-primary/80 transition"
                >
                  + Adicionar Seção
                </button>
              </div>
              
              <div className="space-y-4">
                {listSections.map((section: any, sectionIndex: number) => (
                  <div key={sectionIndex} className="bg-[#0a0a0a] border border-gray-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => updateSection(sectionIndex, 'title', e.target.value)}
                        placeholder={`Seção ${sectionIndex + 1}`}
                        className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-semibold"
                      />
                      <button
                        onClick={() => removeSection(sectionIndex)}
                        className="px-2 py-2 text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                    
                    <div className="space-y-2 mb-2">
                      {section.rows.map((row: any, rowIndex: number) => (
                        <div key={rowIndex} className="flex gap-2">
                          <div className="flex-1 space-y-1">
                            <input
                              type="text"
                              value={row.title}
                              onChange={(e) => updateRow(sectionIndex, rowIndex, 'title', e.target.value)}
                              placeholder="Título da opção"
                              maxLength={24}
                              className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500"
                            />
                            <input
                              type="text"
                              value={row.description || ''}
                              onChange={(e) => updateRow(sectionIndex, rowIndex, 'description', e.target.value)}
                              placeholder="Descrição (opcional)"
                              maxLength={72}
                              className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-xs text-gray-400 placeholder-gray-600"
                            />
                          </div>
                          <button
                            onClick={() => removeRow(sectionIndex, rowIndex)}
                            className="px-2 py-2 text-red-400 hover:text-red-300"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <button
                      onClick={() => addRow(sectionIndex)}
                      className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded text-xs text-gray-400 hover:text-gray-300 hover:border-gray-600 transition"
                      disabled={section.rows.length >= 10}
                    >
                      + Adicionar Opção {section.rows.length >= 10 && '(Máximo atingido)'}
                    </button>
                  </div>
                ))}
                {listSections.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-4">Nenhuma seção adicionada</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Rodapé (opcional)
              </label>
              <input
                type="text"
                value={config.footer || ''}
                onChange={(e) => setConfig({ ...config, footer: e.target.value })}
                placeholder="Texto do rodapé"
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500"
              />
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-xs text-blue-300 leading-relaxed">
                💡 <strong>Dica:</strong> As listas são ótimas para menus com muitas opções. Quando o usuário selecionar uma opção, 
                a resposta será o ID da linha (row-xxx). Use um node WAIT_REPLY após este para capturar a resposta.
              </p>
            </div>
          </div>
        )

      case 'MANAGE_LABELS':
        const selectedLabelIds = config.labelIds || []
        
        const toggleLabel = (labelId: string) => {
          const updated = selectedLabelIds.includes(labelId)
            ? selectedLabelIds.filter((id: string) => id !== labelId)
            : [...selectedLabelIds, labelId]
          setConfig({ ...config, labelIds: updated })
        }

        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Ação
              </label>
              <select
                value={config.action || 'add'}
                onChange={(e) => setConfig({ ...config, action: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
              >
                <option value="add">Adicionar Etiquetas</option>
                <option value="remove">Remover Etiquetas</option>
                <option value="list">Listar Etiquetas Atuais</option>
              </select>
            </div>

            {config.action !== 'list' && (
              <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-200">
                    Etiquetas Disponíveis
                  </h3>
                  <button
                    onClick={() => {
                      console.log('[LABELS] Reload button clicked!')
                      loadLabels()
                    }}
                    disabled={loadingLabels}
                    className="px-3 py-1.5 bg-primary/20 text-primary rounded text-xs font-semibold hover:bg-primary/30 transition disabled:opacity-50"
                  >
                    {loadingLabels ? 'Carregando...' : '🔄 Recarregar'}
                  </button>
                </div>
                
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {loadingLabels && (
                    <p className="text-xs text-gray-500 text-center py-4">Carregando etiquetas...</p>
                  )}
                  
                  {!loadingLabels && availableLabels.length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-4">
                      Nenhuma etiqueta encontrada. Certifique-se de que há uma sessão conectada.
                    </p>
                  )}
                  
                  {!loadingLabels && availableLabels.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {availableLabels.map((label: any) => {
                        const isSelected = selectedLabelIds.includes(label.id)
                        const colors = [
                          { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-300' },
                          { bg: 'bg-green-500/20', border: 'border-green-500', text: 'text-green-300' },
                          { bg: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-300' },
                          { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-300' },
                          { bg: 'bg-pink-500/20', border: 'border-pink-500', text: 'text-pink-300' },
                          { bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-300' },
                          { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-300' },
                          { bg: 'bg-indigo-500/20', border: 'border-indigo-500', text: 'text-indigo-300' },
                        ]
                        const colorIndex = parseInt(label.id) % colors.length
                        const color = colors[colorIndex]
                        
                        return (
                          <button
                            key={label.id}
                            onClick={() => toggleLabel(label.id)}
                            className={`
                              px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all
                              ${color.bg} ${color.text}
                              ${isSelected 
                                ? `border-2 ${color.border} shadow-lg scale-105` 
                                : 'border-2 border-transparent hover:scale-105'
                              }
                            `}
                          >
                            <span className="flex items-center gap-1.5">
                              {isSelected && <span className="text-xs">✓</span>}
                              {label.name}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                
                {selectedLabelIds.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-700">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-primary">
                        {selectedLabelIds.length}
                      </span>
                      <span className="text-xs text-gray-400">
                        etiqueta{selectedLabelIds.length > 1 ? 's' : ''} selecionada{selectedLabelIds.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {config.action === 'list' && (
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">
                  Salvar resultado como
                </label>
                <input
                  type="text"
                  value={config.saveLabelsAs || 'chatLabels'}
                  onChange={(e) => setConfig({ ...config, saveLabelsAs: e.target.value })}
                  placeholder="chatLabels"
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500 font-mono"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Nome da variável onde as etiquetas serão salvas
                </p>
              </div>
            )}

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-xs text-blue-300 leading-relaxed">
                💡 <strong>Dica:</strong> As etiquetas do WhatsApp são as tags coloridas que aparecem nas conversas. 
                Use este node para organizar automaticamente seus contatos por categorias (cliente, lead, suporte, etc).
                {config.action === 'list' && ' As etiquetas serão salvas em formato de array com id, name e color.'}
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

      case 'HTTP_REQUEST':
        const httpHeaders = config.headers || []
        const httpQueryParams = config.queryParams || []
        
        const addHeader = () => {
          setConfig({ ...config, headers: [...httpHeaders, { key: '', value: '' }] })
        }
        
        const updateHeader = (index: number, field: string, value: string) => {
          const updated = [...httpHeaders]
          updated[index] = { ...updated[index], [field]: value }
          setConfig({ ...config, headers: updated })
        }
        
        const removeHeader = (index: number) => {
          const updated = httpHeaders.filter((_: any, i: number) => i !== index)
          setConfig({ ...config, headers: updated })
        }
        
        const addQueryParam = () => {
          setConfig({ ...config, queryParams: [...httpQueryParams, { key: '', value: '' }] })
        }
        
        const updateQueryParam = (index: number, field: string, value: string) => {
          const updated = [...httpQueryParams]
          updated[index] = { ...updated[index], [field]: value }
          setConfig({ ...config, queryParams: updated })
        }
        
        const removeQueryParam = (index: number) => {
          const updated = httpQueryParams.filter((_: any, i: number) => i !== index)
          setConfig({ ...config, queryParams: updated })
        }

        return (
          <div className="space-y-6">
            {/* Method and URL */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-400">
                  Método
                </label>
                <select
                  value={config.method || 'GET'}
                  onChange={(e) => setConfig({ ...config, method: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                  <option value="HEAD">HEAD</option>
                  <option value="OPTIONS">OPTIONS</option>
                </select>
              </div>
              
              <div className="col-span-3">
                <label className="block text-xs font-medium mb-1.5 text-gray-400">
                  URL
                </label>
                <input
                  type="text"
                  value={config.url || ''}
                  onChange={(e) => setConfig({ ...config, url: e.target.value })}
                  placeholder="https://api.example.com/endpoint"
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono"
                />
              </div>
            </div>

            {/* Authentication */}
            <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">Autenticação</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-400">
                    Tipo
                  </label>
                  <select
                    value={config.authentication || 'none'}
                    onChange={(e) => setConfig({ ...config, authentication: e.target.value, authConfig: {} })}
                    className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white"
                  >
                    <option value="none">Nenhuma</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="basic">Basic Auth</option>
                    <option value="header">Header Customizado</option>
                  </select>
                </div>

                {config.authentication === 'bearer' && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400">
                      Token
                    </label>
                    <input
                      type="text"
                      value={config.authConfig?.token || ''}
                      onChange={(e) => setConfig({ ...config, authConfig: { ...config.authConfig, token: e.target.value } })}
                      placeholder="seu-token-aqui"
                      className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono"
                    />
                  </div>
                )}

                {config.authentication === 'basic' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-gray-400">
                        Usuário
                      </label>
                      <input
                        type="text"
                        value={config.authConfig?.username || ''}
                        onChange={(e) => setConfig({ ...config, authConfig: { ...config.authConfig, username: e.target.value } })}
                        placeholder="usuario"
                        className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-gray-400">
                        Senha
                      </label>
                      <input
                        type="password"
                        value={config.authConfig?.password || ''}
                        onChange={(e) => setConfig({ ...config, authConfig: { ...config.authConfig, password: e.target.value } })}
                        placeholder="senha"
                        className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500"
                      />
                    </div>
                  </div>
                )}

                {config.authentication === 'header' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-gray-400">
                        Nome do Header
                      </label>
                      <input
                        type="text"
                        value={config.authConfig?.headerName || ''}
                        onChange={(e) => setConfig({ ...config, authConfig: { ...config.authConfig, headerName: e.target.value } })}
                        placeholder="X-API-Key"
                        className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-gray-400">
                        Valor
                      </label>
                      <input
                        type="text"
                        value={config.authConfig?.headerValue || ''}
                        onChange={(e) => setConfig({ ...config, authConfig: { ...config.authConfig, headerValue: e.target.value } })}
                        placeholder="seu-valor-aqui"
                        className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Query Parameters */}
            <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-200">Parâmetros de Query</h3>
                <button
                  onClick={addQueryParam}
                  className="px-3 py-1.5 bg-primary text-black rounded text-xs font-semibold hover:bg-primary/80 transition"
                >
                  + Adicionar
                </button>
              </div>
              
              <div className="space-y-2">
                {httpQueryParams.map((param: any, index: number) => (
                  <div key={index} className="grid grid-cols-12 gap-2">
                    <input
                      type="text"
                      value={param.key}
                      onChange={(e) => updateQueryParam(index, 'key', e.target.value)}
                      placeholder="chave"
                      className="col-span-5 px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500"
                    />
                    <input
                      type="text"
                      value={param.value}
                      onChange={(e) => updateQueryParam(index, 'value', e.target.value)}
                      placeholder="valor"
                      className="col-span-6 px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono"
                    />
                    <button
                      onClick={() => removeQueryParam(index)}
                      className="col-span-1 text-red-400 hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {httpQueryParams.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-2">Nenhum parâmetro adicionado</p>
                )}
              </div>
            </div>

            {/* Headers */}
            <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-200">Headers Customizados</h3>
                <button
                  onClick={addHeader}
                  className="px-3 py-1.5 bg-primary text-black rounded text-xs font-semibold hover:bg-primary/80 transition"
                >
                  + Adicionar
                </button>
              </div>
              
              <div className="space-y-2">
                {httpHeaders.map((header: any, index: number) => (
                  <div key={index} className="grid grid-cols-12 gap-2">
                    <input
                      type="text"
                      value={header.key}
                      onChange={(e) => updateHeader(index, 'key', e.target.value)}
                      placeholder="Content-Type"
                      className="col-span-5 px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500"
                    />
                    <input
                      type="text"
                      value={header.value}
                      onChange={(e) => updateHeader(index, 'value', e.target.value)}
                      placeholder="application/json"
                      className="col-span-6 px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono"
                    />
                    <button
                      onClick={() => removeHeader(index)}
                      className="col-span-1 text-red-400 hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {httpHeaders.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-2">Nenhum header adicionado</p>
                )}
              </div>
            </div>

            {/* Body (for POST/PUT/PATCH) */}
            {['POST', 'PUT', 'PATCH'].includes(config.method) && (
              <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-200 mb-3">Body</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400">
                      Tipo
                    </label>
                    <select
                      value={config.bodyType || 'json'}
                      onChange={(e) => setConfig({ ...config, bodyType: e.target.value })}
                      className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white"
                    >
                      <option value="json">JSON</option>
                      <option value="raw">Raw/Text</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400">
                      Conteúdo
                    </label>
                    <textarea
                      value={config.body || ''}
                      onChange={(e) => setConfig({ ...config, body: e.target.value })}
                      placeholder={config.bodyType === 'json' ? '{\n  "nome": "{{variables.userName}}",\n  "email": "user@example.com"\n}' : 'Texto ou conteúdo raw'}
                      rows={8}
                      className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Options */}
            <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">Opções</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-400">
                    Salvar resposta como
                  </label>
                  <input
                    type="text"
                    value={config.saveResponseAs || 'httpResponse'}
                    onChange={(e) => setConfig({ ...config, saveResponseAs: e.target.value })}
                    placeholder="httpResponse"
                    className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-400">
                    Timeout (ms)
                  </label>
                  <input
                    type="number"
                    value={config.timeout || 30000}
                    onChange={(e) => setConfig({ ...config, timeout: parseInt(e.target.value) })}
                    placeholder="30000"
                    className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.followRedirects !== false}
                    onChange={(e) => setConfig({ ...config, followRedirects: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-700 bg-[#1a1a1a] text-primary focus:ring-primary"
                  />
                  <label className="text-xs text-gray-400">
                    Seguir redirecionamentos
                  </label>
                </div>
              </div>
            </div>

            {/* Help Text */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-xs text-blue-300 leading-relaxed">
                💡 <strong>Dica:</strong> Use <code className="bg-blue-500/20 px-1 py-0.5 rounded">{'{{variables.nome}}'}</code> para interpolar variáveis na URL, headers, query params e body. 
                A resposta será salva em <code className="bg-blue-500/20 px-1 py-0.5 rounded">variables.{config.saveResponseAs || 'httpResponse'}</code> e pode ser acessada nos próximos nodes.
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

