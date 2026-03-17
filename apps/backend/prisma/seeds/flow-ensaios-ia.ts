/**
 * Seed: Fluxo "Ensaios Por IA — Funil Completo"
 * Cria o fluxo para o tenant do usuário jimbo@gmail.com
 *
 * Execução:
 *   cd apps/backend
 *   npx ts-node prisma/seeds/flow-ensaios-ia.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const uid = () => `node-${Math.random().toString(36).slice(2, 10)}`;
const eid = () => `edge-${Math.random().toString(36).slice(2, 10)}`;

// ─── IDs FIXOS ────────────────────────────────────────────────────────────────
const ID = {
  hookNewborn:   uid(),
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
  posVenda:      uid(),
  delay3d:       uid(),
  recompra:      uid(),
};

// ─── NODES ────────────────────────────────────────────────────────────────────
const nodes = [

  // ── HOOK ──────────────────────────────────────────────────────────────────
  {
    id: ID.hookNewborn,
    type: 'TRIGGER_WHATSAPP',
    position: { x: 400, y: 0 },
    config: {
      triggerType: 'any',
    },
  },

  {
    id: ID.waitHook,
    type: 'SEND_MESSAGE',
    position: { x: 400, y: 180 },
    config: {
      message:
        'Oi, mamãe 💛\n\nVocê sabia que dá pra transformar uma foto simples do celular\nem um ensaio newborn de estúdio — sem sair de casa?\n\nPosso te mostrar como fica?',
    },
  },

  // ── WAIT REPLY HOOK ───────────────────────────────────────────────────────
  {
    id: ID.condHook,
    type: 'WAIT_REPLY',
    position: { x: 400, y: 360 },
    config: {
      saveAs: 'respostaHook',
      timeoutAmount: 24,
      timeoutUnit: 'hours',
      onTimeout: 'END',
    },
  },

  // ── CONDITION: respondeu positivamente? ───────────────────────────────────
  // true  = não contém "não" → segue apresentação
  // false = contém "não"     → black2 áudio
  {
    id: ID.audioApres,
    type: 'CONDITION',
    position: { x: 400, y: 540 },
    config: {
      expression: '!variables.respostaHook.toLowerCase().includes("não")',
      branches: {
        true: ID.midia1,
        false: ID.black2Audio,
      },
    },
  },

  // ── ÁUDIO APRESENTAÇÃO ────────────────────────────────────────────────────
  {
    id: ID.waitApres,
    type: 'SEND_MEDIA',
    position: { x: 200, y: 720 },
    config: {
      mediaType: 'audio',
      mediaUrl: '',
      sendAudioAsVoice: true,
      caption: '',
      // Placeholder para upload manual:
      // Script (40-60s): Explicar que usam IA pra transformar fotos de celular em ensaio
      // profissional. Sem sair de casa. Resultado tão bom que perguntam qual fotógrafo.
      // Vai mandar 3 exemplos.
    },
  },

  // ── WAIT após áudio (avança após 5 min independente de resposta) ──────────
  {
    id: ID.midia1,
    type: 'WAIT_REPLY',
    position: { x: 200, y: 900 },
    config: {
      saveAs: 'respostaApres',
      timeoutAmount: 5,
      timeoutUnit: 'minutes',
      onTimeout: 'GOTO_NODE',
      timeoutTargetNodeId: ID.midia2,
    },
  },

  // ── MÍDIA 1, 2, 3 (antes/depois) ─────────────────────────────────────────
  {
    id: ID.midia2,
    type: 'SEND_MEDIA',
    position: { x: 200, y: 1080 },
    config: {
      mediaType: 'image',
      mediaUrl: '',
      caption: '',
    },
  },
  {
    id: ID.midia3,
    type: 'SEND_MEDIA',
    position: { x: 200, y: 1260 },
    config: {
      mediaType: 'image',
      mediaUrl: '',
      caption: '',
    },
  },
  {
    id: ID.msgProva,
    type: 'SEND_MEDIA',
    position: { x: 200, y: 1440 },
    config: {
      mediaType: 'image',
      mediaUrl: '',
      caption: '',
    },
  },

  // ── TEXTO PROVA SOCIAL ────────────────────────────────────────────────────
  {
    id: ID.waitProva,
    type: 'SEND_MESSAGE',
    position: { x: 200, y: 1620 },
    config: {
      message:
        'Cada uma dessas fotos começou igual à sua —\numa foto comum, tirada no celular, sem nada especial.\n\nJá fizemos isso pra mais de 500 famílias.\n98% ficaram felizes com o resultado.\nOs outros 2% a gente refez até ficarem.\n\nFicou curioso como funciona na prática?',
    },
  },

  // ── WAIT PROVA ────────────────────────────────────────────────────────────
  {
    id: ID.ancoragem,
    type: 'WAIT_REPLY',
    position: { x: 200, y: 1800 },
    config: {
      saveAs: 'respostaProva',
      timeoutAmount: 24,
      timeoutUnit: 'hours',
      onTimeout: 'END',
    },
  },

  // ── ANCORAGEM ─────────────────────────────────────────────────────────────
  {
    id: ID.waitAnc,
    type: 'SEND_MESSAGE',
    position: { x: 200, y: 1980 },
    config: {
      message:
        'É bem simples:\n\n📱 Você manda a foto pelo WhatsApp\n✨ A gente faz a transformação\n📩 Você recebe em alta resolução em horas\n\n—\n\nUm ensaio com fotógrafo profissional custa entre R$300 e R$500.\nExige agendamento, deslocamento, bebê cooperando, tudo certo.\n\nAqui o resultado é o mesmo.\nO preço começa em R$19,90.\nVocê não sai de casa.\n\nQuer ver os pacotes disponíveis?',
    },
  },

  // ── WAIT ANCORAGEM ────────────────────────────────────────────────────────
  {
    id: ID.ofertaStarter,
    type: 'WAIT_REPLY',
    position: { x: 200, y: 2160 },
    config: {
      saveAs: 'respostaAnc',
      timeoutAmount: 24,
      timeoutUnit: 'hours',
      onTimeout: 'END',
    },
  },

  // ── OFERTA STARTER ────────────────────────────────────────────────────────
  {
    id: ID.waitOferta,
    type: 'SEND_MESSAGE',
    position: { x: 200, y: 2340 },
    config: {
      message:
        'Pra você conhecer o resultado antes de qualquer compromisso maior:\n\n✦ 1 foto transformada\n✦ 2 variações de cenário\n✦ Alta resolução\n✦ Entrega em até 24h\n✦ Se não gostar, a gente refaz — sem custo\n\n💰 R$19,90\n\nQuer começar com esse?',
    },
  },

  // ── WAIT OFERTA ───────────────────────────────────────────────────────────
  {
    id: ID.condOferta,
    type: 'WAIT_REPLY',
    position: { x: 200, y: 2520 },
    config: {
      saveAs: 'respostaOferta',
      timeoutAmount: 24,
      timeoutUnit: 'hours',
      onTimeout: 'END',
    },
  },

  // ── CONDITION: disse sim? ─────────────────────────────────────────────────
  // true  = contém "sim" → pagamento
  // false = outra coisa  → áudio garantia (contorno de objeção)
  {
    id: ID.upsell,
    type: 'CONDITION',
    position: { x: 200, y: 2700 },
    config: {
      expression: 'variables.respostaOferta.toLowerCase().includes("sim")',
      branches: {
        true: ID.pagamento,
        false: ID.audioGarantia,
      },
    },
  },

  // ── UPSELL (branch: pediu outros pacotes / quer ver mais) ─────────────────
  {
    id: ID.pagamento,
    type: 'SEND_MESSAGE',
    position: { x: 550, y: 2880 },
    config: {
      message:
        'Esses são os pacotes disponíveis:\n\n📸 STARTER — R$19,90\n1 foto · 2 cenários · Entrega 24h\n\n⭐ POPULAR — R$49,90\n5 fotos · 3 cenários por foto · Entrega 12h · Revisão incluída\n\n💎 PREMIUM — R$97,00\n10 fotos · Múltiplos cenários · Entrega 6h · Revisões ilimitadas\n\nA maioria escolhe o Popular — sai menos de R$10 por foto.\n\nQual faz mais sentido pra você?',
    },
  },

  // ── PAGAMENTO ─────────────────────────────────────────────────────────────
  {
    id: ID.audioGarantia,
    type: 'SEND_MESSAGE',
    position: { x: 200, y: 2880 },
    config: {
      message:
        'Perfeito 🎉\n\nPara confirmar:\n\n💳 PIX: SEU_PIX_AQUI\n\nDepois do pagamento, me manda:\n✅ Comprovante\n✅ A foto que quer transformar\n✅ Se tiver alguma preferência de cenário, me fala\n\nO prazo começa a contar da confirmação.\nQualquer dúvida, é só falar aqui mesmo.',
    },
  },

  // ── ÁUDIO GARANTIA (branch: hesitou / disse não) ──────────────────────────
  {
    id: ID.waitGarantia,
    type: 'SEND_MEDIA',
    position: { x: -200, y: 2880 },
    config: {
      mediaType: 'audio',
      mediaUrl: '',
      sendAudioAsVoice: true,
      caption: '',
      // Placeholder para upload manual:
      // Script (30-45s): Entender a dúvida é normal. Risco zero — se não gostar, refaz
      // sem custo. R$19,90 é menos que um almoço. Resultado vai querer emoldurar.
      // Sem pressão.
    },
  },

  // ── WAIT GARANTIA ─────────────────────────────────────────────────────────
  {
    id: ID.condGarantia,
    type: 'WAIT_REPLY',
    position: { x: -200, y: 3060 },
    config: {
      saveAs: 'respostaGarantia',
      timeoutAmount: 24,
      timeoutUnit: 'hours',
      onTimeout: 'END',
    },
  },

  // ── CONDITION: comprou após garantia? ─────────────────────────────────────
  // true  = contém "sim" → pagamento
  // false = não comprou  → delay 24h → black1
  {
    id: ID.delay24h,
    type: 'CONDITION',
    position: { x: -200, y: 3240 },
    config: {
      expression: 'variables.respostaGarantia.toLowerCase().includes("sim")',
      branches: {
        true: ID.audioGarantia,
        false: ID.black1,
      },
    },
  },

  // ── DELAY 24h (não comprou após garantia) ─────────────────────────────────
  {
    id: ID.black1,
    type: 'WAIT',
    position: { x: -400, y: 3420 },
    config: {
      amount: 24,
      unit: 'hours',
    },
  },

  // ── BLACK #1 ──────────────────────────────────────────────────────────────
  {
    id: ID.black2Audio,
    type: 'SEND_MESSAGE',
    position: { x: -400, y: 3600 },
    config: {
      message:
        'Uma coisa que ninguém fala sobre fotos antigas:\n\nElas continuam envelhecendo.\n\nA foto amarelada hoje vai estar irreconhecível daqui a 5 anos.\nA única foto de alguém pode desaparecer antes de você fazer algo.\n\nNão estou falando pra te pressionar.\nEstou falando porque é real.\n\nQuando você quiser, a gente está aqui.',
    },
  },

  // ── BLACK #2 áudio (hook não respondeu positivamente) ─────────────────────
  {
    id: ID.black3,
    type: 'SEND_MEDIA',
    position: { x: 700, y: 720 },
    config: {
      mediaType: 'audio',
      mediaUrl: '',
      sendAudioAsVoice: true,
      caption: '',
      // Placeholder para upload manual:
      // Script (30s): Maior arrependimento das mães não é ter feito, é ter demorado.
      // Primeiros dias passam em 2 semanas. A gente transforma a foto em algo para
      // emoldurar. Quando estiver pronta, é só falar.
    },
  },

  // ── BLACK #3 (comparação social) ─────────────────────────────────────────
  {
    id: ID.black5,
    type: 'SEND_MESSAGE',
    position: { x: 1000, y: 0 },
    config: {
      message:
        'Semana passada uma mãe nos mandou mensagem:\n\n"Todo mundo no grupo de família perguntou qual fotógrafo fez o ensaio.\nEu disse que foi pelo WhatsApp por R$19,90.\nNinguém acreditou."\n\nEssa é a reação que a gente ouve toda semana.\n\nQuando você estiver pronta, é só me falar.',
    },
  },

  // ── BLACK #5 (FOMO de preço) ──────────────────────────────────────────────
  {
    id: ID.posVenda,
    type: 'SEND_MESSAGE',
    position: { x: 1000, y: 180 },
    config: {
      message:
        'Só pra você saber:\n\nO R$19,90 é o preço pra novos clientes conhecerem o resultado.\n\nNão é o preço fixo.\n\nSe quiser testar, é agora.',
    },
  },

  // ── PÓS-VENDA ─────────────────────────────────────────────────────────────
  {
    id: ID.delay3d,
    type: 'SEND_MESSAGE',
    position: { x: 1400, y: 0 },
    config: {
      message:
        'Aqui está o seu ensaio 🎊\n\nEspero que tenha ficado do jeito que você imaginou.\nSe quiser ajustar alguma coisa, é só falar.\n\nUma dica: quando for imprimir, escolha papel de qualidade.\nEssa foto merece moldura. 🖼️',
    },
  },

  // ── DELAY 3 DIAS (recompra) ───────────────────────────────────────────────
  {
    id: ID.recompra,
    type: 'WAIT',
    position: { x: 1400, y: 180 },
    config: {
      amount: 3,
      unit: 'days',
    },
  },

  // ── RECOMPRA ──────────────────────────────────────────────────────────────
  {
    id: `node-end-${Math.random().toString(36).slice(2, 8)}`,
    type: 'SEND_MESSAGE',
    position: { x: 1400, y: 360 },
    config: {
      message:
        'Oi! Tudo bem com as fotos? 😊\n\nPergunto porque muita gente que testa o Starter acaba voltando\npra fazer mais — já que o resultado fica tão bom.\n\nTem mais alguma foto que você queria transformar?',
    },
  },
];

// ─── EDGES ────────────────────────────────────────────────────────────────────
// Para CONDITION: edges usam campo `condition: 'true' | 'false'`
// Para demais:    edges sem `condition` (ou condition: undefined)

const edges = [
  // Fluxo principal: trigger → hook → wait → condition
  { id: eid(), source: ID.hookNewborn,   target: ID.waitHook                                   },
  { id: eid(), source: ID.waitHook,      target: ID.condHook                                   },
  { id: eid(), source: ID.condHook,      target: ID.audioApres  /* CONDITION */ },

  // CONDITION hook: true → áudio apresentação | false → black2 áudio
  { id: eid(), source: ID.audioApres,    target: ID.waitApres,   condition: 'true'              },
  { id: eid(), source: ID.audioApres,    target: ID.black3,      condition: 'false'             },

  // Sequência: apresentação → wait → mídias → prova social → wait
  { id: eid(), source: ID.waitApres,     target: ID.midia1                                      },
  { id: eid(), source: ID.midia1,        target: ID.midia2                                      },
  { id: eid(), source: ID.midia2,        target: ID.midia3                                      },
  { id: eid(), source: ID.midia3,        target: ID.msgProva                                    },
  { id: eid(), source: ID.msgProva,      target: ID.waitProva                                   },
  { id: eid(), source: ID.waitProva,     target: ID.ancoragem                                   },
  { id: eid(), source: ID.ancoragem,     target: ID.waitAnc                                     },
  { id: eid(), source: ID.waitAnc,       target: ID.ofertaStarter                               },
  { id: eid(), source: ID.ofertaStarter, target: ID.waitOferta                                  },
  { id: eid(), source: ID.waitOferta,    target: ID.condOferta                                  },

  // CONDITION oferta: true → pagamento | false → áudio garantia
  { id: eid(), source: ID.upsell,        target: ID.pagamento,   condition: 'true'              },
  { id: eid(), source: ID.upsell,        target: ID.waitGarantia, condition: 'false'            },

  // Upsell (pacotes) → também leva ao pagamento
  { id: eid(), source: ID.pagamento,     target: ID.audioGarantia                               },

  // Garantia
  { id: eid(), source: ID.waitGarantia,  target: ID.condGarantia                                },
  { id: eid(), source: ID.condGarantia,  target: ID.audioGarantia /* CONDITION */ },

  // CONDITION garantia: true → pagamento | false → delay 24h
  { id: eid(), source: ID.delay24h,      target: ID.audioGarantia, condition: 'true'            },
  { id: eid(), source: ID.delay24h,      target: ID.black2Audio,  condition: 'false'            },

  // Após delay 24h → black1
  { id: eid(), source: ID.black1,        target: ID.black2Audio                                 },

  // Pós-venda
  { id: eid(), source: ID.audioGarantia, target: ID.delay3d                                     },
  { id: eid(), source: ID.delay3d,       target: ID.recompra                                    },
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
      name: 'Ensaios Por IA — Funil Completo',
      tenantId: user.tenantId,
      nodes: nodes as any,
      edges: edges as any,
      isActive: false,
    },
  });

  const audioNodes = [
    { label: '🎙️ Áudio: Apresentação', hint: 'Script (40-60s): Explicar que usam IA pra transformar fotos de celular em ensaio profissional. Sem sair de casa. Resultado tão bom que perguntam qual fotógrafo. Vai mandar 3 exemplos.' },
    { label: '⚫🎙️ Black #2 — Culpa invertida', hint: 'Script (30s): Maior arrependimento das mães não é ter feito, é ter demorado. Primeiros dias passam em 2 semanas. A gente transforma a foto em algo para emoldurar. Quando estiver pronta, é só falar.' },
    { label: '🎙️ Áudio: Garantia', hint: 'Script (30-45s): Entender a dúvida é normal. Risco zero — se não gostar, refaz sem custo. R$19,90 é menos que um almoço. Resultado vai querer emoldurar. Sem pressão.' },
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
  console.log('📌 Faça upload das 3 imagens de antes/depois e do áudio de apresentação no editor.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
