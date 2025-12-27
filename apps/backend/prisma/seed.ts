import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { email: 'demo@n9n.com' },
    update: {},
    create: {
      id: 'demo-tenant',
      name: 'Demo Tenant',
      email: 'demo@n9n.com',
      isActive: true,
    },
  })

  console.log('Created demo tenant:', tenant)

  // Create sample workflow
  const workflow = await prisma.workflow.create({
    data: {
      tenantId: tenant.id,
      name: 'Welcome Flow',
      description: 'Simple welcome message flow',
      isActive: false,
      nodes: [
        {
          id: 'trigger-1',
          type: 'TRIGGER_MESSAGE',
          config: {
            pattern: 'hello',
            matchType: 'contains',
          },
          position: { x: 250, y: 0 },
        },
        {
          id: 'send-1',
          type: 'SEND_MESSAGE',
          config: {
            message: 'Hello! Welcome to N9N. What is your name?',
          },
          position: { x: 250, y: 100 },
        },
        {
          id: 'wait-1',
          type: 'WAIT_REPLY',
          config: {
            saveAs: 'userName',
            timeoutSeconds: 300,
            onTimeout: 'END',
          },
          position: { x: 250, y: 200 },
        },
        {
          id: 'send-2',
          type: 'SEND_MESSAGE',
          config: {
            message: 'Nice to meet you, {{variables.userName}}! 👋',
          },
          position: { x: 250, y: 300 },
        },
        {
          id: 'end-1',
          type: 'END',
          config: {
            outputVariables: ['userName'],
          },
          position: { x: 250, y: 400 },
        },
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'trigger-1',
          target: 'send-1',
        },
        {
          id: 'edge-2',
          source: 'send-1',
          target: 'wait-1',
        },
        {
          id: 'edge-3',
          source: 'wait-1',
          target: 'send-2',
        },
        {
          id: 'edge-4',
          source: 'send-2',
          target: 'end-1',
        },
      ],
    },
  })

  console.log('Created sample workflow:', workflow)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


