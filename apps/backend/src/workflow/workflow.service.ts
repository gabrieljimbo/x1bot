import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Workflow, WorkflowNode, WorkflowEdge, WorkflowNodeType, TriggerManualConfig, WorkflowExecution } from '@n9n/shared';
import { ExecutionEngineService } from '../execution/execution-engine.service';
import { StorageService } from '../storage/storage.service';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

@Injectable()
export class WorkflowService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ExecutionEngineService))
    private executionEngine: ExecutionEngineService,
    private storageService: StorageService,
  ) { }

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
    // Clean up uploaded media files from MinIO
    const mediaFiles = await this.prisma.mediaFile.findMany({
      where: { workflowId, tenantId },
    });

    for (const file of mediaFiles) {
      try {
        await this.storageService.deleteMedia(file.objectName);
      } catch (e) {
        console.warn(`[WORKFLOW] Failed to delete media ${file.objectName} from MinIO`);
      }
    }

    if (mediaFiles.length > 0) {
      await this.prisma.mediaFile.deleteMany({
        where: { workflowId, tenantId },
      });
    }

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
    if (!triggerNode) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // Allow TRIGGER_MANUAL and LOOP nodes to be executed
    if (triggerNode.type !== WorkflowNodeType.TRIGGER_MANUAL && triggerNode.type !== WorkflowNodeType.LOOP) {
      throw new Error(`Node ${nodeId} must be a TRIGGER_MANUAL or LOOP node to be executed manually`);
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
    const contactPhone = `manual-${workflowId}-${timestamp}`;

    // Start execution
    const execution = await this.executionEngine.startExecution(
      tenantId,
      workflowId,
      sessionId,
      contactPhone,
      undefined, // no trigger message for manual executions
    );

    console.log(`[MANUAL TRIGGER] Started execution ${execution.id} for workflow ${workflowId}`);

    return { executionId: execution.id };
  }

  /**
   * Test a node from the current execution context
   */
  async testNodeFromContext(
    tenantId: string,
    workflowId: string,
    nodeId: string,
    executionId?: string,
    nodeConfig?: any,
  ): Promise<{ executionId: string }> {
    // Get the workflow
    const workflow = await this.getWorkflow(tenantId, workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Find the node
    const node = workflow.nodes.find((n) => n.id === nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // If nodeConfig is provided, use it (for testing with unsaved config)
    if (nodeConfig) {
      node.config = { ...node.config, ...nodeConfig };
    }

    // Validate node config for LOOP nodes
    if (node.type === 'LOOP' && (!node.config || !node.config.loopMode)) {
      throw new Error(`Loop node configuration is missing. Please save the node configuration before testing. Config: ${JSON.stringify(node.config)}`);
    }

    // Get the latest execution or the specified one
    let existingExecution;
    if (executionId) {
      existingExecution = await this.prisma.workflowExecution.findFirst({
        where: { id: executionId, tenantId, workflowId },
      });
    } else {
      // Get the most recent execution (any status) for this workflow
      existingExecution = await this.prisma.workflowExecution.findFirst({
        where: { tenantId, workflowId },
        orderBy: { startedAt: 'desc' },
      });
    }

    if (!existingExecution) {
      throw new Error('No execution found. Please run the workflow first to generate context.');
    }


    // Find a WhatsApp session to use - prefer the one from existing execution, otherwise find any connected
    let session;
    if (existingExecution.sessionId) {
      session = await this.prisma.whatsappSession.findFirst({
        where: { id: existingExecution.sessionId, tenantId },
      });
    }

    // If no session from existing execution, try to find any connected session
    if (!session) {
      session = await this.prisma.whatsappSession.findFirst({
        where: { tenantId, status: 'CONNECTED' },
      });
    }

    // For testing, we can create a mock session ID if none exists
    // This allows testing nodes that don't require WhatsApp interaction
    const sessionId = session?.id || `test-session-${tenantId}`;
    const contactPhone = existingExecution.contactPhone || `test-${nodeId}-${Date.now()}`;

    // Create a new execution with the same context but starting from the specified node
    const newExecution = await this.prisma.workflowExecution.create({
      data: {
        tenantId,
        workflowId,
        sessionId,
        contactPhone,
        currentNodeId: nodeId,
        status: 'RUNNING',
        context: existingExecution.context as any, // Reuse context from previous execution
        interactionCount: 0,
        startedAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    console.log(`[TEST NODE] Created test execution ${newExecution.id} starting from node ${nodeId}`);
    console.log(`[TEST NODE] Using context from execution ${existingExecution.id}`);

    // Start execution from this node using the execution engine
    await this.executionEngine.testNodeExecution(
      {
        ...newExecution,
        status: newExecution.status as any,
        context: existingExecution.context as any,
      } as WorkflowExecution,
      workflow,
    );

    return { executionId: newExecution.id };
  }

  /**
   * Duplicate workflow
   */
  async duplicateWorkflow(tenantId: string, workflowId: string): Promise<Workflow> {
    const original = await this.prisma.workflow.findFirst({
      where: { id: workflowId, tenantId },
    });

    if (!original) {
      throw new Error('Workflow not found');
    }

    const duplicated = await this.prisma.workflow.create({
      data: {
        tenantId,
        name: `${original.name} (Copy)`,
        description: original.description,
        nodes: original.nodes as any,
        edges: original.edges as any,
        isActive: false, // Don't activate duplicated workflows by default
      },
    });

    return this.mapToWorkflow(duplicated);
  }

  /**
   * Share workflow
   */
  async shareWorkflow(workflowId: string, userId: string): Promise<any> {
    // Check if it's already shared
    let shareable = await this.prisma.shareableWorkflow.findFirst({
      where: { workflowId },
    });

    if (!shareable) {
      shareable = await this.prisma.shareableWorkflow.create({
        data: {
          workflowId,
          createdBy: userId,
        },
      });
    }

    return shareable;
  }

  /**
   * Get shared workflow preview
   */
  async getSharedWorkflowPreview(shareId: string): Promise<any> {
    const shareable = await this.prisma.shareableWorkflow.findUnique({
      where: { id: shareId },
      include: {
        workflow: {
          select: {
            name: true,
            description: true,
            nodes: true,
          },
        },
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!shareable) {
      throw new Error('Shared workflow not found');
    }

    const nodes = shareable.workflow.nodes as any[];

    return {
      shareId,
      name: shareable.workflow.name,
      description: shareable.workflow.description,
      nodeCount: nodes.length,
      authorName: shareable.user.name || 'Anonymous',
      createdAt: shareable.createdAt,
    };
  }

  /**
   * Import workflow
   */
  async importWorkflow(shareId: string, tenantId: string, userId: string): Promise<Workflow> {
    const shareable = await this.prisma.shareableWorkflow.findUnique({
      where: { id: shareId },
      include: {
        workflow: true,
      },
    });

    if (!shareable) {
      throw new Error('Shared workflow not found');
    }

    const originalWorkflow = shareable.workflow;
    const originalNodes = originalWorkflow.nodes as any[];
    const originalEdges = originalWorkflow.edges as any[];

    // Create a mapping of old IDs to new IDs
    const idMap = new Map<string, string>();
    const newNodes = originalNodes.map((node) => {
      const newId = `${node.type.toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;
      idMap.set(node.id, newId);
      return {
        ...node,
        id: newId,
      };
    });

    const newEdges = originalEdges.map((edge) => {
      return {
        ...edge,
        id: `edge-${Math.random().toString(36).substr(2, 9)}`,
        source: idMap.get(edge.source) || edge.source,
        target: idMap.get(edge.target) || edge.target,
      };
    });

    const importedWorkflow = await this.prisma.workflow.create({
      data: {
        tenantId,
        name: `${originalWorkflow.name} (importado)`,
        description: originalWorkflow.description,
        nodes: newNodes as any,
        edges: newEdges as any,
        isActive: false,
      },
    });

    // Increment import count
    await this.prisma.shareableWorkflow.update({
      where: { id: shareId },
      data: {
        importCount: {
          increment: 1,
        },
      },
    });

    return this.mapToWorkflow(importedWorkflow);
  }

  /**
   * Get workflow share stats
   */
  async getWorkflowShareStats(tenantId: string, workflowId: string): Promise<any> {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, tenantId },
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const shareable = await this.prisma.shareableWorkflow.findFirst({
      where: { workflowId },
    });

    return shareable || null;
  }

  /**
   * Get workflow insights (funnel metrics)
   */
  async getWorkflowInsights(
    tenantId: string,
    workflowId: string,
    from?: string,
    to?: string,
    compareFrom?: string,
    compareTo?: string,
  ): Promise<any> {
    const workflow = await this.getWorkflow(tenantId, workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const startDate = from ? new Date(from) : new Date(0);
    const endDate = to ? new Date(to) : new Date();

    // 1. Get main period stats
    const mainStats = await this.calculateFunnelStats(workflowId, startDate, endDate);

    // 2. Get comparison period stats if requested
    let comparisonStats = null;
    if (compareFrom && compareTo) {
      comparisonStats = await this.calculateFunnelStats(
        workflowId,
        new Date(compareFrom),
        new Date(compareTo),
      );
    }

    // 3. Find node with highest drop-off
    let highestDropOffNode = null;
    let maxDropOffRate = -1;

    mainStats.nodes.forEach((node: any, index: number) => {
      if (index > 0) {
        const prevNode = mainStats.nodes[index - 1];
        if (prevNode.count > 0) {
          const dropOffRate = (prevNode.count - node.count) / prevNode.count;
          if (dropOffRate > maxDropOffRate) {
            maxDropOffRate = dropOffRate;
            highestDropOffNode = node.name;
          }
        }
      }
    });

    // 4. Find best hour for conversion (simplified: based on execution starts)
    const executions = await this.prisma.workflowExecution.findMany({
      where: {
        workflowId,
        startedAt: { gte: startDate, lte: endDate },
      },
      select: { startedAt: true },
    });

    const hourCounts: Record<number, number> = {};
    executions.forEach((ex) => {
      const hour = new Date(ex.startedAt).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    let bestHour = 0;
    let maxHourCount = 0;
    Object.entries(hourCounts).forEach(([hour, count]) => {
      if (count > maxHourCount) {
        maxHourCount = count;
        bestHour = parseInt(hour);
      }
    });

    return {
      summary: {
        totalLeads: mainStats.totalLeads,
        conversionRate: mainStats.totalLeads > 0 ? (mainStats.conversions / mainStats.totalLeads) * 100 : 0,
        highestDropOffNode,
        bestTime: `${bestHour}:00`,
      },
      nodes: mainStats.nodes,
      comparison: comparisonStats ? {
        summary: {
          totalLeads: comparisonStats.totalLeads,
          conversionRate: comparisonStats.totalLeads > 0 ? (comparisonStats.conversions / comparisonStats.totalLeads) * 100 : 0,
        },
        nodes: comparisonStats.nodes,
      } : null,
      updatedAt: workflow.updatedAt,
    };
  }

  private async calculateFunnelStats(workflowId: string, from: Date, to: Date) {
    // Get all executions for this workflow in the period
    const executions = await this.prisma.workflowExecution.findMany({
      where: {
        workflowId,
        startedAt: { gte: from, lte: to },
      },
      select: { id: true, status: true },
    });

    const executionIds = executions.map((e) => e.id);
    const totalLeads = executionIds.length;

    // Get workflow nodes to build the funnel in order
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { nodes: true, edges: true },
    });

    if (!workflow) return { totalLeads: 0, conversions: 0, nodes: [] };

    const nodes = workflow.nodes as any[];
    const edges = workflow.edges as any[];

    // Find trigger node and build sequence
    const triggerNode = nodes.find(n => n.type.startsWith('TRIGGER_'));
    if (!triggerNode) return { totalLeads: 0, conversions: 0, nodes: [] };

    const sequence: any[] = [];
    let curr: any = triggerNode;
    const visited = new Set();

    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      sequence.push(curr);
      const edge = edges.find(e => e.source === curr.id);
      curr = edge ? nodes.find(n => n.id === edge.target) : null;
    }

    // Get execution logs for these executions to count reach for each node
    const nodeReach = await this.prisma.executionLog.groupBy({
      by: ['nodeId'],
      where: {
        executionId: { in: executionIds },
        eventType: 'node.executed',
      },
      _count: { executionId: true },
    });

    const reachMap = new Map(nodeReach.map(r => [r.nodeId, r._count.executionId]));

    const nodeStats = sequence.map((node, index) => {
      const count = reachMap.get(node.id) || 0;
      const prevCount = index > 0 ? reachMap.get(sequence[index - 1].id) || 0 : totalLeads;

      return {
        id: node.id,
        name: node.data?.label || node.name || node.type,
        type: node.type,
        count,
        conversionRate: prevCount > 0 ? (count / prevCount) * 100 : 0,
        dropOffRate: prevCount > 0 ? ((prevCount - count) / prevCount) * 100 : 0,
      };
    });

    const conversions = nodes.filter(n => n.type === 'END').reduce((acc, node) => acc + (reachMap.get(node.id) || 0), 0);

    return {
      totalLeads,
      conversions,
      nodes: nodeStats,
    };
  }
}

