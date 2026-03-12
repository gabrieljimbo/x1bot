'use client'

import { useState, useEffect } from 'react'
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  Users, 
  RefreshCw, 
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar
} from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { AuthGuard } from '@/components/AuthGuard'
import AppHeader from '@/components/AppHeader'
import CampaignsSidebar from '@/components/campaigns/CampaignsSidebar'

interface Campaign {
  id: string
  name: string
  status: string
  type: string
  createdAt: string
  _count: { recipients: number }
}

interface CampaignStats {
  total: number
  sent: number
  failed: number
  blocked: number
  pending: number
  progress: number
}

interface CampaignInsights {
  totalTargeted: number
  totalInteracted: number
  conversionRate: number
  nodeStats?: any[]
}

export default function CampaignInsightsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [stats, setStats] = useState<CampaignStats | null>(null)
  const [insights, setInsights] = useState<CampaignInsights | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  const loadCampaigns = async () => {
    try {
      setLoading(true)
      const data = await apiClient.getCampaigns()
      // Filter out templates, only show actual executions
      setCampaigns(data.filter((c: any) => !c.isTemplate))
    } catch (error) {
      console.error('Error loading campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCampaigns()
  }, [])

  const loadDetails = async (campaign: Campaign) => {
    try {
      setLoadingDetails(true)
      setSelectedCampaign(campaign)
      const [statsData, insightsData] = await Promise.all([
        apiClient.getCampaignStats(campaign.id).catch(() => null),
        apiClient.getCampaignInsights(campaign.id).catch(() => null)
      ])
      setStats(statsData)
      setInsights(insightsData)
    } catch (error) {
      console.error('Error loading campaign details:', error)
    } finally {
      setLoadingDetails(false)
    }
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <AppHeader />
        <div className="flex">
          <CampaignsSidebar />
          <main className="flex-1 p-8 overflow-y-auto h-[calc(100vh-64px)]">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-black tracking-tight">
                    Insights de <span className="text-[#00ff88] italic">Campanhas</span>
                  </h1>
                  <p className="text-gray-500 text-sm mt-1">
                    Analise a performance e conversão de seus disparos e fluxos.
                  </p>
                </div>
                <button 
                  onClick={loadCampaigns} 
                  className="p-2 border border-white/10 rounded-lg hover:bg-white/5 transition"
                >
                  <RefreshCw size={20} className={loading ? 'animate-spin text-[#00ff88]' : 'text-gray-400'} />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Campaigns List */}
                <div className="lg:col-span-4 space-y-4">
                  <h2 className="text-xs font-bold text-gray-600 uppercase tracking-widest px-2">Execuções Recentes</h2>
                  <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
                    {loading ? (
                      <div className="p-12 flex justify-center">
                        <div className="w-6 h-6 border-2 border-[#00ff88]/30 border-t-[#00ff88] rounded-full animate-spin" />
                      </div>
                    ) : campaigns.length === 0 ? (
                      <div className="p-8 text-center text-gray-500 text-sm italic">
                        Nenhuma campanha executada encontrada.
                      </div>
                    ) : (
                      campaigns.map(campaign => (
                        <button
                          key={campaign.id}
                          onClick={() => loadDetails(campaign)}
                          className={`w-full text-left p-4 hover:bg-white/5 transition flex items-center justify-between group ${selectedCampaign?.id === campaign.id ? 'bg-[#00ff88]/5 border-l-4 border-l-[#00ff88]' : ''}`}
                        >
                          <div className="min-w-0 pr-2">
                            <p className={`font-bold text-sm truncate ${selectedCampaign?.id === campaign.id ? 'text-[#00ff88]' : 'text-gray-200'}`}>
                              {campaign.name}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter ${
                                campaign.status === 'COMPLETED' ? 'bg-green-500/10 text-green-400' :
                                campaign.status === 'RUNNING' ? 'bg-blue-500/10 text-blue-400 animate-pulse' :
                                'bg-gray-500/10 text-gray-400'
                              }`}>
                                {campaign.status}
                              </span>
                              <span className="text-[10px] text-gray-600 font-medium">
                                {new Date(campaign.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <ChevronRight size={16} className={`text-gray-700 group-hover:text-gray-400 transition-transform ${selectedCampaign?.id === campaign.id ? 'translate-x-1 text-[#00ff88]' : ''}`} />
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Insights Details */}
                <div className="lg:col-span-8 space-y-6">
                  {!selectedCampaign ? (
                    <div className="h-full min-h-[400px] border border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center text-center p-12 bg-white/[0.02]">
                      <div className="w-16 h-16 bg-[#111] rounded-2xl border border-white/5 flex items-center justify-center mb-4 text-gray-600">
                        <Target size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-gray-300">Nenhuma campanha selecionada</h3>
                      <p className="text-gray-500 text-sm mt-2 max-w-xs">
                        Selecione uma execução ao lado para visualizar as métricas detalhadas e o funil de conversão.
                      </p>
                    </div>
                  ) : loadingDetails ? (
                    <div className="h-full min-h-[400px] flex items-center justify-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-10 h-10 border-4 border-[#00ff88]/20 border-t-[#00ff88] rounded-full animate-spin" />
                        <p className="text-gray-500 font-medium animate-pulse">Cruzando dados...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                      
                      {/* Summary Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="bg-[#111] border border-white/5 p-5 rounded-2xl">
                          <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-blue-500/10 rounded-lg"><Users className="text-blue-500" size={18} /></div>
                            {stats && <span className="text-[10px] font-black text-blue-500 uppercase">{stats.progress}%</span>}
                          </div>
                          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Total de Envios</p>
                          <h3 className="text-2xl font-black text-white">{stats?.sent || 0} <span className="text-gray-700 text-sm font-normal">/ {stats?.total || 0}</span></h3>
                        </div>

                        <div className="bg-[#111] border border-white/5 p-5 rounded-2xl">
                          <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-[#00ff88]/10 rounded-lg"><TrendingUp className="text-[#00ff88]" size={18} /></div>
                            {insights && <span className="text-[10px] font-black text-[#00ff88] uppercase">+{insights.conversionRate.toFixed(1)}%</span>}
                          </div>
                          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Interações</p>
                          <h3 className="text-2xl font-black text-white">{insights?.totalInteracted || 0}</h3>
                        </div>

                        <div className="bg-[#111] border border-white/5 p-5 rounded-2xl sm:col-span-2 lg:col-span-1">
                          <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-purple-500/10 rounded-lg"><Target className="text-purple-500" size={18} /></div>
                          </div>
                          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Taxa de Conversão</p>
                          <h3 className="text-2xl font-black text-white">{insights?.conversionRate.toFixed(1)}%</h3>
                        </div>
                      </div>

                      {/* Progression Detail */}
                      <div className="bg-[#111] border border-white/5 rounded-2xl p-6">
                        <h3 className="text-sm font-bold flex items-center gap-2 mb-6 text-gray-300">
                          <Clock size={16} className="text-gray-500" /> Detalhes da Entrega
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                          <div className="space-y-1">
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter flex items-center gap-1.5">
                              <CheckCircle2 size={10} className="text-green-500" /> Sucesso
                            </p>
                            <p className="text-lg font-black">{stats?.sent || 0}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter flex items-center gap-1.5">
                              <RefreshCw size={10} className="text-blue-500" /> Pendentes
                            </p>
                            <p className="text-lg font-black">{stats?.pending || 0}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter flex items-center gap-1.5">
                              <XCircle size={10} className="text-red-500" /> Falhas
                            </p>
                            <p className="text-lg font-black">{stats?.failed || 0}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter flex items-center gap-1.5">
                              <AlertCircle size={10} className="text-orange-500" /> Bloqueios
                            </p>
                            <p className="text-lg font-black">{stats?.blocked || 0}</p>
                          </div>
                        </div>
                      </div>

                      {/* Funnel Section */}
                      {insights && (
                        <div className="bg-[#111] border border-white/5 rounded-2xl p-8 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none group-hover:scale-110 transition-transform duration-700">
                            <TrendingUp size={200} />
                          </div>
                          <h3 className="text-sm font-bold flex items-center gap-2 mb-8 text-gray-300 relative z-10">
                            <BarChart3 size={16} className="text-[#00ff88]" /> Funil de Performance
                          </h3>
                          
                          <div className="space-y-8 relative z-10">
                            {/* Level 1: Targeted */}
                            <div className="space-y-2">
                              <div className="flex justify-between items-end">
                                <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Público Alvo</span>
                                <span className="text-sm font-black">{insights.totalTargeted} <span className="text-[10px] text-gray-600 font-bold uppercase ml-1">leads</span></span>
                              </div>
                              <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                                <div className="h-full bg-blue-500/40 w-full" />
                              </div>
                            </div>

                            {/* Level 2: Interacted */}
                            <div className="space-y-2">
                              <div className="flex justify-between items-end">
                                <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Engajamento / Respostas</span>
                                <div className="text-right">
                                  <span className="text-sm font-black text-[#00ff88]">{insights.totalInteracted}</span>
                                  <span className="text-[10px] text-[#00ff88]/60 font-bold uppercase ml-1">({insights.totalTargeted > 0 ? Math.round((insights.totalInteracted / insights.totalTargeted) * 100) : 0}%)</span>
                                </div>
                              </div>
                              <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                                <div 
                                  className="h-full bg-gradient-to-r from-[#00ff88]/30 to-[#00ff88]/60 transition-all duration-1000 ease-out"
                                  style={{ width: `${insights.totalTargeted > 0 ? (insights.totalInteracted / insights.totalTargeted) * 100 : 0}%` }}
                                />
                              </div>
                            </div>

                            <p className="text-[10px] text-gray-600 italic text-center max-w-sm mx-auto">
                              Engajamento é medido por contatos que responderam ao disparo ou avançaram em etapas cruciais do fluxo.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Workflow Node Stats */}
                      {insights?.nodeStats && insights.nodeStats.length > 0 && (
                        <div className="bg-[#111] border border-white/5 rounded-2xl p-6">
                           <h3 className="text-sm font-bold flex items-center gap-2 mb-6 text-gray-300">
                            <Calendar size={16} className="text-[#00ff88]" /> Métricas por Etapa
                          </h3>
                          <div className="space-y-3">
                            {insights.nodeStats.map((stat: any) => {
                              const successRate = stat.totalExecutions > 0 ? Math.round((stat.successCount / stat.totalExecutions) * 100) : 0;
                              return (
                                <div key={stat.nodeId} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex items-center justify-between hover:border-white/10 transition-colors">
                                  <div className="min-w-0 pr-4">
                                    <p className="text-white text-sm font-bold truncate">Nó: {stat.nodeId}</p>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                                      {stat.totalExecutions} execuções • {stat.failCount} falhas
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end shrink-0">
                                    <span className="text-[10px] font-black text-[#00ff88] uppercase tracking-widest">{successRate}% Sucesso</span>
                                    <div className="w-24 h-1.5 bg-black/40 rounded-full mt-1 overflow-hidden border border-white/5">
                                      <div className="h-full bg-[#00ff88]" style={{ width: `${successRate}%` }} />
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  )
}
