'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import { AuthGuard } from '@/components/AuthGuard'
import AppHeader from '@/components/AppHeader'
import {
    Key,
    Plus,
    Trash2,
    Edit2,
    Loader2,
    X,
    Save,
    AlertCircle,
    CheckCircle2,
    Power,
    ShoppingBag,
    Info,
    Eye,
    EyeOff,
} from 'lucide-react'

interface ApiConfig {
    id: string
    provider: string
    appId: string
    isActive: boolean
    createdAt: string
    updatedAt: string
}

const PROVIDER_META: Record<string, { label: string; color: string; icon: string; description: string; docsHint: string }> = {
    shopee: {
        label: 'Shopee Affiliate',
        color: 'text-orange-400',
        icon: '🛒',
        description: 'API de afiliados da Shopee para buscar e enviar ofertas de produtos automaticamente.',
        docsHint: 'Acesse: affiliate.shopee.com.br → Ferramentas → API → Criar aplicativo',
    },
    pushcut: {
        label: 'Pushcut',
        color: 'text-blue-400',
        icon: '📱',
        description: 'API de Notificações do Pushcut para receber alertas no celular.',
        docsHint: 'Insira qualquer valor no App ID. Apenas o Secret (API-Key) é utilizado.',
    },
    openrouter: {
        label: 'OpenRouter (IA)',
        color: 'text-purple-400',
        icon: '🧠',
        description: 'API de Inteligência Artificial para reconhecimento de Pix e recibos.',
        docsHint: 'Acesse: openrouter.ai → Keys. (O App ID pode ser qualquer nome).',
    },
}

function providerMeta(provider: string) {
    return PROVIDER_META[provider] ?? {
        label: provider.charAt(0).toUpperCase() + provider.slice(1),
        color: 'text-gray-400',
        icon: '🔌',
        description: 'Integração de API externa.',
        docsHint: '',
    }
}

const AVAILABLE_PROVIDERS = ['shopee', 'pushcut', 'openrouter']

