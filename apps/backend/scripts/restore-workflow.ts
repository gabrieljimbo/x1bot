import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function restore() {
    const sql = fs.readFileSync(path.join(__dirname, 'insert-teste-jimbo.sql'), 'utf-8');

    const matches = sql.match(/\$\$(\[.*?\])\$\$/gs);
    if (!matches || matches.length < 2) {
        throw new Error('Could not parse nodes and edges from the SQL script.');
    }

    const nodesArr = JSON.parse(matches[0].replace(/^\$\$|\$\$$/g, ''));
    const edgesArr = JSON.parse(matches[1].replace(/^\$\$|\$\$$/g, ''));

    const tenant = await prisma.tenant.findFirst();
    if (!tenant) throw new Error('No tenant found in the database. Need at least one tenant to restore.');

    const tenantId = tenant.id;
    const workflowId = '936b95ac-2876-4800-9c1d-add3d2b8b7da';
    const name = 'Teste Jimbo';

    console.log(`Restoring workflow ${name} to tenant ${tenantId}...`);

    try {
        const result = await prisma.workflow.upsert({
            where: { id: workflowId },
            update: {
                tenantId,
                name,
                nodes: nodesArr,
                edges: edgesArr,
                isActive: true,
            },
            create: {
                id: workflowId,
                tenantId,
                name,
                nodes: nodesArr,
                edges: edgesArr,
                isActive: true,
            }
        });
        console.log('Successfully restored!', result.id);
    } catch (err) {
        console.error('Failed to restore:', err);
    } finally {
        await prisma.$disconnect();
    }
}

restore();
