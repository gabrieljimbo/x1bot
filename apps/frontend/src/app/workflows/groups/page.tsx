'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import { AuthGuard } from '@/components/AuthGuard'
import AppHeader from '@/components/AppHeader'
import {
    Users,
    Plus,
    Bell,
    Zap,
    Flame,
    PieChart,
    Rocket,
    Clock,
    ArrowRight,
    ExternalLink,
    Shield,
    Trash2,
    Play,
    Pause,
    Square,
    CheckCircle2,
    X,
    RefreshCw,
    Smartphone,
    Loader2
} from 'lucide-react'
import Link from 'next/link'
import WhatsAppConnect from '@/components/WhatsAppConnect'

/*
- [x] Migrar PROMO_ML para Browserless
    - [x] Adicionar serviço `browserless` ao `docker-compose.yml`
    - [x] Configurar variáveis de ambiente no backend (`BROWSERLESS_URL/TOKEN`)
    - [x] Refatorar `executePromoML` para usar API do Browserless
    - [x] Validar extração via "Testar Agora"
    - [x] Commit e Push com mensagem específica
- [x] Correções Promo ML & Node Fixes (Previous Tasks)
    - [x] Corrigir erro "No paths found" no motor de execução (Generic Fallback)
    - [x] Estabilizar Scheduler (Pre-save e Prevenção de Loop)
    - [x] Database Migration (pausedAt, groupName, status)
    - [x] Reconstruir UI de Fluxos de Grupo
    - [x] PROMO_ML_API: Add pass-through logs
    - [x] PROMO_ML: Implement category-based URL search
    - [x] PROMO_ML: Update CSS selectors for scraping
    - [x] Testes Finais e Validação
    - [x] Documentar no Walkthrough
*/

interface GroupLink {
    id: string
    groupJid: string
    groupName?: string
    workflowId: string
    isActive: boolean
    pausedAt?: string
    activatedAt: string
}

interface GroupConfig {
    id: string
    sessionId: string
    groupId: string
    name: string
    enabled: boolean
    workflowIds: string[]
}

interface WhatsappSession {
    id: string
    name: string
    phoneNumber: string
    status: string
}

