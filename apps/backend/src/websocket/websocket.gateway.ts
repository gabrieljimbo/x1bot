import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { EventBusService } from '../event-bus/event-bus.service';
import { WorkflowEvent, EventType } from '@n9n/shared';

const parseOrigins = (value?: string): string[] =>
  (value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const normalizeOrigin = (origin: string): string =>
  origin.replace(/\/$/, '').toLowerCase();

const allowedOrigins = Array.from(
  new Set(
    [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://x1bot.cloud',
      'https://www.x1bot.cloud',
      'https://api.n9n.archcode.space',
      ...parseOrigins(process.env.CORS_ORIGIN),
      ...parseOrigins(process.env.FRONTEND_URL),
    ].map(normalizeOrigin),
  ),
);

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(normalizeOrigin(origin))) {
        return callback(null, true);
      }
      return callback(new Error(`Origin not allowed by WS CORS: ${origin}`), false);
    },
    credentials: true,
  },
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private clientTenants: Map<string, string> = new Map();

  constructor(private eventBus: EventBusService) {
    this.setupEventListeners();
  }

  handleConnection(client: Socket) {
    // Extract tenantId from query or auth
    const tenantId = client.handshake.query.tenantId as string;

    console.log(`WebSocket client connected: ${client.id}, tenantId: ${tenantId}`);

    if (tenantId) {
      this.clientTenants.set(client.id, tenantId);
      client.join(`tenant:${tenantId}`);
      console.log(`Client ${client.id} joined room: tenant:${tenantId}`);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`WebSocket client disconnected: ${client.id}`);
    this.clientTenants.delete(client.id);
  }

  /**
   * Setup event listeners to broadcast events to clients
   */
  private setupEventListeners() {
    // Listen to all event types
    Object.values(EventType).forEach((eventType) => {
      this.eventBus.on(eventType, (event: WorkflowEvent) => {
        this.broadcastToTenant(event.tenantId, event);
      });
    });
  }

  /**
   * Broadcast event to all clients of a tenant
   */
  private broadcastToTenant(tenantId: string, event: WorkflowEvent) {
    console.log(`Broadcasting event ${event.type} to tenant:${tenantId}`);
    this.server.to(`tenant:${tenantId}`).emit('workflow:event', event);

    // Also emit with the event type as the event name for onRaw listeners
    if (event.type.toString().startsWith('inbox:')) {
      this.server.to(`tenant:${tenantId}`).emit(event.type, event);
    }
  }

  /**
   * Send event to specific execution
   */
  sendToExecution(tenantId: string, executionId: string, event: any) {
    this.server.to(`tenant:${tenantId}`).emit(`execution:${executionId}`, event);
  }
}

