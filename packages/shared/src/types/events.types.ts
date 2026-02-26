import { ExecutionStatus } from './workflow.types';

export enum EventType {
  // Execution events
  EXECUTION_STARTED = 'execution.started',
  EXECUTION_RESUMED = 'execution.resumed',
  EXECUTION_WAITING = 'execution.waiting',
  EXECUTION_COMPLETED = 'execution.completed',
  EXECUTION_EXPIRED = 'execution.expired',
  EXECUTION_ERROR = 'execution.error',
  
  // Node events
  NODE_EXECUTED = 'node.executed',
  
  // WhatsApp events
  WHATSAPP_MESSAGE_RECEIVED = 'whatsapp.message.received',
  WHATSAPP_SESSION_CONNECTED = 'whatsapp.session.connected',
  WHATSAPP_SESSION_DISCONNECTED = 'whatsapp.session.disconnected',
  WHATSAPP_QR_CODE = 'whatsapp.qr.code',
}

export interface BaseEvent {
  type: EventType;
  tenantId: string;
  timestamp: Date;
}

export interface ExecutionEvent extends BaseEvent {
  executionId: string;
  workflowId: string;
  sessionId: string;
  contactPhone: string;
}

export interface ExecutionStartedEvent extends ExecutionEvent {
  type: EventType.EXECUTION_STARTED;
}

export interface ExecutionResumedEvent extends ExecutionEvent {
  type: EventType.EXECUTION_RESUMED;
  previousStatus: ExecutionStatus;
}

export interface ExecutionWaitingEvent extends ExecutionEvent {
  type: EventType.EXECUTION_WAITING;
  currentNodeId: string;
  timeoutSeconds: number;
}

export interface ExecutionCompletedEvent extends ExecutionEvent {
  type: EventType.EXECUTION_COMPLETED;
  output: Record<string, any>;
}

export interface ExecutionExpiredEvent extends ExecutionEvent {
  type: EventType.EXECUTION_EXPIRED;
  currentNodeId: string | null;
}

export interface ExecutionErrorEvent extends ExecutionEvent {
  type: EventType.EXECUTION_ERROR;
  error: string;
  currentNodeId: string | null;
}

export interface NodeExecutedEvent extends ExecutionEvent {
  type: EventType.NODE_EXECUTED;
  nodeId: string;
  nodeType: string;
  duration: number;
  output?: Record<string, any>;
  variables?: Record<string, any>; // Variables available as input when node was executed
  input?: Record<string, any>; // Explicit input data
}

export interface WhatsappMessageReceivedEvent extends BaseEvent {
  type: EventType.WHATSAPP_MESSAGE_RECEIVED;
  sessionId: string;
  contactPhone: string;
  message: string;
  timestamp: Date;
}

export interface WhatsappSessionConnectedEvent extends BaseEvent {
  type: EventType.WHATSAPP_SESSION_CONNECTED;
  sessionId: string;
  phoneNumber: string;
}

export interface WhatsappSessionDisconnectedEvent extends BaseEvent {
  type: EventType.WHATSAPP_SESSION_DISCONNECTED;
  sessionId: string;
  reason?: string;
}

export interface WhatsappQrCodeEvent extends BaseEvent {
  type: EventType.WHATSAPP_QR_CODE;
  sessionId: string;
  qrCode: string;
}

export type WorkflowEvent =
  | ExecutionStartedEvent
  | ExecutionResumedEvent
  | ExecutionWaitingEvent
  | ExecutionCompletedEvent
  | ExecutionExpiredEvent
  | ExecutionErrorEvent
  | NodeExecutedEvent
  | WhatsappMessageReceivedEvent
  | WhatsappSessionConnectedEvent
  | WhatsappSessionDisconnectedEvent
  | WhatsappQrCodeEvent;





