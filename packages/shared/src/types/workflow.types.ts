export enum WorkflowNodeType {
  TRIGGER_MESSAGE = 'TRIGGER_MESSAGE',
  TRIGGER_SCHEDULE = 'TRIGGER_SCHEDULE',
  TRIGGER_MANUAL = 'TRIGGER_MANUAL',
  SEND_MESSAGE = 'SEND_MESSAGE',
  SEND_MEDIA = 'SEND_MEDIA',
  SEND_BUTTONS = 'SEND_BUTTONS',
  SEND_LIST = 'SEND_LIST',
  HTTP_REQUEST = 'HTTP_REQUEST',
  HTTP_SCRAPE = 'HTTP_SCRAPE',
  CODE = 'CODE',
  EDIT_FIELDS = 'EDIT_FIELDS',
  MANAGE_LABELS = 'MANAGE_LABELS',
  SET_TAGS = 'SET_TAGS',
  CONDITION = 'CONDITION',
  SWITCH = 'SWITCH',
  WAIT_REPLY = 'WAIT_REPLY',
  WAIT = 'WAIT',
  LOOP = 'LOOP',
  COMMAND = 'COMMAND',
  PIX_RECOGNITION = 'PIX_RECOGNITION',
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
  contactPhone: string;
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
  isBusiness: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Node Configurations

export interface TriggerMessageConfig {
  pattern: string; // regex or exact match
  matchType: 'exact' | 'regex' | 'contains' | 'starts_with';
  sessionId?: string; // WhatsApp session to listen to (optional, if empty listens to all)
}

export interface TriggerMessagePayload {
  messageId: string;
  from: string;
  fromMe: boolean;
  type: 'text' | 'media';
  text: string | null;
  media: {
    mediaType: 'image' | 'video' | 'audio' | 'document';
    mimeType: string;
    fileName: string | null;
    size: number;
    url: string;
  } | null;
  timestamp: number;
}

export interface TriggerScheduleConfig {
  scheduleType: 'cron' | 'interval';
  cronExpression?: string; // for cron type
  intervalMinutes?: number; // for interval type
  sessionId?: string; // WhatsApp session to use for execution
  timezone?: string;
}

export interface SendMessageConfig {
  message: string; // supports {{variables.name}} syntax
  delay?: number; // milliseconds
  sessionId?: string; // Optional: Override session
  to?: string; // Optional: Override recipient (phone number)
}

export interface SendMediaConfig {
  mediaType: 'image' | 'video' | 'audio' | 'document';
  mediaUrl: string; // URL to download the media, supports {{variables.name}} syntax
  caption?: string; // optional caption for image/video, supports {{variables.name}} syntax
  fileName?: string; // optional filename for document, supports {{variables.name}} syntax
  sendAudioAsVoice?: boolean; // if true and mediaType is audio, send as voice message (PTT)
  delay?: number; // milliseconds
  sessionId?: string; // Optional: Override session
  to?: string; // Optional: Override recipient (phone number)
}

export interface SendButtonsConfig {
  message: string; // supports {{variables.name}} syntax
  buttons: Array<{
    id: string;
    text: string;
  }>;
  footer?: string;
  delay?: number;
}

export interface SendListConfig {
  message: string; // supports {{variables.name}} syntax
  buttonText: string; // text on the button that opens the list
  sections: Array<{
    title: string;
    rows: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
  }>;
  footer?: string;
  delay?: number;
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

export interface HttpRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  url: string; // supports {{variables.name}} syntax
  authentication?: 'none' | 'basic' | 'bearer' | 'header';
  authConfig?: {
    username?: string;
    password?: string;
    token?: string;
    headerName?: string;
    headerValue?: string;
  };
  headers?: Array<{ key: string; value: string }>;
  queryParams?: Array<{ key: string; value: string }>;
  body?: string; // JSON string, supports {{variables.name}} syntax
  bodyType?: 'json' | 'form' | 'raw';
  timeout?: number; // milliseconds, default 30000
  saveResponseAs?: string; // variable name to save response, default 'httpResponse'
  followRedirects?: boolean;
  ignoreSSLIssues?: boolean;
}

export interface HttpScrapeConfig {
  url: string; // supports {{variables.name}} syntax
  waitFor?: 'networkidle0' | 'networkidle2' | 'load' | 'domcontentloaded' | 'selector'; // wait strategy
  waitSelector?: string; // CSS selector to wait for (if waitFor is 'selector')
  waitTimeout?: number; // milliseconds, default 30000
  extractSelector?: string; // CSS selector to extract data (extracts innerHTML if provided)
  extractType?: 'html' | 'text' | 'json'; // how to extract data
  executeScript?: string; // JavaScript code to execute on page (supports {{variables.name}} syntax)
  screenshot?: boolean; // take screenshot
  viewport?: {
    width?: number;
    height?: number;
  };
  headers?: Array<{ key: string; value: string }>; // custom headers
  timeout?: number; // overall timeout in milliseconds, default 60000
  saveResponseAs?: string; // variable name to save response, default 'scrapeResponse'
}

export interface ManageLabelsConfig {
  action: 'add' | 'remove' | 'list';
  labelIds?: string[]; // IDs of labels to add/remove
  labelNames?: string[]; // Names of labels to add/remove (will be created if don't exist)
  saveLabelsAs?: string; // variable name to save current labels, default 'chatLabels'
}

export interface CodeConfig {
  mode: 'runOnceForAllItems' | 'runOnceForEachItem';
  code: string; // JavaScript code to execute
  language?: 'javascript' | 'python'; // Future: support multiple languages
}

export interface CommandConfig {
  command: string; // Full command to execute (can include arguments), supports {{variables.name}} syntax
  timeout?: number; // Timeout in milliseconds, default 30000
  saveOutputAs?: string; // Variable name to save stdout, default 'commandOutput'
  saveErrorAs?: string; // Variable name to save stderr, default 'commandError'
  saveExitCodeAs?: string; // Variable name to save exit code, default 'commandExitCode'
}

export interface TriggerManualConfig {
  sessionId?: string; // Optional: specific WhatsApp session to use
  testData?: Record<string, any>; // Optional: test data to inject into context
}

export interface EditFieldsOperation {
  id: string;
  name: string; // Field name
  value: string; // Field value (supports {{variables.name}} syntax)
  type?: 'string' | 'number' | 'boolean' | 'json';
}

export interface EditFieldsConfig {
  mode: 'json' | 'fields'; // JSON mode or visual fields mode
  jsonData?: string; // For JSON mode
  operations: EditFieldsOperation[]; // For fields mode
  includeOtherFields?: boolean; // Include fields from input that aren't explicitly set
}

export interface WaitConfig {
  unit: 'seconds' | 'minutes' | 'hours' | 'days';
  amount: number; // Amount of time to wait
  resumeOnMessage?: boolean; // If true, can be resumed by incoming message (like WAIT_REPLY)
}

export interface SetTagsConfig {
  action: 'add' | 'remove' | 'set' | 'clear'; // add: adiciona tags, remove: remove tags, set: substitui todas, clear: limpa todas
  tags: string[]; // Tags to add/remove/set
}

export interface LoopConfig {
  loopMode: 'array' | 'count'; // Iterate over array or fixed count
  arraySource?: string; // Variable containing the array (e.g., "scrapeResponse.scriptResult")
  itemVariableName?: string; // Variable name for current item (default: "item")
  indexVariableName?: string; // Variable name for index (default: "index")
  count?: number; // For loopMode === 'count'
  batchSize?: number; // Process in batches (optional)
}

export interface PixRecognitionConfig {
  imageUrl?: string; // supports {{variables.name}} syntax
  validateAmount?: boolean;
  expectedAmount?: string; // supports {{variables.name}} syntax
  validateDate?: boolean; // If true, validates if receipt is from today
  expectedReceiverName?: string; // supports {{variables.name}} syntax
  acceptedValues?: string; // comma-separated values, e.g. "19.90, 29.90"
  saveResponseAs?: string; // default 'pixResult'
}

