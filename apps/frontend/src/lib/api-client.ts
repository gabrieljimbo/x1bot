import axios from 'axios'

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.n9n.archcode.space').replace(/\/$/, '')

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const apiClient = {
  // Workflows
  getWorkflows: async (tenantId: string) => {
    const { data } = await client.get(`/api/workflows?tenantId=${tenantId}`)
    return data
  },

  getWorkflow: async (tenantId: string, workflowId: string) => {
    const { data } = await client.get(`/api/workflows/${workflowId}?tenantId=${tenantId}`)
    return data
  },

  createWorkflow: async (tenantId: string, name: string, description?: string) => {
    const { data } = await client.post('/api/workflows', { tenantId, name, description })
    return data
  },

  updateWorkflow: async (tenantId: string, workflowId: string, updates: any) => {
    const { data } = await client.put(`/api/workflows/${workflowId}?tenantId=${tenantId}`, updates)
    return data
  },

  deleteWorkflow: async (tenantId: string, workflowId: string) => {
    await client.delete(`/api/workflows/${workflowId}?tenantId=${tenantId}`)
  },

  // WhatsApp Sessions
  getWhatsappSessions: async (tenantId: string) => {
    const { data } = await client.get(`/api/whatsapp/sessions?tenantId=${tenantId}`)
    return data
  },

  getWhatsappSession: async (tenantId: string, sessionId: string) => {
    const { data } = await client.get(`/api/whatsapp/sessions/${sessionId}?tenantId=${tenantId}`)
    return data
  },

  createWhatsappSession: async (tenantId: string, name: string) => {
    const { data } = await client.post('/api/whatsapp/sessions', { tenantId, name })
    return data
  },

  deleteWhatsappSession: async (tenantId: string, sessionId: string) => {
    await client.delete(`/api/whatsapp/sessions/${sessionId}?tenantId=${tenantId}`)
  },

  reconnectWhatsappSession: async (tenantId: string, sessionId: string) => {
    const { data } = await client.post(`/api/whatsapp/sessions/${sessionId}/reconnect?tenantId=${tenantId}`)
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

  // Executions
  getExecution: async (tenantId: string, executionId: string) => {
    const { data } = await client.get(`/api/executions/${executionId}?tenantId=${tenantId}`)
    return data
  },

  getExecutionLogs: async (tenantId: string, executionId: string) => {
    const { data } = await client.get(`/api/executions/${executionId}/logs?tenantId=${tenantId}`)
    return data
  },

  getWorkflowExecutions: async (tenantId: string, workflowId: string) => {
    const { data } = await client.get(`/api/workflows/${workflowId}/executions?tenantId=${tenantId}`)
    return data
  },

  // Manual Trigger
  async triggerManualExecution(tenantId: string, workflowId: string, nodeId: string) {
    const { data } = await client.post(`/api/workflows/${workflowId}/trigger-manual`, {
      tenantId,
      nodeId,
    })
    return data
  },

  async testNode(tenantId: string, workflowId: string, nodeId: string, executionId?: string) {
    const { data } = await client.post(`/api/workflows/${workflowId}/test-node`, {
      tenantId,
      nodeId,
      executionId,
    })
    return data
  },
}
