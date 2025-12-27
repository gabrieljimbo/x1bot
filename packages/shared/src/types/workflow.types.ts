export enum WorkflowNodeType {
  TRIGGER_MESSAGE = 'TRIGGER_MESSAGE',
  TRIGGER_SCHEDULE = 'TRIGGER_SCHEDULE',
  SEND_MESSAGE = 'SEND_MESSAGE',
  CONDITION = 'CONDITION',
  SWITCH = 'SWITCH',
  WAIT_REPLY = 'WAIT_REPLY',
  END = 'END',
}

export enum ExecutionStatus {
  RUNNING = 'RUNNING',
  WAITING = 'WAITING',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  ERROR = 'ERROR',
}

export enum WhatsappSessionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  QR_CODE = 'QR_CODE',
  ERROR = 'ERROR',
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  config: Record<string, any>;
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string;
}

export interface Workflow {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionContext {
  globals: Record<string, any>;
  input: Record<string, any>;
  output: Record<string, any>;
  variables: Record<string, any>;
}

export interface WorkflowExecution {
  id: string;
  tenantId: string;
  workflowId: string;
  sessionId: string;
  contactId: string;
  currentNodeId: string | null;
  status: ExecutionStatus;
  context: ExecutionContext;
  interactionCount: number;
  startedAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface WhatsappSession {
  id: string;
  tenantId: string;
  name: string;
  status: WhatsappSessionStatus;
  qrCode?: string;
  phoneNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Node Configurations

export interface TriggerMessageConfig {
  pattern: string; // regex or exact match
  matchType: 'exact' | 'regex' | 'contains';
}

export interface TriggerScheduleConfig {
  cronExpression: string;
  timezone?: string;
}

export interface SendMessageConfig {
  message: string; // supports {{variables.name}} syntax
  delay?: number; // milliseconds
}

export interface ConditionConfig {
  expression: string; // e.g., "variables.selectedOption === '2'"
  branches: {
    true: string; // target node id
    false: string; // target node id
  };
}

export interface WaitReplyConfig {
  saveAs: string; // variable name to save response
  timeoutSeconds: number;
  onTimeout: 'END' | 'GOTO_NODE';
  timeoutTargetNodeId?: string;
}

export interface EndConfig {
  outputVariables?: string[]; // variables to include in final output
}

export interface SwitchRule {
  id: string;
  value1: string; // e.g., "variables.opcao"
  operator: string; // ==, !=, >, <, >=, <=, .includes(, etc.
  value2: string; // e.g., "1"
  outputKey: string; // e.g., "0", "1", "2" - used as sourceHandle
}

export interface SwitchConfig {
  mode: 'rules' | 'expression';
  rules: SwitchRule[];
  fallbackOutput?: string; // default output if no rules match
}

