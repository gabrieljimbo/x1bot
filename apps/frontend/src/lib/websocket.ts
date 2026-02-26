import { io, Socket } from 'socket.io-client'
import { WorkflowEvent } from '@n9n/shared'

const WS_URL = (process.env.NEXT_PUBLIC_WS_URL || 'https://api.n9n.archcode.space')?.replace(/\/$/, '')

class WebSocketClient {
  private socket: Socket | null = null
  private listeners: Map<string, Set<(event: WorkflowEvent) => void>> = new Map()
  private rawListeners: Map<string, Set<(data: any) => void>> = new Map()

  connect(tenantId: string, token?: string) {
    if (this.socket?.connected) {
      console.log('WebSocket already connected')
      return
    }

    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('n9n_token') : null)

    console.log('Connecting to WebSocket:', WS_URL, 'with tenantId:', tenantId)

    this.socket = io(WS_URL, {
      query: { tenantId },
      auth: authToken ? { token: authToken } : undefined,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    })

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected successfully!')
      // Re-register raw listeners on reconnect
      this.rawListeners.forEach((handlers, eventName) => {
        handlers.forEach((handler) => {
          this.socket?.on(eventName, handler)
        })
      })
    })

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error)
    })

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
    })

    this.socket.on('workflow:event', (event: WorkflowEvent) => {
      console.log('📨 Received event:', event.type, event)

      const handlers = this.listeners.get(event.type)
      if (handlers) {
        handlers.forEach((handler) => handler(event))
      }

      // Also trigger wildcard listeners
      const wildcardHandlers = this.listeners.get('*')
      if (wildcardHandlers) {
        wildcardHandlers.forEach((handler) => handler(event))
      }
    })

    // Listen to all events for debugging
    this.socket.onAny((eventName, ...args) => {
      console.log('🔔 Socket event:', eventName, args)
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  on(eventType: string, handler: (event: WorkflowEvent) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)!.add(handler)
  }

  off(eventType: string, handler: (event: WorkflowEvent) => void) {
    const handlers = this.listeners.get(eventType)
    if (handlers) {
      handlers.delete(handler)
    }
  }

  // Raw socket event listeners (for inbox events like inbox:conversation-updated)
  onRaw(eventName: string, handler: (data: any) => void) {
    if (!this.rawListeners.has(eventName)) {
      this.rawListeners.set(eventName, new Set())
    }
    this.rawListeners.get(eventName)!.add(handler)
    // Register immediately if already connected
    if (this.socket?.connected) {
      this.socket.on(eventName, handler)
    }
  }

  offRaw(eventName: string, handler: (data: any) => void) {
    const handlers = this.rawListeners.get(eventName)
    if (handlers) {
      handlers.delete(handler)
    }
    this.socket?.off(eventName, handler)
  }
}

export const wsClient = new WebSocketClient()


