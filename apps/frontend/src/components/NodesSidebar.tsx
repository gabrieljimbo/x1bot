'use client'

import { useState } from 'react'
import { WorkflowNodeType } from '@n9n/shared'

interface NodesSidebarProps {
  onAddNode: (type: WorkflowNodeType, position?: { x: number; y: number }) => void
  onClose?: () => void
  hasTrigger?: boolean
}

export default function NodesSidebar({ onAddNode, onClose, hasTrigger = false }: NodesSidebarProps) {
  const nodeCategories = {
    TRIGGERS: [
      {
        type: 'TRIGGER_MESSAGE' as WorkflowNodeType,
        label: 'Nova Mensagem',
        icon: '💬',
        color: 'from-blue-500 to-blue-600',
        bgColor: 'bg-[#1a2942]',
        borderColor: 'border-[#3b5998]',
        description: 'Dispara quando uma mensagem é recebida'
      },
      {
        type: 'TRIGGER_SCHEDULE' as WorkflowNodeType,
        label: 'Agendamento',
        icon: '⏰',
        color: 'from-purple-500 to-purple-600',
        bgColor: 'bg-[#2a1942]',
        borderColor: 'border-[#7b5998]',
        description: 'Dispara em horários agendados'
      },
      {
        type: 'TRIGGER_MANUAL' as WorkflowNodeType,
        label: 'Manual',
        icon: '▶️',
        color: 'from-green-500 to-green-600',
        bgColor: 'bg-[#1a2a1a]',
        borderColor: 'border-[#3b7d3b]',
        description: 'Dispara manualmente com um clique'
      },
      {
        type: 'TRIGGER_GRUPO' as WorkflowNodeType,
        label: 'Início de Grupo',
        icon: '👥',
        color: 'from-indigo-500 to-indigo-600',
        bgColor: 'bg-[#1e1b4b]',
        borderColor: 'border-[#6366f1]',
        description: 'Dispara em dias específicos após ativar no grupo'
      }
    ],
    ACTIONS: [
      {
        type: 'SEND_MESSAGE' as WorkflowNodeType,
        label: 'Enviar Mensagem',
        icon: '💬',
        color: 'from-green-500 to-green-600',
        bgColor: 'bg-[#1a2e1a]',
        borderColor: 'border-[#3b7d3b]',
        description: 'Envia uma mensagem no WhatsApp'
      },
      {
        type: 'SEND_MEDIA' as WorkflowNodeType,
        label: 'Enviar Mídia',
        icon: '📸',
        color: 'from-lime-500 to-lime-600',
        bgColor: 'bg-[#1a2a1e]',
        borderColor: 'border-[#3b6d4b]',
        description: 'Envia imagem, vídeo, áudio ou documento'
      },
      {
        type: 'SEND_PIX' as WorkflowNodeType,
        label: 'Cobrar PIX',
        icon: '💰',
        color: 'from-green-500 to-green-600',
        bgColor: 'bg-[#1a2e1a]',
        borderColor: 'border-[#3b7d3b]',
        description: 'Envia cobrança PIX e aguarda comprovante'
      },
      {
        type: 'SEND_BUTTONS' as WorkflowNodeType,
        label: 'Enviar Botões',
        icon: '🔘',
        color: 'from-emerald-500 to-emerald-600',
        bgColor: 'bg-[#1a2e2a]',
        borderColor: 'border-[#3b7d5b]',
        description: 'Envia uma mensagem com botões interativos'
      },
      {
        type: 'SEND_LIST' as WorkflowNodeType,
        label: 'Enviar Lista',
        icon: '📋',
        color: 'from-teal-500 to-teal-600',
        bgColor: 'bg-[#1a2e2e]',
        borderColor: 'border-[#3b7d7d]',
        description: 'Envia uma mensagem com lista de opções'
      },
      {
        type: 'HTTP_REQUEST' as WorkflowNodeType,
        label: 'HTTP Request',
        icon: '🌐',
        color: 'from-cyan-500 to-cyan-600',
        bgColor: 'bg-[#1a2a2e]',
        borderColor: 'border-[#3b7d7d]',
        description: 'Faz uma requisição HTTP para uma API externa'
      },
      {
        type: 'COMMAND' as WorkflowNodeType,
        label: 'Executar Comando',
        icon: '⚡',
        color: 'from-orange-500 to-orange-600',
        bgColor: 'bg-[#2a1a0e]',
        borderColor: 'border-[#7d5b3b]',
        description: 'Executa um comando do sistema (ex: curl, git, etc)'
      },
      {
        type: 'HTTP_SCRAPE' as WorkflowNodeType,
        label: 'Web Scraping',
        icon: '🕷️',
        color: 'from-violet-500 to-violet-600',
        bgColor: 'bg-[#2a1a2e]',
        borderColor: 'border-[#7d3b8d]',
        description: 'Faz scraping de páginas web renderizadas com JavaScript'
      },
      {
        type: WorkflowNodeType.PROMO_ML,
        label: 'Promo ML',
        icon: '🛒',
        color: 'from-yellow-400 to-yellow-500',
        bgColor: 'bg-[#2a2a0a]',
        borderColor: 'border-[#8a7a0a]',
        description: 'Busca e envia ofertas do Mercado Livre automaticamente'
      },
      {
        type: 'PIX_RECOGNITION' as WorkflowNodeType,
        label: 'Reconhecer PIX',
        icon: '💸',
        color: 'from-emerald-400 to-emerald-500',
        bgColor: 'bg-[#1a2e25]',
        borderColor: 'border-[#3b7d63]',
        description: 'Usa OCR para ler e validar comprovantes de PIX'
      },
      {
        type: 'RMKT' as WorkflowNodeType,
        label: 'Remarketing',
        icon: '🎯',
        color: 'from-red-600 to-red-700',
        bgColor: 'bg-[#2a1a1a]',
        borderColor: 'border-[#7d3b3b]',
        description: 'Aguarda um tempo e envia mensagem automática (remarketing)'
      },
      {
        type: 'CODE' as WorkflowNodeType,
        label: 'Code',
        icon: '{}',
        color: 'from-purple-500 to-purple-600',
        bgColor: 'bg-[#1a1a2e]',
        borderColor: 'border-[#3b3b7d]',
        description: 'Executa código JavaScript para transformar dados'
      },
      {
        type: 'EDIT_FIELDS' as WorkflowNodeType,
        label: 'Edit Fields',
        icon: '✏️',
        color: 'from-teal-500 to-teal-600',
        bgColor: 'bg-[#1a2a2a]',
        borderColor: 'border-[#3b6b6b]',
        description: 'Adiciona, modifica ou remove campos dos dados'
      },
      {
        type: 'SET_TAGS' as WorkflowNodeType,
        label: 'Gerenciar Tags',
        icon: '🏷️',
        color: 'from-purple-500 to-purple-600',
        bgColor: 'bg-[#2a1a2e]',
        borderColor: 'border-[#6b3b7d]',
        description: 'Adiciona ou remove tags internas do contato'
      },
      {
        type: 'MANAGE_LABELS' as WorkflowNodeType,
        label: 'Gerenciar Etiquetas',
        icon: '🏷️',
        color: 'from-pink-500 to-pink-600',
        bgColor: 'bg-[#2e1a2a]',
        borderColor: 'border-[#7d3b5b]',
        description: 'Adiciona ou remove etiquetas do WhatsApp'
      },
      {
        type: 'WAIT_REPLY' as WorkflowNodeType,
        label: 'Aguardar Resposta',
        icon: '⏳',
        color: 'from-orange-500 to-orange-600',
        bgColor: 'bg-[#2e2419]',
        borderColor: 'border-[#7d5d39]',
        description: 'Aguarda resposta do usuário'
      },
      {
        type: 'WAIT' as WorkflowNodeType,
        label: 'Aguardar Tempo',
        icon: '⏱️',
        color: 'from-amber-500 to-amber-600',
        bgColor: 'bg-[#2e2419]',
        borderColor: 'border-[#7d5d39]',
        description: 'Pausa a execução por um tempo determinado'
      },
      {
        type: 'LOOP' as WorkflowNodeType,
        label: 'Loop',
        icon: '🔁',
        color: 'from-blue-500 to-blue-600',
        bgColor: 'bg-[#1a2442]',
        borderColor: 'border-[#3b5d8d]',
        description: 'Itera sobre arrays ou executa N vezes'
      },
      {
        type: 'CONDITION' as WorkflowNodeType,
        label: 'Condição',
        icon: '🔀',
        color: 'from-yellow-600 to-yellow-700',
        bgColor: 'bg-[#3a2a1a]',
        borderColor: 'border-[#8a6a3a]',
        description: 'Ramifica o fluxo baseado em condições'
      },
      {
        type: 'SWITCH' as WorkflowNodeType,
        label: 'Switch',
        icon: '🔄',
        color: 'from-indigo-500 to-indigo-600',
        bgColor: 'bg-[#1a1a3a]',
        borderColor: 'border-[#3b3b7d]',
        description: 'Roteia para múltiplos caminhos baseado em regras'
      },
      {
        type: 'MARK_STAGE' as WorkflowNodeType,
        label: 'Marcar Etapa',
        icon: '🚩',
        color: 'from-orange-400 to-orange-500',
        bgColor: 'bg-[#2a1a0e]',
        borderColor: 'border-[#7d5d39]',
        description: 'Marca uma etapa importante no funil de conversão'
      },
      {
        type: 'END' as WorkflowNodeType,
        label: 'Finalizar',
        icon: '🏁',
        color: 'from-red-500 to-red-600',
        bgColor: 'bg-[#2e1a1a]',
        borderColor: 'border-[#7d3b3b]',
        description: 'Finaliza o workflow'
      }
    ],
    GROUPS: [
      {
        type: WorkflowNodeType.MENCIONAR_TODOS,
        label: 'Mencionar Todos',
        icon: '📣',
        color: 'from-violet-500 to-violet-600',
        bgColor: 'bg-[#2a1a3a]',
        borderColor: 'border-[#7c3aed]',
        description: 'Menciona todos os membros do grupo (respeita 1h de intervalo)'
      },
      {
        type: WorkflowNodeType.AQUECIMENTO,
        label: 'Aquecimento',
        icon: '🔥',
        color: 'from-orange-500 to-orange-600',
        bgColor: 'bg-[#2e1a0e]',
        borderColor: 'border-[#f97316]',
        description: 'Sequência diária para aquecer grupos novos'
      },
      {
        type: WorkflowNodeType.OFERTA_RELAMPAGO,
        label: 'Oferta Relâmpago',
        icon: '⚡',
        color: 'from-yellow-500 to-yellow-600',
        bgColor: 'bg-[#2e2a12]',
        borderColor: 'border-[#eab308]',
        description: 'Cria uma oferta com cronômetro e encerramento automático'
      },
      {
        type: WorkflowNodeType.LEMBRETE_RECORRENTE,
        label: 'Lembrete',
        icon: '⏰',
        color: 'from-green-500 to-green-600',
        bgColor: 'bg-[#1a2e1a]',
        borderColor: 'border-[#22c55e]',
        description: 'Envia lembretes em horários fixos para o grupo'
      },
      {
        type: WorkflowNodeType.ENQUETE_GRUPO,
        label: 'Enquete',
        icon: '📊',
        color: 'from-pink-500 to-pink-600',
        bgColor: 'bg-[#2e1a26]',
        borderColor: 'border-[#ec4899]',
        description: 'Cria enquetes interativas no grupo'
      },
      {
        type: WorkflowNodeType.SEQUENCIA_LANCAMENTO,
        label: 'Lançamento',
        icon: '🎯',
        color: 'from-red-500 to-red-600',
        bgColor: 'bg-[#2e1a1a]',
        borderColor: 'border-[#ef4444]',
        description: 'Automação completa para fases de lançamento (PPL/L)'
      },
      {
        type: WorkflowNodeType.PROMO_ML_API,
        label: 'Promo ML API',
        icon: '🛒',
        color: 'from-[#ffe600] to-[#ffcc00]',
        bgColor: 'bg-[#2a2a0a]',
        borderColor: 'border-[#ffe600]',
        description: 'Busca oficial via API do ML com filtros avançados'
      }
    ]
  }
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedCategory, setExpandedCategory] = useState<string | null>(hasTrigger ? 'ACTIONS' : 'TRIGGERS')

  const filteredCategories = Object.entries(nodeCategories).reduce((acc, [category, nodes]) => {
    const filtered = nodes.filter(node =>
      node.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
    if (filtered.length > 0) {
      acc[category] = filtered
    }
    return acc
  }, {} as Record<string, typeof nodeCategories.TRIGGERS>)

  const handleDragStart = (e: React.DragEvent, nodeType: WorkflowNodeType) => {
    e.dataTransfer.setData('application/reactflow', nodeType)
    e.dataTransfer.effectAllowed = 'move'
  }

  // No need to hide categories entirely if filtered, but let's ensure we render them
  const categoriesToRender = ['TRIGGERS', 'ACTIONS', 'GROUPS']

  return (
    <div className="w-[280px] bg-[#1a1a1a] border-r border-gray-700 flex flex-col h-full shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Adicionar Node</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors shadow-lg"
              title="Fechar"
            >
              <span className="text-white text-lg leading-none">✕</span>
            </button>
          )}
        </div>
        <input
          type="text"
          placeholder="Buscar nodes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 bg-[#151515] border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary"
        />
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto">
        {categoriesToRender.map((category) => {
          const nodes = filteredCategories[category] || []
          if (nodes.length === 0 && searchTerm !== '') return null // Hide if search filter doesn't match

          return (
            <div key={category} className="border-b border-gray-800">
              {/* Category Header */}
              <button
                onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#151515] transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {category === 'TRIGGERS' ? '🎯' : category === 'GROUPS' ? '👥' : '⚡'}
                  </span>
                  <span className="text-sm font-semibold text-gray-300">
                    {category === 'TRIGGERS' ? '🎯 GATILHOS' : category === 'GROUPS' ? '👥 FLUXOS DE GRUPO' : '⚡ AÇÕES DO FLUXO'}
                  </span>
                </div>
                <span className="text-gray-500">
                  {expandedCategory === category ? '▼' : '▶'}
                </span>
              </button>

              {/* Warning for Triggers if hasTrigger is true */}
              {category === 'TRIGGERS' && hasTrigger && expandedCategory === 'TRIGGERS' && (
                <div className="mx-4 mb-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-[10px] text-yellow-500 leading-tight">
                  ⚠️ Este fluxo já possui um gatilho configurado.
                </div>
              )}

              {/* Nodes List */}
              {expandedCategory === category && (
                <div className="pb-2">
                  {nodes.map((node: any) => (
                    <div
                      key={node.type}
                      draggable
                      onDragStart={(e) => handleDragStart(e, node.type)}
                      onClick={() => {
                        onAddNode(node.type);
                      }}
                      className={`
                      mx-2 mb-2 p-3 rounded-lg cursor-move transition-all group
                      ${node.bgColor} ${node.borderColor}
                      border-2 hover:scale-[1.02] hover:shadow-lg
                    `}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`
                        w-10 h-10 rounded-lg bg-gradient-to-br ${node.color} 
                        flex items-center justify-center text-lg flex-shrink-0 
                        group-hover:scale-110 transition-transform shadow-lg
                      `}>
                          {node.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-white mb-1">
                            {node.label}
                          </h3>
                          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                            {node.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer Hint */}
      <div className="p-4 border-t border-gray-700 bg-[#151515]">
        <div className="flex items-start gap-2 text-xs text-gray-400">
          <span>💡</span>
          <p>
            Arraste e solte os nodes no canvas ou clique para adicionar no centro
          </p>
        </div>
      </div>
    </div>
  )
}


