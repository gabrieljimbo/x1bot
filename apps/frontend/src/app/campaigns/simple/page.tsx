'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Play, Pause, Trash2, Edit2, BarChart2, X,
  Send, Upload, Phone, List, RefreshCw, Tag, Smartphone, Shuffle, AlignJustify, GitBranch
} from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { AuthGuard } from '@/components/AuthGuard'
import AppHeader from '@/components/AppHeader'
import CampaignsSidebar from '@/components/campaigns/CampaignsSidebar'

type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED'

interface Campaign {
  id: string
  name: string
  type: 'SIMPLE' | 'WORKFLOW'
  workflowId?: string | null
  status: CampaignStatus
  scheduledAt?: string
  startedAt?: string
  completedAt?: string
  limitPerSession: number
  delayMin: number
  delayMax: number
  randomOrder: boolean
  excludeBlocked: boolean
  createdAt: string
  messages: { id: string; order: number; type: string; content?: string; mediaUrl?: string; caption?: string }[]
  sessions: { id: string; sessionId: string }[]
  contactLists: { id: string; contactList: { name: string } }[]
  _count: { recipients: number }
}

interface Workflow { id: string; name: string; isActive: boolean }

interface Stats {
  total: number; sent: number; failed: number; blocked: number; pending: number; progress: number
}

interface Session { id: string; name: string; status: string; phoneNumber?: string }
interface ContactList { id: string; name: string; _count: { contacts: number } }

const STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: 'Rascunho', SCHEDULED: 'Agendada', RUNNING: 'Em andamento',
  PAUSED: 'Pausada', COMPLETED: 'Concluída', FAILED: 'Falhou',
}
const STATUS_COLORS: Record<CampaignStatus, string> = {
  DRAFT: 'bg-gray-500/20 text-gray-400',
  SCHEDULED: 'bg-blue-500/20 text-blue-400',
  RUNNING: 'bg-green-500/20 text-green-400',
  PAUSED: 'bg-yellow-500/20 text-yellow-400',
  COMPLETED: 'bg-purple-500/20 text-purple-400',
  FAILED: 'bg-red-500/20 text-red-400',
}

