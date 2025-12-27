import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkflowEvent } from '@n9n/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventBusService {
  constructor(
    private eventEmitter: EventEmitter2,
    private prisma: PrismaService,
  ) {}

  /**
   * Emit event to internal listeners and persist to database
   */
  async emit(event: WorkflowEvent): Promise<void> {
    // Emit to internal listeners (WebSocket, etc)
    this.eventEmitter.emit(event.type, event);

    // Persist to database for audit trail
    if ('executionId' in event) {
      await this.prisma.executionLog.create({
        data: {
          tenantId: event.tenantId,
          executionId: event.executionId,
          nodeId: 'nodeId' in event ? (event.nodeId as string) : null,
          eventType: event.type,
          data: event as any,
        },
      });
    }
  }

  /**
   * Subscribe to events
   */
  on(eventType: string, handler: (event: WorkflowEvent) => void | Promise<void>): void {
    this.eventEmitter.on(eventType, handler);
  }

  /**
   * Get execution logs
   */
  async getExecutionLogs(tenantId: string, executionId: string) {
    return this.prisma.executionLog.findMany({
      where: {
        tenantId,
        executionId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}


