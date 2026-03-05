'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import { AuthGuard } from '@/components/AuthGuard'
import AppHeader from '@/components/AppHeader'
import {
    BarChart3,
    Save,
    Shield,
    Info,
    ExternalLink,
    Target,
    Key,
    Database,
    CheckCircle2,
    AlertCircle,
    Plus,
    Trash2,
    Edit2,
    Star,
    Loader2,
    X
} from 'lucide-react'

interface PixelConfig {
    id: string;
    name: string;
    pixelId: string;
    isDefault: boolean;
    autoSendLead: boolean;
    includeState: boolean;
    testEventCode?: string;
    accessToken?: string;
}

function PixelSettingsContent() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [pixels, setPixels] = useState<PixelConfig[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingPixel, setEditingPixel] = useState<Partial<PixelConfig> | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadPixels()
    }, [])

    const loadPixels = async () => {
        try {
            setLoading(true)
            const data = await apiClient.getPixels()
            setPixels(data)
        } catch (e) {
            console.error('Error loading pixels:', e)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingPixel?.name || !editingPixel?.pixelId || (!editingPixel.id && !editingPixel.accessToken)) {
            setError('Por favor preencha os campos obrigatórios.')
            return
        }

        try {
            setSaving(true)
            setError(null)

            if (editingPixel.id) {
                await apiClient.updatePixel(editingPixel.id, editingPixel)
            } else {
                await apiClient.createPixel(editingPixel)
            }

            await loadPixels()
            setIsModalOpen(false)
            setEditingPixel(null)
        } catch (e: any) {
            setError(e.response?.data?.message || 'Erro ao salvar pixel')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este pixel?')) return
        try {
            await apiClient.deletePixel(id)
            await loadPixels()
        } catch (e) {
            console.error('Error deleting pixel:', e)
        }
    }

    const handleSetDefault = async (id: string) => {
        try {
            await apiClient.setPixelDefault(id)
            await loadPixels()
        } catch (e) {
            console.error('Error setting default pixel:', e)
        }
    }

    const openModal = (pixel: Partial<PixelConfig> | null = null) => {
        setEditingPixel(pixel || {
            name: '',
            pixelId: '',
            accessToken: '',
            testEventCode: '',
            isDefault: pixels.length === 0,
            autoSendLead: false,
            includeState: true
        })
        setError(null)
        setIsModalOpen(true)
    }

    if (loading && pixels.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col min-h-screen bg-[#0a0a0a] text-white">
            <AppHeader />

            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-4xl mx-auto space-y-8">

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl">
                                <Target className="text-primary" size={24} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-white px-1">Meta Pixels <span className="text-primary italic">Workspace</span></h1>
                                <p className="text-gray-500 text-sm px-1">Gerencie múltiplos pixels para tracking Meta Ads & CAPI.</p>
                            </div>
                        </div>

                        <button
                            onClick={() => openModal()}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-black rounded-xl font-black text-xs uppercase tracking-widest hover:shadow-[0_0_20px_rgba(0,186,124,0.4)] transition-all hover:-translate-y-0.5"
                        >
                            <Plus size={18} strokeWidth={3} />
                            Adicionar Pixel
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {pixels.length > 0 ? (
                            pixels.map((pixel) => (
                                <div key={pixel.id} className={`bg-[#111111] border ${pixel.isDefault ? 'border-primary/50 bg-primary/5' : 'border-gray-800'} rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:bg-[#151515]`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl ${pixel.isDefault ? 'bg-primary/20 text-primary' : 'bg-gray-900 text-gray-400'}`}>
                                            <Database size={20} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-lg">{pixel.name}</h3>
                                                {pixel.isDefault && (
                                                    <span className="text-[9px] font-black uppercase tracking-widest bg-primary text-black px-2 py-0.5 rounded-full">Padrão</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
                                                <span className="flex items-center gap-1.5">
                                                    ID: {pixel.pixelId.substring(0, 4)}****{pixel.pixelId.slice(-3)}
                                                </span>
                                                <span className="hidden sm:flex items-center gap-1.5">
                                                    <CheckCircle2 size={12} className={pixel.autoSendLead ? "text-primary" : "text-gray-700"} />
                                                    {pixel.autoSendLead ? "Lead Auto-Send" : "Manual Send"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {!pixel.isDefault && (
                                            <button
                                                onClick={() => handleSetDefault(pixel.id)}
                                                className="p-2.5 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                                                title="Definir como padrão"
                                            >
                                                <Star size={18} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => openModal(pixel)}
                                            className="p-2.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                                            title="Editar"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(pixel.id)}
                                            className="p-2.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                            title="Excluir"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="bg-[#111111] border border-gray-800 border-dashed rounded-3xl p-20 text-center space-y-4">
                                <div className="w-16 h-16 bg-gray-900 border border-gray-800 rounded-2xl flex items-center justify-center mx-auto text-gray-600">
                                    <Target size={32} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-300">Nenhum Pixel Cadastrado</h3>
                                    <p className="text-sm text-gray-600">Adicione seu primeiro pixel para começar a rastrear conversões.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Docs / Help */}
                    <div className="bg-[#111111] border border-gray-800 rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-700">
                            <Shield size={160} />
                        </div>
                        <div className="flex items-start gap-4 relative z-10">
                            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                                <Info size={24} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-bold">Por que múltiplos pixels?</h3>
                                <p className="text-sm text-gray-500 leading-relaxed max-w-2xl">
                                    Se você gerencia múltiplos produtos, ofertas ou tem sub-domínios diferentes para seus funis, cada um pode exigir um Pixel ID diferente.
                                    O X1Bot permite que você selecione o pixel correto diretamente no node do fluxo de atendimento.
                                </p>
                                <div className="pt-2 flex items-center gap-4">
                                    <a href="#" className="text-primary text-xs font-bold hover:underline flex items-center gap-1">
                                        <ExternalLink size={12} /> Sugestões de estrutura
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Modal CRUD */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-xl bg-[#0d0d0d] border border-gray-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                            <h2 className="text-xl font-black">{editingPixel?.id ? 'Editar' : 'Novo'} Meta Pixel</h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-full transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2 col-span-full">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Nome do Pixel (Identificação)</label>
                                    <input
                                        type="text"
                                        value={editingPixel?.name}
                                        onChange={(e) => setEditingPixel({ ...editingPixel, name: e.target.value })}
                                        placeholder="Ex: Pixel Produto A, Pixel Principal..."
                                        className="w-full bg-[#151515] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Pixel ID</label>
                                    <input
                                        type="text"
                                        value={editingPixel?.pixelId}
                                        onChange={(e) => setEditingPixel({ ...editingPixel, pixelId: e.target.value })}
                                        placeholder="123456789..."
                                        className="w-full bg-[#151515] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Test Event Code (Opcional)</label>
                                    <input
                                        type="text"
                                        value={editingPixel?.testEventCode || ''}
                                        onChange={(e) => setEditingPixel({ ...editingPixel, testEventCode: e.target.value })}
                                        placeholder="TEST1234..."
                                        className="w-full bg-[#151515] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Access Token (CAPI)</label>
                                <div className="relative group">
                                    <Key size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-primary" />
                                    <input
                                        type="password"
                                        value={editingPixel?.accessToken || ''}
                                        onChange={(e) => setEditingPixel({ ...editingPixel, accessToken: e.target.value })}
                                        placeholder={editingPixel?.id ? '••••••••••••••••••••' : 'EAAB...'}
                                        className="w-full bg-[#151515] border border-gray-800 rounded-xl pl-10 pr-4 py-3 text-xs focus:border-primary outline-none transition-all font-mono"
                                    />
                                </div>
                                {editingPixel?.id && <p className="text-[9px] text-gray-600 px-1 italic">Deixe em branco para manter o token atual.</p>}
                            </div>

                            <div className="p-4 bg-white/5 rounded-2xl space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500">
                                            <Star size={16} fill={editingPixel?.isDefault ? "currentColor" : "none"} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-200">Pixel Padrão</p>
                                            <p className="text-[9px] text-gray-500">Usado se nenhum outro for selecionado.</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={editingPixel?.isDefault} onChange={(e) => setEditingPixel({ ...editingPixel, isDefault: e.target.checked })} className="sr-only peer" />
                                        <div className="w-10 h-5 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                            <BarChart3 size={16} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-200">Lead Auto-Send</p>
                                            <p className="text-[9px] text-gray-500">Sempre disparar Lead na detecção de Ads.</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={editingPixel?.autoSendLead} onChange={(e) => setEditingPixel({ ...editingPixel, autoSendLead: e.target.checked })} className="sr-only peer" />
                                        <div className="w-10 h-5 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold animate-in slide-in-from-top-1">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-6 py-3 border border-gray-800 text-gray-400 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white/5 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-[2] px-6 py-3 bg-primary text-black rounded-xl font-black text-xs uppercase tracking-widest hover:shadow-[0_0_20px_rgba(0,186,124,0.4)] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                >
                                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                    Salvar Pixel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function PixelSettingsPage() {
    return (
        <AuthGuard>
            <PixelSettingsContent />
        </AuthGuard>
    )
}
