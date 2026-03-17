/**
 * Seed: Fluxo "Ensaios Por IA — Nicho Pet"
 * Cria o fluxo para o tenant do usuário jimbo@gmail.com
 *
 * Execução:
 *   cd apps/backend
 *   pnpm exec ts-node -r tsconfig-paths/register --project tsconfig.json prisma/seeds/flow-ensaios-pet.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const uid = () => `node-${Math.random().toString(36).slice(2, 10)}`;
const eid = () => `edge-${Math.random().toString(36).slice(2, 10)}`;

// ─── IDs FIXOS ────────────────────────────────────────────────────────────────
const IDS = {
  hookA:         uid(),
  waitHook:      uid(),
  condHook:      uid(),
  audioApres:    uid(),
  waitApres:     uid(),
  midia1:        uid(),
  midia2:        uid(),
  midia3:        uid(),
  msgProva:      uid(),
  waitProva:     uid(),
  ancoragem:     uid(),
  waitAnc:       uid(),
  ofertaStarter: uid(),
  waitOferta:    uid(),
  condOferta:    uid(),
  upsell:        uid(),
  pagamento:     uid(),
  audioGarantia: uid(),
  waitGarantia:  uid(),
  condGarantia:  uid(),
  delay24h:      uid(),
  black1:        uid(),
  black2Audio:   uid(),
  black3:        uid(),
  black5:        uid(),
  black6:        uid(),
  posVenda:      uid(),
  delay3d:       uid(),
  recompra:      uid(),
};

// ─── NODES ────────────────────────────────────────────────────────────────────
// Layout horizontal: fluxo principal em y=400, x cresce 280px por node
// Branches abaixo (y=700) ou acima (y=100)

const nodes = [

  // ── HOOK A — Universal ────────────────────────────────── x=0, y=400
  {
    id: IDS.hookA,
    type: 'SEND_MESSAGE',
    position: { x: 0, y: 400 },
    config: {
      message:
        'Oi! 🐾\n\nVocê tem mil fotos do seu pet no celular, né?\n\nMas tem alguma que você imprimiria e colocaria numa moldura?\n\nPosso te mostrar o que a gente faz com uma foto comum de celular?',
    },
  },

  // ── WAIT REPLY HOOK ───────────────────────────────────── x=280, y=400
  {
    id: IDS.waitHook,
    type: 'WAIT_REPLY',
    position: { x: 280, y: 400 },
    config: {
      saveAs: 'respostaHook',
      timeoutAmount: 24,
      timeoutUnit: 'hours',
      onTimeout: 'END',
    },
  },

  // ── CONDITION: respondeu positivamente? ───────────────── x=560, y=400
  // true  = não contém "não" → áudio apresentação
  // false = contém "não"     → black2 áudio
  {
    id: IDS.condHook,
    type: 'CONDITION',
    position: { x: 560, y: 400 },
    config: {
      expression: '!variables.respostaHook.toLowerCase().includes("não")',
      branches: {
        true: IDS.audioApres,
        false: IDS.black2Audio,
      },
    },
  },

  // ── ÁUDIO APRESENTAÇÃO ────────────────────────────────── x=840, y=400
  {
    id: IDS.audioApres,
    type: 'SEND_MEDIA',
    position: { x: 840, y: 400 },
    config: {
      mediaType: 'audio',
      mediaUrl: '',
      sendAudioAsVoice: true,
      caption: '',
      // Placeholder para upload manual:
      // Script (40-55s): Tecnologia transforma fotos comuns em ensaio de estúdio.
      // Não precisa levar o pet a lugar nenhum, não precisa esperar cooperar.
      // Manda a foto que já tem. Resultado tão bom que perguntam qual estúdio.
      // Quando fala R$19,90 pelo WhatsApp ninguém acredita. Vai mandar 3 exemplos.
    },
  },

  // ── WAIT após áudio (5 min → avança para mídias) ─────── x=1120, y=400
  {
    id: IDS.waitApres,
    type: 'WAIT_REPLY',
    position: { x: 1120, y: 400 },
    config: {
      saveAs: 'respostaApres',
      timeoutAmount: 5,
      timeoutUnit: 'minutes',
      onTimeout: 'GOTO_NODE',
      timeoutTargetNodeId: IDS.midia1,
    },
  },

  // ── MÍDIA 1 (antes/depois — cachorro pequeno) ─────────── x=1400, y=400
  {
    id: IDS.midia1,
    type: 'SEND_MEDIA',
    position: { x: 1400, y: 400 },
    config: {
      mediaType: 'image',
      mediaUrl: '',
      caption: '',
    },
  },

  // ── MÍDIA 2 (antes/depois — gato) ────────────────────── x=1680, y=400
  {
    id: IDS.midia2,
    type: 'SEND_MEDIA',
    position: { x: 1680, y: 400 },
    config: {
      mediaType: 'image',
      mediaUrl: '',
      caption: '',
    },
  },

  // ── MÍDIA 3 (antes/depois — cachorro grande) ──────────── x=1960, y=400
  {
    id: IDS.midia3,
    type: 'SEND_MEDIA',
    position: { x: 1960, y: 400 },
    config: {
      mediaType: 'image',
      mediaUrl: '',
      caption: '',
    },
  },

  // ── TEXTO PROVA SOCIAL ────────────────────────────────── x=2240, y=400
  {
    id: IDS.msgProva,
    type: 'SEND_MESSAGE',
    position: { x: 2240, y: 400 },
    config: {
      message:
        'Cada uma dessas fotos começou igual à que você tem no celular.\n\nFoto qualquer. Fundo de casa. Luz comum.\n\nO que você viu do lado direito é exatamente o que a gente entrega.\n\nJá fizemos isso pra mais de 500 pets.\nOs donos postam, o pessoal para no feed, todo mundo pergunta qual fotógrafo.\n\nQuer ver como funciona na prática?',
    },
  },

  // ── WAIT PROVA ────────────────────────────────────────── x=2520, y=400
  {
    id: IDS.waitProva,
    type: 'WAIT_REPLY',
    position: { x: 2520, y: 400 },
    config: {
      saveAs: 'respostaProva',
      timeoutAmount: 24,
      timeoutUnit: 'hours',
      onTimeout: 'END',
    },
  },

  // ── ANCORAGEM ─────────────────────────────────────────── x=2800, y=400
  {
    id: IDS.ancoragem,
    type: 'SEND_MESSAGE',
    position: { x: 2800, y: 400 },
    config: {
      message:
        'É simples assim:\n\n📱 Você manda a foto do seu pet pelo WhatsApp\n✨ A gente faz a transformação\n📩 Você recebe em alta resolução em horas\n\n—\n\nUm ensaio pet com fotógrafo profissional custa R$250 a R$400.\nExige levar o pet, esperar ele cooperar, agendar com semanas de antecedência.\n\nAqui o resultado é o mesmo.\nVocê não sai de casa.\nE o preço começa em R$19,90.\n\nQuer ver os pacotes?',
    },
  },

  // ── WAIT ANCORAGEM ────────────────────────────────────── x=3080, y=400
  {
    id: IDS.waitAnc,
    type: 'WAIT_REPLY',
    position: { x: 3080, y: 400 },
    config: {
      saveAs: 'respostaAnc',
      timeoutAmount: 24,
      timeoutUnit: 'hours',
      onTimeout: 'END',
    },
  },

  // ── OFERTA STARTER ────────────────────────────────────── x=3360, y=400
  {
    id: IDS.ofertaStarter,
    type: 'SEND_MESSAGE',
    position: { x: 3360, y: 400 },
    config: {
      message:
        'Pra você conhecer o resultado antes de qualquer compromisso:\n\n🐾 1 foto transformada\n🎨 2 variações de cenário\n📐 Alta resolução — pronta pra imprimir\n⚡ Entrega em até 24h\n✅ Se não gostar, a gente refaz sem custo\n\n💰 R$19,90\n\nQuer começar?',
    },
  },

  // ── WAIT OFERTA ───────────────────────────────────────── x=3640, y=400
  {
    id: IDS.waitOferta,
    type: 'WAIT_REPLY',
    position: { x: 3640, y: 400 },
    config: {
      saveAs: 'respostaOferta',
      timeoutAmount: 24,
      timeoutUnit: 'hours',
      onTimeout: 'END',
    },
  },

  // ── CONDITION: disse sim? ─────────────────────────────── x=3920, y=400
  // true  = contém "sim" → pagamento (PIX)
  // false = outra coisa  → áudio garantia (contorno objeção)
  {
    id: IDS.condOferta,
    type: 'CONDITION',
    position: { x: 3920, y: 400 },
    config: {
      expression: 'variables.respostaOferta.toLowerCase().includes("sim")',
      branches: {
        true: IDS.pagamento,
        false: IDS.audioGarantia,
      },
    },
  },

  // ── PAGAMENTO PIX ─────────────────────────────────────── x=4200, y=400
  {
    id: IDS.pagamento,
    type: 'SEND_MESSAGE',
    position: { x: 4200, y: 400 },
    config: {
      message:
        'Perfeito! 🐾\n\nPara confirmar:\n\n💳 PIX: SEU_PIX_AQUI\n\nDepois do pagamento, me manda:\n✅ Comprovante\n✅ A foto do seu pet — qualquer uma que você goste\n✅ Se tiver preferência de cenário (fundo escuro, jardim, estúdio branco), me fala\n\nO prazo começa da confirmação.\nQualquer dúvida é só falar aqui.',
    },
  },

  // ── PÓS-VENDA ─────────────────────────────────────────── x=4480, y=400
  {
    id: IDS.posVenda,
    type: 'SEND_MESSAGE',
    position: { x: 4480, y: 400 },
    config: {
      message:
        'Aqui está o ensaio 🎊\n\nEspero que tenha ficado do jeito que você imaginou.\nSe quiser ajustar alguma coisa, é só falar.\n\nUma dica: esse tipo de foto fica incrível em canvas ou papel fosco.\nEle merece sair do celular e ir pra parede. 🖼️',
    },
  },

  // ── DELAY 3 DIAS ──────────────────────────────────────── x=4760, y=400
  {
    id: IDS.delay3d,
    type: 'WAIT',
    position: { x: 4760, y: 400 },
    config: {
      amount: 3,
      unit: 'days',
    },
  },

  // ── RECOMPRA ──────────────────────────────────────────── x=5040, y=400
  {
    id: IDS.recompra,
    type: 'SEND_MESSAGE',
    position: { x: 5040, y: 400 },
    config: {
      message:
        'Oi! O pessoal amou a foto quando você mostrou? 😄\n\nPergunto porque muita gente que faz o Starter volta pra fazer mais —\nseja o mesmo pet em outros cenários ou um segundo pet.\n\nTem mais alguma foto que você queria transformar?',
    },
  },

  // ── UPSELL (pacotes completos) ────────────────────────── x=4200, y=100 (acima do pagamento)
  {
    id: IDS.upsell,
    type: 'SEND_MESSAGE',
    position: { x: 4200, y: 100 },
    config: {
      message:
        'Esses são os pacotes disponíveis:\n\n🐾 STARTER — R$19,90\n1 foto · 2 cenários · Entrega 24h\n\n⭐ POPULAR — R$49,90\n5 fotos do seu pet · 3 cenários por foto · Entrega 12h · Revisão incluída\n\n💎 PREMIUM — R$97,00\n10 fotos · Múltiplos cenários · Entrega 6h · Revisões ilimitadas\n\n—\n\nQuem tem mais de um pet normalmente vai direto no Popular.\nSai menos de R$10 por foto.\n\nQual faz mais sentido pra você?',
    },
  },

  // ── ÁUDIO GARANTIA ────────────────────────────────────── x=3920, y=700 (abaixo de condOferta)
  {
    id: IDS.audioGarantia,
    type: 'SEND_MEDIA',
    position: { x: 3920, y: 700 },
    config: {
      mediaType: 'audio',
      mediaUrl: '',
      sendAudioAsVoice: true,
      caption: '',
      // Placeholder para upload manual:
      // Script (30-40s): Dúvida é normal, tecnologia que muita gente não conhece.
      // Risco zero — se não gostar refaz sem custo sem discussão.
      // R$19,90 é o que gasta num petisco premium dele.
      // Resultado vai querer imprimir e colocar na parede. Sem pressão.
    },
  },

  // ── WAIT GARANTIA ─────────────────────────────────────── x=4200, y=700
  {
    id: IDS.waitGarantia,
    type: 'WAIT_REPLY',
    position: { x: 4200, y: 700 },
    config: {
      saveAs: 'respostaGarantia',
      timeoutAmount: 24,
      timeoutUnit: 'hours',
      onTimeout: 'END',
    },
  },

  // ── CONDITION: comprou após garantia? ─────────────────── x=4480, y=700
  // true  = contém "sim" → pagamento
  // false = não comprou  → delay 24h → black #1
  {
    id: IDS.condGarantia,
    type: 'CONDITION',
    position: { x: 4480, y: 700 },
    config: {
      expression: 'variables.respostaGarantia.toLowerCase().includes("sim")',
      branches: {
        true: IDS.pagamento,
        false: IDS.delay24h,
      },
    },
  },

  // ── DELAY 24h ─────────────────────────────────────────── x=4760, y=700
  {
    id: IDS.delay24h,
    type: 'WAIT',
    position: { x: 4760, y: 700 },
    config: {
      amount: 24,
      unit: 'hours',
    },
  },

  // ── BLACK #1 — O tempo passa ──────────────────────────── x=5040, y=700
  {
    id: IDS.black1,
    type: 'SEND_MESSAGE',
    position: { x: 5040, y: 700 },
    config: {
      message:
        'Uma coisa sobre pets que quase ninguém fala:\n\nA fase de filhote dura menos de um ano.\nO pelo escurece. O corpo muda. O jeito de olhar muda.\n\nO seu pet de hoje não é o mesmo que vai ser daqui a 2 anos.\n\nVocê tem uma foto boa desse momento específico?',
    },
  },

  // ── BLACK #2 — Mil fotos, nenhuma boa (ÁUDIO) ─────────── x=560, y=700 (abaixo de condHook)
  {
    id: IDS.black2Audio,
    type: 'SEND_MEDIA',
    position: { x: 560, y: 700 },
    config: {
      mediaType: 'audio',
      mediaUrl: '',
      sendAudioAsVoice: true,
      caption: '',
      // Placeholder para upload manual:
      // Script (30s): Maioria tem centenas de fotos do pet. Mas quando pergunta se tem
      // uma que imprimiria — resposta quase sempre é não. Foto boa de pet não é sorte,
      // é cenário, luz, enquadramento. A gente resolve isso por R$19,90. Quando quiser é só falar.
    },
  },

  // ── BLACK #3 — Comparação social ──────────────────────── x=560, y=950
  {
    id: IDS.black3,
    type: 'SEND_MESSAGE',
    position: { x: 560, y: 950 },
    config: {
      message:
        'Semana passada uma tutora nos mandou mensagem:\n\n"Postei no Instagram e em 2 horas tinha 200 comentários\nperguntando qual fotógrafo fez o ensaio da minha gata.\nQuando eu disse que foi R$19,90 pelo WhatsApp,\nninguém acreditou."\n\nEssa é a reação que a gente ouve toda semana.\n\nQuando você quiser, é só me falar.',
    },
  },

  // ── BLACK #5 — FOMO de preço ──────────────────────────── x=840, y=950
  {
    id: IDS.black5,
    type: 'SEND_MESSAGE',
    position: { x: 840, y: 950 },
    config: {
      message:
        'Só pra você saber:\n\nO R$19,90 é o preço de entrada pra novos clientes.\n\nNão é o preço fixo do serviço.\n\nSe quiser testar, é agora.',
    },
  },

  // ── BLACK #6 — O post que você nunca teve ─────────────── x=1120, y=950
  {
    id: IDS.black6,
    type: 'SEND_MESSAGE',
    position: { x: 1120, y: 950 },
    config: {
      message:
        'Você já reparou que os posts de pet que mais viralizam\nsempre têm foto com qualidade de estúdio?\n\nNão é sorte. É luz, cenário e enquadramento profissional.\n\nA gente entrega exatamente isso — com a foto que você já tem.\n\nQuer ver o que seria possível com uma foto do seu pet?',
    },
  },
];

// ─── EDGES ────────────────────────────────────────────────────────────────────
// CONDITION nodes: edges com campo `condition: 'true' | 'false'`
// Demais nodes:    edges sem campo condition

const edges = [
  // Fluxo principal
  { id: eid(), source: IDS.hookA,         target: IDS.waitHook                             },
  { id: eid(), source: IDS.waitHook,      target: IDS.condHook                             },

  // CONDITION hook: true → áudio apresentação | false → black2 áudio
  { id: eid(), source: IDS.condHook,      target: IDS.audioApres,    condition: 'true'     },
  { id: eid(), source: IDS.condHook,      target: IDS.black2Audio,   condition: 'false'    },

  // Sequência apresentação → mídias → prova social
  { id: eid(), source: IDS.audioApres,    target: IDS.waitApres                            },
  { id: eid(), source: IDS.waitApres,     target: IDS.midia1                               },
  { id: eid(), source: IDS.midia1,        target: IDS.midia2                               },
  { id: eid(), source: IDS.midia2,        target: IDS.midia3                               },
  { id: eid(), source: IDS.midia3,        target: IDS.msgProva                             },
  { id: eid(), source: IDS.msgProva,      target: IDS.waitProva                            },
  { id: eid(), source: IDS.waitProva,     target: IDS.ancoragem                            },
  { id: eid(), source: IDS.ancoragem,     target: IDS.waitAnc                              },
  { id: eid(), source: IDS.waitAnc,       target: IDS.ofertaStarter                        },
  { id: eid(), source: IDS.ofertaStarter, target: IDS.waitOferta                           },
  { id: eid(), source: IDS.waitOferta,    target: IDS.condOferta                           },

  // CONDITION oferta: true → pagamento | false → áudio garantia
  { id: eid(), source: IDS.condOferta,    target: IDS.pagamento,     condition: 'true'     },
  { id: eid(), source: IDS.condOferta,    target: IDS.audioGarantia, condition: 'false'    },

  // Upsell → pagamento (node standalone de pacotes)
  { id: eid(), source: IDS.upsell,        target: IDS.pagamento                            },

  // Garantia
  { id: eid(), source: IDS.audioGarantia, target: IDS.waitGarantia                         },
  { id: eid(), source: IDS.waitGarantia,  target: IDS.condGarantia                         },

  // CONDITION garantia: true → pagamento | false → delay 24h → black1
  { id: eid(), source: IDS.condGarantia,  target: IDS.pagamento,     condition: 'true'     },
  { id: eid(), source: IDS.condGarantia,  target: IDS.delay24h,      condition: 'false'    },
  { id: eid(), source: IDS.delay24h,      target: IDS.black1                               },

  // Pós-venda
  { id: eid(), source: IDS.pagamento,     target: IDS.posVenda                             },
  { id: eid(), source: IDS.posVenda,      target: IDS.delay3d                              },
  { id: eid(), source: IDS.delay3d,       target: IDS.recompra                             },
];

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍 Buscando usuário jimbo@gmail.com...');

  const user = await prisma.user.findFirst({
    where: { email: 'jimbo@gmail.com' },
  });

  if (!user) {
    throw new Error('❌ Usuário jimbo@gmail.com não encontrado no banco.');
  }

  console.log(`✅ Usuário encontrado: ${user.name ?? user.email} (tenantId: ${user.tenantId})`);

  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
  });

  if (!tenant) {
    throw new Error(`❌ Tenant ${user.tenantId} não encontrado.`);
  }

  console.log(`✅ Tenant: ${tenant.name} (${tenant.id})`);

  const workflow = await prisma.workflow.create({
    data: {
      name: 'Ensaios Por IA — Nicho Pet',
      tenantId: user.tenantId,
      nodes: nodes as any,
      edges: edges as any,
      isActive: false,
    },
  });

  const audioNodes = [
    {
      label: '🎙️ Áudio: Apresentação Pet',
      hint: 'Script (40-55s): Tecnologia transforma fotos comuns em ensaio de estúdio. Não precisa levar o pet a lugar nenhum, não precisa esperar cooperar. Manda a foto que já tem. Resultado tão bom que perguntam qual estúdio. Quando fala R$19,90 pelo WhatsApp ninguém acredita. Vai mandar 3 exemplos.',
    },
    {
      label: '⚫🎙️ Black #2 — Mil fotos, nenhuma boa',
      hint: 'Script (30s): Maioria tem centenas de fotos do pet. Mas quando pergunta se tem uma que imprimiria — resposta quase sempre é não. Foto boa de pet não é sorte, é cenário, luz, enquadramento. A gente resolve isso por R$19,90. Quando quiser é só falar.',
    },
    {
      label: '🎙️ Áudio: Garantia Pet',
      hint: 'Script (30-40s): Dúvida é normal, tecnologia que muita gente não conhece. Risco zero — se não gostar refaz sem custo sem discussão. R$19,90 é o que gasta num petisco premium dele. Resultado vai querer imprimir e colocar na parede. Sem pressão.',
    },
  ];

  console.log('\n✅ Fluxo criado com sucesso!');
  console.log(`   ID    : ${workflow.id}`);
  console.log(`   Nome  : ${workflow.name}`);
  console.log(`   Nodes : ${nodes.length}`);
  console.log(`   Edges : ${edges.length}`);
  console.log(`\n🎙️  Nodes de áudio para upload manual (${audioNodes.length} total):`);
  audioNodes.forEach(n => {
    console.log(`\n   • ${n.label}`);
    console.log(`     ${n.hint}`);
  });
  console.log('\n📌 Lembre de substituir SEU_PIX_AQUI no node de Pagamento pelo PIX real.');
  console.log('📌 Faça upload das 3 imagens de antes/depois no editor.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
