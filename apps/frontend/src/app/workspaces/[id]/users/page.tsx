'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Plus, Trash2, Edit2, User, ArrowLeft } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { SuperAdminGuardWrapper } from '@/components/SuperAdminGuard'
import { isSuperAdmin, UserRole } from '@/lib/permissions'
import { useAuth } from '@/contexts/AuthContext'

interface WorkspaceUser {
  id: string
  email: string
  name?: string
  role: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  tenant: {
    id: string
    name: string
    email: string
  }
}

interface Workspace {
  id: string
  name: string
  email: string
}

function WorkspaceUsersPageContent() {
  const router = useRouter()
  const params = useParams()
  const workspaceId = params.id as string
  const { user: currentUser } = useAuth()

  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [users, setUsers] = useState<WorkspaceUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editingUser, setEditingUser] = useState<WorkspaceUser | null>(null)
  const [deletingUser, setDeletingUser] = useState<WorkspaceUser | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: UserRole.ADMIN as string,
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (workspaceId) {
      loadWorkspace()
      loadUsers()
    }
  }, [workspaceId])

  const loadWorkspace = async () => {
    try {
      const data = await apiClient.getTenant(workspaceId)
      setWorkspace(data)
    } catch (error: any) {
      console.error('Error loading workspace:', error)
      setError('Failed to load workspace')
    }
  }

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const allUsers = await apiClient.getUsers()
      // Filter users by workspace
      const workspaceUsers = allUsers.filter((u: WorkspaceUser) => u.tenant.id === workspaceId)
      setUsers(workspaceUsers)
    } catch (error: any) {
      console.error('Error loading users:', error)
      setError(error.response?.data?.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formData.email.trim() || !formData.password.trim()) {
      setError('Email and password are required')
      return
    }

    try {
      setError(null)
      await apiClient.createUser(
        formData.email,
        formData.password,
        formData.name || '',
        workspaceId,
        formData.role
      )
      setSuccess('User created successfully')
      await loadUsers()
      setShowModal(false)
      setFormData({ name: '', email: '', password: '', role: UserRole.ADMIN })
      setTimeout(() => setSuccess(null), 3000)
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to create user')
    }
  }

  const handleUpdate = async () => {
    if (!editingUser) return
    if (!formData.email.trim()) {
      setError('Email is required')
      return
    }

    try {
      setError(null)
      const updates: any = {
        email: formData.email,
        name: formData.name || undefined,
        role: formData.role,
      }
      if (formData.password.trim()) {
        updates.password = formData.password
      }
      await apiClient.updateUser(editingUser.id, updates)
      setSuccess('User updated successfully')
      await loadUsers()
      setShowModal(false)
      setEditingUser(null)
      setFormData({ name: '', email: '', password: '', role: UserRole.ADMIN })
      setTimeout(() => setSuccess(null), 3000)
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to update user')
    }
  }

  const handleDelete = async () => {
    if (!deletingUser) return

    try {
      setError(null)
      await apiClient.deleteUser(deletingUser.id)
      setSuccess('User deleted successfully')
      await loadUsers()
      setShowDeleteModal(false)
      setDeletingUser(null)
      setTimeout(() => setSuccess(null), 3000)
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to delete user')
    }
  }

  const openCreateModal = () => {
    setEditingUser(null)
    setFormData({ name: '', email: '', password: '', role: UserRole.ADMIN })
    setError(null)
    setShowModal(true)
  }

  const openEditModal = (user: WorkspaceUser) => {
    setEditingUser(user)
    setFormData({
      name: user.name || '',
      email: user.email,
      password: '',
      role: user.role,
    })
    setError(null)
    setShowModal(true)
  }

  const openDeleteModal = (user: WorkspaceUser) => {
    setDeletingUser(user)
    setError(null)
    setShowDeleteModal(true)
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

  const getRoleBadgeColor = (role: string) => {
    return role === UserRole.SUPER_ADMIN
      ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  }

  if (loading && !workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => router.push('/workspaces')}
              className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded hover:border-primary transition mb-4"
            >
              <ArrowLeft size={16} />
              Back to Workspaces
            </button>
            <h1 className="text-3xl font-bold mb-2">
              👥 Users - {workspace?.name || 'Loading...'}
            </h1>
            <p className="text-gray-400">
              Manage users for this workspace
            </p>
          </div>
          {isSuperAdmin(currentUser?.role) && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg hover:bg-primary/80 transition font-semibold"
            >
              <Plus size={20} />
              New User
            </button>
          )}
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

        {/* Users Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-gray-400">Loading users...</div>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <User size={64} className="mb-4 opacity-20" />
            <p className="text-lg mb-2">No users in this workspace</p>
            {isSuperAdmin(currentUser?.role) && (
              <p className="text-sm">Create your first user to get started</p>
            )}
          </div>
        ) : (
          <div className="bg-[#151515] border border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#1a1a1a] border-b border-gray-800">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">User</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Role</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Created</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-800 hover:bg-[#1a1a1a] transition"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <User size={20} className="text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold text-white">
                            {user.name || 'No name'}
                          </div>
                          <div className="text-xs text-gray-500">ID: {user.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-300">{user.email}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded text-xs font-medium border ${getRoleBadgeColor(user.role)}`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded text-xs font-medium ${user.isActive
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-gray-700/50 text-gray-400 border border-gray-700'
                          }`}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {isSuperAdmin(currentUser?.role) && (
                          <>
                            <button
                              onClick={() => openEditModal(user)}
                              className="p-2 hover:bg-gray-800 rounded transition"
                              title="Edit user"
                            >
                              <Edit2 size={16} className="text-gray-400" />
                            </button>
                            <button
                              onClick={() => openDeleteModal(user)}
                              className="p-2 hover:bg-red-500/20 rounded transition"
                              title="Delete user"
                            >
                              <Trash2 size={16} className="text-red-400" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">
                {editingUser ? 'Edit User' : 'New User'}
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Name (optional)</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Doe"
                    className="w-full px-4 py-2 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@example.com"
                    className="w-full px-4 py-2 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Password {editingUser ? '(leave empty to keep current)' : '*'}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? '••••••••' : '••••••••'}
                    className="w-full px-4 py-2 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-2 bg-[#0a0a0a] border border-gray-700 rounded focus:outline-none focus:border-primary text-white"
                  >
                    <option value={UserRole.ADMIN}>ADMIN</option>
                    <option value={UserRole.SUPER_ADMIN}>SUPER_ADMIN</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowModal(false)
                    setEditingUser(null)
                    setFormData({ name: '', email: '', password: '', role: 'ADMIN' })
                    setError(null)
                  }}
                  className="flex-1 px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={editingUser ? handleUpdate : handleCreate}
                  disabled={!formData.email.trim() || (!editingUser && !formData.password.trim())}
                  className="flex-1 px-4 py-2 bg-primary text-black rounded hover:bg-primary/80 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingUser ? 'Save' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && deletingUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4 text-red-400">Delete User</h2>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">
                  {error}
                </div>
              )}

              <p className="text-gray-300 mb-4">
                Are you sure you want to delete the user <strong>{deletingUser.email}</strong>?
              </p>
              <p className="text-sm text-gray-500 mb-6">
                This action cannot be undone. The user will be permanently removed from the system.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setDeletingUser(null)
                    setError(null)
                  }}
                  className="flex-1 px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-400 transition font-semibold"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function WorkspaceUsersPage() {
  return (
    <SuperAdminGuardWrapper>
      <WorkspaceUsersPageContent />
    </SuperAdminGuardWrapper>
  )
}

