import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

/**
 * ============================================================
 * 🔧 SEED — Criação de Usuários e Dados Iniciais
 * ============================================================
 *
 * Este arquivo cria os dados iniciais do banco de dados.
 * Para rodar: pnpm db:seed  (ou npx prisma db seed)
 *
 * 📌 COMO CRIAR NOVOS USUÁRIOS:
 * 1. Crie (ou reutilize) um Tenant (organização/empresa)
 * 2. Crie um User vinculado ao Tenant com:
 *    - email: email do usuário
 *    - password: hash bcrypt da senha (use bcrypt.hash('senha', 10))
 *    - name: nome do usuário
 *    - role: 'SUPER_ADMIN' or 'ADMIN'
 *    - tenantId: ID do tenant
 *
 * 📌 ROLES DISPONÍVEIS:
 *    - SUPER_ADMIN: Acesso total ao sistema
 *    - ADMIN: Acesso administrativo dentro do tenant
 *
 * 📌 EXEMPLO para adicionar um novo usuário:
 *    const novaSenha = await bcrypt.hash('minhaSenha123', 10)
 *    await prisma.user.upsert({
 *      where: { tenantId_email: { tenantId: 'ID_DO_TENANT', email: 'novo@email.com' } },
 *      update: { password: novaSenha },
 *      create: {
 *        email: 'novo@email.com',
 *        password: novaSenha,
 *        name: 'Nome do Usuário',
 *        tenantId: 'ID_DO_TENANT',
 *        role: 'ADMIN',
 *      } as any,
 *    })
 *
 * Depois de editar, rode: pnpm db:seed
 * ============================================================
 */

const prisma = new PrismaClient()

async function main() {
  // ── Super Admin Tenant ──────────────────────────────────
  const superAdminTenant = await prisma.tenant.upsert({
    where: { email: 'superadmin@gmail.com' },
    update: {},
    create: {
      id: 'superadmin-tenant',
      name: 'Super Admin Tenant',
      email: 'superadmin@gmail.com',
      isActive: true,
    },
  })

  console.log('Created superadmin tenant:', superAdminTenant)

  // ── Super Admin User ────────────────────────────────────
  const superAdminPassword = await bcrypt.hash('@superadmin123', 10)
  const superAdminUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: superAdminTenant.id,
        email: 'superadmin@gmail.com',
      },
    },
    update: {
      password: superAdminPassword,
      isActive: true,
      role: 'SUPER_ADMIN',
    } as any,
    create: {
      email: 'superadmin@gmail.com',
      password: superAdminPassword,
      name: 'Super Admin',
      tenantId: superAdminTenant.id,
      isActive: true,
      role: 'SUPER_ADMIN',
    } as any,
  })

  console.log('Created superadmin user:', {
    email: superAdminUser.email,
    tenantId: superAdminUser.tenantId,
    role: (superAdminUser as any).role,
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
    } as any,
    create: {
      email: 'admin@demo.com',
      password: defaultPassword,
      name: 'Demo Admin',
      tenantId: tenant.id,
      isActive: true,
      role: 'ADMIN',
    } as any,
  })

  console.log('Created default user:', {
    email: defaultUser.email,
    tenantId: defaultUser.tenantId,
    password: 'demo123', // Only for initial setup
  })

  // Create sample workflow (only if it doesn't already exist)
  const existingWorkflow = await prisma.workflow.findFirst({
    where: { tenantId: tenant.id, name: 'Welcome Flow' },
  })

  if (!existingWorkflow) {
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
  } else {
    console.log('Sample workflow already exists, skipping...')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })





