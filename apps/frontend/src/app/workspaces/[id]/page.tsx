'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, Users, Workflow, MessageSquare, UserCog, Edit2, Trash2, Plus, Power } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { SuperAdminGuardWrapper } from '@/components/SuperAdminGuard'
import { useAuth } from '@/contexts/AuthContext'
import { AuthGuard } from '@/components/AuthGuard'
import { isSuperAdmin } from '@/lib/permissions'
import AppHeader from '@/components/AppHeader'

interface Workspace {
  id: string
  name: string
  email: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: {
    users: number
    workflows: number
    whatsappSessions: number
    executions: number
  }
}

interface WorkspaceUser {
  id: string
  email: string
  name?: string
  role: string
  isActive: boolean
}

interface WorkspaceWorkflow {
  id: string
  name: string
  description?: string
  isActive: boolean
  createdAt: string
}

interface WorkspaceSession {
  id: string
  name: string
  status: string
  phoneNumber?: string
  createdAt: string
}

function WorkspaceDetailsPageContent() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const workspaceId = params.id as string
  const { user: currentUser } = useAuth()

  // Get initial tab from URL query param
  const tabFromUrl = searchParams?.get('tab') as 'overview' | 'users' | 'workflows' | 'sessions' | null
  const initialTab = tabFromUrl && ['overview', 'users', 'workflows', 'sessions'].includes(tabFromUrl) 
    ? tabFromUrl 
    : 'overview'

  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [users, setUsers] = useState<WorkspaceUser[]>([])
  const [workflows, setWorkflows] = useState<WorkspaceWorkflow[]>([])
  const [sessions, setSessions] = useState<WorkspaceSession[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'workflows' | 'sessions'>(initialTab)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingSession, setDeletingSession] = useState<WorkspaceSession | null>(null)
  const [newSessionName, setNewSessionName] = useState('')
  const [creatingSession, setCreatingSession] = useState(false)
  const [showDeleteWorkflowModal, setShowDeleteWorkflowModal] = useState(false)
  const [deletingWorkflow, setDeletingWorkflow] = useState<WorkspaceWorkflow | null>(null)
  const [showCreateWorkflowModal, setShowCreateWorkflowModal] = useState(false)
  const [newWorkflowName, setNewWorkflowName] = useState('')
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('')
  const [creatingWorkflow, setCreatingWorkflow] = useState(false)

  useEffect(() => {
    if (workspaceId) {
      loadWorkspaceDetails()
    }
  }, [workspaceId])

  useEffect(() => {
    if (workspaceId) {
      if (activeTab === 'workflows' || activeTab === 'sessions') {
        loadTabData()
      }
    }
  }, [workspaceId, activeTab])

  // Update activeTab when URL query param changes
  useEffect(() => {
    const tabFromUrl = searchParams?.get('tab') as 'overview' | 'users' | 'workflows' | 'sessions' | null
    if (tabFromUrl && ['overview', 'users', 'workflows', 'sessions'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl)
    }
  }, [searchParams])

  const loadWorkspaceDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load workspace details
      const workspaceData = await apiClient.getTenant(workspaceId)
      setWorkspace(workspaceData)

      // Load users
      const allUsers = await apiClient.getUsers()
      const workspaceUsers = allUsers.filter((u: any) => u.tenant?.id === workspaceId)
      setUsers(workspaceUsers)
      
    } catch (error: any) {
      console.error('Error loading workspace details:', error)
      setError(error.response?.data?.message || 'Failed to load workspace details')
    } finally {
      setLoading(false)
    }
  }

  const loadTabData = async () => {
    try {
      // Load workflows if on workflows tab
      if (activeTab === 'workflows') {
        const workflowsData = await apiClient.getWorkflows(workspaceId)
        setWorkflows(workflowsData)
      }

      // Load sessions if on sessions tab
      if (activeTab === 'sessions') {
        const sessionsData = await apiClient.getWhatsappSessions(workspaceId)
        setSessions(sessionsData)
      }
    } catch (err: any) {
      console.error('Error loading tab data:', err)
      setError(err.response?.data?.message || 'Failed to load data')
    }
  }

  const handleCreateSession = async () => {
    if (!newSessionName.trim()) {
      setError('Session name is required')
      return
    }

    try {
      setCreatingSession(true)
      setError(null)
      // Pass workspaceId as tenantId to create session in the correct workspace
      await apiClient.createWhatsappSession(newSessionName, workspaceId)
      setSuccess('Session created successfully')
      setShowCreateModal(false)
      setNewSessionName('')
      await loadTabData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create session')
    } finally {
      setCreatingSession(false)
    }
  }

  const handleDeleteSession = async () => {
    if (!deletingSession) return

    try {
      setError(null)
      await apiClient.deleteWhatsappSession(deletingSession.id)
      setSuccess('Session deleted successfully')
      setShowDeleteModal(false)
      setDeletingSession(null)
      await loadTabData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete session')
    }
  }

  const handleToggleWorkflow = async (workflow: WorkspaceWorkflow) => {
    try {
      setError(null)
      // Pass tenantId as query param for SUPERADMIN
      const updates = { isActive: !workflow.isActive }
      await apiClient.updateWorkflow(workflow.id, updates, workspaceId)
      setSuccess(`Workflow ${!workflow.isActive ? 'activated' : 'deactivated'} successfully`)
      await loadTabData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update workflow')
    }
  }

  const handleDeleteWorkflow = async () => {
    if (!deletingWorkflow) return

    try {
      setError(null)
      // Pass tenantId as query param for SUPERADMIN
      await apiClient.deleteWorkflow(deletingWorkflow.id, workspaceId)
      setSuccess('Workflow deleted successfully')
      setShowDeleteWorkflowModal(false)
      setDeletingWorkflow(null)
      await loadTabData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete workflow')
    }
  }

  const handleCreateWorkflow = async () => {
    if (!newWorkflowName.trim()) {
      setError('Workflow name is required')
      return
    }

    try {
      setCreatingWorkflow(true)
      setError(null)
      // Pass tenantId as query param for SUPERADMIN
      const workflow = await apiClient.createWorkflow(newWorkflowName, newWorkflowDescription || undefined, workspaceId)
      setSuccess('Workflow created successfully')
      setShowCreateWorkflowModal(false)
      setNewWorkflowName('')
      setNewWorkflowDescription('')
      await loadTabData()
      setTimeout(() => {
        setSuccess(null)
        // Redirect to the new workflow
        router.push(`/workflows/${workflow.id}?tenantId=${workspaceId}`)
      }, 1000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create workflow')
    } finally {
      setCreatingWorkflow(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONNECTED':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'QR_CODE':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'DISCONNECTED':
        return 'bg-gray-700/50 text-gray-400 border-gray-700'
      default:
        return 'bg-gray-700/50 text-gray-400 border-gray-700'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-gray-400">Loading workspace details...</div>
      </div>
    )
  }

  if (!workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-400">Workspace not found</h1>
          <button
            onClick={() => router.push('/workspaces')}
            className="px-4 py-2 bg-primary text-black rounded hover:bg-primary/80 transition"
          >
            Back to Workspaces
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <AppHeader />
      <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/workspaces')}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded hover:border-primary transition mb-4"
          >
            <ArrowLeft size={16} />
            Back to Workspaces
          </button>
          
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Building2 size={24} className="text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">{workspace.name}</h1>
                  <p className="text-gray-400">{workspace.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4">
                <span
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    workspace.isActive
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-gray-700/50 text-gray-400 border border-gray-700'
                  }`}
                >
                  {workspace.isActive ? 'Active' : 'Inactive'}
                </span>
                <span className="text-sm text-gray-400">
                  Created: {formatDate(workspace.createdAt)}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/workspaces/${workspaceId}/users`}
                className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded hover:border-primary transition"
              >
                <UserCog size={16} />
                Manage Users
              </Link>
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-4 p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-400">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#151515] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users size={20} className="text-blue-400" />
              <h3 className="text-sm font-medium text-gray-400">Users</h3>
            </div>
            <p className="text-2xl font-bold">{workspace._count?.users || 0}</p>
          </div>
          <div className="bg-[#151515] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <Workflow size={20} className="text-purple-400" />
              <h3 className="text-sm font-medium text-gray-400">Workflows</h3>
            </div>
            <p className="text-2xl font-bold">{workspace._count?.workflows || 0}</p>
          </div>
          <div className="bg-[#151515] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <MessageSquare size={20} className="text-green-400" />
              <h3 className="text-sm font-medium text-gray-400">Sessions</h3>
            </div>
            <p className="text-2xl font-bold">{workspace._count?.whatsappSessions || 0}</p>
          </div>
          <div className="bg-[#151515] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <Workflow size={20} className="text-yellow-400" />
              <h3 className="text-sm font-medium text-gray-400">Executions</h3>
            </div>
            <p className="text-2xl font-bold">{workspace._count?.executions || 0}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-800 mb-6">
          <div className="flex gap-4">
            <button
              onClick={() => {
                setActiveTab('overview')
                const url = new URL(window.location.href)
                url.searchParams.delete('tab')
                window.history.pushState({}, '', url.toString())
              }}
              className={`px-4 py-2 border-b-2 transition ${
                activeTab === 'overview'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => {
                setActiveTab('users')
                const url = new URL(window.location.href)
                url.searchParams.set('tab', 'users')
                window.history.pushState({}, '', url.toString())
              }}
              className={`px-4 py-2 border-b-2 transition ${
                activeTab === 'users'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Users ({users.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('workflows')
                const url = new URL(window.location.href)
                url.searchParams.set('tab', 'workflows')
                window.history.pushState({}, '', url.toString())
              }}
              className={`px-4 py-2 border-b-2 transition ${
                activeTab === 'workflows'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Workflows ({workspace._count?.workflows || 0})
            </button>
            <button
              onClick={() => {
                setActiveTab('sessions')
                const url = new URL(window.location.href)
                url.searchParams.set('tab', 'sessions')
                window.history.pushState({}, '', url.toString())
              }}
              className={`px-4 py-2 border-b-2 transition ${
                activeTab === 'sessions'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Sessions ({workspace._count?.whatsappSessions || 0})
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-[#151515] border border-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Workspace Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Name</label>
                  <p className="text-white font-medium">{workspace.name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Email</label>
                  <p className="text-white font-medium">{workspace.email}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Status</label>
                  <p className="text-white font-medium">
                    {workspace.isActive ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Created At</label>
                  <p className="text-white font-medium">{formatDate(workspace.createdAt)}</p>
                </div>
              </div>
            </div>

            <div className="bg-[#151515] border border-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/workspaces/${workspaceId}/users`}
                  className="px-4 py-2 bg-primary/20 border border-primary/30 rounded hover:bg-primary/30 transition flex items-center gap-2"
                >
                  <UserCog size={16} />
                  Manage Users
                </Link>
                <button
                  onClick={() => router.push('/workspaces')}
                  className="px-4 py-2 bg-surface border border-border rounded hover:border-primary transition flex items-center gap-2"
                >
                  <Edit2 size={16} />
                  Edit Workspace
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-[#151515] border border-gray-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold">Users</h2>
              <Link
                href={`/workspaces/${workspaceId}/users`}
                className="text-primary hover:text-primary/80 transition text-sm"
              >
                View All →
              </Link>
            </div>
            {users.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Users size={48} className="mx-auto mb-4 opacity-20" />
                <p>No users in this workspace</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {users.slice(0, 10).map((user) => (
                  <div key={user.id} className="p-4 hover:bg-[#1a1a1a] transition">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{user.name || 'No name'}</p>
                        <p className="text-sm text-gray-400">{user.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            user.role === 'SUPERADMIN'
                              ? 'bg-purple-500/20 text-purple-400'
                              : 'bg-blue-500/20 text-blue-400'
                          }`}
                        >
                          {user.role}
                        </span>
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            user.isActive
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-gray-700/50 text-gray-400'
                          }`}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {users.length > 10 && (
                  <div className="p-4 text-center">
                    <Link
                      href={`/workspaces/${workspaceId}/users`}
                      className="text-primary hover:text-primary/80 transition text-sm"
                    >
                      View all {users.length} users →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'workflows' && (
          <div className="bg-[#151515] border border-gray-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold">Workflows</h2>
              <button
                onClick={() => {
                  setShowCreateWorkflowModal(true)
                  setError(null)
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg hover:bg-primary/80 transition font-semibold"
              >
                <Plus size={16} />
                New Workflow
              </button>
            </div>
            {workflows.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Workflow size={48} className="mx-auto mb-4 opacity-20" />
                <p>No workflows in this workspace</p>
                <button
                  onClick={() => setShowCreateWorkflowModal(true)}
                  className="mt-4 px-4 py-2 bg-primary text-black rounded hover:bg-primary/80 transition"
                >
                  Create First Workflow
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {workflows.map((workflow) => (
                  <div
                    key={workflow.id}
                    className="p-4 hover:bg-[#1a1a1a] transition"
                  >
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/workflows/${workflow.id}?tenantId=${workspaceId}`}
                        className="flex-1"
                      >
                        <div>
                          <p className="font-semibold">{workflow.name}</p>
                          {workflow.description && (
                            <p className="text-sm text-gray-400 mt-1">{workflow.description}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Created: {formatDate(workflow.createdAt)}
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-3 py-1 rounded text-xs font-medium ${
                            workflow.isActive
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : 'bg-gray-700/50 text-gray-400 border border-gray-700'
                          }`}
                        >
                          {workflow.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleWorkflow(workflow)
                          }}
                          className={`p-2 rounded transition ${
                            workflow.isActive
                              ? 'hover:bg-yellow-500/20 text-yellow-400'
                              : 'hover:bg-green-500/20 text-green-400'
                          }`}
                          title={workflow.isActive ? 'Deactivate workflow' : 'Activate workflow'}
                        >
                          <Power size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeletingWorkflow(workflow)
                            setShowDeleteWorkflowModal(true)
                            setError(null)
                          }}
                          className="p-2 hover:bg-red-500/20 rounded transition"
                          title="Delete workflow"
                        >
                          <Trash2 size={16} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="bg-[#151515] border border-gray-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-bold">WhatsApp Sessions</h2>
              <button
                onClick={() => {
                  setShowCreateModal(true)
                  setError(null)
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg hover:bg-primary/80 transition font-semibold"
              >
                <Plus size={16} />
                New Session
              </button>
            </div>
            {sessions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
                <p>No WhatsApp sessions in this workspace</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 px-4 py-2 bg-primary text-black rounded hover:bg-primary/80 transition"
                >
                  Create First Session
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-4 hover:bg-[#1a1a1a] transition"
                  >
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/sessions/${session.id}?tenantId=${workspaceId}`}
                        className="flex-1"
                      >
                        <div>
                          <p className="font-semibold">{session.name}</p>
                          {session.phoneNumber && (
                            <p className="text-sm text-gray-400 mt-1">📱 {session.phoneNumber}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Created: {formatDate(session.createdAt)}
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-3 py-1 rounded text-xs font-medium border ${getStatusColor(session.status)}`}
                        >
                          {session.status}
                        </span>
                        <button
                          onClick={() => {
                            setDeletingSession(session)
                            setShowDeleteModal(true)
                            setError(null)
                          }}
                          className="p-2 hover:bg-red-500/20 rounded transition"
                          title="Delete session"
                        >
                          <Trash2 size={16} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create Session Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">New WhatsApp Session</h2>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Session Name *</label>
                  <input
                    type="text"
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    placeholder="e.g., Main WhatsApp"
                    className="w-full px-4 py-2 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewSessionName('')
                    setError(null)
                  }}
                  className="flex-1 px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSession}
                  disabled={!newSessionName.trim() || creatingSession}
                  className="flex-1 px-4 py-2 bg-primary text-black rounded hover:bg-primary/80 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingSession ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && deletingSession && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4 text-red-400">Delete Session</h2>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">
                  {error}
                </div>
              )}

              <p className="text-gray-300 mb-4">
                Are you sure you want to delete the session <strong>{deletingSession.name}</strong>?
              </p>
              <p className="text-sm text-gray-500 mb-6">
                This action cannot be undone. The session will be permanently removed.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setDeletingSession(null)
                    setError(null)
                  }}
                  className="flex-1 px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSession}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-400 transition font-semibold"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Workflow Confirmation Modal */}
        {showDeleteWorkflowModal && deletingWorkflow && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4 text-red-400">Delete Workflow</h2>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">
                  {error}
                </div>
              )}

              <p className="text-gray-300 mb-4">
                Are you sure you want to delete the workflow <strong>{deletingWorkflow.name}</strong>?
              </p>
              <p className="text-sm text-gray-500 mb-6">
                This action cannot be undone. All workflow data and execution history will be permanently deleted.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteWorkflowModal(false)
                    setDeletingWorkflow(null)
                    setError(null)
                  }}
                  className="flex-1 px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteWorkflow}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-400 transition font-semibold"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Workflow Modal */}
        {showCreateWorkflowModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">New Workflow</h2>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Workflow Name *</label>
                  <input
                    type="text"
                    value={newWorkflowName}
                    onChange={(e) => setNewWorkflowName(e.target.value)}
                    placeholder="e.g., Welcome Flow"
                    className="w-full px-4 py-2 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Description (optional)</label>
                  <textarea
                    value={newWorkflowDescription}
                    onChange={(e) => setNewWorkflowDescription(e.target.value)}
                    placeholder="Describe what this workflow does..."
                    rows={3}
                    className="w-full px-4 py-2 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-white resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateWorkflowModal(false)
                    setNewWorkflowName('')
                    setNewWorkflowDescription('')
                    setError(null)
                  }}
                  className="flex-1 px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateWorkflow}
                  disabled={!newWorkflowName.trim() || creatingWorkflow}
                  className="flex-1 px-4 py-2 bg-primary text-black rounded hover:bg-primary/80 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingWorkflow ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

function WorkspaceAccessGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const params = useParams()
  const { user, tenant, isLoading } = useAuth()
  const workspaceId = params.id as string

  useEffect(() => {
    if (!isLoading && user) {
      // SUPERADMIN can access any workspace
      if (isSuperAdmin(user.role)) {
        return
      }
      
      // ADMIN can only access their own workspace
      if (user.role === 'ADMIN' && tenant?.id === workspaceId) {
        return
      }
      
      // Otherwise, redirect to home
      router.push('/')
    }
  }, [user, tenant, workspaceId, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // SUPERADMIN can access any workspace
  if (isSuperAdmin(user.role)) {
    return <>{children}</>
  }

  // ADMIN can only access their own workspace
  if (user.role === 'ADMIN' && tenant?.id === workspaceId) {
    return <>{children}</>
  }

  // Access denied
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4 text-red-400">Access Denied</h1>
        <p className="text-gray-400 mb-4">You don't have permission to access this workspace.</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-primary text-black rounded hover:bg-primary/80 transition"
        >
          Go Home
        </button>
      </div>
    </div>
  )
}

export default function WorkspaceDetailsPage() {
  return (
    <AuthGuard>
      <WorkspaceAccessGuard>
        <WorkspaceDetailsPageContent />
      </WorkspaceAccessGuard>
    </AuthGuard>
  )
}

