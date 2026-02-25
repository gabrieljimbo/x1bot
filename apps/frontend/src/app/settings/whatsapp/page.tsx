'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2, ArrowLeft, ShieldCheck, Clock, MessageSquare, Zap } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { SuperAdminGuardWrapper } from '@/components/SuperAdminGuard'
import AppHeader from '@/components/AppHeader'

function WhatsappSettingsPageContent() {
    const router = useRouter()
    const [config, setConfig] = useState({
        minDelay: 3000,
        maxDelay: 8000,
        maxMsgsPerMinute: 20,
        proportionalDelayEnabled: true,
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    useEffect(() => {
        loadConfig()
    }, [])

    const loadConfig = async () => {
        try {
            setLoading(true)
            const data = await apiClient.getWhatsappConfig()
            if (data) {
                setConfig({
                    minDelay: data.minDelay,
                    maxDelay: data.maxDelay,
                    maxMsgsPerMinute: data.maxMsgsPerMinute,
                    proportionalDelayEnabled: data.proportionalDelayEnabled,
                })
            }
        } catch (err: any) {
            console.error('Error loading config:', err)
            setError('Failed to load configuration')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            setSaving(true)
            setError(null)
            await apiClient.updateWhatsappConfig(config)
            setSuccess('Settings updated successfully')
            setTimeout(() => setSuccess(null), 3000)
        } catch (err: any) {
            console.error('Error saving config:', err)
            setError('Failed to save configuration')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white">
                <AppHeader />
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="animate-spin text-primary" size={32} />
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
            <AppHeader />
            <div className="p-8">
                <div className="max-w-3xl mx-auto">
                    {/* Breadcrumb */}
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition mb-6"
                    >
                        <ArrowLeft size={16} />
                        Back
                    </button>

                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-3">
                                <ShieldCheck className="text-primary" size={32} />
                                Humanization Settings
                            </h1>
                            <p className="text-gray-400 mt-2">
                                Configure global message queue and anti-ban parameters.
                            </p>
                        </div>
                    </div>

                    {success && (
                        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                            <Zap size={18} />
                            {success}
                        </div>
                    )}

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 animate-in fade-in slide-in-from-top-4">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="bg-[#151515] border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
                            <div className="p-6 border-b border-gray-800 bg-[#1a1a1a]">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <Clock size={20} className="text-primary" />
                                    Message Delays
                                </h3>
                                <p className="text-gray-500 text-sm">Control the timing between outgoing messages.</p>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-300">Minimum Delay (ms)</label>
                                        <input
                                            type="number"
                                            value={config.minDelay}
                                            onChange={(e) => setConfig({ ...config, minDelay: parseInt(e.target.value) })}
                                            className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                                            min="1000"
                                            step="500"
                                        />
                                        <p className="text-xs text-gray-500">Fastest possible message skip.</p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-300">Maximum Delay (ms)</label>
                                        <input
                                            type="number"
                                            value={config.maxDelay}
                                            onChange={(e) => setConfig({ ...config, maxDelay: parseInt(e.target.value) })}
                                            className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                                            min="2000"
                                            step="500"
                                        />
                                        <p className="text-xs text-gray-500">Slowest possible message skip.</p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-[#0a0a0a] border border-gray-800 rounded-lg">
                                    <div className="space-y-1">
                                        <label className="font-medium text-gray-200 cursor-pointer" htmlFor="proportional">
                                            Proportional Delay
                                        </label>
                                        <p className="text-xs text-gray-500">Add extra delay based on message character length.</p>
                                    </div>
                                    <div
                                        className={`w-12 h-6 rounded-full cursor-pointer transition-colors relative ${config.proportionalDelayEnabled ? 'bg-primary' : 'bg-gray-700'}`}
                                        onClick={() => setConfig({ ...config, proportionalDelayEnabled: !config.proportionalDelayEnabled })}
                                    >
                                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${config.proportionalDelayEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#151515] border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
                            <div className="p-6 border-b border-gray-800 bg-[#1a1a1a]">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <MessageSquare size={20} className="text-primary" />
                                    Rate Limiting
                                </h3>
                                <p className="text-gray-500 text-sm">Prevention of abnormal burst activity.</p>
                            </div>

                            <div className="p-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Max Messages per Minute</label>
                                    <input
                                        type="number"
                                        value={config.maxMsgsPerMinute}
                                        onChange={(e) => setConfig({ ...config, maxMsgsPerMinute: parseInt(e.target.value) })}
                                        className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                                        min="1"
                                        max="60"
                                    />
                                    <p className="text-xs text-gray-500">Soft limit per connected session. Recommended: 20-30.</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center gap-2 px-8 py-3 bg-primary text-black font-bold rounded-lg hover:bg-primary/90 transition disabled:opacity-50 shadow-xl shadow-primary/10"
                            >
                                {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                {saving ? 'Saving...' : 'Save Configuration'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default function WhatsappSettingsPage() {
    return (
        <SuperAdminGuardWrapper>
            <WhatsappSettingsPageContent />
        </SuperAdminGuardWrapper>
    )
}
