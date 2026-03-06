import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
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
  RmktConfig,
  PixConfig,
  PixSimplesConfig,
  SendContactConfig,
  PromoMLConfig,
  MencionarTodosConfig,
  AquecimentoConfig,
  OfertaRelampagoConfig,
  LembreteRecorrenteConfig,
  EnqueteGrupoConfig,
  SequenciaLancamentoConfig,
  PromoMLApiConfig,
  GrupoWaitConfig,
  RandomizerConfig,
  GroupMessageConfig,
  ExecutionStatus,
} from '@n9n/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ContextService } from './context.service';
import { ContactTagsService } from './contact-tags.service';
import { JSDOM } from 'jsdom';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PixParser } from './pix-parser.util';
import { OCRService } from './ocr.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappSenderService } from './whatsapp-sender.service';
import { WhatsappSessionManager } from '../whatsapp/whatsapp-session-manager.service';
import { MlOffersService } from './ml-offers.service';

export interface NodeExecutionResult {
  nextNodeId: string | null;
  shouldWait: boolean;
  waitTimeoutSeconds?: number;
  [key: string]: any;
  onTimeout?: 'END' | 'GOTO_NODE';
  timeoutTargetNodeId?: string;
  output?: Record<string, any>;
  messageToSend?: {
    sessionId: string;
    contactPhone: string;
    message?: string;
    media?: {
      type: 'image' | 'video' | 'audio' | 'document';
      url: string;
      caption?: string;
      fileName?: string;
      sendAudioAsVoice?: boolean;
    };
    pixConfig?: PixConfig;
    poll?: {
      name: string;
      values: string[];
      selectableCount: number;
    };
    mentions?: string[];
  };
}

@Injectable()
export class NodeExecutorService {
  private whatsappSessionManager: any;

  constructor(
    private contextService: ContextService,
    private configService: ConfigService,
    private contactTagsService: ContactTagsService,
    private ocrService: OCRService,
    @InjectQueue('rmkt') private rmktQueue: Queue,
    private prisma: PrismaService,
    private whatsappSender: WhatsappSenderService,
    private mlOffersService: MlOffersService,
  ) { }

  setWhatsappSessionManager(manager: any) {
    this.whatsappSessionManager = manager;
  }

  /**
   * Execute SEND_PIX node
   */
  private async executeSendPix(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    sessionId?: string,
    contactPhone?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as PixConfig;
    const destination = (context.variables as any)?.groupJid || context.contactId || contactPhone;
    const finalContactPhone = destination;

    // Interpolate config
    const interpolatedConfig: PixConfig = {
      ...config,
      chavePix: this.contextService.interpolate(config.chavePix, context),
      nomeRecebedor: this.contextService.interpolate(config.nomeRecebedor, context),
      valor: this.contextService.interpolate(config.valor, context),
      descricao: config.descricao ? this.contextService.interpolate(config.descricao, context) : undefined,
      mensagemCustom: config.mensagemCustom ? this.contextService.interpolate(config.mensagemCustom, context) : undefined,
    };

    // Store config for later use in resume phase
    this.contextService.setVariable(context, '_pixConfig', interpolatedConfig);

    // Calculate expiry 
    const timeoutSeconds = (config.timeoutMinutos || 30) * 60;
    const expiresAt = new Date(Date.now() + timeoutSeconds * 1000).toISOString();
    this.contextService.setVariable(context, '_pixExpiresAt', expiresAt);

    // Store in output
    this.contextService.setOutput(context, {
      pixConfig: interpolatedConfig,
      expiresAt
    });

    return {
      nextNodeId: null, // Pausing
      shouldWait: true,
      waitTimeoutSeconds: timeoutSeconds,
      onTimeout: 'GOTO_NODE', // We'll handle routing in ExecutionEngine
      messageToSend: sessionId && finalContactPhone ? {
        sessionId,
        contactPhone: finalContactPhone,
        pixConfig: interpolatedConfig,
      } : undefined,
    };
  }

  /**
   * Execute SEND_CONTACT node — sends a contact card and continues immediately
   */
  private async executeSendContact(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    sessionId?: string,
    contactPhone?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as SendContactConfig;
    const destination = (context.variables as any)?.groupJid || context.contactId || contactPhone;

    const interpolated: SendContactConfig = {
      nome: this.contextService.interpolate(config.nome, context),
      telefone: this.contextService.interpolate(config.telefone, context),
      empresa: config.empresa ? this.contextService.interpolate(config.empresa, context) : undefined,
    };

    if (sessionId && destination) {
      await this.whatsappSessionManager.sendContact(sessionId, destination, interpolated);
    }

    const nextEdge = edges.find(e => e.source === node.id);
    return { nextNodeId: nextEdge?.target ?? null, shouldWait: false };
  }

  /**
   * Execute PIX_SIMPLES node — sends Pix message and continues immediately
   */
  private async executePixSimples(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    sessionId?: string,
    contactPhone?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as PixSimplesConfig;
    const destination = (context.variables as any)?.groupJid || context.contactId || contactPhone;

    const interpolated: PixSimplesConfig = {
      chavePix: this.contextService.interpolate(config.chavePix, context),
      nomeRecebedor: this.contextService.interpolate(config.nomeRecebedor, context),
      valor: this.contextService.interpolate(config.valor, context),
      descricao: config.descricao ? this.contextService.interpolate(config.descricao, context) : undefined,
    };

    if (sessionId && destination) {
      await this.whatsappSessionManager.sendPixSimples(sessionId, destination, interpolated);
    }

    const nextEdge = edges.find(e => e.source === node.id);
    return { nextNodeId: nextEdge?.target ?? null, shouldWait: false };
  }

