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
    Trash2
} from 'lucide-react'
import Link from 'next/link'

interface GroupLink {
    id: string
    groupJid: string
    workflowId: string
    isActive: boolean
    activatedAt: string
}

export default function GroupWorkflowsPage() {
    const router = useRouter()
    const { tenant } = useAuth()
    const tenantId = tenant?.id

    const [links, setLinks] = useState<GroupLink[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

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
            loadGroupLinks()
        }
    }, [tenantId])

    const loadGroupLinks = async () => {
        try {
            setLoading(true)
            const data = await apiClient.getGroupLinks(tenantId!)
            setLinks(data)
        } catch (err: any) {
            setError('Erro ao carregar vínculos de grupo.')
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

    const createFromTemplate = (templateName: string) => {
        router.push(`/workflows/new?template=group_${templateName.toLowerCase().replace(/ /g, '_')}`)
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

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Main Content: Templates & Quick Access */}
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
                                        <p className="text-sm text-gray-600 mt-1">Vínculos são criados automaticamente quando um fluxo de grupo é acionado.</p>
                                    </div>
                                ) : (
                                    <div className="bg-[#151515] border border-gray-800 rounded-xl overflow-hidden">
                                        <table className="w-full text-left">
                                            <thead className="bg-black/40 border-b border-gray-800">
                                                <tr>
                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Grupo (JID)</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Workflow</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-800">
                                                {links.map((link) => (
                                                    <tr key={link.id} className="hover:bg-white/5 transition-colors">
                                                        <td className="px-6 py-4 font-mono text-xs text-gray-300">{link.groupJid}</td>
                                                        <td className="px-6 py-4">
                                                            <Link
                                                                href={`/workflows/${link.workflowId}`}
                                                                className="text-sm font-medium hover:text-primary transition flex items-center gap-1"
                                                            >
                                                                Ver Fluxo <ExternalLink size={12} />
                                                            </Link>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <button
                                                                onClick={() => handleDeleteLink(link.id)}
                                                                className="p-2 text-red-500 hover:bg-red-500/10 rounded transition"
                                                                title="Remover vínculo"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </section>
                        </div>

                        {/* Sidebar Stats & Info */}
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
                                            Use o node <span className="text-white">Aquecimento</span> em grupos recém-criados para evitar ser marcado como spam.
                                        </p>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="text-primary font-bold">02</span>
                                        <p className="text-xs text-gray-400 leading-relaxed">
                                            Combine <span className="text-white">Enquetes</span> com fluxos de resposta para segmentar seu público automaticamente.
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
