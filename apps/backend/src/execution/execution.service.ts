import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionStatus, WorkflowExecution, ExecutionContext } from '@n9n/shared';

@Injectable()
export class ExecutionService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) { }

  /**
   * Create new execution
   */
  async createExecution(
    tenantId: string,
    workflowId: string,
    sessionId: string,
    contactPhone: string,
    initialContext: Partial<ExecutionContext> = {},
  ): Promise<WorkflowExecution> {
    const ttlHours = this.configService.get('EXECUTION_DEFAULT_TTL_HOURS', 24);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const context: ExecutionContext = {
      globals: {},
      input: {},
      output: {},
      variables: {},
      ...initialContext,
    };

    const execution = await this.prisma.workflowExecution.create({
      data: {
        tenantId,
        workflowId,
        sessionId,
        contactPhone,
        status: ExecutionStatus.RUNNING,
        context: context as any,
        interactionCount: 0,
        expiresAt,
      },
    });

    // Add metadata for nodes (like RMKT) to reference the current execution
    context.variables._executionId = execution.id;
    context.variables._tenantId = tenantId;
    await this.prisma.workflowExecution.update({
      where: { id: execution.id },
      data: { context: context as any },
    });

    return this.mapToExecution(execution);
  }

  /**
   * Get active execution for contact
   */
  async getActiveExecution(
    tenantId: string,
    sessionId: string,
    contactPhone: string,
  ): Promise<WorkflowExecution | null> {
    const execution = await this.prisma.workflowExecution.findFirst({
      where: {
        tenantId,
        sessionId,
        contactPhone,
        status: {
          in: [ExecutionStatus.RUNNING, ExecutionStatus.WAITING],
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    return execution ? this.mapToExecution(execution) : null;
  }

  /**
   * Update execution
   */
  async updateExecution(
    executionId: string,
    data: Partial<{
      currentNodeId: string | null;
      status: ExecutionStatus;
      context: ExecutionContext;
      interactionCount: number;
      error: string;
    }>,
  ): Promise<WorkflowExecution> {
    const execution = await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        ...data,
        context: data.context as any,
        updatedAt: new Date(),
        completedAt: data.status === ExecutionStatus.COMPLETED ||
          data.status === ExecutionStatus.EXPIRED ||
          data.status === ExecutionStatus.ERROR
          ? new Date()
          : undefined,
      },
    });

    return this.mapToExecution(execution);
  }

  /**
   * Get execution by ID
   */
  async getExecution(tenantId: string, executionId: string): Promise<WorkflowExecution | null> {
    const execution = await this.prisma.workflowExecution.findFirst({
      where: {
        id: executionId,
        tenantId,
      },
    });

    return execution ? this.mapToExecution(execution) : null;
  }

  /**
   * Get executions for a workflow
   */
  async getWorkflowExecutions(tenantId: string, workflowId: string): Promise<WorkflowExecution[]> {
    const executions = await this.prisma.workflowExecution.findMany({
      where: {
        tenantId,
        workflowId,
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: 50, // Limit to last 50 executions
    });

    const mapped = executions.map(this.mapToExecution.bind(this));

    return mapped;
  }

  /**
   * Get expired executions
   */
  async getExpiredExecutions(): Promise<WorkflowExecution[]> {
    const executions = await this.prisma.workflowExecution.findMany({
      where: {
        status: {
          in: [ExecutionStatus.RUNNING, ExecutionStatus.WAITING],
        },
        expiresAt: {
          lte: new Date(),
        },
      },
    });

    return executions.map(this.mapToExecution);
  }

  /**
   * Increment interaction count
   */
  async incrementInteractionCount(executionId: string): Promise<number> {
    const execution = await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        interactionCount: {
          increment: 1,
        },
      },
    });

    return execution.interactionCount;
  }

  /**
   * Check if interaction limit reached
   */
  isInteractionLimitReached(interactionCount: number): boolean {
    const maxInteractions = this.configService.get('EXECUTION_MAX_INTERACTIONS', 20);
    return interactionCount >= maxInteractions;
  }

  private mapToExecution(data: any): WorkflowExecution {
    return {
      id: data.id,
      tenantId: data.tenantId,
      workflowId: data.workflowId,
      sessionId: data.sessionId,
      contactPhone: data.contactPhone,
      currentNodeId: data.currentNodeId,
      status: data.status as ExecutionStatus,
      context: data.context as ExecutionContext,
      interactionCount: data.interactionCount,
      startedAt: data.startedAt,
      createdAt: data.startedAt, // Alias for frontend compatibility
      updatedAt: data.updatedAt,
      expiresAt: data.expiresAt,
      completedAt: data.completedAt,
      error: data.error,
    } as any;
  }
}

