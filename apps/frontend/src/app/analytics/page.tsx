'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import { AuthGuard } from '@/components/AuthGuard'
import AppHeader from '@/components/AppHeader'
import {
    BarChart3,
    TrendingUp,
    Target,
    Globe,
    Users,
    Calendar,
    Filter,
    ArrowUpRight,
    ExternalLink,
    Smartphone,
    MapPin,
    ChevronRight
} from 'lucide-react'

function AnalyticsContent() {
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any>(null)
    const [period, setPeriod] = useState('30d')

    useEffect(() => {
        loadData()
    }, [period])

    const loadData = async () => {
        try {
            setLoading(true)
            const res = await apiClient.get(`/leads/origins?period=${period}`)
            setData(res)
        } catch (error) {
            console.error('Error loading analytics:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading && !data) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <p className="text-gray-500 animate-pulse">Carregando métricas...</p>
                </div>
            </div>
        )
    }

    const { stats, recentLeads } = data || {}

    return (
        <div className="flex-1 flex flex-col min-h-screen bg-[#0a0a0a] text-white">
            <AppHeader />

            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-white mb-2">
                                Leads & <span className="text-primary italic">Performance</span>
                            </h1>
                            <p className="text-gray-500 text-sm">
                                Rastreamento completo de origem e conversão Meta Ads.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 bg-[#151515] border border-gray-800 rounded-xl p-1 shadow-2xl">
                            {[
                                { id: '24h', label: '24h' },
                                { id: '7d', label: '7 dias' },
                                { id: '30d', label: '30 dias' },
                                { id: 'all', label: 'Tudo' }
                            ].map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => setPeriod(p.id)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${period === p.id
                                            ? 'bg-primary text-black shadow-[0_0_15px_rgba(0,186,124,0.3)]'
                                            : 'text-gray-500 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <SummaryCard
                            title="Total de Leads"
                            value={stats?.totalLeads || 0}
                            icon={<Users className="text-blue-500" />}
                            trend="+12%"
                            trendUp={true}
                            color="blue"
                        />
                        <SummaryCard
                            title="Origem Anúncio"
                            value={stats?.adLeads || 0}
                            icon={<Target className="text-primary" />}
                            trend={stats?.totalLeads ? `${Math.round((stats.adLeads / stats.totalLeads) * 100)}%` : '0%'}
                            trendUp={true}
                            color="primary"
                        />
                        <SummaryCard
                            title="Orgânico / Outros"
                            value={stats?.organicLeads || 0}
                            icon={<Globe className="text-purple-500" />}
                            trend="-5%"
                            trendUp={false}
                            color="purple"
                        />
                        <SummaryCard
                            title="Melhor Estado"
                            value={stats?.topStates?.[0]?.state || 'N/A'}
                            icon={<MapPin className="text-orange-500" />}
                            subtitle={`${stats?.topStates?.[0]?.count || 0} leads`}
                            color="orange"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Ad Performance chart-like list */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-[#111111] border border-gray-800/50 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none group-hover:scale-110 transition-transform duration-700">
                                    <BarChart3 size={200} />
                                </div>

                                <div className="flex items-center justify-between mb-8 relative z-10">
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <TrendingUp className="text-primary" size={20} />
                                        Performance por Campanha/Criativo
                                    </h3>
                                    <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest bg-gray-900 px-3 py-1 rounded-full border border-gray-800">
                                        Últimos {period === 'all' ? 'Dados' : period}
                                    </div>
                                </div>

                                <div className="space-y-6 relative z-10">
                                    {stats?.adDistribution?.length > 0 ? (
                                        stats.adDistribution.map((ad: any, i: number) => (
                                            <div key={i} className="space-y-2">
                                                <div className="flex justify-between items-end">
                                                    <div className="flex-1 min-w-0 pr-4">
                                                        <p className="text-sm font-bold text-white truncate" title={ad.title}>
                                                            {ad.title || 'Anúncio sem título'}
                                                        </p>
                                                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">ID: {ad.adSourceId || 'Desconhecido'}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-sm font-black text-primary">{ad.count}</span>
                                                        <span className="text-[10px] text-gray-500 ml-1 font-bold uppercase">Leads</span>
                                                    </div>
                                                </div>
                                                <div className="h-2 w-full bg-gray-900 rounded-full overflow-hidden border border-gray-800/50">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-primary/40 to-primary shadow-[0_0_10px_rgba(0,186,124,0.2)] transition-all duration-1000 ease-out"
                                                        style={{ width: `${(ad.count / stats.adLeads) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-20 text-center space-y-3">
                                            <div className="w-16 h-16 bg-gray-900 rounded-2xl border border-gray-800 flex items-center justify-center mx-auto mb-4 grayscale opacity-50">
                                                <Target size={32} className="text-gray-600" />
                                            </div>
                                            <p className="text-gray-400 font-medium italic">Nenhum dado de anúncio capturado ainda.</p>
                                            <p className="text-xs text-gray-600">Certifique-se de que suas campanhas CTWA estão ativas.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* State Distribution */}
                            <div className="bg-[#111111] border border-gray-800/50 rounded-2xl p-6 shadow-xl">
                                <h3 className="text-lg font-bold flex items-center gap-2 mb-8">
                                    <MapPin className="text-orange-500" size={20} />
                                    Distribuição Geográfica (Brasil)
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {stats?.topStates?.map((item: any) => (
                                        <div key={item.state} className="bg-[#0d0d0d] border border-gray-800 p-3 rounded-xl flex flex-col items-center hover:border-orange-500/30 transition-colors">
                                            <span className="text-xl font-black text-white mb-1">{item.state}</span>
                                            <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">{item.count} leads</span>
                                        </div>
                                    ))}
                                    {(!stats?.topStates || stats.topStates.length === 0) && (
                                        <div className="col-span-full py-8 text-center text-gray-600 text-xs italic">
                                            Aguardando geolocalização por DDD...
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Sidebar with Stats and Recent */}
                        <div className="space-y-8">
                            {/* CTR / Efficiency Card */}
                            <div className="bg-gradient-to-br from-primary/20 to-[#111111] border border-primary/20 rounded-2xl p-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <TrendingUp size={64} className="text-primary" />
                                </div>
                                <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">Eficiência de Ads</h4>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-gray-300">Share de Anúncios</span>
                                            <span className="text-white font-black">{stats?.totalLeads ? Math.round((stats.adLeads / stats.totalLeads) * 100) : 0}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-black/40 rounded-full">
                                            <div className="h-full bg-primary rounded-full" style={{ width: `${stats?.totalLeads ? (stats.adLeads / stats.totalLeads) * 100 : 0}%` }}></div>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-500 leading-relaxed italic">
                                        Esta métrica mostra a porcentagem de leads que iniciaram conversa através de um botão de WhatsApp em anúncios da Meta.
                                    </p>
                                </div>
                            </div>

                            {/* Recent Active Leads */}
                            <div className="bg-[#111111] border border-gray-800/50 rounded-2xl overflow-hidden flex flex-col shadow-xl">
                                <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                                    <h3 className="text-sm font-bold flex items-center gap-2">
                                        <Users size={16} className="text-blue-400" />
                                        Últimas Origens
                                    </h3>
                                    <Filter size={14} className="text-gray-500" />
                                </div>
                                <div className="divide-y divide-gray-800 max-h-[450px] overflow-y-auto">
                                    {recentLeads?.length > 0 ? (
                                        recentLeads.map((lead: any) => (
                                            <div key={lead.id} className="p-4 hover:bg-white/5 transition-colors group">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                                        {lead.source === 'META_ADS' ? '🔥 Meta Ads' : '🌐 Orgânico'}
                                                    </span>
                                                    <span className="text-[9px] text-gray-600 font-medium">
                                                        {new Date(lead.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <p className="text-xs font-bold text-gray-200 mb-1 flex items-center gap-1.5">
                                                    {lead.contactName || 'Contato'}
                                                    {lead.contactState && (
                                                        <span className="text-[9px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-black">{lead.contactState}</span>
                                                    )}
                                                </p>
                                                {lead.adTitle && (
                                                    <p className="text-[10px] text-gray-500 truncate group-hover:text-primary transition-colors">
                                                        {lead.adTitle}
                                                    </p>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-8 text-center text-xs text-gray-600 italic">
                                            Nenhum lead recente...
                                        </div>
                                    )}
                                </div>
                                <button className="p-3 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white hover:bg-white/5 transition border-t border-gray-800 flex items-center justify-center gap-2 group">
                                    Ver todos os leads
                                    <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}

function SummaryCard({ title, value, icon, trend, trendUp, subtitle, color }: any) {
    const colorMap: any = {
        blue: 'border-blue-500/20 hover:border-blue-500/50 hover:shadow-blue-500/5',
        primary: 'border-primary/20 hover:border-primary/50 hover:shadow-primary/5',
        purple: 'border-purple-500/20 hover:border-purple-500/50 hover:shadow-purple-500/5',
        orange: 'border-orange-500/20 hover:border-orange-500/50 hover:shadow-orange-500/5'
    }

    return (
        <div className={`bg-[#111111] border ${colorMap[color]} p-5 rounded-2xl transition duration-300 group`}>
            <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 bg-[#0a0a0a] border border-gray-800 rounded-xl group-hover:scale-110 group-hover:border-white/10 transition-transform`}>
                    {icon}
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${trendUp ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                        }`}>
                        {trendUp ? <ArrowUpRight size={10} /> : <TrendingUp className="rotate-180" size={10} />}
                        {trend}
                    </div>
                )}
            </div>
            <div>
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">{title}</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl font-black text-white tracking-tighter">
                        {typeof value === 'number' ? value.toLocaleString() : value}
                    </h3>
                    {subtitle && <span className="text-[10px] font-bold text-gray-600 uppercase">{subtitle}</span>}
                </div>
            </div>
        </div>
    )
}

export default function AnalyticsPage() {
    return (
        <AuthGuard>
            <AnalyticsContent />
        </AuthGuard>
    )
}
