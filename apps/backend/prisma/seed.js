const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

async function main() {
  // Create superadmin tenant
  const superAdminTenant = await prisma.tenant.upsert({
    where: { email: 'superadmin@n9n.com' },
    update: {},
    create: {
      id: 'superadmin-tenant',
      name: 'Super Admin Tenant',
      email: 'superadmin@n9n.com',
      isActive: true,
    },
  })

  console.log('Created superadmin tenant:', superAdminTenant)

  // Create superadmin user
  const superAdminPassword = await bcrypt.hash('superadmin123', 10)
  const superAdminUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: superAdminTenant.id,
        email: 'superadmin@n9n.com',
      },
    },
    update: {
      password: superAdminPassword,
      isActive: true,
      role: 'SUPER_ADMIN',
    },
    create: {
      email: 'superadmin@n9n.com',
      password: superAdminPassword,
      name: 'Super Admin',
      tenantId: superAdminTenant.id,
      isActive: true,
      role: 'SUPER_ADMIN',
    },
  })

  console.log('Created superadmin user:', {
    email: superAdminUser.email,
    tenantId: superAdminUser.tenantId,
    role: superAdminUser.role,
    password: 'superadmin123', // Only for initial setup
  })

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

  // Create default user for demo tenant
  const defaultPassword = await bcrypt.hash('demo123', 10)
  const defaultUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'admin@demo.com',
      },
    },
    update: {
      password: defaultPassword,
      isActive: true,
      role: 'ADMIN',
    },
    create: {
      email: 'admin@demo.com',
      password: defaultPassword,
      name: 'Demo Admin',
      tenantId: tenant.id,
      isActive: true,
      role: 'ADMIN',
    },
  })

  console.log('Created default user:', {
    email: defaultUser.email,
    tenantId: defaultUser.tenantId,
    password: 'demo123', // Only for initial setup
  })

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
