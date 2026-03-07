'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Upload, Phone, List, X, RefreshCw } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { AuthGuard } from '@/components/AuthGuard'
import AppHeader from '@/components/AppHeader'
import CampaignsSidebar from '@/components/campaigns/CampaignsSidebar'

interface ContactListItem {
  id: string
  phone: string
  name?: string
  createdAt: string
}

interface ContactListDetail {
  id: string
  name: string
  description?: string
  contacts: ContactListItem[]
}

function ListDetailContent() {
  const params = useParams()
  const router = useRouter()
  const listId = params.id as string

  const [list, setList] = useState<ContactListDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [addMode, setAddMode] = useState<'manual' | 'csv' | 'inbox'>('manual')
  const [manualText, setManualText] = useState('')
  const [csvText, setCsvText] = useState('')
  const [tags, setTags] = useState('')
  const [addResult, setAddResult] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      setList(await apiClient.getContactList(listId))
    } catch { /* noop */ } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [listId])

  const handleAdd = async () => {
    setAdding(true)
    setAddResult(null)
    try {
      let r: any
      if (addMode === 'manual') {
        const contacts = manualText.split('\n').map(l => {
          const [phone, name] = l.split(',').map(s => s.trim())
          return phone ? { phone, name } : null
        }).filter(Boolean) as { phone: string; name?: string }[]
        r = await apiClient.addContactsManually(listId, contacts)
      } else if (addMode === 'csv') {
        r = await apiClient.addContactsFromCsv(listId, csvText)
      } else {
        r = await apiClient.addContactsFromInbox(listId, tags.split(',').map(t => t.trim()).filter(Boolean))
      }
      setAddResult(`${r.added} adicionados. Total: ${r.total}`)
      await load()
    } catch (e: any) {
      setAddResult('Erro: ' + (e?.response?.data?.message || e.message))
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveSelected = async () => {
    if (selected.size === 0) return
    if (!confirm(`Remover ${selected.size} contato(s)?`)) return
    await Promise.all([...selected].map(id => apiClient.removeContact(listId, id)))
    setSelected(new Set())
    await load()
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00ff88]/30 border-t-[#00ff88] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <AppHeader />
      <div className="flex">
        <CampaignsSidebar />
        <div className="flex-1 p-8">
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => router.push('/campaigns/lists')}
              className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition">
              <ArrowLeft size={16} /> Listas
            </button>
            <div className="w-px h-5 bg-white/10" />
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">{list?.name}</h1>
              {list?.description && <p className="text-gray-500 text-sm mt-0.5">{list.description}</p>}
            </div>
            <div className="flex items-center gap-3">
              {selected.size > 0 && (
                <button onClick={handleRemoveSelected}
                  className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm hover:bg-red-500/20 transition">
                  <Trash2 size={14} /> Remover {selected.size}
                </button>
              )}
              <button onClick={load} className="p-2 text-gray-400 hover:text-white transition"><RefreshCw size={16} /></button>
              <button onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#00ff88] text-black font-bold rounded-lg text-sm hover:bg-[#00dd77] transition">
                <Plus size={16} /> Adicionar Contatos
              </button>
            </div>
          </div>

          {/* Stats card */}
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-4 mb-6 flex items-center gap-6">
            <div>
              <p className="text-3xl font-bold text-white">{list?.contacts.length ?? 0}</p>
              <p className="text-xs text-gray-500">Total de contatos</p>
            </div>
          </div>

          {/* Contacts table */}
          {list?.contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Phone size={40} className="text-gray-600 mb-3" />
              <p className="text-gray-400">Nenhum contato adicionado</p>
              <p className="text-gray-600 text-sm mt-1">Clique em "Adicionar Contatos" para começar</p>
            </div>
          ) : (
            <div className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-xs text-gray-500 font-medium px-4 py-3 w-10">
                      <input type="checkbox"
                        checked={selected.size === list?.contacts.length && list?.contacts.length > 0}
                        onChange={() => {
                          if (selected.size === list?.contacts.length) setSelected(new Set())
                          else setSelected(new Set(list?.contacts.map(c => c.id)))
                        }} className="accent-[#00ff88]" />
                    </th>
                    <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Telefone</th>
                    <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Nome</th>
                    <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Adicionado em</th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {list?.contacts.map(contact => (
                    <tr key={contact.id} className={`hover:bg-white/3 transition ${selected.has(contact.id) ? 'bg-white/5' : ''}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(contact.id)}
                          onChange={() => toggleSelect(contact.id)} className="accent-[#00ff88]" />
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-white">{contact.phone}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{contact.name || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(contact.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={async () => { await apiClient.removeContact(listId, contact.id); await load() }}
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

      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-white font-bold">Adicionar Contatos</h2>
              <button onClick={() => { setShowAddModal(false); setAddResult(null) }}
                className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-2">
                {([
                  { m: 'manual' as const, label: 'Manual', icon: <Phone size={12} /> },
                  { m: 'csv' as const, label: 'CSV', icon: <Upload size={12} /> },
                  { m: 'inbox' as const, label: 'Do Inbox', icon: <List size={12} /> },
                ]).map(({ m, label, icon }) => (
                  <button key={m} onClick={() => setAddMode(m)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${addMode === m ? 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/40' : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white'}`}>
                    {icon} {label}
                  </button>
                ))}
              </div>
              {addMode === 'manual' && (
                <textarea rows={6} value={manualText} onChange={e => setManualText(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono resize-none"
                  placeholder={'5511999990000,João\n5521988880000'} />
              )}
              {addMode === 'csv' && (
                <textarea rows={6} value={csvText} onChange={e => setCsvText(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono resize-none"
                  placeholder={'5511999990000,João\n5521988880000,Maria'} />
              )}
              {addMode === 'inbox' && (
                <input value={tags} onChange={e => setTags(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="Tags separadas por vírgula (vazio = todos)" />
              )}
              {addResult && <p className="text-xs text-green-400">{addResult}</p>}
              <div className="flex justify-end gap-3">
                <button onClick={() => { setShowAddModal(false); setAddResult(null) }}
                  className="px-4 py-2 text-gray-400 hover:text-white text-sm transition">Fechar</button>
                <button onClick={handleAdd} disabled={adding}
                  className="px-5 py-2 bg-[#00ff88] text-black font-bold rounded-lg text-sm hover:bg-[#00dd77] transition disabled:opacity-50">
                  {adding ? 'Adicionando...' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ListDetailPage() {
  return <AuthGuard><ListDetailContent /></AuthGuard>
}
