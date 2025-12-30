'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'

export default function Home() {
  const [workflows, setWorkflows] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const tenantId = 'demo-tenant' // In production, get from auth

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [workflowsData, sessionsData] = await Promise.all([
        apiClient.getWorkflows(tenantId),
        apiClient.getWhatsappSessions(tenantId),
      ])
      setWorkflows(workflowsData)
      setSessions(sessionsData)
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                N9N
              </h1>
              <p className="text-gray-400">Conversation Workflow Engine</p>
            </div>
            <Link
              href="/tags"
              className="px-4 py-2 bg-surface border border-border rounded hover:border-primary transition flex items-center gap-2"
            >
              🏷️ Gerenciar Tags
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Workflows */}
          <div className="bg-surface border border-border rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">Workflows</h2>
              <Link
                href="/workflows/new"
                className="px-4 py-2 bg-primary text-black rounded hover:bg-primary/80 transition"
              >
                Create
              </Link>
            </div>

            <div className="space-y-2">
              {workflows.length === 0 ? (
                <p className="text-gray-400">No workflows yet</p>
              ) : (
                workflows.map((workflow) => (
                  <Link
                    key={workflow.id}
                    href={`/workflows/${workflow.id}`}
                    className="block p-4 bg-background border border-border rounded hover:border-primary transition"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold">{workflow.name}</h3>
                        {workflow.description && (
                          <p className="text-sm text-gray-400">{workflow.description}</p>
                        )}
                      </div>
                      <div
                        className={`px-2 py-1 rounded text-xs ${
                          workflow.isActive
                            ? 'bg-primary text-black'
                            : 'bg-gray-700 text-gray-300'
                        }`}
                      >
                        {workflow.isActive ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* WhatsApp Sessions */}
          <div className="bg-surface border border-border rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">WhatsApp Sessions</h2>
              <div className="flex gap-2">
                <Link
                  href="/sessions"
                  className="px-4 py-2 bg-surface border border-border rounded hover:border-primary transition"
                >
                  Manage
                </Link>
                <Link
                  href="/sessions/new"
                  className="px-4 py-2 bg-primary text-black rounded hover:bg-primary/80 transition"
                >
                  Connect
                </Link>
              </div>
            </div>

            <div className="space-y-2">
              {sessions.length === 0 ? (
                <p className="text-gray-400">No sessions yet</p>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-4 bg-background border border-border rounded"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold">{session.name}</h3>
                        {session.phoneNumber && (
                          <p className="text-sm text-gray-400">{session.phoneNumber}</p>
                        )}
                      </div>
                      <div
                        className={`px-2 py-1 rounded text-xs ${
                          session.status === 'CONNECTED'
                            ? 'bg-primary text-black'
                            : session.status === 'QR_CODE'
                            ? 'bg-yellow-500 text-black'
                            : 'bg-gray-700 text-gray-300'
                        }`}
                      >
                        {session.status}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

