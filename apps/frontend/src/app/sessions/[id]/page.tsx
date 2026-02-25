'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import QRCode from 'react-qr-code'
import { useAuth } from '@/contexts/AuthContext'
import { AuthGuard } from '@/components/AuthGuard'
import { wsClient } from '@/lib/websocket'
import { EventType } from '@n9n/shared'

function SessionDetailPageContent({ params }: { params: { id: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { token, tenant } = useAuth()
  const sessionId = params.id

  // Get tenantId from URL query param (for SUPERADMIN viewing other workspaces) or from auth context
  const tenantIdFromUrl = searchParams?.get('tenantId')
  const tenantId = tenantIdFromUrl || tenant?.id

  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (sessionId && tenantId) {
      loadSession()

      // Connect to WebSocket if we have a token (usually available from AuthContext)
      if (token) {
        wsClient.connect(tenantId, token)
      }

      // Reload periodically as fallback
      const interval = setInterval(loadSession, 5000)

      // WebSocket listeners for real-time updates
      const handleQrCode = (event: any) => {
        if (event.sessionId === sessionId) {
          console.log('Real-time QR code received via WebSocket')
          setSession((prev: any) => prev ? { ...prev, qrCode: event.qrCode, status: 'QR_CODE' } : null)
        }
      }

      const handleConnected = (event: any) => {
        if (event.sessionId === sessionId) {
          console.log('Real-time connection event received via WebSocket')
          setSession((prev: any) => prev ? { ...prev, status: 'CONNECTED', phoneNumber: event.phoneNumber } : null)
        }
      }

      const handleDisconnected = (event: any) => {
        if (event.sessionId === sessionId) {
          console.log('Real-time disconnect event received via WebSocket')
          setSession((prev: any) => prev ? { ...prev, status: 'DISCONNECTED' } : null)
        }
      }

      wsClient.on(EventType.WHATSAPP_QR_CODE, handleQrCode)
      wsClient.on(EventType.WHATSAPP_SESSION_CONNECTED, handleConnected)
      wsClient.on(EventType.WHATSAPP_SESSION_DISCONNECTED, handleDisconnected)

      return () => {
        clearInterval(interval)
        wsClient.off(EventType.WHATSAPP_QR_CODE, handleQrCode)
        wsClient.off(EventType.WHATSAPP_SESSION_CONNECTED, handleConnected)
        wsClient.off(EventType.WHATSAPP_SESSION_DISCONNECTED, handleDisconnected)
      }
    }
  }, [sessionId, tenantId, token])

  const loadSession = async () => {
    try {
      // Pass tenantId if available (for SUPERADMIN viewing other workspaces)
      const data = await apiClient.getWhatsappSession(sessionId, tenantId || undefined)
      setSession(data)
    } catch (error) {
      console.error('Error loading session:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this session?')) {
      return
    }

    try {
      await apiClient.deleteWhatsappSession(sessionId, tenantId)
      router.push('/sessions')
    } catch (error) {
      console.error('Error deleting session:', error)
      alert('Failed to delete session')
    }
  }

  const handleReconnect = async () => {
    try {
      await apiClient.reconnectWhatsappSession(sessionId)
      await loadSession()
    } catch (error) {
      console.error('Error reconnecting session:', error)
      alert('Failed to reconnect session')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONNECTED':
        return 'bg-primary text-black'
      case 'QR_CODE':
        return 'bg-yellow-500 text-black'
      case 'CONNECTING':
        return 'bg-blue-500 text-white'
      case 'DISCONNECTED':
        return 'bg-gray-700 text-gray-300'
      case 'ERROR':
        return 'bg-red-500 text-white'
      default:
        return 'bg-gray-700 text-gray-300'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (!session) {
    const backUrl = tenantIdFromUrl ? `/workspaces/${tenantIdFromUrl}?tab=sessions` : '/sessions'
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-400">Session not found</h1>
          <p className="text-gray-400 mb-4">The session you are looking for does not exist or you do not have permission to access it.</p>
          <button
            onClick={() => router.push(backUrl)}
            className="px-6 py-3 bg-primary text-black rounded hover:bg-primary/80 transition"
          >
            Back to Sessions
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => {
            const backUrl = tenantIdFromUrl ? `/workspaces/${tenantIdFromUrl}?tab=sessions` : '/sessions'
            router.push(backUrl)
          }}
          className="px-4 py-2 bg-surface border border-border rounded hover:border-primary transition mb-6"
        >
          ← Back to Sessions
        </button>

        <div className="bg-surface border border-border rounded-lg p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">{session.name}</h1>
              <span className={`px-3 py-1 rounded text-sm font-semibold ${getStatusColor(session.status)}`}>
                {session.status}
              </span>
            </div>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-400 transition"
            >
              Delete Session
            </button>
          </div>

          <div className="space-y-4 mb-8">
            {session.phoneNumber && (
              <div>
                <p className="text-sm text-gray-400">Phone Number</p>
                <p className="text-lg">📱 {session.phoneNumber}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-gray-400">Session ID</p>
              <p className="text-sm font-mono bg-background p-2 rounded">{session.id}</p>
            </div>

            <div>
              <p className="text-sm text-gray-400">Created</p>
              <p>{new Date(session.createdAt).toLocaleString()}</p>
            </div>

            <div>
              <p className="text-sm text-gray-400">Last Updated</p>
              <p>{new Date(session.updatedAt).toLocaleString()}</p>
            </div>
          </div>

          {session.status === 'QR_CODE' && session.qrCode && (
            <div className="bg-background border border-border rounded-lg p-8">
              <h2 className="text-2xl font-semibold mb-4 text-center">Scan QR Code</h2>
              <div className="flex justify-center mb-4">
                <div className="bg-white p-4 rounded-lg">
                  <QRCode value={session.qrCode} size={256} />
                </div>
              </div>
              <div className="text-center text-gray-400">
                <p className="mb-2">Open WhatsApp on your phone</p>
                <p className="mb-2">Go to Settings → Linked Devices</p>
                <p>Scan this QR code to connect</p>
              </div>
            </div>
          )}

          {session.status === 'CONNECTED' && (
            <div className="bg-primary/10 border border-primary rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-2">✅ Connected!</h2>
              <p className="text-gray-400">
                This session is active and ready to send/receive messages.
              </p>
            </div>
          )}

          {session.status === 'DISCONNECTED' && (
            <div className="bg-yellow-500/10 border border-yellow-500 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-2 text-yellow-500">⚠️ Disconnected</h2>
              <p className="text-gray-400 mb-4">
                This session is not active. You can try to reconnect or delete it and create a new one.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleReconnect}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-400 transition"
                >
                  Reconnect
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-400 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          {session.status === 'CONNECTING' && (
            <div className="bg-blue-500/10 border border-blue-500 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-2 text-blue-500">🔄 Connecting...</h2>
              <p className="text-gray-400">
                Initializing WhatsApp connection. Please wait...
              </p>
            </div>
          )}

          {session.status === 'ERROR' && (
            <div className="bg-red-500/10 border border-red-500 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-2 text-red-500">❌ Error</h2>
              <p className="text-gray-400 mb-4">
                There was an error with this session. Please delete it and try again.
              </p>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-400 transition"
              >
                Delete Session
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SessionDetailPage({ params }: { params: { id: string } }) {
  return (
    <AuthGuard>
      <SessionDetailPageContent params={params} />
    </AuthGuard>
  )
}
