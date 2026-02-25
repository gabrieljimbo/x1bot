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
  HttpScrapeConfig,
  ManageLabelsConfig,
  CodeConfig,
  EditFieldsConfig,
  SetTagsConfig,
  LoopConfig,
  CommandConfig,
  PixRecognitionConfig,
} from '@n9n/shared';
import { ContextService } from './context.service';
import { ContactTagsService } from './contact-tags.service';
import { JSDOM } from 'jsdom';
import { exec } from 'child_process';
import { promisify } from 'util';

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
  ) { }

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

      case WorkflowNodeType.HTTP_SCRAPE:
        return this.executeHttpScrape(node, context, edges);

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

      case WorkflowNodeType.LOOP:
        return this.executeLoop(node, context, edges);

      case WorkflowNodeType.COMMAND:
      case 'COMMAND':
        return await this.executeCommand(node, context, edges);

      case WorkflowNodeType.PIX_RECOGNITION:
        return await this.executePixRecognition(node, context, edges);

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
    defaultSessionId?: string,
    defaultContactId?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as SendMessageConfig;

    // Interpolate message with variables
    const message = this.contextService.interpolate(config.message, context);

    // Determine session ID (config overrides default)
    const sessionId = config.sessionId || defaultSessionId;

    // Determine recipient (config overrides default)
    let contactId = defaultContactId;
    if (config.to) {
      contactId = this.contextService.interpolate(config.to, context);
    }

    // Store message in output
    this.contextService.setOutput(context, { message, sentTo: contactId, sessionId });

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
    defaultSessionId?: string,
    defaultContactId?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as SendMediaConfig;

    // Interpolate media URL and caption
    const mediaUrl = this.contextService.interpolate(config.mediaUrl, context);
    const caption = config.caption ? this.contextService.interpolate(config.caption, context) : undefined;
    const fileName = config.fileName ? this.contextService.interpolate(config.fileName, context) : undefined;

    // Determine session ID (config overrides default)
    const sessionId = config.sessionId || defaultSessionId;

    // Determine recipient (config overrides default)
    let contactId = defaultContactId;
    if (config.to) {
      contactId = this.contextService.interpolate(config.to, context);
    }

    // Store in output
    this.contextService.setOutput(context, {
      mediaUrl,
      mediaType: config.mediaType,
      caption,
      fileName,
      sendAudioAsVoice: config.sendAudioAsVoice,
      sentTo: contactId,
      sessionId,
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
    } catch (error: any) {
      console.error('[MANAGE_LABELS] Error:', error);

      if (error.message?.includes('ACCOUNT_NOT_BUSINESS')) {
        // Log specifically but don't crash the whole workflow if not critical
        // For now, we wrap the error for clarity
        throw new Error(`WhatsApp Labels failed: Connected account is not a Business account. Labels are not supported.`);
      }

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

    // Match patterns like: value.toLowerCase().includes("word1, word2, word3".toLowerCase())
    // or: value.includes("word1, word2, word3")
    const multiValueMatch = expression.match(/(.+?)\.(includes|startsWith|endsWith)\("([^"]+)"(?:\.toLowerCase\(\))?\)/);

    if (multiValueMatch && multiValueMatch[3].includes(',')) {
      // Multiple values detected - check each one
      const [, value1, operator, value2String] = multiValueMatch;
      const values = value2String.split(',').map(v => v.trim());

      for (const value of values) {
        const singleExpression = `${value1}.${operator}("${value}")`;
        result = this.contextService.evaluateExpression(singleExpression, context);
        if (result) break; // Stop at first match
      }
    } else {
      // Single value or non-string operator - evaluate normally
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
   * Execute COMMAND node
   */
  private async executeCommand(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
  ): Promise<NodeExecutionResult> {
    const config = node.config as CommandConfig;

    // Interpolate command (can include full command with arguments)
    const fullCommand = this.contextService.interpolate(config.command, context);

    // Set timeout (default 30 seconds)
    const timeout = config.timeout || 30000;

    // Execute command
    const execAsync = promisify(exec);

    try {
      const options: any = {
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB max output
      };

      const { stdout, stderr } = await execAsync(fullCommand, options);

      // Save outputs to context variables
      const outputVarName = config.saveOutputAs || 'commandOutput';
      const errorVarName = config.saveErrorAs || 'commandError';
      const exitCodeVarName = config.saveExitCodeAs || 'commandExitCode';

      this.contextService.setVariable(context, outputVarName, stdout);
      this.contextService.setVariable(context, errorVarName, stderr || '');
      this.contextService.setVariable(context, exitCodeVarName, 0);

      // Store in output
      this.contextService.setOutput(context, {
        stdout,
        stderr: stderr || '',
        exitCode: 0,
        command: fullCommand,
      });

      // Find next node
      const nextEdge = edges.find((e) => e.source === node.id);
      const nextNodeId = nextEdge ? nextEdge.target : null;

      return {
        nextNodeId,
        shouldWait: false,
        output: {
          stdout,
          stderr: stderr || '',
          exitCode: 0,
          command: fullCommand,
        },
      };
    } catch (error: any) {
      // Handle timeout or other errors
      const exitCode = error.code === 'ETIMEDOUT' ? -1 : error.code || 1;
      const stderr = error.stderr || error.message || '';
      const stdout = error.stdout || '';

      // Save outputs to context variables
      const outputVarName = config.saveOutputAs || 'commandOutput';
      const errorVarName = config.saveErrorAs || 'commandError';
      const exitCodeVarName = config.saveExitCodeAs || 'commandExitCode';

      this.contextService.setVariable(context, outputVarName, stdout);
      this.contextService.setVariable(context, errorVarName, stderr);
      this.contextService.setVariable(context, exitCodeVarName, exitCode);

      // Store in output
      this.contextService.setOutput(context, {
        stdout,
        stderr,
        exitCode,
        command: fullCommand,
        error: error.message,
      });

      // Find next node
      const nextEdge = edges.find((e) => e.source === node.id);
      const nextNodeId = nextEdge ? nextEdge.target : null;

      return {
        nextNodeId,
        shouldWait: false,
        output: {
          stdout,
          stderr,
          exitCode,
          command: fullCommand,
          error: error.message,
        },
      };
    }
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
   * Execute HTTP_SCRAPE node
   */
  private async executeHttpScrape(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
  ): Promise<NodeExecutionResult> {
    const config = node.config as HttpScrapeConfig;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteer = require('puppeteer');

    // Interpolate URL
    const url = this.contextService.interpolate(config.url, context);

    let browser: any = null;
    let page: any = null;

    try {
      // Launch browser with better stealth settings and resource limits
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--disable-gpu',
          '--disable-features=IsolateOrigins,site-per-process',
          '--single-process', // Reduce memory usage
          '--no-zygote', // Reduce memory usage
        ],
        timeout: 30000, // 30s timeout for launch
      });

      page = await browser.newPage();

      // Set resource limits
      await page.setDefaultNavigationTimeout(60000);
      await page.setDefaultTimeout(30000);

      // Set default user agent to avoid detection
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Set viewport if configured, otherwise use default
      await page.setViewport({
        width: config.viewport?.width || 1920,
        height: config.viewport?.height || 1080,
      });

      // Set default headers to mimic a real browser
      const defaultHeaders: Record<string, string> = {
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
      };

      // Merge with custom headers if provided
      if (config.headers && config.headers.length > 0) {
        config.headers.forEach((h) => {
          if (h.key && h.value) {
            defaultHeaders[h.key] = this.contextService.interpolate(h.value, context);
          }
        });
      }

      await page.setExtraHTTPHeaders(defaultHeaders);

      // Navigate to URL
      const timeout = config.timeout || 60000;
      await page.goto(url, {
        waitUntil: config.waitFor || 'networkidle2',
        timeout,
      });

      // Wait for specific selector if configured
      if (config.waitFor === 'selector' && config.waitSelector) {
        const waitTimeout = config.waitTimeout || 30000;
        await page.waitForSelector(config.waitSelector, { timeout: waitTimeout });
      }

      // Scroll page to trigger lazy-loaded content (useful for dynamic pages)
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });

      // Wait a bit after scrolling for content to load
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Extract data FIRST (before executing script, so we can pass it to the script)
      let extractedData: any = null;
      if (config.extractSelector) {
        if (config.extractType === 'json') {
          extractedData = await page.evaluate((selector: string) => {
            const element = document.querySelector(selector);
            if (!element) return null;
            try {
              return JSON.parse(element.textContent || '');
            } catch {
              return null;
            }
          }, config.extractSelector);
        } else if (config.extractType === 'text') {
          extractedData = await page.evaluate((selector: string) => {
            const element = document.querySelector(selector);
            return element ? element.textContent : null;
          }, config.extractSelector);
        } else {
          // html (default)
          extractedData = await page.evaluate((selector: string) => {
            const element = document.querySelector(selector);
            return element ? element.innerHTML : null;
          }, config.extractSelector);
        }
      } else {
        // Extract full page HTML if no selector specified
        extractedData = await page.content();
      }

      // Prepare current scrapeResponse with extracted HTML (for use in script)
      const currentScrapeResponse = {
        url,
        html: extractedData,
        scriptResult: null,
        screenshot: null,
        title: await page.title(),
        timestamp: new Date().toISOString(),
      };

      // Execute custom script if provided (now with access to current HTML)
      let scriptResult: any = null;
      if (config.executeScript) {
        const interpolatedScript = this.contextService.interpolate(config.executeScript, context);

        // Prepare variables and helper functions to inject into script context
        // Include current scrapeResponse AND previous variables
        const variablesToInject = {
          // Current scrapeResponse with the HTML we just extracted
          scrapeResponse: currentScrapeResponse,
          // Previous scrapeResponse from context (if exists, from previous nodes)
          previousScrapeResponse: context.variables.scrapeResponse || null,
          contactTags: context.variables.contactTags || [],
          triggerMessage: context.variables.triggerMessage || '',
          // Add other common variables
          ...(context.variables || {}),
        };

        try {
          scriptResult = await page.evaluate(
            (script: string, vars: any) => {
              try {
                // Inject variables into scope
                const scrapeResponse = vars.scrapeResponse; // Current scrapeResponse with HTML
                const previousScrapeResponse = vars.previousScrapeResponse; // Previous node's scrapeResponse
                const contactTags = vars.contactTags || [];
                const triggerMessage = vars.triggerMessage || '';

                // Helper function to parse HTML string (useful for manipulating scrapeResponse.html)
                function parseHTML(htmlString: string) {
                  const parser = new DOMParser();
                  return parser.parseFromString(htmlString, 'text/html');
                }

                // Helper: Get document from HTML string
                function getHTMLDocument(htmlString: string) {
                  return parseHTML(htmlString);
                }

                // Helper: Convert NodeList to Array (for easier manipulation)
                function nodeListToArray(nodeList: NodeListOf<Element> | NodeList): Element[] {
                  return Array.from(nodeList as NodeListOf<Element>);
                }

                // Execute user's script with variables and helpers available
                // Wrap the script in a function so return statements work correctly
                // User can use:
                // - document (current page DOM)
                // - scrapeResponse.html (current page HTML as string)
                // - parseHTML(scrapeResponse.html) (parse current HTML)
                // - previousScrapeResponse.html (previous node's HTML)
                // - nodeListToArray() to convert NodeList to Array
                const wrappedScript = `
                (function() {
                  ${script}
                })();
              `;
                const result = eval(wrappedScript);

                // If result is a NodeList, convert to array for serialization
                if (result && typeof result === 'object' && 'length' in result && result.length !== undefined) {
                  try {
                    return Array.from(result as any).map((node: any) => {
                      if (node && typeof node === 'object' && node.nodeType !== undefined) {
                        // Convert DOM node to serializable object
                        return {
                          tagName: node.tagName || null,
                          textContent: node.textContent || null,
                          innerHTML: node.innerHTML || null,
                          outerHTML: node.outerHTML || null,
                          attributes: node.attributes ? Array.from(node.attributes).map((attr: any) => ({
                            name: attr.name,
                            value: attr.value,
                          })) : [],
                        };
                      }
                      return node;
                    });
                  } catch (e) {
                    // If conversion fails, return as is
                    return result;
                  }
                }

                return result;
              } catch (error: any) {
                // Return error information so it can be handled upstream
                return {
                  error: true,
                  name: error.name || 'Error',
                  message: error.message || String(error),
                  stack: error.stack,
                };
              }
            },
            interpolatedScript,
            variablesToInject,
          );

          // If script returned an error object, log it but don't throw
          if (scriptResult && typeof scriptResult === 'object' && scriptResult.error) {
            console.error('[HTTP_SCRAPE] Script execution error:', scriptResult.message);
            // Keep scriptResult as error object - it will be included in output
          }
        } catch (error: any) {
          // If page.evaluate itself throws an error (e.g., serialization error)
          console.error('[HTTP_SCRAPE] Error executing script:', error);
          scriptResult = {
            error: true,
            name: error.name || 'Error',
            message: error.message || String(error),
          };
        }
      }

      // Take screenshot if requested
      let screenshot: string | null = null;
      if (config.screenshot) {
        screenshot = await page.screenshot({ encoding: 'base64' });
      }

      // Prepare response object (update with scriptResult and screenshot)
      const scrapeResponse = {
        ...currentScrapeResponse,
        scriptResult,
        screenshot: screenshot ? `data:image/png;base64,${screenshot}` : null,
      };

      // Save response to context variables
      const saveAs = config.saveResponseAs || 'scrapeResponse';
      this.contextService.setVariable(context, saveAs, scrapeResponse);

      // Save output to context - just the scrapeResponse
      // User can manipulate it in another node later
      this.contextService.setOutput(context, { [saveAs]: scrapeResponse });

      // Find next node
      const nextEdge = edges.find((e) => e.source === node.id);
      const nextNodeId = nextEdge ? nextEdge.target : null;

      return {
        nextNodeId,
        shouldWait: false,
        output: { [saveAs]: scrapeResponse },
      };
    } catch (error: any) {
      const errorResponse = {
        error: true,
        message: error.message,
        name: error.name,
        url,
      };

      const saveAs = config.saveResponseAs || 'scrapeResponse';
      this.contextService.setVariable(context, saveAs, errorResponse);

      // Save error output to context
      this.contextService.setOutput(context, { [saveAs]: errorResponse });

      // Continue to next node even on error
      const nextEdge = edges.find((e) => e.source === node.id);
      const nextNodeId = nextEdge ? nextEdge.target : null;

      return {
        nextNodeId,
        shouldWait: false,
        output: { [saveAs]: errorResponse },
      };
    } finally {
      // Clean up browser resources - CRITICAL for memory management
      try {
        if (page) {
          await page.close();
        }
      } catch (error) {
        console.error('[HTTP_SCRAPE] Error closing page:', error);
      }

      try {
        if (browser) {
          // Force kill all browser processes
          await browser.close();
          // Additional cleanup - kill any remaining processes
          if (browser.process()) {
            browser.process().kill('SIGKILL');
          }
        }
      } catch (error) {
        console.error('[HTTP_SCRAPE] Error closing browser:', error);
      }
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


          let fieldValue: any = this.contextService.interpolate(
            operation.value,
            context,
          );


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
  /**
   * Execute CODE node - runs user-provided JavaScript code
   * Updated: 2026-01-02 - Fixed helper functions to always be available
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

      // Helper function to parse HTML string (for manipulating scrapeResponse.html)
      // This will be injected into the code execution context
      const parseHTML = (htmlString: string) => {
        const dom = new JSDOM(htmlString);
        return dom.window.document;
      };

      const getHTMLDocument = (htmlString: string) => {
        return parseHTML(htmlString);
      };

      const nodeListToArray = (nodeList: any) => {
        return Array.from(nodeList);
      };

      // Enhanced helper functions for easier HTML manipulation
      const createHelpers = (htmlString: string) => {
        const doc = parseHTML(htmlString);

        return {
          // querySelector shortcut - returns first matching element
          $: (selector: string) => doc.querySelector(selector),

          // querySelectorAll shortcut - returns array of matching elements
          $$: (selector: string) => Array.from(doc.querySelectorAll(selector)),

          // Get text content from selector or element
          getText: (selectorOrElement: string | any) => {
            const el = typeof selectorOrElement === 'string'
              ? doc.querySelector(selectorOrElement)
              : selectorOrElement;
            return el?.textContent?.trim() || '';
          },

          // Get attribute from selector or element
          getAttr: (selectorOrElement: string | any, attrName: string) => {
            const el = typeof selectorOrElement === 'string'
              ? doc.querySelector(selectorOrElement)
              : selectorOrElement;
            return el?.getAttribute(attrName) || '';
          },

          // Map over elements and extract data
          mapElements: (selector: string, mapFn: (el: any, index: number) => any) => {
            const elements = Array.from(doc.querySelectorAll(selector));
            return elements.map(mapFn);
          },

          // Get all text from multiple elements
          getAllText: (selector: string) => {
            const elements = Array.from(doc.querySelectorAll(selector));
            return elements.map((el: any) => el.textContent?.trim() || '');
          },

          // Get all attributes from multiple elements
          getAllAttrs: (selector: string, attrName: string) => {
            const elements = Array.from(doc.querySelectorAll(selector));
            return elements.map((el: any) => el.getAttribute(attrName) || '');
          },

          // Direct access to document for advanced queries
          doc,
        };
      };

      // Inject variables directly into scope (similar to HTTP_SCRAPE node)
      // This allows users to access variables like scrapeResponse directly
      // Also merge output from previous node into variables so stdout, stderr, etc. are available
      const previousOutput = context.output || {};
      const variablesToInject = {
        scrapeResponse: variables.scrapeResponse || null,
        contactTags: variables.contactTags || [],
        triggerMessage: variables.triggerMessage || '',
        // Include output from previous node (e.g., stdout, stderr from COMMAND)
        ...previousOutput,
        // Include all other variables from context (variables take precedence over output)
        ...variables,
      };
      // Create a safe execution function with HTML parsing support
      // Inject helper functions and variables for HTML manipulation (similar to HTTP_SCRAPE)
      // Use IIFE to ensure helper functions are available in scope
      const userCodeWrapper = `
        return (function(parseHTMLParam, getHTMLDocumentParam, nodeListToArrayParam, createHelpersParam) {
          // Make helper functions available in this scope with their expected names
          const parseHTML = parseHTMLParam;
          const getHTMLDocument = getHTMLDocumentParam;
          const nodeListToArray = nodeListToArrayParam;
          
          // Inject variables directly into scope for easier access
          const scrapeResponse = variables.scrapeResponse || null;
          const contactTags = variables.contactTags || [];
          const triggerMessage = variables.triggerMessage || '';
          
          // Create HTML helpers if scrapeResponse.html exists
          const html = scrapeResponse?.html || null;
          const helpers = html ? createHelpersParam(html) : {
            $: () => null,
            $$: () => [],
            getText: () => '',
            getAttr: () => '',
            mapElements: () => [],
            getAllText: () => [],
            getAllAttrs: () => [],
            doc: null
          };
          
          // Destructure helpers for easy access (always available now)
          const $ = helpers.$;
          const $$ = helpers.$$;
          const getText = helpers.getText;
          const getAttr = helpers.getAttr;
          const mapElements = helpers.mapElements;
          const getAllText = helpers.getAllText;
          const getAllAttrs = helpers.getAllAttrs;
          const doc = helpers.doc;
          
          // Make all variables available at root level
          ${Object.keys(variablesToInject).map(key => {
        // Skip if already defined above
        if (['scrapeResponse', 'contactTags', 'triggerMessage'].includes(key)) {
          return '';
        }
        return `const ${key} = variables.${key};`;
      }).filter(Boolean).join('\n')}
          
          // User's code - all helper functions are now available in this scope
          ${config.code}
        })(parseHTML, getHTMLDocument, nodeListToArray, createHelpers);
      `;


      const executeUserCode = new Function(
        'variables',
        'globals',
        'input',
        'parseHTML',
        'getHTMLDocument',
        'nodeListToArray',
        'createHelpers',
        userCodeWrapper,
      );

      // Execute the code with helper functions and variables available
      // The functions are passed as parameters and will be available in the code scope
      const result = executeUserCode(
        variablesToInject,
        globals,
        input,
        parseHTML,
        getHTMLDocument,
        nodeListToArray,
        createHelpers,
      );

      // Sanitize result to remove non-serializable objects (DOM nodes, functions, etc.)
      const sanitizedResult = this.sanitizeForSerialization(result);

      // Save result to context (for backward compatibility)
      this.contextService.setVariable(context, 'codeOutput', sanitizedResult);

      // Set output - the output should be the result of the JavaScript code
      // If result is an object, spread it; otherwise, wrap it in codeOutput
      let outputValue: any;
      if (sanitizedResult && typeof sanitizedResult === 'object' && !Array.isArray(sanitizedResult) && sanitizedResult.constructor === Object) {
        // If result is a plain object, use it directly as output
        outputValue = sanitizedResult;
      } else {
        // Otherwise, wrap in codeOutput for backward compatibility
        outputValue = { codeOutput: sanitizedResult };
      }

      this.contextService.setOutput(context, outputValue);

      // Find next node
      const nextEdge = edges.find((e) => e.source === node.id);
      const nextNodeId = nextEdge ? nextEdge.target : null;

      return {
        nextNodeId,
        shouldWait: false,
        output: outputValue,
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
      switch (config.action) {
        case 'add':
          resultTags = await this.contactTagsService.addTags(
            tenantId,
            sessionId,
            contactId,
            config.tags || [],
          );
          break;

        case 'remove':
          resultTags = await this.contactTagsService.removeTags(
            tenantId,
            sessionId,
            contactId,
            config.tags || [],
          );
          break;

        case 'set':
          resultTags = await this.contactTagsService.setTags(
            tenantId,
            sessionId,
            contactId,
            config.tags || [],
          );
          break;

        case 'clear':
          await this.contactTagsService.clearTags(tenantId, sessionId, contactId);
          resultTags = [];
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

  /**
   * Execute LOOP node - iterate over arrays or count
   */
  private executeLoop(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
  ): NodeExecutionResult {
    const config = node.config as LoopConfig;

    // Validate config
    if (!config || !config.loopMode) {
      const errorMsg = `Loop node configuration is missing or invalid. loopMode is required. Config: ${JSON.stringify(config)}`;
      console.error('[LOOP]', errorMsg);
      throw new Error(errorMsg);
    }

    // Default variable names
    const itemVariableName = config.itemVariableName || 'item';
    const indexVariableName = config.indexVariableName || 'index';

    let loopData: any[] = [];

    try {
      if (config.loopMode === 'array') {
        // Extract array from variable
        if (!config.arraySource) {
          throw new Error('Array source is required for array loop mode');
        }

        // Get the array from context using the arraySource path
        const arrayValue = this.contextService.getVariable(context, config.arraySource);

        if (!Array.isArray(arrayValue)) {
          // Try to parse if it's a string
          if (typeof arrayValue === 'string') {
            try {
              const parsed = JSON.parse(arrayValue);
              if (Array.isArray(parsed)) {
                loopData = parsed;
              } else {
                throw new Error(`Array source "${config.arraySource}" is not an array (parsed to ${typeof parsed})`);
              }
            } catch (e) {
              throw new Error(`Array source "${config.arraySource}" is not a valid array`);
            }
          } else {
            throw new Error(`Array source "${config.arraySource}" is not an array (got ${typeof arrayValue})`);
          }
        } else {
          loopData = arrayValue;
        }
      } else if (config.loopMode === 'count') {
        // Create array of indices for count mode
        const count = config.count || 0;
        if (count <= 0) {
          throw new Error('Count must be greater than 0 for count loop mode');
        }
        loopData = Array.from({ length: count }, (_, i) => i);
      } else {
        throw new Error(`Invalid loop mode: ${config.loopMode}`);
      }

      // Store loop metadata in context for the execution engine to use
      this.contextService.setVariable(context, '_loopData', loopData);
      this.contextService.setVariable(context, '_loopItemVariable', itemVariableName);
      this.contextService.setVariable(context, '_loopIndexVariable', indexVariableName);
      this.contextService.setVariable(context, '_loopNodeId', node.id);
      this.contextService.setVariable(context, '_loopCurrentIndex', 0);
      this.contextService.setVariable(context, '_loopResults', []);

      // Set initial item and index
      if (loopData.length > 0) {
        this.contextService.setVariable(context, itemVariableName, loopData[0]);
        this.contextService.setVariable(context, indexVariableName, 0);
      }

      // Find the 'loop' edge (for iteration) - this connects to nodes executed during each iteration
      // The 'done' edge will be used by the execution engine after all iterations complete
      // Note: sourceHandle from React Flow is saved as 'condition' in WorkflowEdge
      const loopEdge = edges.find((e) => e.source === node.id && e.condition === 'loop');
      const nextNodeId = loopEdge ? loopEdge.target : null;


      // Get current iteration count (if loop was already started)
      // If _loopIterationsExecuted doesn't exist, this is the first execution, so start at 1
      const currentIterations = this.contextService.getVariable(context, '_loopIterationsExecuted');
      const iterationsExecuted = currentIterations !== undefined ? currentIterations + 1 : 1;

      // Store updated iteration count
      this.contextService.setVariable(context, '_loopIterationsExecuted', iterationsExecuted);

      // Set output with loop info
      this.contextService.setOutput(context, {
        loopMode: config.loopMode,
        totalItems: loopData.length,
        currentIndex: 0,
        iterationsExecuted,
      });

      return {
        nextNodeId,
        shouldWait: false,
        output: {
          loopMode: config.loopMode,
          totalItems: loopData.length,
          currentIndex: 0,
          iterationsExecuted,
        },
      };
    } catch (error) {
      console.error('[LOOP] Error:', error);

      // Set error in output
      this.contextService.setOutput(context, {
        error: true,
        message: error.message,
      });

      // On error, go to 'done' edge (skip the loop)
      // Note: sourceHandle from React Flow is saved as 'condition' in WorkflowEdge
      const doneEdge = edges.find((e) => e.source === node.id && e.condition === 'done');
      const nextNodeId = doneEdge ? doneEdge.target : null;

      return {
        nextNodeId,
        shouldWait: false,
        output: {
          error: true,
          message: error.message,
        },
      };
    }
  }

  /**
   * Execute PIX_RECOGNITION node
   */
  private async executePixRecognition(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
  ): Promise<NodeExecutionResult> {
    const config = node.config as PixRecognitionConfig;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createWorker } = require('tesseract.js');

    // Default to triggering message media URL if not specified
    const imageUrl = this.contextService.interpolate(config.imageUrl || '{{triggerMessage.media.url}}', context);

    try {
      if (!imageUrl || imageUrl.includes('{{')) {
        throw new Error('No valid image URL provided for PIX recognition');
      }

      console.log(`[PIX_RECOGNITION] Processing image: ${imageUrl}`);

      // Initialize Tesseract worker
      // Note: This might download language data on first run
      const worker = await createWorker('por'); // Portuguese
      const { data: { text } } = await worker.recognize(imageUrl);
      await worker.terminate();

      // Parse OCR text to extract PIX information
      const pixData = this.parsePixText(text);

      // Validate amount if requested
      if (config.validateAmount && config.expectedAmount) {
        const expectedStr = this.contextService.interpolate(config.expectedAmount, context);
        const expectedAmount = parseFloat(expectedStr.replace(',', '.'));

        if (!isNaN(expectedAmount)) {
          pixData.isAmountValid = Math.abs((pixData.amount || 0) - expectedAmount) < 0.01;
        }
      }

      // Basic validity check: must have found some key PIX indicators
      const hasPixKeywords = text.toLowerCase().includes('pix') || text.toLowerCase().includes('pagamento');
      pixData.isValidComprovante = hasPixKeywords && (pixData.amount > 0 || !!pixData.transactionId);

      const saveAs = config.saveResponseAs || 'pixResult';
      const result = {
        ...pixData,
        rawText: text,
        timestamp: new Date().toISOString(),
      };

      this.contextService.setVariable(context, saveAs, result);
      this.contextService.setOutput(context, { [saveAs]: result });

      const nextEdge = edges.find((e) => e.source === node.id);
      const nextNodeId = nextEdge ? nextEdge.target : null;

      return {
        nextNodeId,
        shouldWait: false,
        output: { [saveAs]: result },
      };
    } catch (error: any) {
      console.error('[PIX_RECOGNITION] Error:', error.message);
      const saveAs = config.saveResponseAs || 'pixResult';
      const errorResponse = {
        error: true,
        message: error.message,
        timestamp: new Date().toISOString(),
      };

      this.contextService.setVariable(context, saveAs, errorResponse);
      this.contextService.setOutput(context, { [saveAs]: errorResponse });

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
   * Helper to parse text extracted from a PIX receipt
   */
  private parsePixText(text: string) {
    const data: any = {
      amount: 0,
      date: null,
      transactionId: null,
      payer: null,
      receiver: null,
    };

    // Normalize text: remove multiple spaces, handle line breaks
    const cleanText = text.replace(/\s+/g, ' ');

    // 1. Extract Amount (Value)
    // Common formats: "R$ 100,00", "Valor: 100,00", "Valor Pago: 100.00"
    const amountRegex = /(?:R\$|Valor|TOTAL)\s*:?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[\.,]\d{2})/i;
    const amountMatch = cleanText.match(amountRegex);
    if (amountMatch) {
      const amountStr = amountMatch[1].replace(/\./g, '').replace(',', '.');
      data.amount = parseFloat(amountStr);
    }

    // 2. Extract Date
    // Common formats: "16/02/2026", "16 FEV 2026"
    const dateRegex = /(\d{2}\/\d{2}\/\d{4})/;
    const dateMatch = cleanText.match(dateRegex);
    if (dateMatch) {
      data.date = dateMatch[1];
    }

    // 3. Extract Transaction ID (ID da Transação / Autenticação)
    // PIX IDs usually start with E followed by numbers/letters or are long strings
    const txIdRegex = /(?:ID|Transação|Autenticação|Código|Protocolo)\s*:?\s*([A-Z0-9]{15,})/i;
    const txIdMatch = cleanText.match(txIdRegex);
    if (txIdMatch) {
      data.transactionId = txIdMatch[1];
    }

    // 4. Extract names (Heuristic)
    // This is harder via OCR and simple regex, but we can try to look after "Pagador" or "De:"
    const payerRegex = /(?:Pagador|De|Nome)\s*:?\s*([A-Z\s]{5,30})(?:\s[A-Z]|\n|$)/i;
    const payerMatch = cleanText.match(payerRegex);
    if (payerMatch) {
      data.payer = payerMatch[1].trim();
    }

    return data;
  }

  /**
   * Sanitize an object to make it safe for serialization (remove circular refs, etc.)
functions, etc.)
   * This ensures the result can be safely stored in the database
   */
  private sanitizeForSerialization(value: any, visited = new WeakSet()): any {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return value;
    }

    // Handle primitives
    if (typeof value !== 'object') {
      return value;
    }

    // Prevent circular references
    if (visited.has(value)) {
      return '[Circular]';
    }

    // Handle DOM nodes and window objects
    if (value.nodeType !== undefined || value.document !== undefined || value.window !== undefined) {
      // If it's a document, try to extract useful information
      if (value.documentElement) {
        return {
          type: 'Document',
          title: value.title || null,
          url: value.URL || value.location?.href || null,
          html: value.documentElement.outerHTML || null,
        };
      }
      // If it's a DOM element, extract useful properties
      if (value.tagName) {
        return {
          type: 'Element',
          tagName: value.tagName || null,
          textContent: value.textContent || null,
          innerHTML: value.innerHTML || null,
          outerHTML: value.outerHTML || null,
          attributes: value.attributes ? Array.from(value.attributes).map((attr: any) => ({
            name: attr.name,
            value: attr.value,
          })) : [],
        };
      }
      // For other DOM objects (like location), extract string properties
      const sanitized: any = { type: value.constructor?.name || 'DOMObject' };
      for (const key in value) {
        if (typeof value[key] === 'string' || typeof value[key] === 'number' || typeof value[key] === 'boolean') {
          sanitized[key] = value[key];
        }
      }
      return sanitized;
    }

    // Handle functions
    if (typeof value === 'function') {
      return '[Function]';
    }

    // Handle Date
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Handle arrays
    if (Array.isArray(value)) {
      visited.add(value);
      return value.map((item) => this.sanitizeForSerialization(item, visited));
    }

    // Handle plain objects
    visited.add(value);
    const sanitized: any = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const propValue = value[key];
        // Skip functions
        if (typeof propValue === 'function') {
          continue;
        }
        sanitized[key] = this.sanitizeForSerialization(propValue, visited);
      }
    }
    return sanitized;
  }
}

