export declare enum WorkflowNodeType {
    TRIGGER_MESSAGE = "TRIGGER_MESSAGE",
    TRIGGER_SCHEDULE = "TRIGGER_SCHEDULE",
    SEND_MESSAGE = "SEND_MESSAGE",
    CONDITION = "CONDITION",
    WAIT_REPLY = "WAIT_REPLY",
    END = "END"
}
export declare enum ExecutionStatus {
    RUNNING = "RUNNING",
    WAITING = "WAITING",
    COMPLETED = "COMPLETED",
    EXPIRED = "EXPIRED",
    ERROR = "ERROR"
}
export declare enum WhatsappSessionStatus {
    DISCONNECTED = "DISCONNECTED",
    CONNECTING = "CONNECTING",
    CONNECTED = "CONNECTED",
    QR_CODE = "QR_CODE",
    ERROR = "ERROR"
}
export interface WorkflowNode {
    id: string;
    type: WorkflowNodeType;
    config: Record<string, any>;
    position?: {
        x: number;
        y: number;
    };
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
    createdAt: Date;
    updatedAt: Date;
}
export interface TriggerMessageConfig {
    pattern: string;
    matchType: 'exact' | 'regex' | 'contains';
}
export interface TriggerScheduleConfig {
    cronExpression: string;
    timezone?: string;
}
export interface SendMessageConfig {
    message: string;
    delay?: number;
}
export interface ConditionConfig {
    expression: string;
    branches: {
        true: string;
        false: string;
    };
}
export interface WaitReplyConfig {
    saveAs: string;
    timeoutSeconds: number;
    onTimeout: 'END' | 'GOTO_NODE';
    timeoutTargetNodeId?: string;
}
export interface EndConfig {
    outputVariables?: string[];
}