function ApiSettingsContent() {
    const [loading, setLoading] = useState(true)
    const [configs, setConfigs] = useState<ApiConfig[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingProvider, setEditingProvider] = useState<string>('shopee')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formAppId, setFormAppId] = useState('')
    const [formSecret, setFormSecret] = useState('')
    const [showSecret, setShowSecret] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [toggling, setToggling] = useState<string | null>(null)

    useEffect(() => {
        loadConfigs()
    }, [])

    const loadConfigs = async () => {
        try {
            setLoading(true)
            const data = await apiClient.getApiConfigs()
            setConfigs(data)
        } catch (e) {
            console.error('Error loading api configs:', e)
        } finally {
            setLoading(false)
        }
    }

    const openModal = (config?: ApiConfig) => {
        if (config) {
            setEditingProvider(config.provider)
            setEditingId(config.id)
            setFormAppId(config.appId)
            setFormSecret('')
        } else {
            const configured = configs.map(c => c.provider)
            const nextProvider = AVAILABLE_PROVIDERS.find(p => !configured.includes(p)) || 'shopee'
            setEditingProvider(nextProvider)
            setEditingId(null)
            setFormAppId('')
            setFormSecret('')
        }
        setShowSecret(false)
        setError(null)
        setIsModalOpen(true)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        const isAppIdOptional = editingProvider === 'pushcut' || editingProvider === 'openrouter'
        if (!isAppIdOptional && !formAppId.trim()) { setError('App ID é obrigatório.'); return }
        if (!editingId && !formSecret.trim()) { setError('Secret é obrigatório ao criar.'); return }

        try {
            setSaving(true)
            setError(null)
            const resolvedAppId = (isAppIdOptional && !formAppId.trim()) ? editingProvider : formAppId.trim()
            await apiClient.upsertApiConfig(editingProvider, resolvedAppId, formSecret.trim() || '__keep__')
            await loadConfigs()
            setIsModalOpen(false)
        } catch (e: any) {
            setError(e.response?.data?.message || 'Erro ao salvar credenciais.')
        } finally {
            setSaving(false)
        }
    }

    const handleToggle = async (provider: string, current: boolean) => {
        try {
            setToggling(provider)
            await apiClient.setApiConfigActive(provider, !current)
            await loadConfigs()
        } catch (e) {
            console.error('Error toggling api config:', e)
        } finally {
            setToggling(null)
        }
    }

    const handleDelete = async (provider: string) => {
        if (!confirm(`Excluir as credenciais de ${providerMeta(provider).label}?`)) return
        try {
            await apiClient.deleteApiConfig(provider)
            await loadConfigs()
        } catch (e) {
            console.error('Error deleting api config:', e)
        }
    }

    const configuredProviders = configs.map(c => c.provider)
    const canAddMore = AVAILABLE_PROVIDERS.some(p => !configuredProviders.includes(p))

    if (loading && configs.length === 0) {
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

                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl">
                                <Key className="text-primary" size={24} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-white px-1">APIs <span className="text-primary italic">Externas</span></h1>
                                <p className="text-gray-500 text-sm px-1">Credenciais de APIs de marketplace e afiliados do seu workspace.</p>
                            </div>
                        </div>

                        {canAddMore && (
                            <button
                                onClick={() => openModal()}
                                className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-black rounded-xl font-black text-xs uppercase tracking-widest hover:shadow-[0_0_20px_rgba(0,186,124,0.4)] transition-all hover:-translate-y-0.5"
                            >
                                <Plus size={18} strokeWidth={3} />
                                Adicionar API
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="grid grid-cols-1 gap-4">
                        {configs.length > 0 ? configs.map((cfg) => {
                            const meta = providerMeta(cfg.provider)
                            return (
                                <div
                                    key={cfg.id}
                                    className={`bg-[#111111] border ${cfg.isActive ? 'border-primary/30' : 'border-gray-800'} rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:bg-[#151515]`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`text-3xl w-12 h-12 flex items-center justify-center rounded-xl ${cfg.isActive ? 'bg-orange-500/10' : 'bg-gray-900'}`}>
                                            {meta.icon}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-lg">{meta.label}</h3>
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${cfg.isActive ? 'bg-primary/20 text-primary' : 'bg-gray-800 text-gray-500'}`}>
                                                    {cfg.isActive ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
                                                <span>App ID: {cfg.appId.substring(0, 4)}****{cfg.appId.slice(-3)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleToggle(cfg.provider, cfg.isActive)}
                                            disabled={toggling === cfg.provider}
                                            title={cfg.isActive ? 'Desativar' : 'Ativar'}
                                            className={`p-2.5 rounded-xl transition-all ${cfg.isActive ? 'text-primary hover:bg-primary/10' : 'text-gray-600 hover:text-gray-400 hover:bg-white/5'}`}
                                        >
                                            {toggling === cfg.provider ? <Loader2 size={18} className="animate-spin" /> : <Power size={18} />}
                                        </button>
                                        <button
                                            onClick={() => openModal(cfg)}
                                            title="Editar"
                                            className="p-2.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(cfg.provider)}
                                            title="Excluir"
                                            className="p-2.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            )
                        }) : (
                            <div className="bg-[#111111] border border-gray-800 border-dashed rounded-3xl p-20 text-center space-y-4">
                                <div className="w-16 h-16 bg-gray-900 border border-gray-800 rounded-2xl flex items-center justify-center mx-auto text-gray-600">
                                    <Key size={32} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-300">Nenhuma API Configurada</h3>
                                    <p className="text-sm text-gray-600">Adicione suas credenciais de API para usar nos nodes de automação.</p>
                                </div>
                                <button
                                    onClick={() => openModal()}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-black rounded-xl font-black text-xs uppercase tracking-widest hover:shadow-[0_0_20px_rgba(0,186,124,0.4)] transition-all"
                                >
                                    <Plus size={16} strokeWidth={3} /> Adicionar Shopee API
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Info box */}
                    <div className="bg-[#111111] border border-gray-800 rounded-2xl p-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 shrink-0">
                                <Info size={20} />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-bold text-sm">Como funciona</h3>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    As credenciais ficam salvas por workspace e são usadas automaticamente pelos nodes de automação (ex: Promo Shopee).
                                    Nunca ficam expostas para os usuários do bot. Para obter suas credenciais de afiliado, acesse o portal de afiliados da Shopee e crie um aplicativo de API.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-lg bg-[#0d0d0d] border border-gray-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{providerMeta(editingProvider).icon}</span>
                                <div>
                                    <h2 className="text-lg font-black">{editingId ? 'Editar' : 'Adicionar'} {providerMeta(editingProvider).label}</h2>
                                    <p className="text-xs text-gray-500">{providerMeta(editingProvider).docsHint}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-full transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-5">
                            {!editingId && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Plataforma</label>
                                    <select
                                        value={editingProvider}
                                        onChange={(e) => setEditingProvider(e.target.value)}
                                        className="w-full bg-[#151515] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                                    >
                                        {AVAILABLE_PROVIDERS.filter(p => !configs.map(c => c.provider).includes(p) || p === editingProvider).map(p => (
                                            <option key={p} value={p}>{providerMeta(p).label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">App ID {(editingProvider === 'pushcut' || editingProvider === 'openrouter') && '(Opcional/Ignorado)'}</label>
                                <input
                                    type="text"
                                    value={formAppId}
                                    onChange={(e) => setFormAppId(e.target.value)}
                                    placeholder={(editingProvider === 'pushcut' || editingProvider === 'openrouter') ? "Pode deixar em branco" : "Seu App ID"}
                                    className="w-full bg-[#151515] border border-gray-800 rounded-xl px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-mono"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">
                                    Secret {editingId && <span className="text-gray-600 normal-case font-normal">(deixe vazio para manter)</span>}
                                </label>
                                <div className="relative group">
                                    <input
                                        type={showSecret ? 'text' : 'password'}
                                        value={formSecret}
                                        onChange={(e) => setFormSecret(e.target.value)}
                                        placeholder={editingId ? '••••••••••••••••' : 'Sua chave secreta'}
                                        className="w-full bg-[#151515] border border-gray-800 rounded-xl pl-4 pr-12 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowSecret(!showSecret)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 p-1"
                                    >
                                        {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            <div className="pt-2 flex gap-3">
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
                                    Salvar Credenciais
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function ApisSettingsPage() {
    return (
        <AuthGuard>
            <ApiSettingsContent />
        </AuthGuard>
    )
}