export default function GroupWorkflowsPage() {
    const router = useRouter()
    const { tenant } = useAuth()
    const tenantId = tenant?.id

    const [activeTab, setActiveTab] = useState<'flows' | 'links' | 'manage'>('flows')
    const [links, setLinks] = useState<GroupLink[]>([])
    const [workflows, setWorkflows] = useState<any[]>([])
    const [sessions, setSessions] = useState<WhatsappSession[]>([])
    const [selectedSessionId, setSelectedSessionId] = useState<string>('')
    const [groupConfigs, setGroupConfigs] = useState<GroupConfig[]>([])

    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [executingWorkflow, setExecutingWorkflow] = useState<any | null>(null)
    const [loadingLinkId, setLoadingLinkId] = useState<string | null>(null)
    const [runningExecutionId, setRunningExecutionId] = useState<string | null>(null)
    const [stoppingExecution, setStoppingExecution] = useState(false)
    const [showConnectModal, setShowConnectModal] = useState(false)

    const TEMPLATES = [
        {
            id: 'template-mencionar',
            name: 'Mencionar Todos',
            description: 'Lembrete automático que marca todos os membros do grupo.',
            icon: <Bell className="text-indigo-400" />,
            color: 'indigo'
        },
        {
            id: 'template-oferta',
            name: 'Oferta Relâmpago',
            description: 'Cria uma oferta com cronômetro e encerramento automático.',
            icon: <Zap className="text-yellow-400" />,
            color: 'yellow'
        },
        {
            id: 'template-aquecimento',
            name: 'Aquecimento Diário',
            description: 'Sequência de mensagens para manter o grupo ativo.',
            icon: <Flame className="text-orange-400" />,
            color: 'orange'
        },
        {
            id: 'template-enquete',
            name: 'Enquete de Opinião',
            description: 'Descubra o que seu grupo pensa com enquetes interativas.',
            icon: <PieChart className="text-teal-400" />,
            color: 'teal'
        }
    ]

    useEffect(() => {
        if (tenantId) {
            loadInitialData()
        }
    }, [tenantId])

    useEffect(() => {
        if (activeTab === 'manage' && selectedSessionId) {
            loadGroupConfigs(selectedSessionId)
        }
    }, [activeTab, selectedSessionId])

    const loadInitialData = async (newSessionId?: string) => {
        try {
            setLoading(true)
            const [linksData, workflowsData, sessionsData] = await Promise.all([
                apiClient.getGroupLinks(tenantId!),
                apiClient.getWorkflows(tenantId!),
                apiClient.getWhatsappSessions(tenantId!)
            ])
            setLinks(linksData)
            setWorkflows(workflowsData.filter((w: any) =>
                w.nodes?.some((n: any) => n.type === 'TRIGGER_GRUPO')
            ))

            const connectedSessions = sessionsData.filter((s: any) => s.status === 'CONNECTED')
            setSessions(connectedSessions)

            if (newSessionId) {
                setSelectedSessionId(newSessionId)
                handleSync(newSessionId)
            } else if (connectedSessions.length > 0 && !selectedSessionId) {
                setSelectedSessionId(connectedSessions[0].id)
            }
        } catch (err: any) {
            setError('Erro ao carregar dados.')
        } finally {
            setLoading(false)
        }
    }

    const loadGroupConfigs = async (sid: string) => {
        try {
            const configs = await apiClient.getGroupConfigs(sid)
            setGroupConfigs(configs)
        } catch (err) {
            console.error('Error loading group configs:', err)
        }
    }

    const handleSync = async (sid?: string) => {
        const sessionId = sid || selectedSessionId
        if (!sessionId) return

        setSyncing(true)
        try {
            await apiClient.syncGroups(sessionId)
            await loadGroupConfigs(sessionId)
            // Reload links as they might have changed on backend
            const linksData = await apiClient.getGroupLinks(tenantId!)
            setLinks(linksData)
        } catch (error) {
            console.error('Error syncing groups:', error)
        } finally {
            setSyncing(false)
        }
    }

    const handleToggleEnable = async (config: GroupConfig) => {
        try {
            await apiClient.updateGroupConfig(selectedSessionId, config.id, !config.enabled, config.workflowIds)
            setGroupConfigs(prev => prev.map(c => c.id === config.id ? { ...c, enabled: !c.enabled } : c))
        } catch (error) {
            alert('Erro ao atualizar status do grupo.')
        }
    }

    const handleWorkflowChange = async (configId: string, workflowId: string, checked: boolean) => {
        const config = groupConfigs.find(c => c.id === configId)
        if (!config) return

        let newWorkflowIds = [...config.workflowIds]
        if (checked) {
            if (!newWorkflowIds.includes(workflowId)) newWorkflowIds.push(workflowId)
        } else {
            newWorkflowIds = newWorkflowIds.filter(id => id !== workflowId)
        }

        try {
            await apiClient.updateGroupConfig(selectedSessionId, configId, config.enabled, newWorkflowIds)
            setGroupConfigs(prev => prev.map(c => c.id === configId ? { ...c, workflowIds: newWorkflowIds } : c))
            // Reload links as they might have changed on backend
            const linksData = await apiClient.getGroupLinks(tenantId!)
            setLinks(linksData)
        } catch (error) {
            alert('Erro ao vincular fluxo ao grupo.')
        }
    }

    const handleDeleteLink = async (id: string) => {
        if (!confirm('Tem certeza que deseja remover este vínculo?')) return
        try {
            await apiClient.deleteGroupLink(tenantId!, id)
            setLinks(links.filter(l => l.id !== id))
        } catch (err) {
            alert('Erro ao excluir vínculo.')
        }
    }

    const handleTestNow = async (link: any) => {
        if (loadingLinkId) return
        setLoadingLinkId(link.id)
        try {
            const result = await apiClient.executeGroupTest(link.workflowId, link.groupJid, link.groupName || link.name)
            setRunningExecutionId(result?.executionId || null)
        } catch (err: any) {
            alert(err.response?.data?.error || err.message || 'Erro ao realizar teste.')
        } finally {
            setLoadingLinkId(null)
        }
    }

    const handleStopExecution = async () => {
        if (!runningExecutionId) return
        setStoppingExecution(true)
        try {
            await apiClient.cancelExecution(runningExecutionId)
        } catch (err) {
            // ignore — execution may have already finished
        } finally {
            setStoppingExecution(false)
            setRunningExecutionId(null)
            setExecutingWorkflow(null)
        }
    }

    const createFromTemplate = (templateName: string) => {
        router.push(`/workflows/new?template=group_${templateName.toLowerCase().replace(/ /g, '_')}`)
    }

    const getWorkflowName = (workflowId: string) => {
        return workflows.find(w => w.id === workflowId)?.name || 'Fluxo Desconhecido'
    }

    const handleConnectSuccess = (sessionId: string) => {
        setTimeout(() => {
            setShowConnectModal(false)
            loadInitialData(sessionId)
        }, 2000)
    }

    return (
        <AuthGuard>
            <div className="min-h-screen bg-[#0a0a0a] text-white">
                <AppHeader />

                <main className="max-w-7xl mx-auto p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-3">
                                <Users className="text-primary" />
                                Fluxos de Grupo
                            </h1>
                            <p className="text-gray-400 mt-1">Gerencie automações e interações em massa nos seus grupos de WhatsApp.</p>
                        </div>
                        <button
                            onClick={() => router.push('/workflows/new')}
                            className="px-6 py-3 bg-primary text-black font-bold rounded-lg hover:bg-primary/80 transition flex items-center gap-2 shadow-[0_0_20px_rgba(0,186,124,0.3)]"
                        >
                            <Plus size={20} />
                            Novo Fluxo
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-4 border-b border-gray-800 mb-8 pb-2">
                        <button
                            className={`px-4 py-2 font-bold rounded-lg transition-colors ${activeTab === 'flows' ? 'bg-primary/10 text-primary border border-primary/30' : 'text-gray-500 hover:text-white'}`}
                            onClick={() => setActiveTab('flows')}
                        >
                            📋 Fluxos
                        </button>
                        <button
                            className={`px-4 py-2 font-bold rounded-lg transition-colors ${activeTab === 'manage' ? 'bg-primary/10 text-primary border border-primary/30' : 'text-gray-500 hover:text-white'}`}
                            onClick={() => setActiveTab('manage')}
                        >
                            👥 Gerenciar Grupos
                        </button>
                        <button
                            className={`px-4 py-2 font-bold rounded-lg transition-colors ${activeTab === 'links' ? 'bg-primary/10 text-primary border border-primary/30' : 'text-gray-500 hover:text-white'}`}
                            onClick={() => setActiveTab('links')}
                        >
                            ⚡ Vínculos Ativos
                        </button>
                    </div>

                    {activeTab === 'flows' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-8">
                                <section>
                                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                        <Rocket size={18} className="text-primary" />
                                        Atalhos Rápidos (Templates)
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {TEMPLATES.map((tmpl) => (
                                            <div
                                                key={tmpl.id}
                                                onClick={() => createFromTemplate(tmpl.name)}
                                                className="bg-[#151515] border border-gray-800 p-5 rounded-xl hover:border-primary/50 transition cursor-pointer group"
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className="p-3 bg-black/40 rounded-lg group-hover:scale-110 transition-transform">
                                                        {tmpl.icon}
                                                    </div>
                                                    <div className="flex-1">
                                                        <h3 className="font-bold text-white group-hover:text-primary transition-colors">{tmpl.name}</h3>
                                                        <p className="text-sm text-gray-500 mt-1 leading-relaxed">{tmpl.description}</p>
                                                    </div>
                                                    <ArrowRight size={16} className="text-gray-700 group-hover:text-primary transition-colors" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section>
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-lg font-bold flex items-center gap-2">
                                            <Users size={18} className="text-primary" />
                                            Seus Fluxos de Grupo
                                        </h2>
                                    </div>
                                    {loading ? (
                                        <div className="bg-[#151515] border border-gray-800 rounded-xl p-12 text-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                                            <p className="text-gray-500">Carregando fluxos...</p>
                                        </div>
                                    ) : workflows.length === 0 ? (
                                        <div className="bg-[#151515] border border-gray-800 rounded-xl p-12 text-center">
                                            <p className="text-gray-400 font-medium">Você ainda não criou nenhum fluxo de grupo.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4">
                                            {workflows.map(wf => {
                                                const linkedLinks = links.filter(l => l.workflowId === wf.id && l.isActive)
                                                return (
                                                    <div key={wf.id} className="bg-[#151515] border border-gray-800 rounded-xl p-5 flex items-center justify-between hover:border-primary/50 transition group">
                                                        <div>
                                                            <h3 className="font-bold text-lg text-white">{wf.name}</h3>
                                                            <p className="text-gray-500 text-sm">{wf.description || 'Sem descrição'}</p>
                                                            <div className="mt-2 text-xs text-gray-400 flex items-center gap-2">
                                                                <span className={wf.isActive ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
                                                                    {wf.isActive ? 'ATIVO' : 'RASCUNHO'}
                                                                </span>
                                                                <span>•</span>
                                                                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
                                                                    {linkedLinks.length} grupos vinculados
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={() => {
                                                                    if (linkedLinks.length === 0) {
                                                                        alert('Vincule um grupo primeiro na aba "Gerenciar Grupos".')
                                                                    } else {
                                                                        setExecutingWorkflow({ ...wf, linkedGroups: linkedLinks })
                                                                    }
                                                                }}
                                                                className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-bold rounded-lg border border-indigo-500/20 flex items-center gap-2 transition"
                                                            >
                                                                <Play size={16} />
                                                                Testar Agora
                                                            </button>
                                                            <button
                                                                onClick={() => router.push(`/workflows/${wf.id}`)}
                                                                className="px-4 py-2 border border-gray-700 rounded-lg hover:bg-white/5 transition"
                                                            >
                                                                Editar
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </section>
                            </div >

                            <aside className="space-y-6">
                                <div className="bg-gradient-to-br from-primary/20 to-indigo-500/10 border border-primary/30 p-6 rounded-2xl">
                                    <Shield className="text-primary mb-4" size={32} />
                                    <h3 className="text-lg font-bold text-white mb-2">Proteção Anti-Ban</h3>
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        Todos os fluxos de grupo possuem proteções automáticas de delay e rate-limit.
                                    </p>
                                </div>
                                <div className="bg-[#151515] border border-gray-800 p-6 rounded-2xl">
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">Dicas de Uso</h3>
                                    <ul className="space-y-4">
                                        <li className="flex gap-3">
                                            <span className="text-primary font-bold">01</span>
                                            <p className="text-xs text-gray-400">Vincule seus fluxos aos grupos na aba <strong>Gerenciar Grupos</strong>.</p>
                                        </li>
                                        <li className="flex gap-3">
                                            <span className="text-primary font-bold">02</span>
                                            <p className="text-xs text-gray-400">Use o botão <strong>Testar Agora</strong> para disparo imediato.</p>
                                        </li>
                                    </ul>
                                </div>
                            </aside>
                        </div >
                    )
                    }

                    {
                        activeTab === 'manage' && (
                            <section className="space-y-6">
                                {sessions.length === 0 ? (
                                    <div className="bg-[#151515] border border-gray-800 rounded-2xl p-16 text-center flex flex-col items-center gap-6 shadow-xl">
                                        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20">
                                            <Smartphone size={40} className="text-primary" />
                                        </div>
                                        <div className="max-w-md">
                                            <h2 className="text-2xl font-bold text-white mb-2">Nenhuma sessão conectada</h2>
                                            <p className="text-gray-500">Conecte um número de WhatsApp para começar a gerenciar seus grupos e automatizar suas mensagens.</p>
                                        </div>
                                        <button
                                            onClick={() => setShowConnectModal(true)}
                                            className="px-8 py-4 bg-primary text-black font-bold rounded-xl hover:bg-primary/80 transition flex items-center gap-2 shadow-[0_0_30px_rgba(0,186,124,0.2)]"
                                        >
                                            <Plus size={20} />
                                            Conectar WhatsApp
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <select
                                                    value={selectedSessionId}
                                                    onChange={(e) => setSelectedSessionId(e.target.value)}
                                                    className="bg-[#151515] border border-gray-800 rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-primary"
                                                >
                                                    <option value="">Selecionar Sessão</option>
                                                    {sessions.map(s => (
                                                        <option key={s.id} value={s.id}>{s.name} ({s.phoneNumber})</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => handleSync()}
                                                    disabled={syncing || !selectedSessionId}
                                                    className="flex items-center gap-2 bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-primary/80 disabled:opacity-50 transition"
                                                >
                                                    <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
                                                    {syncing ? 'Sincronizando...' : 'Sincronizar Grupos'}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="bg-[#151515] border border-gray-800 rounded-xl overflow-hidden">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="bg-black/40 border-b border-gray-800">
                                                        <th className="p-4 text-xs font-bold text-gray-400 uppercase">Grupo / JID</th>
                                                        <th className="p-4 text-xs font-bold text-gray-400 uppercase">Bot Ativo</th>
                                                        <th className="p-4 text-xs font-bold text-gray-400 uppercase">Fluxos Vinculados</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {groupConfigs.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={3} className="p-12 text-center text-gray-500">
                                                                {selectedSessionId ? 'Nenhum grupo encontrado nesta sessão. Clique em Sincronizar.' : 'Selecione uma sessão conectada acima.'}
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        groupConfigs.map(config => (
                                                            <tr key={config.id} className="border-b border-gray-800 hover:bg-white/5 transition">
                                                                <td className="p-4">
                                                                    <div className="font-bold text-gray-200">{config.name}</div>
                                                                    <div className="text-[10px] text-gray-500 font-mono">{config.groupId}</div>
                                                                </td>
                                                                <td className="p-4">
                                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="sr-only peer"
                                                                            checked={config.enabled}
                                                                            onChange={() => handleToggleEnable(config)}
                                                                        />
                                                                        <div className="w-10 h-5 bg-gray-700 rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                                                                        <span className="ml-2 text-xs font-bold text-gray-400">{config.enabled ? 'ATIVADO' : 'DESLIGADO'}</span>
                                                                    </label>
                                                                </td>
                                                                <td className="p-4">
                                                                    <div className="flex flex-wrap gap-3">
                                                                        {workflows.length === 0 ? (
                                                                            <span className="text-xs text-gray-600 italic">Crie fluxos de grupo primeiro</span>
                                                                        ) : (
                                                                            workflows.map(wf => (
                                                                                <label key={wf.id} className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white cursor-pointer select-none">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        className="rounded border-gray-700 bg-black text-primary"
                                                                                        checked={config.workflowIds?.includes(wf.id)}
                                                                                        onChange={(e) => handleWorkflowChange(config.id, wf.id, e.target.checked)}
                                                                                    />
                                                                                    {wf.name}
                                                                                </label>
                                                                            ))
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </section>
                        )
                    }

                    {
                        activeTab === 'links' && (
                            <section className="bg-[#151515] border border-gray-800 rounded-xl overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-black/40 border-b border-gray-800">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Grupo</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Workflow</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-center">Status</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800">
                                        {links.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="p-12 text-center text-gray-500">Nenhum vínculo ativo ainda.</td>
                                            </tr>
                                        ) : (
                                            links.map((link) => (
                                                <tr key={link.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm font-bold text-gray-200">{link.groupName || link.groupJid}</div>
                                                        <div className="font-mono text-[10px] text-gray-500">{link.groupJid}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <Link href={`/workflows/${link.workflowId}`} className="text-sm font-medium hover:text-primary transition flex items-center gap-1">
                                                            {getWorkflowName(link.workflowId)} <ExternalLink size={12} />
                                                        </Link>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        {link.isActive ? (
                                                            <span className="px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-[10px] font-bold">ATIVO</span>
                                                        ) : (
                                                            <span className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[10px] font-bold">INATIVO</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => handleTestNow(link)}
                                                                disabled={loadingLinkId === link.id}
                                                                className="p-2 bg-indigo-500/10 text-indigo-400 rounded hover:bg-indigo-500/20 transition disabled:opacity-50"
                                                                title="Testar Agora"
                                                            >
                                                                {loadingLinkId === link.id ? (
                                                                    <RefreshCw size={14} className="animate-spin" />
                                                                ) : (
                                                                    <Play size={14} fill="currentColor" />
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteLink(link.id)}
                                                                className="p-2 text-red-500 hover:bg-red-500/10 rounded transition"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </section>
                        )
                    }
                </main >

                {/* Test Now Modal */}
                {
                    executingWorkflow && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                            <div className="bg-[#151515] border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                                <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-black/20">
                                    <div>
                                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                            <Play className="text-primary fill-primary" size={20} />
                                            Testar Agora
                                        </h2>
                                        <p className="text-xs text-gray-500 mt-1">Disparar fluxo: <span className="text-indigo-400 font-bold">{executingWorkflow.name}</span></p>
                                    </div>
                                    <button onClick={() => { setExecutingWorkflow(null); setRunningExecutionId(null); }} className="p-2 hover:bg-white/5 rounded-full transition text-gray-500 hover:text-white">
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                                    {runningExecutionId ? (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                                                <Loader2 size={18} className="text-primary animate-spin shrink-0" />
                                                <div>
                                                    <p className="text-sm font-bold text-white">Teste em execução...</p>
                                                    <p className="text-[10px] text-gray-500 font-mono">ID: {runningExecutionId}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleStopExecution}
                                                disabled={stoppingExecution}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl font-bold text-sm hover:bg-red-500/20 transition disabled:opacity-50"
                                            >
                                                {stoppingExecution ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} fill="currentColor" />}
                                                {stoppingExecution ? 'Parando...' : 'Parar Teste'}
                                            </button>
                                            <button
                                                onClick={() => { setRunningExecutionId(null); setExecutingWorkflow(null); }}
                                                className="w-full text-center text-xs text-gray-500 hover:text-gray-300 transition py-1"
                                            >
                                                Fechar (execução continua em background)
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-sm text-gray-400 mb-2">Selecione para qual grupo deseja disparar:</p>
                                            {executingWorkflow.linkedGroups.map((link: any) => (
                                                <button
                                                    key={link.id}
                                                    onClick={() => handleTestNow(link)}
                                                    disabled={!!loadingLinkId}
                                                    className="w-full text-left p-4 bg-black border border-gray-800 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition group flex items-center justify-between disabled:opacity-50"
                                                >
                                                    <div>
                                                        <div className="font-bold text-sm text-white group-hover:text-primary transition-colors">{link.groupName || link.groupJid}</div>
                                                        <div className="text-[10px] text-gray-500 font-mono">{link.groupJid}</div>
                                                    </div>
                                                    {loadingLinkId === link.id ? (
                                                        <RefreshCw size={16} className="text-primary animate-spin" />
                                                    ) : (
                                                        <Play size={16} className="text-gray-700 group-hover:text-primary transition-colors" />
                                                    )}
                                                </button>
                                            ))}
                                        </>
                                    )}
                                </div>
                                <div className="p-4 bg-black/40 text-center text-[10px] text-gray-600 italic">
                                    * Disparos manuais também são registrados nos logs de execução.
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* WhatsApp Connection Modal */}
                {showConnectModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className="bg-[#151515] border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                            <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-black/20">
                                <div>
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Smartphone className="text-primary" size={20} />
                                        Conectar WhatsApp
                                    </h2>
                                    <p className="text-xs text-gray-500 mt-1">Siga os passos para vincular seu número.</p>
                                </div>
                                <button onClick={() => setShowConnectModal(false)} className="p-2 hover:bg-white/5 rounded-full transition text-gray-500 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-8">
                                <WhatsAppConnect
                                    onSuccess={handleConnectSuccess}
                                    onCancel={() => setShowConnectModal(false)}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div >
        </AuthGuard >
    )
}
