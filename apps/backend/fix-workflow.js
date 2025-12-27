const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Removendo nó Switch corrompido...');
  
  // Get all workflows
  const workflows = await prisma.workflow.findMany({
    where: { tenantId: 'demo-tenant' }
  });
  
  for (const workflow of workflows) {
    const nodes = workflow.nodes;
    const edges = workflow.edges;
    
    // Filter out nodes with undefined type or id starting with "undefined-"
    const cleanNodes = nodes.filter(node => {
      const isCorrupted = !node.type || node.id.startsWith('undefined-');
      if (isCorrupted) {
        console.log(`❌ Removendo nó corrompido: ${node.id}`);
      }
      return !isCorrupted;
    });
    
    // Remove edges connected to corrupted nodes
    const corruptedNodeIds = nodes.filter(n => !n.type || n.id.startsWith('undefined-')).map(n => n.id);
    const cleanEdges = edges.filter(edge => {
      const isConnectedToCorrupted = corruptedNodeIds.includes(edge.source) || corruptedNodeIds.includes(edge.target);
      if (isConnectedToCorrupted) {
        console.log(`❌ Removendo edge: ${edge.id}`);
      }
      return !isConnectedToCorrupted;
    });
    
    if (cleanNodes.length !== nodes.length || cleanEdges.length !== edges.length) {
      await prisma.workflow.update({
        where: { id: workflow.id },
        data: {
          nodes: cleanNodes,
          edges: cleanEdges
        }
      });
      console.log(`✅ Workflow "${workflow.name}" limpo! Removidos ${nodes.length - cleanNodes.length} nós e ${edges.length - cleanEdges.length} edges`);
    }
  }
  
  console.log('\n✨ Limpeza concluída!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
