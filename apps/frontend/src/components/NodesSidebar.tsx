'use client'

import { useState } from 'react'
import { WorkflowNodeType } from '@n9n/shared'

interface NodesSidebarProps {
  onAddNode: (type: WorkflowNodeType, position?: { x: number; y: number }) => void
  onClose?: () => void
}

export default function NodesSidebar({ onAddNode, onClose }: NodesSidebarProps) {
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
        type: 'END' as WorkflowNodeType,
        label: 'Finalizar',
        icon: '🏁',
        color: 'from-red-500 to-red-600',
        bgColor: 'bg-[#2e1a1a]',
        borderColor: 'border-[#7d3b3b]',
        description: 'Finaliza o workflow'
      }
    ]
  }
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedCategory, setExpandedCategory] = useState<string | null>('TRIGGERS')

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

  return (
    <div className="w-80 bg-[#1a1a1a] border-l border-gray-700 flex flex-col h-full shadow-2xl">
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
        {Object.entries(filteredCategories).map(([category, nodes]) => (
          <div key={category} className="border-b border-gray-800">
            {/* Category Header */}
            <button
              onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#151515] transition"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {category === 'TRIGGERS' ? '🎯' : '⚡'}
                </span>
                <span className="text-sm font-semibold text-gray-300">
                  {category === 'TRIGGERS' ? 'TRIGGERS' : 'AÇÕES'}
                </span>
              </div>
              <span className="text-gray-500">
                {expandedCategory === category ? '▼' : '▶'}
              </span>
            </button>

            {/* Nodes List */}
            {expandedCategory === category && (
              <div className="pb-2">
                {nodes.map((node) => (
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
        ))}
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