  /**
   * Execute a node and return the result
   */
  async executeNode(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    sessionId?: string,
    contactPhone?: string,
    workflowId?: string,
    executionId?: string,
  ): Promise<NodeExecutionResult> {
    switch (node.type) {
      case WorkflowNodeType.SEND_MESSAGE:
        return this.executeSendMessage(node, context, edges, sessionId, contactPhone);

      case WorkflowNodeType.SEND_MEDIA:
        return this.executeSendMedia(node, context, edges, sessionId, contactPhone);

      case WorkflowNodeType.SEND_BUTTONS:
        return this.executeSendButtons(node, context, edges, sessionId, contactPhone);

      case WorkflowNodeType.SEND_LIST:
        return this.executeSendList(node, context, edges, sessionId, contactPhone);

      case WorkflowNodeType.HTTP_REQUEST:
        return this.executeHttpRequest(node, context, edges);

      case WorkflowNodeType.HTTP_SCRAPE:
        return this.executeHttpScrape(node, context, edges);

      case WorkflowNodeType.CODE:
        return this.executeCode(node, context, edges);

      case WorkflowNodeType.EDIT_FIELDS:
        return this.executeEditFields(node, context, edges);

      case WorkflowNodeType.MANAGE_LABELS:
        return this.executeManageLabels(node, context, edges, sessionId, contactPhone);

      case WorkflowNodeType.CONDITION:
        return this.executeCondition(node, context, edges);

      case WorkflowNodeType.SWITCH:
        return this.executeSwitch(node, context, edges);

      case WorkflowNodeType.WAIT_REPLY:
        return this.executeWaitReply(node, context, edges);

      case WorkflowNodeType.WAIT:
        return this.executeWait(node, context, edges);

      case WorkflowNodeType.SET_TAGS:
        return await this.executeSetTags(node, context, edges, sessionId, contactPhone);

      case WorkflowNodeType.LOOP:
        return this.executeLoop(node, context, edges);

      case WorkflowNodeType.SEND_PIX:
        return this.executeSendPix(node, context, edges, sessionId, contactPhone);

      case WorkflowNodeType.COMMAND:
      case 'COMMAND':
        return await this.executeCommand(node, context, edges);

      case WorkflowNodeType.PIX_RECOGNITION:
        return await this.executePixRecognition(node, context, edges);

      case WorkflowNodeType.RMKT:
        return await this.executeRmkt(node, context, edges, sessionId, contactPhone);

      case WorkflowNodeType.MARK_STAGE:
        return this.executeMarkStage(node, context, edges);

      case WorkflowNodeType.PROMO_ML:
        return this.executePromoML(node, context, edges, sessionId, contactPhone);

      case WorkflowNodeType.MENCIONAR_TODOS:
        return this.executeMencionarTodos(node, context, edges, sessionId, contactPhone);

      case WorkflowNodeType.AQUECIMENTO:
        return this.executeAquecimento(node, context, edges, sessionId, contactPhone);

      case WorkflowNodeType.OFERTA_RELAMPAGO:
        return this.executeOfertaRelampago(node, context, edges, sessionId, contactPhone);

      case WorkflowNodeType.LEMBRETE_RECORRENTE:
        return this.executeLembreteRecorrente(node, context, edges, sessionId, contactPhone);

      case WorkflowNodeType.ENQUETE_GRUPO:
        return this.executeEnqueteGrupo(node, context, edges, sessionId, contactPhone);

      case WorkflowNodeType.SEQUENCIA_LANCAMENTO:
        return this.executeSequenciaLancamento(node, context, edges, sessionId, contactPhone);

      case WorkflowNodeType.PROMO_ML_API:
        return this.executePromoML(node, context, edges, sessionId, contactPhone);

      case WorkflowNodeType.GRUPO_MEDIA:
        return this.executeGrupoMedia(node, context, edges, sessionId, contactPhone);

      case WorkflowNodeType.GRUPO_WAIT:
        return this.executeGrupoWait(node, context, undefined, edges, workflowId!, executionId!, sessionId, contactPhone);

      case WorkflowNodeType.RANDOMIZER:
        return this.executeRandomizer(node, context, edges, workflowId, executionId);

      case WorkflowNodeType.PIXEL_EVENT:
        return this.executePixelEvent(node, context, edges, sessionId, contactPhone);

      case WorkflowNodeType.PIX_SIMPLES:
        return this.executePixSimples(node, context, edges, sessionId, contactPhone);

      case WorkflowNodeType.SEND_CONTACT:
        return this.executeSendContact(node, context, edges, sessionId, contactPhone);

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
    defaultcontactPhone?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as SendMessageConfig;

    // Interpolate message with variables
    const message = this.contextService.interpolate(config.message, context);

    // Determine session ID (config overrides default)
    const sessionId = config.sessionId || defaultSessionId;

    // Determine recipient (config overrides default)
    const destination = (context.variables as any)?.groupJid || context.contactId || defaultcontactPhone;
    let contactPhone = destination;
    if (config.to) {
      contactPhone = this.contextService.interpolate(config.to, context);
      // Ensure group JID is not transformed
      if (contactPhone && !contactPhone.includes('@')) {
        contactPhone = contactPhone.replace(/\D/g, '');
      }
    }

    // Store message in output
    this.contextService.setOutput(context, { message, sentTo: contactPhone, sessionId });

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
      messageToSend: sessionId && contactPhone ? {
        sessionId,
        contactPhone,
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
    defaultcontactPhone?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as SendMediaConfig;

    // Interpolate media URL and caption
    const mediaUrl = this.contextService.interpolate(config.mediaUrl, context);
    const caption = config.caption ? this.contextService.interpolate(config.caption, context) : undefined;
    const fileName = config.fileName ? this.contextService.interpolate(config.fileName, context) : undefined;

    // Determine session ID (config overrides default)
    const sessionId = config.sessionId || defaultSessionId;

    // Determine recipient (config overrides default)
    const destination = (context.variables as any)?.groupJid || context.contactId || defaultcontactPhone;
    let contactPhone = destination;
    if (config.to) {
      contactPhone = this.contextService.interpolate(config.to, context);
      // Ensure group JID is not transformed
      if (contactPhone && !contactPhone.includes('@')) {
        contactPhone = contactPhone.replace(/\D/g, '');
      }
    }

    // Store in output
    this.contextService.setOutput(context, {
      mediaUrl,
      mediaType: config.mediaType,
      caption,
      fileName,
      sendAudioAsVoice: config.sendAudioAsVoice,
      sentTo: contactPhone,
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
      messageToSend: sessionId && contactPhone ? {
        sessionId,
        contactPhone,
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
    contactPhone?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as SendButtonsConfig;
    const destination = (context.variables as any)?.groupJid || context.contactId || contactPhone;
    const finalContactPhone = destination;

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
      nextNodeId: null, // Clear nextNodeId because we wait for response
      shouldWait: true,
      waitTimeoutSeconds: config.delay ? (config.delay / 1000) + 3600 : 3600, // Wait 1h
      output: { message, buttons, footer },
      messageToSend: sessionId && finalContactPhone ? {
        sessionId,
        contactPhone: finalContactPhone,
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
    contactPhone?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as SendListConfig;
    const destination = (context.variables as any)?.groupJid || context.contactId || contactPhone;
    const finalContactPhone = destination;

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
      messageToSend: sessionId && finalContactPhone ? {
        sessionId,
        contactPhone: finalContactPhone,
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
    contactPhone?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as ManageLabelsConfig;
    const action = config.action || 'add'; // Default to 'add' if not specified

    if (!sessionId || !contactPhone) {
      throw new Error('Session ID and Contact ID are required for MANAGE_LABELS node');
    }

    if (!this.whatsappSessionManager) {
      throw new Error('WhatsApp Session Manager not initialized');
    }


    try {
      if (action === 'list') {
        // Get current chat labels
        const chatLabels = await this.whatsappSessionManager.getChatLabels(sessionId, contactPhone);
        const saveAs = config.saveLabelsAs || 'chatLabels';
        this.contextService.setVariable(context, saveAs, chatLabels);

      } else if (action === 'add') {
        // Add labels
        if (config.labelIds && config.labelIds.length > 0) {
          await this.whatsappSessionManager.addLabels(sessionId, contactPhone, config.labelIds);
        }
      } else if (action === 'remove') {
        // Remove labels
        if (config.labelIds && config.labelIds.length > 0) {
          await this.whatsappSessionManager.removeLabels(sessionId, contactPhone, config.labelIds);
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
    contactPhone?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as SetTagsConfig;
    const destination = (context.variables as any)?.groupJid || context.contactId || contactPhone;

    if (!sessionId || !destination) {
      console.error('[SET_TAGS] Missing sessionId or destination');
      const nextEdge = edges.find((e) => e.source === node.id);
      return {
        nextNodeId: nextEdge?.target || null,
        shouldWait: false,
        output: { error: 'Missing sessionId or destination' },
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
            destination,
            config.tags || [],
          );
          break;

        case 'remove':
          resultTags = await this.contactTagsService.removeTags(
            tenantId,
            sessionId,
            destination,
            config.tags || [],
          );
          break;

        case 'set':
          resultTags = await this.contactTagsService.setTags(
            tenantId,
            sessionId,
            destination,
            config.tags || [],
          );
          break;

        case 'clear':
          await this.contactTagsService.clearTags(tenantId, sessionId, destination);
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

  private async executePixRecognition(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
  ): Promise<NodeExecutionResult> {
    const config = node.config as PixRecognitionConfig;
    const imageUrl = this.contextService.interpolate(config.imageUrl || '{{triggerMessage.media.url}}', context);
    const saveAs = config.saveResponseAs || 'pixResult';

    try {
      if (!imageUrl || imageUrl.includes('{{')) {
        throw new Error('No valid image/PDF URL provided for PIX recognition');
      }

      console.log(`[PIX_RECOGNITION] Processing file: ${imageUrl}`);

      // 1. Run OCR via OCRService (handles pre-processing and PDF)
      const rawText = await this.ocrService.extractText(imageUrl);

      // 2. Parse text with bank-specific logic
      const pixData = PixParser.parse(rawText);

      // 3. Validations
      let valid = true;
      let reason = null;

      // Date Validation (Mandatory: must be today)
      if (config.validateDate !== false) {
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        const todayStr = `${dd}/${mm}/${yyyy}`;

        if (pixData.date && pixData.date !== todayStr) {
          valid = false;
          reason = `Data inválida: encontrado ${pixData.date}, esperado ${todayStr}`;
        } else if (!pixData.date) {
          // If date is mandatory but not found, we might want to flag it or be lenient?
          // User requested that "comprovantes com data anterior devem ser rejeitados".
          // If not found, it's safer to fail or warn.
        }
      }

      // Receiver Name Validation
      if (valid && config.expectedReceiverName) {
        const expected = this.contextService.interpolate(config.expectedReceiverName, context).toLowerCase().trim();
        const found = (pixData.receiverName || '').toLowerCase().trim();

        if (!found.includes(expected) && !expected.includes(found)) {
          valid = false;
          reason = `Recebedor não correspondente: encontrado "${pixData.receiverName || 'Não identificado'}", esperado "${config.expectedReceiverName}"`;
        }
      }

      // Value Validation (Accepted list)
      if (valid && (config.validateAmount || config.acceptedValues)) {
        if (config.acceptedValues) {
          const acceptedList = config.acceptedValues.split(',').map(v => parseFloat(v.trim().replace(',', '.')));
          const foundValue = pixData.amount;

          if (!acceptedList.some(v => Math.abs(v - foundValue) < 0.01)) {
            valid = false;
            reason = `Valor não autorizado: encontrado R$ ${pixData.amount.toFixed(2)}, valores aceitos: ${config.acceptedValues}`;
          }
        } else if (config.expectedAmount) {
          const expectedStr = this.contextService.interpolate(config.expectedAmount, context);
          const expectedAmount = parseFloat(expectedStr.replace(',', '.'));

          if (!isNaN(expectedAmount) && Math.abs(pixData.amount - expectedAmount) >= 0.01) {
            valid = false;
            reason = `Valor divergente: encontrado R$ ${pixData.amount.toFixed(2)}, esperado R$ ${expectedAmount.toFixed(2)}`;
          }
        }
      }

      // General fallback validity check
      const hasPixKeywords = rawText.toLowerCase().includes('pix') || rawText.toLowerCase().includes('pagamento');
      if (valid && !hasPixKeywords && pixData.amount <= 0 && !pixData.transactionId) {
        valid = false;
        reason = 'O arquivo não parece ser um comprovante de PIX válido.';
      }

      const result = {
        valid,
        reason,
        data: {
          ...pixData,
          rawText
        },
        timestamp: new Date().toISOString(),
      };

      console.log(`[PIX_RECOGNITION] Result for ${imageUrl}: valid=${valid}${reason ? ` (${reason})` : ''}`);

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
      console.error('[PIX_RECOGNITION] Fatal Error:', error.message);
      const result = {
        valid: false,
        reason: `Erro no processamento: ${error.message}`,
        data: { rawText: '' },
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
    }
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

  /**
   * Execute RMKT node
   */
  private async executeRmkt(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    sessionId?: string,
    contactPhone?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as RmktConfig;

    // Calculate delay in milliseconds
    let delayMs = (config.amount || 0) * 1000;
    if (config.unit === 'minutes') delayMs *= 60;
    else if (config.unit === 'hours') delayMs *= 3600;
    else if (config.unit === 'days') delayMs *= 86400;

    // Get metadata from context variables (set by ExecutionEngine)
    const executionId = (context.variables as any)?._executionId;
    const tenantId = (context.variables as any)?._tenantId;

    if (!executionId || !tenantId) {
      console.warn('[RMKT] Execution ID or Tenant ID missing in context variables, cannot schedule job');
      throw new Error('Internal error: Missing execution metadata in context');
    }

    // Add job to queue
    await this.rmktQueue.add(
      'rmkt-job',
      {
        tenantId,
        executionId,
        nodeId: node.id,
        config,
      },
      {
        delay: delayMs,
        attempts: (config.retries || 2) + 1,
        backoff: {
          type: 'fixed',
          delay: config.retryDelayMs || 30000,
        },
        jobId: `rmkt:${executionId}`, // One RMKT at a time per execution
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return {
      nextNodeId: null, // Will be resumed by processor
      shouldWait: true,
    };
  }

  /**
   * Execute MARK_STAGE node
   */
  private executeMarkStage(
    node: any,
    context: any,
    edges: any[],
  ): any {
    // This is a passive node for analytics, just move to next node
    const nextEdge = edges.find((e) => e.source === node.id);
    const nextNodeId = nextEdge ? nextEdge.target : null;

    return {
      nextNodeId,
      shouldWait: false,
    };
  }

  /**
   * Execute PROMO_ML node
   */
  private async executePromoML(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    sessionId?: string,
    contactPhone?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as PromoMLConfig;
    console.log('[PROMO_ML] Config recebido:', JSON.stringify(config));
    const tenantId = (context.variables as any)?._tenantId;
    const destination = (context.variables as any)?.groupJid || context.contactId || contactPhone;
    const finalContactPhone = destination;
    console.log(`[PROMO_ML] Destino: ${finalContactPhone} | groupJid: ${(context.variables as any)?.groupJid} | contactId: ${context.contactId} | contactPhone param: ${contactPhone}`);

    // 1. Scraping logic via cache
    const keywords = (config.searchTerm || '')
      .split(',')
      .map((k: string) => k.trim())
      .filter(Boolean);

    const minDiscount = config.minDiscount || 0;
    const minRating = config.minRating || 0;
    const minReviews = config.minReviews || 0;
    const limit = config.maxQuantity || 5;

    // Fetch a larger pool so ignoreAlreadySent doesn't reduce below the limit
    let filteredProducts = await this.mlOffersService.searchOffers(keywords, minDiscount, minRating, limit * 10, minReviews);

    // Remove duplicatas por productUrl
    filteredProducts = filteredProducts.filter((p, index, self) =>
      index === self.findIndex(t => t.productUrl === p.productUrl)
    );

    console.log(`[PROMO_ML] Encontrados ${filteredProducts.length} produtos no cache para keywords: ${keywords.join(', ')}`);

    // Pre-filter already sent products so we can report accurate count
    if (config.ignoreAlreadySent && tenantId && finalContactPhone) {
      const startOfDay = new Date();
      startOfDay.setUTCHours(3, 0, 0, 0);
      if (new Date().getUTCHours() < 3) startOfDay.setUTCDate(startOfDay.getUTCDate() - 1);

      const cleanUrls = filteredProducts.map(p => p.productUrl.split('?')[0].split('#')[0]);
      const alreadySentRecords = await this.prisma.promoMLSent.findMany({
        where: {
          productUrl: { in: cleanUrls },
          tenantId,
          contactPhone: finalContactPhone,
          sentAt: { gte: startOfDay },
        },
        select: { productUrl: true },
      });
      const sentUrls = new Set(alreadySentRecords.map(r => r.productUrl));
      filteredProducts = filteredProducts.filter(p => !sentUrls.has(p.productUrl.split('?')[0].split('#')[0]));
      console.log(`[PROMO_ML] Após ignorar já enviados: ${filteredProducts.length} produtos disponíveis`);
    }

    // Apply final limit
    filteredProducts = filteredProducts.slice(0, limit);
    console.log(`[PROMO_ML] Enviando ${filteredProducts.length} produto(s) para ${finalContactPhone}`);

    // 3. Send to WhatsApp
    if (sessionId && finalContactPhone && this.whatsappSessionManager) {
      if (filteredProducts.length > 0) {
        for (const product of filteredProducts) {
          const cleanUrl = product.productUrl.split('?')[0].split('#')[0];
          const mlbId = product.productUrl.match(/\/p\/(MLB\d+)/i)?.[1];
          const shortBase = mlbId ? `https://www.mercadolivre.com.br/p/${mlbId}` : cleanUrl;
          const affiliateUrl = config.affiliateTag
            ? `${shortBase}?deal_print_id=${config.affiliateTag}`
            : shortBase;

          const caption = `🛒 *${product.title}*

💰 De ~R$ ${product.originalPrice.toLocaleString('pt-BR')}~ por *R$ ${product.price.toLocaleString('pt-BR')}*
${product.discount > 0 ? `🔥 *${product.discount}% OFF*\n` : ''}⭐ ${product.rating > 0 ? product.rating + '/5' : 'N/A'} (${product.reviewCount} avaliações)
🏪 _Vendido por: ${product.seller}_

${config.introText || ''}
👉 ${affiliateUrl}

${config.footerText || ''}`;

          try {
            const validImageUrl = product.imageUrl?.startsWith('https') ? product.imageUrl : null;
            if (validImageUrl) {
              await this.whatsappSessionManager.sendMedia(sessionId, finalContactPhone, 'image', validImageUrl, { caption });
            } else {
              await this.whatsappSessionManager.sendMessage(sessionId, finalContactPhone, caption);
            }

            // Track as sent por destino (cleanUrl + tenantId + contactPhone)
            if (tenantId) {
              await this.prisma.promoMLSent.create({
                data: {
                  productUrl: cleanUrl,
                  tenantId,
                  contactPhone: finalContactPhone || '',
                }
              });
            }
          } catch (err) {
            console.error('[PROMO_ML] Send error:', err);
          }

          // Wait interval
          const interval = (config.messageInterval || 3) * 1000;
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      } else {
        // No products found after filtering or scraping
        const promoApiFound = (context.variables as any)?.promoApiProductsFound === true;
        if (!promoApiFound) {
          const searchTerm = this.contextService.interpolate(config.searchTerm, context);
          const aviso = `🔍 Nenhum produto encontrado para * ${searchTerm}* no momento.`;
          console.log('[PROMO_ML] Nenhum produto encontrado, enviando aviso');
          await this.whatsappSessionManager.sendMessage(sessionId, finalContactPhone, aviso);
        }
      }
    }

    // 4. Save results to context
    const saveAs = config.saveResponseAs || 'mlProducts';
    this.contextService.setVariable(context, saveAs, filteredProducts);
    this.contextService.setOutput(context, { [saveAs]: filteredProducts });

    const nextEdge = edges.find((e) => e.source === node.id);
    const nextNodeId = nextEdge ? nextEdge.target : null;

    return {
      nextNodeId,
      shouldWait: false,
    };
  }

  /**
   * Execute MENCIONAR_TODOS node
   */
  private async executeMencionarTodos(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    defaultSessionId?: string,
    defaultContactPhone?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as MencionarTodosConfig;
    const sessionId = config.sessionId || defaultSessionId;

    // Resolve tenantId from variables or globals
    const tenantId = (context.variables as any)?._tenantId || (context.globals as any)?.tenantId;

    // Resolve groupJid priority: config > variables.groupJid > context.contactId > defaultContactPhone
    const groupJid = config.groupJid || (context.variables as any)?.groupJid || context.contactId || defaultContactPhone;
    const isGroup = groupJid?.endsWith('@g.us');

    if (!sessionId || !isGroup) {
      throw new Error('MENCIONAR_TODOS only works within a connected WhatsApp group');
    }

    const contactPhone = groupJid;
    const isTestExecution = (context.variables as any)?.isTestExecution === true;

    if (!isTestExecution) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentMention = await this.prisma.groupMentionLog.findFirst({
        where: {
          groupJid: contactPhone,
          mentionedAt: { gte: oneHourAgo }
        }
      });

      if (recentMention) {
        console.warn(`[GROUP_MENTIONS] skipping mention for ${contactPhone} as it was mentioned less than 1h ago`);
        const nextEdge = edges.find((e) => e.source === node.id);
        return { nextNodeId: nextEdge ? nextEdge.target : null, shouldWait: false };
      }
    }

    const metadata = await this.whatsappSessionManager.getGroupMetadata(sessionId, contactPhone);
    const participants = metadata.participants || [];

    const mentions = participants
      .filter((p: any) => {
        if (!config.incluirAdmins && (p.admin === 'admin' || p.admin === 'superadmin')) return false;
        return true;
      })
      .map((p: any) => p.id);

    if (!isTestExecution) {
      await this.prisma.groupMentionLog.create({
        data: {
          groupJid: contactPhone,
          tenantId: tenantId!,
          mentionedAt: new Date()
        }
      });
    }

    // Handle string or GroupMessageConfig
    const msgConfig = typeof config.mensagem === 'string'
      ? { type: 'text', text: config.mensagem } as GroupMessageConfig
      : config.mensagem;

    const messageToSend: any = {
      sessionId,
      contactPhone,
      mentions
    };

    if (msgConfig.type === 'text') {
      messageToSend.message = this.contextService.interpolate(msgConfig.text || '', context);
      messageToSend.simulateTyping = msgConfig.simulateTyping;
      messageToSend.typingDuration = msgConfig.typingDuration;
    } else {
      messageToSend.media = {
        type: msgConfig.type,
        url: this.contextService.interpolate(msgConfig.mediaUrl || '', context),
        caption: msgConfig.caption ? this.contextService.interpolate(msgConfig.caption, context) : undefined,
        sendAudioAsVoice: msgConfig.sendAudioAsVoice
      };
      messageToSend.simulateTyping = msgConfig.simulateTyping;
      messageToSend.simulateRecording = msgConfig.simulateRecording;
      messageToSend.recordingDuration = msgConfig.recordingDuration;
    }

    return {
      nextNodeId: edges.find((e) => e.source === node.id)?.target || null,
      shouldWait: false,
      messageToSend
    };
  }

  /**
   * Execute AQUECIMENTO node
   */
  private async executeAquecimento(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    defaultSessionId?: string,
    defaultContactPhone?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as AquecimentoConfig;
    const sessionId = config.sessionId || defaultSessionId;
    const tenantId = (context.variables as any)?._tenantId || (context.globals as any)?.tenantId;
    const workflowId = (context.variables as any)?._workflowId;

    const destination = (context.variables as any)?.groupJid || context.contactId || defaultContactPhone;
    const contactPhone = destination;

    if (!contactPhone?.includes('@g.us')) throw new Error('Cuidado: AQUECIMENTO recomendado apenas para grupos');

    let link = await this.prisma.groupWorkflowLink.findFirst({
      where: { groupJid: contactPhone, workflowId, tenantId: tenantId! }
    });

    if (!link) {
      link = await this.prisma.groupWorkflowLink.create({
        data: { groupJid: contactPhone, workflowId, tenantId: tenantId!, isActive: true }
      });
    }

    const diffTime = Math.abs(new Date().getTime() - link.activatedAt.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

    let targetDay: any;
    for (let i = 0; i < config.sequencia.length; i++) {
      const item = config.sequencia[i];
      if (item.dia === diffDays) {
        targetDay = item;
        break;
      }
    }

    if (!targetDay) {
      const nextEdge = edges.find((e) => e.source === node.id);
      return { nextNodeId: nextEdge ? nextEdge.target : null, shouldWait: false };
    }

    if (!sessionId || !contactPhone) throw new Error('Session and Contact are required for AQUECIMENTO');

    const msgConfig = targetDay.mensagem;
    const messageToSend: any = {
      sessionId,
      contactPhone,
      mentions: targetDay.mencionarTodos ? ['@all'] : undefined
    };

    if (msgConfig.type === 'text') {
      messageToSend.message = this.contextService.interpolate(msgConfig.text || '', context);
      messageToSend.simulateTyping = msgConfig.simulateTyping;
      messageToSend.typingDuration = msgConfig.typingDuration;
    } else {
      messageToSend.media = {
        type: msgConfig.type,
        url: this.contextService.interpolate(msgConfig.mediaUrl || '', context),
        caption: msgConfig.caption ? this.contextService.interpolate(msgConfig.caption, context) : undefined,
        sendAudioAsVoice: msgConfig.sendAudioAsVoice
      };
      messageToSend.simulateTyping = msgConfig.simulateTyping;
      messageToSend.simulateRecording = msgConfig.simulateRecording;
      messageToSend.recordingDuration = msgConfig.recordingDuration;
    }

    return {
      nextNodeId: edges.find((e) => e.source === node.id)?.target || null,
      shouldWait: false,
      messageToSend
    };
  }

  /**
   * Execute OFERTA_RELAMPAGO node
   */
  private async executeOfertaRelampago(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    defaultSessionId?: string,
    defaultContactPhone?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as OfertaRelampagoConfig;
    const sessionId = config.sessionId || defaultSessionId;
    const tenantId = (context.variables as any)?._tenantId || (context.globals as any)?.tenantId;

    const destination = (context.variables as any)?.groupJid || context.contactId || defaultContactPhone;
    const contactPhone = destination;

    const expiresAt = new Date();
    if (config.duracao.tipo === 'tempo') {
      expiresAt.setHours(expiresAt.getHours() + (config.duracao.horas || 0));
      expiresAt.setMinutes(expiresAt.getMinutes() + (config.duracao.minutos || 0));
    } else {
      const [h, m] = config.duracao.horaFixa!.split(':').map(Number);
      expiresAt.setHours(h, m, 0, 0);
      if (expiresAt < new Date()) expiresAt.setDate(expiresAt.getDate() + 1);
    }

    await this.prisma.groupOffer.create({
      data: {
        groupJid: contactPhone!,
        message: JSON.stringify(config.mensagemEncerramento),
        expiresAt,
        tenantId: tenantId!,
        status: 'active'
      }
    });

    if (!sessionId || !contactPhone) throw new Error('Session and Contact are required for OFERTA_RELAMPAGO');

    const msgConfig = config.mensagemOferta;
    const messageToSend: any = {
      sessionId,
      contactPhone,
      mentions: config.mencionarAoAbrir ? ['@all'] : undefined
    };

    if (msgConfig.type === 'text') {
      messageToSend.message = this.contextService.interpolate(msgConfig.text || '', context);
      messageToSend.simulateTyping = msgConfig.simulateTyping;
      messageToSend.typingDuration = msgConfig.typingDuration;
    } else {
      messageToSend.media = {
        type: msgConfig.type,
        url: this.contextService.interpolate(msgConfig.mediaUrl || '', context),
        caption: msgConfig.caption ? this.contextService.interpolate(msgConfig.caption, context) : undefined,
        sendAudioAsVoice: msgConfig.sendAudioAsVoice
      };
      messageToSend.simulateTyping = msgConfig.simulateTyping;
      messageToSend.simulateRecording = msgConfig.simulateRecording;
      messageToSend.recordingDuration = msgConfig.recordingDuration;
    }

    return {
      nextNodeId: edges.find((e) => e.source === node.id)?.target || null,
      shouldWait: false,
      messageToSend
    };
  }

  /**
   * Execute LEMBRETE_RECORRENTE node
   */
  private async executeLembreteRecorrente(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    defaultSessionId?: string,
    defaultContactPhone?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as LembreteRecorrenteConfig;
    const sessionId = config.sessionId || defaultSessionId;
    const destination = (context.variables as any)?.groupJid || context.contactId || defaultContactPhone;
    const contactPhone = destination;

    if (!sessionId || !contactPhone) throw new Error('Session and Contact are required for LEMBRETE_RECORRENTE');

    const msgConfig = config.mensagem;
    const messageToSend: any = {
      sessionId,
      contactPhone,
      mentions: config.mencionarTodos ? ['@all'] : undefined
    };

    if (msgConfig.type === 'text') {
      messageToSend.message = this.contextService.interpolate(msgConfig.text || '', context);
      messageToSend.simulateTyping = msgConfig.simulateTyping;
      messageToSend.typingDuration = msgConfig.typingDuration;
    } else {
      messageToSend.media = {
        type: msgConfig.type,
        url: this.contextService.interpolate(msgConfig.mediaUrl || '', context),
        caption: msgConfig.caption ? this.contextService.interpolate(msgConfig.caption, context) : undefined,
        sendAudioAsVoice: msgConfig.sendAudioAsVoice
      };
      messageToSend.simulateTyping = msgConfig.simulateTyping;
      messageToSend.simulateRecording = msgConfig.simulateRecording;
      messageToSend.recordingDuration = msgConfig.recordingDuration;
    }

    return {
      nextNodeId: edges.find((e) => e.source === node.id)?.target || null,
      shouldWait: false,
      messageToSend
    };
  }

  /**
   * Execute ENQUETE_GRUPO node
   */
  private async executeEnqueteGrupo(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    defaultSessionId?: string,
    defaultContactPhone?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as EnqueteGrupoConfig;
    const sessionId = config.sessionId || defaultSessionId;
    const destination = (context.variables as any)?.groupJid || context.contactId || defaultContactPhone;
    const contactPhone = destination;

    if (!sessionId || !contactPhone) throw new Error('Session and Contact are required for poll');

    const interpolatedQuestion = this.contextService.interpolate(config.pergunta, context);
    const interpolatedOptions = config.opcoes.map(opt => this.contextService.interpolate(opt, context));

    let mentions: string[] = [];
    if (config.mencionarTodos && contactPhone.includes('@g.us')) {
      try {
        const metadata = await this.whatsappSessionManager.getGroupMetadata(sessionId, contactPhone);
        mentions = (metadata.participants || []).map((p: any) => p.id);
      } catch (e) {
        console.warn(`[ENQUETE_GRUPO] Failed to fetch participants for mentions: `, e.message);
      }
    }

    return {
      nextNodeId: edges.find((e) => e.source === node.id)?.target || null,
      shouldWait: false,
      messageToSend: {
        sessionId,
        contactPhone,
        poll: {
          name: interpolatedQuestion,
          values: interpolatedOptions,
          selectableCount: config.multiplas ? interpolatedOptions.length : 1
        },
        mentions: mentions.length > 0 ? mentions : undefined
      }
    };
  }

  /**
   * Execute SEQUENCIA_LANCAMENTO node
   */
  private async executeSequenciaLancamento(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    defaultSessionId?: string,
    defaultContactPhone?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as SequenciaLancamentoConfig;
    const sessionId = config.sessionId || defaultSessionId;
    const contactPhone = (context.variables as any)?.groupJid
      || defaultContactPhone;
    const tenantId = (context.variables as any)?._tenantId || (context.globals as any)?.tenantId;
    const workflowId = (context.variables as any)?._workflowId;

    let link = await this.prisma.groupWorkflowLink.findFirst({
      where: { groupJid: contactPhone!, workflowId, tenantId: tenantId! }
    });

    if (!link) {
      link = await this.prisma.groupWorkflowLink.create({
        data: { groupJid: contactPhone!, workflowId, tenantId: tenantId!, isActive: true }
      });
    }

    const diffTime = Math.abs(new Date().getTime() - link.activatedAt.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const fase = config.fases.find(f => diffDays >= f.diaInicio && diffDays <= f.diaFim);

    if (!fase) {
      const nextEdge = edges.find((e) => e.source === node.id);
      return { nextNodeId: nextEdge ? nextEdge.target : null, shouldWait: false };
    }

    if (!sessionId || !contactPhone) throw new Error('Session and Contact are required for SEQUENCIA_LANCAMENTO');

    const msgConfig = fase.mensagem;
    const messageToSend: any = {
      sessionId,
      contactPhone,
      mentions: fase.mencionarTodos ? ['@all'] : undefined
    };

    if (msgConfig.type === 'text') {
      messageToSend.message = this.contextService.interpolate(msgConfig.text || '', context);
      messageToSend.simulateTyping = msgConfig.simulateTyping;
      messageToSend.typingDuration = msgConfig.typingDuration;
    } else {
      messageToSend.media = {
        type: msgConfig.type,
        url: this.contextService.interpolate(msgConfig.mediaUrl || '', context),
        caption: msgConfig.caption ? this.contextService.interpolate(msgConfig.caption, context) : undefined,
        sendAudioAsVoice: msgConfig.sendAudioAsVoice
      };
      messageToSend.simulateTyping = msgConfig.simulateTyping;
      messageToSend.simulateRecording = msgConfig.simulateRecording;
      messageToSend.recordingDuration = msgConfig.recordingDuration;
    }

    return {
      nextNodeId: edges.find((e) => e.source === node.id)?.target || null,
      shouldWait: false,
      messageToSend
    };
  }

  /**
   * Execute PROMO_ML_API node
   */
  private async executePromoMLApi(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    defaultSessionId?: string,
    defaultContactPhone?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as PromoMLApiConfig;
    const sessionId = config.sessionId || defaultSessionId;
    // Determine recipient - priority: variables.groupJid > context.contactId > defaultContactPhone
    const contactPhone = (context.variables as any)?.groupJid
      || context.contactId
      || defaultContactPhone;
    const tenantId = (context.variables as any)?._tenantId || (context.globals as any)?.tenantId;

    const searchTerm = this.contextService.interpolate(config.searchTerm, context);
    const category = config.category || 'MLA1051';

    console.log('[PROMO_ML] destination:', contactPhone);
    console.log('[PROMO_ML] sessionId:', sessionId);

    try {
      const response = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(searchTerm)}&category=${category}&limit=20`);
      const data = await response.json();
      const results = (data.results || []).map((p: any) => ({
        title: p.title,
        price: p.price,
        originalPrice: p.original_price || p.price,
        discount: p.original_price ? Math.round(((p.original_price - p.price) / p.original_price) * 100) : 0,
        rating: p.reviews?.rating_avg || 4.5,
        reviewCount: p.reviews?.total || 10,
        imageUrl: p.thumbnail,
        productUrl: p.permalink,
        seller: p.seller?.nickname || 'Mercado Livre'
      }));

      let filtered = results.filter((p: any) => {
        if (p.rating < (config.minRating || 0)) return false;
        if (p.discount < (config.minDiscount || 0)) return false;
        return true;
      });

      if (config.bestValue) filtered.sort((a: any, b: any) => b.discount - a.discount);
      filtered = filtered.slice(0, config.maxQuantity || 5);

      console.log('[PROMO_ML] produtos encontrados:', filtered.length);

      if (config.ignoreAlreadySent) {
        const sentUrls = await this.prisma.promoMLSent.findMany({
          where: { tenantId: tenantId!, productUrl: { in: filtered.map((p: any) => p.productUrl) } },
          select: { productUrl: true }
        });
        const sentUrlSet = new Set(sentUrls.map(s => s.productUrl));
        filtered = filtered.filter((p: any) => !sentUrlSet.has(p.productUrl));
      }

      const nextNodeId = edges.find((e) => e.source === node.id)?.target || null;
      console.log(`[PROMO_ML_API] passing to next node: ${nextNodeId}`);
      if (filtered.length === 0) {
        this.contextService.setVariable(context, 'promoApiProductsFound', false);
        return { nextNodeId, shouldWait: false };
      }

      this.contextService.setVariable(context, 'promoApiProductsFound', true);

      await this.prisma.promoMLSent.createMany({
        data: filtered.map((p: any) => ({
          productUrl: p.productUrl,
          tenantId: tenantId!,
          sentAt: new Date()
        }))
      });

      if (config.introText) {
        await this.whatsappSender.sendMessage(sessionId!, contactPhone!, this.contextService.interpolate(config.introText, context));
        await new Promise(r => setTimeout(r, 2000));
      }

      for (const p of filtered) {
        const offerText = `🔥 *${p.title}*\n\n💰 *R$ ${p.price.toLocaleString('pt-BR')}*\n🏷️ Desconto: ${p.discount}%\n⭐ Avaliação: ${p.rating}\n\n🛒 Compre agora: ${p.productUrl}${config.affiliateTag ? `?aff={${config.affiliateTag}}` : ''}`;
        await this.whatsappSender.sendMedia(sessionId!, contactPhone!, 'image', p.imageUrl, { caption: offerText });
        await new Promise(r => setTimeout(r, (config.messageInterval || 5) * 1000));
      }

      if (config.footerText) {
        await this.whatsappSender.sendMessage(sessionId!, contactPhone!, this.contextService.interpolate(config.footerText, context));
      }

    } catch (error) {
      console.error('[PROMO_ML_API] Error:', error);
    }

    const nextNodeId = edges.find((e) => e.source === node.id)?.target || null;
    console.log(`[PROMO_ML_API] passing to next node: ${nextNodeId}`);
    return {
      nextNodeId,
      shouldWait: false
    };
  }

  /**
   * Execute GRUPO_WAIT node – pauses the flow and resumes at a specific day/time.
   * Supports: Days after group activation, next fixed time, specific datetime, and simple interval.
   * Completely independent from executeWait.
   */
  async executeGrupoWait(
    node: WorkflowNode,
    context: ExecutionContext,
    _inputData: any,
    edges: any[],
    workflowId: string,
    executionId: string,
    defaultSessionId?: string,
    defaultContactPhone?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as GrupoWaitConfig;
    const contactPhone = (context.variables as any)?.groupJid
      || defaultContactPhone;
    const tenantId = (context.variables as any)?._tenantId || (context.globals as any)?.tenantId;

    // Check if we are resuming from a wait
    if ((context.variables as any)?._resumingGrupoWait) {
      console.log(`[GRUPO_WAIT] Resuming execution ${executionId} for node ${node.id}`);
      return {
        nextNodeId: edges.find((e) => e.source === node.id)?.target || null,
        shouldWait: false
      };
    }

    // Protection against duplicate pending executions for the same group + workflow + node
    const pendingExecution = await this.prisma.workflowExecution.findFirst({
      where: {
        workflowId,
        currentNodeId: node.id,
        contactPhone,
        status: ExecutionStatus.WAITING,
        id: { not: executionId }
      }
    });

    if (pendingExecution) {
      console.warn(`[GRUPO_WAIT] Duplicate pending execution found for group ${contactPhone}, skipping this one.`);
      return { nextNodeId: null, shouldWait: false };
    }

    let wakeUpAt: Date;
    const now = new Date();

    switch (config.mode) {
      case 'days_after': {
        // 1. Get activatedAt from group_workflow_links
        const groupLink = await this.prisma.groupWorkflowLink.findFirst({
          where: {
            groupJid: contactPhone,
            workflowId: workflowId,
            tenantId: tenantId!
          },
          orderBy: { createdAt: 'desc' }
        });

        const baseDate = groupLink?.activatedAt || now;
        const days = config.daysAfter || 0;
        const [hours, minutes] = (config.time || '09:00').split(':').map(Number);

        wakeUpAt = new Date(baseDate);
        wakeUpAt.setDate(wakeUpAt.getDate() + days);
        wakeUpAt.setHours(hours || 9, minutes || 0, 0, 0);
        break;
      }

      case 'fixed_time': {
        const [hours, minutes] = (config.time || '09:00').split(':').map(Number);
        wakeUpAt = new Date(now);
        wakeUpAt.setHours(hours || 9, minutes || 0, 0, 0);

        if (wakeUpAt <= now) {
          wakeUpAt.setDate(wakeUpAt.getDate() + 1);
        }
        break;
      }

      case 'datetime': {
        const [year, month, day] = (config.date || now.toISOString().split('T')[0]).split('-').map(Number);
        const [hours, minutes] = (config.time || '09:00').split(':').map(Number);
        wakeUpAt = new Date(year, month - 1, day, hours, minutes, 0, 0);
        break;
      }

      case 'interval': {
        const amount = config.intervalAmount || 1;
        const unit = config.intervalUnit || 'hours';
        wakeUpAt = new Date(now);
        if (unit === 'days') {
          wakeUpAt.setDate(wakeUpAt.getDate() + amount);
        } else {
          wakeUpAt.setHours(wakeUpAt.getHours() + amount);
        }
        break;
      }

      default:
        wakeUpAt = new Date(now.getTime() + 60000); // 1 minute fallback
    }

    // Protection: if wakeUpAt is in the past, resume almost immediately
    if (wakeUpAt <= now) {
      console.log(`[GRUPO_WAIT] Calculated wakeUpAt is in the past (${wakeUpAt.toISOString()}), resuming in 5s.`);
      wakeUpAt = new Date(now.getTime() + 5000);
    }

    const waitTimeoutSeconds = Math.max(1, Math.floor((wakeUpAt.getTime() - now.getTime()) / 1000));

    console.log(`[GRUPO_WAIT] Node ${node.id} waiting until ${wakeUpAt.toISOString()} (${waitTimeoutSeconds}s) for group ${contactPhone}`);

    return {
      nextNodeId: node.id,
      shouldWait: true,
      waitTimeoutSeconds,
      _resumingGrupoWait: true
    };
  }

  /**
   * Execute GRUPO_MEDIA node – sends media (image/audio/ptt/video) to a WhatsApp group.
   * Supports: PTT audio, auto-mentions, retry logic, and scheduling.
   * Completely independent from executeSendMedia.
   */
  /**
   * Execute GRUPO_MEDIA node – sends media (image/audio/ptt/video) to a WhatsApp group.
   * Supports: PTT audio, auto-mentions with cooldown, retry logic, and persistent scheduling.
   * Completely independent from executeSendMedia.
   */
  private async executeGrupoMedia(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    defaultSessionId?: string,
    defaultContactPhone?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as any;
    const sessionId = config.sessionId || defaultSessionId;
    const destination = config.groupJid
      || (context.variables as any)?.groupJid
      || context.contactId
      || defaultContactPhone;
    const contactPhone = destination;
    const tenantId = (context.variables as any)?._tenantId || (context.globals as any)?.tenantId;

    // Find designated next node (if any)
    const nextEdge = edges.find((e) => e.source === node.id);
    const nextNodeId = nextEdge?.target || null;

    if (!sessionId || !contactPhone) {
      console.error('[GRUPO_MEDIA] Missing sessionId or contactPhone. Skipping.');
      return { nextNodeId, shouldWait: false };
    }

    // ── Persistent Scheduling Integration ────────────────────────────────
    const isResuming = context.variables._resumingGrupoMedia === true;

    if (!isResuming && config.scheduling?.enabled) {
      const now = new Date();
      let scheduledTime: Date | null = null;
      const scheduling = config.scheduling;

      if (scheduling.mode === 'datetime' && scheduling.date && scheduling.time) {
        scheduledTime = new Date(`${scheduling.date}T${scheduling.time}:00`);
      } else if (scheduling.mode === 'daily' && scheduling.time) {
        const [h, m] = scheduling.time.split(':').map(Number);
        scheduledTime = new Date();
        scheduledTime.setHours(h, m, 0, 0);
        if (scheduledTime < now) {
          scheduledTime.setDate(scheduledTime.getDate() + 1);
        }
      } else if (scheduling.mode === 'days_after') {
        const link = await this.prisma.groupWorkflowLink.findFirst({
          where: { groupJid: contactPhone, isActive: true },
        });
        if (link) {
          const [h, m] = (scheduling.time || '09:00').split(':').map(Number);
          scheduledTime = new Date(link.activatedAt);
          scheduledTime.setDate(scheduledTime.getDate() + (parseInt(scheduling.day || '0', 10)));
          scheduledTime.setHours(h, m, 0, 0);

          if (scheduledTime < now) {
            console.log('[GRUPO_MEDIA] Scheduled days_after time already past, executing immediately.');
            scheduledTime = null;
          }
        }
      }

      if (scheduledTime) {
        const delayMs = scheduledTime.getTime() - now.getTime();
        if (delayMs > 0) {
          console.log(`[GRUPO_MEDIA] Delaying execution until ${scheduledTime.toISOString()} (${Math.round(delayMs / 1000)}s)`);

          // Mark as resuming for the next run
          context.variables._resumingGrupoMedia = true;

          return {
            nextNodeId: node.id, // Re-execute this same node on resume
            shouldWait: true,
            waitTimeoutSeconds: Math.ceil(delayMs / 1000),
          };
        }
      }
    }

    // Clear the resume flag as we are now doing the actual work
    delete context.variables._resumingGrupoMedia;

    // JID validation (Warning only as per original implementation, but stricter for groups)
    if (!contactPhone.includes('@g.us')) {
      console.warn(`[GRUPO_MEDIA] contactPhone "${contactPhone}" is NOT a group JID. Node is exclusive for groups.`);
    }

    // ── Build message ────────────────────────────────────────────────────
    const mediaUrl = this.contextService.interpolate(config.mediaUrl || '', context);
    const caption = config.caption ? this.contextService.interpolate(config.caption, context) : undefined;
    const isPTT = config.mediaType === 'ptt';
    const maxAttempts = (parseInt(config.retryCount ?? '3', 10) || 0) + 1;

    // ── Mentions (with optional cooldown) ────────────────────────────────
    let mentions: string[] = [];
    if (config.mentionAll && contactPhone.includes('@g.us')) {
      try {
        const cooldownMinutes = parseInt(config.mentionCooldown ?? '60', 10) || 60;
        const cooldownAgo = new Date(Date.now() - cooldownMinutes * 60 * 1000);

        const recentMention = await this.prisma.groupMentionLog.findFirst({
          where: { groupJid: contactPhone, mentionedAt: { gte: cooldownAgo } },
        });

        if (!recentMention && tenantId) {
          const metadata = await this.whatsappSessionManager.getGroupMetadata(sessionId, contactPhone);
          mentions = (metadata.participants || []).map((p: any) => p.id);

          if (mentions.length > 0) {
            await this.prisma.groupMentionLog.create({
              data: { groupJid: contactPhone, tenantId, mentionedAt: new Date() },
            });
          }
        } else if (recentMention) {
          console.warn(`[GRUPO_MEDIA] Mention cooldown (${cooldownMinutes}m) active for ${contactPhone}. Skipping @mentions.`);
        }
      } catch (mentionErr) {
        console.error('[GRUPO_MEDIA] Failed to fetch group metadata for mentions:', mentionErr);
      }
    }

    // ── Send with retry ──────────────────────────────────────────────────
    const sendPayload = {
      type: isPTT ? 'audio' : (config.mediaType || 'image'),
      url: mediaUrl,
      caption: isPTT ? undefined : caption,
      mimetype: isPTT ? 'audio/ogg; codecs=opus' : undefined,
      ptt: isPTT ? true : undefined,
      sendAudioAsVoice: isPTT ? true : undefined,
      mentions: mentions.length > 0 ? mentions : undefined,
    };

    let attempts = 0;
    let lastError: any = null;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        console.log(`[GRUPO_MEDIA] Attempt ${attempts}/${maxAttempts}: sending ${config.mediaType} to ${contactPhone}`);

        await this.whatsappSender.sendMedia(sessionId, contactPhone, sendPayload.type as any, sendPayload.url, {
          caption: sendPayload.caption,
          mimetype: sendPayload.mimetype,
          ptt: sendPayload.ptt,
          sendAudioAsVoice: sendPayload.sendAudioAsVoice,
          mentions: sendPayload.mentions,
        });

        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        console.error(`[GRUPO_MEDIA] Attempt ${attempts} failed:`, err);
        if (attempts < maxAttempts) {
          // Wait 30 seconds before next attempt
          await new Promise((res) => setTimeout(res, 30_000));
        }
      }
    }

    if (lastError) {
      console.error(`[GRUPO_MEDIA] All ${maxAttempts} attempts failed. Last error:`, lastError);
      this.contextService.setOutput(context, {
        error: String(lastError),
        mediaType: config.mediaType,
        contactPhone,
        success: false,
      });
    } else {
      if (config.logSend !== false) {
        console.log(`[GRUPO_MEDIA] Send successful – type=${config.mediaType}, group=${contactPhone}, mentions=${mentions.length}`);
      }
      this.contextService.setOutput(context, {
        success: true,
        mediaType: config.mediaType,
        contactPhone,
        mentionsSent: mentions.length,
      });
    }

    return {
      nextNodeId,
      shouldWait: false,
    };
  }

  /**
   * Execute RANDOMIZER node
   */
  private async executeRandomizer(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    workflowId?: string,
    executionId?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as RandomizerConfig;
    const saidas = config.saidas || [];
    const tenantId = context.variables._tenantId || 'unknown';

    if (saidas.length === 0) {
      throw new Error('Randomizer node must have at least one output');
    }

    let selectedSaida = null;

    // 1. Check consistency (A/B Test / Sticky sessions)
    // We use a contact variable prefixed with _rand_ to persist the choice
    if (config.fixarPorContato) {
      const consistencyKey = `_rand_sticky_${node.id}`;
      const previousSelectionId = this.contextService.getVariable(context, consistencyKey);

      if (previousSelectionId) {
        selectedSaida = saidas.find(s => s.id === previousSelectionId);
      }
    }

    // 2. Weighted selection (if not already selected by consistency)
    if (!selectedSaida) {
      const random = Math.random() * 100;
      let cumulative = 0;

      for (const saida of saidas) {
        cumulative += saida.porcentagem;
        if (random <= cumulative) {
          selectedSaida = saida;
          break;
        }
      }

      // Fallback to last one if rounding issues/misconfiguration
      if (!selectedSaida) selectedSaida = saidas[saidas.length - 1];

      // Save selection for future consistency
      if (config.fixarPorContato && selectedSaida) {
        const consistencyKey = `_rand_sticky_${node.id}`;
        this.contextService.setVariable(context, consistencyKey, selectedSaida.id);
      }
    }

    // 3. Store result in variable if requested
    if (config.saveAs && selectedSaida) {
      this.contextService.setVariable(context, config.saveAs, selectedSaida.nome);
    }

    // 4. Record Analytics in Database (saidaNome fix)
    if (config.enableAnalytics && selectedSaida) {
      try {
        await this.prisma.randomizerStat.create({
          data: {
            nodeId: node.id,
            saidaNome: selectedSaida.nome,
            workflowId: workflowId || context.workflowId || 'unknown',
            tenantId,
          }
        });
      } catch (err) {
        console.error(`[RANDOMIZER] Failed to log analytics for node ${node.id}:`, err);
      }
    }

    // 5. Routing - Find edge matching selected saida ID
    const nextEdge = edges.find(
      (e) => e.source === node.id && (e.condition === selectedSaida?.id || e.label === selectedSaida?.nome),
    );

    const nextNodeId = nextEdge ? nextEdge.target : null;

    this.contextService.setOutput(context, {
      selectedSaidaId: selectedSaida?.id,
      selectedSaidaNome: selectedSaida?.nome,
      porcentagem: selectedSaida?.porcentagem,
    });

    return {
      nextNodeId,
      shouldWait: false,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PIXEL_EVENT — Meta Conversions API
  // ─────────────────────────────────────────────────────────────────────────

  private hashSHA256(value: string): string {
    return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
  }

  private resolvePixelEventName(eventType: string, customName?: string): string {
    const map: Record<string, string> = {
      Lead: 'Lead',
      QualifiedLead: 'Lead',
      DisqualifiedLead: 'Lead',
      Contact: 'Contact',
      InitiateCheckout: 'InitiateCheckout',
      Purchase: 'Purchase',
      CompleteRegistration: 'CompleteRegistration',
      ViewContent: 'ViewContent',
      AddToCart: 'AddToCart',
      Subscribe: 'Subscribe',
      CustomEvent: customName || 'CustomEvent',
    };
    return map[eventType] || eventType;
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private async executePixelEvent(
    node: WorkflowNode,
    context: ExecutionContext,
    edges: any[],
    sessionId?: string,
    contactPhone?: string,
  ): Promise<NodeExecutionResult> {
    const config = node.config as any; // PixelEventConfig
    const variables = context.variables || {};
    const tenantId = variables._tenantId as string;

    let resolvedPixelId = '';
    let resolvedAccessToken = '';
    let resolvedTestEventCode = config.testEventCode
      ? this.contextService.interpolate(config.testEventCode, context)
      : undefined;

    // 1. Check if a specific Pixel Config ID is selected
    if (config.pixelConfigId && config.pixelConfigId !== 'manual') {
      const pixelConfig = await (this.prisma as any).tenantPixelConfig.findFirst({
        where: { id: config.pixelConfigId, tenantId },
      });

      if (pixelConfig) {
        resolvedPixelId = pixelConfig.pixelId;
        resolvedAccessToken = pixelConfig.accessToken;
        // If the node doesn't have a manual test code, use the one from pixel config
        if (!resolvedTestEventCode) {
          resolvedTestEventCode = pixelConfig.testEventCode;
        }
      }
    }

    // 2. Fallback to manual config or default pixel if still empty
    if (!resolvedPixelId || !resolvedAccessToken) {
      if (config.pixelId && config.accessToken) {
        resolvedPixelId = this.contextService.interpolate(config.pixelId, context);
        resolvedAccessToken = this.contextService.interpolate(config.accessToken, context);
      } else {
        // Find default pixel for tenant
        const defaultPixel = await (this.prisma as any).tenantPixelConfig.findFirst({
          where: { tenantId, isDefault: true },
        });

        if (defaultPixel) {
          resolvedPixelId = defaultPixel.pixelId;
          resolvedAccessToken = defaultPixel.accessToken;
          if (!resolvedTestEventCode) {
            resolvedTestEventCode = defaultPixel.testEventCode;
          }
        }
      }
    }

    if (!resolvedPixelId || !resolvedAccessToken) {
      const nextNodeId = edges.find((e) => e.source === node.id)?.target || null;
      this.contextService.setVariable(context, 'pixelEventResult', {
        success: false,
        error: 'Missing Pixel ID or Access Token',
        eventType: config.eventType,
      });
      return { nextNodeId, shouldWait: false };
    }

    const eventId = config.eventId
      ? this.contextService.interpolate(config.eventId, context)
      : this.generateUUID();

    const resolvedEventName = this.resolvePixelEventName(config.eventType, config.customEventName);

    // Build user_data
    const userData: Record<string, any> = {
      country: [this.hashSHA256('br')],
    };

    const rawPhone = (contactPhone || variables.contactPhone || '').replace(/\D/g, '');
    if (config.includePhone !== false && rawPhone) {
      userData.ph = [this.hashSHA256(rawPhone)];
    }

    const contactName = variables.contactName as string | undefined;
    if (config.includeName !== false && contactName) {
      const nameParts = contactName.trim().split(/\s+/);
      userData.fn = [this.hashSHA256(nameParts[0])];
      if (nameParts.length > 1) {
        userData.ln = [this.hashSHA256(nameParts.slice(1).join(' '))];
      }
    }

    if (config.includeState !== false && variables.contactState) {
      userData.st = [this.hashSHA256(String(variables.contactState).toLowerCase())];
    }

    if (config.includeCtwaClid !== false && variables.adCtwaClid) {
      userData.ctwa_clid = variables.adCtwaClid;
    }

    // Build custom_data
    const customData: Record<string, any> = {
      currency: config.currency || 'BRL',
    };

    if (config.includeValue && config.value) {
      const resolvedValue = this.contextService.interpolate(config.value, context);
      const parsed = parseFloat(resolvedValue.replace(',', '.'));
      if (!isNaN(parsed)) customData.value = parsed;
    }

    if (config.includeProduct) {
      if (config.productName) {
        customData.content_name = this.contextService.interpolate(config.productName, context);
      }
      if (config.productId) {
        customData.content_ids = [this.contextService.interpolate(config.productId, context)];
      }
    }

    if (config.eventType === 'QualifiedLead') {
      customData.lead_event_source = 'qualified';
    } else if (config.eventType === 'DisqualifiedLead') {
      customData.lead_event_source = 'disqualified';
    }

    if (config.includeLeadStatus && config.leadStatus) {
      customData.status = this.contextService.interpolate(config.leadStatus, context);
    }

    const pixelPayload: Record<string, any> = {
      data: [{
        event_name: resolvedEventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'system_generated',
        user_data: userData,
        custom_data: customData,
      }],
      access_token: resolvedAccessToken,
    };

    if (resolvedTestEventCode) {
      pixelPayload.test_event_code = resolvedTestEventCode;
    }

    let success = false;
    let fbtraceId: string | undefined;
    let errorMsg: string | undefined;

    try {
      const url = `https://graph.facebook.com/v18.0/${resolvedPixelId}/events`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pixelPayload),
      });

      const responseData: any = await response.json();
      fbtraceId = responseData.fbtrace_id;

      if (response.ok && !responseData.error) {
        success = true;
        console.log(`[PIXEL_EVENT] Event ${resolvedEventName} sent successfully (fbtrace_id: ${fbtraceId})`);
      } else {
        errorMsg = responseData.error?.message || `HTTP ${response.status}`;
        console.error(`[PIXEL_EVENT] Meta API error: ${errorMsg}`);
      }
    } catch (err: any) {
      errorMsg = err.message;
      console.error(`[PIXEL_EVENT] Network error sending event:`, err.message);
    }

    const result = {
      success,
      eventId,
      fbtrace_id: fbtraceId,
      eventType: config.eventType,
      matchQuality: success ? 'high' : 'low',
      error: errorMsg,
    };

    this.contextService.setVariable(context, 'pixelEventResult', result);

    // Log to execution_logs
    try {
      await (this.prisma as any).executionLog.create({
        data: {
          tenantId: context.globals?.tenantId || '',
          executionId: context.executionId || '',
          nodeId: node.id,
          eventType: 'PIXEL_EVENT',
          data: {
            eventName: resolvedEventName,
            eventId,
            contactPhone: rawPhone ? `${rawPhone.substring(0, 4)}****` : null,
            contactState: variables.contactState || null,
            ctwaClid: variables.adCtwaClid || null,
            success,
            fbtrace_id: fbtraceId,
            error: errorMsg,
          },
        },
      });
    } catch (logErr) {
      console.error('[PIXEL_EVENT] Failed to log execution:', logErr);
    }

    const nextNodeId = edges.find((e) => e.source === node.id)?.target || null;
    return { nextNodeId, shouldWait: false, output: result };
  }
}


