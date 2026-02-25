'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { wsClient } from '@/lib/websocket'
import { EventType } from '@n9n/shared'
import { useAuth } from '@/contexts/AuthContext'
import { AuthGuard } from '@/components/AuthGuard'

function NewSessionPageContent() {
  const router = useRouter()
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

      // Poll for session status and QR code
      const pollSession = async () => {
        try {
          addDebug('Polling session status...')
          const session = await apiClient.getWhatsappSession(sessionId)
          addDebug(`Status: ${session.status}, Has QR: ${!!session.qrCode}`)

          setStatus(session.status)

          if (session.qrCode && session.status === 'QR_CODE') {
            addDebug('QR Code received!')
            setQrCode(session.qrCode)
          }

          if (session.status === 'CONNECTED') {
            addDebug('Connected! Redirecting...')
            setTimeout(() => {
              router.push('/')
            }, 2000)
          }
        } catch (error) {
          addDebug(`Error: ${error}`)
          console.error('Error polling session:', error)
        }
      }

      // Poll immediately and then every 2 seconds
      pollSession()
      const pollInterval = setInterval(pollSession, 2000)

      const handleQrCode = (event: any) => {
        if (event.sessionId === sessionId) {
          addDebug('WebSocket: New QR Code received')
          setQrCode(event.qrCode)
          setStatus('QR_CODE')
        }
      }

      const handleConnected = (event: any) => {
        if (event.sessionId === sessionId) {
          addDebug('WebSocket: Session CONNECTED')
          setStatus('CONNECTED')
          setTimeout(() => {
            router.push('/')
          }, 2000)
        }
      }

      const handleDisconnected = (event: any) => {
        if (event.sessionId === sessionId) {
          addDebug('WebSocket: Session DISCONNECTED')
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
  }, [sessionId, tenant?.id, token, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      const session = await apiClient.createWhatsappSession(name)
      setSessionId(session.id)
      setStatus('CONNECTING')
    } catch (err) {
      setError('Failed to create session')
      console.error(err)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-surface border border-border rounded hover:border-primary transition mb-4"
          >
            ← Back
          </button>
          <h1 className="text-4xl font-bold mb-2">Connect WhatsApp Session</h1>
          <p className="text-gray-400">Connect your WhatsApp account to send and receive messages</p>
        </div>

        {!sessionId ? (
          <div className="bg-surface border border-border rounded-lg p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Session Name *
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-border rounded focus:border-primary focus:outline-none"
                  placeholder="e.g., Main WhatsApp"
                  required
                />
                <p className="text-sm text-gray-400 mt-2">
                  Choose a name to identify this WhatsApp connection
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500 rounded text-red-500">
                  {error}
                </div>
              )}

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-primary text-black rounded font-semibold hover:bg-primary/80 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create Session'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="px-6 py-3 bg-surface border border-border rounded hover:border-primary transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status */}
            <div className="bg-surface border border-border rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{name}</h2>
                  <p className="text-gray-400">Session ID: {sessionId}</p>
                </div>
                <div
                  className={`px-4 py-2 rounded text-sm font-semibold ${status === 'CONNECTED'
                      ? 'bg-primary text-black'
                      : status === 'QR_CODE'
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-700 text-white'
                    }`}
                >
                  {status}
                </div>
              </div>
            </div>

            {/* QR Code */}
            {status === 'QR_CODE' && qrCode && (
              <div className="bg-surface border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">📱 Scan QR Code</h2>
                <div className="bg-white p-4 rounded-lg inline-block">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`}
                    alt="QR Code"
                    className="w-64 h-64"
                  />
                </div>
                <div className="mt-4 space-y-2 text-gray-400">
                  <p>1. Open WhatsApp on your phone</p>
                  <p>2. Tap Menu or Settings and select "Linked Devices"</p>
                  <p>3. Tap "Link a Device"</p>
                  <p>4. Point your phone at this screen to capture the QR code</p>
                </div>
              </div>
            )}

            {/* Connecting */}
            {(status === 'CONNECTING' || status === 'DISCONNECTED') && !qrCode && (
              <div className="bg-surface border border-border rounded-lg p-6">
                <div className="flex items-center gap-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <div>
                    <h2 className="text-xl font-semibold">Initializing...</h2>
                    <p className="text-gray-400">Starting WhatsApp client, this may take 10-20 seconds...</p>
                  </div>
                </div>
              </div>
            )}

            {/* Connected */}
            {status === 'CONNECTED' && (
              <div className="bg-surface border border-border rounded-lg p-6">
                <div className="text-center">
                  <div className="text-6xl mb-4">✅</div>
                  <h2 className="text-2xl font-semibold mb-2">Connected!</h2>
                  <p className="text-gray-400 mb-4">
                    Your WhatsApp session is now connected and ready to use
                  </p>
                  <p className="text-sm text-gray-500">Redirecting to dashboard...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {!sessionId && (
          <div className="mt-8 p-6 bg-surface border border-border rounded-lg">
            <h2 className="text-xl font-semibold mb-4">ℹ️ About WhatsApp Sessions</h2>
            <ul className="space-y-2 text-gray-400">
              <li>• Each session represents a WhatsApp connection</li>
              <li>• You can have multiple sessions for different numbers</li>
              <li>• Sessions stay connected even after closing the browser</li>
              <li>• You'll need to scan a QR code to authenticate</li>
            </ul>
          </div>
        )}

        {/* Debug Panel */}
        {sessionId && debug.length > 0 && (
          <div className="mt-8 p-6 bg-surface border border-yellow-500 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">🐛 Debug Log</h2>
            <div className="bg-black p-4 rounded font-mono text-xs max-h-60 overflow-y-auto">
              {debug.map((msg, i) => (
                <div key={i} className="text-green-400">{msg}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function NewSessionPage() {
  return (
    <AuthGuard>
      <NewSessionPageContent />
    </AuthGuard>
  )
}
