'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import { wsClient } from '@/lib/websocket'
import { EventType } from '@n9n/shared'
import { useAuth } from '@/contexts/AuthContext'
import { RefreshCw, CheckCircle2, QrCode, Smartphone } from 'lucide-react'

interface WhatsAppConnectProps {
    onSuccess?: (sessionId: string) => void
    onCancel?: () => void
}

export default function WhatsAppConnect({ onSuccess, onCancel }: WhatsAppConnectProps) {
    const { tenant, token } = useAuth()

    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [status, setStatus] = useState<string>('DISCONNECTED')
    const [debug, setDebug] = useState<string[]>([])

    useEffect(() => {
        if (sessionId && tenant?.id && token) {
            const addDebug = (msg: string) => {
                setDebug(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`])
                console.log(msg)
            }

            addDebug('Connecting to WebSocket...')
            wsClient.connect(tenant.id, token)

            const pollSession = async () => {
                try {
                    const session = await apiClient.getWhatsappSession(sessionId)
                    setStatus(session.status)

                    if (session.qrCode && session.status === 'QR_CODE') {
                        setQrCode(session.qrCode)
                    }

                    if (session.status === 'CONNECTED') {
                        if (onSuccess) onSuccess(sessionId)
                    }
                } catch (error) {
                    console.error('Error polling session:', error)
                }
            }

            pollSession()
            const pollInterval = setInterval(pollSession, 2000)

            const handleQrCode = (event: any) => {
                if (event.sessionId === sessionId) {
                    setQrCode(event.qrCode)
                    setStatus('QR_CODE')
                }
            }

            const handleConnected = (event: any) => {
                if (event.sessionId === sessionId) {
                    setStatus('CONNECTED')
                    if (onSuccess) onSuccess(sessionId)
                }
            }

            const handleDisconnected = (event: any) => {
                if (event.sessionId === sessionId) {
                    setStatus('DISCONNECTED')
                    setQrCode(null)
                }
            }

            wsClient.on(EventType.WHATSAPP_QR_CODE, handleQrCode)
            wsClient.on(EventType.WHATSAPP_SESSION_CONNECTED, handleConnected)
            wsClient.on(EventType.WHATSAPP_SESSION_DISCONNECTED, handleDisconnected)

            return () => {
                clearInterval(pollInterval)
                wsClient.off(EventType.WHATSAPP_QR_CODE, handleQrCode)
                wsClient.off(EventType.WHATSAPP_SESSION_CONNECTED, handleConnected)
                wsClient.off(EventType.WHATSAPP_SESSION_DISCONNECTED, handleDisconnected)
            }
        }
    }, [sessionId, tenant?.id, token, onSuccess])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!name.trim()) {
            setError('O nome é obrigatório')
            return
        }

        setLoading(true)
        setError('')

        try {
            const session = await apiClient.createWhatsappSession(name)
            setSessionId(session.id)
            setStatus('CONNECTING')
        } catch (err) {
            setError('Falha ao criar sessão')
            console.error(err)
            setLoading(false)
        }
    }

    return (
        <div className="w-full">
            {!sessionId ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium mb-2 text-gray-300">
                            Nome da Sessão *
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2 bg-black border border-gray-800 rounded-lg focus:border-primary focus:outline-none text-white"
                            placeholder="Ex: WhatsApp Principal"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            Escolha um nome para identificar esta conexão de WhatsApp.
                        </p>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-6 py-3 bg-primary text-black rounded-lg font-bold hover:bg-primary/80 transition disabled:opacity-50"
                        >
                            {loading ? 'Criando...' : 'Conectar WhatsApp'}
                        </button>
                        {onCancel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="px-6 py-3 bg-surface border border-gray-800 rounded-lg text-gray-400 hover:text-white transition"
                            >
                                Cancelar
                            </button>
                        )}
                    </div>
                </form>
            ) : (
                <div className="space-y-6">
                    {/* Status Header */}
                    <div className="bg-black/40 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-white">{name}</h3>
                            <p className="text-[10px] text-gray-500 font-mono">ID: {sessionId}</p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold ${status === 'CONNECTED' ? 'bg-primary/20 text-primary' :
                                status === 'QR_CODE' ? 'bg-yellow-500/20 text-yellow-500' :
                                    'bg-gray-800 text-gray-400'
                            }`}>
                            {status}
                        </div>
                    </div>

                    {/* QR Code Section */}
                    {status === 'QR_CODE' && qrCode ? (
                        <div className="text-center space-y-4">
                            <div className="bg-white p-4 rounded-xl inline-block shadow-2xl">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`}
                                    alt="QR Code"
                                    className="w-48 h-48"
                                />
                            </div>
                            <div className="text-left space-y-3 bg-black/20 p-4 rounded-xl border border-gray-800">
                                <h4 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                                    <Smartphone size={16} className="text-primary" />
                                    Como conectar:
                                </h4>
                                <ol className="text-xs text-gray-500 space-y-2 list-decimal list-inside">
                                    <li>Abra o WhatsApp no seu celular</li>
                                    <li>Toque em <span className="text-gray-300">Aparelhos Conectados</span></li>
                                    <li>Toque em <span className="text-gray-300">Conectar um Aparelho</span></li>
                                    <li>Aponte a câmera para este QR Code</li>
                                </ol>
                            </div>
                        </div>
                    ) : status === 'CONNECTED' ? (
                        <div className="py-8 text-center space-y-4">
                            <div className="w-16 h-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle2 size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Conectado com Sucesso!</h3>
                                <p className="text-sm text-gray-500">Sincronizando seus dados...</p>
                            </div>
                        </div>
                    ) : (
                        <div className="py-12 text-center space-y-4">
                            <RefreshCw size={32} className="text-primary animate-spin mx-auto" />
                            <div>
                                <h3 className="text-lg font-bold text-white">Iniciando Sessão...</h3>
                                <p className="text-sm text-gray-500">Isso pode levar alguns segundos.</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
