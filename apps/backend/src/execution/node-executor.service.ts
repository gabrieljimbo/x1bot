import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WorkflowNode,
  WorkflowNodeType,
  ExecutionContext,
  SendMessageConfig,
  SendButtonsConfig,
  SendListConfig,
  ConditionConfig,
  WaitReplyConfig,
  EndConfig,
  HttpRequestConfig,
  ManageLabelsConfig,
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
  private whatsappSessionManager: any;

  constructor(
    private contextService: ContextService,
    private configService: ConfigService,
  ) {}

  setWhatsappSessionManager(manager: any) {
    this.whatsappSessionManager = manager;
  }

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

      case WorkflowNodeType.SEND_BUTTONS:
        return this.executeSendButtons(node, context, edges, sessionId, contactId);

      case WorkflowNodeType.SEND_LIST:
        return this.executeSendList(node, context, edges, sessionId, contactId);

      case WorkflowNodeType.HTTP_REQUEST:
        return this.executeHttpRequest(node, context, edges);

      case WorkflowNodeType.MANAGE_LABELS:
        return this.executeManageLabels(node, context, edges, sessionId, contactId);

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
   * Execute SEND_BUTTONS node
   */
  private async executeSendButtons(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    sessionId?: string,
    contactId?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as SendButtonsConfig;

    // Interpolate message
    const message = this.contextService.interpolate(config.message, context);
    const footer = config.footer ? this.contextService.interpolate(config.footer, context) : undefined;

    // Interpolate button texts
    const buttons = config.buttons.map(btn => ({
      id: btn.id,
      text: this.contextService.interpolate(btn.text, context),
    }));

    // Store button mapping for later reference (text -> id and number -> id)
    const buttonMapping: Record<string, string> = {};
    buttons.forEach((btn, index) => {
      buttonMapping[btn.text] = btn.id; // Map text to ID (for polls)
      buttonMapping[String(index + 1)] = btn.id; // Map number to ID (for fallback)
    });
    this.contextService.setVariable(context, '_buttonMapping', buttonMapping);

    // Store in output
    this.contextService.setOutput(context, { message, buttons, footer });

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
      output: { message, buttons, footer },
      messageToSend: sessionId && contactId ? {
        sessionId,
        contactId,
        message: JSON.stringify({ type: 'buttons', message, buttons, footer }),
      } : undefined,
    };
  }

  /**
   * Execute SEND_LIST node
   */
  private async executeSendList(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    sessionId?: string,
    contactId?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as SendListConfig;

    // Interpolate message
    const message = this.contextService.interpolate(config.message, context);
    const buttonText = this.contextService.interpolate(config.buttonText, context);
    const footer = config.footer ? this.contextService.interpolate(config.footer, context) : undefined;

    // Interpolate sections
    const sections = config.sections.map(section => ({
      title: this.contextService.interpolate(section.title, context),
      rows: section.rows.map(row => ({
        id: row.id,
        title: this.contextService.interpolate(row.title, context),
        description: row.description ? this.contextService.interpolate(row.description, context) : undefined,
      })),
    }));

    // Store list mapping for later reference (number -> id)
    const listMapping: Record<string, string> = {};
    let optionNumber = 1;
    sections.forEach(section => {
      section.rows.forEach(row => {
        listMapping[String(optionNumber)] = row.id;
        optionNumber++;
      });
    });
    this.contextService.setVariable(context, '_listMapping', listMapping);

    // Store in output
    this.contextService.setOutput(context, { message, buttonText, sections, footer });

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
      output: { message, buttonText, sections, footer },
      messageToSend: sessionId && contactId ? {
        sessionId,
        contactId,
        message: JSON.stringify({ type: 'list', message, buttonText, sections, footer }),
      } : undefined,
    };
  }

  /**
   * Execute MANAGE_LABELS node
   */
  private async executeManageLabels(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    sessionId?: string,
    contactId?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as ManageLabelsConfig;
    const action = config.action || 'add'; // Default to 'add' if not specified

    if (!sessionId || !contactId) {
      throw new Error('Session ID and Contact ID are required for MANAGE_LABELS node');
    }

    if (!this.whatsappSessionManager) {
      throw new Error('WhatsApp Session Manager not initialized');
    }


    try {
      if (action === 'list') {
        // Get current chat labels
        const chatLabels = await this.whatsappSessionManager.getChatLabels(sessionId, contactId);
        const saveAs = config.saveLabelsAs || 'chatLabels';
        this.contextService.setVariable(context, saveAs, chatLabels);
        
      } else if (action === 'add') {
        // Add labels
        if (config.labelIds && config.labelIds.length > 0) {
          await this.whatsappSessionManager.addLabels(sessionId, contactId, config.labelIds);
        }
      } else if (action === 'remove') {
        // Remove labels
        if (config.labelIds && config.labelIds.length > 0) {
          await this.whatsappSessionManager.removeLabels(sessionId, contactId, config.labelIds);
        }
      }

      // Find next node
      const nextEdge = edges.find((e) => e.source === node.id);
      const nextNodeId = nextEdge ? nextEdge.target : null;

      return {
        nextNodeId,
        shouldWait: false,
      };
    } catch (error) {
      console.error('[MANAGE_LABELS] Error:', error);
      throw error;
    }
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
   * Execute HTTP_REQUEST node
   */
  private async executeHttpRequest(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
  ): Promise<NodeExecutionResult> {
    const config = node.config as HttpRequestConfig;

    // Interpolate URL
    const url = this.contextService.interpolate(config.url, context);

    // Prepare headers
    const headers: Record<string, string> = {};
    
    // Add custom headers
    if (config.headers) {
      config.headers.forEach((h) => {
        if (h.key && h.value) {
          headers[h.key] = this.contextService.interpolate(h.value, context);
        }
      });
    }

    // Add authentication headers
    if (config.authentication === 'bearer' && config.authConfig?.token) {
      headers['Authorization'] = `Bearer ${this.contextService.interpolate(config.authConfig.token, context)}`;
    } else if (config.authentication === 'header' && config.authConfig?.headerName && config.authConfig?.headerValue) {
      headers[config.authConfig.headerName] = this.contextService.interpolate(config.authConfig.headerValue, context);
    }

    // Prepare query params
    let finalUrl = url;
    if (config.queryParams && config.queryParams.length > 0) {
      const params = new URLSearchParams();
      config.queryParams.forEach((p) => {
        if (p.key && p.value) {
          params.append(p.key, this.contextService.interpolate(p.value, context));
        }
      });
      finalUrl = `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;
    }

    // Prepare body
    let body: any = undefined;
    if (config.body && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
      const interpolatedBody = this.contextService.interpolate(config.body, context);
      
      if (config.bodyType === 'json') {
        try {
          body = JSON.parse(interpolatedBody);
          headers['Content-Type'] = 'application/json';
        } catch (e) {
          console.error('[HTTP_REQUEST] Failed to parse JSON body:', e);
          throw new Error('Invalid JSON body');
        }
      } else {
        body = interpolatedBody;
      }
    }

    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method: config.method,
      headers,
      redirect: config.followRedirects !== false ? 'follow' : 'manual',
    };

    if (body !== undefined) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    // Add basic auth
    if (config.authentication === 'basic' && config.authConfig?.username && config.authConfig?.password) {
      const credentials = Buffer.from(
        `${config.authConfig.username}:${config.authConfig.password}`
      ).toString('base64');
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Authorization': `Basic ${credentials}`,
      };
    }

    console.log(`[HTTP_REQUEST] ${config.method} ${finalUrl}`);

    try {
      // Execute HTTP request with timeout
      const timeout = config.timeout || 30000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(finalUrl, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      const contentType = response.headers.get('content-type');
      let responseData: any;

      if (contentType?.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      // Prepare response object
      const httpResponse = {
        statusCode: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseData,
        ok: response.ok,
      };

      // Save response to context
      const saveAs = config.saveResponseAs || 'httpResponse';
      this.contextService.setVariable(context, saveAs, httpResponse);

      console.log(`[HTTP_REQUEST] Response: ${response.status} ${response.statusText}`);

      // Find next node
      const nextEdge = edges.find((e) => e.source === node.id);
      const nextNodeId = nextEdge ? nextEdge.target : null;

      return {
        nextNodeId,
        shouldWait: false,
        output: { [saveAs]: httpResponse },
      };
    } catch (error) {
      console.error('[HTTP_REQUEST] Error:', error);
      
      // Save error to context
      const saveAs = config.saveResponseAs || 'httpResponse';
      const errorResponse = {
        error: true,
        message: error.message,
        name: error.name,
      };
      
      this.contextService.setVariable(context, saveAs, errorResponse);

      // Continue to next node even on error
      const nextEdge = edges.find((e) => e.source === node.id);
      const nextNodeId = nextEdge ? nextEdge.target : null;

      return {
        nextNodeId,
        shouldWait: false,
        output: { [saveAs]: errorResponse },
      };
    }
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

    // Check if there's a button or list mapping
    const buttonMapping = this.contextService.getVariable(context, '_buttonMapping');
    const listMapping = this.contextService.getVariable(context, '_listMapping');
    
    let finalValue = message;
    
    // If user replied with a number and we have a mapping, convert it
    if (buttonMapping && buttonMapping[message]) {
      finalValue = buttonMapping[message];
      console.log(`[WAIT_REPLY] Converted button number ${message} to ID: ${finalValue}`);
    } else if (listMapping && listMapping[message]) {
      finalValue = listMapping[message];
      console.log(`[WAIT_REPLY] Converted list number ${message} to ID: ${finalValue}`);
    }

    // Save reply to variable
    this.contextService.setVariable(context, config.saveAs, finalValue);
    
    // Also save the raw message
    this.contextService.setVariable(context, `${config.saveAs}_raw`, message);
  }
}

