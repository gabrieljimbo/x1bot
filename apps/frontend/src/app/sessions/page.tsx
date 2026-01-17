'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import { AuthGuard } from '@/components/AuthGuard'
import AppHeader from '@/components/AppHeader'

function SessionsPageContent() {
  const router = useRouter()
  const { token } = useAuth()
  
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSessions()
    // Reload every 5 seconds
    const interval = setInterval(loadSessions, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadSessions = async () => {
    try {
      const data = await apiClient.getWhatsappSessions()
      setSessions(data)
    } catch (error) {
      console.error('Error loading sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session?')) {
      return
    }

    try {
      await apiClient.deleteWhatsappSession(sessionId)
      await loadSessions()
    } catch (error) {
      console.error('Error deleting session:', error)
      alert('Failed to delete session')
    }
  }

  const handleReconnect = async (sessionId: string) => {
    try {
      await apiClient.reconnectWhatsappSession(sessionId)
      await loadSessions()
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

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <AppHeader />
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-surface border border-border rounded hover:border-primary transition mb-4"
            >
              ← Back
            </button>
            <h1 className="text-4xl font-bold mb-2">WhatsApp Sessions</h1>
            <p className="text-gray-400">Manage your WhatsApp connections</p>
          </div>
          <button
            onClick={() => router.push('/sessions/new')}
            className="px-6 py-3 bg-primary text-black rounded font-semibold hover:bg-primary/80 transition"
          >
            + New Session
          </button>
        </div>

        <div className="space-y-4">
          {sessions.length === 0 ? (
            <div className="bg-surface border border-border rounded-lg p-8 text-center">
              <p className="text-gray-400 mb-4">No sessions yet</p>
              <button
                onClick={() => router.push('/sessions/new')}
                className="px-6 py-3 bg-primary text-black rounded font-semibold hover:bg-primary/80 transition"
              >
                Create First Session
              </button>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className="bg-surface border border-border rounded-lg p-6"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{session.name}</h3>
                      <span className={`px-3 py-1 rounded text-sm font-semibold ${getStatusColor(session.status)}`}>
                        {session.status}
                      </span>
                    </div>
                    
                    {session.phoneNumber && (
                      <p className="text-gray-400 mb-1">
                        📱 {session.phoneNumber}
                      </p>
                    )}
                    
                    <p className="text-sm text-gray-500">
                      ID: {session.id}
                    </p>
                    
                    <p className="text-sm text-gray-500">
                      Created: {new Date(session.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {session.status === 'QR_CODE' && (
                      <button
                        onClick={() => router.push(`/sessions/${session.id}`)}
                        className="px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-400 transition"
                      >
                        Show QR Code
                      </button>
                    )}
                    
                    {session.status === 'DISCONNECTED' && (
                      <button
                        onClick={() => handleReconnect(session.id)}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-400 transition"
                      >
                        Reconnect
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleDelete(session.id)}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-400 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {session.status === 'DISCONNECTED' && (
                  <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500 rounded">
                    <p className="text-sm text-yellow-500">
                      ⚠️ This session is disconnected. You may need to reconnect it.
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="mt-8 p-6 bg-surface border border-border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">ℹ️ Session Status Guide</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs bg-primary text-black">CONNECTED</span>
              <span className="text-gray-400">Session is active and ready to send/receive messages</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs bg-yellow-500 text-black">QR_CODE</span>
              <span className="text-gray-400">Waiting for QR code scan</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs bg-blue-500 text-white">CONNECTING</span>
              <span className="text-gray-400">Initializing connection</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs bg-gray-700 text-gray-300">DISCONNECTED</span>
              <span className="text-gray-400">Session is not active</span>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

export default function SessionsPage() {
  return (
    <AuthGuard>
      <SessionsPageContent />
    </AuthGuard>
  )
}
