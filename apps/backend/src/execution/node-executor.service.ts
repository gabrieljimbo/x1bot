import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WorkflowNode,
  WorkflowNodeType,
  ExecutionContext,
  SendMessageConfig,
  ConditionConfig,
  WaitReplyConfig,
  EndConfig,
} from '@n9n/shared';
import { ContextService } from './context.service';

export interface NodeExecutionResult {
  nextNodeId: string | null;
  shouldWait: boolean;
  waitTimeoutSeconds?: number;
  onTimeout?: 'END' | 'GOTO_NODE';
  timeoutTargetNodeId?: string;
  output?: Record<string, any>;
  messageToSend?: {
    sessionId: string;
    contactId: string;
    message: string;
  };
}

@Injectable()
export class NodeExecutorService {
  constructor(
    private contextService: ContextService,
    private configService: ConfigService,
  ) {}

  /**
   * Execute a node and return the result
   */
  async executeNode(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    sessionId?: string,
    contactId?: string,
  ): Promise<NodeExecutionResult> {
    switch (node.type) {
      case WorkflowNodeType.SEND_MESSAGE:
        return this.executeSendMessage(node, context, edges, sessionId, contactId);

      case WorkflowNodeType.CONDITION:
        return this.executeCondition(node, context, edges);

      case WorkflowNodeType.SWITCH:
        return this.executeSwitch(node, context, edges);

      case WorkflowNodeType.WAIT_REPLY:
        return this.executeWaitReply(node, context, edges);

      case WorkflowNodeType.END:
        return this.executeEnd(node, context);

      default:
        console.error('[NODE_EXECUTOR] Unknown node type!');
        console.error('[NODE_EXECUTOR] Node object:', JSON.stringify(node, null, 2));
        console.error('[NODE_EXECUTOR] Node type:', node.type);
        console.error('[NODE_EXECUTOR] Node type (typeof):', typeof node.type);
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  /**
   * Execute SEND_MESSAGE node
   */
  private async executeSendMessage(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    sessionId?: string,
    contactId?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as SendMessageConfig;

    // Interpolate message with variables
    const message = this.contextService.interpolate(config.message, context);

    // Store message in output
    this.contextService.setOutput(context, { message });

    // Add delay if configured
    if (config.delay) {
      await new Promise((resolve) => setTimeout(resolve, config.delay));
    }

    // Find next node
    const nextEdge = edges.find((e) => e.source === node.id);
    const nextNodeId = nextEdge ? nextEdge.target : null;

    return {
      nextNodeId,
      shouldWait: false,
      messageToSend: sessionId && contactId ? {
        sessionId,
        contactId,
        message,
      } : undefined,
    };
  }

  /**
   * Execute CONDITION node
   */
  private executeCondition(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
  ): NodeExecutionResult {
    const config = node.config as ConditionConfig;

    // Evaluate expression
    const result = this.contextService.evaluateExpression(config.expression, context);

    console.log('[CONDITION] Node:', node.id);
    console.log('[CONDITION] Expression:', config.expression);
    console.log('[CONDITION] Result:', result);
    console.log('[CONDITION] Context variables:', context.variables);

    // Store result in output
    this.contextService.setOutput(context, { conditionResult: result });

    // Find next node based on condition
    // Check both 'condition' field and 'label' field for backward compatibility
    const nextEdge = edges.find(
      (e) => e.source === node.id && (
        e.condition === (result ? 'true' : 'false') ||
        e.label === (result ? 'true' : 'false')
      ),
    );

    console.log('[CONDITION] Looking for edge with condition:', result ? 'true' : 'false');
    console.log('[CONDITION] Available edges:', edges.filter(e => e.source === node.id));
    console.log('[CONDITION] Selected edge:', nextEdge);

    const nextNodeId = nextEdge ? nextEdge.target : null;

    return {
      nextNodeId,
      shouldWait: false,
    };
  }

  /**
   * Execute SWITCH node (multiple routing rules)
   */
  private executeSwitch(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
  ): NodeExecutionResult {
    const config = node.config as any; // SwitchConfig
    const rules = config.rules || [];

    console.log('[SWITCH] Node:', node.id);
    console.log('[SWITCH] Rules:', rules.length);
    console.log('[SWITCH] Context variables:', context.variables);

    // Evaluate each rule in order
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      
      // Build expression from rule
      let expression = '';
      if (rule.operator.includes('(')) {
        // For methods like includes, startsWith, endsWith
        expression = `${rule.value1}${rule.operator}"${rule.value2}")`;
      } else {
        expression = `${rule.value1} ${rule.operator} ${rule.value2}`;
      }

      console.log(`[SWITCH] Evaluating rule ${i}:`, expression);

      // Evaluate the expression
      const result = this.contextService.evaluateExpression(expression, context);
      console.log(`[SWITCH] Rule ${i} result:`, result);

      if (result) {
        // Find edge with matching outputKey
        const nextEdge = edges.find(
          (e) => e.source === node.id && e.condition === rule.outputKey,
        );

        console.log(`[SWITCH] Rule ${i} matched! Looking for edge with condition:`, rule.outputKey);
        console.log('[SWITCH] Available edges:', edges.filter(e => e.source === node.id));
        console.log('[SWITCH] Selected edge:', nextEdge);

        const nextNodeId = nextEdge ? nextEdge.target : null;

        // Store which rule matched
        this.contextService.setOutput(context, {
          switchOutput: rule.outputKey,
          switchRuleIndex: i,
        });

        return {
          nextNodeId,
          shouldWait: false,
        };
      }
    }

    // No rule matched - use default output
    console.log('[SWITCH] No rules matched, using default output');
    
    const defaultEdge = edges.find(
      (e) => e.source === node.id && e.condition === 'default',
    );
    
    console.log('[SWITCH] Looking for default edge');
    console.log('[SWITCH] Available edges:', edges.filter(e => e.source === node.id));
    console.log('[SWITCH] Default edge:', defaultEdge);
    
    const nextNodeId = defaultEdge ? defaultEdge.target : null;
    
    this.contextService.setOutput(context, { 
      switchOutput: 'default',
      switchRuleIndex: -1,
    });

    return {
      nextNodeId,
      shouldWait: false,
    };
  }

  /**
   * Execute WAIT_REPLY node
   */
  private executeWaitReply(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
  ): NodeExecutionResult {
    const config = node.config as WaitReplyConfig;

    const timeoutSeconds =
      config.timeoutSeconds ||
      this.configService.get('WAIT_REPLY_DEFAULT_TIMEOUT_SECONDS', 300);

    // Find next node (will be used when resumed)
    const nextEdge = edges.find((e) => e.source === node.id);
    const nextNodeId = nextEdge ? nextEdge.target : null;

    return {
      nextNodeId,
      shouldWait: true,
      waitTimeoutSeconds: timeoutSeconds,
      onTimeout: config.onTimeout,
      timeoutTargetNodeId: config.timeoutTargetNodeId,
    };
  }

  /**
   * Execute END node
   */
  private executeEnd(node: WorkflowNode, context: ExecutionContext): NodeExecutionResult {
    const config = node.config as EndConfig;

    // Prepare final output
    const output: Record<string, any> = {};

    if (config.outputVariables) {
      config.outputVariables.forEach((varName) => {
        output[varName] = this.contextService.getVariable(context, varName);
      });
    }

    this.contextService.setOutput(context, output);

    return {
      nextNodeId: null,
      shouldWait: false,
      output,
    };
  }

  /**
   * Process user reply for WAIT_REPLY node
   */
  processReply(
    node: WorkflowNode,
    message: string,
    context: ExecutionContext,
  ): void {
    const config = node.config as WaitReplyConfig;

    // Save reply to variable
    this.contextService.setVariable(context, config.saveAs, message);
  }
}

