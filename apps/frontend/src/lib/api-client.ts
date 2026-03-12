import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// The backend is hosted behind Traefik which strips the first /api from proxy.
// With app.setGlobalPrefix('api'), the server expects to receive /api/something
// If we hit $API_URL/something (like /api/something), Traefik strips /api and backend gets /something => 404.
// Thus we must always hit $API_URL/api/something (like /api/api/something).
const baseURL = `${API_URL}/api`;

const client = axios.create({
  baseURL,
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

// Flag to prevent multiple simultaneous refresh requests
let isRefreshing = false
// Queue to hold requests that failed with 401 while a refresh is in progress
let failedQueue: any[] = []

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })

  failedQueue = []
}

// Add response interceptor to handle 401 errors and token refresh
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return client(originalRequest)
          })
          .catch((err) => {
            return Promise.reject(err)
          })
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('n9n_refresh_token')

      if (refreshToken) {
        try {
          // Use axios instance directly without the 401 interceptor logic for the refresh call
          const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {
            refreshToken,
          })

          const { accessToken, refreshToken: newRefreshToken } = data

          localStorage.setItem('n9n_token', accessToken)
          if (newRefreshToken) {
            localStorage.setItem('n9n_refresh_token', newRefreshToken)
          }

          client.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
          originalRequest.headers.Authorization = `Bearer ${accessToken}`

          processQueue(null, accessToken)
          isRefreshing = false

          return client(originalRequest)
        } catch (refreshError) {
          processQueue(refreshError, null)
          isRefreshing = false

          // If refresh fails, log out
          localStorage.removeItem('n9n_token')
          localStorage.removeItem('n9n_refresh_token')
          localStorage.removeItem('n9n_user')
          localStorage.removeItem('n9n_tenant')

          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.href = '/login'
          }
          return Promise.reject(refreshError)
        }
      } else {
        // No refresh token, log out
        localStorage.removeItem('n9n_token')
        localStorage.removeItem('n9n_user')
        localStorage.removeItem('n9n_tenant')
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
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
    const { data } = await client.post('/auth/login', { email, password })
    return data
  },

  register: async (email: string, password: string, name?: string, tenantName: string = '') => {
    const { data } = await client.post('/auth/register', {
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
    const { data } = await client.get('/workflows', { params })
    return data
  },

  getWorkflow: async (workflowId: string, tenantId?: string) => {
    const params = tenantId ? { tenantId } : {}
    const { data } = await client.get(`/workflows/${workflowId}`, { params })
    return data
  },

  createWorkflow: async (name: string, description?: string, tenantId?: string) => {
    const params = tenantId ? { tenantId } : {}
    const { data } = await client.post('/workflows', { name, description }, { params })
    return data
  },

  updateWorkflow: async (workflowId: string, updates: any, tenantId?: string) => {
    const params = tenantId ? { tenantId } : {}
    const { data } = await client.put(`/workflows/${workflowId}`, updates, { params })
    return data
  },

  deleteWorkflow: async (workflowId: string, tenantId?: string) => {
    const params = tenantId ? { tenantId } : {}
    await client.delete(`/workflows/${workflowId}`, { params })
  },

  duplicateWorkflow: async (workflowId: string, tenantId?: string) => {
    const params = tenantId ? { tenantId } : {}
    const { data } = await client.post(`/workflows/${workflowId}/duplicate`, {}, { params })
    return data
  },

  shareWorkflow: async (workflowId: string) => {
    const { data } = await client.post(`/workflows/${workflowId}/share`)
    return data
  },

  getImportPreview: async (shareId: string) => {
    const { data } = await client.get(`/workflows/import/${shareId}`)
    return data
  },

  importWorkflow: async (shareId: string) => {
    const { data } = await client.post(`/workflows/import/${shareId}`)
    return data
  },

  getShareStats: async (workflowId: string, tenantId?: string) => {
    const params = tenantId ? { tenantId } : {}
    const { data } = await client.get(`/workflows/${workflowId}/share/stats`, { params })
    return data
  },

  // WhatsApp Sessions
  getWhatsappSessions: async (tenantId?: string) => {
    const params = tenantId ? { tenantId } : {}
    const { data } = await client.get('/whatsapp/sessions', { params })
    return data
  },

  getWhatsappSession: async (sessionId: string, tenantId?: string) => {
    const params = tenantId ? { tenantId } : {}
    const { data } = await client.get(`/whatsapp/sessions/${sessionId}`, { params })
    return data
  },

  createWhatsappSession: async (name: string, tenantId?: string) => {
    const params = tenantId ? { tenantId } : {}
    const { data } = await client.post('/whatsapp/sessions', { name }, { params })
    return data
  },

  deleteWhatsappSession: async (sessionId: string, tenantId?: string) => {
    const params = tenantId ? { tenantId } : {}
    await client.delete(`/whatsapp/sessions/${sessionId}`, { params })
  },

  reconnectWhatsappSession: async (sessionId: string) => {
    const { data } = await client.post(`/whatsapp/sessions/${sessionId}/reconnect`)
    return data
  },

  getSessionLabels: async (sessionId: string) => {
    const { data } = await client.get(`/whatsapp/sessions/${sessionId}/labels`)
    return data
  },

  sendWhatsappMessage: async (sessionId: string, contactId: string, message: string) => {
    const { data } = await client.post(`/whatsapp/sessions/${sessionId}/send`, {
      contactId,
      message,
    })
    return data
  },

  // Group Management
  getGroupConfigs: async (sessionId: string) => {
    const { data } = await client.get(`/whatsapp/sessions/${sessionId}/groups`)
    return data
  },

  getWhatsappGroups: async (sessionId: string) => {
    const { data } = await client.get(`/whatsapp/sessions/${sessionId}/groups`)
    return data
  },


  syncGroups: async (sessionId: string) => {
    const { data } = await client.post(`/whatsapp/sessions/${sessionId}/groups/sync`)
    return data
  },

  updateGroupConfig: async (sessionId: string, configId: string, enabled: boolean, workflowIds: string[]) => {
    const { data } = await client.put(`/whatsapp/sessions/${sessionId}/groups/${configId}`, {
      enabled,
      workflowIds,
    })
    return data
  },

  getGroupLinks: async (tenantId: string) => {
    const { data } = await client.get('/whatsapp/groups/links', {
      params: { tenantId }
    })
    return data
  },

  createGroupLink: async (groupJid: string, workflowId: string, tenantId: string) => {
    const { data } = await client.post('/whatsapp/groups/links', { groupJid, workflowId, tenantId })
    return data
  },

  deleteGroupLink: async (tenantId: string, linkId: string) => {
    await client.delete(`/whatsapp/groups/links/${linkId}`, {
      params: { tenantId }
    })
  },

  getGroupOffers: async (tenantId: string) => {
    const { data } = await client.get('/whatsapp/groups/offers', {
      params: { tenantId }
    })
    return data
  },

  // Executions
  getExecution: async (executionId: string) => {
    const { data } = await client.get(`/executions/${executionId}`)
    return data
  },

  getExecutionLogs: async (executionId: string) => {
    const { data } = await client.get(`/executions/${executionId}/logs`)
    return data
  },

  async getWorkflowExecutions(workflowId: string) {
    const { data } = await client.get(`/workflows/${workflowId}/executions`)
    return data
  },

  async getWorkflowInsights(
    workflowId: string,
    params: {
      from?: string
      to?: string
      compareFrom?: string
      compareTo?: string
      tenantId?: string
    }
  ) {
    const { tenantId, ...rest } = params
    const queryParams = tenantId ? { ...rest, tenantId } : rest
    const { data } = await client.get(`/workflows/${workflowId}/insights`, { params: queryParams })
    return data
  },

  // Manual Trigger
  async triggerManualExecution(workflowId: string, nodeId: string) {
    const { data } = await client.post(`/workflows/${workflowId}/trigger-manual`, {
      nodeId,
    })
    return data
  },

  async cancelExecution(executionId: string) {
    const { data } = await client.post(`/executions/${executionId}/cancel`, {});
    return data;
  },

  async executeGroupTest(workflowId: string, groupJid: string, groupName?: string) {
    const { data } = await client.post(`/workflows/${workflowId}/execute-group-test`, {
      groupJid,
      groupName
    })
    return data
  },

  async testNode(workflowId: string, nodeId: string, executionId?: string) {
    const { data } = await client.post(`/workflows/${workflowId}/test-node`, {
      nodeId,
      executionId,
    })
    return data
  },

  // Tags
  getTags: async () => {
    const { data } = await client.get('/tags')
    return data
  },

  getTag: async (tagId: string) => {
    const { data } = await client.get(`/tags/${tagId}`)
    return data
  },

  createTag: async (name: string, color?: string, description?: string) => {
    const { data } = await client.post('/tags', { name, color, description })
    return data
  },

  updateTag: async (tagId: string, updates: { name?: string; color?: string; description?: string }) => {
    const { data } = await client.put(`/tags/${tagId}`, updates)
    return data
  },

  deleteTag: async (tagId: string) => {
    await client.delete(`/tags/${tagId}`)
  },

  // Admin - Tenants (SUPER_ADMIN only)
  getTenants: async () => {
    const { data } = await client.get('/admin/tenants')
    return data
  },

  getTenant: async (tenantId: string) => {
    const { data } = await client.get(`/admin/tenants/${tenantId}`)
    return data
  },

  getMyTenant: async () => {
    const { data } = await client.get('/tenant/me')
    return data
  },

  createTenant: async (name: string, email: string) => {
    const { data } = await client.post('/admin/tenants', { name, email })
    return data
  },

  updateTenant: async (tenantId: string, updates: { name?: string; email?: string; isActive?: boolean }) => {
    const { data } = await client.put(`/admin/tenants/${tenantId}`, updates)
    return data
  },

  deleteTenant: async (tenantId: string) => {
    await client.delete(`/admin/tenants/${tenantId}`)
  },

  // Admin - Users
  getUsers: async () => {
    const { data } = await client.get('/admin/users')
    return data
  },

  getUser: async (userId: string) => {
    const { data } = await client.get(`/admin/users/${userId}`)
    return data
  },

  createUser: async (email: string, password: string, name: string, tenantId: string, role?: string) => {
    const { data } = await client.post('/admin/users', {
      email,
      password,
      name,
      tenantId,
      role,
    })
    return data
  },

  updateUser: async (userId: string, updates: { email?: string; password?: string; name?: string; isActive?: boolean; role?: string }) => {
    const { data } = await client.put(`/admin/users/${userId}`, updates)
    return data
  },

  deleteUser: async (userId: string) => {
    await client.delete(`/admin/users/${userId}`)
  },

  // WhatsApp Global Config
  getWhatsappConfig: async () => {
    const { data } = await client.get('/whatsapp/config')
    return data
  },

  updateWhatsappConfig: async (config: any) => {
    const { data } = await client.post('/whatsapp/config', config)
    return data
  },

  // Licensing
  getLicenses: async () => {
    const { data } = await client.get('/admin/users/licenses')
    return data
  },

  updateLicense: async (userId: string, updates: { role: string; licenseStatus: string; licenseExpiresAt?: string }) => {
    const { data } = await client.put(`/admin/users/${userId}/license`, updates)
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
    const { data } = await client.get('/inbox', { params })
    return data
  },

  getConversation: async (conversationId: string) => {
    const { data } = await client.get(`/inbox/${conversationId}`)
    return data
  },

  getInboxMessages: async (conversationId: string, cursor?: string, limit?: number) => {
    const { data } = await client.get(`/inbox/${conversationId}/messages`, {
      params: { cursor, limit },
    })
    return data
  },

  sendInboxMessage: async (
    conversationId: string,
    body: { text?: string; mediaUrl?: string; mediaType?: string }
  ) => {
    const { data } = await client.post(`/inbox/${conversationId}/send`, body)
    return data
  },

  triggerInboxFlow: async (conversationId: string, workflowId: string) => {
    const { data } = await client.post(`/inbox/${conversationId}/trigger-flow`, { workflowId })
    return data
  },

  updateConversationStatus: async (conversationId: string, status: string) => {
    const { data } = await client.patch(`/inbox/${conversationId}/status`, { status })
    return data
  },

  markConversationRead: async (conversationId: string) => {
    const { data } = await client.patch(`/inbox/${conversationId}/read`, {})
    return data
  },

  syncConversationProfile: async (conversationId: string) => {
    const { data } = await client.post(`/inbox/${conversationId}/sync-profile`)
    return data
  },

  getInboxStats: async () => {
    const { data } = await client.get('/inbox/stats')
    return data
  },

  // Generic
  get: async (url: string, params?: any) => {
    const path = url.startsWith('/api') ? url.replace(/^\/api/, '') : url
    const { data } = await client.get(path, { params })
    return data
  },
  post: async (url: string, body?: any, params?: any) => {
    const path = url.startsWith('/api') ? url.replace(/^\/api/, '') : url
    const { data } = await client.post(path, body, { params })
    return data
  },

  // Leads
  getLeadOrigins: async (period?: string) => {
    const { data } = await client.get('/leads/origins', { params: { period } })
    return data
  },
  getPixels: async () => {
    const { data } = await client.get('/leads/pixels');
    return data;
  },

  createPixel: async (data: any) => {
    const { data: responseData } = await client.post('/leads/pixels', data);
    return responseData;
  },

  updatePixel: async (id: string, data: any) => {
    const { data: responseData } = await client.put(`/leads/pixels/${id}`, data);
    return responseData;
  },

  deletePixel: async (id: string) => {
    await client.delete(`/leads/pixels/${id}`);
  },

  setPixelDefault: async (id: string) => {
    const { data } = await client.patch(`/leads/pixels/${id}/default`, {});
    return data;
  },

  getPixelConfig: async () => {
    const { data } = await client.get('/leads/pixel-config');
    return data;
  },

  updatePixelConfig: async (config: any) => {
    const { data } = await client.patch('/leads/pixel-config', config);
    return data;
  },

  // API Configs (per-tenant, per-provider credentials)
  getApiConfigs: async () => {
    const { data } = await client.get('/api-configs');
    return data;
  },

  upsertApiConfig: async (provider: string, appId: string, secret: string) => {
    const { data } = await client.post(`/api-configs/${provider}`, { appId, secret });
    return data;
  },

  setApiConfigActive: async (provider: string, isActive: boolean) => {
    const { data } = await client.patch(`/api-configs/${provider}/active`, { isActive });
    return data;
  },

  deleteApiConfig: async (provider: string) => {
    await client.delete(`/api-configs/${provider}`);
  },

  // Campaigns
  getCampaigns: async (type?: string, isTemplate?: boolean) => {
    const { data } = await client.get('/campaigns', { params: { type, isTemplate } });
    return data;
  },

  getCampaign: async (id: string) => {
    const { data } = await client.get(`/campaigns/${id}`);
    return data;
  },

  createCampaign: async (payload: any) => {
    const { data } = await client.post('/campaigns', payload);
    return data;
  },

  updateCampaign: async (id: string, payload: any) => {
    const { data } = await client.put(`/campaigns/${id}`, payload);
    return data;
  },

  deleteCampaign: async (id: string) => {
    await client.delete(`/campaigns/${id}`);
  },

  getPushcutNotifications: async () => {
    const { data } = await client.get('/api-configs/pushcut/notifications');
    return data;
  },

  getPushcutDevices: async () => {
    const { data } = await client.get('/api-configs/pushcut/devices');
    return data;
  },

  startCampaign: async (id: string) => {
    const { data } = await client.post(`/campaigns/${id}/start`);
    return data;
  },

  pauseCampaign: async (id: string) => {
    const { data } = await client.post(`/campaigns/${id}/pause`);
    return data;
  },

  resumeCampaign: async (id: string) => {
    const { data } = await client.post(`/campaigns/${id}/resume`);
    return data;
  },

  duplicateCampaign: async (id: string) => {
    const { data } = await client.post(`/campaigns/${id}/duplicate`);
    return data;
  },

  resetCampaign: async (id: string) => {
    const { data } = await client.post(`/campaigns/${id}/reset`);
    return data;
  },

  getCampaignStats: async (id: string) => {
    const { data } = await client.get(`/campaigns/${id}/stats`);
    return data;
  },

  getCampaignInsights: async (id: string) => {
    const { data } = await client.get(`/campaigns/${id}/insights`);
    return data;
  },

  addCampaignRecipientsFromContacts: async (id: string, tags?: string[], whatsappLabelIds?: string[]) => {
    const { data } = await client.post(`/campaigns/${id}/recipients/contacts`, { tags, whatsappLabelIds });
    return data;
  },

  getCampaignTags: async () => {
    const { data } = await client.get('/campaigns/tags');
    return data as { tag: string; count: number }[];
  },

  getCampaignWhatsappLabels: async () => {
    const { data } = await client.get('/campaigns/whatsapp-labels');
    return data as { id: string; name: string; color: string; count: number }[];
  },

  addCampaignRecipientsFromCsv: async (id: string, csv: string) => {
    const { data } = await client.post(`/campaigns/${id}/recipients/csv`, { csv });
    return data;
  },

  addCampaignRecipientsFromPhones: async (id: string, phones: string[]) => {
    const { data } = await client.post(`/campaigns/${id}/recipients/phones`, { phones });
    return data;
  },

  addCampaignRecipientsFromList: async (id: string, contactListId: string) => {
    const { data } = await client.post(`/campaigns/${id}/recipients/list`, { contactListId });
    return data;
  },

  getCampaignGroups: async (sessionId?: string) => {
    const { data } = await client.get('/campaigns/groups', { params: sessionId ? { sessionId } : {} });
    return data as { groupId: string; name: string; sessionId: string; enabled: boolean }[];
  },

  syncCampaignGroups: async (sessionId: string) => {
    const { data } = await client.post('/campaigns/groups/sync', { sessionId });
    return data;
  },

  getGroupParticipants: async (sessionId: string, groupJid: string, workflowId?: string) => {
    const { data } = await client.get(`/campaigns/groups/${encodeURIComponent(groupJid)}/participants`, { 
      params: { sessionId, workflowId } 
    });
    return data as { phone: string; name: string | null; isAdmin: boolean; isSuperAdmin: boolean; alreadyExecuted?: boolean }[];
  },

  addCampaignRecipientsFromGroup: async (id: string, body: {
    sessionId: string;
    groupJid: string;
    excludeAdmins?: boolean;
    allowResend?: boolean;
    selectedPhones?: string[];
  }) => {
    const { data } = await client.post(`/campaigns/${id}/recipients/group`, body);
    return data;
  },

  getCampaignSendHistory: async (id: string) => {
    const { data } = await client.get(`/campaigns/${id}/send-history`);
    return data as { phone: string; name: string | null; sentAt: string }[];
  },

  getCampaignWorkflow: async (id: string) => {
    const { data } = await client.get(`/campaigns/${id}/workflow`);
    return data;
  },

  saveCampaignWorkflow: async (id: string, nodes: any[], edges: any[]) => {
    const { data } = await client.put(`/campaigns/${id}/workflow`, { nodes, edges });
    return data;
  },

  getCampaignWorkflowsList: async () => {
    const { data } = await client.get('/campaigns/workflows');
    return data;
  },

  duplicateWorkflowTo: async (body: { sourceId: string; sourceType: string; targetType: string; name: string }) => {
    const { data } = await client.post('/workflows/duplicate-to', body);
    return data;
  },

  getCampaignBlacklist: async () => {
    const { data } = await client.get('/campaigns/blacklist');
    return data;
  },

  addToBlacklist: async (phone: string, reason?: string) => {
    const { data } = await client.post('/campaigns/blacklist', { phone, reason });
    return data;
  },

  removeFromBlacklist: async (phone: string) => {
    await client.delete(`/campaigns/blacklist/${phone}`);
  },

  // Contact Lists
  getContactLists: async () => {
    const { data } = await client.get('/contact-lists');
    return data;
  },

  getContactList: async (id: string) => {
    const { data } = await client.get(`/contact-lists/${id}`);
    return data;
  },

  createContactList: async (name: string, description?: string) => {
    const { data } = await client.post('/contact-lists', { name, description });
    return data;
  },

  updateContactList: async (id: string, payload: { name?: string; description?: string }) => {
    const { data } = await client.put(`/contact-lists/${id}`, payload);
    return data;
  },

  deleteContactList: async (id: string) => {
    await client.delete(`/contact-lists/${id}`);
  },

  addContactsFromCsv: async (listId: string, csv: string) => {
    const { data } = await client.post(`/contact-lists/${listId}/contacts/csv`, { csv });
    return data;
  },

  addContactsFromInbox: async (listId: string, tags?: string[]) => {
    const { data } = await client.post(`/contact-lists/${listId}/contacts/inbox`, { tags });
    return data;
  },

  addContactsManually: async (listId: string, contacts: { phone: string; name?: string }[]) => {
    const { data } = await client.post(`/contact-lists/${listId}/contacts/manual`, { contacts });
    return data;
  },

  removeContact: async (listId: string, contactId: string) => {
    await client.delete(`/contact-lists/${listId}/contacts/${contactId}`);
  },

  // Products (Vitrine)
  searchProducts: async (params: {
    keyword?: string;
    sortBy?: string;
    page?: number;
    limit?: number;
    minDiscount?: number;
    minRating?: number;
    catId?: number;
    extraCommissionOnly?: boolean;
  }) => {
    const { data } = await client.get('/products/search', { params });
    return data as { products: any[]; fromCache: boolean; hasNextPage: boolean };
  },

  clearProductsCache: async () => {
    const { data } = await client.delete('/products/cache');
    return data as { deleted: number };
  },

  uploadMedia: async (file: File, tenantId: string, mediaType: string, nodeId: string, workflowId: string) => {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await client.post('/media/upload', formData, {
      params: { tenantId, mediaType, nodeId, workflowId },
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return data
  },

  deleteMedia: async (mediaId: string, tenantId: string) => {
    const { data } = await client.delete(`/media/${mediaId}`, {
      params: { tenantId },
    })
    return data
  },
}
