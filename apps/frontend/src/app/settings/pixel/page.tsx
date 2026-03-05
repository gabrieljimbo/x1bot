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
    AlertCircle
} from 'lucide-react'

function PixelSettingsContent() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [config, setConfig] = useState({
        pixelId: '',
        accessToken: ''
    })

    useEffect(() => {
        loadConfig()
    }, [])

    const loadConfig = async () => {
        try {
            setLoading(true)
            const data = await apiClient.getPixelConfig()
            if (data) {
                setConfig({
                    pixelId: data.pixelId || '',
                    accessToken: data.accessToken || ''
                })
            }
        } catch (e) {
            console.error('Error loading pixel config:', e)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            setSaving(true)
            setSuccess(false)
            setError(null)
            await apiClient.updatePixelConfig(config)
            setSuccess(true)
            setTimeout(() => setSuccess(false), 3000)
        } catch (e: any) {
            setError(e.response?.data?.message || 'Erro ao salvar configurações')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col min-h-screen bg-[#0a0a0a] text-white">
            <AppHeader />

            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="max-w-3xl mx-auto space-y-8">

                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl">
                            <Target className="text-primary" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white">Meta Pixel <span className="text-primary italic">Global</span></h1>
                            <p className="text-gray-500 text-sm">Configuração centralizada para a Conversions API (CAPI).</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-8">
                        <div className="bg-[#111111] border border-gray-800 rounded-2xl p-6 shadow-xl">
                            <div className="flex items-start gap-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl mb-8">
                                <Info className="text-blue-400 shrink-0" size={20} />
                                <div className="text-xs text-blue-200/80 leading-relaxed">
                                    <p className="font-bold text-blue-300 mb-1 font-mono uppercase tracking-wider text-[10px]">Por que usar a Conversions API?</p>
                                    A CAPI envia eventos diretamente do servidor do X1Bot para a Meta, ignorando bloqueadores de anúncios e limitações do navegador (iOS 14+), garantindo que você não perca rastreamento de vendas e leads.
                                </div>
                            </div>

                            <form onSubmit={handleSave} className="space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 px-1">
                                            Pixel ID
                                        </label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Database size={16} className="text-gray-600 group-focus-within:text-primary transition-colors" />
                                            </div>
                                            <input
                                                type="text"
                                                value={config.pixelId}
                                                onChange={(e) => setConfig({ ...config, pixelId: e.target.value })}
                                                placeholder="Ex: 123456789012345"
                                                className="w-full pl-12 pr-4 py-3.5 bg-[#0d0d0d] border border-gray-800 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20 text-white transition-all outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 px-1">
                                            Access Token (CAPI)
                                        </label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Key size={16} className="text-gray-600 group-focus-within:text-primary transition-colors" />
                                            </div>
                                            <input
                                                type="password"
                                                value={config.accessToken}
                                                onChange={(e) => setConfig({ ...config, accessToken: e.target.value })}
                                                placeholder="EAAB..."
                                                className="w-full pl-12 pr-4 py-3.5 bg-[#0d0d0d] border border-gray-800 rounded-xl focus:border-primary focus:ring-1 focus:ring-primary/20 text-white transition-all outline-none font-mono text-sm"
                                            />
                                        </div>
                                        <p className="mt-2 text-[10px] text-gray-600 px-1">
                                            Gerado no Gerenciador de Eventos da Meta &rarr; Configurações &rarr; API de Conversões.
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {success && (
                                            <span className="text-primary text-xs font-bold flex items-center gap-1 animate-in fade-in slide-in-from-left-2 transition-all">
                                                <CheckCircle2 size={14} /> Configurações salvas!
                                            </span>
                                        )}
                                        {error && (
                                            <span className="text-red-500 text-xs font-bold flex items-center gap-1">
                                                <AlertCircle size={14} /> {error}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${saving
                                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                            : 'bg-primary text-black hover:shadow-[0_0_20px_rgba(0,186,124,0.4)] hover:-translate-y-0.5 active:translate-y-0'
                                            }`}
                                    >
                                        {saving ? 'Salvando...' : (
                                            <>
                                                <Save size={18} strokeWidth={3} />
                                                Salvar Configurações
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Quick Help */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-[#111111] border border-gray-800 rounded-2xl p-5 group hover:border-primary transition-colors cursor-help">
                                <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                    <ExternalLink size={16} className="text-primary" />
                                    Testar Eventos
                                </h4>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Use o "Test Event Code" dentro de cada Node de Pixel para ver os disparos em tempo real na aba de "Testar Eventos" da Meta.
                                </p>
                            </div>
                            <div className="bg-[#111111] border border-gray-800 rounded-2xl p-5 group hover:border-primary transition-colors cursor-help">
                                <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                    <Shield size={16} className="text-primary" />
                                    Deduplicação
                                </h4>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Ao usar CAPI e Pixel de Browser simultaneamente, certifique-se de enviar o mesmo `event_id` para evitar contagem duplicada.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
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
