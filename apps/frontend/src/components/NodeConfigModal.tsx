'use client'

import { useState, useEffect, useRef } from 'react'
import { WorkflowNode, WorkflowNodeType } from '@n9n/shared'
import { apiClient } from '@/lib/api-client'
import Editor from '@monaco-editor/react'

interface NodeConfigModalProps {
  node: WorkflowNode | null
  tenantId: string
  onClose: () => void
  onSave: (nodeId: string, config: any) => void
  embedded?: boolean
}

// Component for SET_TAGS configuration
function SetTagsConfig({ config, setConfig, tenantId }: any) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  const [availableTags, setAvailableTags] = useState<any[]>([])
  const [loadingTags, setLoadingTags] = useState(false)

  useEffect(() => {
    loadAvailableTags()
  }, [])

  // Ensure action is always set
  useEffect(() => {
    if (!config.action) {
      console.log('[SetTagsConfig] Setting default action to "add"')
      setConfig({ ...config, action: 'add' })
    }
  }, [config.action])

  const loadAvailableTags = async () => {
    try {
      setLoadingTags(true)
      const response = await fetch(`${API_URL}/api/tags?tenantId=${tenantId}`)
      if (response.ok) {
        const data = await response.json()
        setAvailableTags(data)
      }
    } catch (error) {
      console.error('Error loading tags:', error)
    } finally {
      setLoadingTags(false)
    }
  }

  const toggleTag = (tagName: string) => {
    const currentTags = config.tags || []
    const newTags = currentTags.includes(tagName)
      ? currentTags.filter((t: string) => t !== tagName)
      : [...currentTags, tagName]
    setConfig({ ...config, tags: newTags })
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
          <option value="add">Adicionar Tags</option>
          <option value="remove">Remover Tags</option>
          <option value="set">Substituir Todas as Tags</option>
          <option value="clear">Limpar Todas as Tags</option>
        </select>
        <p className="text-xs text-gray-500 mt-1.5">
          {config.action === 'add' && 'Adiciona novas tags sem remover as existentes'}
          {config.action === 'remove' && 'Remove apenas as tags especificadas'}
          {config.action === 'set' && 'Substitui todas as tags pelas especificadas'}
          {config.action === 'clear' && 'Remove todas as tags do contato'}
        </p>
      </div>

      {config.action !== 'clear' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-200">
              Selecione as Tags
            </label>
            <button
              onClick={loadAvailableTags}
              className="text-xs text-primary hover:text-primary/80"
            >
              🔄 Recarregar
            </button>
          </div>

          {loadingTags ? (
            <div className="text-center py-8 text-gray-500">
              Carregando tags...
            </div>
          ) : availableTags.length === 0 ? (
            <div className="text-center py-8 border border-gray-700 rounded-lg">
              <p className="text-gray-500 mb-2">Nenhuma tag criada ainda</p>
              <a
                href="/tags"
                target="_blank"
                className="text-primary hover:text-primary/80 text-sm"
              >
                Criar tags →
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-2 bg-[#0a0a0a] border border-gray-700 rounded">
              {availableTags.map((tag) => {
                const isSelected = (config.tags || []).includes(tag.name)
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.name)}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded transition text-left
                      ${isSelected
                        ? 'bg-purple-500/20 border-2 border-purple-500'
                        : 'bg-[#151515] border border-gray-700 hover:border-gray-600'
                      }
                    `}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color || '#8b5cf6' }}
                    />
                    <span className="text-sm truncate">{tag.name}</span>
                    {isSelected && <span className="ml-auto text-purple-400">✓</span>}
                  </button>
                )
              })}
            </div>
          )}

          {(config.tags || []).length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-2">Tags selecionadas:</p>
              <div className="flex flex-wrap gap-2">
                {(config.tags || []).map((tagName: string) => {
                  const tag = availableTags.find(t => t.name === tagName)
                  return (
                    <span
                      key={tagName}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
                      style={{
                        backgroundColor: tag?.color ? tag.color + '20' : '#8b5cf620',
                        color: tag?.color || '#8b5cf6',
                      }}
                    >
                      {tagName}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🏷️</span>
          <div className="flex-1">
            <p className="text-sm text-purple-300 font-medium mb-2">
              Tags Internas
            </p>
            <p className="text-xs text-purple-200/80 mb-2">
              As tags são armazenadas internamente e ficam disponíveis em todos os nodes através da variável <code className="bg-purple-500/20 px-1 py-0.5 rounded">contactTags</code>.
            </p>
            <p className="text-xs text-purple-200/80">
              Exemplo: Use em condições como <code className="bg-purple-500/20 px-1 py-0.5 rounded">contactTags.includes("vip")</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Editor de código Monaco (VS Code)
function CodeEditor({ value, onChange, language = 'javascript' }: any) {
  const handleEditorChange = (newValue: string | undefined) => {
    onChange({ target: { value: newValue || '' } })
  }

  const handleEditorDidMount = (editor: any, monaco: any) => {
    // Adicionar snippets customizados
    monaco.languages.registerCompletionItemProvider(language, {
      provideCompletionItems: () => {
        const suggestions = [
          {
            label: 'map',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'map((item) => {\n\t${1:return item}\n})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Array map function',
          },
          {
            label: 'filter',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'filter((item) => ${1:item.condition})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Array filter function',
          },
          {
            label: 'reduce',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'reduce((acc, item) => {\n\t${1:return acc}\n}, ${2:initialValue})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Array reduce function',
          },
          {
            label: 'forEach',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'forEach((item) => {\n\t${1:// code}\n})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Array forEach function',
          },
          {
            label: 'find',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'find((item) => ${1:item.condition})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Array find function',
          },
          {
            label: 'variables.',
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: 'variables.${1:variableName}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Access context variables',
          },
        ]
        return { suggestions }
      },
    })
  }

  return (
    <Editor
      height="400px"
      language={language}
      value={value || ''}
      onChange={handleEditorChange}
      onMount={handleEditorDidMount}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        roundedSelection: true,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        suggest: {
          snippetsPreventQuickSuggestions: false,
        },
        quickSuggestions: {
          other: true,
          comments: false,
          strings: true,
        },
      }}
    />
  )
}

// Input com suporte a drag-and-drop
function DroppableInput({ value, onChange, placeholder, className, type = 'text' }: any) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const droppedText = e.dataTransfer.getData('text/plain')
    
    console.log('[DroppableInput] Dropped text:', droppedText)
    console.log('[DroppableInput] Current value:', value)
    
    // Inserir no cursor ou no final
    if (inputRef.current) {
      const input = inputRef.current
      const start = input.selectionStart || 0
      const end = input.selectionEnd || 0
      const currentValue = value || ''
      const newValue = currentValue.substring(0, start) + droppedText + currentValue.substring(end)
      
      console.log('[DroppableInput] New value:', newValue)
      
      onChange({ target: { value: newValue } })
      
      // Reposicionar cursor
      setTimeout(() => {
        input.focus()
        input.setSelectionRange(start + droppedText.length, start + droppedText.length)
      }, 0)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const Component = type === 'textarea' ? 'textarea' : 'input'

  return (
    <Component
      ref={inputRef as any}
      type={type === 'textarea' ? undefined : type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`${className} ${isDragOver ? 'ring-2 ring-primary bg-primary/10' : ''}`}
      style={type === 'textarea' ? { minHeight: '100px' } : undefined}
    />
  )
}

export default function NodeConfigModal({
  node,
  tenantId,
  onClose,
  onSave,
  embedded = false,
}: NodeConfigModalProps) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  const [activeTab, setActiveTab] = useState<'parameters' | 'settings'>('parameters')
  const [config, setConfig] = useState<any>({})
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [availableLabels, setAvailableLabels] = useState<any[]>([])
  const [loadingLabels, setLoadingLabels] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (node) {
      setConfig(node.config || {})
      
      // Load sessions if it's a trigger node or manage labels node
      if (node.type === WorkflowNodeType.TRIGGER_MESSAGE || node.type === WorkflowNodeType.TRIGGER_SCHEDULE || node.type === 'TRIGGER_MANUAL' || node.type === 'MANAGE_LABELS') {
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

  const handleSave = async () => {
    if (node) {
      setSaving(true)
      try {
        await onSave(node.id, config)
        setSaveSuccess(true)
        
        // Mostrar feedback de sucesso por 2 segundos
        setTimeout(() => {
          setSaveSuccess(false)
          if (!embedded) {
            onClose()
          }
        }, 2000)
      } catch (error) {
        console.error('Error saving:', error)
        setSaving(false)
      }
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

      case 'TRIGGER_MANUAL':
        return (
          <div className="space-y-6">
            <div className="bg-[#1a2a1a] border border-green-700/30 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="text-4xl">▶️</div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Trigger Manual
                  </h3>
                  <p className="text-sm text-gray-300 mb-4">
                    Este workflow será executado manualmente através de um botão de "Start" no canvas.
                    Ideal para testes e execuções sob demanda.
                  </p>
                </div>
              </div>
            </div>

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
                <option value="">Primeira sessão disponível</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name} ({session.phoneNumber})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1.5">
                Sessão WhatsApp que será usada para executar o workflow
              </p>
            </div>

            <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">
                Dados de Teste (Opcional)
              </h3>
              <p className="text-xs text-gray-400 mb-3">
                Você pode definir dados iniciais que estarão disponíveis em <code className="text-primary">variables</code> durante a execução.
              </p>
              <textarea
                value={config.testData ? JSON.stringify(config.testData, null, 2) : ''}
                onChange={(e) => {
                  try {
                    const parsed = e.target.value ? JSON.parse(e.target.value) : {}
                    setConfig({ ...config, testData: parsed })
                  } catch (err) {
                    // Invalid JSON, keep current
                  }
                }}
                placeholder={'{\n  "userName": "João",\n  "userId": "123"\n}'}
                rows={6}
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary resize-none text-white placeholder-gray-500 font-mono text-sm"
              />
            </div>
          </div>
        )

      case 'TRIGGER_SCHEDULE':
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
                <option value="">Primeira sessão disponível</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name} ({session.phoneNumber})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1.5">
                Sessão WhatsApp que será usada para executar o workflow
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Tipo de Agendamento
              </label>
              <select
                value={config.scheduleType || 'cron'}
                onChange={(e) => setConfig({ ...config, scheduleType: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
              >
                <option value="cron">Expressão Cron</option>
                <option value="interval">Intervalo</option>
              </select>
            </div>

            {config.scheduleType === 'cron' ? (
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">
                  Expressão Cron
                </label>
                <input
                  type="text"
                  value={config.cronExpression || ''}
                  onChange={(e) => setConfig({ ...config, cronExpression: e.target.value })}
                  placeholder="*/5 * * * *"
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500 font-mono"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Formato: minuto hora dia mês dia-da-semana
                </p>
                
                {/* Cron Examples */}
                <div className="mt-4 bg-[#1a1a1a] border border-gray-700 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-200 mb-3">Exemplos:</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-gray-800 rounded text-primary font-mono">*/5 * * * *</code>
                      <span className="text-gray-400">A cada 5 minutos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-gray-800 rounded text-primary font-mono">0 9 * * *</code>
                      <span className="text-gray-400">Todos os dias às 9h</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-gray-800 rounded text-primary font-mono">0 9 * * 1</code>
                      <span className="text-gray-400">Toda segunda-feira às 9h</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-gray-800 rounded text-primary font-mono">0 0 1 * *</code>
                      <span className="text-gray-400">Todo dia 1 do mês à meia-noite</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-gray-800 rounded text-primary font-mono">0 */2 * * *</code>
                      <span className="text-gray-400">A cada 2 horas</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">
                  Intervalo (em minutos)
                </label>
                <input
                  type="number"
                  value={config.intervalMinutes || 5}
                  onChange={(e) => setConfig({ ...config, intervalMinutes: parseInt(e.target.value) || 5 })}
                  placeholder="5"
                  min="1"
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  O workflow será executado a cada {config.intervalMinutes || 5} minuto(s)
                </p>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
              <p className="text-xs text-purple-300 leading-relaxed">
                ⏰ <strong>Agendamento:</strong> Este workflow será executado automaticamente de acordo com o agendamento configurado.
                {config.scheduleType === 'cron' 
                  ? ' Use expressões cron para controle preciso de horários.'
                  : ' O workflow será executado em intervalos regulares.'}
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

      case 'SEND_MEDIA':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Tipo de Mídia
              </label>
              <select
                value={config.mediaType || 'image'}
                onChange={(e) => setConfig({ ...config, mediaType: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
              >
                <option value="image">📷 Imagem</option>
                <option value="video">🎥 Vídeo</option>
                <option value="audio">🎵 Áudio</option>
                <option value="document">📄 Documento</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                URL da Mídia
              </label>
              <input
                type="text"
                value={config.mediaUrl || ''}
                onChange={(e) => setConfig({ ...config, mediaUrl: e.target.value })}
                placeholder="https://example.com/media.jpg"
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500 font-mono text-sm"
              />
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-gray-500">
                  Use <code className="px-1.5 py-0.5 bg-gray-800 rounded text-primary">{`{{variables.imageUrl}}`}</code> para inserir variáveis
                </span>
              </div>
            </div>

            {(config.mediaType === 'image' || config.mediaType === 'video') && (
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">
                  Legenda (opcional)
                </label>
                <textarea
                  value={config.caption || ''}
                  onChange={(e) => setConfig({ ...config, caption: e.target.value })}
                  placeholder="Digite uma legenda para a mídia..."
                  rows={3}
                  className="w-full px-4 py-3 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary resize-none text-white placeholder-gray-500 font-mono text-sm"
                />
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-gray-500">
                    Suporta variáveis como <code className="px-1.5 py-0.5 bg-gray-800 rounded text-primary">{`{{variables.name}}`}</code>
                  </span>
                </div>
              </div>
            )}

            {config.mediaType === 'document' && (
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">
                  Nome do Arquivo (opcional)
                </label>
                <input
                  type="text"
                  value={config.fileName || ''}
                  onChange={(e) => setConfig({ ...config, fileName: e.target.value })}
                  placeholder="documento.pdf"
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Nome que será exibido para o arquivo
                </p>
              </div>
            )}

            {config.mediaType === 'audio' && (
              <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.sendAudioAsVoice || false}
                    onChange={(e) => setConfig({ ...config, sendAudioAsVoice: e.target.checked })}
                    className="w-4 h-4 text-primary bg-gray-700 border-gray-600 rounded focus:ring-primary focus:ring-2"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-200">
                      🎤 Enviar como áudio de voz (PTT)
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      O áudio será enviado como se tivesse sido gravado na hora
                    </p>
                  </div>
                </label>
              </div>
            )}

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
                Atraso opcional antes de enviar (em milissegundos)
              </p>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-xs text-blue-300 leading-relaxed">
                💡 <strong>Dica:</strong> A mídia será baixada da URL fornecida e enviada via WhatsApp. 
                Certifique-se de que a URL seja acessível publicamente.
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

      case 'SET_TAGS':
        return <SetTagsConfig config={config} setConfig={setConfig} tenantId={tenantId} />

      case 'WAIT':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Tempo de Espera
              </label>
              <div className="flex gap-3">
                <input
                  type="number"
                  value={config.amount || 1}
                  onChange={(e) => setConfig({ ...config, amount: parseInt(e.target.value) || 1 })}
                  placeholder="1"
                  min="1"
                  className="flex-1 px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                />
                <select
                  value={config.unit || 'seconds'}
                  onChange={(e) => setConfig({ ...config, unit: e.target.value })}
                  className="px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                >
                  <option value="seconds">Segundos</option>
                  <option value="minutes">Minutos</option>
                  <option value="hours">Horas</option>
                  <option value="days">Dias</option>
                </select>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                Quanto tempo aguardar antes de continuar
              </p>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">ℹ️</span>
                <div className="flex-1">
                  <p className="text-sm text-blue-300 font-medium mb-1">
                    Pausa Automática
                  </p>
                  <p className="text-xs text-blue-200/80">
                    A execução será pausada pelo tempo configurado e depois continuará automaticamente para o próximo node.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )

      case 'CONDITION':
        // Parse existing expression or use defaults
        const parseExpression = (expr: string) => {
          if (!expr) return { value1: '', operator: '==', value2: '' }
          
          // Check for array operators first
          if (expr.includes('.includes(') && !expr.includes('.toLowerCase()')) {
            // Array contains: contactTags.includes("vendas")
            const match = expr.match(/(.+?)\.includes\("([^"]+)"\)/)
            if (match) {
              return { value1: match[1].replace(/^!/, ''), operator: expr.startsWith('!') ? '.array_not_contains(' : '.array_contains(', value2: match[2] }
            }
          }
          
          if (expr.includes('.length === 0')) {
            const value1 = expr.replace('.length === 0', '').trim()
            return { value1, operator: '.array_is_empty', value2: '' }
          }
          
          if (expr.includes('.length > 0')) {
            const value1 = expr.replace('.length > 0', '').trim()
            return { value1, operator: '.array_is_not_empty', value2: '' }
          }
          
          // Check for array contains any/all (multiple OR/AND conditions)
          if (expr.includes(' || ') && expr.includes('.includes(')) {
            const parts = expr.split(' || ')
            const firstMatch = parts[0].match(/(.+?)\.includes\("([^"]+)"\)/)
            if (firstMatch) {
              const value1 = firstMatch[1]
              const values = parts.map(p => {
                const m = p.match(/\.includes\("([^"]+)"\)/)
                return m ? m[1] : ''
              }).filter(Boolean)
              return { value1, operator: '.array_contains_any(', value2: values.join(', ') }
            }
          }
          
          if (expr.includes(' && ') && expr.includes('.includes(')) {
            const parts = expr.split(' && ')
            const firstMatch = parts[0].match(/(.+?)\.includes\("([^"]+)"\)/)
            if (firstMatch) {
              const value1 = firstMatch[1]
              const values = parts.map(p => {
                const m = p.match(/\.includes\("([^"]+)"\)/)
                return m ? m[1] : ''
              }).filter(Boolean)
              return { value1, operator: '.array_contains_all(', value2: values.join(', ') }
            }
          }
          
          // Try to parse expressions like "variables.opcao == 2"
          const operators = ['===', '!==', '==', '!=', '>=', '<=', '>', '<', '.includes(', '.startsWith(', '.endsWith(']
          for (const op of operators) {
            if (expr.includes(op)) {
              const parts = expr.split(op)
              if (parts.length >= 2) {
                // Remove .toLowerCase() from parsed values to avoid duplication
                let value1 = parts[0].trim().replace(/\.toLowerCase\(\)/g, '')
                // For value2, remove everything after the closing quote/parenthesis
                let value2Raw = parts[1].trim()
                // Extract the actual value between quotes
                const match = value2Raw.match(/"([^"]*)"/)
                let value2 = match ? match[1] : value2Raw.replace(/[()'"]/g, '').replace(/\.toLowerCase\(\)/g, '')
                
                return {
                  value1,
                  operator: op,
                  value2
                }
              }
            }
          }
          
          return { value1: expr, operator: '==', value2: '' }
        }

        // Use state to manage condition parts independently
        const [conditionParts, setConditionParts] = useState(() => parseExpression(config.expression || ''))
        
        // Update parts when config.expression changes externally
        useEffect(() => {
          setConditionParts(parseExpression(config.expression || ''))
        }, [config.expression])
        
        const updateCondition = (field: string, value: string) => {
          const parts = { ...conditionParts, [field]: value }
          setConditionParts(parts)
          
          let expression = ''
          
          // Array operators
          if (parts.operator === '.array_contains(') {
            expression = `${parts.value1}.includes("${parts.value2}")`
          } else if (parts.operator === '.array_not_contains(') {
            expression = `!${parts.value1}.includes("${parts.value2}")`
          } else if (parts.operator === '.array_contains_any(') {
            const values = parts.value2.split(',').map(v => v.trim())
            expression = values.map(v => `${parts.value1}.includes("${v}")`).join(' || ')
          } else if (parts.operator === '.array_contains_all(') {
            const values = parts.value2.split(',').map(v => v.trim())
            expression = values.map(v => `${parts.value1}.includes("${v}")`).join(' && ')
          } else if (parts.operator === '.array_is_empty') {
            expression = `${parts.value1}.length === 0`
          } else if (parts.operator === '.array_is_not_empty') {
            expression = `${parts.value1}.length > 0`
          } else if (parts.operator.includes('(')) {
            // For string methods like includes, startsWith, endsWith - use lowercase for case-insensitive comparison
            expression = `${parts.value1}.toLowerCase()${parts.operator}"${parts.value2}".toLowerCase())`
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
                    placeholder={conditionParts.operator.startsWith('.array_') ? "contactTags" : "variables.opcao"}
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
                    <optgroup label="Array">
                      <option value=".array_contains(">array contains</option>
                      <option value=".array_not_contains(">array not contains</option>
                      <option value=".array_contains_any(">array contains any</option>
                      <option value=".array_contains_all(">array contains all</option>
                      <option value=".array_is_empty">array is empty</option>
                      <option value=".array_is_not_empty">array is not empty</option>
                    </optgroup>
                  </select>
                </div>

                {/* Value 2 */}
                {!conditionParts.operator.includes('_is_empty') && !conditionParts.operator.includes('_is_not_empty') && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400">
                      Value 2
                    </label>
                    <input
                      type="text"
                      value={conditionParts.value2}
                      onChange={(e) => updateCondition('value2', e.target.value)}
                      placeholder={
                        conditionParts.operator.includes('array_contains_any') || conditionParts.operator.includes('array_contains_all')
                          ? "vendas, vip, premium (separe por vírgula)"
                          : conditionParts.operator.startsWith('.array_')
                          ? "vendas"
                          : conditionParts.operator.includes('(')
                          ? "sim, s, ok (separe por vírgula)"
                          : "2"
                      }
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono"
                    />
                    {(conditionParts.operator.includes('array_contains_any') || conditionParts.operator.includes('array_contains_all')) && (
                      <p className="text-xs text-gray-500 mt-1">
                        💡 Dica: Use vírgulas para múltiplas tags (ex: vendas, vip, premium)
                      </p>
                    )}
                    {conditionParts.operator.includes('(') && !conditionParts.operator.startsWith('.array_') && (
                      <p className="text-xs text-gray-500 mt-1">
                        💡 Dica: Use vírgulas para múltiplas opções (ex: sim, s, ok, talvez)
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Preview */}
              <div className="mt-4 pt-4 border-t border-gray-700">
                <label className="block text-xs font-medium mb-1.5 text-gray-400">
                  Expression Preview
                </label>
                <div className="px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded text-sm text-primary font-mono">
                  {(() => {
                    const expr = config.expression || 'No expression set'
                    // Show how multiple values will be processed
                    if (conditionParts.operator.includes('(') && conditionParts.value2.includes(',')) {
                      const values = conditionParts.value2.split(',').map(v => v.trim())
                      return `${conditionParts.value1}.toLowerCase()${conditionParts.operator}"${values[0]}".toLowerCase()) OR ... OR ${conditionParts.operator}"${values[values.length - 1]}".toLowerCase())`
                    }
                    return expr
                  })()}
                </div>
                {conditionParts.operator.includes('(') && conditionParts.value2.includes(',') && (
                  <p className="text-xs text-gray-500 mt-1">
                    ℹ️ O backend vai testar cada valor separadamente: {conditionParts.value2.split(',').map(v => `"${v.trim()}"`).join(', ')}
                  </p>
                )}
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
                          placeholder={rule.operator.includes('(') ? "sim, s, ok (separe por vírgula)" : "1"}
                          className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono"
                        />
                        {rule.operator.includes('(') && (
                          <p className="text-xs text-gray-500 mt-1">
                            💡 Dica: Use vírgulas para múltiplas opções (ex: sim, s, ok, talvez)
                          </p>
                        )}
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

      case 'EDIT_FIELDS':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Modo
              </label>
              <select
                value={config.mode || 'fields'}
                onChange={(e) => setConfig({ ...config, mode: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
              >
                <option value="fields">Campos (Visual)</option>
                <option value="json">JSON</option>
              </select>
              <p className="text-xs text-gray-500 mt-1.5">
                Escolha como deseja definir os campos
              </p>
            </div>

            {config.mode === 'json' ? (
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">
                  JSON
                </label>
                <textarea
                  value={config.jsonData || ''}
                  onChange={(e) => setConfig({ ...config, jsonData: e.target.value })}
                  placeholder={`{\n  "my_field_1": "value",\n  "my_field_2": 1\n}`}
                  rows={12}
                  className="w-full px-4 py-3 bg-[#0d0d0d] border border-gray-700 rounded focus:outline-none focus:border-primary resize-none text-white placeholder-gray-600 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Defina os campos em formato JSON. Suporta variáveis: {`{{variables.name}}`}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-200">
                      Campos
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const operations = config.operations || []
                        setConfig({
                          ...config,
                          operations: [
                            ...operations,
                            {
                              id: `field-${Date.now()}`,
                              name: '',
                              value: '',
                              type: 'string'
                            }
                          ]
                        })
                      }}
                      className="px-3 py-1.5 bg-primary text-black text-sm font-medium rounded hover:bg-primary/90 transition"
                    >
                      + Adicionar Campo
                    </button>
                  </div>

                  {(!config.operations || config.operations.length === 0) && (
                    <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-700 rounded-lg">
                      <p className="text-sm">Nenhum campo adicionado</p>
                      <p className="text-xs mt-1">Clique em "Adicionar Campo" para começar</p>
                    </div>
                  )}

                  {config.operations && config.operations.map((operation: any, index: number) => (
                    <div key={operation.id} className="bg-[#151515] border border-gray-700 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-400">Campo {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const operations = config.operations.filter((_: any, i: number) => i !== index)
                            setConfig({ ...config, operations })
                          }}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          ✕ Remover
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1.5 text-gray-300">
                            Nome do Campo
                          </label>
                          <input
                            type="text"
                            value={operation.name || ''}
                            onChange={(e) => {
                              const operations = [...config.operations]
                              operations[index] = { ...operations[index], name: e.target.value }
                              setConfig({ ...config, operations })
                            }}
                            placeholder="meu_campo"
                            className="w-full px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-600 text-sm font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium mb-1.5 text-gray-300">
                            Tipo
                          </label>
                          <select
                            value={operation.type || 'string'}
                            onChange={(e) => {
                              const operations = [...config.operations]
                              operations[index] = { ...operations[index], type: e.target.value }
                              setConfig({ ...config, operations })
                            }}
                            className="w-full px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded focus:outline-none focus:border-primary text-white text-sm"
                          >
                            <option value="string">String</option>
                            <option value="number">Number</option>
                            <option value="boolean">Boolean</option>
                            <option value="json">JSON</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-gray-300">
                          Valor
                        </label>
                        <DroppableInput
                          type="text"
                          value={operation.value || ''}
                          onChange={(e: any) => {
                            const operations = [...config.operations]
                            operations[index] = { ...operations[index], value: e.target.value }
                            setConfig({ ...config, operations })
                          }}
                          placeholder={`valor ou {{variables.nome}}`}
                          className="w-full px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-600 text-sm font-mono"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Use {`{{variables.campo}}`} para referenciar variáveis
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.includeOtherFields !== false}
                      onChange={(e) => setConfig({ ...config, includeOtherFields: e.target.checked })}
                      className="w-4 h-4 text-primary bg-gray-700 border-gray-600 rounded focus:ring-primary focus:ring-2"
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-200">
                        Incluir outros campos do input
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Mantém os campos do input que não foram explicitamente definidos
                      </div>
                    </div>
                  </label>
                </div>
              </>
            )}
          </div>
        )

      case 'CODE':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Modo de Execução
              </label>
              <select
                value={config.mode || 'runOnceForAllItems'}
                onChange={(e) => setConfig({ ...config, mode: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
              >
                <option value="runOnceForAllItems">Executar uma vez para todos os itens</option>
                <option value="runOnceForEachItem">Executar uma vez para cada item</option>
              </select>
              <p className="text-xs text-gray-500 mt-1.5">
                {config.mode === 'runOnceForEachItem' 
                  ? 'O código será executado separadamente para cada item de entrada'
                  : 'O código será executado uma única vez com todos os itens'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Código JavaScript
              </label>
              <div className="bg-[#1e1e1e] border border-gray-700 rounded overflow-hidden">
                <CodeEditor
                  value={config.code || ''}
                  onChange={(e: any) => setConfig({ ...config, code: e.target.value })}
                  language="javascript"
                />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-500">
                  Use <code className="px-1.5 py-0.5 bg-gray-800 rounded text-primary font-mono">variables</code> para acessar variáveis do contexto
                </span>
              </div>
            </div>

            {/* Help Text */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-300 mb-2">💡 Como usar:</h4>
              <ul className="text-xs text-blue-300 space-y-1.5 leading-relaxed">
                <li>• Acesse variáveis com <code className="bg-blue-500/20 px-1 py-0.5 rounded font-mono">variables.nomeVariavel</code></li>
                <li>• Use <code className="bg-blue-500/20 px-1 py-0.5 rounded font-mono">return {'{ }'}</code> para definir o output</li>
                <li>• O output será salvo em <code className="bg-blue-500/20 px-1 py-0.5 rounded font-mono">variables.codeOutput</code></li>
                <li>• Suporta JavaScript ES6+ (arrow functions, destructuring, etc)</li>
              </ul>
            </div>

            {/* Examples */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">📝 Exemplos:</h4>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Transformar dados HTTP:</p>
                  <pre className="text-xs bg-black/50 p-2 rounded text-gray-300 font-mono overflow-x-auto">
{`const data = variables.httpResponse.body;
return {
  title: data.title.toUpperCase(),
  isComplete: data.completed
};`}
                  </pre>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Filtrar array:</p>
                  <pre className="text-xs bg-black/50 p-2 rounded text-gray-300 font-mono overflow-x-auto">
{`const items = variables.items || [];
return {
  filtered: items.filter(i => i.active)
};`}
                  </pre>
                </div>
              </div>
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

  // Embedded mode: render only the content without modal wrapper
  if (embedded) {
    return (
      <div className="h-full flex flex-col bg-[#111111]">
        {/* Tabs */}
        <div className="flex border-b border-gray-800 bg-[#0d0d0d]">
          <button
            onClick={() => setActiveTab('parameters')}
            className={`px-3 py-1.5 text-[11px] font-medium transition relative ${
              activeTab === 'parameters'
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Parameters
            {activeTab === 'parameters' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 text-[11px] font-medium transition relative ${
              activeTab === 'settings'
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Settings
            {activeTab === 'settings' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
            )}
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3">
            {activeTab === 'parameters' ? renderConfigFields() : (
              <div className="space-y-3">
                <div className="text-xs text-gray-400">
                  <p>Additional settings for this node.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Save Button - Fixed at bottom */}
        <div className="flex-shrink-0 p-3 border-t border-gray-800 bg-[#0d0d0d]">
          <button
            onClick={handleSave}
            disabled={saving || saveSuccess}
            className={`w-full px-4 py-2 rounded text-xs font-semibold transition flex items-center justify-center gap-2 ${
              saveSuccess 
                ? 'bg-green-500 text-white' 
                : saving 
                  ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                  : 'bg-primary text-black hover:bg-primary/90'
            }`}
          >
            {saving && (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {saveSuccess && '✓ Salvo com sucesso!'}
            {!saving && !saveSuccess && 'Save Changes'}
          </button>
        </div>
      </div>
    )
  }

  // Normal modal mode
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
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || saveSuccess}
            className={`px-8 py-2 rounded font-semibold transition shadow-lg flex items-center gap-2 ${
              saveSuccess 
                ? 'bg-green-500 text-white' 
                : saving 
                  ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                  : 'bg-primary text-black hover:bg-primary/90'
            }`}
          >
            {saving && (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {saveSuccess && '✓ Salvo!'}
            {!saving && !saveSuccess && 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

