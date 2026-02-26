import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { EventBusService } from '../event-bus/event-bus.service';
import { WorkflowEvent, EventType } from '@n9n/shared';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
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

