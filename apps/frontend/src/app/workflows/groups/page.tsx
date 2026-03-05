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
    CheckCircle2
} from 'lucide-react'
import Link from 'next/link'

interface GroupLink {
    id: string
    groupJid: string
    groupName?: string
    workflowId: string
    isActive: boolean
    pausedAt?: string
    activatedAt: string
}

export default function GroupWorkflowsPage() {
    const router = useRouter()
    const { tenant } = useAuth()
    const tenantId = tenant?.id

    const [activeTab, setActiveTab] = useState<'flows' | 'links'>('flows')
    const [links, setLinks] = useState<GroupLink[]>([])
    const [workflows, setWorkflows] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [executingLink, setExecutingLink] = useState<string | null>(null)

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
            loadData()
        }
    }, [tenantId])

    const loadData = async () => {
        try {
            setLoading(true)
            const [linksData, workflowsData] = await Promise.all([
                apiClient.getGroupLinks(tenantId!),
                apiClient.getWorkflows(tenantId!)
            ])
            setLinks(linksData)
            // Filter workflows that have a TRIGGER_GRUPO node
            setWorkflows(workflowsData.filter((w: any) =>
                w.nodes?.some((n: any) => n.type === 'TRIGGER_GRUPO')
            ))
        } catch (err: any) {
            setError('Erro ao carregar dados de grupos.')
        } finally {
            setLoading(false)
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

    const handleTestNow = async (link: GroupLink) => {
        setExecutingLink(link.id)
        try {
            const result = await apiClient.executeGroupTest(link.workflowId, link.groupJid, link.groupName)
            alert(`Teste iniciado com sucesso! ID: ${result.executionId}`)
        } catch (err: any) {
            console.error('Error executing group test:', err)
            alert(err.response?.data?.error || err.message || 'Erro ao realizar teste.')
        } finally {
            setExecutingLink(null)
        }
    }

    const createFromTemplate = (templateName: string) => {
        router.push(`/workflows/new?template=group_${templateName.toLowerCase().replace(/ /g, '_')}`)
    }

    const getWorkflowName = (workflowId: string) => {
        return workflows.find(w => w.id === workflowId)?.name || 'Fluxo Desconhecido'
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
                            className={`px-4 py-2 font-bold rounded-lg transition-colors ${activeTab === 'links' ? 'bg-primary/10 text-primary border border-primary/30' : 'text-gray-500 hover:text-white'}`}
                            onClick={() => setActiveTab('links')}
                        >
                            Gerenciar Grupos
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Main Content */}
                        <div className="lg:col-span-2 space-y-8">

                            {activeTab === 'flows' ? (
                                <>
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
                                                {workflows.map(wf => (
                                                    <div key={wf.id} className="bg-[#151515] border border-gray-800 rounded-xl p-5 flex items-center justify-between hover:border-primary/50 transition">
                                                        <div>
                                                            <h3 className="font-bold text-lg text-white">{wf.name}</h3>
                                                            <p className="text-gray-500 text-sm">{wf.description || 'Sem descrição'}</p>
                                                            <div className="mt-2 text-xs text-gray-400">
                                                                <span className={wf.isActive ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
                                                                    {wf.isActive ? 'ATIVO' : 'RASCUNHO'}
                                                                </span>
                                                                <span className="mx-2">•</span>
                                                                {links.filter(l => l.workflowId === wf.id).length} grupos vinculados
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => router.push(`/workflows/${wf.id}`)}
                                                            className="px-4 py-2 border border-gray-700 rounded-lg hover:bg-white/5 transition"
                                                        >
                                                            Editar
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                </>
                            ) : (
                                <section>
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-lg font-bold flex items-center gap-2">
                                            <Clock size={18} className="text-primary" />
                                            Vínculos Ativos no Grupo
                                        </h2>
                                    </div>

                                    {loading ? (
                                        <div className="bg-[#151515] border border-gray-800 rounded-xl p-12 text-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                                            <p className="text-gray-500">Carregando vínculos...</p>
                                        </div>
                                    ) : links.length === 0 ? (
                                        <div className="bg-[#151515] border border-gray-800 rounded-xl p-12 text-center">
                                            <Users size={48} className="mx-auto mb-4 opacity-10" />
                                            <p className="text-gray-400 font-medium">Nenhum vínculo ativo ainda.</p>
                                            <p className="text-sm text-gray-600 mt-1">Vínculos são criados automaticamente quando um fluxo de grupo é acionado ou configurado nas Sessões.</p>
                                        </div>
                                    ) : (
                                        <div className="bg-[#151515] border border-gray-800 rounded-xl overflow-hidden">
                                            <table className="w-full text-left">
                                                <thead className="bg-black/40 border-b border-gray-800">
                                                    <tr>
                                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Grupo</th>
                                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Workflow</th>
                                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Status</th>
                                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Ações</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-800">
                                                    {links.map((link) => (
                                                        <tr key={link.id} className="hover:bg-white/5 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <div className="text-sm font-bold text-gray-200">{link.groupName || 'Grupo Desconhecido'}</div>
                                                                <div className="font-mono text-xs text-gray-500">{link.groupJid}</div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <Link
                                                                    href={`/workflows/${link.workflowId}`}
                                                                    className="text-sm font-medium hover:text-primary transition flex items-center gap-1"
                                                                >
                                                                    {getWorkflowName(link.workflowId)} <ExternalLink size={12} />
                                                                </Link>
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                {link.pausedAt ? (
                                                                    <span className="px-2 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded text-xs font-bold">Pausado</span>
                                                                ) : link.isActive ? (
                                                                    <span className="px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-xs font-bold">Ativo</span>
                                                                ) : (
                                                                    <span className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-xs font-bold">Inativo</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <button
                                                                        onClick={() => handleTestNow(link)}
                                                                        disabled={executingLink === link.id || !link.isActive}
                                                                        className={`p-2 rounded transition flex items-center gap-1 text-xs font-bold ${!link.isActive ? 'text-gray-600 bg-gray-800 pointer-events-none' :
                                                                                executingLink === link.id ? 'bg-primary/20 text-primary' : 'bg-white/5 hover:bg-white/10 text-white'
                                                                            }`}
                                                                        title="Testar Agora (Dispara imediatamente)"
                                                                    >
                                                                        {executingLink === link.id ? (
                                                                            <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                                                                        ) : (
                                                                            <Play size={14} className="fill-current" />
                                                                        )}
                                                                        Testar
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteLink(link.id)}
                                                                        className="p-2 text-red-500 hover:bg-red-500/10 rounded transition"
                                                                        title="Remover vínculo"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </section>
                            )}
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            <div className="bg-gradient-to-br from-primary/20 to-indigo-500/10 border border-primary/30 p-6 rounded-2xl">
                                <Shield className="text-primary mb-4" size={32} />
                                <h3 className="text-lg font-bold text-white mb-2">Proteção Anti-Ban</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">
                                    Todos os fluxos de grupo possuem proteções automáticas de delay e rate-limit.
                                </p>
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center gap-2 text-xs text-green-400">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                        Delay de 3-5s entre mensagens
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-green-400">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                        Limite de 1 menção/hora
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-green-400">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                        Verificação de conexão ativa
                                    </div>
                                </div>
                            </div>

                            <div className="bg-[#151515] border border-gray-800 p-6 rounded-2xl">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">Dicas de Uso</h3>
                                <ul className="space-y-4">
                                    <li className="flex gap-3">
                                        <span className="text-primary font-bold">01</span>
                                        <p className="text-xs text-gray-400 leading-relaxed">
                                            Na aba <span className="text-white font-bold">Gerenciar Grupos</span> você pode forçar a execução (<strong>Testar Agora</strong>) independentemente do agendamento configurado.
                                        </p>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="text-primary font-bold">02</span>
                                        <p className="text-xs text-gray-400 leading-relaxed">
                                            Selecione o modo "Dias após Ativação" dentro dos Nodes de Trigger para campanhas temporizadas.
                                        </p>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </AuthGuard>
    )
}