function StatsModal({ campaignId, onClose }: { campaignId: string; onClose: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null)

  const load = useCallback(async () => {
    try { setStats(await apiClient.getCampaignStats(campaignId)) } catch { /* noop */ }
  }, [campaignId])

  useEffect(() => {
    load()
    const iv = setInterval(load, 5000)
    return () => clearInterval(iv)
  }, [load])

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-white font-bold text-lg">Progresso da Campanha</h2>
          <div className="flex gap-2">
            <button onClick={load} className="text-gray-400 hover:text-white"><RefreshCw size={16} /></button>
            <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
          </div>
        </div>
        <div className="p-6">
          {!stats ? (
            <p className="text-gray-400 text-center py-6">Carregando...</p>
          ) : (
            <div className="space-y-4">
              <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-[#00ff88] rounded-full transition-all" style={{ width: `${stats.progress}%` }} />
              </div>
              <p className="text-center text-[#00ff88] font-bold text-3xl">{stats.progress}%</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total', value: stats.total, color: 'text-white' },
                  { label: 'Enviados', value: stats.sent, color: 'text-green-400' },
                  { label: 'Pendentes', value: stats.pending, color: 'text-yellow-400' },
                  { label: 'Falhos', value: stats.failed, color: 'text-red-400' },
                  { label: 'Bloqueados', value: stats.blocked, color: 'text-orange-400' },
                ].map(item => (
                  <div key={item.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                    <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-gray-500">{item.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 text-center">Atualiza a cada 5 segundos</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface InternalTag { tag: string; count: number }
interface WaLabel { id: string; name: string; color: string; count: number }

function CampaignDrawer({
  initial, onSave, onClose,
}: {
  initial?: Campaign; onSave: (data: any) => Promise<any>; onClose: () => void
}) {
  const [tab, setTab] = useState<'content' | 'recipients' | 'sessions' | 'settings'>('content')
  const [sessions, setSessions] = useState<Session[]>([])
  const [contactLists, setContactLists] = useState<ContactList[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [campaignType, setCampaignType] = useState<'SIMPLE' | 'WORKFLOW'>(initial?.type ?? 'SIMPLE')
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(initial?.workflowId ?? '')
  const [saving, setSaving] = useState(false)
  const [campaignId, setCampaignId] = useState<string | null>(initial?.id ?? null)
  const [recipientResult, setRecipientResult] = useState<string | null>(null)
  const [recipientMode, setRecipientMode] = useState<'phones' | 'csv' | 'inbox' | 'list'>('phones')

  // Tags/labels for inbox mode
  const [internalTags, setInternalTags] = useState<InternalTag[]>([])
  const [waLabels, setWaLabels] = useState<WaLabel[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([])
  const [loadingTags, setLoadingTags] = useState(false)

  const [form, setForm] = useState({
    name: initial?.name ?? '',
    limitPerSession: initial?.limitPerSession ?? 50,
    delayMin: initial?.delayMin ?? 5,
    delayMax: initial?.delayMax ?? 30,
    randomOrder: initial?.randomOrder ?? true,
    excludeBlocked: initial?.excludeBlocked ?? true,
    scheduledAt: initial?.scheduledAt ? initial.scheduledAt.slice(0, 16) : '',
    sessionIds: initial?.sessions?.map(s => s.sessionId) ?? [],
    messages: (initial?.messages ?? [{ order: 0, type: 'text', content: '', mediaUrl: '', caption: '' }]) as { id?: string; order: number; type: string; content?: string; mediaUrl?: string; caption?: string }[],
  })

  const [phonesText, setPhonesText] = useState('')
  const [csvText, setCsvText] = useState('')
  const [selectedListId, setSelectedListId] = useState('')

  useEffect(() => {
    apiClient.getWhatsappSessions().then(setSessions).catch(() => {})
    apiClient.getContactLists().then(setContactLists).catch(() => {})
    apiClient.getCampaignWorkflowsList().then(setWorkflows).catch(() => {})
  }, [])

  useEffect(() => {
    if (recipientMode !== 'inbox') return
    setLoadingTags(true)
    Promise.all([
      apiClient.getCampaignTags().catch(() => [] as InternalTag[]),
      apiClient.getCampaignWhatsappLabels().catch(() => [] as WaLabel[]),
    ]).then(([tags, labels]) => {
      setInternalTags(tags)
      setWaLabels(labels)
    }).finally(() => setLoadingTags(false))
  }, [recipientMode])

  const toggleTag = (tag: string) =>
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])

  const toggleLabel = (id: string) =>
    setSelectedLabelIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])

  const selectedTotal = [
    ...internalTags.filter(t => selectedTags.includes(t.tag)).map(t => t.count),
    ...waLabels.filter(l => selectedLabelIds.includes(l.id)).map(l => l.count),
  ].reduce((a, b) => a + b, 0)

  const handleSave = async () => {
    if (!form.name.trim()) return alert('Nome é obrigatório')
    if (campaignType === 'WORKFLOW' && !selectedWorkflowId) return alert('Selecione um fluxo')
    setSaving(true)
    try {
      const payload = {
        ...form,
        type: campaignType,
        workflowId: campaignType === 'WORKFLOW' ? selectedWorkflowId : null,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
        messages: campaignType === 'SIMPLE' ? form.messages.filter(m => m.content || m.mediaUrl) : [],
      }
      const result = await onSave(payload)
      if (result?.id) setCampaignId(result.id)
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleAddRecipients = async () => {
    const id = campaignId
    if (!id) return alert('Salve a campanha primeiro')
    try {
      let result: any
      if (recipientMode === 'phones') {
        result = await apiClient.addCampaignRecipientsFromPhones(id, phonesText.split(/[\n,]/).map(p => p.trim()).filter(Boolean))
      } else if (recipientMode === 'csv') {
        result = await apiClient.addCampaignRecipientsFromCsv(id, csvText)
      } else if (recipientMode === 'inbox') {
        result = await apiClient.addCampaignRecipientsFromContacts(id, selectedTags, selectedLabelIds)
      } else {
        if (!selectedListId) return alert('Selecione uma lista')
        result = await apiClient.addCampaignRecipientsFromList(id, selectedListId)
      }
      setRecipientResult(`${result.added} adicionados. Total: ${result.total}`)
    } catch (e: any) {
      setRecipientResult('Erro: ' + (e?.response?.data?.message || e.message))
    }
  }

  const updateMsg = (idx: number, field: string, value: string) => {
    setForm(f => ({
      ...f,
      messages: f.messages.map((m, i) => i === idx ? { ...m, [field]: value } : m),
    }))
  }

  const addMsg = () => setForm(f => ({
    ...f,
    messages: [...f.messages, { order: f.messages.length, type: 'text', content: '', mediaUrl: '', caption: '' }],
  }))

  const removeMsg = (idx: number) => setForm(f => ({
    ...f,
    messages: f.messages.filter((_, i) => i !== idx).map((m, i) => ({ ...m, order: i })),
  }))

  const toggleSession = (sessionId: string) => {
    setForm(f => ({
      ...f,
      sessionIds: f.sessionIds.includes(sessionId) ? f.sessionIds.filter(id => id !== sessionId) : [...f.sessionIds, sessionId],
    }))
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-white font-bold">{initial ? 'Editar Campanha' : 'Nova Campanha'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="flex border-b border-white/10 px-5">
          {(['content', 'recipients', 'sessions', 'settings'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === t ? 'border-[#00ff88] text-[#00ff88]' : 'border-transparent text-gray-400 hover:text-white'}`}
            >
              {t === 'content' ? 'Conteúdo' : t === 'recipients' ? 'Destinatários' : t === 'sessions' ? 'Sessões' : 'Config'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === 'content' && (
            <>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Nome da campanha *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00ff88]/50"
                  placeholder="Ex: Promoção Black Friday" />
              </div>

              {/* Campaign type selector */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setCampaignType('SIMPLE')}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition ${campaignType === 'SIMPLE' ? 'bg-[#00ff88]/10 border-[#00ff88]/40 text-[#00ff88]' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>
                  <Send size={15} /> Mensagem Única
                </button>
                <button onClick={() => setCampaignType('WORKFLOW')}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition ${campaignType === 'WORKFLOW' ? 'bg-[#00ff88]/10 border-[#00ff88]/40 text-[#00ff88]' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>
                  <GitBranch size={15} /> Fluxo de Campanha
                </button>
              </div>

              {campaignType === 'WORKFLOW' && (
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Fluxo a executar *</label>
                  <select value={selectedWorkflowId} onChange={e => setSelectedWorkflowId(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00ff88]/50">
                    <option value="">Selecione um fluxo...</option>
                    {workflows.map(wf => (
                      <option key={wf.id} value={wf.id}>{wf.name}{!wf.isActive ? ' (inativo)' : ''}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">O fluxo será disparado para cada destinatário individualmente.</p>
                </div>
              )}

              {campaignType === 'SIMPLE' && (
              <>{form.messages.map((msg, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Mensagem {idx + 1}</span>
                    {form.messages.length > 1 && (
                      <button onClick={() => removeMsg(idx)} className="text-red-400 hover:text-red-300 text-xs">Remover</button>
                    )}
                  </div>
                  <select value={msg.type} onChange={e => updateMsg(idx, 'type', e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm">
                    <option value="text">Texto</option>
                    <option value="image">Imagem</option>
                    <option value="video">Vídeo</option>
                    <option value="audio">Áudio</option>
                    <option value="document">Documento</option>
                  </select>
                  {msg.type === 'text' ? (
                    <textarea rows={3} value={msg.content ?? ''} onChange={e => updateMsg(idx, 'content', e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-[#00ff88]/50"
                      placeholder="Digite a mensagem..." />
                  ) : (
                    <>
                      <input value={msg.mediaUrl ?? ''} onChange={e => updateMsg(idx, 'mediaUrl', e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-[#00ff88]/50"
                        placeholder="URL da mídia..." />
                      <input value={msg.caption ?? ''} onChange={e => updateMsg(idx, 'caption', e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-[#00ff88]/50"
                        placeholder="Legenda (opcional)" />
                    </>
                  )}
                </div>
              ))}
              <button onClick={addMsg}
                className="w-full py-2 border border-dashed border-white/20 rounded-lg text-gray-400 text-sm hover:border-[#00ff88]/40 hover:text-[#00ff88] transition flex items-center justify-center gap-2">
                <Plus size={14} /> Adicionar Mensagem
              </button>
              </>
            )}
          </>
          )}

          {tab === 'recipients' && (
            <>
              <div className="flex flex-wrap gap-2">
                {([
                  { mode: 'phones', label: 'Números', icon: <Phone size={12} /> },
                  { mode: 'csv', label: 'CSV', icon: <Upload size={12} /> },
                  { mode: 'inbox', label: 'Do Inbox', icon: <List size={12} /> },
                  { mode: 'list', label: 'Listas', icon: <List size={12} /> },
                ] as const).map(({ mode, label, icon }) => (
                  <button key={mode} onClick={() => setRecipientMode(mode)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${recipientMode === mode ? 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/40' : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white'}`}>
                    {icon} {label}
                  </button>
                ))}
              </div>

              {recipientMode === 'phones' && (
                <textarea rows={6} value={phonesText} onChange={e => setPhonesText(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono resize-none focus:outline-none focus:border-[#00ff88]/50"
                  placeholder={'5511999990000\n5521988880000'} />
              )}
              {recipientMode === 'csv' && (
                <textarea rows={6} value={csvText} onChange={e => setCsvText(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono resize-none focus:outline-none focus:border-[#00ff88]/50"
                  placeholder={'5511999990000,João\n5521988880000,Maria'} />
              )}
              {recipientMode === 'inbox' && (
                <div className="space-y-4">
                  {loadingTags ? (
                    <p className="text-gray-500 text-sm text-center py-4">Carregando tags...</p>
                  ) : (
                    <>
                      {internalTags.length > 0 && (
                        <div>
                          <p className="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-2">
                            <Tag size={11} /> Tags Internas
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {internalTags.map(({ tag, count }) => {
                              const active = selectedTags.includes(tag)
                              return (
                                <button key={tag} onClick={() => toggleTag(tag)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                                    active
                                      ? 'bg-[#00ff88]/20 text-[#00ff88] border-[#00ff88]/40'
                                      : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                                  }`}>
                                  {active ? '✅' : '☐'} {tag} <span className="opacity-60">• {count}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {waLabels.length > 0 && (
                        <div>
                          <p className="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-2">
                            <Smartphone size={11} /> Etiquetas WhatsApp
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {waLabels.map(({ id, name, color, count }) => {
                              const active = selectedLabelIds.includes(id)
                              return (
                                <button key={id} onClick={() => toggleLabel(id)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                                    active ? 'opacity-100' : 'opacity-60 hover:opacity-80'
                                  }`}
                                  style={{ backgroundColor: color + '22', borderColor: color + '55', color: active ? color : '#9ca3af' }}>
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                  {name} <span className="opacity-70">• {count}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {internalTags.length === 0 && waLabels.length === 0 && (
                        <p className="text-gray-500 text-sm text-center py-4">Nenhuma tag ou etiqueta encontrada</p>
                      )}

                      {(selectedTags.length > 0 || selectedLabelIds.length > 0) && (
                        <p className="text-xs text-[#00ff88] font-medium">
                          Total selecionado: ~{selectedTotal} contatos
                        </p>
                      )}
                      {selectedTags.length === 0 && selectedLabelIds.length === 0 && (
                        <p className="text-xs text-gray-500">Nenhuma seleção = todos os contatos do inbox</p>
                      )}
                    </>
                  )}
                </div>
              )}
              {recipientMode === 'list' && (
                <select value={selectedListId} onChange={e => setSelectedListId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="">Selecione uma lista...</option>
                  {contactLists.map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l._count.contacts} contatos)</option>
                  ))}
                </select>
              )}

              <button onClick={handleAddRecipients}
                className="w-full py-2 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-lg text-[#00ff88] text-sm font-medium hover:bg-[#00ff88]/20 transition">
                Adicionar Destinatários
              </button>
              {recipientResult && <p className="text-xs text-green-400">{recipientResult}</p>}
            </>
          )}

          {tab === 'sessions' && (
            <>
              <p className="text-xs text-gray-400">Selecione as sessões WhatsApp (máx 10):</p>
              {sessions.length === 0 ? (
                <p className="text-gray-500 text-sm">Nenhuma sessão disponível</p>
              ) : sessions.map(session => (
                <label key={session.id}
                  className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:border-white/20">
                  <input type="checkbox" checked={form.sessionIds.includes(session.id)}
                    onChange={() => toggleSession(session.id)} className="accent-[#00ff88]" />
                  <div>
                    <p className="text-white text-sm font-medium">{session.name}</p>
                    <p className="text-gray-500 text-xs">{session.phoneNumber || session.status}</p>
                  </div>
                </label>
              ))}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Limite de envios por sessão</label>
                <input type="number" min={1} value={form.limitPerSession}
                  onChange={e => setForm(f => ({ ...f, limitPerSession: Number(e.target.value) }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
            </>
          )}

          {tab === 'settings' && (
            <>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Agendamento (opcional)</label>
                <input type="datetime-local" value={form.scheduledAt}
                  onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
              </div>

              {/* Ordem de envio */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5"><Shuffle size={12} /> Ordem de Envio</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" name="randomOrder" checked={!form.randomOrder}
                      onChange={() => setForm(f => ({ ...f, randomOrder: false }))} className="accent-[#00ff88]" />
                    <div>
                      <p className="text-white text-sm flex items-center gap-1.5"><AlignJustify size={13} /> Sequencial</p>
                      <p className="text-gray-600 text-xs">Envia 1 a 1 na ordem da lista</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" name="randomOrder" checked={form.randomOrder}
                      onChange={() => setForm(f => ({ ...f, randomOrder: true }))} className="accent-[#00ff88]" />
                    <div>
                      <p className="text-white text-sm flex items-center gap-1.5"><Shuffle size={13} /> Aleatório</p>
                      <p className="text-gray-600 text-xs">Embaralha a lista antes de enviar</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Delay */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                <p className="text-xs text-gray-400 font-medium">⏱️ Delay entre envios</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Mínimo (seg)</label>
                    <input type="number" min={1} value={form.delayMin}
                      onChange={e => setForm(f => ({ ...f, delayMin: Number(e.target.value) }))}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Máximo (seg)</label>
                    <input type="number" min={1} value={form.delayMax}
                      onChange={e => setForm(f => ({ ...f, delayMax: Number(e.target.value) }))}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                  </div>
                </div>
                <p className="text-xs text-gray-600">Um valor aleatório entre {form.delayMin}s e {form.delayMax}s será usado entre cada envio para simular comportamento humano.</p>
              </div>

              {/* Blacklist */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className={`w-10 h-6 rounded-full transition relative ${form.excludeBlocked ? 'bg-[#00ff88]' : 'bg-white/10'}`}
                    onClick={() => setForm(f => ({ ...f, excludeBlocked: !f.excludeBlocked }))}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.excludeBlocked ? 'left-5' : 'left-1'}`} />
                  </div>
                  <div>
                    <p className="text-white text-sm">🚫 Excluir bloqueados</p>
                    <p className="text-gray-600 text-xs">Ignorar números na blacklist</p>
                  </div>
                </label>
              </div>
            </>
          )}
        </div>

        <div className="p-5 border-t border-white/10 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white text-sm transition">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 bg-[#00ff88] text-black font-bold rounded-lg text-sm hover:bg-[#00dd77] transition disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SimplePageContent() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showDrawer, setShowDrawer] = useState(false)
  const [editing, setEditing] = useState<Campaign | null>(null)
  const [statsId, setStatsId] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const data = await apiClient.getCampaigns()
      setCampaigns(data)
    } catch { /* noop */ } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSave = async (data: any) => {
    const result = editing
      ? await apiClient.updateCampaign(editing.id, data)
      : await apiClient.createCampaign(data)
    await load()
    setShowDrawer(false)
    setEditing(null)
    return result
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta campanha?')) return
    await apiClient.deleteCampaign(id)
    await load()
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <AppHeader />
      <div className="flex">
        <CampaignsSidebar />
        <div className="flex-1 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Campanhas</h1>
              <p className="text-gray-400 text-sm mt-1">Envie mensagens ou acione fluxos em massa para listas de contatos</p>
            </div>
            <button onClick={() => { setEditing(null); setShowDrawer(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-[#00ff88] text-black font-bold rounded-lg text-sm hover:bg-[#00dd77] transition">
              <Plus size={16} /> Nova Campanha
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[#00ff88]/30 border-t-[#00ff88] rounded-full animate-spin" /></div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Send size={48} className="text-gray-600 mb-4" />
              <p className="text-gray-400 font-medium">Nenhuma campanha criada</p>
              <p className="text-gray-600 text-sm mt-1">Clique em "Nova Campanha" para começar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map(campaign => (
                <div key={campaign.id}
                  className="bg-[#1a1a1a] border border-white/10 rounded-xl p-5 flex items-center gap-4 hover:border-white/20 transition">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span title={campaign.type === 'WORKFLOW' ? 'Fluxo de Campanha' : 'Mensagem Única'}>
                        {campaign.type === 'WORKFLOW' ? <GitBranch size={15} className="text-[#00ff88] flex-shrink-0" /> : <Send size={15} className="text-gray-400 flex-shrink-0" />}
                      </span>
                      <h3 className="text-white font-semibold truncate">{campaign.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[campaign.status]}`}>
                        {STATUS_LABELS[campaign.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{campaign._count.recipients} destinatários</span>
                      {campaign.type === 'WORKFLOW'
                        ? <span className="text-[#00ff88]/70">fluxo vinculado</span>
                        : <span>{campaign.messages.length} mensagem(ns)</span>
                      }
                      <span>{campaign.delayMin}–{campaign.delayMax}s delay</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setStatsId(campaign.id)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition" title="Estatísticas">
                      <BarChart2 size={16} />
                    </button>
                    {(campaign.status === 'DRAFT' || campaign.status === 'PAUSED') && (
                      <button
                        onClick={() => campaign.status === 'PAUSED' ? apiClient.resumeCampaign(campaign.id).then(load) : apiClient.startCampaign(campaign.id).then(load).catch(e => alert(e?.response?.data?.message || 'Erro'))}
                        className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition" title={campaign.status === 'PAUSED' ? 'Retomar' : 'Iniciar'}>
                        <Play size={16} />
                      </button>
                    )}
                    {campaign.status === 'RUNNING' && (
                      <button onClick={() => apiClient.pauseCampaign(campaign.id).then(load)}
                        className="p-2 text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition" title="Pausar">
                        <Pause size={16} />
                      </button>
                    )}
                    <button onClick={() => { setEditing(campaign); setShowDrawer(true) }}
                      className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition" title="Editar">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(campaign.id)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition" title="Excluir">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showDrawer && (
        <CampaignDrawer
          initial={editing ?? undefined}
          onSave={handleSave}
          onClose={() => { setShowDrawer(false); setEditing(null) }}
        />
      )}
      {statsId && <StatsModal campaignId={statsId} onClose={() => setStatsId(null)} />}
    </div>
  )
}

export default function SimplePage() {
  return <AuthGuard><SimplePageContent /></AuthGuard>
}
