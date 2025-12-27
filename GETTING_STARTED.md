# Getting Started with N9N

## Prerequisites

- Node.js 18+ and pnpm 8+
- PostgreSQL 14+
- Redis 6+
- Chrome/Chromium (for WhatsApp Web automation)

## Installation

1. **Clone and install dependencies**

```bash
cd n9n
pnpm install
```

2. **Setup Backend Environment**

```bash
cd apps/backend
cp .env.example .env
```

Edit `.env` and configure:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/n9n"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret-key
```

3. **Setup Frontend Environment**

```bash
cd apps/frontend
cp .env.example .env
```

Edit `.env`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

4. **Setup Database**

```bash
cd apps/backend
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

This creates:
- Database schema
- Demo tenant
- Sample workflow

5. **Start Development Servers**

From the root directory:

```bash
pnpm dev
```

This starts:
- Backend API on http://localhost:3001
- Frontend on http://localhost:3000

## Creating Your First Workflow

### 1. Connect WhatsApp Session

1. Go to http://localhost:3000
2. Click "Connect" under WhatsApp Sessions
3. Enter a session name
4. Scan the QR code with WhatsApp
5. Wait for "CONNECTED" status

### 2. Create a Workflow

1. Click "Create" under Workflows
2. Enter workflow name and description
3. You'll see the workflow canvas

### 3. Build Your Flow

**Example: Simple Welcome Bot**

```
TRIGGER_MESSAGE (pattern: "hello")
    ↓
SEND_MESSAGE ("Hello! What's your name?")
    ↓
WAIT_REPLY (saveAs: "userName", timeout: 300s)
    ↓
SEND_MESSAGE ("Nice to meet you, {{variables.userName}}!")
    ↓
END
```

### 4. Activate Workflow

Click the "Inactive" button to activate the workflow.

### 5. Test It!

Send "hello" to your WhatsApp number and watch the flow execute in real-time!

## Understanding the Canvas

### Node Types

- **📨 Message Trigger**: Starts workflow when message matches pattern
- **💬 Send Message**: Sends a message (supports variables)
- **⏳ Wait Reply**: Pauses and waits for user response
- **🔀 Condition**: Routes based on expression
- **🏁 End**: Terminates workflow

### Visual Indicators

- **Green border + pulse**: Currently executing node
- **Yellow border**: Waiting for user input
- **Red border**: Error state

## Using Variables

### Setting Variables

In `WAIT_REPLY` node:
```json
{
  "saveAs": "userName"
}
```

### Using Variables

In `SEND_MESSAGE` node:
```
Hello {{variables.userName}}!
Your choice was {{variables.selectedOption}}
```

### Conditions

In `CONDITION` node:
```javascript
variables.selectedOption === '1'
variables.age > 18
variables.userName.includes('John')
```

## API Usage

### Create Workflow

```bash
curl -X POST http://localhost:3001/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "demo-tenant",
    "name": "My Workflow",
    "description": "Test workflow"
  }'
```

### Update Workflow

```bash
curl -X PUT http://localhost:3001/api/workflows/{id}?tenantId=demo-tenant \
  -H "Content-Type: application/json" \
  -d '{
    "nodes": [...],
    "edges": [...],
    "isActive": true
  }'
```

### Send Message

```bash
curl -X POST http://localhost:3001/api/whatsapp/sessions/{sessionId}/send \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "5511999999999",
    "message": "Hello from API!"
  }'
```

## WebSocket Events

Connect to real-time events:

```javascript
import { io } from 'socket.io-client'

const socket = io('http://localhost:3001', {
  query: { tenantId: 'demo-tenant' }
})

socket.on('workflow:event', (event) => {
  console.log('Event:', event.type, event)
})
```

Event types:
- `execution.started`
- `node.executed`
- `execution.waiting`
- `execution.completed`
- `execution.expired`

## Troubleshooting

### WhatsApp won't connect

- Make sure Chrome/Chromium is installed
- Check Puppeteer executable path in `.env`
- Try deleting `.wwebjs_auth` folder and reconnecting

### Workflow not triggering

- Check workflow is active
- Verify trigger pattern matches your message
- Check WhatsApp session is connected
- Look at backend logs for errors

### Execution stuck

- Check `expiresAt` timestamp
- Verify `WAIT_REPLY` timeout is set
- Run expiration worker manually: check logs

### Database issues

```bash
# Reset database
pnpm db:migrate:reset
pnpm db:seed
```

## Next Steps

- Read [ARCHITECTURE.md](./ARCHITECTURE.md) for deep dive
- Explore example workflows in `apps/backend/prisma/seed.ts`
- Build complex flows with conditions and loops
- Integrate with external APIs (coming soon)

## Production Deployment

### Environment Setup

1. Use production PostgreSQL instance
2. Use Redis cluster for high availability
3. Set strong JWT_SECRET
4. Configure proper CORS_ORIGIN
5. Use process manager (PM2, Docker)

### Database

```bash
pnpm db:migrate:prod
```

### Build

```bash
pnpm build
```

### Start

```bash
# Backend
cd apps/backend
pnpm start

# Frontend
cd apps/frontend
pnpm start
```

## Support

For issues and questions, check:
- Architecture documentation
- Code comments
- Example workflows

Happy building! 🚀


