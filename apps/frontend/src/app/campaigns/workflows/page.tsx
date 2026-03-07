'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Edit2, Play, Pause, GitBranch, ChevronRight } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { AuthGuard } from '@/components/AuthGuard'
import AppHeader from '@/components/AppHeader'
import CampaignsSidebar from '@/components/campaigns/CampaignsSidebar'

type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED'

interface Campaign {
  id: string
  name: string
  status: CampaignStatus
  createdAt: string
  _count: { recipients: number }
}

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

function WorkflowsPageContent() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      const data = await apiClient.getCampaigns('WORKFLOW')
      setCampaigns(data)
    } catch { /* noop */ } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      const result = await apiClient.createCampaign({ name: newName.trim(), type: 'WORKFLOW' })
      setCreating(false)
      setNewName('')
      router.push(`/campaigns/workflows/${result.id}`)
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao criar')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este fluxo?')) return
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
              <h1 className="text-2xl font-bold text-white">Fluxos de Campanha</h1>
              <p className="text-gray-400 text-sm mt-1">Crie fluxos de mensagens automatizadas com editor visual</p>
            </div>
            <button onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#00ff88] text-black font-bold rounded-lg text-sm hover:bg-[#00dd77] transition">
              <Plus size={16} /> Novo Fluxo
            </button>
          </div>

          {creating && (
            <div className="bg-[#1a1a1a] border border-[#00ff88]/30 rounded-xl p-5 mb-4 flex items-center gap-3">
              <input value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00ff88]/50"
                placeholder="Nome do fluxo..." autoFocus />
              <button onClick={handleCreate}
                className="px-4 py-2 bg-[#00ff88] text-black font-bold rounded-lg text-sm hover:bg-[#00dd77] transition">
                Criar
              </button>
              <button onClick={() => { setCreating(false); setNewName('') }}
                className="px-3 py-2 text-gray-400 hover:text-white text-sm transition">Cancelar</button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[#00ff88]/30 border-t-[#00ff88] rounded-full animate-spin" /></div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <GitBranch size={48} className="text-gray-600 mb-4" />
              <p className="text-gray-400 font-medium">Nenhum fluxo criado</p>
              <p className="text-gray-600 text-sm mt-1">Crie um fluxo de campanha para começar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map(campaign => (
                <div key={campaign.id}
                  className="bg-[#1a1a1a] border border-white/10 rounded-xl p-5 flex items-center gap-4 hover:border-white/20 transition cursor-pointer"
                  onClick={() => router.push(`/campaigns/workflows/${campaign.id}`)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-white font-semibold truncate">{campaign.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[campaign.status]}`}>
                        {STATUS_LABELS[campaign.status]}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs">{campaign._count.recipients} destinatários vinculados</p>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {(campaign.status === 'DRAFT' || campaign.status === 'PAUSED') && (
                      <button onClick={() => campaign.status === 'PAUSED'
                        ? apiClient.resumeCampaign(campaign.id).then(load)
                        : apiClient.startCampaign(campaign.id).then(load).catch(e => alert(e?.response?.data?.message))}
                        className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition">
                        <Play size={16} />
                      </button>
                    )}
                    {campaign.status === 'RUNNING' && (
                      <button onClick={() => apiClient.pauseCampaign(campaign.id).then(load)}
                        className="p-2 text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition">
                        <Pause size={16} />
                      </button>
                    )}
                    <button onClick={() => router.push(`/campaigns/workflows/${campaign.id}`)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(campaign.id)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition">
                      <Trash2 size={16} />
                    </button>
                    <ChevronRight size={16} className="text-gray-600" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function WorkflowsPage() {
  return <AuthGuard><WorkflowsPageContent /></AuthGuard>
}
