'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Tag as TagIcon } from 'lucide-react'

interface Tag {
  id: string
  name: string
  color: string
  description?: string
  createdAt: string
  updatedAt: string
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    color: '#8b5cf6',
    description: '',
  })

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  const tenantId = 'demo-tenant'

  useEffect(() => {
    loadTags()
  }, [])

  const loadTags = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/api/tags?tenantId=${tenantId}`)
      if (response.ok) {
        const data = await response.json()
        setTags(data)
      }
    } catch (error) {
      console.error('Error loading tags:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      const response = await fetch(`${API_URL}/api/tags?tenantId=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await loadTags()
        setShowModal(false)
        setFormData({ name: '', color: '#8b5cf6', description: '' })
      } else {
        const error = await response.json()
        alert(error.message || 'Erro ao criar tag')
      }
    } catch (error) {
      console.error('Error creating tag:', error)
      alert('Erro ao criar tag')
    }
  }

  const handleUpdate = async () => {
    if (!editingTag) return

    try {
      const response = await fetch(`${API_URL}/api/tags/${editingTag.id}?tenantId=${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await loadTags()
        setShowModal(false)
        setEditingTag(null)
        setFormData({ name: '', color: '#8b5cf6', description: '' })
      } else {
        const error = await response.json()
        alert(error.message || 'Erro ao atualizar tag')
      }
    } catch (error) {
      console.error('Error updating tag:', error)
      alert('Erro ao atualizar tag')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta tag?')) return

    try {
      const response = await fetch(`${API_URL}/api/tags/${id}?tenantId=${tenantId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadTags()
      } else {
        const error = await response.json()
        alert(error.message || 'Erro ao deletar tag')
      }
    } catch (error) {
      console.error('Error deleting tag:', error)
      alert('Erro ao deletar tag')
    }
  }

  const openCreateModal = () => {
    setEditingTag(null)
    setFormData({ name: '', color: '#8b5cf6', description: '' })
    setShowModal(true)
  }

  const openEditModal = (tag: Tag) => {
    setEditingTag(tag)
    setFormData({
      name: tag.name,
      color: tag.color,
      description: tag.description || '',
    })
    setShowModal(true)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">🏷️ Gerenciar Tags</h1>
            <p className="text-gray-400">
              Crie e organize tags para categorizar seus contatos
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg hover:bg-primary/80 transition font-semibold"
          >
            <Plus size={20} />
            Nova Tag
          </button>
        </div>

        {/* Tags Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-gray-400">Carregando...</div>
          </div>
        ) : tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <TagIcon size={64} className="mb-4 opacity-20" />
            <p className="text-lg mb-2">Nenhuma tag criada ainda</p>
            <p className="text-sm">Crie sua primeira tag para começar a organizar seus contatos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="bg-[#151515] border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: tag.color + '20' }}
                    >
                      <TagIcon size={20} style={{ color: tag.color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{tag.name}</h3>
                      {tag.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{tag.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(tag)}
                      className="p-2 hover:bg-gray-800 rounded transition"
                    >
                      <Edit2 size={16} className="text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDelete(tag.id)}
                      className="p-2 hover:bg-red-500/20 rounded transition"
                    >
                      <Trash2 size={16} className="text-red-400" />
                    </button>
                  </div>
                </div>
                <div
                  className="inline-block px-2 py-1 rounded text-xs font-medium"
                  style={{
                    backgroundColor: tag.color + '20',
                    color: tag.color,
                  }}
                >
                  {tag.name}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">
                {editingTag ? 'Editar Tag' : 'Nova Tag'}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Nome da Tag</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="ex: novo-lead, vip, interessado"
                    className="w-full px-4 py-2 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Cor</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-16 h-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="flex-1 px-4 py-2 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Descrição (opcional)</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descreva o propósito desta tag..."
                    rows={3}
                    className="w-full px-4 py-2 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-white resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowModal(false)
                    setEditingTag(null)
                    setFormData({ name: '', color: '#8b5cf6', description: '' })
                  }}
                  className="flex-1 px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={editingTag ? handleUpdate : handleCreate}
                  disabled={!formData.name.trim()}
                  className="flex-1 px-4 py-2 bg-primary text-black rounded hover:bg-primary/80 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingTag ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}



