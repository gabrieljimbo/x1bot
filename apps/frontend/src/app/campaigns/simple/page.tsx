'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Play, Pause, Trash2, Edit2, BarChart2, X,
  Send, Upload, Phone, List, RefreshCw, Tag, Smartphone, Shuffle, AlignJustify, GitBranch, Users,
  AlertCircle, Info, History, CheckCircle2, Copy, RotateCcw, ChevronDown
} from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { wsClient } from '@/lib/websocket'
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
  limitType: 'TOTAL' | 'DAILY'
  delayMin: number
  delayMax: number
  randomOrder: boolean
  excludeBlocked: boolean
  dailyResetTime: string
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
  const [activeTab, setActiveTab] = useState<'stats' | 'leads'>('stats')
  const [expandedNode, setExpandedNode] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [insights, setInsights] = useState<any>(null)
  const [recipients, setRecipients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    try {
      const [statsData, insightsData, recipientsData] = await Promise.all([
        apiClient.getCampaignStats(campaignId),
        apiClient.getCampaignInsights(campaignId).catch(() => null),
        apiClient.getCampaignRecipients(campaignId).catch(() => [])
      ])
      setStats(statsData)
      setInsights(insightsData)
      setRecipients(recipientsData)
    } catch { /* noop */ } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => {
    load()
    const iv = setInterval(load, 10000) // Increase interval for less pressure
    return () => clearInterval(iv)
  }, [load])

  const filteredRecipients = recipients.filter(r => 
    r.phone.includes(search) || (r.name && r.name.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-white font-bold text-lg">Insights da Campanha</h2>
            <p className="text-xs text-gray-500 mt-1">Acompanhamento em tempo real dos seus disparos</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-lg transition"><RefreshCw size={18} /></button>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-lg transition"><X size={22} /></button>
          </div>
        </div>

        <div className="flex border-b border-white/10">
          <button 
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-3 text-sm font-medium transition ${activeTab === 'stats' ? 'text-[#00ff88] border-b-2 border-[#00ff88]' : 'text-gray-500 hover:text-white'}`}
          >
            Estatísticas Gerais
          </button>
          <button 
            onClick={() => setActiveTab('leads')}
            className={`flex-1 py-3 text-sm font-medium transition ${activeTab === 'leads' ? 'text-[#00ff88] border-b-2 border-[#00ff88]' : 'text-gray-500 hover:text-white'}`}
          >
            Lista de Leads ({recipients.length})
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {loading && !stats ? (
            <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[#00ff88]/30 border-t-[#00ff88] rounded-full animate-spin" /></div>
          ) : activeTab === 'stats' ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Progress Section */}
              {stats && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-medium">Progresso de Envio</h3>
                    <span className="text-[#00ff88] font-bold">{stats.progress}%</span>
                  </div>
                  <div className="relative h-3 bg-white/10 rounded-full overflow-hidden mb-4">
                    <div className="absolute inset-y-0 left-0 bg-[#00ff88] rounded-full transition-all duration-1000" style={{ width: `${stats.progress}%` }} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                      { label: 'Total', value: stats.total, color: 'text-white' },
                      { label: 'Enviados', value: stats.sent, color: 'text-green-400' },
                      { label: 'Pendentes', value: stats.pending, color: 'text-yellow-400' },
                      { label: 'Falhas', value: stats.failed, color: 'text-red-400' },
                      { label: 'Bloqueados', value: stats.blocked, color: 'text-orange-400' },
                    ].map(item => (
                      <div key={item.label} className="bg-black/30 rounded-lg p-3 text-center border border-white/5">
                        <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-1 font-medium">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversion/Funnel Section */}
              {insights && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <h3 className="text-white font-medium mb-4">Funil de Interações</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-black/30 rounded-lg p-4 flex flex-col items-center justify-center border-b-2 border-blue-500/50">
                      <p className="text-sm text-gray-400 mb-1">Leads Alcançados</p>
                      <p className="text-3xl font-bold text-white">{insights.totalTargeted}</p>
                      <p className="text-xs text-blue-400 mt-2">Topo do funil</p>
                    </div>
                    <div className="bg-black/30 rounded-lg p-4 flex flex-col items-center justify-center border-b-2 border-purple-500/50">
                      <p className="text-sm text-gray-400 mb-1">Interações</p>
                      <p className="text-3xl font-bold text-white">{insights.totalInteracted}</p>
                      <p className="text-xs text-purple-400 mt-2">
                        {insights.totalSent > 0 ? Math.round((insights.totalInteracted / insights.totalSent) * 100) : 0}% dos enviados
                      </p>
                    </div>
                    <div className="bg-black/30 rounded-lg p-4 flex flex-col items-center justify-center border-b-2 border-[#00ff88]/50">
                      <p className="text-sm text-gray-400 mb-1">Taxa de Conversão</p>
                      <div className="flex items-baseline gap-1">
                        <p className="text-3xl font-bold text-[#00ff88]">{insights.conversionRate.toFixed(1)}</p>
                        <span className="text-[#00ff88] font-bold">%</span>
                      </div>
                      <p className="text-xs text-[#00ff88]/70 mt-2">Leads qualificados / enviados</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Node Stats (Workflow Details) */}
              {insights?.nodeStats?.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <h3 className="text-white font-medium mb-4">Detalhamento do Funil (Fluxo)</h3>
                  <div className="space-y-4">
                    {insights.nodeStats.map((stat: any, idx: number) => {
                      const successRate = stat.totalExecutions > 0 ? Math.round((stat.successCount / stat.totalExecutions) * 100) : 0;
                      const isExpanded = expandedNode === stat.nodeId;
                      const hasLeads = stat.leads && (
                        stat.leads.passed?.length > 0 || stat.leads.waiting?.length > 0 ||
                        stat.leads.running?.length > 0 || stat.leads.failed?.length > 0
                      );
                      return (
                        <div key={stat.nodeId} className="bg-black/30 border border-white/5 rounded-lg overflow-hidden">
                          <div className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-gray-600 uppercase">#{idx + 1}</span>
                                  <p className="text-white font-medium">{stat.nodeName || `Nó: ${stat.nodeId.substring(0, 8)}`}</p>
                                </div>
                                <p className="text-xs text-gray-500">{stat.totalExecutions} total de leads que chegaram aqui</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-right">
                                  <span className="text-[#00ff88] font-bold">{successRate}%</span>
                                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Conversão</p>
                                </div>
                                {hasLeads && (
                                  <button
                                    onClick={() => setExpandedNode(isExpanded ? null : stat.nodeId)}
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition ml-1"
                                  >
                                    <ChevronDown size={13} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2 mb-3">
                              <div className="bg-white/5 rounded p-2 text-center">
                                <p className="text-xs text-gray-400 mb-1">Passaram</p>
                                <p className="text-sm font-bold text-green-400">{stat.successCount}</p>
                              </div>
                              <div className="bg-white/5 rounded p-2 text-center">
                                <p className="text-xs text-gray-400 mb-1">Aguardando</p>
                                <p className="text-sm font-bold text-blue-400">{stat.waitingCount || 0}</p>
                              </div>
                              <div className="bg-white/5 rounded p-2 text-center">
                                <p className="text-xs text-gray-400 mb-1">Executando</p>
                                <p className="text-sm font-bold text-yellow-400">{stat.runningCount || 0}</p>
                              </div>
                              <div className="bg-white/5 rounded p-2 text-center">
                                <p className="text-xs text-gray-400 mb-1">Falhas</p>
                                <p className="text-sm font-bold text-red-400">{stat.failCount}</p>
                              </div>
                            </div>

                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-[#00ff88]" style={{ width: `${successRate}%` }} />
                            </div>
                          </div>

                          {/* Expandable leads per status */}
                          {isExpanded && hasLeads && (
                            <div className="border-t border-white/5 p-4 space-y-3">
                              {[
                                { key: 'passed', label: 'Passaram', color: 'text-green-400', bg: 'bg-green-500/10' },
                                { key: 'waiting', label: 'Aguardando', color: 'text-blue-400', bg: 'bg-blue-500/10' },
                                { key: 'running', label: 'Executando', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                                { key: 'failed', label: 'Falhas', color: 'text-red-400', bg: 'bg-red-500/10' },
                              ].map(({ key, label, color, bg }) => {
                                const phones: string[] = stat.leads?.[key] || [];
                                if (phones.length === 0) return null;
                                return (
                                  <div key={key}>
                                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${color}`}>
                                      {label} ({phones.length})
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {phones.slice(0, 50).map((phone: string) => (
                                        <span key={phone} className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full ${bg} ${color} font-mono`}>
                                          <Phone size={8} />
                                          {phone}
                                        </span>
                                      ))}
                                      {phones.length > 50 && (
                                        <span className="text-[10px] text-gray-600 px-2 py-1">+{phones.length - 50} mais</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="relative">
                <input 
                  type="text" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar por número ou nome..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[#00ff88]/50 transition"
                />
              </div>

              {filteredRecipients.length === 0 ? (
                <div className="py-10 text-center text-gray-500">
                   <p>Nenhum lead encontrado.</p>
                </div>
              ) : (
                <div className="border border-white/10 rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-white/5 text-gray-400 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-5 py-3 font-medium">Lead</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 font-medium">Data/Hora</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredRecipients.map((r: any) => (
                        <tr key={r.id} className="hover:bg-white/[0.02] transition">
                          <td className="px-5 py-4">
                            <p className="text-white font-medium">{r.name || r.phone}</p>
                            {r.name && <p className="text-gray-500 text-[10px] font-mono">{r.phone}</p>}
                            {r.sourceGroup && <p className="text-[10px] text-blue-400 mt-1 flex items-center gap-1"><Users size={10} /> De grupo</p>}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              r.status === 'sent' ? 'bg-green-500/20 text-green-400' :
                              r.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {r.status === 'sent' ? 'Enviado' : r.status === 'failed' ? 'Falha' : 'Pendente'}
                            </span>
                            {r.error && <p className="text-red-500 text-[10px] mt-1 max-w-[150px] truncate" title={r.error}>{r.error}</p>}
                          </td>
                          <td className="px-5 py-4 text-gray-500 text-xs">
                            {r.sentAt ? new Date(r.sentAt).toLocaleString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
  initial, onSave, onClose, setStatusMessage
}: {
  initial?: Campaign; onSave: (data: any, keepOpen?: boolean) => Promise<any>; onClose: () => void;
  setStatusMessage: (msg: { type: 'error' | 'success' | 'info'; text: string } | null) => void
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
  const [recipientMode, setRecipientMode] = useState<'phones' | 'csv' | 'inbox' | 'list' | 'group'>('phones')

  // Tags/labels for inbox mode
  const [internalTags, setInternalTags] = useState<InternalTag[]>([])
  const [waLabels, setWaLabels] = useState<WaLabel[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([])
  const [loadingTags, setLoadingTags] = useState(false)

  // Group mode state
  const [groupSessionId, setGroupSessionId] = useState('')
  const [groups, setGroups] = useState<{ groupId: string; name: string; sessionId: string }[]>([])
  const [selectedGroupJid, setSelectedGroupJid] = useState('')
  const [groupParticipants, setGroupParticipants] = useState<{ phone: string; name: string | null; isAdmin: boolean; isSuperAdmin: boolean; alreadyExecuted?: boolean }[]>([])
  const [selectedGroupPhones, setSelectedGroupPhones] = useState<Set<string>>(new Set())
  const [excludeAdmins, setExcludeAdmins] = useState(false)
  const [allowResend, setAllowResend] = useState(false)
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [loadingParticipants, setLoadingParticipants] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [currentRecipients, setCurrentRecipients] = useState<any[]>([])
  const [loadingRecipients, setLoadingRecipients] = useState(false)

  const [form, setForm] = useState({
    name: initial?.name ?? '',
    limitPerSession: initial?.limitPerSession ?? 50,
    delayMin: initial?.delayMin ?? 5,
    delayMax: initial?.delayMax ?? 30,
    randomOrder: initial?.randomOrder ?? true,
    excludeBlocked: initial?.excludeBlocked ?? true,
    limitType: initial?.limitType ?? 'TOTAL',
    dailyResetTime: initial?.dailyResetTime ?? '00:00',
    scheduledAt: initial?.scheduledAt ? initial.scheduledAt.slice(0, 16) : '',
    sessionIds: initial?.sessions?.map(s => s.sessionId) ?? [],
    messages: (initial?.messages ?? [{ order: 0, type: 'text', content: '', mediaUrl: '', caption: '' }]) as { id?: string; order: number; type: string; content?: string; mediaUrl?: string; caption?: string }[],
    maxPerMinute: (initial as any)?.maxPerMinute ?? 5,
    maxPerHour: (initial as any)?.maxPerHour ?? 100,
    errorThreshold: (initial as any)?.errorThreshold ?? 30,
    allowedDays: ((initial as any)?.allowedDays ?? [0, 1, 2, 3, 4, 5, 6]) as number[],
  })

  const [phonesText, setPhonesText] = useState('')
  const [csvText, setCsvText] = useState('')
  const [selectedListId, setSelectedListId] = useState('')

  useEffect(() => {
    apiClient.getWhatsappSessions().then(loaded => {
      setSessions(loaded)
      // Remove stale session IDs that no longer exist
      const validIds = new Set(loaded.map((s: Session) => s.id))
      setForm(f => ({ ...f, sessionIds: f.sessionIds.filter(id => validIds.has(id)) }))
    }).catch(() => { })
    apiClient.getContactLists().then(setContactLists).catch(() => { })
    apiClient.getCampaignWorkflowsList().then(setWorkflows).catch(() => { })
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

  // Load groups when session changes in group mode
  useEffect(() => {
    if (recipientMode !== 'group' || !groupSessionId) return
    setLoadingGroups(true)
    setGroups([])
    setSelectedGroupJid('')
    setGroupParticipants([])
    setSelectedGroupPhones(new Set())
    apiClient.getCampaignGroups(groupSessionId)
      .then(setGroups)
      .catch(() => { })
      .finally(() => setLoadingGroups(false))
  }, [recipientMode, groupSessionId])

  // Load participants when group changes
  useEffect(() => {
    if (!selectedGroupJid || !groupSessionId) return
    setLoadingParticipants(true)
    setGroupParticipants([])
    setSelectedGroupPhones(new Set())
    apiClient.getGroupParticipants(groupSessionId, selectedGroupJid, campaignType === 'WORKFLOW' ? selectedWorkflowId : undefined)
      .then(participants => {
        setGroupParticipants(participants)
        // Initial selection: all visible (respecting excludeAdmins and allowResend)
        const toSelect = participants.filter(p => {
          const skipAdmin = excludeAdmins && p.isAdmin
          const skipExecuted = !allowResend && p.alreadyExecuted
          return !skipAdmin && !skipExecuted
        }).map(p => p.phone)
        setSelectedGroupPhones(new Set(toSelect))
      })
      .catch(() => { })
      .finally(() => setLoadingParticipants(false))
  }, [selectedGroupJid, groupSessionId, selectedWorkflowId, campaignType])

  const loadCurrentRecipients = useCallback(async () => {
    if (!campaignId) return
    setLoadingRecipients(true)
    try {
      const data = await apiClient.getCampaignRecipients(campaignId)
      setCurrentRecipients(data)
    } catch { /* noop */ } finally {
      setLoadingRecipients(false)
    }
  }, [campaignId])

  useEffect(() => {
    if (tab === 'recipients' && campaignId) {
      loadCurrentRecipients()
    }
  }, [tab, campaignId, loadCurrentRecipients])

  const toggleTag = (tag: string) =>
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])

  const toggleLabel = (id: string) =>
    setSelectedLabelIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])

  const selectedTotal = [
    ...internalTags.filter(t => selectedTags.includes(t.tag)).map(t => t.count),
    ...waLabels.filter(l => selectedLabelIds.includes(l.id)).map(l => l.count),
  ].reduce((a, b) => a + b, 0)

  const handleSave = async (keepOpen = false) => {
    if (!form.name.trim()) return setStatusMessage({ type: 'error', text: 'Nome da campanha é obrigatório' })
    if (campaignType === 'WORKFLOW' && !selectedWorkflowId) return setStatusMessage({ type: 'error', text: 'Selecione um fluxo para esta campanha' })
    
    // Auto-select session if in group mode and nothing selected
    let sessionIds = [...form.sessionIds]
    if (sessionIds.length === 0 && recipientMode === 'group' && groupSessionId) {
      sessionIds = [groupSessionId]
    }

    if (sessionIds.length === 0) {
      return setStatusMessage({ type: 'error', text: 'Selecione ao menos uma sessão na aba "Sessões"' })
    }

    setSaving(true)
    setStatusMessage(null)
    try {
      const payload = {
        ...form,
        sessionIds,
        type: campaignType,
        workflowId: campaignType === 'WORKFLOW' ? selectedWorkflowId : null,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        messages: campaignType === 'SIMPLE' ? form.messages.filter(m => m.content || m.mediaUrl) : [],
      }
      const result = await onSave(payload, keepOpen)
      if (result?.id) {
        setCampaignId(result.id)
        setStatusMessage({ type: 'success', text: 'Campanha salva! Agora clique em "Adicionar Destinatários" abaixo para incluir os números.' })
        return result.id
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e?.response?.data?.message || 'Erro ao salvar campanha' })
    } finally {
      setSaving(false)
    }
    return null
  }

  // Update selection when toggles change
  useEffect(() => {
    if (groupParticipants.length === 0) return
    const visible = getVisibleParticipants()
    setSelectedGroupPhones(prev => {
      const next = new Set(prev)
      const visiblePhones = new Set(visible.map(p => p.phone))
      prev.forEach(phone => {
        if (!visiblePhones.has(phone)) next.delete(phone)
      })
      return next
    })
  }, [excludeAdmins, allowResend, groupParticipants])

  const toggleGroupPhone = (phone: string) => {
    setSelectedGroupPhones(prev => {
      const next = new Set(prev)
      if (next.has(phone)) next.delete(phone)
      else next.add(phone)
      return next
    })
  }

  const toggleAllGroupPhones = () => {
    const visible = getVisibleParticipants()
    const allSelected = visible.every(p => selectedGroupPhones.has(p.phone))
    if (allSelected) {
      setSelectedGroupPhones(prev => {
        const next = new Set(prev)
        visible.forEach(p => next.delete(p.phone))
        return next
      })
    } else {
      setSelectedGroupPhones(prev => {
        const next = new Set(prev)
        visible.forEach(p => next.add(p.phone))
        return next
      })
    }
  }

  const getVisibleParticipants = () => {
    let list = groupParticipants
    if (excludeAdmins) list = list.filter(p => !p.isAdmin)
    if (!allowResend) list = list.filter(p => !p.alreadyExecuted)
    return list
  }

  const handleExportToList = async () => {
    const phones = [...selectedGroupPhones]
    if (phones.length === 0) return setStatusMessage({ type: 'info', text: 'Selecione ao menos um contato do grupo' })
    const listName = prompt('Nome da nova lista:', `Export ${selectedGroupJid} ${new Date().toLocaleDateString()}`)
    if (!listName) return
    setExporting(true)
    try {
      const newList = await apiClient.createContactList(listName)
      const contactsToAdd = groupParticipants
        .filter(p => selectedGroupPhones.has(p.phone))
        .map(p => ({ phone: p.phone, name: p.name || undefined }))
      await apiClient.addContactsManually(newList.id, contactsToAdd)
      setStatusMessage({ type: 'success', text: `Lista "${listName}" criada com ${contactsToAdd.length} contatos.` })
      apiClient.getContactLists().then(setContactLists).catch(() => { })
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: 'Erro ao exportar: ' + (e?.response?.data?.message || e.message) })
    } finally {
      setExporting(false)
    }
  }

  const handleAddRecipients = async (forceId?: string) => {
    let id = forceId || campaignId
    if (!id) {
      // If no ID yet, try to save first (internal save, keep drawer open)
      id = await handleSave(true)
      if (!id) return // Save failed, message already set
    }

    setStatusMessage(null)
    setSaving(true) // Use saving state for visual feedback
    try {
      let result: any
      if (recipientMode === 'phones') {
        const phones = phonesText.split(/[\n,]/).map(p => p.trim()).filter(Boolean)
        if (phones.length === 0) throw new Error('Digite ao menos um número de telefone')
        result = await apiClient.addCampaignRecipientsFromPhones(id, phones)
      } else if (recipientMode === 'csv') {
        if (!csvText.trim()) throw new Error('Cole o conteúdo CSV ou arraste um arquivo')
        result = await apiClient.addCampaignRecipientsFromCsv(id, csvText)
      } else if (recipientMode === 'inbox') {
        result = await apiClient.addCampaignRecipientsFromContacts(id, selectedTags, selectedLabelIds)
      } else if (recipientMode === 'group') {
        if (!groupSessionId || !selectedGroupJid) throw new Error('Selecione uma sessão e um grupo')
        if (selectedGroupPhones.size === 0) throw new Error('Selecione ao menos um participante do grupo')
        result = await apiClient.addCampaignRecipientsFromGroup(id, {
          sessionId: groupSessionId,
          groupJid: selectedGroupJid,
          excludeAdmins,
          allowResend,
          selectedPhones: [...selectedGroupPhones],
        })
      } else {
        if (!selectedListId) throw new Error('Selecione uma lista de contatos')
        result = await apiClient.addCampaignRecipientsFromList(id, selectedListId)
      }
      setRecipientResult(`${result.added} adicionados. Total: ${result.total}`)
      setStatusMessage({ type: 'success', text: `Sucesso! ${result.added} destinatários foram adicionados à campanha.` })
      loadCurrentRecipients()
      setPhonesText('')
      setCsvText('')
      setSelectedGroupPhones(new Set())
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: 'Erro: ' + (e?.response?.data?.message || e.message) })
    } finally {
      setSaving(false)
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
                  { mode: 'phones' as const, label: 'Números', icon: <Phone size={12} /> },
                  { mode: 'csv' as const, label: 'CSV', icon: <Upload size={12} /> },
                  { mode: 'inbox' as const, label: 'Do Inbox', icon: <List size={12} /> },
                  { mode: 'list' as const, label: 'Listas', icon: <List size={12} /> },
                  { mode: 'group' as const, label: 'Grupos', icon: <Users size={12} /> },
                ]).map(({ mode, label, icon }) => (
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
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${active
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
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${active ? 'opacity-100' : 'opacity-60 hover:opacity-80'
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
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
                    <List size={11} /> Selecione a lista de contatos
                  </label>
                  <select value={selectedListId} onChange={e => setSelectedListId(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00ff88]/50">
                    <option value="" className="bg-[#1a1a1a] text-gray-400">Selecione uma lista...</option>
                    {contactLists.map(l => (
                      <option key={l.id} value={l.id} className="bg-[#1a1a1a] text-white">
                        {l.name} ({l._count.contacts} contatos)
                      </option>
                    ))}
                  </select>
                </div>
              ) }
              {recipientMode === 'group' && (
                <div className="space-y-4">
                  {/* Session selector */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-gray-400 block">Sessão WhatsApp</label>
                      {groupSessionId && (
                        <button
                          onClick={async () => {
                            if (loadingGroups) return;
                            setLoadingGroups(true);
                            try {
                              await apiClient.syncCampaignGroups(groupSessionId);
                              const updated = await apiClient.getCampaignGroups(groupSessionId);
                              setGroups(updated);
                            } catch (e: any) {
                              setStatusMessage({ type: 'error', text: 'Erro ao sincronizar: ' + (e?.response?.data?.message || e.message) })
                            } finally {
                              setLoadingGroups(false);
                            }
                          }}
                          disabled={loadingGroups}
                          className="text-[10px] text-[#00ff88] hover:underline flex items-center gap-1"
                        >
                          <RefreshCw size={10} className={loadingGroups ? 'animate-spin' : ''} />
                          {loadingGroups ? 'Sincronizando...' : 'Sincronizar agora'}
                        </button>
                      )}
                    </div>
                    <select value={groupSessionId} onChange={e => setGroupSessionId(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00ff88]/50">
                      <option value="" className="bg-[#1a1a1a] text-gray-400">Selecione uma sessão...</option>
                      {sessions.filter(s => s.status?.toLowerCase() === 'connected').map(s => (
                        <option key={s.id} value={s.id} className="bg-[#1a1a1a] text-white">
                          {s.name} {s.phoneNumber ? `(${s.phoneNumber})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Group selector */}
                  {groupSessionId && (
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Grupo</label>
                      {loadingGroups ? (
                        <p className="text-gray-500 text-sm py-2">Carregando grupos...</p>
                      ) : (
                        <select value={selectedGroupJid} onChange={e => setSelectedGroupJid(e.target.value)}
                          className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00ff88]/50">
                          <option value="" className="bg-[#1a1a1a] text-gray-400">Selecione um grupo...</option>
                          {groups.map(g => (
                            <option key={g.groupId} value={g.groupId} className="bg-[#1a1a1a] text-white">{g.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {/* Toggles */}
                  {selectedGroupJid && (
                    <div className="flex flex-col gap-3">
                      <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <div className={`w-10 h-6 rounded-full transition relative ${excludeAdmins ? 'bg-[#00ff88]' : 'bg-white/10'}`}
                            onClick={() => setExcludeAdmins(!excludeAdmins)}>
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${excludeAdmins ? 'left-5' : 'left-1'}`} />
                          </div>
                          <div>
                            <p className="text-white text-sm">👑 Excluir administradores</p>
                            <p className="text-gray-600 text-xs">Remover admins e super admins do grupo</p>
                          </div>
                        </label>
                      </div>

                      <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <div className={`w-10 h-6 rounded-full transition relative ${allowResend ? 'bg-[#00ff88]' : 'bg-white/10'}`}
                            onClick={() => setAllowResend(!allowResend)}>
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${allowResend ? 'left-5' : 'left-1'}`} />
                          </div>
                          <div>
                            <p className="text-white text-sm">🔄 Permitir reenvio</p>
                            <p className="text-gray-600 text-xs">Incluir contatos que já receberam esta campanha</p>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Participants list */}
                  {selectedGroupJid && (
                    loadingParticipants ? (
                      <p className="text-gray-500 text-sm text-center py-4">Carregando participantes...</p>
                    ) : groupParticipants.length > 0 ? (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-gray-400 font-medium">
                            {getVisibleParticipants().length} participantes disponíveis
                            {excludeAdmins && groupParticipants.some(p => p.isAdmin) && (
                              <span className="text-yellow-500"> ({groupParticipants.filter(p => p.isAdmin).length} admins ocultos)</span>
                            )}
                            {!allowResend && groupParticipants.some(p => p.alreadyExecuted) && (
                              <span className="text-orange-500"> ({groupParticipants.filter(p => p.alreadyExecuted).length} já receberam)</span>
                            )}
                          </p>
                          <div className="flex gap-2">
                            <button onClick={handleExportToList} disabled={exporting || selectedGroupPhones.size === 0}
                              className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded border border-white/10 text-gray-300 transition flex items-center gap-1 disabled:opacity-50">
                              <Users size={10} /> {exporting ? 'Exportando...' : 'Exportar para Lista'}
                            </button>
                            <button onClick={toggleAllGroupPhones}
                              className="text-xs text-[#00ff88] hover:text-[#00dd77] transition">
                              {getVisibleParticipants().length > 0 && getVisibleParticipants().every(p => selectedGroupPhones.has(p.phone)) ? 'Desmarcar todos' : 'Selecionar todos'}
                            </button>
                          </div>
                        </div>
                        <div className="max-h-[240px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                          {getVisibleParticipants().map(p => (
                            <label key={p.phone}
                              className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition ${selectedGroupPhones.has(p.phone)
                                  ? 'bg-[#00ff88]/5 border border-[#00ff88]/20'
                                  : 'bg-white/5 border border-white/5 hover:border-white/10'
                                }`}>
                              <input type="checkbox" checked={selectedGroupPhones.has(p.phone)}
                                onChange={() => toggleGroupPhone(p.phone)} className="accent-[#00ff88] flex-shrink-0" />
                               <div className="flex-1 min-w-0">
                                 <div className="flex items-center justify-between mb-0">
                                  <p className="text-white text-sm font-medium truncate">{p.name || p.phone}</p>
                                  {p.alreadyExecuted && (
                                    <span className="text-[10px] text-gray-500 flex items-center gap-1 font-medium italic">
                                      <History size={10} /> Já enviado
                                    </span>
                                  )}
                                </div>
                                {p.name && <p className="text-gray-500 text-[11px] font-mono">{p.phone}</p>}
                              </div>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold flex-shrink-0 ${p.isSuperAdmin
                                  ? 'bg-yellow-500/10 text-yellow-500/70 border border-yellow-500/20'
                                  : p.isAdmin
                                    ? 'bg-blue-500/10 text-blue-500/70 border border-blue-500/20'
                                    : 'bg-white/5 text-gray-500 border border-white/5'
                                }`}>
                                {p.isSuperAdmin ? 'CRIADOR' : p.isAdmin ? 'ADMIN' : 'MEMBRO'}
                              </span>

                            </label>
                          ))}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                          <p className="text-[11px] text-[#00ff88] font-medium">
                            {selectedGroupPhones.size} selecionados de {getVisibleParticipants().length}
                          </p>
                          <button onClick={handleExportToList} disabled={exporting || selectedGroupPhones.size === 0}
                            className="text-[10px] text-gray-400 hover:text-white transition flex items-center gap-1 disabled:opacity-30">
                            <Users size={12} /> {exporting ? 'Exportando...' : 'Exportar para lista'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                        <Users size={24} className="text-gray-600 mx-auto mb-2 opacity-50" />
                        <p className="text-gray-500 text-xs">Nenhum participante disponível no momento</p>
                      </div>
                    )
                  )}
                </div>
              )}

              <button onClick={() => handleAddRecipients()}
                disabled={saving || (recipientMode === 'phones' && !phonesText.trim()) || (recipientMode === 'csv' && !csvText.trim()) || (recipientMode === 'group' && selectedGroupPhones.size === 0) || (recipientMode === 'list' && !selectedListId)}
                className="w-full py-2 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-lg text-[#00ff88] text-sm font-medium hover:bg-[#00ff88]/20 transition disabled:opacity-50">
                {saving ? 'Adicionando...' : 'Confirmar e Adicionar Destinatários'}
              </button>
              {recipientResult && <p className="text-xs text-green-400 text-center font-medium">{recipientResult}</p>}

              {/* Current Recipients List */}
              {campaignId && (
                <div className="mt-8 border-t border-white/10 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white text-sm font-bold flex items-center gap-2">
                       <Users size={16} className="text-[#00ff88]" /> 
                       Leads já adicionados ({currentRecipients.length})
                    </h3>
                    {loadingRecipients && <div className="w-4 h-4 border-2 border-[#00ff88]/30 border-t-[#00ff88] rounded-full animate-spin" />}
                  </div>

                  {currentRecipients.length === 0 ? (
                    <div className="bg-black/20 border border-dashed border-white/5 rounded-xl p-8 text-center">
                      <p className="text-gray-600 text-xs italic">Nenhum lead configurado ainda.</p>
                    </div>
                  ) : (
                    <div className="bg-black/30 border border-white/5 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar">
                      <table className="w-full text-[11px] text-left">
                        <thead className="bg-white/5 text-gray-400 uppercase tracking-wider font-bold">
                          <tr>
                            <th className="px-4 py-2">Lead</th>
                            <th className="px-4 py-2 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {currentRecipients.map((r: any) => (
                            <tr key={r.id} className="hover:bg-white/[0.02]">
                              <td className="px-4 py-2">
                                <p className="text-gray-300 font-medium">{r.name || r.phone}</p>
                                {r.name && <p className="text-gray-600 font-mono scale-90 origin-left">{r.phone}</p>}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                                  r.status === 'sent' ? 'bg-green-500/10 text-green-500/80' :
                                  r.status === 'failed' ? 'bg-red-500/10 text-red-500/80' :
                                  'bg-white/5 text-gray-500'
                                }`}>
                                  {r.status === 'sent' ? 'Enviado' : r.status === 'failed' ? 'Falha' : 'Pendente'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'sessions' && (
            <>
              <p className="text-xs text-gray-400">Selecione as sessões WhatsApp:</p>
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
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">Tipo de Limite</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setForm(f => ({ ...f, limitType: 'TOTAL' }))}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${form.limitType === 'TOTAL' ? 'bg-[#00ff88]/20 border-[#00ff88]/40 text-[#00ff88]' : 'bg-black/20 border-white/10 text-gray-400 hover:text-white'}`}>
                      Limite Total
                    </button>
                    <button onClick={() => setForm(f => ({ ...f, limitType: 'DAILY' }))}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${form.limitType === 'DAILY' ? 'bg-[#00ff88]/20 border-[#00ff88]/40 text-[#00ff88]' : 'bg-black/20 border-white/10 text-gray-400 hover:text-white'}`}>
                      Limite Diário
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2">
                    {form.limitType === 'TOTAL' 
                      ? 'O envio para quando atingir o limite total por número.' 
                      : `O limite é resetado todo dia às ${form.dailyResetTime || '00:00'} (Horário de Brasília).`}
                  </p>
                </div>
                {form.limitType === 'DAILY' && (
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1.5">
                       <History size={11} /> Reiniciar Envios às
                    </label>
                    <input type="time" value={form.dailyResetTime}
                      onChange={e => setForm(f => ({ ...f, dailyResetTime: e.target.value }))}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00ff88]/50" />
                    <p className="text-[10px] text-gray-500 mt-1">
                      A contagem diária será zerada e os disparos retomados neste horário.
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Quantidade de envios (por número)</label>
                  <input type="number" min={1} value={form.limitPerSession}
                    onChange={e => setForm(f => ({ ...f, limitPerSession: Number(e.target.value) }))}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00ff88]/50" />
                </div>
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

              {/* Velocidade de Envio */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                <p className="text-xs text-gray-400 font-medium">⚡ Velocidade de Envio</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Limite por minuto</label>
                    <div className="flex items-center gap-2">
                      <input type="number" min={1} max={60} value={form.maxPerMinute}
                        onChange={e => setForm(f => ({ ...f, maxPerMinute: Number(e.target.value) }))}
                        className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                      <span className="text-gray-500 text-xs whitespace-nowrap">msgs/min</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Limite por hora</label>
                    <div className="flex items-center gap-2">
                      <input type="number" min={1} max={1000} value={form.maxPerHour}
                        onChange={e => setForm(f => ({ ...f, maxPerHour: Number(e.target.value) }))}
                        className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                      <span className="text-gray-500 text-xs whitespace-nowrap">msgs/hora</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-600">💡 O sistema respeitará o menor limite atingido primeiro.</p>
              </div>

              {/* Dias Permitidos */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                <p className="text-xs text-gray-400 font-medium">📅 Dias Permitidos</p>
                <div className="flex flex-wrap gap-2">
                  {(['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const).map((label, day) => {
                    const active = form.allowedDays.includes(day)
                    return (
                      <button key={day} type="button"
                        onClick={() => setForm(f => ({
                          ...f,
                          allowedDays: active
                            ? f.allowedDays.filter(d => d !== day)
                            : [...f.allowedDays, day].sort((a, b) => a - b)
                        }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${active ? 'bg-[#00ff88]/20 border-[#00ff88]/40 text-[#00ff88]' : 'bg-white/5 border-white/10 text-gray-500'}`}>
                        {label}
                      </button>
                    )
                  })}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setForm(f => ({ ...f, allowedDays: [0, 1, 2, 3, 4, 5, 6] }))}
                    className="text-xs text-gray-400 hover:text-white transition px-2 py-1 rounded border border-white/10 hover:border-white/30">Todos</button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, allowedDays: [1, 2, 3, 4, 5] }))}
                    className="text-xs text-gray-400 hover:text-white transition px-2 py-1 rounded border border-white/10 hover:border-white/30">Seg–Sex</button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, allowedDays: [0, 6] }))}
                    className="text-xs text-gray-400 hover:text-white transition px-2 py-1 rounded border border-white/10 hover:border-white/30">Fins de Semana</button>
                </div>
              </div>

              {/* Proteção de Erros */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                <p className="text-xs text-gray-400 font-medium">📊 Proteção contra Erros</p>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Parar campanha se taxa de erro ultrapassar</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={100} value={form.errorThreshold}
                      onChange={e => setForm(f => ({ ...f, errorThreshold: Number(e.target.value) }))}
                      className="w-24 bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
                    <span className="text-gray-400 text-sm">%</span>
                  </div>
                </div>
                <p className="text-xs text-gray-600">💡 Se {form.errorThreshold}% dos envios falharem, a campanha é pausada automaticamente para evitar banimento. Use 0 para desativar.</p>
              </div>
            </>
          )}
        </div>

        <div className="p-5 border-t border-white/10 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white text-sm transition">Cancelar</button>
          <button onClick={async () => {
            const savedId = await handleSave(true);
            if (savedId) {
              const hasRecips = (recipientMode === 'phones' && phonesText.trim()) || (recipientMode === 'csv' && csvText.trim()) || (recipientMode === 'group' && selectedGroupPhones.size > 0) || (recipientMode === 'list' && selectedListId);
              if (hasRecips) { await handleAddRecipients(savedId); }
              onClose();
            }
          }} disabled={saving}
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
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null)
  const [liveSessions, setLiveSessions] = useState<{ id: string; name: string; status: string }[]>([])

  const load = async () => {
    try {
      setLoading(true)
      const [data, sessionsData] = await Promise.all([
        apiClient.getCampaigns(undefined, false),
        apiClient.getWhatsappSessions().catch(() => []),
      ])
      setCampaigns(data)
      setLiveSessions(sessionsData)
    } catch { /* noop */ } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const handler = (event: any) => {
      setStatusMessage({
        type: 'error',
        text: `⚠️ Campanha "${event.campaignName}" pausada automaticamente — ${event.reason}. Verifique os números e retome manualmente.`,
      })
      load()
    }
    wsClient.on('campaign.paused', handler)
    return () => wsClient.off('campaign.paused', handler)
  }, [])

  const handleSave = async (data: any, keepOpen = false) => {
    const result = editing
      ? await apiClient.updateCampaign(editing.id, data)
      : await apiClient.createCampaign(data)
    await load()
    if (!keepOpen) {
      setShowDrawer(false)
      setEditing(null)
    }
    return result
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta campanha?')) return
    await apiClient.deleteCampaign(id)
    await load()
  }

  const handleDuplicate = async (id: string) => {
    try {
      await apiClient.duplicateCampaign(id)
      await load()
      setStatusMessage({ type: 'success', text: 'Campanha duplicada com sucesso!' })
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: 'Erro ao duplicar: ' + (e?.response?.data?.message || e.message) })
    }
  }

  const handleReset = async (id: string) => {
    if (!confirm('Deseja reativar esta campanha? Ela voltará para o estado de rascunho.')) return
    try {
      await apiClient.resetCampaign(id)
      await load()
      setStatusMessage({ type: 'success', text: 'Campanha reativada! Agora você pode editá-la ou iniciá-la novamente.' })
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: 'Erro ao reativar: ' + (e?.response?.data?.message || e.message) })
    }
  }

  const handleStartCampaign = async (campaign: Campaign) => {
    if (campaign.sessions.length === 0) {
      setStatusMessage({ type: 'error', text: `A campanha "${campaign.name}" não tem sessão configurada. Edite a campanha → aba Sessões e selecione uma sessão WhatsApp.` })
      return
    }
    // Check if configured session IDs still exist and are connected
    const campaignSessionIds = campaign.sessions.map(s => s.sessionId)
    const validSessions = liveSessions.filter(s => campaignSessionIds.includes(s.id) && s.status === 'CONNECTED')
    if (validSessions.length === 0) {
      const existingSessions = liveSessions.filter(s => campaignSessionIds.includes(s.id))
      if (existingSessions.length === 0) {
        setStatusMessage({ type: 'error', text: `A sessão configurada na campanha "${campaign.name}" não existe mais. Edite a campanha → aba Sessões e selecione uma sessão ativa.` })
      } else {
        const names = existingSessions.map(s => s.name).join(', ')
        setStatusMessage({ type: 'error', text: `A sessão "${names}" está desconectada. Reconecte-a antes de iniciar a campanha "${campaign.name}".` })
      }
      return
    }
    if (campaign._count.recipients === 0) {
      setStatusMessage({ type: 'error', text: `Adicione destinatários à campanha "${campaign.name}" antes de iniciá-la.` })
      return
    }
    try {
      await apiClient.startCampaign(campaign.id)
      await load()
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e?.response?.data?.message || 'Erro ao iniciar campanha' })
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <AppHeader />
      <div className="flex">
        <CampaignsSidebar />
        <div className="flex-1 p-8">
          {statusMessage && (
            <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${statusMessage.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                statusMessage.type === 'success' ? 'bg-[#00ff88]/10 border-[#00ff88]/20 text-[#00ff88]' :
                  'bg-blue-500/10 border-blue-500/20 text-blue-400'
              }`}>
              {statusMessage.type === 'error' ? <AlertCircle size={20} /> :
                statusMessage.type === 'success' ? <CheckCircle2 size={20} /> : <Info size={20} />}
              <p className="text-sm font-medium">{statusMessage.text}</p>
              <button onClick={() => setStatusMessage(null)} className="ml-auto opacity-50 hover:opacity-100">
                <X size={18} />
              </button>
            </div>
          )}

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
              <p className="text-gray-600 text-sm mt-1">Clique em &quot;Nova Campanha&quot; para começar</p>
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
                        onClick={() => campaign.status === 'PAUSED' ? apiClient.resumeCampaign(campaign.id).then(load) : handleStartCampaign(campaign)}
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
                    {['COMPLETED', 'FAILED', 'SCHEDULED'].includes(campaign.status) && (
                      <button onClick={() => handleReset(campaign.id)}
                        className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition" title="Reativar">
                        <RotateCcw size={16} />
                      </button>
                    )}
                    <button onClick={() => handleDuplicate(campaign.id)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition" title="Duplicar">
                      <Copy size={16} />
                    </button>
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
          setStatusMessage={setStatusMessage}
        />
      )}
      {statsId && <StatsModal campaignId={statsId} onClose={() => setStatsId(null)} />}
    </div>
  )
}

export default function SimplePage() {
  return <AuthGuard><SimplePageContent /></AuthGuard>
}
