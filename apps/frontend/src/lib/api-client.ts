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

  getWhatsappGroups: async (sessionId: string) => {
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

  getGroupLinks: async (tenantId: string) => {
    const { data } = await client.get('/api/whatsapp/groups/links', {
      params: { tenantId }
    })
    return data
  },

  createGroupLink: async (groupJid: string, workflowId: string, tenantId: string) => {
    const { data } = await client.post('/api/whatsapp/groups/links', { groupJid, workflowId, tenantId })
    return data
  },

  deleteGroupLink: async (tenantId: string, linkId: string) => {
    await client.delete(`/api/whatsapp/groups/links/${linkId}`, {
      params: { tenantId }
    })
  },

  getGroupOffers: async (tenantId: string) => {
    const { data } = await client.get('/api/whatsapp/groups/offers', {
      params: { tenantId }
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

  async getWorkflowExecutions(workflowId: string) {
    const { data } = await client.get(`/api/workflows/${workflowId}/executions`)
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
    const { data } = await client.get(`/api/workflows/${workflowId}/insights`, { params: queryParams })
    return data
  },

  // Manual Trigger
  async triggerManualExecution(workflowId: string, nodeId: string) {
    const { data } = await client.post(`/api/workflows/${workflowId}/trigger-manual`, {
      nodeId,
    })
    return data
  },

  async cancelExecution(executionId: string) {
    const { data } = await client.post(`/api/executions/${executionId}/cancel`, {});
    return data;
  },

  async executeGroupTest(workflowId: string, groupJid: string, groupName?: string) {
    const { data } = await client.post(`/api/workflows/${workflowId}/execute-group-test`, {
      groupJid,
      groupName
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

  getInboxStats: async () => {
    const { data } = await client.get('/api/inbox/stats')
    return data
  },

  // Generic
  get: async (url: string, params?: any) => {
    const { data } = await client.get(url.startsWith('/api') ? url : `/api${url}`, { params })
    return data
  },
  post: async (url: string, body?: any, params?: any) => {
    const { data } = await client.post(url.startsWith('/api') ? url : `/api${url}`, body, { params })
    return data
  },

  // Leads
  getLeadOrigins: async (period?: string) => {
    const { data } = await client.get('/api/leads/origins', { params: { period } })
    return data
  },
  getPixels: async () => {
    const { data } = await client.get('/api/leads/pixels');
    return data;
  },

  createPixel: async (data: any) => {
    const { data: responseData } = await client.post('/api/leads/pixels', data);
    return responseData;
  },

  updatePixel: async (id: string, data: any) => {
    const { data: responseData } = await client.put(`/api/leads/pixels/${id}`, data);
    return responseData;
  },

  deletePixel: async (id: string) => {
    await client.delete(`/api/leads/pixels/${id}`);
  },

  setPixelDefault: async (id: string) => {
    const { data } = await client.patch(`/api/leads/pixels/${id}/default`, {});
    return data;
  },

  getPixelConfig: async () => {
    const { data } = await client.get('/api/leads/pixel-config');
    return data;
  },

  updatePixelConfig: async (config: any) => {
    const { data } = await client.patch('/api/leads/pixel-config', config);
    return data;
  },

  // API Configs (per-tenant, per-provider credentials)
  getApiConfigs: async () => {
    const { data } = await client.get('/api/api-configs');
    return data;
  },

  upsertApiConfig: async (provider: string, appId: string, secret: string) => {
    const { data } = await client.post(`/api/api-configs/${provider}`, { appId, secret });
    return data;
  },

  setApiConfigActive: async (provider: string, isActive: boolean) => {
    const { data } = await client.patch(`/api/api-configs/${provider}/active`, { isActive });
    return data;
  },

  deleteApiConfig: async (provider: string) => {
    await client.delete(`/api/api-configs/${provider}`);
  },

  // Campaigns
  getCampaigns: async (type?: string) => {
    const { data } = await client.get('/api/campaigns', { params: type ? { type } : {} });
    return data;
  },

  getCampaign: async (id: string) => {
    const { data } = await client.get(`/api/campaigns/${id}`);
    return data;
  },

  createCampaign: async (payload: any) => {
    const { data } = await client.post('/api/campaigns', payload);
    return data;
  },

  updateCampaign: async (id: string, payload: any) => {
    const { data } = await client.put(`/api/campaigns/${id}`, payload);
    return data;
  },

  deleteCampaign: async (id: string) => {
    await client.delete(`/api/campaigns/${id}`);
  },

  startCampaign: async (id: string) => {
    const { data } = await client.post(`/api/campaigns/${id}/start`);
    return data;
  },

  pauseCampaign: async (id: string) => {
    const { data } = await client.post(`/api/campaigns/${id}/pause`);
    return data;
  },

  resumeCampaign: async (id: string) => {
    const { data } = await client.post(`/api/campaigns/${id}/resume`);
    return data;
  },

  getCampaignStats: async (id: string) => {
    const { data } = await client.get(`/api/campaigns/${id}/stats`);
    return data;
  },

  addCampaignRecipientsFromContacts: async (id: string, tags?: string[], whatsappLabelIds?: string[]) => {
    const { data } = await client.post(`/api/campaigns/${id}/recipients/contacts`, { tags, whatsappLabelIds });
    return data;
  },

  getCampaignTags: async () => {
    const { data } = await client.get('/api/campaigns/tags');
    return data as { tag: string; count: number }[];
  },

  getCampaignWhatsappLabels: async () => {
    const { data } = await client.get('/api/campaigns/whatsapp-labels');
    return data as { id: string; name: string; color: string; count: number }[];
  },

  addCampaignRecipientsFromCsv: async (id: string, csv: string) => {
    const { data } = await client.post(`/api/campaigns/${id}/recipients/csv`, { csv });
    return data;
  },

  addCampaignRecipientsFromPhones: async (id: string, phones: string[]) => {
    const { data } = await client.post(`/api/campaigns/${id}/recipients/phones`, { phones });
    return data;
  },

  addCampaignRecipientsFromList: async (id: string, contactListId: string) => {
    const { data } = await client.post(`/api/campaigns/${id}/recipients/list`, { contactListId });
    return data;
  },

  getCampaignWorkflow: async (id: string) => {
    const { data } = await client.get(`/api/campaigns/${id}/workflow`);
    return data;
  },

  saveCampaignWorkflow: async (id: string, nodes: any[], edges: any[]) => {
    const { data } = await client.put(`/api/campaigns/${id}/workflow`, { nodes, edges });
    return data;
  },

  getCampaignWorkflowsList: async () => {
    const { data } = await client.get('/api/campaigns/workflows');
    return data;
  },

  duplicateWorkflowTo: async (body: { sourceId: string; sourceType: string; targetType: string; name: string }) => {
    const { data } = await client.post('/api/workflows/duplicate-to', body);
    return data;
  },

  getCampaignBlacklist: async () => {
    const { data } = await client.get('/api/campaigns/blacklist');
    return data;
  },

  addToBlacklist: async (phone: string, reason?: string) => {
    const { data } = await client.post('/api/campaigns/blacklist', { phone, reason });
    return data;
  },

  removeFromBlacklist: async (phone: string) => {
    await client.delete(`/api/campaigns/blacklist/${phone}`);
  },

  // Contact Lists
  getContactLists: async () => {
    const { data } = await client.get('/api/contact-lists');
    return data;
  },

  getContactList: async (id: string) => {
    const { data } = await client.get(`/api/contact-lists/${id}`);
    return data;
  },

  createContactList: async (name: string, description?: string) => {
    const { data } = await client.post('/api/contact-lists', { name, description });
    return data;
  },

  updateContactList: async (id: string, payload: { name?: string; description?: string }) => {
    const { data } = await client.put(`/api/contact-lists/${id}`, payload);
    return data;
  },

  deleteContactList: async (id: string) => {
    await client.delete(`/api/contact-lists/${id}`);
  },

  addContactsFromCsv: async (listId: string, csv: string) => {
    const { data } = await client.post(`/api/contact-lists/${listId}/contacts/csv`, { csv });
    return data;
  },

  addContactsFromInbox: async (listId: string, tags?: string[]) => {
    const { data } = await client.post(`/api/contact-lists/${listId}/contacts/inbox`, { tags });
    return data;
  },

  addContactsManually: async (listId: string, contacts: { phone: string; name?: string }[]) => {
    const { data } = await client.post(`/api/contact-lists/${listId}/contacts/manual`, { contacts });
    return data;
  },

  removeContact: async (listId: string, contactId: string) => {
    await client.delete(`/api/contact-lists/${listId}/contacts/${contactId}`);
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
    const { data } = await client.get('/api/products/search', { params });
    return data as { products: any[]; fromCache: boolean; hasNextPage: boolean };
  },

  clearProductsCache: async () => {
    const { data } = await client.delete('/api/products/cache');
    return data as { deleted: number };
  },
}
