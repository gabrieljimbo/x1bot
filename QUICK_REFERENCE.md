# N9N Quick Reference

## 🚀 Quick Start Commands

```bash
# Install dependencies
pnpm install

# Start databases
docker-compose up -d

# Setup database
cd apps/backend
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# Start development
cd ../..
pnpm dev
```

## 📁 Project Structure

```
n9n/
├── apps/
│   ├── backend/          # NestJS API (Port 3001)
│   └── frontend/         # Next.js UI (Port 3000)
└── packages/
    └── shared/           # Shared TypeScript types
```

## 🎨 Node Types

| Node | Icon | Purpose | Continues? |
|------|------|---------|-----------|
| TRIGGER_MESSAGE | 📨 | Start workflow on message | No |
| SEND_MESSAGE | 💬 | Send WhatsApp message | Yes |
| WAIT_REPLY | ⏳ | Wait for user response | Pauses |
| CONDITION | 🔀 | Branch based on expression | Yes |
| END | 🏁 | Terminate workflow | No |

## 🔧 Node Configurations

### TRIGGER_MESSAGE
```json
{
  "pattern": "hello",
  "matchType": "exact" | "contains" | "regex"
}
```

### SEND_MESSAGE
```json
{
  "message": "Hello {{variables.name}}!",
  "delay": 1000  // optional, milliseconds
}
```

### WAIT_REPLY
```json
{
  "saveAs": "userName",
  "timeoutSeconds": 300,
  "onTimeout": "END" | "GOTO_NODE",
  "timeoutTargetNodeId": "node-id"  // if GOTO_NODE
}
```

### CONDITION
```json
{
  "expression": "variables.age >= 18"
}
```

### END
```json
{
  "outputVariables": ["userName", "email"]  // optional
}
```

## 💬 Variable Syntax

### Set Variable (WAIT_REPLY)
```json
{ "saveAs": "userName" }
```

### Use Variable (SEND_MESSAGE)
```
Hello {{variables.userName}}!
```

### Condition Expression
```javascript
variables.age > 18
variables.option === '1'
variables.email.includes('@')
```

## 🌐 API Endpoints

### Workflows
```bash
GET    /api/workflows?tenantId=xxx
GET    /api/workflows/:id?tenantId=xxx
POST   /api/workflows
PUT    /api/workflows/:id?tenantId=xxx
DELETE /api/workflows/:id?tenantId=xxx
```

### WhatsApp Sessions
```bash
GET    /api/whatsapp/sessions?tenantId=xxx
GET    /api/whatsapp/sessions/:id?tenantId=xxx
POST   /api/whatsapp/sessions
DELETE /api/whatsapp/sessions/:id?tenantId=xxx
POST   /api/whatsapp/sessions/:id/send
```

### Executions
```bash
GET    /api/executions/:id?tenantId=xxx
GET    /api/executions/:id/logs?tenantId=xxx
```

## 🔌 WebSocket Events

```javascript
import { io } from 'socket.io-client'

const socket = io('http://localhost:3001', {
  query: { tenantId: 'your-tenant-id' }
})

socket.on('workflow:event', (event) => {
  console.log(event.type, event)
})
```

### Event Types
- `execution.started`
- `execution.resumed`
- `execution.waiting`
- `execution.completed`
- `execution.expired`
- `execution.error`
- `node.executed`
- `whatsapp.message.received`
- `whatsapp.session.connected`
- `whatsapp.qr.code`

## 🗄️ Database Models

### Workflow
```typescript
{
  id: string
  tenantId: string
  name: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  isActive: boolean
}
```

### WorkflowExecution
```typescript
{
  id: string
  tenantId: string
  workflowId: string
  sessionId: string
  contactId: string
  currentNodeId: string | null
  status: ExecutionStatus
  context: ExecutionContext
  interactionCount: number
  expiresAt: Date
}
```

### WhatsappSession
```typescript
{
  id: string
  tenantId: string
  name: string
  status: WhatsappSessionStatus
  phoneNumber?: string
}
```

## ⚙️ Environment Variables

