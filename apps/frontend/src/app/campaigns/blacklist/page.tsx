'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Ban, RefreshCw, X } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { AuthGuard } from '@/components/AuthGuard'
import AppHeader from '@/components/AppHeader'
import CampaignsSidebar from '@/components/campaigns/CampaignsSidebar'

interface BlacklistEntry {
  id: string
  phone: string
  reason?: string
  createdAt: string
}

function BlacklistPageContent() {
  const [list, setList] = useState<BlacklistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ phone: '', reason: '' })
  const [adding, setAdding] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      setList(await apiClient.getCampaignBlacklist())
    } catch { /* noop */ } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!form.phone.trim()) return
    setAdding(true)
    try {
      await apiClient.addToBlacklist(form.phone.trim(), form.reason.trim() || undefined)
      setShowModal(false)
      setForm({ phone: '', reason: '' })
      await load()
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao adicionar')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (phone: string) => {
    if (!confirm(`Remover ${phone} da blacklist?`)) return
    await apiClient.removeFromBlacklist(phone)
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
              <h1 className="text-2xl font-bold text-white">Blacklist</h1>
              <p className="text-gray-400 text-sm mt-1">Números bloqueados não recebem mensagens de campanha</p>
            </div>
            <div className="flex gap-3">
              <button onClick={load} className="p-2 text-gray-400 hover:text-white transition"><RefreshCw size={16} /></button>
              <button onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-400 font-bold rounded-lg text-sm hover:bg-red-500/30 transition">
                <Plus size={16} /> Adicionar
              </button>
            </div>
          </div>

          {/* Stats card */}
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-5 mb-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Ban size={22} className="text-red-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{list.length}</p>
              <p className="text-xs text-gray-500">números bloqueados</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#00ff88]/30 border-t-[#00ff88] rounded-full animate-spin" /></div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Ban size={40} className="text-gray-600 mb-3" />
              <p className="text-gray-400">Nenhum número bloqueado</p>
            </div>
          ) : (
            <div className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Número</th>
                    <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Motivo</th>
                    <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Adicionado em</th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {list.map(entry => (
                    <tr key={entry.id} className="hover:bg-white/3 transition">
                      <td className="px-4 py-3 font-mono text-sm text-white">{entry.phone}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{entry.reason || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(entry.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleRemove(entry.phone)}
                          className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-white font-bold">Adicionar à Blacklist</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Número *</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-red-500/50"
                  placeholder="5511999990000" autoFocus />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Motivo (opcional)</label>
                <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500/50"
                  placeholder="Ex: opted_out, manual, blocked" />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm transition">Cancelar</button>
                <button onClick={handleAdd} disabled={adding}
                  className="px-5 py-2 bg-red-500/20 border border-red-500/30 text-red-400 font-bold rounded-lg text-sm hover:bg-red-500/30 transition disabled:opacity-50">
                  {adding ? 'Adicionando...' : 'Bloquear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BlacklistPage() {
  return <AuthGuard><BlacklistPageContent /></AuthGuard>
}
