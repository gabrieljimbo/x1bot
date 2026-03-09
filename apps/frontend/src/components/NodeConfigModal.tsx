'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Search,
  Check,
  Target,
  ExternalLink,
  Database,
  CheckCircle2
} from 'lucide-react';
import { WorkflowNode, WorkflowNodeType } from '@n9n/shared'
import { apiClient } from '@/lib/api-client'
import Editor from '@monaco-editor/react'

interface NodeConfigModalProps {
  node: WorkflowNode | null
  tenantId: string
  onClose: () => void
  onSave: (nodeId: string, config: any) => void
  embedded?: boolean
  inputData?: any // Optional: real execution input data
  executionData?: any // Optional: full execution data
  executionLogs?: any[] // Optional: execution logs
}

// Component for SET_TAGS configuration
function SetTagsConfig({ config, setConfig, tenantId: _tenantId }: any) {
  const [availableTags, setAvailableTags] = useState<any[]>([])
  const [loadingTags, setLoadingTags] = useState(false)

  useEffect(() => {
    loadAvailableTags()
  }, [])

  // Ensure action is always set
  useEffect(() => {
    if (!config.action) {
      setConfig({ ...config, action: 'add' })
    }
  }, [config.action])

  const loadAvailableTags = async () => {
    try {
      setLoadingTags(true)
      const data = await apiClient.getTags()
      setAvailableTags(data)
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
          {config.action === 'remove' && 'Remover apenas as tags especificadas'}
          {config.action === 'set' && 'Substitui todas as tags pelas especificadas'}
          {config.action === 'clear' && 'Remover todas as tags do contato'}
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
              Exemplo: Use em condições como <code className="bg-purple-500/20 px-1 py-0.5 rounded">contactTags.includes(&quot;vip&quot;)</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function GrupoMediaConfig({ config, setConfig, sessions, loading, tenantId, node }: any) {
  const [activeTab, setActiveTab] = useState<'params' | 'config'>('params');

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-700 mb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('params')}
          className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'params' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-200'}`}
        ><span>📝</span> Parâmetros</button>
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'config' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-200'}`}
        ><span>⚙️</span> Configurações</button>
      </div>

      {activeTab === 'params' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-200">Tipo de Mídia</label>
            <select
              value={config.mediaType || 'image'}
              onChange={(e) => setConfig({ ...config, mediaType: e.target.value })}
              className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
            >
              <option value="image">🖼️ Imagem (JPG, PNG, WEBP — máx 5MB)</option>
              <option value="audio">🎵 Áudio (MP3, OGG, AAC — máx 10MB)</option>
              <option value="ptt">🎤 Áudio de Voz (OGG — gravado na hora)</option>
              <option value="video">🎬 Vídeo (MP4 — máx 50MB)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-200">URL da Mídia</label>
            <input
              type="text"
              value={config.mediaUrl || ''}
              onChange={(e) => setConfig({ ...config, mediaUrl: e.target.value, uploadedMediaId: undefined })}
              placeholder="https://example.com/media.jpg"
              className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white font-mono text-sm"
              disabled={!!config.uploadedMediaId}
            />
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-gray-500">Suporta variáveis: <code className="px-1.5 py-0.5 bg-gray-800 rounded text-primary">{"{{variables.imageUrl}}"}</code></span>
            </div>

            {!config.uploadedMediaId ? (
              <div className="mt-3">
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 h-px bg-gray-700"></div>
                  <span className="text-xs text-gray-500">ou</span>
                  <div className="flex-1 h-px bg-gray-700"></div>
                </div>
                <label className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#151515] border border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-primary hover:bg-[#1a1a1a] transition-colors">
                  <span className="text-sm text-gray-300">📎 Upload de arquivo</span>
                  <input
                    type="file"
                    className="hidden"
                    accept={
                      config.mediaType === 'image' ? '.jpg,.jpeg,.png,.webp' :
                        config.mediaType === 'audio' || config.mediaType === 'ptt' ? '.mp3,.ogg,.aac' :
                          config.mediaType === 'video' ? '.mp4' : '*'
                    }
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return

                      const mediaType = config.mediaType || 'image'
                      const sizeLimits: Record<string, number> = {
                        image: 5 * 1024 * 1024,
                        audio: 10 * 1024 * 1024,
                        ptt: 10 * 1024 * 1024,
                        video: 50 * 1024 * 1024,
                      }

                      if (file.size > (sizeLimits[mediaType] || 5 * 1024 * 1024)) {
                        const maxMB = Math.round((sizeLimits[mediaType] || 5 * 1024 * 1024) / (1024 * 1024))
                        alert(`Arquivo muito grande. Máximo para ${mediaType}: ${maxMB}MB`)
                        e.target.value = ''
                        return
                      }

                      try {
                        const formData = new FormData()
                        formData.append('file', file)
                        const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '')
                        const token = localStorage.getItem('n9n_token')
                        const headers: HeadersInit = {}
                        if (token) {
                          headers['Authorization'] = `Bearer ${token}`
                        }
                        const res = await fetch(
                          `${API_URL}/media/upload?tenantId=${tenantId}&mediaType=${mediaType}&nodeId=${node.id}&workflowId=${node.workflowId || ''}`,
                          { method: 'POST', headers, body: formData }
                        )

                        if (!res.ok) {
                          const err = await res.json()
                          alert(err.message || 'Erro ao fazer upload')
                          e.target.value = ''
                          return
                        }

                        const data = await res.json()
                        setConfig({
                          ...config,
                          mediaUrl: data.url,
                          uploadedMediaId: data.id,
                          uploadedFileName: data.originalName,
                          uploadedFileSize: data.size,
                        })
                      } catch (err) {
                        alert('Erro ao fazer upload do arquivo')
                      }
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
            ) : (
              <div className="mt-3 p-3 bg-[#151515] border border-green-500/30 rounded flex justify-between items-center group">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-green-500 flex-shrink-0">✓</span>
                  <span className="text-sm text-gray-300 truncate" title={config.uploadedFileName}>
                    {config.uploadedFileName || 'Arquivo enviado'}
                  </span>
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    ({config.uploadedFileSize ? Math.round(config.uploadedFileSize / 1024) + ' KB' : '-'})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setConfig({
                      ...config,
                      mediaUrl: '',
                      uploadedMediaId: undefined,
                      uploadedFileName: undefined,
                      uploadedFileSize: undefined,
                    })
                  }}
                  className="text-red-400 hover:text-red-300 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remover arquivo"
                >
                  🗑️
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-200">💬 Legenda (opcional)</label>
            <textarea
              value={config.caption || ''}
              onChange={(e) => setConfig({ ...config, caption: e.target.value })}
              placeholder="Confira essa novidade! 🔥"
              className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">Suporta variáveis: {'{{variables.nome}}'}</p>
          </div>

          <div className="bg-[#1a1a1a] p-4 rounded border border-gray-700">
            <label className="flex items-center cursor-pointer mb-4">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.scheduling?.enabled || false}
                onChange={(e) => setConfig({
                  ...config,
                  scheduling: { ...config.scheduling, enabled: e.target.checked, mode: config.scheduling?.mode || 'datetime' }
                })}
              />
              <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary relative"></div>
              <span className="ml-3 text-sm font-medium text-gray-200">⏰ Agendar envio</span>
            </label>

            {config.scheduling?.enabled && (
              <div className="space-y-4 pt-4 border-t border-gray-700">
                <select
                  value={config.scheduling.mode || 'datetime'}
                  onChange={(e) => setConfig({ ...config, scheduling: { ...config.scheduling, mode: e.target.value } })}
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white text-sm"
                >
                  <option value="datetime">📅 Data e hora específica</option>
                  <option value="daily">🕐 Hora fixa diária</option>
                  <option value="days_after">📆 Dias após início do grupo</option>
                </select>

                {config.scheduling.mode === 'datetime' && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">Enviar uma vez em data e hora específica</p>
                    <div className="flex gap-4">
                      <input type="date" value={config.scheduling.date || ''} onChange={(e) => setConfig({ ...config, scheduling: { ...config.scheduling, date: e.target.value } })} className="flex-1 px-4 py-2 bg-[#151515] border border-gray-700 rounded text-white text-sm" />
                      <input type="time" value={config.scheduling.time || ''} onChange={(e) => setConfig({ ...config, scheduling: { ...config.scheduling, time: e.target.value } })} className="flex-1 px-4 py-2 bg-[#151515] border border-gray-700 rounded text-white text-sm" />
                    </div>
                  </div>
                )}
                {config.scheduling.mode === 'daily' && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">Enviar todo dia na mesma hora</p>
                    <input type="time" value={config.scheduling.time || ''} onChange={(e) => setConfig({ ...config, scheduling: { ...config.scheduling, time: e.target.value } })} className="w-full px-4 py-2 bg-[#151515] border border-gray-700 rounded text-white text-sm" />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d, i) => (
                        <label key={d} className="flex items-center gap-1 text-xs text-gray-300">
                          <input type="checkbox" checked={config.scheduling.days?.includes(i) || false} onChange={(e) => {
                            const days = new Set(config.scheduling.days || []);
                            e.target.checked ? days.add(i) : days.delete(i);
                            setConfig({ ...config, scheduling: { ...config.scheduling, days: Array.from(days) } })
                          }} /> {d}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {config.scheduling.mode === 'days_after' && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">Envia X dias após a ativação do grupo</p>
                    <div className="flex gap-4 items-center">
                      <input type="number" min="0" placeholder="Dia (ex: 1)" value={config.scheduling.day ?? 0} onChange={(e) => setConfig({ ...config, scheduling: { ...config.scheduling, day: parseInt(e.target.value) || 0 } })} className="flex-1 px-4 py-2 bg-[#151515] border border-gray-700 rounded text-white text-sm" />
                      <span className="text-gray-400 text-sm">às</span>
                      <input type="time" value={config.scheduling.time || '09:00'} onChange={(e) => setConfig({ ...config, scheduling: { ...config.scheduling, time: e.target.value } })} className="flex-1 px-4 py-2 bg-[#151515] border border-gray-700 rounded text-white text-sm" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {(config.mediaType === 'image' || config.mediaType === 'ptt') && (
            <label className="flex items-center cursor-pointer p-4 bg-[#1a1a1a] rounded border border-gray-700">
              <input type="checkbox" className="sr-only peer" checked={config.mentionAll || false} onChange={(e) => setConfig({ ...config, mentionAll: e.target.checked })} />
              <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary relative"></div>
              <span className="ml-3 text-sm font-medium text-gray-200">📣 Mencionar todos ao enviar</span>
            </label>
          )}

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-200">
              Sessão WhatsApp
            </label>
            <select
              value={config.sessionId || ''}
              onChange={(e) => setConfig({ ...config, sessionId: e.target.value })}
              className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
              disabled={loading}
            >
              <option value="">Sessão do contexto (padrão)</option>
              {sessions.map((session: any) => (
                <option key={session.id} value={session.id}>
                  {session.name} ({session.phoneNumber})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {activeTab === 'config' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-200">⏱️ Retry em caso de falha</label>
            <select
              value={config.retryCount ?? '3'}
              onChange={(e) => setConfig({ ...config, retryCount: e.target.value })}
              className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
            >
              <option value="0">Não tentar</option>
              <option value="1">1x</option>
              <option value="3">3x</option>
              <option value="5">5x</option>
            </select>
          </div>

          <label className="flex items-center cursor-pointer p-4 bg-[#1a1a1a] rounded border border-gray-700">
            <input type="checkbox" className="sr-only peer" checked={config.logSend ?? true} onChange={(e) => setConfig({ ...config, logSend: e.target.checked })} />
            <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary relative"></div>
            <span className="ml-3 text-sm font-medium text-gray-200">📝 Registrar envio no log</span>
          </label>
        </div>
      )}
    </div>
  )
}

function MessageComposer({ value, onChange, placeholder, tenantId, node }: { value: any, onChange: (val: any) => void, placeholder?: string, tenantId?: string, node?: any }) {
  const [activeTab, setActiveTab] = useState<'text' | 'image' | 'video' | 'audio'>(
    typeof value === 'object' ? value?.type || 'text' : 'text'
  );

  // Initialize with current value if it's already an object, or wrap if it's a string
  const config = typeof value === 'object' ? (value || { type: 'text', text: '' }) : { type: 'text', text: value || '' };

  const update = (fields: any) => {
    onChange({ ...config, ...fields });
  };

  const tabs = [
    { id: 'text', label: '💬 Texto', icon: '💬' },
    { id: 'image', label: '🖼️ Imagem', icon: '🖼️' },
    { id: 'video', label: '🎬 Vídeo', icon: '🎬' },
    { id: 'audio', label: '🎤 Áudio', icon: '🎤' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex bg-[#0d0d0d] p-1 rounded-lg border border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              update({ type: tab.id });
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase tracking-wider transition-all rounded-md ${activeTab === tab.id
              ? 'bg-gray-800 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-300'
              }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-4 bg-[#151515] p-4 border border-gray-700 rounded-xl">
        {activeTab === 'text' && (
          <div className="space-y-3">
            <textarea
              value={config.text || ''}
              onChange={(e) => update({ text: e.target.value })}
              placeholder={placeholder || 'Digite sua mensagem...'}
              className="w-full px-4 py-2.5 bg-[#0d0d0d] border border-gray-700 rounded focus:outline-none focus:border-primary text-white min-h-[100px] text-sm"
            />
            <div className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
              <span className="text-[10px] text-gray-400">✍️ Simular digitando</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={config.typingDuration || 3}
                  onChange={(e) => update({ typingDuration: parseInt(e.target.value) })}
                  className="w-12 bg-[#0d0d0d] border border-gray-700 rounded px-1.5 py-0.5 text-[10px] text-white text-center"
                />
                <button
                  onClick={() => update({ simulateTyping: !config.simulateTyping })}
                  className={`w-8 h-4 rounded-full relative transition-colors ${config.simulateTyping ? 'bg-primary' : 'bg-gray-700'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${config.simulateTyping ? 'left-4.5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'image' || activeTab === 'video') && (
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">URL da Mídia</label>
              <input
                type="text"
                value={config.mediaUrl || ''}
                onChange={(e) => update({ mediaUrl: e.target.value, uploadedMediaId: undefined })}
                placeholder="https://exemplo.com/media.jpg"
                className="w-full px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded text-xs text-white"
                disabled={!!config.uploadedMediaId}
              />
            </div>

            {/* File upload section */}
            {!config.uploadedMediaId ? (
              <div className="mt-3">
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 h-px bg-gray-700"></div>
                  <span className="text-xs text-gray-500">ou</span>
                  <div className="flex-1 h-px bg-gray-700"></div>
                </div>
                <label className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#151515] border border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-primary hover:bg-[#1a1a1a] transition-colors">
                  <span className="text-sm text-gray-300">📎 Upload de arquivo</span>
                  <input
                    type="file"
                    className="hidden"
                    accept={
                      activeTab === 'image' ? '.jpg,.jpeg,.png,.webp' :
                        activeTab === 'video' ? '.mp4' : '*'
                    }
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return

                      const sizeLimits: Record<string, number> = {
                        image: 5 * 1024 * 1024,
                        video: 50 * 1024 * 1024,
                      }

                      if (file.size > (sizeLimits[activeTab] || 5 * 1024 * 1024)) {
                        const maxMB = Math.round((sizeLimits[activeTab] || 5 * 1024 * 1024) / (1024 * 1024))
                        alert(`Arquivo muito grande. Máximo para ${activeTab}: ${maxMB}MB`)
                        e.target.value = ''
                        return
                      }

                      try {
                        const formData = new FormData()
                        formData.append('file', file)
                        const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '')
                        const token = localStorage.getItem('n9n_token')
                        const headers: HeadersInit = {}
                        if (token) {
                          headers['Authorization'] = `Bearer ${token}`
                        }
                        const res = await fetch(
                          `${API_URL}/media/upload?tenantId=${tenantId}&mediaType=${activeTab}&nodeId=${node?.id}&workflowId=${(node as any)?.workflowId || ''}`,
                          { method: 'POST', headers, body: formData }
                        )

                        if (!res.ok) {
                          const err = await res.json()
                          alert(err.message || 'Erro ao fazer upload')
                          e.target.value = ''
                          return
                        }

                        const data = await res.json()
                        update({
                          mediaUrl: data.url,
                          uploadedMediaId: data.id,
                          uploadedFileName: data.originalName,
                          uploadedFileSize: data.size,
                        })
                      } catch (err) {
                        alert('Erro ao fazer upload do arquivo')
                      }
                      e.target.value = ''
                    }}
                  />
                </label>
                <p className="text-xs text-gray-500 mt-1.5">
                  {activeTab === 'image' ? 'JPG, PNG, WEBP — máx 5MB' :
                    activeTab === 'video' ? 'MP4 — máx 50MB' : ''}
                </p>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-3 px-4 py-3 bg-[#1a1a2e] border border-primary/30 rounded-lg">
                <span className="text-xl">
                  {activeTab === 'image' ? '🖼️' :
                    activeTab === 'video' ? '🎥' : '📄'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{config.uploadedFileName || 'Arquivo'}</p>
                  <p className="text-xs text-gray-500">
                    {config.uploadedFileSize ? `${(config.uploadedFileSize / 1024).toFixed(1)} KB` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                  onClick={async () => {
                    try {
                      if (tenantId && config.uploadedMediaId) {
                        const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '')
                        const token = localStorage.getItem('n9n_token')
                        const headers: HeadersInit = {}
                        if (token) {
                          headers['Authorization'] = `Bearer ${token}`
                        }
                        await fetch(`${API_URL}/media/${config.uploadedMediaId}?tenantId=${tenantId}`, { method: 'DELETE', headers })
                      }
                    } catch (e) { /* ignore */ }
                    update({
                      mediaUrl: '',
                      uploadedMediaId: undefined,
                      uploadedFileName: undefined,
                      uploadedFileSize: undefined,
                    })
                  }}
                >
                  🗑️ Remover
                </button>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">💬 Legenda</label>
              <textarea
                value={config.caption || ''}
                onChange={(e) => update({ caption: e.target.value })}
                placeholder="Legenda opcional..."
                className="w-full px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded text-xs text-white min-h-[60px]"
              />
            </div>
            <div className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
              <span className="text-[10px] text-gray-400">✍️ Simular digitando antes</span>
              <button
                onClick={() => update({ simulateTyping: !config.simulateTyping })}
                className={`w-8 h-4 rounded-full relative transition-colors ${config.simulateTyping ? 'bg-primary' : 'bg-gray-700'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${config.simulateTyping ? 'left-4.5' : 'left-0.5'}`} />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">URL do Áudio</label>
              <input
                type="text"
                value={config.mediaUrl || ''}
                onChange={(e) => update({ mediaUrl: e.target.value, uploadedMediaId: undefined })}
                placeholder="https://exemplo.com/audio.mp3"
                className="w-full px-3 py-2 bg-[#0d0d0d] border border-gray-700 rounded text-xs text-white"
                disabled={!!config.uploadedMediaId}
              />
            </div>

            {/* File upload section for Audio */}
            {!config.uploadedMediaId ? (
              <div className="mt-3">
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 h-px bg-gray-700"></div>
                  <span className="text-xs text-gray-500">ou</span>
                  <div className="flex-1 h-px bg-gray-700"></div>
                </div>
                <label className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#151515] border border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-primary hover:bg-[#1a1a1a] transition-colors">
                  <span className="text-sm text-gray-300">📎 Upload de arquivo</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".mp3,.ogg,.aac"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return

                      if (file.size > (10 * 1024 * 1024)) {
                        alert(`Arquivo muito grande. Máximo para áudio: 10MB`)
                        e.target.value = ''
                        return
                      }

                      try {
                        const formData = new FormData()
                        formData.append('file', file)
                        const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '')
                        const token = localStorage.getItem('n9n_token')
                        const headers: HeadersInit = {}
                        if (token) {
                          headers['Authorization'] = `Bearer ${token}`
                        }
                        const res = await fetch(
                          `${API_URL}/media/upload?tenantId=${tenantId}&mediaType=audio&nodeId=${node?.id}&workflowId=${(node as any)?.workflowId || ''}`,
                          { method: 'POST', headers, body: formData }
                        )

                        if (!res.ok) {
                          const err = await res.json()
                          alert(err.message || 'Erro ao fazer upload')
                          e.target.value = ''
                          return
                        }

                        const data = await res.json()
                        update({
                          mediaUrl: data.url,
                          uploadedMediaId: data.id,
                          uploadedFileName: data.originalName,
                          uploadedFileSize: data.size,
                        })
                      } catch (err) {
                        alert('Erro ao fazer upload do arquivo')
                      }
                      e.target.value = ''
                    }}
                  />
                </label>
                <p className="text-xs text-gray-500 mt-1.5">MP3, OGG, AAC — máx 10MB</p>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-3 px-4 py-3 bg-[#1a1a2e] border border-primary/30 rounded-lg">
                <span className="text-xl">🎵</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{config.uploadedFileName || 'Arquivo'}</p>
                  <p className="text-xs text-gray-500">
                    {config.uploadedFileSize ? `${(config.uploadedFileSize / 1024).toFixed(1)} KB` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                  onClick={async () => {
                    try {
                      if (tenantId && config.uploadedMediaId) {
                        const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '')
                        const token = localStorage.getItem('n9n_token')
                        const headers: HeadersInit = {}
                        if (token) {
                          headers['Authorization'] = `Bearer ${token}`
                        }
                        await fetch(`${API_URL}/media/${config.uploadedMediaId}?tenantId=${tenantId}`, { method: 'DELETE', headers })
                      }
                    } catch (e) { /* ignore */ }
                    update({
                      mediaUrl: '',
                      uploadedMediaId: undefined,
                      uploadedFileName: undefined,
                      uploadedFileSize: undefined,
                    })
                  }}
                >
                  🗑️ Remover
                </button>
              </div>
            )}

            <div className="flex items-center justify-between p-2 bg-black/40 rounded-lg border border-primary/20">
              <span className="text-[10px] text-primary font-bold">🎤 Enviar como PTT (Gravado na hora)</span>
              <button
                onClick={() => update({ sendAudioAsVoice: !config.sendAudioAsVoice })}
                className={`w-8 h-4 rounded-full relative transition-colors ${config.sendAudioAsVoice ? 'bg-primary' : 'bg-gray-700'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${config.sendAudioAsVoice ? 'left-4.5' : 'left-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
              <span className="text-[10px] text-gray-400">🎙️ Simular gravando antes</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={config.recordingDuration || 3}
                  onChange={(e) => update({ recordingDuration: parseInt(e.target.value) })}
                  className="w-12 bg-[#0d0d0d] border border-gray-700 rounded px-1.5 py-0.5 text-[10px] text-white text-center"
                />
                <button
                  onClick={() => update({ simulateRecording: !config.simulateRecording })}
                  className={`w-8 h-4 rounded-full relative transition-colors ${config.simulateRecording ? 'bg-primary' : 'bg-gray-700'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${config.simulateRecording ? 'left-4.5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GrupoWaitConfig({ config, setConfig }: any) {
  const [activeTab, setActiveTab] = useState<'params' | 'config'>('params');

  const updateMode = (mode: string) => {
    setConfig({
      ...config,
      mode,
      // Reset mode-specific fields
      daysAfter: mode === 'days_after' ? (config.daysAfter || 0) : config.daysAfter,
      time: (mode === 'days_after' || mode === 'fixed_time' || mode === 'datetime') ? (config.time || '09:00') : config.time,
      date: (mode === 'datetime' && !config.date) ? new Date().toISOString().split('T')[0] : config.date,
      intervalAmount: mode === 'interval' ? (config.intervalAmount || 1) : config.intervalAmount,
      intervalUnit: mode === 'interval' ? (config.intervalUnit || 'hours') : config.intervalUnit
    });
  };

  const getPreviewText = () => {
    if (config.mode === 'days_after') {
      return `▶️ Retoma no Dia ${config.daysAfter || 0} às ${config.time || '09:00'}`;
    }
    if (config.mode === 'fixed_time') {
      return `▶️ Retoma amanhã às ${config.time || '09:00'}`;
    }
    if (config.mode === 'datetime') {
      const d = config.date ? config.date.split('-').reverse().join('/') : '--/--/----';
      return `▶️ Retoma em ${d} às ${config.time || '09:00'}`;
    }
    if (config.mode === 'interval') {
      return `▶️ Retoma em ${config.intervalAmount || 1} ${config.intervalUnit === 'days' ? 'dia(s)' : 'hora(s)'}`;
    }
    return '▶️ Configuração pendente';
  };

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-700 mb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('params')}
          className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'params' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-200'}`}
        ><span>📝</span> Parâmetros</button>
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'config' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-200'}`}
        ><span>⚙️</span> Configurações</button>
      </div>

      {activeTab === 'params' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-200">Modo de Espera</label>
            <select
              value={config.mode || 'days_after'}
              onChange={(e) => updateMode(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
            >
              <option value="days_after">📅 Dias após início do grupo</option>
              <option value="fixed_time">🕐 Próximo horário fixo</option>
              <option value="datetime">📆 Data e hora específica</option>
              <option value="interval">⏱️ Intervalo simples</option>
            </select>
          </div>

          {config.mode === 'days_after' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">⏳ Aguardar até o dia</label>
                <input
                  type="number"
                  min="0"
                  value={config.daysAfter ?? 2}
                  onChange={(e) => setConfig({ ...config, daysAfter: parseInt(e.target.value) || 0 })}
                  placeholder="2"
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                />
                <p className="text-xs text-gray-500 mt-1">Retomar no dia X após ativação no grupo</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">🕐 às</label>
                <input
                  type="time"
                  value={config.time || '09:00'}
                  onChange={(e) => setConfig({ ...config, time: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                />
              </div>
            </div>
          )}

          {config.mode === 'fixed_time' && (
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">Retomar às</label>
              <input
                type="time"
                value={config.time || '09:00'}
                onChange={(e) => setConfig({ ...config, time: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
              />
              <p className="text-xs text-gray-500 mt-1">Aguarda até o próximo horário fixo do dia</p>
            </div>
          )}

          {config.mode === 'datetime' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">Data</label>
                <input
                  type="date"
                  value={config.date || ''}
                  onChange={(e) => setConfig({ ...config, date: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">Hora</label>
                <input
                  type="time"
                  value={config.time || '09:00'}
                  onChange={(e) => setConfig({ ...config, time: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                />
              </div>
            </div>
          )}

          {config.mode === 'interval' && (
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2 text-gray-200">Aguardar</label>
                <input
                  type="number"
                  min="1"
                  value={config.intervalAmount || 1}
                  onChange={(e) => setConfig({ ...config, intervalAmount: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2 text-gray-200">Unidade</label>
                <select
                  value={config.intervalUnit || 'hours'}
                  onChange={(e) => setConfig({ ...config, intervalUnit: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                >
                  <option value="hours">Horas</option>
                  <option value="days">Dias</option>
                </select>
              </div>
            </div>
          )}

          <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-sm font-medium text-primary flex items-center gap-2">
              {getPreviewText()}
            </p>
          </div>
        </div>
      )}

      {activeTab === 'config' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <label className="flex items-center cursor-pointer p-4 bg-[#1a1a1a] rounded border border-gray-700">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={config.cancelIfLeftGroup ?? true}
              onChange={(e) => setConfig({ ...config, cancelIfLeftGroup: e.target.checked })}
            />
            <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary relative"></div>
            <span className="ml-3 text-sm font-medium text-gray-200">🔕 Cancelar se grupo sair</span>
          </label>

          <label className="flex items-center cursor-pointer p-4 bg-[#1a1a1a] rounded border border-gray-700">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={config.notifyOnResume ?? false}
              onChange={(e) => setConfig({ ...config, notifyOnResume: e.target.checked })}
            />
            <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary relative"></div>
            <span className="ml-3 text-sm font-medium text-gray-200">📝 Notificar quando retomar</span>
          </label>
        </div>
      )}
    </div>
  );
}

function ConditionConfig({ config, setConfig }: any) {
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-200">Conditions</h3>
          <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded font-mono">
            {config.expression || 'no expression'}
          </span>
        </div>

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
                <p className="text-[10px] text-gray-500 mt-1">Separate multiple values with commas</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
        <p className="text-[11px] text-blue-300 leading-relaxed">
          💡 <strong>Tip:</strong> Use variables like <code className="bg-blue-500/20 px-1 rounded">variables.key</code> or <code className="bg-blue-500/20 px-1 rounded">contactTags</code> for dynamic evaluations.
        </p>
      </div>
    </div>
  )
}

function RandomizerConfig({ config, setConfig }: any) {
  const saidas = config.saidas || [
    { id: '1', nome: 'Saída A', porcentagem: 50 },
    { id: '2', nome: 'Saída B', porcentagem: 50 }
  ]

  const totalPorcentagem = saidas.reduce((acc: number, s: any) => acc + s.porcentagem, 0)

  const addSaida = () => {
    if (saidas.length >= 10) return
    const newSaida = {
      id: Date.now().toString(),
      nome: `Saída ${String.fromCharCode(65 + saidas.length)}`,
      porcentagem: 0
    }
    setConfig({ ...config, saidas: [...saidas, newSaida] })
  }

  const removeSaida = (id: string) => {
    if (saidas.length <= 2) return
    setConfig({ ...config, saidas: saidas.filter((s: any) => s.id !== id) })
  }

  const updateSaida = (id: string, field: string, value: any) => {
    setConfig({
      ...config,
      saidas: saidas.map((s: any) => s.id === id ? { ...s, [field]: value } : s)
    })
  }

  const distribuirIgualmente = () => {
    const total = saidas.length
    const base = Math.floor(100 / total)
    const resto = 100 % total
    setConfig({
      ...config,
      saidas: saidas.map((s: any, i: number) => ({
        ...s,
        porcentagem: i < resto ? base + 1 : base
      }))
    })
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-200">🎯 Saídas e Distribuição</h3>
          <button
            onClick={addSaida}
            disabled={saidas.length >= 10}
            className="px-3 py-1.5 bg-primary text-black rounded text-xs font-semibold hover:bg-primary/80 transition disabled:opacity-50"
          >
            + Adicionar Saída
          </button>
        </div>

        {/* Visual Distribution Bar */}
        <div className="h-4 w-full bg-gray-800 rounded-full overflow-hidden flex mb-6 shadow-inner border border-gray-700">
          {saidas.map((saida: any, i: number) => {
            const colors = ['bg-purple-500', 'bg-blue-500', 'bg-pink-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-violet-500', 'bg-fuchsia-500', 'bg-sky-500', 'bg-emerald-500', 'bg-rose-500']
            return (
              <div
                key={saida.id}
                title={`${saida.nome}: ${saida.porcentagem}%`}
                className={`${colors[i % colors.length]} transition-all duration-300 h-full`}
                style={{ width: `${saida.porcentagem}%` }}
              />
            )
          })}
        </div>

        <div className="space-y-4">
          {saidas.map((saida: any, index: number) => (
            <div key={saida.id} className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-3 group relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400">
                  {String.fromCharCode(65 + index)}
                </div>
                <input
                  type="text"
                  value={saida.nome}
                  onChange={(e) => updateSaida(saida.id, 'nome', e.target.value)}
                  placeholder="Nome da saída"
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-white font-medium p-0"
                />
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${totalPorcentagem === 100 ? 'text-primary' : 'text-red-400'}`}>
                    {saida.porcentagem}%
                  </span>
                  <button
                    onClick={() => removeSaida(saida.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-red-400 transition"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                value={saida.porcentagem}
                onChange={(e) => updateSaida(saida.id, 'porcentagem', parseInt(e.target.value))}
                className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between p-3 bg-black/40 rounded-lg border border-gray-800">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Total Acumulado</span>
            <span className={`text-xl font-black ${totalPorcentagem === 100 ? 'text-primary' : 'text-red-400'}`}>
              {totalPorcentagem}%
            </span>
          </div>
          <button
            onClick={distribuirIgualmente}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-xs font-bold transition flex items-center gap-2 border border-gray-700"
          >
            ⚖️ Distribuir Igualmente
          </button>
        </div>
        {totalPorcentagem !== 100 && (
          <p className="text-[10px] text-red-400 mt-2 text-center animate-pulse">
            ⚠️ A soma das porcentagens deve ser exatamente 100%
          </p>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-200 px-1">⚙️ Configurações Avançadas</h3>

        <div className="bg-[#151515] border border-gray-700 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-200 font-medium">Fixar saída por contato</p>
              <p className="text-[11px] text-gray-500">Garante que o mesmo contato sempre caia na mesma saída (A/B Test)</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, fixarPorContato: !config.fixarPorContato })}
              className={`w-10 h-5 rounded-full transition-colors relative ${config.fixarPorContato ? 'bg-primary' : 'bg-gray-700'}`}
            >
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${config.fixarPorContato ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          {config.fixarPorContato && (
            <div className="pt-2 border-t border-gray-800">
              <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase">Resetar consistência:</label>
              <select
                value={config.resetPeriod || 'never'}
                onChange={(e) => setConfig({ ...config, resetPeriod: e.target.value })}
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded text-[11px] text-white focus:outline-none focus:border-primary"
              >
                <option value="never">Nunca (Sempre a mesma saída)</option>
                <option value="daily">Diariamente</option>
                <option value="weekly">Semanalmente</option>
                <option value="monthly">Mensalmente</option>
              </select>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-gray-800">
            <div>
              <p className="text-sm text-gray-200 font-medium">Habilitar Analytics</p>
              <p className="text-[11px] text-gray-500">Registra estatísticas de distribuição no banco de dados</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, enableAnalytics: !config.enableAnalytics })}
              className={`w-10 h-5 rounded-full transition-colors relative ${config.enableAnalytics ? 'bg-primary' : 'bg-gray-700'}`}
            >
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${config.enableAnalytics ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          <div className="pt-2 border-t border-gray-800">
            <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wide">Salvar saída na variável:</label>
            <input
              type="text"
              value={config.saveAs || ''}
              onChange={(e) => setConfig({ ...config, saveAs: e.target.value })}
              placeholder="ex: saida_escolhida"
              className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary font-mono"
            />
            <p className="text-[10px] text-gray-500 mt-1.5">O nome da saída (ex: &quot;Saída A&quot;) será salvo nesta variável.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function PromoMLConfig({ config, setConfig }: any) {
  const [activeTab, setActiveTab] = useState<'params' | 'filters' | 'message'>('params');

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-700 mb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'params', label: 'Parâmetros', icon: '🔍' },
          { id: 'filters', label: 'Filtros', icon: '🏷️' },
          { id: 'message', label: 'Mensagem', icon: '💬' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-400 hover:text-gray-200'
              }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'params' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-200">🔍 Termo de busca</label>
            <DroppableInput
              value={config.searchTerm || ''}
              onChange={(e: any) => setConfig({ ...config, searchTerm: e.target.value })}
              placeholder="Ex: batedeira, airfryer, confeitaria"
              className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
            />
            <p className="text-[10px] text-gray-500 mt-1">Palavra-chave para buscar no Mercado Livre</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-200">📂 Categoria</label>
            <select
              value={config.category || 'Todos'}
              onChange={(e) => setConfig({ ...config, category: e.target.value })}
              className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
            >
              <option value="Todos">Todas as Categorias</option>
              <option value="Confeitaria/Alimentos">Confeitaria / Alimentos</option>
              <option value="Eletrônicos">Eletrônicos</option>
              <option value="Casa e Jardim">Casa e Jardim</option>
              <option value="Moda">Moda</option>
              <option value="Esportes">Esportes</option>
              <option value="Beleza">Beleza</option>
              <option value="Informática">Informática</option>
              <option value="Automotivo">Automotivo</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-200">🔢 Quantidade máxima de produtos</label>
            <input
              type="number"
              value={config.maxQuantity || 5}
              onChange={(e) => setConfig({ ...config, maxQuantity: parseInt(e.target.value) || 1 })}
              className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
              min="1"
              max="20"
            />
          </div>
        </div>
      )}

      {activeTab === 'filters' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-200">⭐ Avaliação mínima</label>
              <input
                type="number"
                value={config.minRating || 4}
                onChange={(e) => setConfig({ ...config, minRating: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                min="0"
                max="5"
                step="0.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-200">🏷️ Desconto mín. (%)</label>
              <input
                type="number"
                value={config.minDiscount ?? 10}
                onChange={(e) => setConfig({ ...config, minDiscount: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                min="0"
                max="99"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-200">💬 Avaliações mínimas</label>
            <input
              type="number"
              value={config.minReviews ?? 0}
              onChange={(e) => setConfig({ ...config, minReviews: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
              min="0"
              placeholder="0 = sem filtro"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-[#151515] border border-gray-700 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-200">💎 Melhores valores</p>
              <p className="text-xs text-gray-500">Priorizar produtos com menor preço</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, bestValue: !config.bestValue })}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${config.bestValue ? 'bg-primary' : 'bg-gray-600'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${config.bestValue ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-[#151515] border border-gray-700 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-200">🚫 Ignorar enviados hoje</p>
              <p className="text-xs text-gray-500">Não enviar produtos que já foram enviados nas últimas 24h</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, ignoreAlreadySent: !config.ignoreAlreadySent })}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${config.ignoreAlreadySent ? 'bg-primary' : 'bg-gray-600'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${config.ignoreAlreadySent ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </div>
      )}

      {activeTab === 'message' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-200">🔖 Tag de afiliado</label>
            <input
              type="text"
              value={config.affiliateTag || ''}
              onChange={(e) => setConfig({ ...config, affiliateTag: e.target.value })}
              placeholder="Ex: minha-tag-20"
              className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white font-mono"
            />
            <p className="text-[10px] text-gray-500 mt-1">Será anexado ao link do produto</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-200">📝 Texto introdutório</label>
            <DroppableInput
              type="textarea"
              value={config.introText || ''}
              onChange={(e: any) => setConfig({ ...config, introText: e.target.value })}
              placeholder="Ex: 🔥 OFERTA IMPERDÍVEL ENCONTRADA!"
              className="w-full px-4 py-2 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-200">🦶 Rodapé da mensagem</label>
            <DroppableInput
              type="textarea"
              value={config.footerText || ''}
              onChange={(e: any) => setConfig({ ...config, footerText: e.target.value })}
              placeholder="Ex: ✅ Link verificado e seguro."
              className="w-full px-4 py-2 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-200">⏱️ Intervalo (seg)</label>
              <input
                type="number"
                value={config.messageInterval || 3}
                onChange={(e) => setConfig({ ...config, messageInterval: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-200">💾 Salvar como</label>
              <input
                type="text"
                value={config.saveResponseAs || 'mlProducts'}
                onChange={(e) => setConfig({ ...config, saveResponseAs: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white font-mono"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Component for TRIGGER_MANUAL configuration
function TriggerManualConfig({ config, setConfig, tenantId, sessions, loading }: any) {
  const [groups, setGroups] = useState<any[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [activeTab, setActiveTab] = useState<'params' | 'settings'>('params')

  useEffect(() => {
    if (config.destinationType === 'group' && config.sessionId) {
      loadGroups()
    }
  }, [config.destinationType, config.sessionId])

  const loadGroups = async () => {
    try {
      setLoadingGroups(true)
      const data = await apiClient.getWhatsappGroups(config.sessionId)
      setGroups(data || [])
    } catch (error) {
      console.error('Error loading groups:', error)
    } finally {
      setLoadingGroups(false)
    }
  }

  const addVariable = () => {
    const vars = config.customVariables || []
    setConfig({
      ...config,
      customVariables: [...vars, { key: '', value: '' }]
    })
  }

  const updateVariable = (index: number, field: 'key' | 'value', val: string) => {
    const vars = [...(config.customVariables || [])]
    vars[index][field] = val
    setConfig({ ...config, customVariables: vars })
  }

  const removeVariable = (index: number) => {
    const vars = (config.customVariables || []).filter((_: any, i: number) => i !== index)
    setConfig({ ...config, customVariables: vars })
  }

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-700 mb-2">
        <button
          onClick={() => setActiveTab('params')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'params' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-200'}`}
        >
          Parâmetros
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'settings' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-200'}`}
        >
          Configurações
        </button>
      </div>

      {activeTab === 'params' ? (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-200">Tipo de Destino</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfig({ ...config, destinationType: 'individual' })}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded border text-sm font-medium transition ${config.destinationType !== 'group' ? 'bg-primary/20 border-primary text-primary' : 'bg-[#151515] border-gray-700 text-gray-400 hover:border-gray-600'}`}
              >
                👤 Individual
              </button>
              <button
                onClick={() => setConfig({ ...config, destinationType: 'group' })}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded border text-sm font-medium transition ${config.destinationType === 'group' ? 'bg-primary/20 border-primary text-primary' : 'bg-[#151515] border-gray-700 text-gray-400 hover:border-gray-600'}`}
              >
                👥 Grupo
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-200">Sessão WhatsApp</label>
            <select
              value={config.sessionId || ''}
              onChange={(e) => setConfig({ ...config, sessionId: e.target.value })}
              className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
              disabled={loading}
            >
              <option value="">Selecione uma sessão</option>
              {sessions.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} ({s.phoneNumber})</option>
              ))}
            </select>
          </div>

          {config.destinationType === 'group' ? (
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">Selecione o Grupo</label>
              <div className="relative">
                <select
                  value={config.groupJid || ''}
                  onChange={(e) => {
                    const group = groups.find(g => g.id === e.target.value)
                    setConfig({ ...config, groupJid: e.target.value, groupName: group?.name || '' })
                  }}
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white appearance-none"
                  disabled={loadingGroups || !config.sessionId}
                >
                  <option value="">{loadingGroups ? 'Carregando grupos...' : 'Selecione um grupo'}</option>
                  {groups.map((g: any) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                  ▼
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1.5">
                <span>📍</span> Grupos em que a sessão selecionada participa
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">WhatsApp Destino</label>
                <input
                  type="text"
                  value={config.phoneNumber || ''}
                  onChange={(e) => setConfig({ ...config, phoneNumber: e.target.value })}
                  placeholder="5511999999999"
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">Nome do Contato</label>
                <input
                  type="text"
                  value={config.contactName || ''}
                  onChange={(e) => setConfig({ ...config, contactName: e.target.value })}
                  placeholder="Nome para {{contact.name}}"
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-600"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
          <div className="flex items-center justify-between p-4 bg-[#151515] border border-gray-700 rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-200">Permitir Redisparo</p>
              <p className="text-xs text-gray-500 pr-4">Permite iniciar o fluxo mesmo se já houver uma execução ativa para o contato</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, allowRedisparo: !config.allowRedisparo })}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${config.allowRedisparo ? 'bg-primary' : 'bg-gray-600'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${config.allowRedisparo ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-200">Delay Inicial (segundos)</label>
            <input
              type="number"
              value={config.initialDelay || 0}
              onChange={(e) => setConfig({ ...config, initialDelay: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
              min="0"
            />
            <p className="text-xs text-gray-500 mt-1.5">Tempo de espera antes de começar a execução</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-200">Variáveis Customizadas</label>
              <button
                onClick={addVariable}
                className="text-xs font-semibold text-primary hover:text-primary/80 bg-primary/10 px-2 py-1 rounded"
              >
                + Adicionar
              </button>
            </div>
            {(!config.customVariables || config.customVariables.length === 0) ? (
              <div className="text-center py-6 border border-dashed border-gray-700 rounded-lg">
                <p className="text-xs text-gray-500">Nenhuma variável customizada adicionada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {config.customVariables.map((v: any, i: number) => (
                  <div key={i} className="flex gap-2 group">
                    <input
                      placeholder="Chave"
                      value={v.key}
                      onChange={(e) => updateVariable(i, 'key', e.target.value)}
                      className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded text-sm text-white focus:border-primary/50 outline-none"
                    />
                    <input
                      placeholder="Valor"
                      value={v.value}
                      onChange={(e) => updateVariable(i, 'value', e.target.value)}
                      className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded text-sm text-white focus:border-primary/50 outline-none"
                    />
                    <button
                      onClick={() => removeVariable(i)}
                      className="text-gray-500 hover:text-red-400 p-2 transition-colors"
                      title="Remover"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MencionarTodosConfig({ config, setConfig, tenantId, node }: any) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5 text-gray-200">💬 Mensagem</label>
        <MessageComposer
          value={config.mensagem}
          onChange={(val) => setConfig({ ...config, mensagem: val })}
          placeholder="Ex: Pessoal, olhem essa oferta imperdível!"
          tenantId={tenantId}
          node={node}
        />
        <p className="text-[10px] text-gray-500 mt-1">A mensagem será enviada mencionando todos os membros.</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-gray-200">⏳ Mensagem Final (Opcional)</label>
        <MessageComposer
          value={config.mensagemFinal}
          onChange={(val) => setConfig({ ...config, mensagemFinal: val })}
          placeholder="Ex: OFERTA ENCERRADA! Obrigado a todos..."
          tenantId={tenantId}
          node={node}
        />
        <p className="text-[10px] text-gray-500 mt-1">A mensagem será enviada mencionando todos os membros.</p>
      </div>

      <div className="flex items-center justify-between p-4 bg-[#151515] border border-gray-700 rounded-lg">
        <div>
          <p className="text-sm font-medium text-gray-200">🛡️ Incluir Admins?</p>
          <p className="text-xs text-gray-500">Se desativado, apenas membros comuns serão mencionados</p>
        </div>
        <button
          onClick={() => setConfig({ ...config, incluirAdmins: !config.incluirAdmins })}
          className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${config.incluirAdmins ? 'bg-primary' : 'bg-gray-600'}`}
        >
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${config.incluirAdmins ? 'left-6' : 'left-1'}`} />
        </button>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <p className="text-xs text-yellow-500">
          ⚠️ **Anti-Ban:** Este node possui um limite automático de 1 menção por hora por grupo para evitar SPAM e bloqueios.
        </p>
      </div>
    </div>
  );
}

function EnqueteGrupoConfig({ config, setConfig }: any) {
  const addOption = () => {
    const opcoes = [...(config.opcoes || []), ''];
    setConfig({ ...config, opcoes });
  };

  const updateOption = (index: number, value: string) => {
    const opcoes = [...(config.opcoes || [])];
    opcoes[index] = value;
    setConfig({ ...config, opcoes });
  };

  const removeOption = (index: number) => {
    const opcoes = (config.opcoes || []).filter((_: any, i: number) => i !== index);
    setConfig({ ...config, opcoes });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5 text-gray-200">📊 Pergunta da Enquete</label>
        <input
          type="text"
          value={config.pergunta || ''}
          onChange={(e) => setConfig({ ...config, pergunta: e.target.value })}
          placeholder="Ex: Qual produto você mais gostou?"
          className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-200">🔘 Opções</label>
        {(config.opcoes || []).map((opt: string, i: number) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              className="flex-1 px-3 py-2 bg-[#151515] border border-gray-700 rounded text-sm text-white"
            />
            <button onClick={() => removeOption(i)} className="p-2 text-red-500 hover:bg-red-500/10 rounded">✕</button>
          </div>
        ))}
        <button
          onClick={addOption}
          className="w-full py-2 border border-dashed border-gray-600 rounded text-xs text-gray-400 hover:border-primary hover:text-primary transition-colors"
        >
          + Adicionar Opção
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center justify-between p-3 bg-[#151515] border border-gray-700 rounded-lg">
          <span className="text-xs text-gray-300">Múltipla escolha?</span>
          <button
            onClick={() => setConfig({ ...config, multiplas: !config.multiplas })}
            className={`w-9 h-5 rounded-full relative ${config.multiplas ? 'bg-primary' : 'bg-gray-600'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${config.multiplas ? 'left-4.5' : 'left-0.5'}`} />
          </button>
        </div>
        <div className="flex items-center justify-between p-3 bg-[#151515] border border-gray-700 rounded-lg">
          <span className="text-xs text-gray-300">Mencionar todos?</span>
          <button
            onClick={() => setConfig({ ...config, mencionarTodos: !config.mencionarTodos })}
            className={`w-9 h-5 rounded-full relative ${config.mencionarTodos ? 'bg-primary' : 'bg-gray-600'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${config.mencionarTodos ? 'left-4.5' : 'left-0.5'}`} />
          </button>
        </div>
      </div>
    </div>
  );
}


function PromoMLApiConfig({ config, setConfig }: any) {
  const [activeTab, setActiveTab] = useState<'params' | 'filters' | 'message'>('params');

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-700 mb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'params', label: 'Busca', icon: '🔍' },
          { id: 'filters', label: 'Filtros', icon: '⚙️' },
          { id: 'message', label: 'Mensagens', icon: '💬' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-400 hover:text-gray-200'
              }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'params' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-200">🔍 Termo de busca</label>
            <input
              type="text"
              value={config.searchTerm || ''}
              onChange={(e) => setConfig({ ...config, searchTerm: e.target.value })}
              placeholder="Ex: batedeira, airfryer..."
              className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-200">📂 Categoria (ID)</label>
            <input
              type="text"
              value={config.category || ''}
              onChange={(e) => setConfig({ ...config, category: e.target.value })}
              placeholder="Ex: MLA1051"
              className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-200">🔢 Quantidade Máxima</label>
            <input
              type="number"
              value={config.maxQuantity || 5}
              onChange={(e) => setConfig({ ...config, maxQuantity: parseInt(e.target.value) })}
              className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded text-white"
            />
          </div>
        </div>
      )}

      {activeTab === 'filters' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-200">⭐ Nota Mínima</label>
              <input
                type="number"
                step="0.1"
                value={config.minRating || 4.5}
                onChange={(e) => setConfig({ ...config, minRating: parseFloat(e.target.value) })}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-200">🏷️ Desconto Mín. %</label>
              <input
                type="number"
                value={config.minDiscount || 10}
                onChange={(e) => setConfig({ ...config, minDiscount: parseInt(e.target.value) })}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded text-white"
              />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-[#151515] border border-gray-700 rounded-lg">
            <span className="text-sm text-gray-300">Ignorar já enviados</span>
            <button
              onClick={() => setConfig({ ...config, ignoreAlreadySent: !config.ignoreAlreadySent })}
              className={`w-9 h-5 rounded-full relative ${config.ignoreAlreadySent ? 'bg-primary' : 'bg-gray-600'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${config.ignoreAlreadySent ? 'left-4.5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      )}

      {activeTab === 'message' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-200">📝 Texto de Intro</label>
            <textarea
              value={config.introText || ''}
              onChange={(e) => setConfig({ ...config, introText: e.target.value })}
              className="w-full px-3 py-2 bg-[#151515] border border-gray-700 rounded text-sm text-white h-20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-200">🔗 Tag de Afiliado</label>
            <input
              type="text"
              value={config.affiliateTag || ''}
              onChange={(e) => setConfig({ ...config, affiliateTag: e.target.value })}
              className="w-full px-3 py-2 bg-[#151515] border border-gray-700 rounded text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-200">⏱️ Intervalo (segundos)</label>
            <input
              type="number"
              value={config.messageInterval || 5}
              onChange={(e) => setConfig({ ...config, messageInterval: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-[#151515] border border-gray-700 rounded text-sm text-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}


function PromoShopeeConfig({ config, setConfig }: any) {
  const [activeTab, setActiveTab] = useState<'busca' | 'filtros' | 'mensagem' | 'avancado'>('busca');

  return (
    <div className="space-y-6">
      <div className="bg-[#2e1a0e] border border-orange-700/30 rounded-lg p-4 flex items-start gap-3">
        <div className="text-3xl">🟠</div>
        <div>
          <h3 className="text-sm font-semibold text-white mb-1">Ofertas Shopee</h3>
          <p className="text-xs text-gray-400">
            Busca produtos com desconto via API Afiliados da Shopee e envia direto no WhatsApp com link de afiliado.
          </p>
        </div>
      </div>

      {/* API credentials hint */}
      <a
        href="/settings/apis"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg hover:bg-primary/10 transition-colors group"
      >
        <span className="text-lg">🔑</span>
        <div className="flex-1">
          <p className="text-xs font-semibold text-primary">Credenciais configuradas em Configurações → APIs</p>
          <p className="text-[10px] text-gray-500">Clique para configurar seu AppID e Secret da Shopee Affiliate.</p>
        </div>
        <span className="text-primary text-xs opacity-0 group-hover:opacity-100 transition-opacity">→</span>
      </a>

      <div className="flex border-b border-gray-700 overflow-x-auto no-scrollbar">
        {[
          { id: 'busca', label: 'Busca', icon: '🔍' },
          { id: 'filtros', label: 'Filtros', icon: '⚙️' },
          { id: 'mensagem', label: 'Mensagem', icon: '💬' },
          { id: 'avancado', label: 'Avançado', icon: '🛡️' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id ? 'text-orange-400 border-b-2 border-orange-400' : 'text-gray-400 hover:text-gray-200'}`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'busca' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-200">Termo de Busca</label>
            <input
              type="text"
              value={config.searchTerm || ''}
              onChange={(e) => setConfig({ ...config, searchTerm: e.target.value })}
              placeholder="Ex: fone bluetooth, airfryer, samsung..."
              className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-orange-500 text-white placeholder-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">Suporta variáveis: {`{{keyword}}`}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-200">Categoria</label>
            <select
              value={config.catId || 0}
              onChange={(e) => setConfig({ ...config, catId: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-orange-500 text-white"
            >
              <option value={0}>Todas as categorias</option>
              <option value={100013}>📱 Celulares e Telefonia</option>
              <option value={11000582}>💻 Eletrônicos</option>
              <option value={100010}>🖥️ Informática</option>
              <option value={100015}>🏠 Casa e Decoração</option>
              <option value={100006}>💄 Beleza e Cuidado Pessoal</option>
              <option value={100008}>👗 Moda Feminina</option>
              <option value={100009}>👔 Moda Masculina</option>
              <option value={100019}>⚽ Esportes e Lazer</option>
              <option value={100007}>🧸 Brinquedos e Bebê</option>
              <option value={100003}>🍕 Alimentos e Bebidas</option>
              <option value={100018}>🔧 Ferramentas e Construção</option>
              <option value={100017}>🐾 Pet Shop</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-200">Ordenar por</label>
              <select
                value={config.sortType || 2}
                onChange={(e) => setConfig({ ...config, sortType: parseInt(e.target.value) })}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-orange-500 text-white"
              >
                <option value={2}>🔥 Mais Vendidos</option>
                <option value={6}>💸 Maior Desconto</option>
                <option value={5}>⭐ Maior Comissão</option>
                <option value={4}>💰 Menor Preço</option>
                <option value={3}>💰 Maior Preço</option>
                <option value={1}>🆕 Mais Recentes</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-200">Buscar da API</label>
              <input
                type="number"
                value={config.fetchLimit || 30}
                onChange={(e) => setConfig({ ...config, fetchLimit: parseInt(e.target.value) || 30 })}
                min={5}
                max={100}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-orange-500 text-white"
              />
              <p className="text-[10px] text-gray-500 mt-1">Qtd. buscada na API antes dos filtros</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-200">Enviar no máximo</label>
              <input
                type="number"
                value={config.maxQuantity || 5}
                onChange={(e) => setConfig({ ...config, maxQuantity: parseInt(e.target.value) || 5 })}
                min={1}
                max={20}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-orange-500 text-white"
              />
              <p className="text-[10px] text-gray-500 mt-1">Qtd. enviada após filtros</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'filtros' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-200">Avaliação mínima</label>
              <select
                value={config.minRating || 0}
                onChange={(e) => setConfig({ ...config, minRating: parseFloat(e.target.value) })}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-orange-500 text-white"
              >
                <option value={0}>Qualquer</option>
                <option value={3.0}>⭐ 3.0+</option>
                <option value={3.5}>⭐ 3.5+</option>
                <option value={4.0}>⭐ 4.0+</option>
                <option value={4.5}>⭐ 4.5+</option>
                <option value={4.8}>⭐ 4.8+</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-200">Desconto mínimo</label>
              <select
                value={config.minDiscount || 0}
                onChange={(e) => setConfig({ ...config, minDiscount: parseInt(e.target.value) })}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-orange-500 text-white"
              >
                <option value={0}>Qualquer</option>
                <option value={10}>10%+</option>
                <option value={20}>20%+</option>
                <option value={30}>30%+</option>
                <option value={50}>50%+</option>
                <option value={70}>70%+</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-200">Faixa de Preço R$</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">R$</span>
                <input
                  type="number"
                  value={config.minPrice || ''}
                  onChange={(e) => setConfig({ ...config, minPrice: parseFloat(e.target.value) || 0 })}
                  min={0}
                  placeholder="Mín."
                  className="w-full pl-8 pr-3 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-orange-500 text-white text-sm"
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">R$</span>
                <input
                  type="number"
                  value={config.maxPrice || ''}
                  onChange={(e) => setConfig({ ...config, maxPrice: parseFloat(e.target.value) || 0 })}
                  min={0}
                  placeholder="Máx."
                  className="w-full pl-8 pr-3 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-orange-500 text-white text-sm"
                />
              </div>
            </div>
            <p className="text-[10px] text-gray-500">Deixe em branco = sem limite de preço.</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-200">Comissão mínima</label>
            <select
              value={config.minCommission || 0}
              onChange={(e) => setConfig({ ...config, minCommission: parseInt(e.target.value) })}
              className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-orange-500 text-white"
            >
              <option value={0}>Qualquer</option>
              <option value={5}>5%+</option>
              <option value={8}>8%+</option>
              <option value={10}>10%+</option>
              <option value={15}>15%+</option>
              <option value={20}>20%+</option>
            </select>
          </div>

          <p className="text-xs text-gray-500">Todos os filtros são aplicados após a busca na API.</p>
        </div>
      )}

      {activeTab === 'mensagem' && (
        <div className="space-y-4">
          <div className="p-3 bg-[#1a1a1a] rounded-lg space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Exibir na mensagem</p>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-gray-300">⭐ Nota do produto</span>
              <input
                type="checkbox"
                checked={config.showRating !== false}
                onChange={(e) => setConfig({ ...config, showRating: e.target.checked })}
                className="w-4 h-4 accent-orange-500"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-gray-300">🛒 Quantidade vendida</span>
              <input
                type="checkbox"
                checked={!!config.showSales}
                onChange={(e) => setConfig({ ...config, showSales: e.target.checked })}
                className="w-4 h-4 accent-orange-500"
              />
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-200">Texto de Intro</label>
            <textarea
              value={config.introText || ''}
              onChange={(e) => setConfig({ ...config, introText: e.target.value })}
              placeholder="Ex: Confira as ofertas do dia na Shopee! 🛍️"
              className="w-full px-3 py-2 bg-[#151515] border border-gray-700 rounded text-sm text-white h-20 placeholder-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-200">Texto de Rodapé</label>
            <textarea
              value={config.footerText || ''}
              onChange={(e) => setConfig({ ...config, footerText: e.target.value })}
              placeholder="Ex: Aproveite! Oferta por tempo limitado. ⏰"
              className="w-full px-3 py-2 bg-[#151515] border border-gray-700 rounded text-sm text-white h-20 placeholder-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-200">Intervalo entre mensagens (seg)</label>
            <input
              type="number"
              value={config.messageInterval || 3}
              onChange={(e) => setConfig({ ...config, messageInterval: parseInt(e.target.value) || 3 })}
              min={1}
              className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-orange-500 text-white"
            />
          </div>
        </div>
      )}

      {activeTab === 'avancado' && (
        <div className="space-y-5">

          {/* 1. Anti-repetição */}
          <div className="p-4 bg-[#1a1a1a] border border-gray-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">🔁 Não repetir produtos enviados</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Evita enviar o mesmo produto duas vezes.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!config.antiRepeat}
                  onChange={(e) => setConfig({ ...config, antiRepeat: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-gray-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>
            {config.antiRepeat && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Escopo da verificação</label>
                <select
                  value={config.antiRepeatScope || 'contact'}
                  onChange={(e) => setConfig({ ...config, antiRepeatScope: e.target.value })}
                  className="w-full px-3 py-2 bg-[#151515] border border-gray-700 rounded text-sm focus:outline-none focus:border-orange-500 text-white"
                >
                  <option value="contact">Por contato/grupo — não repete para o mesmo destinatário</option>
                  <option value="global">Global no workspace — nunca repete para nenhum destinatário</option>
                </select>
              </div>
            )}
          </div>

          {/* 2. Apenas com imagem */}
          <div className="p-4 bg-[#1a1a1a] border border-gray-800 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">🖼️ Apenas produtos com imagem</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Ignora produtos sem foto disponível.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!config.requireImage}
                  onChange={(e) => setConfig({ ...config, requireImage: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-gray-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>
          </div>

          {/* 3. Salvar resultado como variável */}
          <div className="p-4 bg-[#1a1a1a] border border-gray-800 rounded-xl space-y-3">
            <div>
              <p className="text-sm font-bold text-white">📦 Salvar resultado como variável</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Armazena os produtos encontrados para uso em nodes seguintes.</p>
            </div>
            <input
              type="text"
              value={config.saveResponseAs || ''}
              onChange={(e) => setConfig({ ...config, saveResponseAs: e.target.value })}
              placeholder="Ex: shopeeProducts (deixe vazio para não salvar)"
              className="w-full px-3 py-2 bg-[#151515] border border-gray-700 rounded text-sm focus:outline-none focus:border-orange-500 text-white placeholder-gray-600"
            />
          </div>

        </div>
      )}
    </div>
  );
}

function PixelEventConfig({ config, setConfig }: any) {
  const eventTypes = [
    { value: 'Lead', label: 'Lead' },
    { value: 'QualifiedLead', label: 'Lead Qualificado' },
    { value: 'DisqualifiedLead', label: 'Lead Desqualificado' },
    { value: 'Contact', label: 'Contato' },
    { value: 'InitiateCheckout', label: 'Início de Checkout' },
    { value: 'Purchase', label: 'Compra' },
    { value: 'CompleteRegistration', label: 'Cadastro Completo' },
    { value: 'ViewContent', label: 'Visualização de Conteúdo' },
    { value: 'AddToCart', label: 'Adição ao Carrinho' },
    { value: 'Subscribe', label: 'Inscrição/Assinatura' },
    { value: 'CustomEvent', label: 'Evento Personalizado' },
  ]

  const [pixels, setPixels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPixels = async () => {
      try {
        setLoading(true)
        const data = await apiClient.getPixels()
        setPixels(data || [])

        // If config has no pixelConfigId but has pixelId, it might be an old node
        // We'll leave it as 'manual'
        if (!config.pixelConfigId && !config.pixelId) {
          const defaultPixel = data.find((p: any) => p.isDefault);
          if (defaultPixel) {
            setConfig((prev: any) => ({ ...prev, pixelConfigId: defaultPixel.id }));
          } else {
            setConfig((prev: any) => ({ ...prev, pixelConfigId: 'manual' }));
          }
        }
      } catch (e) {
        console.error('Error loading pixels:', e)
      } finally {
        setLoading(false)
      }
    }
    loadPixels()
  }, [])

  const selectedPixel = pixels.find(p => p.id === config.pixelConfigId);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex gap-3">
        <div className="bg-blue-500/20 p-2 rounded-lg h-fit">
          <Target className="text-blue-400" size={20} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-blue-300">Meta Pixel Conversions API</h4>
          <p className="text-[11px] text-blue-200/60 mt-0.5 leading-relaxed">
            Aumente a precisão do rastreamento enviando eventos diretamente do servidor (CAPI), ignorando bloqueadores de anúncios e restrições de iOS.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">
              Selecionar Pixel
            </label>
            <a href="/settings/pixel" target="_blank" className="text-[10px] text-primary font-bold hover:underline flex items-center gap-1">
              Gerenciar Pixels <ExternalLink size={10} />
            </a>
          </div>
          <select
            value={config.pixelConfigId || 'manual'}
            onChange={(e) => setConfig({ ...config, pixelConfigId: e.target.value })}
            className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded-xl focus:border-primary text-white text-sm outline-none transition-all"
          >
            <option value="manual">➕ Inserir Manualmente / Automático</option>
            {pixels.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} {p.isDefault ? '(Padrão)' : ''} — {p.pixelId.substring(0, 4)}****{p.pixelId.slice(-3)}
              </option>
            ))}
          </select>
          {!config.pixelConfigId || config.pixelConfigId === 'manual' ? (
            <p className="mt-1.5 text-[10px] text-gray-600 px-1">
              Se deixado em manual e vazio, usará o Pixel definido como <b>padrão</b> na Workspace.
            </p>
          ) : (
            <p className="mt-1.5 text-[10px] text-primary/70 px-1 font-medium">
              Usando credenciais seguras do banco. O token de acesso não é exibido aqui.
            </p>
          )}
        </div>

        {(config.pixelConfigId === 'manual' || !config.pixelConfigId) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">
                Pixel ID Manual
              </label>
              <input
                type="text"
                value={config.pixelId || ''}
                onChange={(e) => setConfig({ ...config, pixelId: e.target.value })}
                placeholder="Ex: 1234567890"
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded-xl focus:border-primary text-white text-sm outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">
                Access Token Manual
              </label>
              <input
                type="password"
                value={config.accessToken || ''}
                onChange={(e) => setConfig({ ...config, accessToken: e.target.value })}
                placeholder="EAAB..."
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded-xl focus:border-primary text-white text-sm outline-none transition-all"
              />
            </div>
          </div>
        )}

        {selectedPixel && (
          <div className="p-3 bg-white/5 border border-gray-800 rounded-xl flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <Database size={14} className="text-gray-500" />
              <span className="text-xs font-bold text-gray-400">ID Vinculado:</span>
              <span className="text-xs font-mono text-gray-200">{selectedPixel.pixelId}</span>
            </div>
            <CheckCircle2 size={16} className="text-primary" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-200 font-mono text-[10px] uppercase tracking-wider">
            Tipo de Evento
          </label>
          <select
            value={config.eventType || 'Lead'}
            onChange={(e) => setConfig({ ...config, eventType: e.target.value })}
            className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:border-primary text-white text-sm"
          >
            {eventTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        {config.eventType === 'CustomEvent' && (
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-200 font-mono text-[10px] uppercase tracking-wider">
              Nome do Evento
            </label>
            <input
              type="text"
              value={config.customEventName || ''}
              onChange={(e) => setConfig({ ...config, customEventName: e.target.value })}
              placeholder="Ex: MyCustomAction"
              className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:border-primary text-white text-sm"
            />
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2">Dados do Evento</h4>

        <div className="flex items-center justify-between p-3 bg-[#0d0d0d] border border-gray-800 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-lg">💰</span>
            <div>
              <p className="text-xs font-medium text-white">Incluir Valor</p>
              <p className="text-[10px] text-gray-500">Manda valor e moeda (atribuição de ROAS)</p>
            </div>
          </div>
          <button
            onClick={() => setConfig({ ...config, includeValue: !config.includeValue })}
            className={`w-10 h-5 rounded-full relative transition-colors ${config.includeValue ? 'bg-primary' : 'bg-gray-700'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${config.includeValue ? 'left-5.5' : 'left-0.5'}`} />
          </button>
        </div>

        {config.includeValue && (
          <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-1 duration-200">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase mb-1">Valor</label>
              <input
                type="text"
                value={config.value || ''}
                onChange={(e) => setConfig({ ...config, value: e.target.value })}
                placeholder="{{variables.valor}}"
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase mb-1">Moeda</label>
              <input
                type="text"
                value={config.currency || 'BRL'}
                onChange={(e) => setConfig({ ...config, currency: e.target.value })}
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded text-xs text-white"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between p-3 bg-[#0d0d0d] border border-gray-800 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-lg">📦</span>
            <div>
              <p className="text-xs font-medium text-white">Dados do Produto</p>
              <p className="text-[10px] text-gray-500">Nome e ID do item</p>
            </div>
          </div>
          <button
            onClick={() => setConfig({ ...config, includeProduct: !config.includeProduct })}
            className={`w-10 h-5 rounded-full relative transition-colors ${config.includeProduct ? 'bg-primary' : 'bg-gray-700'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${config.includeProduct ? 'left-5.5' : 'left-0.5'}`} />
          </button>
        </div>

        {config.includeProduct && (
          <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-1 duration-200">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase mb-1">Nome do Produto</label>
              <input
                type="text"
                value={config.productName || ''}
                onChange={(e) => setConfig({ ...config, productName: e.target.value })}
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase mb-1">ID do Produto (SKU)</label>
              <input
                type="text"
                value={config.productId || ''}
                onChange={(e) => setConfig({ ...config, productId: e.target.value })}
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded text-xs text-white"
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2">Matching (Usuário)</h4>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 p-2 bg-[#0d0d0d] border border-gray-800 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={config.includePhone !== false}
              onChange={e => setConfig({ ...config, includePhone: e.target.checked })}
              className="rounded border-gray-700 bg-black text-primary transition-all"
            />
            <span className="text-xs text-gray-300">Telefone (Hash)</span>
          </label>
          <label className="flex items-center gap-2 p-2 bg-[#0d0d0d] border border-gray-800 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={config.includeName !== false}
              onChange={e => setConfig({ ...config, includeName: e.target.checked })}
              className="rounded border-gray-700 bg-black text-primary transition-all"
            />
            <span className="text-xs text-gray-300">Nome (Hash)</span>
          </label>
          <label className="flex items-center gap-2 p-2 bg-[#0d0d0d] border border-gray-800 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={config.includeState !== false}
              onChange={e => setConfig({ ...config, includeState: e.target.checked })}
              className="rounded border-gray-700 bg-black text-primary transition-all"
            />
            <span className="text-xs text-gray-300">Estado (Hash)</span>
          </label>
          <label className="flex items-center gap-2 p-2 bg-[#0d0d0d] border border-gray-800 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={config.includeCtwaClid !== false}
              onChange={e => setConfig({ ...config, includeCtwaClid: e.target.checked })}
              className="rounded border-gray-700 bg-black text-primary transition-all"
            />
            <span className="text-xs text-gray-300">CTWA Clid (Ads)</span>
          </label>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2">Deduplicação e Teste</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">
              External Event ID (Opcional)
            </label>
            <input
              type="text"
              value={config.eventId || ''}
              onChange={(e) => setConfig({ ...config, eventId: e.target.value })}
              placeholder="Ex: {{variables.orderId}}"
              className="w-full px-4 py-2 bg-[#151515] border border-gray-700 rounded text-white text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1 text-green-500">
              Test Event Code
            </label>
            <input
              type="text"
              value={config.testEventCode || ''}
              onChange={(e) => setConfig({ ...config, testEventCode: e.target.value })}
              placeholder="TEST1234..."
              className="w-full px-4 py-2 bg-[#151515] border border-gray-700 rounded text-white text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function SequenciaLancamentoConfig({ config, setConfig, tenantId, node }: any) {
  useEffect(() => {
    if (!config.fases || config.fases.length === 0) {
      const defaultPhases = [
        { id: '1', nome: 'Aquecimento', diaInicio: 1, diaFim: 3, horario: '09:00', mensagem: { type: 'text', text: '🔥 Começamos o aquecimento! Fique atento às novidades que traremos nos próximos dias. 👀' }, mencionarTodos: true },
        { id: '2', nome: 'Abertura', diaInicio: 4, diaFim: 4, horario: '08:00', mensagem: { type: 'text', text: '🚀 AS INSCRIÇÕES ESTÃO ABERTAS! Garanta sua vaga agora pelo link: {{link}}' }, mencionarTodos: true },
        { id: '3', nome: 'Oferta', diaInicio: 5, diaFim: 6, horario: '10:00', mensagem: { type: 'text', text: '⚡ Aproveite a oferta especial de lançamento! Restam poucas vagas com desconto.' }, mencionarTodos: false },
        { id: '4', nome: 'Fechamento', diaInicio: 7, diaFim: 7, horario: '19:00', mensagem: { type: 'text', text: '⏰ ÚLTIMAS HORAS! As inscrições se encerram hoje às 23:59. Não fique de fora!' }, mencionarTodos: true },
        { id: '5', nome: 'Pós-venda', diaInicio: 8, diaFim: 10, horario: '09:00', mensagem: { type: 'text', text: '💎 Parabéns aos novos membros! Em breve iniciaremos nossa jornada juntos.' }, mencionarTodos: false },
      ];
      setConfig({ ...config, fases: defaultPhases });
    }
  }, []);

  const addFase = () => {
    const nextStart = config.fases?.length > 0 ? (config.fases[config.fases.length - 1].diaFim + 1) : 1;
    const fases = [...(config.fases || []), {
      id: Date.now().toString(),
      nome: '',
      diaInicio: nextStart,
      diaFim: nextStart,
      horario: '09:00',
      mensagem: { type: 'text', text: '' },
      mencionarTodos: false
    }];
    setConfig({ ...config, fases });
  };

  const updateFase = (index: number, field: string, value: any) => {
    const fases = [...(config.fases || [])];
    fases[index] = { ...fases[index], [field]: value };
    setConfig({ ...config, fases });
  };

  const removeFase = (index: number) => {
    const fases = config.fases.filter((_: any, idx: number) => idx !== index);
    setConfig({ ...config, fases });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-gray-200 uppercase tracking-wider">🎯 Sequência de Lançamento</label>
        <button
          onClick={addFase}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-500 border border-red-500/30 rounded-full text-xs font-semibold hover:bg-red-500/30 transition-colors"
        >
          <span>+</span> Adicionar Fase
        </button>
      </div>

      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {(config.fases || []).map((fase: any, i: number) => (
          <div key={fase.id} className="p-4 bg-[#151515] border border-gray-700 rounded-xl space-y-4 relative group">
            <button
              onClick={() => removeFase(i)}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              ×
            </button>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Nome da Fase</label>
                <input
                  type="text"
                  value={fase.nome}
                  onChange={(e) => updateFase(i, 'nome', e.target.value)}
                  placeholder="Ex: Aquecimento, Vendas..."
                  className="w-full bg-[#0d0d0d] border border-gray-700 rounded-lg px-3 py-2 text-sm font-bold text-white outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Duração (Dias)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={fase.diaInicio}
                    onChange={(e) => updateFase(i, 'diaInicio', parseInt(e.target.value))}
                    className="w-full bg-[#0d0d0d] border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-center outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <span className="text-gray-600 text-xs">à</span>
                  <input
                    type="number"
                    value={fase.diaFim}
                    onChange={(e) => updateFase(i, 'diaFim', parseInt(e.target.value))}
                    className="w-full bg-[#0d0d0d] border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-center outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Horário Envios</label>
                <input
                  type="time"
                  value={fase.horario || '09:00'}
                  onChange={(e) => updateFase(i, 'horario', e.target.value)}
                  className="w-full bg-[#0d0d0d] border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-center font-mono outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-400 uppercase mb-1">Mensagem Base</label>
              <MessageComposer
                value={fase.mensagem}
                onChange={(val: any) => updateFase(i, 'mensagem', val)}
                tenantId={tenantId}
                node={node}
              />
            </div>

            <div className="flex items-center justify-between px-3 py-2 bg-black/20 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">📣 Mencionar todos nesta fase?</span>
              </div>
              <button
                onClick={() => updateFase(i, 'mencionarTodos', !fase.mencionarTodos)}
                className={`w-10 h-5 rounded-full relative transition-colors ${fase.mencionarTodos ? 'bg-red-500' : 'bg-gray-700'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${fase.mencionarTodos ? 'left-5.5' : 'left-0.5'}`} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScheduleTriggerConfig({ config, setConfig, sessions, loading }: any) {
  const scheduleModes = [
    { id: 'datetime', label: '📅 Data e Hora Específica', desc: 'Executar uma vez em data e hora específica' },
    { id: 'daily', label: '🕐 Hora Fixa Diária', desc: 'Executar todo dia em um horário fixo' },
    { id: 'interval', label: '⏱️ Intervalo Regular', desc: 'Repetir em intervalos regulares' },
    { id: 'weekly', label: '📆 Dias da Semana Específicos', desc: 'Executar apenas nos dias selecionados' },
    { id: 'cron', label: '⚙️ Expressão Cron (Avançado)', desc: 'Configuração manual' }
  ];

  const [mode, setMode] = useState(config.scheduleMode || 'datetime');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Helper to generate Cron string from visual selections
  const regenerateCron = (newConfig: any, currentMode: string) => {
    let cron = '';
    const date = new Date(newConfig.specificDate || Date.now());
    const [hour, minute] = (newConfig.time || '09:00').split(':');

    switch (currentMode) {
      case 'datetime':
        // e.g., "0 9 25 12 *"
        cron = `${parseInt(minute)} ${parseInt(hour)} ${date.getDate()} ${date.getMonth() + 1} *`;
        break;
      case 'daily': {
        // e.g., "0 9 * * 1,3,5" or "0 9 * * *"
        const days = newConfig.selectedDays?.length ? newConfig.selectedDays.join(',') : '*';
        cron = `${parseInt(minute)} ${parseInt(hour)} * * ${days}`;
        break;
      }
      case 'interval': {
        // "A cada X horas entre H1 e H2"
        const intHours = parseInt(newConfig.intervalHours || '2');
        const [startH] = (newConfig.timeStart || '08:00').split(':');
        const [endH] = (newConfig.timeEnd || '20:00').split(':');

        const hoursList = [];
        let currentH = parseInt(startH);
        const endHourNum = parseInt(endH);

        while (currentH <= endHourNum) {
          hoursList.push(currentH);
          currentH += intHours;
        }

        if (hoursList.length === 0) hoursList.push(parseInt(startH));

        cron = `0 ${hoursList.join(',')} * * *`;
        break;
      }
      case 'weekly': {
        const days = newConfig.selectedDays?.length ? newConfig.selectedDays.join(',') : '*';
        cron = `${parseInt(minute)} ${parseInt(hour)} * * ${days}`;
        break;
      }
      case 'cron':
        cron = newConfig.cronExpression || '0 * * * *';
        break;
    }

    return cron;
  };

  const updateField = (field: string, value: any) => {
    const newConfig = { ...config, [field]: value };
    // Only auto-generate cron if we are not manually editing it
    if (mode !== 'cron') {
      newConfig.cronExpression = regenerateCron(newConfig, mode);
      newConfig.scheduleType = 'cron'; // Backend always expects cron
    }
    newConfig.scheduleMode = mode;
    setConfig(newConfig);
  };

  const handleModeChange = (newMode: string) => {
    setMode(newMode);

    // Set some sane defaults strictly when changing modes
    let newDefaults = { ...config, scheduleMode: newMode };
    if (!newDefaults.time) newDefaults.time = '09:00';
    if (!newDefaults.selectedDays) newDefaults.selectedDays = [];

    const newCron = regenerateCron(newDefaults, newMode);
    setConfig({ ...newDefaults, cronExpression: newCron, scheduleType: 'cron' });
  };

  const toggleDay = (dayIndex: number) => {
    const current = config.selectedDays || [];
    const updated = current.includes(dayIndex)
      ? current.filter((d: number) => d !== dayIndex)
      : [...current, dayIndex].sort();
    updateField('selectedDays', updated);
  };

  const daysOfWeek = [
    { label: 'Dom', val: 0 }, { label: 'Seg', val: 1 }, { label: 'Ter', val: 2 },
    { label: 'Qua', val: 3 }, { label: 'Qui', val: 4 }, { label: 'Sex', val: 5 }, { label: 'Sáb', val: 6 }
  ];

  return (
    <div className="space-y-6">
      {/* Session Selection */}
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-200">
          Sessão WhatsApp
        </label>
        <select
          value={config.sessionId || ''}
          onChange={(e) => updateField('sessionId', e.target.value)}
          className="w-full px-4 py-2 bg-[#151515] border border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-sm text-white"
          disabled={loading}
        >
          <option value="">Primeira sessão ativa</option>
          {sessions.map((session: any) => (
            <option key={session.id} value={session.id}>
              {session.name} ({session.phoneNumber})
            </option>
          ))}
        </select>
      </div>

      {/* Mode Selector */}
      <div className="bg-[#151515] p-1 rounded-lg border border-gray-800 flex flex-col gap-1">
        {scheduleModes.map(m => (
          <button
            key={m.id}
            onClick={() => handleModeChange(m.id)}
            className={`w-full text-left px-3 py-2 rounded-md transition-all flex items-start flex-col
              ${mode === m.id ? 'bg-[#252525] border-l-2 border-primary' : 'hover:bg-[#1a1a1a] border-l-2 border-transparent text-gray-400'}`}
          >
            <span className={`text-sm font-semibold ${mode === m.id ? 'text-white' : ''}`}>{m.label}</span>
            <span className="text-[10px] opacity-70 mt-0.5">{m.desc}</span>
          </button>
        ))}
      </div>

      {/* Specific Content Based on Mode */}
      <div className="p-4 bg-[#111] border border-gray-800 rounded-lg space-y-4">

        {mode === 'datetime' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Data</label>
              <input type="date" value={config.specificDate || ''} onChange={e => updateField('specificDate', e.target.value)} className="w-full bg-[#0a0a0a] border border-gray-700 rounded px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Hora</label>
              <input type="time" value={config.time || '09:00'} onChange={e => updateField('time', e.target.value)} className="w-full bg-[#0a0a0a] border border-gray-700 rounded px-3 py-2 text-sm text-white" />
            </div>
          </div>
        )}

        {(mode === 'daily' || mode === 'weekly') && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Horário</label>
              <input type="time" value={config.time || '09:00'} onChange={e => updateField('time', e.target.value)} className="w-full bg-[#0a0a0a] border border-gray-700 rounded px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Dias da Semana {mode === 'daily' && '(Opcional)'}</label>
              <div className="flex gap-1">
                {daysOfWeek.map(d => {
                  const active = (config.selectedDays || []).includes(d.val);
                  return (
                    <button
                      key={d.val}
                      onClick={() => toggleDay(d.val)}
                      className={`flex-1 py-1.5 rounded text-xs font-bold transition-colors border
                        ${active ? 'bg-primary/20 text-primary border-primary/50' : 'bg-[#0a0a0a] text-gray-500 border-gray-800 hover:border-gray-600'}`}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {mode === 'interval' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">A Cada (Horas)</label>
              <select value={config.intervalHours || '2'} onChange={e => updateField('intervalHours', e.target.value)} className="w-full bg-[#0a0a0a] border border-gray-700 rounded px-3 py-2 text-sm text-white">
                {[1, 2, 3, 4, 6, 8, 12, 24].map(h => <option key={h} value={h}>{h} Hora{h > 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-gray-800 mt-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Início</label>
                <input type="time" value={config.timeStart || '08:00'} onChange={e => updateField('timeStart', e.target.value)} className="w-full bg-[#0a0a0a] border border-gray-700 rounded px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Fim</label>
                <input type="time" value={config.timeEnd || '20:00'} onChange={e => updateField('timeEnd', e.target.value)} className="w-full bg-[#0a0a0a] border border-gray-700 rounded px-3 py-2 text-sm text-white" />
              </div>
            </div>
          </div>
        )}

        {mode === 'cron' && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest">Expressão Cron</label>
            <input type="text" value={config.cronExpression || '0 * * * *'} onChange={e => updateField('cronExpression', e.target.value)} className="w-full bg-[#0a0a0a] border border-primary/30 rounded px-3 py-2 text-sm text-white font-mono" />
          </div>
        )}
      </div>

      {/* Computed Preview */}
      <div className="flex items-center gap-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
        <span className="text-xl">⚙️</span>
        <div>
          <p className="text-xs text-indigo-300 font-semibold mb-0.5">Resultado Cron</p>
          <code className="text-xs text-white font-mono bg-black/40 px-2 py-0.5 rounded">{config.cronExpression || '* * * * *'}</code>
        </div>
      </div>
    </div>
  );
}

function GroupTriggerConfig({ config, setConfig }: any) {
  const mode = config.mode || 'days_after';

  // Inicializar com padrões
  useEffect(() => {
    if (!config.mode) {
      setConfig({
        ...config,
        mode: 'days_after',
        executions: [
          { id: crypto.randomUUID(), type: 'days_after', day: 1, time: '09:00' }
        ],
        repeatSequence: false,
        ignoreIfOffline: false
      });
    }
  }, []);

  const handleModeChange = (newMode: string) => {
    let newExecutions: any[] = [];
    let repeatSequence = false;

    if (newMode === 'days_after') {
      newExecutions = [{ id: crypto.randomUUID(), type: 'days_after', day: 1, time: '09:00' }];
    } else if (newMode === 'fixed_date') {
      newExecutions = [{ id: crypto.randomUUID(), type: 'fixed_date', date: '', time: '09:00' }];
    } else if (newMode === 'daily') {
      newExecutions = [{ id: crypto.randomUUID(), type: 'days_after', day: 1, time: '09:00' }];
      repeatSequence = true;
    } else if (newMode === 'manual') {
      newExecutions = [];
    } else if (newMode === 'immediate') {
      newExecutions = [{ id: crypto.randomUUID(), type: 'days_after', day: 0, time: '00:00' }];
    }

    setConfig({
      ...config,
      mode: newMode,
      executions: newExecutions,
      repeatSequence
    });
  };

  const executions = config.executions || [];

  const addExecution = () => {
    const defaultExec = mode === 'fixed_date'
      ? { id: crypto.randomUUID(), type: 'fixed_date', date: '', time: '10:00' }
      : mode === 'daily'
      ? { id: crypto.randomUUID(), type: 'days_after', day: 1, time: '12:00' }
      : { id: crypto.randomUUID(), type: 'days_after', day: executions.length + 1, time: '09:00' };

    setConfig({
      ...config,
      executions: [...executions, defaultExec]
    });
  };

  const removeExecution = (id: string) => {
    setConfig({
      ...config,
      executions: executions.filter((e: any) => e.id !== id)
    });
  };

  const updateExecution = (id: string, field: string, value: any) => {
    setConfig({
      ...config,
      executions: executions.map((e: any) => e.id === id ? { ...e, [field]: value } : e)
    });
  };

  const updateOnlyExecutionFields = (field: string, value: any) => {
    if (executions.length > 0) {
      updateExecution(executions[0].id, field, value);
    }
  };

  return (
    <div className="space-y-6">

      <div className="bg-[#111] border border-gray-800 rounded-lg p-4 space-y-4">
        <label className="block text-sm font-semibold text-gray-200 mb-2">
          Modo de Agendamento
        </label>
        <select
          value={mode}
          onChange={(e) => handleModeChange(e.target.value)}
          className="w-full bg-[#0a0a0a] border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
        >
          <option value="immediate">⚡ Imediato (ao vincular ao grupo)</option>
          <option value="daily">🕐 Rotina Diária (Mesmo horário sempre)</option>
          <option value="days_after">📅 Campanha (Dias após ativação)</option>
          <option value="fixed_date">📆 Lançamento (Data e Hora Fixas)</option>
          <option value="manual">🔘 Manual (Apenas via botão Testar)</option>
        </select>

        {mode !== 'manual' && (
          <div className="pt-4 border-t border-gray-800 space-y-3">
            <div className="flex items-center justify-between pb-2">
              <h3 className="text-sm font-medium text-gray-300">
                {mode === 'daily' ? 'Horários de Execução' : 'Cronograma'}
              </h3>
              {(mode === 'days_after' || mode === 'fixed_date' || mode === 'daily') && (
                <button
                  onClick={addExecution}
                  className="text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-medium px-3 py-1.5 rounded transition-colors"
                >
                  + Adicionar Horário
                </button>
              )}
            </div>

            {mode === 'daily' && executions.map((exec: any, index: number) => (
              <div key={exec.id} className="bg-[#1a1a1a] p-3 rounded border border-gray-700 relative group flex items-center gap-3">
                {executions.length > 1 && (
                  <button
                    onClick={() => removeExecution(exec.id)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500/20 hover:bg-red-500/40 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    title="Remover"
                  >
                    ✕
                  </button>
                )}
                <span className="text-xs font-bold text-gray-500 bg-black/40 px-2 py-1 rounded">#{index + 1}</span>
                <input
                  type="time"
                  value={exec.time || '09:00'}
                  onChange={(e) => updateExecution(exec.id, 'time', e.target.value)}
                  className="bg-[#0a0a0a] border border-gray-700 rounded px-2 py-1.5 text-sm text-white flex-1"
                />
              </div>
            ))}

            {(mode === 'days_after' || mode === 'fixed_date') && executions.map((exec: any, index: number) => (
              <div key={exec.id} className="bg-[#1a1a1a] p-3 rounded border border-gray-700 relative group flex gap-3 items-center">
                {executions.length > 1 && (
                  <button
                    onClick={() => removeExecution(exec.id)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500/20 hover:bg-red-500/40 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    title="Remover"
                  >
                    ✕
                  </button>
                )}

                <span className="text-xs font-bold text-gray-500 bg-black/40 px-2 py-1 rounded">#{index + 1}</span>

                {mode === 'days_after' ? (
                  <>
                    <div className="flex items-center gap-2 bg-[#0a0a0a] border border-gray-700 rounded px-2 py-1 relative flex-1">
                      <span className="text-xs text-gray-400 select-none ml-1">Dia</span>
                      <input
                        type="number"
                        min="0"
                        value={exec.day || 0}
                        onChange={(e) => updateExecution(exec.id, 'day', parseInt(e.target.value) || 0)}
                        className="bg-transparent text-white text-sm w-full outline-none"
                      />
                    </div>
                    <input
                      type="time"
                      value={exec.time || '09:00'}
                      onChange={(e) => updateExecution(exec.id, 'time', e.target.value)}
                      className="bg-[#0a0a0a] border border-gray-700 rounded px-2 py-1 text-sm text-white w-[100px]"
                    />
                  </>
                ) : (
                  <>
                    <input
                      type="date"
                      value={exec.date || ''}
                      onChange={(e) => updateExecution(exec.id, 'date', e.target.value)}
                      className="bg-[#0a0a0a] border border-gray-700 rounded px-2 py-1 text-sm text-white flex-1"
                    />
                    <input
                      type="time"
                      value={exec.time || '09:00'}
                      onChange={(e) => updateExecution(exec.id, 'time', e.target.value)}
                      className="bg-[#0a0a0a] border border-gray-700 rounded px-2 py-1 text-sm text-white w-[100px]"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 pt-2">
        {mode === 'days_after' && (
          <div className="flex items-center justify-between p-3 bg-[#151515] border border-gray-800 rounded-lg cursor-pointer select-none"
            onClick={() => setConfig({ ...config, repeatSequence: !config.repeatSequence })}>
            <div>
              <span className="text-sm font-medium text-gray-200 block">🔄 Ciclo Contínuo</span>
              <span className="text-[10px] text-gray-500">Ao final da sequência, reiniciar a contagem no grupo</span>
            </div>
            <div className={`w-10 h-6 rounded-full relative transition-colors ${config.repeatSequence ? 'bg-indigo-500' : 'bg-gray-700'}`}>
              <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${config.repeatSequence ? 'left-5' : 'left-1'}`} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between p-3 bg-[#151515] border border-gray-800 rounded-lg cursor-pointer select-none"
          onClick={() => setConfig({ ...config, ignoreIfOffline: !config.ignoreIfOffline })}>
          <div>
            <span className="text-sm font-medium text-gray-200 block">🔕 Detecção de Offline</span>
            <span className="text-[10px] text-gray-500">Pular fluxo caso o WhatsApp perca conexão</span>
          </div>
          <div className={`w-10 h-6 rounded-full relative transition-colors ${config.ignoreIfOffline ? 'bg-indigo-500' : 'bg-gray-700'}`}>
            <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${config.ignoreIfOffline ? 'left-5' : 'left-1'}`} />
          </div>
        </div>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
        <p className="text-xs text-primary leading-relaxed">
          💡 <strong>Resumo:</strong> {
            mode === 'days_after' ? "O grupo será engajado com uma sequência baseada em quantos dias possui desde sua ativação." :
              mode === 'fixed_date' ? "O grupo receberá mensagens em datas exóticas, ideal para lançamentos." :
                mode === 'daily' ? `O grupo receberá mensagens todos os dias nos horários: ${executions.map((e: any) => e.time || '09:00').join(', ')}.` :
                  "O grupo não receberá mensagens automáticas. Apenas rodará se a aba Gerenciar Grupos for ativada pelo botão Testar Agora."
          }
        </p>
      </div>
    </div>
  );
}

function OfertaRelampagoConfig({ config, setConfig, tenantId, node }: any) {
  // Logic for durations/fixed times
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5 text-gray-200">🚀 Mensagem da Oferta</label>
        <MessageComposer
          value={config.mensagemOferta}
          onChange={(val: any) => setConfig({ ...config, mensagemOferta: val })}
          placeholder="Aproveite agora! Oferta válida por tempo limitado..."
          tenantId={tenantId}
          node={node}
        />
      </div>

      <div className="p-4 bg-[#151515] border border-gray-700 rounded-lg space-y-3">
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider text-center">⏳ Duração da Oferta</label>
        <div className="flex gap-2">
          <button
            onClick={() => setConfig({ ...config, duracao: { ...config.duracao, tipo: 'tempo' } })}
            className={`flex-1 py-1.5 text-xs rounded border ${config.duracao?.tipo === 'tempo' ? 'border-primary text-primary bg-primary/10' : 'border-gray-700 text-gray-500'}`}
          >
            Tempo Parcial
          </button>
          <button
            onClick={() => setConfig({ ...config, duracao: { ...config.duracao, tipo: 'fixo' } })}
            className={`flex-1 py-1.5 text-xs rounded border ${config.duracao?.tipo === 'fixo' ? 'border-primary text-primary bg-primary/10' : 'border-gray-700 text-gray-500'}`}
          >
            Hora Fixa
          </button>
        </div>

        {config.duracao?.tipo === 'tempo' ? (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={config.duracao?.horas || 0}
              onChange={(e) => setConfig({ ...config, duracao: { ...config.duracao, horas: parseInt(e.target.value) } })}
              placeholder="Horas"
              className="bg-[#0d0d0d] border border-gray-700 rounded px-2 py-1.5 text-sm text-center"
            />
            <input
              type="number"
              value={config.duracao?.minutos || 15}
              onChange={(e) => setConfig({ ...config, duracao: { ...config.duracao, minutos: parseInt(e.target.value) } })}
              placeholder="Minutos"
              className="bg-[#0d0d0d] border border-gray-700 rounded px-2 py-1.5 text-sm text-center"
            />
          </div>
        ) : (
          <input
            type="time"
            value={config.duracao?.horaFixa || '23:59'}
            onChange={(e) => setConfig({ ...config, duracao: { ...config.duracao, horaFixa: e.target.value } })}
            className="w-full bg-[#0d0d0d] border border-gray-700 rounded px-2 py-1.5 text-sm text-center text-white"
          />
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-gray-200">🏁 Mensagem de Encerramento (Automática)</label>
        <MessageComposer
          value={config.mensagemEncerramento}
          onChange={(val: any) => setConfig({ ...config, mensagemEncerramento: val })}
          placeholder="A oferta acabou! Em breve traremos novas promoções."
          tenantId={tenantId}
          node={node}
        />
      </div>

      <div className="flex items-center justify-between p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
        <span className="text-xs text-yellow-500">Mencionar ao abrir oferta?</span>
        <button
          onClick={() => setConfig({ ...config, mencionarAoAbrir: !config.mencionarAoAbrir })}
          className={`w-9 h-5 rounded-full relative ${config.mencionarAoAbrir ? 'bg-yellow-500' : 'bg-gray-600'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${config.mencionarAoAbrir ? 'left-4.5' : 'left-0.5'}`} />
        </button>
      </div>
    </div>
  );
}

function AquecimentoConfig({ config, setConfig, tenantId, node }: any) {
  useEffect(() => {
    if (!config.sequencia || config.sequencia.length === 0) {
      const defaultDays = [
        { dia: 1, horario: '09:00', mensagem: { type: 'text', text: '👋 Olá pessoal! Bem-vindos ao grupo! Nos próximos dias vou compartilhar conteúdos incríveis com vocês. Fiquem ligados! 🔥' }, mencionarTodos: true },
        { dia: 2, horario: '10:00', mensagem: { type: 'text', text: '🔥 Dia 2! Hoje quero te contar um pouco mais sobre o que vem por aí... Algo que vai mudar tudo! 👀' }, mencionarTodos: false },
        { dia: 3, horario: '09:00', mensagem: { type: 'text', text: '⚡ É amanhã! Prepare-se pois o que eu tenho para te mostrar vai revolucionar a sua forma de trabalhar. Não perca! 🚀' }, mencionarTodos: true },
      ];
      setConfig({ ...config, sequencia: defaultDays });
    }
  }, []);

  const addDia = () => {
    const nextDia = (config.sequencia?.length || 0) + 1;
    const sequencia = [...(config.sequencia || []), {
      dia: nextDia,
      horario: '09:00',
      mensagem: { type: 'text', text: '' },
      mencionarTodos: false
    }];
    setConfig({ ...config, sequencia });
  };

  const updateDia = (index: number, field: string, value: any) => {
    const sequencia = [...(config.sequencia || [])];
    sequencia[index] = { ...sequencia[index], [field]: value };
    setConfig({ ...config, sequencia });
  };

  const removeDia = (index: number) => {
    const sequencia = config.sequencia.filter((_: any, idx: number) => idx !== index);
    // Reordenar os dias após remover
    const updatedSequencia = sequencia.map((s: any, idx: number) => ({ ...s, dia: idx + 1 }));
    setConfig({ ...config, sequencia: updatedSequencia });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-gray-200 uppercase tracking-wider">🔥 Sequência de Aquecimento</label>
        <button
          onClick={addDia}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 text-orange-500 border border-orange-500/30 rounded-full text-xs font-semibold hover:bg-orange-500/30 transition-colors"
        >
          <span>+</span> Adicionar Dia
        </button>
      </div>

      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {(config.sequencia || []).map((s: any, i: number) => (
          <div key={i} className="p-4 bg-[#151515] border border-gray-700 rounded-xl space-y-4 relative group">
            <button
              onClick={() => removeDia(i)}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              ×
            </button>

            <div className="flex justify-between items-center mb-1">
              <span className="bg-orange-500/10 text-orange-500 text-[10px] font-bold px-2 py-0.5 rounded border border-orange-500/20 italic">DIA {s.dia}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500">⏰</span>
                <input
                  type="time"
                  value={s.horario || '09:00'}
                  onChange={(e) => updateDia(i, 'horario', e.target.value)}
                  className="bg-[#0d0d0d] border border-gray-700 rounded-lg px-2 py-1 text-xs text-center font-mono outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-400 uppercase mb-1">Mensagem do Dia</label>
              <MessageComposer
                value={s.mensagem}
                onChange={(val: any) => updateDia(i, 'mensagem', val)}
                placeholder={`O que enviar no dia ${s.dia}?`}
                tenantId={tenantId}
                node={node}
              />
            </div>

            <div className="flex items-center justify-between px-3 py-2 bg-black/20 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">📣 Mencionar todos neste dia?</span>
              </div>
              <button
                onClick={() => updateDia(i, 'mencionarTodos', !s.mencionarTodos)}
                className={`w-10 h-5 rounded-full relative transition-colors ${s.mencionarTodos ? 'bg-orange-500' : 'bg-gray-700'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${s.mencionarTodos ? 'left-5.5' : 'left-0.5'}`} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {!config.sequencia || config.sequencia.length === 0 ? (
        <div className="p-8 text-center bg-[#151515] border border-dashed border-gray-700 rounded-xl">
          <p className="text-sm text-gray-500 italic">Preparando sugestões de aquecimento...</p>
        </div>
      ) : null}
    </div>
  );
}

function LembreteRecorrenteConfig({ config, setConfig, tenantId, node }: any) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5 text-gray-200">⏰ Horário (HH:MM)</label>
        <input
          type="time"
          value={config.horario || '09:00'}
          onChange={(e) => setConfig({ ...config, horario: e.target.value })}
          className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded text-center text-white font-mono"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5 text-gray-200">💬 Mensagem do Lembrete</label>
        <MessageComposer
          value={config.mensagem || { type: 'text', text: '' }}
          onChange={(val) => setConfig({ ...config, mensagem: val })}
          placeholder="Bom dia! Lembrete de que hoje temos live às 20h..."
          tenantId={tenantId}
          node={node}
        />
      </div>

      <div className="flex items-center justify-between p-3 bg-[#151515] border border-gray-700 rounded-lg">
        <span className="text-xs text-gray-300">Mencionar todos?</span>
        <button
          onClick={() => setConfig({ ...config, mencionarTodos: !config.mencionarTodos })}
          className={`w-9 h-5 rounded-full relative ${config.mencionarTodos ? 'bg-primary' : 'bg-gray-600'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${config.mencionarTodos ? 'left-4.5' : 'left-0.5'}`} />
        </button>
      </div>
    </div>
  );
}

// Editor de código Monaco (VS Code)
function CodeEditor({ value, onChange, language = 'javascript' }: any) {

  const handleEditorChange = (newValue: string | undefined) => {
    onChange({ target: { value: newValue || '' } })
  }

  const handleEditorDidMount = (editor: any, monaco: any) => {
    // Disable ALL suggestion features completely
    editor.updateOptions({
      quickSuggestions: false,
      suggestOnTriggerCharacters: false,
      acceptSuggestionOnCommitCharacter: false,
      wordBasedSuggestions: 'off',
    })

    // Override space key handler to always insert space
    editor.onKeyDown((e: any) => {
      if (e.keyCode === monaco.KeyCode.Space && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Insert space normally - suggestions are already disabled, so no need to close them
        e.preventDefault()
        e.stopPropagation()
        const position = editor.getPosition()
        const model = editor.getModel()
        if (model && position) {
          model.applyEdits([{
            range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
            text: ' ',
          }])
          editor.setPosition({ lineNumber: position.lineNumber, column: position.column + 1 })
        }
      }
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
        // Fix space key issue - completely disable ALL auto-suggestions
        suggest: {
          snippetsPreventQuickSuggestions: true,
          showSnippets: false,
          showKeywords: false,
          showWords: false,
          showClasses: false,
          showFunctions: false,
          showVariables: false,
          showFields: false,
          showMethods: false,
          showProperties: false,
          showReferences: false,
          showFolders: false,
          showTypeParameters: false,
          showIssues: false,
          showUsers: false,
          showModules: false,
        },
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        // Prevent space from accepting suggestions
        acceptSuggestionOnCommitCharacter: false,
        acceptSuggestionOnEnter: 'on',
        // Disable tab completion that might interfere
        tabCompletion: 'off',
        // Disable parameter hints that might interfere
        parameterHints: {
          enabled: false,
        },
        accessibilitySupport: 'auto',
        // Allow normal typing including spaces
        disableLayerHinting: true,
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

    // Inserir no cursor ou no final
    if (inputRef.current) {
      const input = inputRef.current
      const start = input.selectionStart || 0
      const end = input.selectionEnd || 0
      const currentValue = value || ''
      const newValue = currentValue.substring(0, start) + droppedText + currentValue.substring(end)

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
  inputData,
  executionData,
  executionLogs,
}: NodeConfigModalProps) {
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '')
  const [activeTab, setActiveTab] = useState<'parameters' | 'settings'>('parameters')
  const [config, setConfig] = useState<any>({})
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [availableLabels, setAvailableLabels] = useState<any[]>([])
  const [loadingLabels, setLoadingLabels] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [codeTestResult, setCodeTestResult] = useState<any>(null)
  const [testingCode, setTestingCode] = useState(false)
  const [scrapeTestResult, setScrapeTestResult] = useState<any>(null)
  const [testingScrape, setTestingScrape] = useState(false)
  const [testHTML, setTestHTML] = useState<string>('') // HTML real para teste
  const [loopTestResult, setLoopTestResult] = useState<any>(null)
  const [testingLoop, setTestingLoop] = useState(false)
  const [commandTestResult, setCommandTestResult] = useState<any>(null)
  const [testingCommand, setTestingCommand] = useState(false)

  useEffect(() => {
    if (node) {
      setConfig(node.config || {})

      // Load sessions if it's a trigger node, manage labels node, or send message/media node
      if (node.type === WorkflowNodeType.TRIGGER_MESSAGE ||
        node.type === WorkflowNodeType.TRIGGER_SCHEDULE ||
        node.type === 'TRIGGER_MANUAL' ||
        node.type === 'MANAGE_LABELS' ||
        node.type === WorkflowNodeType.SEND_MESSAGE ||
        node.type === WorkflowNodeType.SEND_MEDIA ||
        node.type === WorkflowNodeType.SEND_BUTTONS ||
        node.type === WorkflowNodeType.SEND_LIST) {
        loadSessions()
      }
    }
  }, [node])

  useEffect(() => {
    // Load labels when it's a MANAGE_LABELS node and action is not 'list'
    if (node?.type === 'MANAGE_LABELS' && config.action !== 'list' && sessions.length > 0) {
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
    if (!sessions || sessions.length === 0) {
      return
    }

    setLoadingLabels(true)
    try {
      // Use the first connected session to get labels
      const connectedSession = sessions.find((s: any) => s.status === 'CONNECTED')
      if (connectedSession) {
        const labels = await apiClient.getSessionLabels(connectedSession.id)
        setAvailableLabels(labels || [])
      }
    } catch (error) {
      console.error('Error loading labels:', error)
    } finally {
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
      case WorkflowNodeType.PIXEL_EVENT:
        return <PixelEventConfig config={config} setConfig={setConfig} />

      case WorkflowNodeType.PROMO_ML:
        return <PromoMLConfig config={config} setConfig={setConfig} />

      case WorkflowNodeType.MENCIONAR_TODOS:
        return <MencionarTodosConfig config={config} setConfig={setConfig} tenantId={tenantId} node={node} />

      case WorkflowNodeType.GRUPO_MEDIA:
        return (
          <GrupoMediaConfig
            node={node}
            config={config}
            setConfig={setConfig}
            tenantId={tenantId}
            sessions={sessions}
            loading={loading}
          />
        )

      case WorkflowNodeType.GRUPO_WAIT:
        return <GrupoWaitConfig config={config} setConfig={setConfig} />

      case WorkflowNodeType.AQUECIMENTO:
        return <AquecimentoConfig config={config} setConfig={setConfig} tenantId={tenantId} node={node} />

      case WorkflowNodeType.OFERTA_RELAMPAGO:
        return <OfertaRelampagoConfig config={config} setConfig={setConfig} tenantId={tenantId} node={node} />

      case WorkflowNodeType.LEMBRETE_RECORRENTE:
        return <LembreteRecorrenteConfig config={config} setConfig={setConfig} tenantId={tenantId} node={node} />

      case WorkflowNodeType.ENQUETE_GRUPO:
        return <EnqueteGrupoConfig config={config} setConfig={setConfig} />

      case WorkflowNodeType.SEQUENCIA_LANCAMENTO:
        return <SequenciaLancamentoConfig config={config} setConfig={setConfig} tenantId={tenantId} node={node} />

      case WorkflowNodeType.PROMO_ML_API:
        return <PromoMLApiConfig config={config} setConfig={setConfig} />

      case WorkflowNodeType.PROMO_SHOPEE:
        return <PromoShopeeConfig config={config} setConfig={setConfig} />

      case 'TRIGGER_GRUPO':
      case WorkflowNodeType.TRIGGER_GRUPO:
        return <GroupTriggerConfig config={config} setConfig={setConfig} />

      case WorkflowNodeType.TRIGGER_WHATSAPP:
      case WorkflowNodeType.TRIGGER_KEYWORD:
      case 'TRIGGER_MESSAGE':
        const isKeyword = node.type === WorkflowNodeType.TRIGGER_KEYWORD;
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Sessão WhatsApp
              </label>
              <select
                value={config.sessionId || ''}
                onChange={(e) => setConfig({ ...config, sessionId: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                disabled={loading}
              >
                <option value="">Todas as Sessões</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name} ({session.phoneNumber})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1.5">
                Deixe vazio para ouvir em todas as sessões
              </p>
            </div>

            <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">
                {isKeyword ? 'Configuração da Palavra-Chave' : 'Filtro de Mensagens'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-200">
                    {isKeyword ? 'Palavra-Chave' : 'Padrão da Mensagem'}
                  </label>
                  <input
                    type="text"
                    value={config.pattern || ''}
                    onChange={(e) => setConfig({ ...config, pattern: e.target.value })}
                    placeholder={isKeyword ? "Ex: comprar, suporte, info" : "Deixe vazio para aceitar todas as mensagens"}
                    className="w-full px-4 py-2.5 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500 font-mono"
                  />
                  <p className="text-xs text-gray-400 mt-1.5 font-medium">
                    {config.pattern && config.pattern.trim() !== ''
                      ? `Filtro ativo: dispara quando mensagem for [${config.pattern}]`
                      : isKeyword
                        ? '⚠️ Defina uma palavra-chave para disparar este fluxo'
                        : '⚠️ Sem filtro: Este trigger aceitará TODAS as mensagens recebidas'}
                  </p>
                </div>

                {config.pattern && config.pattern.trim() !== '' && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-200">
                      Tipo de Correspondência
                    </label>
                    <select
                      value={config.matchType || (isKeyword ? 'contains' : 'exact')}
                      onChange={(e) => setConfig({ ...config, matchType: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                    >
                      <option value="exact">Correspondência Exata</option>
                      <option value="starts_with">Começa com</option>
                      <option value="contains">Contém</option>
                      <option value="regex">Expressão Regular (Regex)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Help Text */}
            <div className={`border rounded-lg p-3 ${isKeyword ? 'bg-purple-500/10 border-purple-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
              <p className={`text-xs leading-relaxed ${isKeyword ? 'text-purple-300' : 'text-blue-300'}`}>
                💡 <strong>Dica:</strong> {isKeyword
                  ? 'Este trigger é otimizado para identificar palavras-chave em conversas individuais. Ele ignora mensagens de grupos automaticamente.'
                  : 'Este trigger dispara em todas as mensagens individuais recebidas que correspondam ao padrão. Ele ignora grupos automaticamente.'}
              </p>
            </div>
          </div>
        )

      case 'TRIGGER_MANUAL':
        return (
          <TriggerManualConfig
            config={config}
            setConfig={setConfig}
            tenantId={tenantId}
            sessions={sessions}
            loading={loading}
          />
        )


      case 'TRIGGER_SCHEDULE':
        return (
          <ScheduleTriggerConfig
            config={config}
            setConfig={setConfig}
            sessions={sessions}
            loading={loading}
          />
        )

      case 'SEND_MESSAGE':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                WhatsApp Session (Opcional)
              </label>
              <select
                value={config.sessionId || ''}
                onChange={(e) => setConfig({ ...config, sessionId: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                disabled={loading}
              >
                <option value="">Usar sessão do contexto (padrão)</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name} ({session.phoneNumber})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1.5">
                Selecione uma sessão específica para enviar a mensagem, ou deixe vazio para usar a sessão atual.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Para (Número - Opcional)
              </label>
              <input
                type="text"
                value={config.to || ''}
                onChange={(e) => setConfig({ ...config, to: e.target.value })}
                placeholder="{{contact.phoneNumber}} ou 5511999999999"
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Número de destino. Suporta variáveis. Se vazio, responde ao contato atual.
              </p>
            </div>
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
                WhatsApp Session (Opcional)
              </label>
              <select
                value={config.sessionId || ''}
                onChange={(e) => setConfig({ ...config, sessionId: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                disabled={loading}
              >
                <option value="">Usar sessão do contexto (padrão)</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name} ({session.phoneNumber})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1.5">
                Selecione uma sessão específica para enviar a mídia, ou deixe vazio para usar a sessão atual.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Para (Número - Opcional)
              </label>
              <input
                type="text"
                value={config.to || ''}
                onChange={(e) => setConfig({ ...config, to: e.target.value })}
                placeholder="{{contact.phoneNumber}} ou 5511999999999"
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Número de destino. Suporta variáveis. Se vazio, responde ao contato atual.
              </p>
            </div>

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
                onChange={(e) => setConfig({ ...config, mediaUrl: e.target.value, uploadedMediaId: undefined })}
                placeholder="https://example.com/media.jpg"
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500 font-mono text-sm"
                disabled={!!config.uploadedMediaId}
              />
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-gray-500">
                  Use <code className="px-1.5 py-0.5 bg-gray-800 rounded text-primary">{`{{variables.imageUrl}}`}</code> para inserir variáveis
                </span>
              </div>

              {/* File upload section */}
              {!config.uploadedMediaId ? (
                <div className="mt-3">
                  <div className="flex items-center gap-2 my-2">
                    <div className="flex-1 h-px bg-gray-700"></div>
                    <span className="text-xs text-gray-500">ou</span>
                    <div className="flex-1 h-px bg-gray-700"></div>
                  </div>
                  <label className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#151515] border border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-primary hover:bg-[#1a1a1a] transition-colors">
                    <span className="text-sm text-gray-300">📎 Upload de arquivo</span>
                    <input
                      type="file"
                      className="hidden"
                      accept={
                        config.mediaType === 'image' ? '.jpg,.jpeg,.png,.webp' :
                          config.mediaType === 'audio' ? '.mp3,.ogg,.aac' :
                            config.mediaType === 'video' ? '.mp4' :
                              config.mediaType === 'document' ? '.pdf,.docx' : '*'
                      }
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return

                        const mediaType = config.mediaType || 'image'
                        const sizeLimits: Record<string, number> = {
                          image: 5 * 1024 * 1024,
                          audio: 10 * 1024 * 1024,
                          video: 50 * 1024 * 1024,
                          document: 20 * 1024 * 1024,
                        }

                        if (file.size > (sizeLimits[mediaType] || 5 * 1024 * 1024)) {
                          const maxMB = Math.round((sizeLimits[mediaType] || 5 * 1024 * 1024) / (1024 * 1024))
                          alert(`Arquivo muito grande. Máximo para ${mediaType}: ${maxMB}MB`)
                          e.target.value = ''
                          return
                        }

                        try {
                          const formData = new FormData()
                          formData.append('file', file)
                          const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '')
                          const token = localStorage.getItem('n9n_token')
                          const headers: HeadersInit = {}
                          if (token) {
                            headers['Authorization'] = `Bearer ${token}`
                          }
                          const res = await fetch(
                            `${API_URL}/media/upload?tenantId=${tenantId}&mediaType=${mediaType}&nodeId=${node.id}&workflowId=${(node as any).workflowId || ''}`,
                            { method: 'POST', headers, body: formData }
                          )

                          if (!res.ok) {
                            const err = await res.json()
                            alert(err.message || 'Erro ao fazer upload')
                            e.target.value = ''
                            return
                          }

                          const data = await res.json()
                          setConfig({
                            ...config,
                            mediaUrl: data.url,
                            uploadedMediaId: data.id,
                            uploadedFileName: data.originalName,
                            uploadedFileSize: data.size,
                          })
                        } catch (err) {
                          alert('Erro ao fazer upload do arquivo')
                        }
                        e.target.value = ''
                      }}
                    />
                  </label>
                  <p className="text-xs text-gray-500 mt-1.5">
                    {config.mediaType === 'image' ? 'JPG, PNG, WEBP — máx 5MB' :
                      config.mediaType === 'audio' ? 'MP3, OGG, AAC — máx 10MB' :
                        config.mediaType === 'video' ? 'MP4 — máx 50MB' :
                          config.mediaType === 'document' ? 'PDF, DOCX — máx 20MB' : ''}
                  </p>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-3 px-4 py-3 bg-[#1a1a2e] border border-primary/30 rounded-lg">
                  <span className="text-xl">
                    {config.mediaType === 'image' ? '🖼️' :
                      config.mediaType === 'audio' ? '🎵' :
                        config.mediaType === 'video' ? '🎥' : '📄'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{config.uploadedFileName || 'Arquivo'}</p>
                    <p className="text-xs text-gray-500">
                      {config.uploadedFileSize ? `${(config.uploadedFileSize / 1024).toFixed(1)} KB` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                    onClick={async () => {
                      try {
                        const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '')
                        const token = localStorage.getItem('n9n_token')
                        const headers: HeadersInit = {}
                        if (token) {
                          headers['Authorization'] = `Bearer ${token}`
                        }
                        await fetch(`${API_URL}/media/${config.uploadedMediaId}?tenantId=${tenantId}`, { method: 'DELETE', headers })
                      } catch (e) { /* ignore */ }
                      setConfig({
                        ...config,
                        mediaUrl: '',
                        uploadedMediaId: undefined,
                        uploadedFileName: undefined,
                        uploadedFileSize: undefined,
                      })
                    }}
                  >
                    🗑️ Remover
                  </button>
                </div>
              )}
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
              <p className="text-xs text-blue-300 leading-relaxed mb-2">
                💡 <strong>Dica:</strong> Cada botão adicionado cria uma <strong>saída automática</strong> no node lateral no editor. O fluxo seguirá pelo caminho correspondente ao botão que o contato clicar ou digitar.
              </p>
              <p className="text-[10px] text-blue-400/80 leading-relaxed">
                ⚠️ Para contas pessoais, os botões serão enviados como uma lista numerada (1, 2, 3) e o sistema detectará a resposta automaticamente.
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
                Variable name to store the user&apos;s reply
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

      case 'RMKT':
        return (
          <div className="space-y-6">
            <div className="bg-[#2a1a1a] border border-red-700/30 rounded-lg p-4">
              <div className="flex items-start gap-4">
                <div className="text-3xl">🎯</div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white mb-1">
                    Remarketing (Follow-up)
                  </h3>
                  <p className="text-xs text-gray-400">
                    Agenda uma mensagem para ser enviada após um tempo. Se o contato responder antes, o envio é cancelado.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-[#151515] border border-gray-700 rounded-lg p-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">
                  Tempo de Espera
                </label>
                <input
                  type="number"
                  value={config.amount || 1}
                  onChange={(e) => setConfig({ ...config, amount: parseInt(e.target.value) || 1 })}
                  placeholder="1"
                  min="1"
                  className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">
                  Unidade
                </label>
                <select
                  value={config.unit || 'minutes'}
                  onChange={(e) => setConfig({ ...config, unit: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                >
                  <option value="seconds">Segundos</option>
                  <option value="minutes">Minutos</option>
                  <option value="hours">Horas</option>
                  <option value="days">Dias</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Tipo de Mensagem
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['text', 'image', 'audio'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setConfig({ ...config, messageType: type })}
                    className={`
                      px-4 py-2 rounded-lg border-2 transition-all text-xs font-semibold
                      ${config.messageType === type
                        ? 'bg-primary/20 border-primary text-primary'
                        : 'bg-[#151515] border-gray-700 text-gray-400 hover:border-gray-600'
                      }
                    `}
                  >
                    {type === 'text' && '📝 Texto'}
                    {type === 'image' && '📸 Imagem'}
                    {type === 'audio' && '🎵 Áudio'}
                  </button>
                ))}
              </div>
            </div>

            {config.messageType === 'text' && (
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">
                  Mensagem
                </label>
                <DroppableInput
                  type="textarea"
                  value={config.text || ''}
                  onChange={(e: any) => setConfig({ ...config, text: e.target.value })}
                  placeholder="Olá {{nome}}, tudo bem?..."
                  className="w-full px-4 py-3 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary resize-none text-white placeholder-gray-500 font-mono text-sm"
                />
                <p className="text-[10px] text-gray-500 mt-1.5 uppercase font-bold tracking-tighter">
                  Variáveis: {'{{nome}}, {{telefone}}, {{sessao}}'}
                </p>
              </div>
            )}

            {(config.messageType === 'image' || config.messageType === 'audio') && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-200">
                    URL da Mídia
                  </label>
                  <input
                    type="text"
                    value={config.mediaUrl || ''}
                    onChange={(e) => setConfig({ ...config, mediaUrl: e.target.value })}
                    placeholder="https://exemplo.com/imagem.jpg"
                    className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500 font-mono text-sm"
                  />
                </div>
                {config.messageType === 'image' && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-200">
                      Legenda (Opcional)
                    </label>
                    <input
                      type="text"
                      value={config.caption || ''}
                      onChange={(e) => setConfig({ ...config, caption: e.target.value })}
                      placeholder="Legenda da imagem..."
                      className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500 text-sm"
                    />
                  </div>
                )}
                {config.messageType === 'audio' && (
                  <div className="flex items-center gap-3 bg-[#151515] border border-gray-700 rounded-lg p-3">
                    <input
                      type="checkbox"
                      id="sendAudioAsVoice"
                      checked={config.sendAudioAsVoice || false}
                      onChange={(e) => setConfig({ ...config, sendAudioAsVoice: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-700 bg-black text-primary"
                    />
                    <label htmlFor="sendAudioAsVoice" className="text-xs text-gray-300 cursor-pointer">
                      Enviar como mensagem de voz (WhatsApp PTT)
                    </label>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4 pt-4 border-t border-gray-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-200">
                    Cancelar se responder
                  </label>
                  <p className="text-[10px] text-gray-500">
                    Cancela o envio se o contato responder antes
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, cancelOnReply: !config.cancelOnReply })}
                  className={`
                    w-12 h-6 rounded-full transition-all relative
                    ${config.cancelOnReply ? 'bg-primary' : 'bg-gray-700'}
                  `}
                >
                  <div className={`
                    absolute top-1 w-4 h-4 rounded-full bg-white transition-all
                    ${config.cancelOnReply ? 'left-7' : 'left-1'}
                  `} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-400">
                    Retentativas
                  </label>
                  <input
                    type="number"
                    value={config.retries || 2}
                    onChange={(e) => setConfig({ ...config, retries: parseInt(e.target.value) || 0 })}
                    min="0"
                    max="5"
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-400">
                    Intervalo Retry (ms)
                  </label>
                  <input
                    type="number"
                    value={config.retryDelayMs || 30000}
                    onChange={(e) => setConfig({ ...config, retryDelayMs: parseInt(e.target.value) || 30000 })}
                    step="1000"
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        )

      case 'PIX_SIMPLES':
        return (
          <div className="space-y-6">
            <div className="bg-[#1a2e1a] border border-green-700/30 rounded-lg p-4">
              <div className="flex items-start gap-4">
                <div className="text-3xl">🟢</div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white mb-1">Enviar PIX</h3>
                  <p className="text-xs text-gray-400">
                    Envia a chave Pix com botão "Copiar chave Pix" e continua o fluxo imediatamente. Para chave telefone, aparece o botão nativo do WhatsApp.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">Chave PIX</label>
              <input
                type="text"
                value={config.chavePix || ''}
                onChange={(e) => setConfig({ ...config, chavePix: e.target.value })}
                placeholder="Telefone, CPF, e-mail ou chave aleatória"
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">Nome do Recebedor</label>
                <input
                  type="text"
                  value={config.nomeRecebedor || ''}
                  onChange={(e) => setConfig({ ...config, nomeRecebedor: e.target.value })}
                  placeholder="Ex: João Silva"
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">Valor (R$)</label>
                <input
                  type="text"
                  value={config.valor || ''}
                  onChange={(e) => setConfig({ ...config, valor: e.target.value })}
                  placeholder="Ex: 15 ou {{valor}}"
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">Descrição (Opcional)</label>
              <input
                type="text"
                value={config.descricao || ''}
                onChange={(e) => setConfig({ ...config, descricao: e.target.value })}
                placeholder="Ex: Pagamento Pedido #123"
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500"
              />
            </div>

            {/* PREVIEW */}
            <div className="pt-4 border-t border-gray-700">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-4 tracking-widest">
                Preview da Mensagem
              </label>
              {config.chavePix && /^\d{10,13}$/.test(config.chavePix.replace(/\D/g, '')) ? (
                <div className="space-y-2">
                  <div className="bg-[#0b141a] rounded-lg p-3 ring-1 ring-white/10 shadow-xl">
                    <div className="flex items-center gap-3 bg-[#1f2c33] rounded-lg p-3">
                      <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {(config.nomeRecebedor || 'N')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{config.nomeRecebedor || 'Nome Recebedor'}</p>
                        <p className="text-gray-400 text-xs">Celular: {config.chavePix}</p>
                      </div>
                    </div>
                    <div className="mt-2 border-t border-gray-700 pt-2">
                      <button className="w-full flex items-center justify-center gap-2 text-green-400 text-sm py-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        Copiar chave Pix
                      </button>
                    </div>
                  </div>
                  <div className="bg-[#0b141a] rounded-lg p-3 ring-1 ring-white/10 shadow-xl text-[#e9edef] text-[13px] whitespace-pre-wrap">
                    {`💰 *${config.descricao || 'Pagamento PIX'}*\n\nValor: *R$ ${config.valor || '0,00'}*\nRecebedor: ${config.nomeRecebedor || '...'}`}
                  </div>
                </div>
              ) : (
                <div className="bg-[#0b141a] rounded-lg p-4 ring-1 ring-white/10 shadow-xl text-[#e9edef] text-[13px] whitespace-pre-wrap">
                  {`💰 *${config.descricao || 'Pagamento PIX'}*\n\nValor: *R$ ${config.valor || '0,00'}*\nRecebedor: ${config.nomeRecebedor || '...'}\n\n📋 *Chave PIX:*\n`}
                  <span className="font-mono bg-[#1f2c33] px-1 rounded">{config.chavePix || 'sua-chave'}</span>
                </div>
              )}
              <p className="text-xs text-gray-600 mt-2">
                {config.chavePix && /^\d{10,13}$/.test(config.chavePix.replace(/\D/g, ''))
                  ? '✅ Chave telefone detectada — aparece botão nativo "Copiar chave Pix"'
                  : '📋 Chave não-telefone — enviada como texto copiável'}
              </p>
            </div>
          </div>
        )

      case 'SEND_PIX':
        return (
          <div className="space-y-6">
            <div className="bg-[#1a2e1a] border border-green-700/30 rounded-lg p-4">
              <div className="flex items-start gap-4">
                <div className="text-3xl">💰</div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white mb-1">
                    Cobrar PIX
                  </h3>
                  <p className="text-xs text-gray-400">
                    Envia uma cobrança PIX e aguarda um comprovante ou mensagem de confirmação.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2 text-gray-200">
                  Chave PIX
                </label>
                <input
                  type="text"
                  value={config.chavePix || ''}
                  onChange={(e) => setConfig({ ...config, chavePix: e.target.value })}
                  placeholder="E-mail, CPF, Tel ou Chave Aleatória"
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">
                  Nome do Recebedor
                </label>
                <input
                  type="text"
                  value={config.nomeRecebedor || ''}
                  onChange={(e) => setConfig({ ...config, nomeRecebedor: e.target.value })}
                  placeholder="Nome que aparece no PIX"
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">
                  Valor (R$)
                </label>
                <input
                  type="text"
                  value={config.valor || ''}
                  onChange={(e) => setConfig({ ...config, valor: e.target.value })}
                  placeholder="Ex: 50.00 ou {{valor}}"
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Descrição (Opcional)
              </label>
              <input
                type="text"
                value={config.descricao || ''}
                onChange={(e) => setConfig({ ...config, descricao: e.target.value })}
                placeholder="Ex: Pagamento Pedido #123"
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Mensagem Personalizada (Opcional)
              </label>
              <textarea
                value={config.mensagemCustom || ''}
                onChange={(e) => setConfig({ ...config, mensagemCustom: e.target.value })}
                placeholder="Ex: Olá! Aqui está o seu link para pagamento:"
                rows={3}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">
                  Timeout (Minutos)
                </label>
                <input
                  type="number"
                  value={config.timeoutMinutos || 30}
                  onChange={(e) => setConfig({ ...config, timeoutMinutos: parseInt(e.target.value) || 30 })}
                  min="1"
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">
                  Palavras-chave (Confirmam pgto)
                </label>
                <input
                  type="text"
                  value={config.palavrasChave?.join(', ') || ''}
                  onChange={(e) => setConfig({ ...config, palavrasChave: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '') })}
                  placeholder="paguei, pix, ok"
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Separadas por vírgula. Se vazio, qualquer resposta confirma.
                </p>
              </div>
            </div>

            {/* MODO DE ENVIO */}
            <div className="border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-200">Enviar como Contato</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Exibe o botão nativo <span className="text-green-400">"Copiar chave Pix"</span> no WhatsApp (recomendado para chave telefone)
                  </p>
                </div>
                <button
                  onClick={() => setConfig({ ...config, enviarComoContato: !config.enviarComoContato })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.enviarComoContato ? 'bg-green-500' : 'bg-gray-600'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.enviarComoContato ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {/* MESSAGE PREVIEW */}
            <div className="mt-2 pt-6 border-t border-gray-700">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-4 tracking-widest">
                Preview da Mensagem
              </label>
              {config.enviarComoContato ? (
                <div className="space-y-2">
                  {/* Contact card preview */}
                  <div className="bg-[#0b141a] rounded-lg p-3 ring-1 ring-white/10 shadow-xl">
                    <div className="flex items-center gap-3 bg-[#1f2c33] rounded-lg p-3">
                      <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {(config.nomeRecebedor || 'N')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{config.nomeRecebedor || 'Nome Recebedor'}</p>
                        <p className="text-gray-400 text-xs">Celular: {config.chavePix || '...'}</p>
                      </div>
                    </div>
                    <div className="mt-2 border-t border-gray-700 pt-2">
                      <button className="w-full flex items-center justify-center gap-2 text-green-400 text-sm py-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        Copiar chave Pix
                      </button>
                    </div>
                  </div>
                  {/* Text details preview */}
                  <div className="bg-[#0b141a] rounded-lg p-4 ring-1 ring-white/10 shadow-xl">
                    <div className="text-[#e9edef] whitespace-pre-wrap text-[13px]">
                      {`💰 *${config.descricao || 'Cobrança PIX'}*`}
                      {config.mensagemCustom ? `\n\n${config.mensagemCustom}` : ''}
                      {`\n\nValor: *R$ ${config.valor || '0.00'}*`}
                      {`\n⏱ _Válido por ${config.timeoutMinutos || 30} minutos._`}
                      {`\n\nApós pagar, envie o comprovante. ✅`}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#0b141a] rounded-lg p-4 font-sans text-[14px] leading-relaxed relative overflow-hidden ring-1 ring-white/10 shadow-xl">
                  <div className="text-[#e9edef] whitespace-pre-wrap">
                    {`💰 *${config.descricao || 'Cobrança PIX'}*`}
                    {config.mensagemCustom ? `\n\n${config.mensagemCustom}` : ''}
                    {`\n\nValor: *R$ ${config.valor || '0.00'}*\n`}
                    {`Recebedor: ${config.nomeRecebedor || '...'}\n`}
                    {`\n📋 *Chave PIX:*\n`}
                    <span className="font-mono bg-[#1f2c33] px-1 rounded">{config.chavePix || '...'}</span>
                    {`\n\nApós pagar, envie o comprovante. ✅\n`}
                    {`⏱ _Válido por ${config.timeoutMinutos || 30} minutos._`}
                  </div>
                  <div className="absolute right-2 bottom-1 text-[10px] text-[#8696a0]">
                    12:00 ✓✓
                  </div>
                </div>
              )}
            </div>
          </div>
        )

      case 'LOOP':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Modo de Loop
              </label>
              <select
                value={config.loopMode || 'array'}
                onChange={(e) => setConfig({ ...config, loopMode: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
              >
                <option value="array">Iterar sobre Array</option>
                <option value="count">Iterar N vezes</option>
              </select>
              <p className="text-xs text-gray-500 mt-1.5">
                {config.loopMode === 'count'
                  ? 'Executa o loop um número fixo de vezes'
                  : 'Itera sobre cada item de um array'
                }
              </p>
            </div>

            {config.loopMode === 'array' && (
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">
                  Fonte do Array
                </label>
                <input
                  type="text"
                  value={config.arraySource || ''}
                  onChange={(e) => setConfig({ ...config, arraySource: e.target.value })}
                  placeholder="scrapeResponse.scriptResult"
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500 font-mono"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Caminho da variável que contém o array (ex: scrapeResponse.scriptResult, codeOutput.items)
                </p>
              </div>
            )}

            {config.loopMode === 'count' && (
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">
                  Número de Iterações
                </label>
                <input
                  type="number"
                  value={config.count || 1}
                  onChange={(e) => setConfig({ ...config, count: parseInt(e.target.value) || 1 })}
                  placeholder="10"
                  min="1"
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Quantas vezes executar o loop
                </p>
              </div>
            )}

            <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">Variáveis do Loop</h3>

              {config.loopMode === 'array' && (
                <div className="mb-3">
                  <label className="block text-xs font-medium mb-1.5 text-gray-400">
                    Nome da variável do item
                  </label>
                  <input
                    type="text"
                    value={config.itemVariableName || 'item'}
                    onChange={(e) => setConfig({ ...config, itemVariableName: e.target.value })}
                    placeholder="item"
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Acesse o item atual usando <code className="bg-gray-700 px-1 py-0.5 rounded">{'{{item}}'}</code>
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-400">
                  Nome da variável do índice
                </label>
                <input
                  type="text"
                  value={config.indexVariableName || 'index'}
                  onChange={(e) => setConfig({ ...config, indexVariableName: e.target.value })}
                  placeholder="index"
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Acesse o índice usando <code className="bg-gray-700 px-1 py-0.5 rounded">{'{{index}}'}</code> (começa em 0)
                </p>
              </div>
            </div>

            {/* Test Button */}
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-200">
                Testar Loop
              </label>
              <button
                onClick={async () => {
                  if (!executionData?.id) {
                    setLoopTestResult({ error: 'Nenhuma execução encontrada. Execute o workflow primeiro para testar o loop.' })
                    return
                  }

                  // Validate config before testing
                  if (!config.loopMode) {
                    setLoopTestResult({ error: 'Por favor, configure o modo de loop antes de testar.' })
                    return
                  }

                  if (config.loopMode === 'array' && !config.arraySource) {
                    setLoopTestResult({ error: 'Por favor, configure a fonte do array antes de testar.' })
                    return
                  }

                  if (config.loopMode === 'count' && (!config.count || config.count < 1)) {
                    setLoopTestResult({ error: 'Por favor, configure o número de iterações antes de testar.' })
                    return
                  }

                  // Save config first to ensure it's persisted
                  try {
                    if (onSave) {
                      await onSave(node.id, config)
                      // Wait longer to ensure workflow is saved and database is updated
                      await new Promise(resolve => setTimeout(resolve, 800))
                    }
                  } catch (saveError: any) {
                    setLoopTestResult({ error: `Erro ao salvar configuração: ${saveError.message || 'Unknown error'}` })
                    return
                  }

                  setTestingLoop(true)
                  setLoopTestResult(null)

                  try {
                    const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '')
                    const response = await fetch(`${API_URL}/api/workflows/${executionData.workflowId}/test-node?tenantId=${tenantId}&nodeId=${node.id}&executionId=${executionData.id}`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        tenantId,
                        nodeId: node.id,
                        executionId: executionData.id,
                        nodeConfig: config, // Pass current config to ensure it's used
                      }),
                    })

                    if (!response.ok) {
                      let errorMessage = 'Failed to test loop'
                      try {
                        const errorData = await response.json()
                        errorMessage = errorData.message || errorData.error || errorMessage
                      } catch {
                        const text = await response.text().catch(() => '')
                        errorMessage = text || errorMessage
                      }
                      throw new Error(errorMessage)
                    }

                    const result = await response.json()

                    // Wait a bit for execution to complete and then fetch logs
                    setTimeout(async () => {
                      try {
                        const logsResponse = await fetch(`${API_URL}/api/executions/${result.executionId}/logs?tenantId=${tenantId}`)
                        if (logsResponse.ok) {
                          const logs = await logsResponse.json()

                          // Find loop node execution logs
                          const loopLogs = logs.filter((log: any) => {
                            const logType = log.eventType || log.type
                            return logType === 'node.executed' && log.nodeId === node.id
                          })

                          // Get iterations from output (most accurate)
                          let iterationsExecuted = 0
                          let output: any = {}

                          if (loopLogs.length > 0) {
                            const lastLog = loopLogs[loopLogs.length - 1]
                            output = lastLog.data?.output || {}

                            // Check if there's an error in the output
                            if (output.error) {
                              setLoopTestResult({
                                error: output.message || 'Erro ao executar loop',
                                output,
                              })
                              setTestingLoop(false)
                              return
                            }

                            // Try to get iterations from output (preferred method)
                            if (output.iterationsExecuted !== undefined) {
                              iterationsExecuted = output.iterationsExecuted
                            } else if (output.totalItems !== undefined && config.loopMode === 'count') {
                              // For count mode, totalItems represents the iterations
                              iterationsExecuted = output.totalItems
                            } else if (loopLogs.length > 0) {
                              // Fallback: count by number of logs (each log = one execution)
                              iterationsExecuted = loopLogs.length
                            }
                          }

                          setLoopTestResult({
                            success: true,
                            iterationsExecuted,
                            totalItems: output.totalItems || (config.loopMode === 'count' ? (config.count || 1) : undefined),
                            output,
                          })
                        } else {
                          throw new Error('Failed to fetch execution logs')
                        }
                      } catch (error: any) {
                        setLoopTestResult({
                          success: true,
                          iterationsExecuted: 0,
                          message: 'Loop executado, mas não foi possível obter o número de iterações: ' + (error.message || 'Unknown error'),
                        })
                      } finally {
                        setTestingLoop(false)
                      }
                    }, 2000)
                  } catch (error: any) {
                    setLoopTestResult({
                      error: error.message || 'Erro ao testar loop',
                    })
                    setTestingLoop(false)
                  }
                }}
                disabled={testingLoop || !executionData?.id}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition"
              >
                {testingLoop ? 'Testando...' : '▶ Testar com contexto atual'}
              </button>
            </div>

            {/* Test Result */}
            {loopTestResult && (
              <div className={`mt-4 border rounded-lg p-4 ${loopTestResult.error || !loopTestResult.success
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-green-500/10 border-green-500/30'
                }`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className={`text-sm font-semibold ${loopTestResult.error || !loopTestResult.success ? 'text-red-300' : 'text-green-300'
                    }`}>
                    {loopTestResult.error || !loopTestResult.success ? '❌ Erro' : '✅ Sucesso'}
                  </h4>
                  <button
                    onClick={() => setLoopTestResult(null)}
                    className="text-gray-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                </div>
                {loopTestResult.error ? (
                  <div className="text-xs text-red-300 font-mono bg-black/30 p-2 rounded">
                    {loopTestResult.error}
                  </div>
                ) : (
                  <div>
                    <div className="text-xs text-gray-400 mb-2">
                      {loopTestResult.iterationsExecuted !== undefined ? (
                        <span className="text-green-300 font-semibold">
                          🔁 Loop executado {loopTestResult.iterationsExecuted} {loopTestResult.iterationsExecuted === 1 ? 'vez' : 'vezes'}
                        </span>
                      ) : (
                        <span className="text-green-300">Loop executado com sucesso</span>
                      )}
                    </div>
                    {loopTestResult.totalItems !== undefined && (
                      <div className="text-xs text-gray-400 mt-1">
                        Total de itens: {loopTestResult.totalItems}
                      </div>
                    )}
                    {loopTestResult.output && Object.keys(loopTestResult.output).length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs text-gray-400 mb-1">Output:</div>
                        <pre className="text-xs text-green-300 font-mono bg-black/30 p-2 rounded overflow-x-auto max-h-32 overflow-y-auto">
                          {JSON.stringify(loopTestResult.output, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔁</span>
                <div className="flex-1">
                  <p className="text-sm text-blue-300 font-medium mb-1">
                    Como funciona o Loop
                  </p>
                  <p className="text-xs text-blue-200/80 leading-relaxed">
                    {config.loopMode === 'count'
                      ? `O loop executará os nós subsequentes ${config.count || 1} vezes. Use a variável {{${config.indexVariableName || 'index'}}} para acessar o número da iteração atual (0 a ${(config.count || 1) - 1}).`
                      : `O loop iterará sobre cada item do array em ${config.arraySource || 'arraySource'}. Use {{${config.itemVariableName || 'item'}}} para acessar o item atual e {{${config.indexVariableName || 'index'}}} para o índice.`
                    }
                  </p>
                  <p className="text-xs text-blue-200/80 mt-2">
                    💡 <strong>Dica:</strong> Conecte o próximo nó que deseja executar para cada iteração.
                    {config.loopMode === 'array' && ' Os resultados de todas as iterações serão coletados em loopResults.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )

      case 'RANDOMIZER':
        return <RandomizerConfig config={config} setConfig={setConfig} />

      case 'CONDITION':
        return <ConditionConfig config={config} setConfig={setConfig} />

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

      case 'HTTP_SCRAPE':
        const scrapeHeaders = config.headers || []

        const addScrapeHeader = () => {
          setConfig({ ...config, headers: [...scrapeHeaders, { key: '', value: '' }] })
        }

        const updateScrapeHeader = (index: number, field: string, value: string) => {
          const updated = [...scrapeHeaders]
          updated[index] = { ...updated[index], [field]: value }
          setConfig({ ...config, headers: updated })
        }

        const removeScrapeHeader = (index: number) => {
          const updated = scrapeHeaders.filter((_: any, i: number) => i !== index)
          setConfig({ ...config, headers: updated })
        }

        return (
          <div className="space-y-6">
            {/* URL */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-gray-400">
                URL
              </label>
              <input
                type="text"
                value={config.url || ''}
                onChange={(e) => setConfig({ ...config, url: e.target.value })}
                placeholder="https://example.com"
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono"
              />
            </div>

            {/* Wait Strategy */}
            <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">Estratégia de Espera</h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-400">
                    Aguardar por
                  </label>
                  <select
                    value={config.waitFor || 'networkidle2'}
                    onChange={(e) => setConfig({ ...config, waitFor: e.target.value })}
                    className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white"
                  >
                    <option value="networkidle0">Network Idle 0 (sem requisições)</option>
                    <option value="networkidle2">Network Idle 2 (máx 2 requisições)</option>
                    <option value="load">Evento Load</option>
                    <option value="domcontentloaded">DOM Content Loaded</option>
                    <option value="selector">Seletor CSS específico</option>
                  </select>
                </div>

                {config.waitFor === 'selector' && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400">
                      Seletor CSS
                    </label>
                    <input
                      type="text"
                      value={config.waitSelector || ''}
                      onChange={(e) => setConfig({ ...config, waitSelector: e.target.value })}
                      placeholder=".content, #main, div.class-name"
                      className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-400">
                    Timeout de Espera (ms)
                  </label>
                  <input
                    type="number"
                    value={config.waitTimeout || 30000}
                    onChange={(e) => setConfig({ ...config, waitTimeout: parseInt(e.target.value) })}
                    placeholder="30000"
                    className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500"
                  />
                </div>
              </div>
            </div>

            {/* Extract Data */}
            <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">Manipular Dados HTML</h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-400">
                    Seletor CSS (opcional)
                  </label>
                  <input
                    type="text"
                    value={config.extractSelector || ''}
                    onChange={(e) => setConfig({ ...config, extractSelector: e.target.value })}
                    placeholder=".content, #main, div.class-name"
                    className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Deixe vazio para extrair HTML completo da página
                  </p>
                </div>

                {config.extractSelector && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400">
                      Tipo de Extração
                    </label>
                    <select
                      value={config.extractType || 'html'}
                      onChange={(e) => setConfig({ ...config, extractType: e.target.value })}
                      className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white"
                    >
                      <option value="html">HTML (innerHTML)</option>
                      <option value="text">Texto (textContent)</option>
                      <option value="json">JSON (tenta parsear)</option>
                    </select>
                  </div>
                )}

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-xs text-blue-300 leading-relaxed">
                    💡 <strong>Dica:</strong> Use o script JavaScript acima para manipular os dados extraídos.
                    O HTML extraído estará disponível no contexto, e você pode processá-lo no script usando <code className="bg-blue-500/20 px-1 py-0.5 rounded font-mono">document.querySelector()</code> ou <code className="bg-blue-500/20 px-1 py-0.5 rounded font-mono">document.querySelectorAll()</code>.
                  </p>
                </div>
              </div>
            </div>

            {/* Execute Script */}
            <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-200">Executar Script (opcional)</h3>
                <button
                  onClick={() => {
                    if (!config.executeScript || !config.executeScript.trim()) {
                      setScrapeTestResult({ error: 'Por favor, insira algum código para testar' })
                      return
                    }

                    setTestingScrape(true)
                    setScrapeTestResult(null)

                    // Get HTML from multiple sources (priority order):
                    // 1. User-provided HTML in testHTML field
                    // 2. Real HTML from inputData (execution context)
                    let htmlToUse = testHTML.trim()

                    if (!htmlToUse) {
                      // Try multiple sources to find HTML

                      // Source 1: inputData.scrapeResponse.html
                      if (inputData?.scrapeResponse?.html) {
                        htmlToUse = inputData.scrapeResponse.html
                      }
                      // Source 2: inputData.html (direct)
                      else if (inputData?.html) {
                        htmlToUse = inputData.html
                      }
                      // Source 3: executionData.context.variables.scrapeResponse.html
                      else if (executionData?.context?.variables?.scrapeResponse?.html) {
                        htmlToUse = executionData.context.variables.scrapeResponse.html
                      }
                      // Source 4: Check executionLogs for previous HTTP_SCRAPE node output
                      else if (executionLogs && executionLogs.length > 0) {
                        // Find the most recent HTTP_SCRAPE node execution
                        for (let i = executionLogs.length - 1; i >= 0; i--) {
                          const log = executionLogs[i]
                          const logType = log.eventType || log.type
                          const nodeType = log.data?.nodeType || log.nodeType

                          if (logType === 'node.executed' && nodeType === 'HTTP_SCRAPE') {
                            const output = log.data?.output || log.output || {}
                            if (output.scrapeResponse?.html) {
                              htmlToUse = output.scrapeResponse.html
                              break
                            }
                            // Also check variables
                            const variables = log.data?.variables || log.variables || {}
                            if (variables.scrapeResponse?.html) {
                              htmlToUse = variables.scrapeResponse.html
                              break
                            }
                          }
                        }
                      }
                      // Source 5: inputData is a string
                      else if (typeof inputData === 'string') {
                        htmlToUse = inputData
                      }
                      // Source 6: Check all keys in inputData for scrapeResponse
                      else if (inputData && typeof inputData === 'object') {
                        for (const key in inputData) {
                          if (inputData[key]?.scrapeResponse?.html) {
                            htmlToUse = inputData[key].scrapeResponse.html
                            break
                          }
                          if (inputData[key]?.html) {
                            htmlToUse = inputData[key].html
                            break
                          }
                        }
                      }
                    }

                    // If no HTML found, show error
                    if (!htmlToUse) {
                      setScrapeTestResult({
                        error: 'Nenhum HTML disponível para teste. Execute o workflow primeiro ou cole o HTML no campo acima.',
                      })
                      setTestingScrape(false)
                      return
                    }

                    // Create mock variables context (similar to workflow execution)
                    // These variables would be available in the actual workflow
                    const mockScrapeResponse = {
                      url: config.url || 'https://example.com',
                      html: htmlToUse,
                      scriptResult: null,
                      screenshot: null,
                      title: 'Test Page',
                      timestamp: new Date().toISOString(),
                    }

                    const mockVariables = {
                      scrapeResponse: mockScrapeResponse,
                      contactTags: [],
                      triggerMessage: '',
                      // Add more mock variables as needed
                    }

                    // Execute code with variables available in scope
                    try {
                      // Wrap code to inject variables into scope
                      // This makes variables like scrapeResponse available in the user's code
                      const wrappedCode = `
                        // Variables available in workflow execution context
                        const scrapeResponse = ${JSON.stringify(mockScrapeResponse)};
                        const contactTags = ${JSON.stringify(mockVariables.contactTags)};
                        const triggerMessage = ${JSON.stringify(mockVariables.triggerMessage)};
                        
                        // Helper function to parse HTML from scrapeResponse.html
                        function parseHTML(htmlString) {
                          const parser = new DOMParser();
                          return parser.parseFromString(htmlString, 'text/html');
                        }
                        
                        // Helper: Get document from scrapeResponse.html
                        // Usage: const doc = getHTMLDocument(scrapeResponse.html);
                        function getHTMLDocument(htmlString) {
                          return parseHTML(htmlString);
                        }
                        
                        // Your code below - you can use scrapeResponse, contactTags, etc.
                        // IMPORTANT: 
                        // 1. The HTML is already in scrapeResponse.html - you just need to manipulate it!
                        // 2. Use parseHTML(scrapeResponse.html) to create a document from the HTML string
                        // 3. Don't use document directly - that refers to the current Puppeteer page, not scrapeResponse.html
                        // 4. Always return a value!
                        // 
                        // Example:
                        // const doc = parseHTML(scrapeResponse.html);
                        // const products = doc.querySelectorAll('.items-list');
                        // return Array.from(products).map(el => ({ text: el.textContent }));
                        ${config.executeScript}
                      `

                      const executeCode = new Function(wrappedCode)
                      const result = executeCode()

                      setScrapeTestResult({
                        success: true,
                        output: result,
                        note: 'Código executado com variáveis mock. No workflow, será executado na página carregada pelo Puppeteer com variáveis reais.',
                        variables: mockVariables,
                      })
                    } catch (error: any) {
                      setScrapeTestResult({
                        success: false,
                        error: error.message || 'Erro ao executar código',
                        note: 'Certifique-se de estar na página correta ou que os seletores existem.',
                        variables: mockVariables,
                      })
                    } finally {
                      setTestingScrape(false)
                    }
                  }}
                  disabled={testingScrape}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition flex items-center gap-2"
                >
                  {testingScrape ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Testando...
                    </>
                  ) : (
                    <>
                      ▶️ Testar Script
                    </>
                  )}
                </button>
              </div>

              {/* Campo opcional para HTML real de teste */}
              <div className="mb-4">
                <label className="block text-xs font-medium mb-1.5 text-gray-400">
                  HTML para Teste (opcional)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  {inputData?.scrapeResponse?.html || inputData?.html
                    ? '✅ Usando HTML real da execução. Cole aqui para sobrescrever.'
                    : 'Cole o HTML real do INPUT aqui para testar'}
                </p>
                <textarea
                  value={testHTML}
                  onChange={(e) => setTestHTML(e.target.value)}
                  placeholder={inputData?.scrapeResponse?.html || inputData?.html
                    ? "HTML real detectado! Cole aqui para sobrescrever..."
                    : "Cole o HTML aqui..."}
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500 font-mono text-xs"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-400">
                  Código JavaScript
                </label>
                <div className="bg-[#1e1e1e] border border-gray-700 rounded overflow-hidden">
                  <CodeEditor
                    value={config.executeScript || ''}
                    onChange={(e: any) => setConfig({ ...config, executeScript: e.target.value })}
                    language="javascript"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  O código será executado na página e o resultado será salvo em scriptResult.
                  Você pode usar variáveis como <code className="px-1 py-0.5 bg-gray-800 rounded text-primary font-mono">scrapeResponse</code>, <code className="px-1 py-0.5 bg-gray-800 rounded text-primary font-mono">contactTags</code>, etc.
                </p>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mt-2">
                  <p className="text-xs text-blue-300 mb-2">
                    💡 <strong>Manipular HTML:</strong> O HTML já está disponível em <code className="bg-blue-500/20 px-1 py-0.5 rounded font-mono">scrapeResponse.html</code>. Você só precisa manipulá-lo, não fazer scraping novamente!
                  </p>
                  <p className="text-xs text-yellow-300 mb-2 bg-yellow-500/10 p-2 rounded">
                    ⚠️ <strong>Importante:</strong> Use <code className="bg-yellow-500/20 px-1 py-0.5 rounded font-mono">parseHTML(scrapeResponse.html)</code> para criar um documento a partir do HTML da variável. <strong>Não use <code className="bg-yellow-500/20 px-1 py-0.5 rounded font-mono">document</code> diretamente</strong> - isso se refere à página atual do Puppeteer, não ao HTML que está na variável.
                  </p>
                  <pre className="text-xs text-blue-200 font-mono bg-black/30 p-2 rounded overflow-x-auto">
                    {`// O HTML já está em scrapeResponse.html - só precisa manipular!
// 1. Parse do HTML da variável (OBRIGATÓRIO!)
const doc = parseHTML(scrapeResponse.html);

// 2. Encontrar elementos (ajuste o seletor conforme necessário)
const products = doc.querySelectorAll('.items-list');

// 3. Extrair dados e RETORNAR o resultado
const produtos = Array.from(products).map((product, index) => {
  const title = product.querySelector('h2.title, .title, [class*="title"]')?.textContent?.trim() || '';
  const price = product.querySelector('.price, [class*="price"]')?.textContent?.trim() || '';
  const link = product.querySelector('a')?.href || '';
  const image = product.querySelector('img')?.src || '';
  
  return {
    index: index + 1,
    title,
    price,
    link,
    image
  };
});

// 4. IMPORTANTE: Sempre retorne um valor!
return produtos;`}
                  </pre>
                  <p className="text-xs text-gray-400 mt-2">
                    O resultado será salvo em <code className="bg-gray-800 px-1 py-0.5 rounded font-mono">scriptResult</code> e estará disponível para os próximos nodes.
                  </p>
                </div>

                {/* Test Result */}
                {scrapeTestResult && (
                  <div className={`mt-4 border rounded-lg p-3 ${scrapeTestResult.error || !scrapeTestResult.success
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-green-500/10 border-green-500/30'
                    }`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className={`text-xs font-semibold ${scrapeTestResult.error || !scrapeTestResult.success ? 'text-red-300' : 'text-green-300'
                        }`}>
                        {scrapeTestResult.error || !scrapeTestResult.success ? '❌ Erro' : '✅ Sucesso'}
                      </h4>
                      <button
                        onClick={() => setScrapeTestResult(null)}
                        className="text-gray-400 hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    </div>
                    {scrapeTestResult.error ? (
                      <div>
                        <div className="text-xs text-red-300 font-mono bg-black/30 p-2 rounded mb-2">
                          {scrapeTestResult.error}
                        </div>
                        {scrapeTestResult.note && (
                          <div className="text-xs text-yellow-300 bg-yellow-500/10 p-2 rounded">
                            {scrapeTestResult.note}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        {scrapeTestResult.note && (
                          <div className="text-xs text-blue-300 mb-2 bg-blue-500/10 p-2 rounded">
                            {scrapeTestResult.note}
                          </div>
                        )}
                        {scrapeTestResult.variables && (
                          <div className="text-xs text-gray-400 mb-2">
                            Variáveis disponíveis: <code className="text-blue-300">scrapeResponse</code>, <code className="text-blue-300">contactTags</code>, <code className="text-blue-300">triggerMessage</code>
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mb-1">Output:</div>
                        <pre className="text-xs text-green-300 font-mono bg-black/30 p-2 rounded overflow-x-auto max-h-40 overflow-y-auto">
                          {JSON.stringify(scrapeTestResult.output, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Headers */}
            <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-200">Headers Customizados</h3>
                <button
                  onClick={addScrapeHeader}
                  className="px-3 py-1.5 bg-primary text-black rounded text-xs font-semibold hover:bg-primary/80 transition"
                >
                  + Adicionar
                </button>
              </div>

              <div className="space-y-2">
                {scrapeHeaders.map((header: any, index: number) => (
                  <div key={index} className="grid grid-cols-12 gap-2">
                    <input
                      type="text"
                      value={header.key}
                      onChange={(e) => updateScrapeHeader(index, 'key', e.target.value)}
                      placeholder="User-Agent"
                      className="col-span-5 px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500"
                    />
                    <input
                      type="text"
                      value={header.value}
                      onChange={(e) => updateScrapeHeader(index, 'value', e.target.value)}
                      placeholder="Mozilla/5.0..."
                      className="col-span-6 px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono"
                    />
                    <button
                      onClick={() => removeScrapeHeader(index)}
                      className="col-span-1 text-red-400 hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {scrapeHeaders.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-2">Nenhum header adicionado</p>
                )}
              </div>
            </div>

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
                    value={config.saveResponseAs || 'scrapeResponse'}
                    onChange={(e) => setConfig({ ...config, saveResponseAs: e.target.value })}
                    placeholder="scrapeResponse"
                    className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-400">
                    Timeout Total (ms)
                  </label>
                  <input
                    type="number"
                    value={config.timeout || 60000}
                    onChange={(e) => setConfig({ ...config, timeout: parseInt(e.target.value) })}
                    placeholder="60000"
                    className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400">
                      Largura do Viewport
                    </label>
                    <input
                      type="number"
                      value={config.viewport?.width || 1920}
                      onChange={(e) => setConfig({
                        ...config,
                        viewport: {
                          ...config.viewport,
                          width: parseInt(e.target.value) || 1920
                        }
                      })}
                      className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400">
                      Altura do Viewport
                    </label>
                    <input
                      type="number"
                      value={config.viewport?.height || 1080}
                      onChange={(e) => setConfig({
                        ...config,
                        viewport: {
                          ...config.viewport,
                          height: parseInt(e.target.value) || 1080
                        }
                      })}
                      className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.screenshot || false}
                    onChange={(e) => setConfig({ ...config, screenshot: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-700 bg-[#1a1a1a] text-primary focus:ring-primary"
                  />
                  <label className="text-xs text-gray-400">
                    Capturar screenshot da página
                  </label>
                </div>
              </div>
            </div>

            {/* Help Text */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-xs text-blue-300 leading-relaxed">
                💡 <strong>Dica:</strong> Este node usa um navegador headless para renderizar páginas com JavaScript.
                Use <code className="bg-blue-500/20 px-1 py-0.5 rounded">{'{{variables.nome}}'}</code> para interpolar variáveis na URL e scripts.
                A resposta será salva em <code className="bg-blue-500/20 px-1 py-0.5 rounded">variables.{config.saveResponseAs || 'scrapeResponse'}</code> com os campos: html, scriptResult, screenshot, title e timestamp.
              </p>
            </div>
          </div>
        )

      case 'PIX_RECOGNITION':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-gray-400">
                URL da Imagem (ou variável)
              </label>
              <input
                type="text"
                value={config.imageUrl || ''}
                onChange={(e) => setConfig({ ...config, imageUrl: e.target.value })}
                placeholder="{{triggerMessage.media.url}}"
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">
                Deixe vazio para usar a mídia da última mensagem recebida automaticamente.
              </p>
            </div>

            <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">Validação de Valor</h3>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="validateAmount"
                    checked={config.validateAmount || false}
                    onChange={(e) => setConfig({ ...config, validateAmount: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-700 bg-[#1a1a1a] text-primary focus:ring-primary"
                  />
                  <label htmlFor="validateAmount" className="text-xs text-gray-300">
                    Validar se o valor pago está correto
                  </label>
                </div>

                {config.validateAmount && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400">
                      Valor Esperado (R$)
                    </label>
                    <input
                      type="text"
                      value={config.expectedAmount || ''}
                      onChange={(e) => setConfig({ ...config, expectedAmount: e.target.value })}
                      placeholder="150.00 ou {{variables.total}}"
                      className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#151515] border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">Opções de Saída</h3>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-400">
                  Salvar resultado como
                </label>
                <input
                  type="text"
                  value={config.saveResponseAs || 'pixResult'}
                  onChange={(e) => setConfig({ ...config, saveResponseAs: e.target.value })}
                  placeholder="pixResult"
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white placeholder-gray-500 font-mono"
                />
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-xs text-blue-300 leading-relaxed">
                💡 <strong>Como funciona:</strong> Este node processa a imagem usando OCR local para extrair Valor, Data e ID da Transação.
                Ele funciona melhor com comprovantes nítidos do Nubank, Itaú, Banco do Brasil e outros bancos populares.
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
                      <p className="text-xs mt-1">Clique em &quot;Adicionar Campo&quot; para começar</p>
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

      case 'COMMAND':
        return (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-200">
                  Comando
                </label>
                <button
                  onClick={async () => {
                    if (!config.command || !config.command.trim()) {
                      setCommandTestResult({ error: 'Por favor, insira um comando para testar' })
                      return
                    }

                    if (!executionData?.id) {
                      setCommandTestResult({ error: 'Nenhuma execução encontrada. Execute o workflow primeiro para testar o comando.' })
                      return
                    }

                    // Save config first
                    await onSave(node.id, config)
                    await new Promise(resolve => setTimeout(resolve, 300))

                    setTestingCommand(true)
                    setCommandTestResult(null)

                    try {
                      const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '')
                      const response = await fetch(`${API_URL}/api/workflows/${executionData.workflowId}/test-node?tenantId=${tenantId}&nodeId=${node.id}&executionId=${executionData.id}`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          tenantId,
                          nodeId: node.id,
                          executionId: executionData.id,
                          nodeConfig: config,
                        }),
                      })

                      if (!response.ok) {
                        let errorMessage = 'Failed to test command'
                        try {
                          const errorData = await response.json()
                          errorMessage = errorData.message || errorData.error || errorMessage
                        } catch {
                          const text = await response.text().catch(() => '')
                          errorMessage = text || errorMessage
                        }
                        throw new Error(errorMessage)
                      }

                      const result = await response.json()

                      // Wait a bit for execution to complete and then fetch logs
                      await new Promise(resolve => setTimeout(resolve, 1000))

                      // Fetch execution logs to get the actual output
                      const logsResponse = await fetch(`${API_URL}/api/executions/${executionData.id}/logs?tenantId=${tenantId}`)
                      const logsData = await logsResponse.json()

                      // Find the log entry for this node execution
                      const nodeLog = logsData.find((log: any) =>
                        log.nodeId === node.id &&
                        (log.eventType === 'node.executed' || log.type === 'node.executed')
                      )

                      if (nodeLog?.data?.output) {
                        setCommandTestResult({
                          success: true,
                          output: nodeLog.data.output,
                          stdout: nodeLog.data.output.stdout || '',
                          stderr: nodeLog.data.output.stderr || '',
                          exitCode: nodeLog.data.output.exitCode || 0,
                          command: nodeLog.data.output.command || config.command,
                        })
                      } else {
                        setCommandTestResult({
                          success: true,
                          output: result,
                          note: 'Comando executado. Verifique os logs para mais detalhes.',
                        })
                      }
                    } catch (error: any) {
                      setCommandTestResult({
                        success: false,
                        error: error.message || 'Erro ao executar comando',
                      })
                    } finally {
                      setTestingCommand(false)
                    }
                  }}
                  disabled={testingCommand}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition flex items-center gap-2"
                >
                  {testingCommand ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Testando...
                    </>
                  ) : (
                    <>
                      ▶️ Testar
                    </>
                  )}
                </button>
              </div>
              <textarea
                value={config.command || ''}
                onChange={(e) => setConfig({ ...config, command: e.target.value })}
                placeholder="curl -X GET https://api.example.com/data"
                rows={6}
                className="w-full px-4 py-3 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary resize-none text-white placeholder-gray-500 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Cole o comando completo aqui. Suporta variáveis como <code className="px-1.5 py-0.5 bg-gray-800 rounded text-primary">{`{{variables.url}}`}</code>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">
                Timeout (ms)
              </label>
              <input
                type="number"
                value={config.timeout || 30000}
                onChange={(e) => setConfig({ ...config, timeout: parseInt(e.target.value) || 30000 })}
                placeholder="30000"
                min="1000"
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Tempo máximo de execução em milissegundos (padrão: 30000 = 30 segundos)
              </p>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <p className="text-xs text-yellow-300 leading-relaxed">
                ⚠️ <strong>Atenção:</strong> Este node executa comandos do sistema. Use com cuidado e apenas comandos confiáveis.
              </p>
            </div>

            {/* Test Result */}
            {commandTestResult && (
              <div className={`border rounded-lg p-4 ${commandTestResult.error || !commandTestResult.success
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-green-500/10 border-green-500/30'
                }`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className={`text-sm font-semibold ${commandTestResult.error || !commandTestResult.success ? 'text-red-300' : 'text-green-300'
                    }`}>
                    {commandTestResult.error || !commandTestResult.success ? '❌ Erro' : '✅ Sucesso'}
                  </h4>
                  <button
                    onClick={() => setCommandTestResult(null)}
                    className="text-gray-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                </div>
                {commandTestResult.error ? (
                  <div className="text-xs text-red-300 font-mono bg-black/30 p-2 rounded">
                    {commandTestResult.error}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {commandTestResult.command && (
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Comando executado:</div>
                        <div className="text-xs text-gray-300 font-mono bg-black/30 p-2 rounded">
                          {commandTestResult.command}
                        </div>
                      </div>
                    )}
                    {commandTestResult.exitCode !== undefined && (
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Código de saída:</div>
                        <div className={`text-xs font-mono bg-black/30 p-2 rounded ${commandTestResult.exitCode === 0 ? 'text-green-300' : 'text-red-300'}`}>
                          {commandTestResult.exitCode}
                        </div>
                      </div>
                    )}
                    {commandTestResult.stdout && (
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Saída (stdout):</div>
                        <pre className="text-xs text-green-300 font-mono bg-black/30 p-2 rounded overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                          {commandTestResult.stdout}
                        </pre>
                      </div>
                    )}
                    {commandTestResult.stderr && (
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Erro (stderr):</div>
                        <pre className="text-xs text-red-300 font-mono bg-black/30 p-2 rounded overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                          {commandTestResult.stderr}
                        </pre>
                      </div>
                    )}
                    {commandTestResult.note && (
                      <div className="text-xs text-gray-400 italic">
                        {commandTestResult.note}
                      </div>
                    )}
                    {commandTestResult.output && !commandTestResult.stdout && !commandTestResult.stderr && (
                      <div>
                        <div className="text-xs text-gray-400 mb-2">Output:</div>
                        <pre className="text-xs text-green-300 font-mono bg-black/30 p-3 rounded overflow-x-auto max-h-48 overflow-y-auto">
                          {JSON.stringify(commandTestResult.output, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">
                  Variável de Saída
                </label>
                <input
                  type="text"
                  value={config.saveOutputAs || 'commandOutput'}
                  onChange={(e) => setConfig({ ...config, saveOutputAs: e.target.value })}
                  placeholder="commandOutput"
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">
                  Variável de Erro
                </label>
                <input
                  type="text"
                  value={config.saveErrorAs || 'commandError'}
                  onChange={(e) => setConfig({ ...config, saveErrorAs: e.target.value })}
                  placeholder="commandError"
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-200">
                  Variável de Código de Saída
                </label>
                <input
                  type="text"
                  value={config.saveExitCodeAs || 'commandExitCode'}
                  onChange={(e) => setConfig({ ...config, saveExitCodeAs: e.target.value })}
                  placeholder="commandExitCode"
                  className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500 font-mono text-sm"
                />
              </div>
            </div>
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
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-200">
                  Código JavaScript
                </label>
                <button
                  onClick={() => {
                    if (!config.code || !config.code.trim()) {
                      setCodeTestResult({ error: 'Por favor, insira algum código para testar' })
                      return
                    }

                    setTestingCode(true)
                    setCodeTestResult(null)

                    try {
                      // Use real variables from previous nodes (executionData or inputData)
                      // Also merge output from previous node so stdout, stderr, etc. are available
                      const previousOutput = executionData?.context?.output || {}
                      const realVariables = {
                        ...previousOutput,
                        ...(executionData?.context?.variables || inputData || {})
                      }
                      const realGlobals = executionData?.context?.globals || { tenantId: tenantId || 'demo-tenant' }
                      const realInput = executionData?.context?.input || inputData || {}

                      // Helper functions (matching backend implementation)
                      const parseHTML = (htmlString: string) => {
                        const parser = new DOMParser();
                        return parser.parseFromString(htmlString, 'text/html');
                      }

                      const getHTMLDocument = (htmlString: string) => {
                        return parseHTML(htmlString);
                      }

                      const nodeListToArray = (nodeList: any) => {
                        return Array.from(nodeList);
                      }

                      // Enhanced helper functions for easier HTML manipulation
                      const createHelpers = (htmlString: string) => {
                        const doc = parseHTML(htmlString);

                        return {
                          // querySelector shortcut - returns first matching element
                          $: (selector: string) => doc.querySelector(selector),

                          // querySelectorAll shortcut - returns array of matching elements
                          $$: (selector: string) => Array.from(doc.querySelectorAll(selector)),

                          // Get text content from selector or element
                          getText: (selectorOrElement: string | any) => {
                            const el = typeof selectorOrElement === 'string'
                              ? doc.querySelector(selectorOrElement)
                              : selectorOrElement;
                            return el?.textContent?.trim() || '';
                          },

                          // Get attribute from selector or element
                          getAttr: (selectorOrElement: string | any, attrName: string) => {
                            const el = typeof selectorOrElement === 'string'
                              ? doc.querySelector(selectorOrElement)
                              : selectorOrElement;
                            return el?.getAttribute(attrName) || '';
                          },

                          // Map over elements and extract data
                          mapElements: (selector: string, mapFn: (el: any, index: number) => any) => {
                            const elements = Array.from(doc.querySelectorAll(selector));
                            return elements.map(mapFn);
                          },

                          // Get all text from multiple elements
                          getAllText: (selector: string) => {
                            const elements = Array.from(doc.querySelectorAll(selector));
                            return elements.map(el => el.textContent?.trim() || '');
                          },

                          // Get all attributes from multiple elements
                          getAllAttrs: (selector: string, attrName: string) => {
                            const elements = Array.from(doc.querySelectorAll(selector));
                            return elements.map(el => el.getAttribute(attrName) || '');
                          },

                          // Direct access to document for advanced queries
                          doc,
                        };
                      };

                      // Wrap code to inject variables and helper functions into scope
                      const wrappedCode = `
                        return (function(parseHTMLParam, getHTMLDocumentParam, nodeListToArrayParam, createHelpersParam) {
                          // Make helper functions available in this scope
                          const parseHTML = parseHTMLParam;
                          const getHTMLDocument = getHTMLDocumentParam;
                          const nodeListToArray = nodeListToArrayParam;
                          
                          // Inject variables directly into scope for easier access
                          const scrapeResponse = variables.scrapeResponse || null;
                          const contactTags = variables.contactTags || [];
                          const triggerMessage = variables.triggerMessage || '';
                          
                          // Create HTML helpers if scrapeResponse.html exists
                          const html = scrapeResponse?.html || null;
                          const helpers = html ? createHelpersParam(html) : {
                            $: () => null,
                            $$: () => [],
                            getText: () => '',
                            getAttr: () => '',
                            mapElements: () => [],
                            getAllText: () => [],
                            getAllAttrs: () => [],
                            doc: null
                          };
                          
                          // Destructure helpers for easy access (always available now)
                          const $ = helpers.$;
                          const $$ = helpers.$$;
                          const getText = helpers.getText;
                          const getAttr = helpers.getAttr;
                          const mapElements = helpers.mapElements;
                          const getAllText = helpers.getAllText;
                          const getAllAttrs = helpers.getAllAttrs;
                          const doc = helpers.doc;
                          
                          // Make all variables available at root level
                          ${Object.keys(realVariables).map(key => {
                        if (['scrapeResponse', 'contactTags', 'triggerMessage'].includes(key)) {
                          return '';
                        }
                        return `const ${key} = variables.${key};`;
                      }).filter(Boolean).join('\n')}
                          
                          // Helper functions are available in this scope
                          ${config.code}
                        })(parseHTML, getHTMLDocument, nodeListToArray, createHelpers);
                      `

                      // Execute code using Function constructor (safer than eval)
                      const executeCode = new Function('variables', 'globals', 'input', 'parseHTML', 'getHTMLDocument', 'nodeListToArray', 'createHelpers', wrappedCode)
                      const result = executeCode(realVariables, realGlobals, realInput, parseHTML, getHTMLDocument, nodeListToArray, createHelpers)

                      setCodeTestResult({
                        success: true,
                        output: result,
                        note: realVariables.scrapeResponse
                          ? 'Código testado com variáveis reais do node anterior.'
                          : 'Código testado. Variáveis do node anterior não disponíveis.',
                      })
                    } catch (error: any) {
                      setCodeTestResult({
                        success: false,
                        error: error.message || 'Erro ao executar código',
                      })
                    } finally {
                      setTestingCode(false)
                    }
                  }}
                  disabled={testingCode}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition flex items-center gap-2"
                >
                  {testingCode ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Testando...
                    </>
                  ) : (
                    <>
                      ▶️ Testar
                    </>
                  )}
                </button>
              </div>
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

              {/* Test Result */}
              {codeTestResult && (
                <div className={`mt-4 border rounded-lg p-4 ${codeTestResult.error || !codeTestResult.success
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-green-500/10 border-green-500/30'
                  }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className={`text-sm font-semibold ${codeTestResult.error || !codeTestResult.success ? 'text-red-300' : 'text-green-300'
                      }`}>
                      {codeTestResult.error || !codeTestResult.success ? '❌ Erro' : '✅ Sucesso'}
                    </h4>
                    <button
                      onClick={() => setCodeTestResult(null)}
                      className="text-gray-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  </div>
                  {codeTestResult.error ? (
                    <div className="text-xs text-red-300 font-mono bg-black/30 p-2 rounded">
                      {codeTestResult.error}
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs text-gray-400 mb-2">Output:</div>
                      <pre className="text-xs text-green-300 font-mono bg-black/30 p-3 rounded overflow-x-auto max-h-48 overflow-y-auto">
                        {JSON.stringify(codeTestResult.output, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
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

      case 'MARK_STAGE':
        const stagePresets = [
          { name: 'Quente', emoji: '🔥', color: '#ef4444' }, // Red-500
          { name: 'Frio', emoji: '❄️', color: '#3b82f6' }, // Blue-500
          { name: 'Pronto pra comprar', emoji: '💰', color: '#22c55e' }, // Green-500
          { name: 'Interesse', emoji: '👀', color: '#eab308' }, // Yellow-500
          { name: 'Convertido', emoji: '✅', color: '#00ba7c' }, // Primary
          { name: 'Perdido', emoji: '❌', color: '#6b7280' }, // Gray-500
          { name: 'Em dúvida', emoji: '🤔', color: '#f97316' }, // Orange-500
          { name: 'Aguardando retorno', emoji: '📞', color: '#a855f7' }, // Purple-500
        ]

        return (
          <div className="space-y-8">
            <div>
              <label className="block text-sm font-medium mb-4 text-gray-200">
                Escolha uma etapa pré-definida:
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {stagePresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setConfig({
                      ...config,
                      stageName: preset.name,
                      emoji: preset.emoji,
                      color: preset.color,
                      isCustom: false
                    })}
                    className={`
                      p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2
                      ${config.stageName === preset.name && !config.isCustom
                        ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(0,186,124,0.2)]'
                        : 'border-gray-800 bg-[#151515] hover:border-gray-600'
                      }
                    `}
                  >
                    <span className="text-2xl">{preset.emoji}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-center line-clamp-1">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-medium text-gray-200">
                  Ou personalize livremente:
                </label>
                {!config.isCustom && (
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, isCustom: true })}
                    className="text-xs text-primary hover:underline"
                  >
                    Habilitar edição manual
                  </button>
                )}
              </div>

              <div className={`space-y-6 transition-opacity ${!config.isCustom ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400">
                      Nome da Etapa
                    </label>
                    <input
                      type="text"
                      value={config.stageName || ''}
                      onChange={(e) => setConfig({ ...config, stageName: e.target.value, isCustom: true })}
                      placeholder="Ex: Lead Qualificado VIP"
                      className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400">
                      Emoji/Ícone
                    </label>
                    <input
                      type="text"
                      value={config.emoji || ''}
                      onChange={(e) => setConfig({ ...config, emoji: e.target.value, isCustom: true })}
                      placeholder="💡"
                      className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white text-center text-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-3 text-gray-400">
                    Cor da Etapa
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={config.color || '#00ba7c'}
                      onChange={(e) => setConfig({ ...config, color: e.target.value, isCustom: true })}
                      className="w-12 h-12 bg-transparent border-none cursor-pointer rounded overflow-hidden"
                    />
                    <input
                      type="text"
                      value={config.color || '#00ba7c'}
                      onChange={(e) => setConfig({ ...config, color: e.target.value, isCustom: true })}
                      className="flex-1 px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white font-mono text-sm uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex gap-4 items-start mt-8">
              <div className={`w-12 h-12 shrink-0 rounded-lg flex items-center justify-center text-2xl shadow-lg`} style={{ backgroundColor: `${config.color || '#00ba7c'}20`, border: `2px solid ${config.color || '#00ba7c'}` }}>
                {config.emoji || '🚩'}
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-0.5">Preview da Etapa</h4>
                <p className="text-xs text-gray-400">
                  Esta etapa aparecerá como <span className="text-white font-medium">&quot;{config.stageName || 'Nova Etapa'}&quot;</span> no funil do Insights.
                </p>
              </div>
            </div>
          </div>
        )

      case 'SEND_CONTACT':
        return (
          <div className="space-y-6">
            <div className="bg-[#1a2535] border border-blue-700/30 rounded-lg p-4">
              <div className="flex items-start gap-4">
                <div className="text-3xl">👤</div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white mb-1">Enviar Contato</h3>
                  <p className="text-xs text-gray-400">
                    Envia um cartão de contato. O destinatário verá os botões &quot;Salvar&quot; e &quot;Conversar&quot; nativamente no WhatsApp.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">Nome do Contato</label>
              <input
                type="text"
                value={config.nome || ''}
                onChange={(e) => setConfig({ ...config, nome: e.target.value })}
                placeholder="Ex: João Silva"
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">Telefone (com DDD e código do país)</label>
              <input
                type="text"
                value={config.telefone || ''}
                onChange={(e) => setConfig({ ...config, telefone: e.target.value })}
                placeholder="Ex: 5511999998888"
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">Use somente números. Ex: 5511999998888 (55 = Brasil)</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-200">Empresa / Cargo <span className="text-gray-500 font-normal">(opcional)</span></label>
              <input
                type="text"
                value={config.empresa || ''}
                onChange={(e) => setConfig({ ...config, empresa: e.target.value })}
                placeholder="Ex: Suporte X1Bot"
                className="w-full px-4 py-2.5 bg-[#151515] border border-gray-700 rounded focus:outline-none focus:border-primary text-white placeholder-gray-500"
              />
            </div>

            {(config.nome || config.telefone) && (
              <div className="bg-[#0f1f2e] border border-blue-800/40 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">Preview do cartão</p>
                <div className="bg-[#1a2535] border border-blue-700/20 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {(config.nome || 'C')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{config.nome || 'Nome do Contato'}</p>
                    {config.empresa && <p className="text-gray-400 text-xs truncate">{config.empresa}</p>}
                    <p className="text-gray-500 text-xs truncate">+{(config.telefone || '').replace(/\D/g, '')}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <div className="flex-1 bg-[#1e3a4a] border border-blue-700/30 rounded-lg py-1.5 text-center text-xs text-blue-300 font-medium">Salvar</div>
                  <div className="flex-1 bg-[#1e3a4a] border border-blue-700/30 rounded-lg py-1.5 text-center text-xs text-blue-300 font-medium">Conversar</div>
                </div>
              </div>
            )}
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
            className={`px-3 py-1.5 text-[11px] font-medium transition relative ${activeTab === 'parameters'
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
            className={`px-3 py-1.5 text-[11px] font-medium transition relative ${activeTab === 'settings'
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
            className={`w-full px-4 py-2 rounded text-xs font-semibold transition flex items-center justify-center gap-2 ${saveSuccess
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
            className={`px-6 py-3 text-sm font-medium transition relative ${activeTab === 'parameters'
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
            className={`px-6 py-3 text-sm font-medium transition relative ${activeTab === 'settings'
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
            <div className="space-y-6">
              <div className="text-sm text-gray-400">
                <p>Configurações adicionais para este node.</p>
              </div>

              {node.type === WorkflowNodeType.SEND_PIX && (
                <div className="space-y-6">
                  <div className="bg-[#151515] border border-gray-700 rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-700 pb-4">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-200">Enviar mensagens automáticas</h3>
                        <p className="text-[10px] text-gray-500">Envia uma mensagem ao receber comprovante e ao expirar o tempo</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, enviarMensagensAutomaticas: !config.enviarMensagensAutomaticas })}
                        className={`w-12 h-6 rounded-full transition-all relative ${config.enviarMensagensAutomaticas ? 'bg-primary' : 'bg-gray-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${config.enviarMensagensAutomaticas ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    {config.enviarMensagensAutomaticas && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div>
                          <label className="block text-xs font-medium mb-1.5 text-gray-400">
                            Mensagem ao receber comprovante
                          </label>
                          <textarea
                            value={config.mensagemConfirmacao || ''}
                            onChange={(e) => setConfig({ ...config, mensagemConfirmacao: e.target.value })}
                            placeholder="✅ Comprovante recebido! Em breve confirmaremos seu pagamento."
                            rows={2}
                            className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium mb-1.5 text-gray-400">
                            Mensagem ao expirar (Timeout)
                          </label>
                          <textarea
                            value={config.mensagemTimeout || ''}
                            onChange={(e) => setConfig({ ...config, mensagemTimeout: e.target.value })}
                            placeholder="⏰ Seu PIX expirou. Entre em contato para gerar um novo."
                            rows={2}
                            className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white resize-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-[#151515] border border-gray-700 rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-200">Reenviar PIX automaticamente</h3>
                        <p className="text-[10px] text-gray-500">Reenvia a cobrança se o tempo expirar sem pagamento</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, autoRetry: !config.autoRetry })}
                        className={`w-12 h-6 rounded-full transition-all relative ${config.autoRetry ? 'bg-primary' : 'bg-gray-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${config.autoRetry ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    {config.autoRetry && (
                      <div className="pt-2">
                        <label className="block text-xs font-medium mb-1.5 text-gray-400">
                          Número de tentativas de reenvio
                        </label>
                        <input
                          type="number"
                          value={config.retryCount || 1}
                          onChange={(e) => setConfig({ ...config, retryCount: parseInt(e.target.value) || 1 })}
                          min="1"
                          max="5"
                          className="w-24 px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-sm text-white"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-[#151515] border border-gray-700 rounded p-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm font-medium">Always Output Data</span>
                    <p className="text-[10px] text-gray-500">Garante que o node sempre retorne um objeto de output</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.alwaysOutputData}
                    onChange={(e) => setConfig({ ...config, alwaysOutputData: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-700 bg-black text-primary focus:ring-0"
                  />
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
            className={`px-8 py-2 rounded font-semibold transition shadow-lg flex items-center gap-2 ${saveSuccess
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