### Backend (.env)
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/n9n"
REDIS_HOST=localhost
REDIS_PORT=6379
PORT=3001
EXECUTION_DEFAULT_TTL_HOURS=24
EXECUTION_MAX_INTERACTIONS=20
WAIT_REPLY_DEFAULT_TIMEOUT_SECONDS=300
```

### Frontend (.env)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 🔒 Anti-Deadlock Mechanisms

1. **Global TTL**: `expiresAt` on every execution
2. **Node TTL**: Timeout on WAIT_REPLY nodes
3. **Interaction Limit**: Max interactions per execution
4. **Mandatory END**: All workflows must have END node

## 📊 Execution Status

| Status | Description |
|--------|-------------|
| RUNNING | Currently executing nodes |
| WAITING | Paused, waiting for user input |
| COMPLETED | Successfully finished |
| EXPIRED | TTL reached |
| ERROR | Failed with error |

## 🎯 Common Patterns

### Simple Q&A
```
TRIGGER → SEND → END
```

### Collect Input
```
TRIGGER → SEND → WAIT → SEND → END
```

### Conditional Branch
```
TRIGGER → SEND → WAIT → CONDITION
                           ├─ TRUE → SEND → END
                           └─ FALSE → SEND → END
```

### Multi-Step Form
```
TRIGGER → SEND → WAIT → SEND → WAIT → SEND → WAIT → SEND → END
```

## 🐛 Debugging

### Check Logs
```bash
# Backend logs
cd apps/backend
pnpm dev

# Frontend logs
cd apps/frontend
pnpm dev
```

### Database Queries
```bash
cd apps/backend
pnpm db:studio
```

### Redis Commands
```bash
redis-cli
> KEYS execution:*
> GET execution:lock:tenant:session:contact
```

### View Execution Logs
```bash
curl http://localhost:3001/api/executions/{id}/logs?tenantId=xxx
```

## 🧪 Testing

### Run Tests
```bash
cd apps/backend
pnpm test
```

### Test Workflow
1. Create workflow in UI
2. Activate workflow
3. Connect WhatsApp session
4. Send trigger message
5. Watch execution in real-time

## 📦 Database Commands

```bash
# Generate Prisma client
pnpm db:generate

# Create migration
pnpm db:migrate

# Reset database
pnpm db:migrate:reset

# Seed data
pnpm db:seed

# Open Prisma Studio
pnpm db:studio
```

## 🚨 Common Issues

### WhatsApp won't connect
- Check Chrome/Chromium installed
- Delete `.wwebjs_auth` folder
- Restart backend

### Workflow not triggering
- Check workflow is active
- Verify trigger pattern
- Check session is connected

### Execution stuck
- Check `expiresAt` timestamp
- Verify timeout settings
- Check expiration worker logs

### Database errors
```bash
pnpm db:migrate:reset
pnpm db:seed
```

## 📚 Documentation Files

- `README.md` - Project overview
- `ARCHITECTURE.md` - System design deep dive
- `GETTING_STARTED.md` - Step-by-step tutorial
- `EXAMPLE_WORKFLOWS.md` - Workflow examples
- `DIAGRAMS.md` - Visual diagrams
- `PROJECT_SUMMARY.md` - Complete summary
- `QUICK_REFERENCE.md` - This file

## 🎨 UI Colors

- Background: `#000000` (Black)
- Primary: `#00FF88` (Green)
- Surface: `#111111`
- Border: `#222222`

## 🔑 Key Concepts

- **State Machine**: Executions are persistent state machines
- **Multi-tenant**: Complete data isolation by tenantId
- **Stateful**: Pause and resume capability
- **TTL**: All conversations have an end
- **Event-driven**: All actions emit events
- **Distributed Locks**: Prevent race conditions

## 💡 Tips

1. Always set timeouts on WAIT_REPLY
2. Use clear variable names
3. Test edge cases
4. Keep messages concise
5. Validate user input
6. Provide fallback paths
7. Monitor execution logs

## 🚀 Production Checklist

- [ ] Set strong JWT_SECRET
- [ ] Configure production DATABASE_URL
- [ ] Setup Redis cluster
- [ ] Configure CORS_ORIGIN
- [ ] Run database migrations
- [ ] Setup monitoring
- [ ] Configure backups
- [ ] Setup SSL/TLS
- [ ] Configure rate limiting
- [ ] Setup logging

## 📞 Support

For issues:
1. Check documentation
2. Review example workflows
3. Check execution logs
4. Review architecture docs

---

**Quick Tip**: Keep this file open while developing! 🚀




