import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();

async function main() {
    const wf = await prisma.workflow.findUnique({ where: { id: 'cmmdvlabb00cr10sz1pzht9wp' } });
    if (!wf) { console.log('NOT FOUND'); return; }

    const nodes = wf.nodes as any[] || [];
    const edges = wf.edges as any[] || [];

    const triggerGrupo = nodes.find(n => n.type === 'TRIGGER_GRUPO');
    const triggerManual = nodes.find(n => n.type === 'TRIGGER_MANUAL');

    const edgesFromGrupo = triggerGrupo ? edges.filter(e => e.source === triggerGrupo.id) : [];
    const edgesFromManual = triggerManual ? edges.filter(e => e.source === triggerManual.id) : [];

    const result = {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        triggerGrupoNode: triggerGrupo || null,
        triggerManualNode: triggerManual || null,
        edgesFromGrupo,
        edgesFromManual,
        allEdges: edges,
    };

    writeFileSync('/tmp/wf-check.json', JSON.stringify(result, null, 2));
    console.log('Written to /tmp/wf-check.json');
}

main().finally(() => prisma.$disconnect());
