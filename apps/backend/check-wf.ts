import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();

async function main() {
    // Check GroupTriggerExecution count
    const execCount = await (prisma as any).groupTriggerExecution.count();

    // Check GroupWorkflowLink count
    const linkCount = await (prisma as any).groupWorkflowLink.count();

    // Check WhatsappGroupConfig count to see if groups are registered elsewhere
    const groupConfigCount = await (prisma as any).whatsappGroupConfig.count();
    const groupConfigs = await (prisma as any).whatsappGroupConfig.findMany({ take: 5 });

    // Check all workflows  
    const workflows = await (prisma as any).workflow.findMany({
        select: { id: true, name: true, isActive: true, nodes: true }
    });

    const result = {
        execCount,
        linkCount,
        groupConfigCount,
        groupConfigs,
        workflowCount: workflows.length,
        workflows: workflows.map((w: any) => ({
            id: w.id,
            name: w.name,
            isActive: w.isActive,
            nodeTypes: (w.nodes || []).map((n: any) => n.type)
        }))
    };

    writeFileSync('/tmp/db-check.json', JSON.stringify(result, null, 2));
    console.log('Written to /tmp/db-check.json');
}

main().finally(() => prisma.$disconnect());
