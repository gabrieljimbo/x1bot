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
    const [dateRange, setDateRange] = useState({
        from: '',
        to: new Date().toISOString().split('T')[0]
    })
    const [compare, setCompare] = useState(false)

    useEffect(() => {
        loadInsights()
    }, [workflowId, dateRange.from, dateRange.to, compare])

    const loadInsights = async () => {
        try {
            setLoading(true)

            const insights = await apiClient.getWorkflowInsights(workflowId, {
                from: dateRange.from ? new Date(dateRange.from).toISOString() : '',
                to: dateRange.to ? new Date(dateRange.to + 'T23:59:59').toISOString() : '',
                tenantId
            })
            setData(insights)
        } catch (error) {
            console.error('Error loading insights:', error)
        } finally {
            setLoading(false)
        }
    }

    const setQuickPeriod = (p: 'today' | '7d' | '30d' | 'month' | 'all') => {
        const now = new Date()
        const to = now.toISOString().split('T')[0]
        let from = ''

        if (p === 'today') {
            from = new Date(new Date().setHours(0, 0, 0, 0)).toISOString().split('T')[0]
        } else if (p === '7d') {
            const d = new Date()
            d.setDate(now.getDate() - 7)
            from = d.toISOString().split('T')[0]
        } else if (p === '30d') {
            const d = new Date()
            d.setDate(now.getDate() - 30)
            from = d.toISOString().split('T')[0]
        } else if (p === 'month') {
            from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
        } else if (p === 'all') {
            from = ''
        }

        setDateRange({ from, to })
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
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <BarChart className="text-primary" size={24} />
                    Workflow Insights
                </h2>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Shortcuts */}
                    <div className="flex items-center gap-1 bg-[#151515] border border-gray-800 rounded-lg p-1">
                        {[
                            { id: 'today', label: 'Hoje' },
                            { id: '7d', label: '7 dias' },
                            { id: '30d', label: '30 dias' },
                            { id: 'month', label: 'Este mês' },
                            { id: 'all', label: 'Tudo' }
                        ].map((p) => (
                            <button
                                key={p.id}
                                onClick={() => setQuickPeriod(p.id as any)}
                                className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition hover:bg-white/5 ${(p.id === 'all' && !dateRange.from) ||
                                    (p.id !== 'all' && dateRange.from === new Date(new Date().setHours(0, 0, 0, 0)).toISOString().split('T')[0] && p.id === 'today')
                                    ? 'text-primary' : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Date Picker */}
                    <div className="flex items-center gap-2 bg-[#151515] border border-gray-800 rounded-lg px-3 py-1.5">
                        <Calendar size={14} className="text-gray-500" />
                        <input
                            type="date"
                            value={dateRange.from}
                            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                            className="bg-transparent border-none text-xs focus:ring-0 text-gray-300 w-32"
                        />
                        <span className="text-gray-600">até</span>
                        <input
                            type="date"
                            value={dateRange.to}
                            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                            className="bg-transparent border-none text-xs focus:ring-0 text-gray-300 w-32"
                        />
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
            <div className="bg-surface border border-border rounded-xl p-8 mb-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
                    <BarChart size={240} />
                </div>

                <h3 className="text-lg font-bold mb-8 relative z-10">Funil de Conversão</h3>

                <div className="max-w-4xl mx-auto space-y-4 relative z-10">
                    {nodes?.map((node: any, index: number) => {
                        const isStage = node.type === 'MARK_STAGE'
                        const stageColor = node.config?.color || '#00ba7c'
                        const stageEmoji = node.config?.emoji || '🚩'

                        return (
                            <div key={node.id} className="relative">
                                {/* Node Row */}
                                <div className="flex items-center gap-6">
                                    <div className="w-48 text-right shrink-0">
                                        <div className="flex items-center justify-end gap-2">
                                            {isStage && (
                                                <span className="text-xl" title="Etapa Marcada">{stageEmoji}</span>
                                            )}
                                            <p className={`font-bold truncate ${isStage ? 'text-white' : 'text-gray-400 font-medium'}`} title={node.name}>
                                                {node.name}
                                            </p>
                                        </div>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">{node.type.replace(/_/g, ' ')}</p>
                                    </div>

                                    <div className={`flex-1 h-12 rounded-xl overflow-hidden relative group transition-all duration-300 ${isStage ? 'ring-2 ring-offset-2 ring-offset-black transition-all' : ''}`}
                                        style={{
                                            backgroundColor: 'rgba(255,255,255,0.03)',
                                            borderColor: isStage ? stageColor : 'transparent',
                                            boxShadow: isStage ? `0 0 25px ${stageColor}15` : 'none',
                                            // @ts-ignore
                                            '--ring-color': stageColor
                                        } as any}>
                                        <div
                                            className="h-full border-r-2 transition-all duration-1000 ease-out"
                                            style={{
                                                width: `${index === 0 ? 100 : (nodes[0].count > 0 ? (node.count / nodes[0].count) * 100 : 0)}%`,
                                                backgroundColor: isStage ? `${stageColor}30` : 'rgba(0,186,124,0.15)',
                                                borderColor: isStage ? stageColor : '#00ba7c'
                                            }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-between px-6">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold">{node.count.toLocaleString()}</span>
                                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">leads</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-black bg-black/60 px-2 py-1 rounded-lg border border-white/10 shadow-xl">
                                                    {index === 0 ? '100%' : `${nodes[0].count > 0 ? ((node.count / nodes[0].count) * 100).toFixed(1) : 0}%`}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Conversion/Drop Arrow */}
                                {index < nodes.length - 1 && (
                                    <div className="flex justify-center ml-48 py-2">
                                        <div className="flex items-center gap-10 text-[10px] font-black uppercase tracking-widest">
                                            <div className="flex flex-col items-center gap-1 group">
                                                <div className="w-px h-6 bg-gradient-to-b from-gray-800 to-transparent group-hover:from-primary transition-colors duration-500" />
                                                <div className="flex items-center gap-1.5 text-primary bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20 shadow-lg shadow-primary/5">
                                                    <ChevronDown size={12} strokeWidth={4} />
                                                    <span>{node.conversionRate.toFixed(1)}% conversão</span>
                                                </div>
                                            </div>
                                            {node.dropOffRate > 0 && (
                                                <div className="flex flex-col items-center gap-1 group opacity-40 hover:opacity-100 transition-opacity">
                                                    <div className="w-px h-4 bg-gray-800" />
                                                    <div className="flex items-center gap-1.5 text-red-500">
                                                        <ArrowDownRight size={12} strokeWidth={4} />
                                                        <span>{node.dropOffRate.toFixed(1)}% drop-off</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
