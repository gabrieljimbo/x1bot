import axios from 'axios'

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.n9n.archcode.space').replace(/\/$/, '')

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add request interceptor to include token
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('n9n_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Add response interceptor to handle 401 errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('n9n_token')
      localStorage.removeItem('n9n_user')
      localStorage.removeItem('n9n_tenant')
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export const apiClient = {
  setToken: (token: string | null) => {
    if (token) {
      client.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } else {
      delete client.defaults.headers.common['Authorization']
    }
  },

  // Auth
  login: async (email: string, password: string) => {
    const { data } = await client.post('/api/auth/login', { email, password })
    return data
  },

  register: async (email: string, password: string, name?: string, tenantName: string = '') => {
    const { data } = await client.post('/api/auth/register', {
      email,
      password,
      name,
      tenantName,
    })
    return data
  },

  // Workflows
  getWorkflows: async (tenantId?: string) => {
    const params = tenantId ? { tenantId } : {}
    const { data } = await client.get('/api/workflows', { params })
    return data
  },

  getWorkflow: async (workflowId: string, tenantId?: string) => {
    const params = tenantId ? { tenantId } : {}
    const { data } = await client.get(`/api/workflows/${workflowId}`, { params })
    return data
  },

  createWorkflow: async (name: string, description?: string, tenantId?: string) => {
    const params = tenantId ? { tenantId } : {}
    const { data } = await client.post('/api/workflows', { name, description }, { params })
    return data
  },

  updateWorkflow: async (workflowId: string, updates: any, tenantId?: string) => {
    const params = tenantId ? { tenantId } : {}
    const { data } = await client.put(`/api/workflows/${workflowId}`, updates, { params })
    return data
  },

  deleteWorkflow: async (workflowId: string, tenantId?: string) => {
    const params = tenantId ? { tenantId } : {}
    await client.delete(`/api/workflows/${workflowId}`, { params })
  },

  duplicateWorkflow: async (workflowId: string, tenantId?: string) => {
    const params = tenantId ? { tenantId } : {}
    const { data } = await client.post(`/api/workflows/${workflowId}/duplicate`, {}, { params })
    return data
  },

  shareWorkflow: async (workflowId: string) => {
    const { data } = await client.post(`/api/workflows/${workflowId}/share`)
    return data
  },

  getImportPreview: async (shareId: string) => {
    const { data } = await client.get(`/api/workflows/import/${shareId}`)
    return data
  },

  importWorkflow: async (shareId: string) => {
    const { data } = await client.post(`/api/workflows/import/${shareId}`)
    return data
  },

  getShareStats: async (workflowId: string, tenantId?: string) => {
    const params = tenantId ? { tenantId } : {}
    const { data } = await client.get(`/api/workflows/${workflowId}/share/stats`, { params })
    return data
  },

  // WhatsApp Sessions
  getWhatsappSessions: async (tenantId?: string) => {
    const params = tenantId ? { tenantId } : {}
    const { data } = await client.get('/api/whatsapp/sessions', { params })
    return data
  },

  getWhatsappSession: async (sessionId: string, tenantId?: string) => {
    const params = tenantId ? { tenantId } : {}
    const { data } = await client.get(`/api/whatsapp/sessions/${sessionId}`, { params })
    return data
  },

  createWhatsappSession: async (name: string, tenantId?: string) => {
    const params = tenantId ? { tenantId } : {}
    const { data } = await client.post('/api/whatsapp/sessions', { name }, { params })
    return data
  },

  deleteWhatsappSession: async (sessionId: string, tenantId?: string) => {
    const params = tenantId ? { tenantId } : {}
    await client.delete(`/api/whatsapp/sessions/${sessionId}`, { params })
  },

  reconnectWhatsappSession: async (sessionId: string) => {
    const { data } = await client.post(`/api/whatsapp/sessions/${sessionId}/reconnect`)
    return data
  },

  getSessionLabels: async (sessionId: string) => {
    const { data } = await client.get(`/api/whatsapp/sessions/${sessionId}/labels`)
    return data
  },

  sendWhatsappMessage: async (sessionId: string, contactId: string, message: string) => {
    const { data } = await client.post(`/api/whatsapp/sessions/${sessionId}/send`, {
      contactId,
      message,
    })
    return data
  },

  // Group Management
  getGroupConfigs: async (sessionId: string) => {
    const { data } = await client.get(`/api/whatsapp/sessions/${sessionId}/groups`)
    return data
  },

  syncGroups: async (sessionId: string) => {
    const { data } = await client.post(`/api/whatsapp/sessions/${sessionId}/groups/sync`)
    return data
  },

  updateGroupConfig: async (sessionId: string, configId: string, enabled: boolean, workflowIds: string[]) => {
    const { data } = await client.put(`/api/whatsapp/sessions/${sessionId}/groups/${configId}`, {
      enabled,
      workflowIds,
    })
    return data
  },

  // Executions
  getExecution: async (executionId: string) => {
    const { data } = await client.get(`/api/executions/${executionId}`)
    return data
  },

  getExecutionLogs: async (executionId: string) => {
    const { data } = await client.get(`/api/executions/${executionId}/logs`)
    return data
  },

  getWorkflowExecutions: async (workflowId: string) => {
    const { data } = await client.get(`/api/workflows/${workflowId}/executions`)
    return data
  },

  // Manual Trigger
  async triggerManualExecution(workflowId: string, nodeId: string) {
    const { data } = await client.post(`/api/workflows/${workflowId}/trigger-manual`, {
      nodeId,
    })
    return data
  },

  async testNode(workflowId: string, nodeId: string, executionId?: string) {
    const { data } = await client.post(`/api/workflows/${workflowId}/test-node`, {
      nodeId,
      executionId,
    })
    return data
  },

  // Tags
  getTags: async () => {
    const { data } = await client.get('/api/tags')
    return data
  },

  getTag: async (tagId: string) => {
    const { data } = await client.get(`/api/tags/${tagId}`)
    return data
  },

  createTag: async (name: string, color?: string, description?: string) => {
    const { data } = await client.post('/api/tags', { name, color, description })
    return data
  },

  updateTag: async (tagId: string, updates: { name?: string; color?: string; description?: string }) => {
    const { data } = await client.put(`/api/tags/${tagId}`, updates)
    return data
  },

  deleteTag: async (tagId: string) => {
    await client.delete(`/api/tags/${tagId}`)
  },

  // Admin - Tenants (SUPER_ADMIN only)
  getTenants: async () => {
    const { data } = await client.get('/api/admin/tenants')
    return data
  },

  getTenant: async (tenantId: string) => {
    const { data } = await client.get(`/api/admin/tenants/${tenantId}`)
    return data
  },

  getMyTenant: async () => {
    const { data } = await client.get('/api/tenant/me')
    return data
  },

  createTenant: async (name: string, email: string) => {
    const { data } = await client.post('/api/admin/tenants', { name, email })
    return data
  },

  updateTenant: async (tenantId: string, updates: { name?: string; email?: string; isActive?: boolean }) => {
    const { data } = await client.put(`/api/admin/tenants/${tenantId}`, updates)
    return data
  },

  deleteTenant: async (tenantId: string) => {
    await client.delete(`/api/admin/tenants/${tenantId}`)
  },

  // Admin - Users
  getUsers: async () => {
    const { data } = await client.get('/api/admin/users')
    return data
  },

  getUser: async (userId: string) => {
    const { data } = await client.get(`/api/admin/users/${userId}`)
    return data
  },

  createUser: async (email: string, password: string, name: string, tenantId: string, role?: string) => {
    const { data } = await client.post('/api/admin/users', {
      email,
      password,
      name,
      tenantId,
      role,
    })
    return data
  },

  updateUser: async (userId: string, updates: { email?: string; password?: string; name?: string; isActive?: boolean; role?: string }) => {
    const { data } = await client.put(`/api/admin/users/${userId}`, updates)
    return data
  },

  deleteUser: async (userId: string) => {
    await client.delete(`/api/admin/users/${userId}`)
  },

  // WhatsApp Global Config
  getWhatsappConfig: async () => {
    const { data } = await client.get('/api/whatsapp/config')
    return data
  },

  updateWhatsappConfig: async (config: any) => {
    const { data } = await client.post('/api/whatsapp/config', config)
    return data
  },

  // Licensing
  getLicenses: async () => {
    const { data } = await client.get('/api/admin/users/licenses')
    return data
  },

  updateLicense: async (userId: string, updates: { role: string; licenseStatus: string; licenseExpiresAt?: string }) => {
    const { data } = await client.put(`/api/admin/users/${userId}/license`, updates)
    return data
  },

  // Inbox / CRM
  getConversations: async (params?: {
    sessionId?: string
    status?: string
    label?: string
    type?: string
    page?: number
    limit?: number
    search?: string
  }) => {
    const { data } = await client.get('/api/inbox', { params })
    return data
  },

  getConversation: async (conversationId: string) => {
    const { data } = await client.get(`/api/inbox/${conversationId}`)
    return data
  },

  getInboxMessages: async (conversationId: string, cursor?: string, limit?: number) => {
    const { data } = await client.get(`/api/inbox/${conversationId}/messages`, {
      params: { cursor, limit },
    })
    return data
  },

  sendInboxMessage: async (
    conversationId: string,
    body: { text?: string; mediaUrl?: string; mediaType?: string }
  ) => {
    const { data } = await client.post(`/api/inbox/${conversationId}/send`, body)
    return data
  },

  triggerInboxFlow: async (conversationId: string, workflowId: string) => {
    const { data } = await client.post(`/api/inbox/${conversationId}/trigger-flow`, { workflowId })
    return data
  },

  updateConversationStatus: async (conversationId: string, status: string) => {
    const { data } = await client.patch(`/api/inbox/${conversationId}/status`, { status })
    return data
  },

  markConversationRead: async (conversationId: string) => {
    const { data } = await client.patch(`/api/inbox/${conversationId}/read`, {})
    return data
  },
}

