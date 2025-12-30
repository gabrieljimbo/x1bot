import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WorkflowNode,
  WorkflowNodeType,
  ExecutionContext,
  SendMessageConfig,
  SendMediaConfig,
  SendButtonsConfig,
  SendListConfig,
  ConditionConfig,
  WaitReplyConfig,
  WaitConfig,
  EndConfig,
  HttpRequestConfig,
  ManageLabelsConfig,
  CodeConfig,
  EditFieldsConfig,
  SetTagsConfig,
} from '@n9n/shared';
import { ContextService } from './context.service';
import { ContactTagsService } from './contact-tags.service';

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
    message?: string;
    media?: {
      type: 'image' | 'video' | 'audio' | 'document';
      url: string;
      caption?: string;
      fileName?: string;
      sendAudioAsVoice?: boolean;
    };
  };
}

@Injectable()
export class NodeExecutorService {
  private whatsappSessionManager: any;

  constructor(
    private contextService: ContextService,
    private configService: ConfigService,
    private contactTagsService: ContactTagsService,
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

      case WorkflowNodeType.SEND_MEDIA:
        return this.executeSendMedia(node, context, edges, sessionId, contactId);

      case WorkflowNodeType.SEND_BUTTONS:
        return this.executeSendButtons(node, context, edges, sessionId, contactId);

      case WorkflowNodeType.SEND_LIST:
        return this.executeSendList(node, context, edges, sessionId, contactId);

      case WorkflowNodeType.HTTP_REQUEST:
        return this.executeHttpRequest(node, context, edges);

      case WorkflowNodeType.CODE:
        return this.executeCode(node, context, edges);

      case WorkflowNodeType.EDIT_FIELDS:
        return this.executeEditFields(node, context, edges);

      case WorkflowNodeType.MANAGE_LABELS:
        return this.executeManageLabels(node, context, edges, sessionId, contactId);

      case WorkflowNodeType.CONDITION:
        return this.executeCondition(node, context, edges);

      case WorkflowNodeType.SWITCH:
        return this.executeSwitch(node, context, edges);

      case WorkflowNodeType.WAIT_REPLY:
        return this.executeWaitReply(node, context, edges);

      case WorkflowNodeType.WAIT:
        return this.executeWait(node, context, edges);

      case WorkflowNodeType.SET_TAGS:
        return await this.executeSetTags(node, context, edges, sessionId, contactId);

      case WorkflowNodeType.END:
        return this.executeEnd(node, context);

      default:
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
   * Execute SEND_MEDIA node
   */
  private async executeSendMedia(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    sessionId?: string,
    contactId?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as SendMediaConfig;

    // Interpolate media URL and caption
    const mediaUrl = this.contextService.interpolate(config.mediaUrl, context);
    const caption = config.caption ? this.contextService.interpolate(config.caption, context) : undefined;
    const fileName = config.fileName ? this.contextService.interpolate(config.fileName, context) : undefined;

    // Store in output
    this.contextService.setOutput(context, { 
      mediaUrl, 
      mediaType: config.mediaType,
      caption,
      fileName,
      sendAudioAsVoice: config.sendAudioAsVoice,
    });

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
        media: {
          type: config.mediaType,
          url: mediaUrl,
          caption,
          fileName,
          sendAudioAsVoice: config.sendAudioAsVoice || false,
        },
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

    // Check if expression uses string methods with multiple values
    let result = false;
    const expression = config.expression || '';
    
    console.log('[executeCondition] Expression:', expression);
    
    // Match patterns like: value.toLowerCase().includes("word1, word2, word3".toLowerCase())
    // or: value.includes("word1, word2, word3")
    const multiValueMatch = expression.match(/(.+?)\.(includes|startsWith|endsWith)\("([^"]+)"(?:\.toLowerCase\(\))?\)/);
    
    console.log('[executeCondition] Regex match:', multiValueMatch);
    
    if (multiValueMatch && multiValueMatch[3].includes(',')) {
      // Multiple values detected - check each one
      const [, value1, operator, value2String] = multiValueMatch;
      const values = value2String.split(',').map(v => v.trim());
      
      console.log('[executeCondition] Multiple values detected:', values);
      
      for (const value of values) {
        const singleExpression = `${value1}.${operator}("${value}")`;
        console.log('[executeCondition] Testing:', singleExpression);
        result = this.contextService.evaluateExpression(singleExpression, context);
        console.log('[executeCondition] Result:', result);
        if (result) break; // Stop at first match
      }
    } else {
      // Single value or non-string operator - evaluate normally
      console.log('[executeCondition] Single value, evaluating normally');
      result = this.contextService.evaluateExpression(expression, context);
    }

    this.contextService.setOutput(context, { conditionResult: result });

    const nextEdge = edges.find(
      (e) => e.source === node.id && (
        e.condition === (result ? 'true' : 'false') ||
        e.label === (result ? 'true' : 'false')
      ),
    );

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

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      
      let result = false;
      
      if (rule.operator.includes('(')) {
        // For string methods like includes(), support multiple values separated by comma
        const values = rule.value2.split(',').map((v: string) => v.trim().toLowerCase());
        
        // Check if any of the values match
        for (const value of values) {
          const expression = `${rule.value1}.toLowerCase()${rule.operator}"${value}")`;
          result = this.contextService.evaluateExpression(expression, context);
          if (result) break; // Stop at first match
        }
      } else {
        // For comparison operators, use single value
        const expression = `${rule.value1} ${rule.operator} ${rule.value2}`;
        result = this.contextService.evaluateExpression(expression, context);
      }

      if (result) {
        const nextEdge = edges.find(
          (e) => e.source === node.id && e.condition === rule.outputKey,
        );

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
    const defaultEdge = edges.find(
      (e) => e.source === node.id && e.condition === 'default',
    );
    
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
   * Execute EDIT_FIELDS node
   */
  private executeEditFields(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
  ): NodeExecutionResult {
    const config = node.config as EditFieldsConfig;

    try {
      let result: any = {};

      if (config.mode === 'json') {
        // JSON mode: parse and interpolate the JSON string
        const interpolatedJson = this.contextService.interpolate(
          config.jsonData || '{}',
          context,
        );
        result = JSON.parse(interpolatedJson);
      } else {
        // Fields mode: process each operation
        const operations = config.operations || [];
        
        // Start with input data if includeOtherFields is true
        if (config.includeOtherFields !== false) {
          result = { ...(context.output || {}) };
        }

        // Apply each field operation
        operations.forEach((operation) => {
          const fieldName = operation.name;
          
          console.log('[EDIT_FIELDS] Processing field:', fieldName);
          console.log('[EDIT_FIELDS] Raw value:', operation.value);
          console.log('[EDIT_FIELDS] Context variables:', JSON.stringify(context.variables, null, 2));
          
          let fieldValue: any = this.contextService.interpolate(
            operation.value,
            context,
          );
          
          console.log('[EDIT_FIELDS] Interpolated value:', fieldValue);

          // Convert to the specified type
          switch (operation.type) {
            case 'number':
              fieldValue = Number(fieldValue);
              break;
            case 'boolean':
              fieldValue = fieldValue === 'true' || fieldValue === true;
              break;
            case 'json':
              try {
                fieldValue = JSON.parse(fieldValue);
              } catch (e) {
                console.warn(`[EDIT_FIELDS] Failed to parse JSON for field ${fieldName}:`, e);
              }
              break;
            // 'string' is default, no conversion needed
          }

          result[fieldName] = fieldValue;
        });
      }

      // Set output
      this.contextService.setOutput(context, result);

      // Find next node
      const nextEdge = edges.find((e) => e.source === node.id);
      const nextNodeId = nextEdge ? nextEdge.target : null;

      return {
        nextNodeId,
        shouldWait: false,
        output: result,
      };
    } catch (error) {
      console.error('[EDIT_FIELDS] Error:', error);
      throw new Error(`Edit Fields failed: ${error.message}`);
    }
  }

  /**
   * Execute CODE node
   */
  private executeCode(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
  ): NodeExecutionResult {
    const config = node.config as CodeConfig;

    try {
      // Prepare the execution context for the code
      const variables = context.variables || {};
      const globals = context.globals || {};
      const input = context.input || {};

      // Create a safe execution function
      const executeUserCode = new Function('variables', 'globals', 'input', config.code);

      // Execute the code
      const result = executeUserCode(variables, globals, input);

      // Save result to context
      this.contextService.setVariable(context, 'codeOutput', result);

      // Set output
      this.contextService.setOutput(context, { codeOutput: result });

      // Find next node
      const nextEdge = edges.find((e) => e.source === node.id);
      const nextNodeId = nextEdge ? nextEdge.target : null;

      return {
        nextNodeId,
        shouldWait: false,
        output: { codeOutput: result },
      };
    } catch (error) {
      console.error('[CODE] Error executing code:', error);
      
      // Save error to context
      const errorResult = {
        error: true,
        message: error.message,
        name: error.name,
      };
      
      this.contextService.setVariable(context, 'codeOutput', errorResult);
      this.contextService.setOutput(context, { codeOutput: errorResult });

      // Continue to next node even on error
      const nextEdge = edges.find((e) => e.source === node.id);
      const nextNodeId = nextEdge ? nextEdge.target : null;

      return {
        nextNodeId,
        shouldWait: false,
        output: { codeOutput: errorResult },
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
    } else if (listMapping && listMapping[message]) {
      finalValue = listMapping[message];
    }

    // Save reply to variable
    this.contextService.setVariable(context, config.saveAs, finalValue);
    
    // Also save the raw message
    this.contextService.setVariable(context, `${config.saveAs}_raw`, message);
  }

  /**
   * Execute WAIT node - pause execution for a specified time
   */
  private executeWait(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
  ): NodeExecutionResult {
    const config = node.config as WaitConfig;
    const nextEdge = edges.find((e) => e.source === node.id);

    // Default values
    const amount = config.amount || 1;
    const unit = config.unit || 'seconds';

    // Convert wait time to milliseconds
    let waitMs = 0;
    switch (unit) {
      case 'seconds':
        waitMs = amount * 1000;
        break;
      case 'minutes':
        waitMs = amount * 60 * 1000;
        break;
      case 'hours':
        waitMs = amount * 60 * 60 * 1000;
        break;
      case 'days':
        waitMs = amount * 24 * 60 * 60 * 1000;
        break;
      default:
        waitMs = amount * 1000; // Default to seconds
    }

    console.log(`[WAIT] Pausing execution for ${amount} ${unit} (${waitMs}ms)`);

    // Schedule continuation using setTimeout
    // Note: In production, you'd want to use a job queue (Bull, Agenda, etc.)
    // For now, we'll use a simple setTimeout approach
    
    return {
      nextNodeId: nextEdge?.target || null,
      shouldWait: true,
      waitTimeoutSeconds: Math.ceil(waitMs / 1000),
      output: {
        waitedFor: `${amount} ${unit}`,
        waitStartedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Execute SET_TAGS node - manage internal contact tags
   */
  private async executeSetTags(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    sessionId?: string,
    contactId?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as SetTagsConfig;
    console.log('[SET_TAGS] Node config:', JSON.stringify(config, null, 2));

    if (!sessionId || !contactId) {
      console.error('[SET_TAGS] Missing sessionId or contactId');
      const nextEdge = edges.find((e) => e.source === node.id);
      return {
        nextNodeId: nextEdge?.target || null,
        shouldWait: false,
        output: { error: 'Missing sessionId or contactId' },
      };
    }

    const tenantId = context.globals?.tenantId || 'demo-tenant';
    let resultTags: string[] = [];

    try {
      console.log('[SET_TAGS] Action:', config.action, 'Tags:', config.tags);
      switch (config.action) {
        case 'add':
          resultTags = await this.contactTagsService.addTags(
            tenantId,
            sessionId,
            contactId,
            config.tags || [],
          );
          console.log(`[SET_TAGS] Added tags to ${contactId}:`, config.tags);
          break;

        case 'remove':
          resultTags = await this.contactTagsService.removeTags(
            tenantId,
            sessionId,
            contactId,
            config.tags || [],
          );
          console.log(`[SET_TAGS] Removed tags from ${contactId}:`, config.tags);
          break;

        case 'set':
          resultTags = await this.contactTagsService.setTags(
            tenantId,
            sessionId,
            contactId,
            config.tags || [],
          );
          console.log(`[SET_TAGS] Set tags for ${contactId}:`, config.tags);
          break;

        case 'clear':
          await this.contactTagsService.clearTags(tenantId, sessionId, contactId);
          resultTags = [];
          console.log(`[SET_TAGS] Cleared all tags for ${contactId}`);
          break;

        default:
          console.error('[SET_TAGS] Unknown action:', config.action);
      }

      // Update context with new tags
      this.contextService.setVariable(context, 'contactTags', resultTags);
      this.contextService.setOutput(context, { contactTags: resultTags });

      // Find next node
      const nextEdge = edges.find((e) => e.source === node.id);
      const nextNodeId = nextEdge ? nextEdge.target : null;

      return {
        nextNodeId,
        shouldWait: false,
        output: { contactTags: resultTags },
      };
    } catch (error) {
      console.error('[SET_TAGS] Error:', error);
      const nextEdge = edges.find((e) => e.source === node.id);
      return {
        nextNodeId: nextEdge?.target || null,
        shouldWait: false,
        output: { error: error.message, contactTags: resultTags },
      };
    }
  }
}

