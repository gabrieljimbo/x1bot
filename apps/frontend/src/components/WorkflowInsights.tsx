'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import {
    BarChart,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Users,
    Target,
    AlertTriangle,
    Clock,
    ChevronDown
} from 'lucide-react'

interface WorkflowInsightsProps {
    workflowId: string
    tenantId?: string
}

export default function WorkflowInsights({ workflowId, tenantId }: WorkflowInsightsProps) {
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any>(null)
    const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'all'>('all')
    const [compare, setCompare] = useState(false)

    useEffect(() => {
        loadInsights()
    }, [workflowId, period, compare])

    const loadInsights = async () => {
        try {
            setLoading(true)

            let from = ''
            const now = new Date()
            if (period === 'today') from = new Date(now.setHours(0, 0, 0, 0)).toISOString()
            else if (period === '7d') from = new Date(now.setDate(now.getDate() - 7)).toISOString()
            else if (period === '30d') from = new Date(now.setDate(now.getDate() - 30)).toISOString()

            const insights = await apiClient.getWorkflowInsights(workflowId, {
                from,
                tenantId
            })
            setData(insights)
        } catch (error) {
            console.error('Error loading insights:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading && !data) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        )
    }

    const { summary, nodes } = data || {}

    return (
        <div className="flex-1 overflow-y-auto p-6 bg-[#0a0a0a] text-white">
            {/* Header & Filters */}
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <BarChart className="text-primary" size={24} />
                    Workflow Insights
                </h2>

                <div className="flex gap-4">
                    <div className="flex bg-surface border border-border rounded-lg p-1">
                        {(['today', '7d', '30d', 'all'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-4 py-1.5 rounded-md text-sm transition ${period === p ? 'bg-primary text-black font-medium' : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                {p === 'today' ? 'Hoje' : p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : 'Todo período'}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => setCompare(!compare)}
                        className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm transition ${compare ? 'bg-purple-500/10 border-purple-500 text-purple-400' : 'bg-surface border-border text-gray-400 hover:border-primary'
                            }`}
                    >
                        <Calendar size={16} />
                        Comparar versões
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <div className="bg-surface border border-border p-5 rounded-xl hover:border-primary/50 transition duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Users className="text-blue-500" size={20} />
                        </div>
                    </div>
                    <p className="text-gray-400 text-sm mb-1">Total de Leads</p>
                    <h3 className="text-2xl font-bold">{summary?.totalLeads.toLocaleString() || 0}</h3>
                </div>

                <div className="bg-surface border border-border p-5 rounded-xl hover:border-primary/50 transition duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                            <Target className="text-green-500" size={20} />
                        </div>
                        <div className="flex items-center text-green-500 text-xs font-medium">
                            <ArrowUpRight size={14} />
                            <span>+5%</span>
                        </div>
                    </div>
                    <p className="text-gray-400 text-sm mb-1">Taxa de Conversão</p>
                    <h3 className="text-2xl font-bold">{summary?.conversionRate.toFixed(1)}%</h3>
                </div>

                <div className="bg-surface border border-border p-5 rounded-xl hover:border-primary/50 transition duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-red-500/10 rounded-lg">
                            <AlertTriangle className="text-red-500" size={20} />
                        </div>
                    </div>
                    <p className="text-gray-400 text-sm mb-1">Maior Drop-off</p>
                    <h3 className="text-lg font-bold truncate">{summary?.highestDropOffNode || 'Nenhum'}</h3>
                </div>

                <div className="bg-surface border border-border p-5 rounded-xl hover:border-primary/50 transition duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-yellow-500/10 rounded-lg">
                            <Clock className="text-yellow-500" size={20} />
                        </div>
                    </div>
                    <p className="text-gray-400 text-sm mb-1">Melhor Horário</p>
                    <h3 className="text-2xl font-bold">{summary?.bestTime || '--:--'}</h3>
                </div>
            </div>

            {/* Funnel Visualization */}
            <div className="bg-surface border border-border rounded-xl p-8 mb-10">
                <h3 className="text-lg font-bold mb-8">Funil de Conversão</h3>

                <div className="max-w-4xl mx-auto space-y-4">
                    {nodes?.map((node: any, index: number) => (
                        <div key={node.id} className="relative">
                            {/* Node Row */}
                            <div className="flex items-center gap-6">
                                <div className="w-48 text-right shrink-0">
                                    <p className="font-medium truncate" title={node.name}>{node.name}</p>
                                    <p className="text-xs text-gray-500">{node.type}</p>
                                </div>

                                <div className="flex-1 bg-gray-800/50 h-12 rounded-lg overflow-hidden relative group">
                                    <div
                                        className="bg-primary/20 h-full border-r-2 border-primary transition-all duration-1000 ease-out"
                                        style={{ width: `${index === 0 ? 100 : (node.count / nodes[0].count) * 100}%` }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-between px-4">
                                        <span className="text-sm font-bold">{node.count.toLocaleString()} leads</span>
                                        <span className="text-xs font-medium bg-black/40 px-2 py-1 rounded">
                                            {index === 0 ? '100%' : `${((node.count / nodes[0].count) * 100).toFixed(1)}%`}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Conversion/Drop Arrow */}
                            {index < nodes.length - 1 && (
                                <div className="flex justify-center ml-48 py-2">
                                    <div className="flex items-center gap-4 text-xs font-medium">
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="w-px h-8 bg-gradient-to-b from-primary to-transparent" />
                                            <div className="flex items-center gap-1 text-primary">
                                                <ChevronDown size={14} />
                                                <span>{node.conversionRate.toFixed(1)}% conversão</span>
                                            </div>
                                        </div>
                                        {node.dropOffRate > 0 && (
                                            <div className="flex items-center gap-1 text-red-400 opacity-60">
                                                <ArrowDownRight size={14} />
                                                <span>{node.dropOffRate.toFixed(1)}% drop-off</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
