'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Users, ChevronRight, X } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { AuthGuard } from '@/components/AuthGuard'
import AppHeader from '@/components/AppHeader'
import CampaignsSidebar from '@/components/campaigns/CampaignsSidebar'

interface ContactList {
  id: string
  name: string
  description?: string
  createdAt: string
  _count: { contacts: number }
}

function ListsPageContent() {
  const router = useRouter()
  const [lists, setLists] = useState<ContactList[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      setLists(await apiClient.getContactLists())
    } catch { /* noop */ } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await apiClient.createContactList(form.name.trim(), form.description.trim() || undefined)
      setShowModal(false)
      setForm({ name: '', description: '' })
      await load()
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao criar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta lista?')) return
    await apiClient.deleteContactList(id)
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
              <h1 className="text-2xl font-bold text-white">Listas de Contatos</h1>
              <p className="text-gray-400 text-sm mt-1">Organize seus contatos em listas para usar em campanhas</p>
            </div>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#00ff88] text-black font-bold rounded-lg text-sm hover:bg-[#00dd77] transition">
              <Plus size={16} /> Nova Lista
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[#00ff88]/30 border-t-[#00ff88] rounded-full animate-spin" /></div>
          ) : lists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Users size={48} className="text-gray-600 mb-4" />
              <p className="text-gray-400 font-medium">Nenhuma lista criada</p>
              <p className="text-gray-600 text-sm mt-1">Crie listas para organizar seus contatos</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lists.map(list => (
                <div key={list.id}
                  className="bg-[#1a1a1a] border border-white/10 rounded-xl p-5 hover:border-white/20 transition cursor-pointer"
                  onClick={() => router.push(`/campaigns/lists/${list.id}`)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold truncate">{list.name}</h3>
                      {list.description && <p className="text-gray-500 text-xs mt-0.5 truncate">{list.description}</p>}
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleDelete(list.id) }}
                      className="ml-2 p-1.5 text-red-400 hover:bg-red-500/10 rounded transition flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-gray-400 text-sm">
                      <Users size={14} /> {list._count.contacts} contatos
                    </span>
                    <ChevronRight size={16} className="text-gray-600" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-white font-bold">Nova Lista</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Nome *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00ff88]/50"
                  placeholder="Ex: Clientes VIP" autoFocus />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Descrição (opcional)</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00ff88]/50"
                  placeholder="Descrição da lista..." />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm transition">Cancelar</button>
                <button onClick={handleCreate} disabled={saving}
                  className="px-5 py-2 bg-[#00ff88] text-black font-bold rounded-lg text-sm hover:bg-[#00dd77] transition disabled:opacity-50">
                  {saving ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ListsPage() {
  return <AuthGuard><ListsPageContent /></AuthGuard>
}
