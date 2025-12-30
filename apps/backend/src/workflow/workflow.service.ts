import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Workflow, WorkflowNode, WorkflowEdge, WorkflowNodeType, TriggerManualConfig } from '@n9n/shared';
import { ExecutionEngineService } from '../execution/execution-engine.service';

@Injectable()
export class WorkflowService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ExecutionEngineService))
    private executionEngine: ExecutionEngineService,
  ) {}

  /**
   * Create workflow
   */
  async createWorkflow(
    tenantId: string,
    name: string,
    description?: string,
  ): Promise<Workflow> {
    const workflow = await this.prisma.workflow.create({
      data: {
        tenantId,
        name,
        description,
        nodes: [],
        edges: [],
        isActive: false,
      },
    });

    return this.mapToWorkflow(workflow);
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(tenantId: string, workflowId: string): Promise<Workflow | null> {
    const workflow = await this.prisma.workflow.findFirst({
      where: {
        id: workflowId,
        tenantId,
      },
    });

    return workflow ? this.mapToWorkflow(workflow) : null;
  }

  /**
   * Get all workflows for tenant
   */
  async getWorkflows(tenantId: string): Promise<Workflow[]> {
    const workflows = await this.prisma.workflow.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return workflows.map(this.mapToWorkflow);
  }

  /**
   * Update workflow
   */
  async updateWorkflow(
    tenantId: string,
    workflowId: string,
    data: Partial<{
      name: string;
      description: string;
      nodes: WorkflowNode[];
      edges: WorkflowEdge[];
      isActive: boolean;
    }>,
  ): Promise<Workflow> {
    // Validate workflow structure only when activating
    if (data.isActive === true) {
      const workflow = await this.getWorkflow(tenantId, workflowId);
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      const nodes = data.nodes || workflow.nodes;
      const edges = data.edges || workflow.edges;

      this.validateWorkflow(nodes, edges);
    }

    // Validate edges reference existing nodes when updating structure
    if (data.nodes || data.edges) {
      const workflow = await this.getWorkflow(tenantId, workflowId);
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      const nodes = data.nodes || workflow.nodes;
      const edges = data.edges || workflow.edges;

      this.validateEdges(nodes, edges);
    }

    const workflow = await this.prisma.workflow.update({
      where: {
        id: workflowId,
        tenantId,
      },
      data: {
        ...data,
        nodes: data.nodes as any,
        edges: data.edges as any,
        updatedAt: new Date(),
      },
    });

    return this.mapToWorkflow(workflow);
  }

  /**
   * Delete workflow
   */
  async deleteWorkflow(tenantId: string, workflowId: string): Promise<void> {
    await this.prisma.workflow.delete({
      where: {
        id: workflowId,
        tenantId,
      },
    });
  }

  /**
   * Validate workflow structure (for activation)
   */
  private validateWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    // Allow empty workflows (under construction)
    if (nodes.length === 0) {
      throw new Error('Cannot activate an empty workflow');
    }

    // Check for at least one trigger node
    const hasTrigger = nodes.some(
      (n) =>
        n.type === WorkflowNodeType.TRIGGER_MESSAGE ||
        n.type === WorkflowNodeType.TRIGGER_SCHEDULE,
    );

    if (!hasTrigger) {
      throw new Error('Workflow must have at least one trigger node');
    }

    // Check for at least one END node
    const hasEnd = nodes.some((n) => n.type === WorkflowNodeType.END);

    if (!hasEnd) {
      throw new Error('Workflow must have at least one END node');
    }

    // Validate edges reference existing nodes
    this.validateEdges(nodes, edges);
  }

  /**
   * Validate edges reference existing nodes (for editing)
   */
  private validateEdges(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    const nodeIds = new Set(nodes.map((n) => n.id));

    for (const edge of edges) {
      if (!nodeIds.has(edge.source)) {
        throw new Error(`Edge references non-existent source node: ${edge.source}`);
      }
      if (!nodeIds.has(edge.target)) {
        throw new Error(`Edge references non-existent target node: ${edge.target}`);
      }
    }
  }

  private mapToWorkflow(data: any): Workflow {
    return {
      id: data.id,
      tenantId: data.tenantId,
      name: data.name,
      description: data.description,
      nodes: data.nodes as WorkflowNode[],
      edges: data.edges as WorkflowEdge[],
      isActive: data.isActive,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  /**
   * Trigger manual execution of a workflow
   */
  async triggerManualExecution(
    tenantId: string,
    workflowId: string,
    nodeId: string,
  ): Promise<{ executionId: string }> {
    // Get the workflow
    const workflow = await this.getWorkflow(tenantId, workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Find the trigger node
    const triggerNode = workflow.nodes.find((n) => n.id === nodeId);
    if (!triggerNode || triggerNode.type !== WorkflowNodeType.TRIGGER_MANUAL) {
      throw new Error(`Trigger node ${nodeId} not found or is not a TRIGGER_MANUAL node`);
    }

    const config = triggerNode.config as TriggerManualConfig;

    // Find a WhatsApp session to use
    let sessionId: string;
    if (config.sessionId) {
      // Use the configured session
      const session = await this.prisma.whatsappSession.findUnique({
        where: { id: config.sessionId, tenantId },
      });
      if (!session || session.status !== 'CONNECTED') {
        throw new Error(`Configured session ${config.sessionId} is not connected`);
      }
      sessionId = session.id;
    } else {
      // Find the first connected session
      const session = await this.prisma.whatsappSession.findFirst({
        where: { tenantId, status: 'CONNECTED' },
      });
      if (!session) {
        throw new Error('No connected WhatsApp session found');
      }
      sessionId = session.id;
    }

    // Generate a unique contact ID for this manual execution
    const timestamp = Date.now();
    const contactId = `manual-${workflowId}-${timestamp}`;

    // Start execution
    const execution = await this.executionEngine.startExecution(
      tenantId,
      workflowId,
      sessionId,
      contactId,
      undefined, // no trigger message for manual executions
    );

    console.log(`[MANUAL TRIGGER] Started execution ${execution.id} for workflow ${workflowId}`);

    return { executionId: execution.id };
  }
}

