# N9N Architecture Documentation

## Overview

N9N is a multi-tenant SaaS platform for creating and managing conversational workflows via WhatsApp Web. It's designed as a **Conversation Workflow Engine as a Service**.

## Core Principles

### 1. State Machine Architecture

Every workflow execution is a **persistent state machine**:

- State is stored in PostgreSQL
- No in-memory-only executions
- Executions can pause and resume
- Full audit trail via event logs

### 2. Anti-Deadlock Mechanisms

Four layers of protection against infinite conversations:

1. **Global TTL**: Every execution has an `expiresAt` timestamp
2. **Node TTL**: `WAIT_REPLY` nodes have individual timeouts
3. **Interaction Limit**: Maximum number of interactions per execution
4. **Mandatory END**: All workflows must terminate in an END node

### 3. Multi-Tenancy

Complete data isolation:

- All queries filtered by `tenantId`
- Separate WhatsApp sessions per tenant
- No cross-tenant data access

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Workflow     │  │ Real-time    │  │ Session      │      │
│  │ Canvas       │  │ Monitoring   │  │ Management   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                    WebSocket + REST API
                            │
┌─────────────────────────────────────────────────────────────┐
│                      Backend (NestJS)                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Execution Engine                         │  │
│  │  • Node Executor                                      │  │
│  │  • Context Manager                                    │  │
│  │  • State Machine Loop                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         WhatsApp Session Manager                      │  │
│  │  • Multi-session support                              │  │
│  │  • Message routing                                    │  │
│  │  • QR code handling                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Event Bus                                │  │
│  │  • Internal events                                    │  │
│  │  • WebSocket broadcast                                │  │
│  │  • Audit logging                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Background Workers                          │  │
│  │  • Expiration checker                                 │  │
│  │  • Timeout processor                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
┌───────▼────────┐                    ┌────────▼────────┐
│   PostgreSQL   │                    │     Redis       │
│                │                    │                 │
│ • Workflows    │                    │ • Locks         │
│ • Executions   │                    │ • Timeouts      │
│ • Sessions     │                    │ • Cache         │
│ • Logs         │                    │                 │
└────────────────┘                    └─────────────────┘
```

## Execution Flow

### Starting a Workflow

1. User sends WhatsApp message
2. Message received by WhatsApp Session Manager
3. Check for active execution
4. If none, match against workflow triggers
5. Create new `WorkflowExecution` with:
   - `status = RUNNING`
   - `expiresAt = now + TTL`
   - Initial context
6. Start execution loop

### Execution Loop

```typescript
while (execution.status === RUNNING && currentNodeId) {
  1. Get current node
  2. Execute node
  3. Emit NODE_EXECUTED event
  4. Handle result:
     - If shouldWait: pause execution, set status = WAITING
     - If nextNodeId: continue to next node
     - If no nextNodeId: complete execution
}
```

### Resuming Execution

1. User sends reply
2. Find active execution (`status = WAITING`)
3. Check if expired
4. Process reply (save to context)
5. Update status to `RUNNING`
6. Continue execution loop

## Node Types

### TRIGGER_MESSAGE

- Starts workflow on matching message
- Pattern matching: exact, contains, regex
- Not executed in loop (only for matching)

### SEND_MESSAGE

- Sends WhatsApp message
- Supports variable interpolation: `{{variables.name}}`
- Optional delay
- Advances immediately

### WAIT_REPLY

- Pauses execution
- Waits for user response
- Saves response to variable
- Has timeout configuration
- Can redirect on timeout

### CONDITION

- Evaluates expression
- Routes to different branches
- Expression syntax: `variables.option === '1'`

### END

- Terminates execution
- Sets status to `COMPLETED`
- Can output specific variables

## Context System

Every execution has a persistent context:

```typescript
{
  globals: {},      // Global workflow data
  input: {},        // Input to current node
  output: {},       // Output from current node
  variables: {}     // Persistent variables
}
```

### Variable Interpolation

```typescript
"Hello {{variables.userName}}"
→ "Hello John"
```

### Expression Evaluation

```typescript
"variables.selectedOption === '2'"
→ true/false
```

## Concurrency Control

### Distributed Locks (Redis)

```typescript
const lockKey = `execution:lock:${tenantId}:${sessionId}:${contactId}`
await redis.acquireLock(lockKey, 30)
```

Prevents:
- Duplicate executions
- Race conditions
- Concurrent modifications

### One Active Execution Rule

Only one execution per (tenant + session + contact) can be active.

## TTL Management

### Global Execution TTL

```typescript
expiresAt = now + EXECUTION_DEFAULT_TTL_HOURS
```

### Node-Level Timeout

```typescript
WAIT_REPLY {
  timeoutSeconds: 300,
  onTimeout: 'END' | 'GOTO_NODE'
}
```

### Expiration Worker

Runs every minute:
1. Query expired executions
2. Update status to `EXPIRED`
3. Emit `EXECUTION_EXPIRED` event
4. Release locks

## Event System

All events are:
1. Emitted via EventBus
2. Broadcast via WebSocket
3. Persisted to `execution_logs`

Event types:
- `execution.started`
- `execution.resumed`
- `execution.waiting`
- `execution.completed`
- `execution.expired`
- `execution.error`
- `node.executed`

## WhatsApp Integration

### Session Management

Each session:
- One `whatsapp-web.js` client
- Isolated event handlers
- QR code for authentication
- Automatic reconnection

### Message Routing

```
WhatsApp Message
  ↓
Session Manager
  ↓
Message Handler
  ↓
Active Execution? → Resume
  ↓
No Active → Match Trigger → Start New
```

## Security & Isolation

### Tenant Isolation

- All queries include `tenantId`
- No shared state between tenants
- Separate WhatsApp sessions

### Execution Isolation

- Context is sandboxed
- No access to other executions
- Expression evaluation is safe

## Scalability Considerations

### Current Architecture

- Single-instance deployment
- In-memory WhatsApp sessions
- Suitable for small-medium scale

### Future Scaling

To scale horizontally:

1. **Session Affinity**: Route tenant to specific instance
2. **Shared State**: Move sessions to Redis
3. **Queue System**: Use Bull/BullMQ for execution
4. **Database Sharding**: Partition by tenantId

## Testing Strategy

### Unit Tests

- Node executors
- Context interpolation
- Expression evaluation

### Integration Tests

- Execution engine
- WhatsApp message handling
- TTL expiration

### E2E Tests

- Complete workflow execution
- Pause and resume
- Timeout handling

## Monitoring

Key metrics to track:

- Active executions
- Execution duration
- Node execution time
- Expiration rate
- WhatsApp session status

## Deployment

### Requirements

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Chrome/Chromium (for Puppeteer)

### Environment Variables

See `.env.example` files in backend and frontend.

### Database Migrations

```bash
pnpm db:migrate
pnpm db:seed
```

## Conclusion

N9N is designed as a **deterministic, auditable, and scalable** conversation workflow engine. Every execution is traceable, every conversation has an end, and the system is built for multi-tenancy from the ground up.


