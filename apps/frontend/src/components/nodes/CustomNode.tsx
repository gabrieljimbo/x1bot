import { memo, useState } from 'react'
import { Handle, Position, useReactFlow } from 'reactflow'
import { WorkflowNodeType } from '@n9n/shared'
import { Trash2, Play, Copy } from 'lucide-react'

const nodeConfig: Record<string, any> = {
  'TRIGGER_MESSAGE': {
    label: 'Nova Mensagem',
    subtitle: 'TRIGGER',
    icon: '💬',
    bgColor: 'bg-[#1a2942]',
    borderColor: 'border-[#3b5998]',
    iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
  },
  'TRIGGER_SCHEDULE': {
    label: 'Agendamento',
    subtitle: 'TRIGGER',
    icon: '⏰',
    bgColor: 'bg-[#2a1942]',
    borderColor: 'border-[#7b5998]',
    iconBg: 'bg-gradient-to-br from-purple-500 to-purple-600',
  },
  'TRIGGER_MANUAL': {
    label: 'Manual',
    subtitle: 'TRIGGER',
    icon: '▶️',
    bgColor: 'bg-[#1a2a1a]',
    borderColor: 'border-[#3b7d3b]',
    iconBg: 'bg-gradient-to-br from-green-500 to-green-600',
  },
  'SEND_MESSAGE': {
    label: 'Enviar Mensagem',
    subtitle: 'AÇÃO',
    icon: '💬',
    bgColor: 'bg-[#1a2e1a]',
    borderColor: 'border-[#3b7d3b]',
    iconBg: 'bg-gradient-to-br from-green-500 to-green-600',
  },
  'SEND_MEDIA': {
    label: 'Enviar Mídia',
    subtitle: 'AÇÃO',
    icon: '📸',
    bgColor: 'bg-[#1a2a1e]',
    borderColor: 'border-[#3b6d4b]',
    iconBg: 'bg-gradient-to-br from-lime-500 to-lime-600',
  },
  'SEND_BUTTONS': {
    label: 'Enviar Botões',
    subtitle: 'AÇÃO',
    icon: '🔘',
    bgColor: 'bg-[#1a2e2a]',
    borderColor: 'border-[#3b7d5b]',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
  },
  'SEND_LIST': {
    label: 'Enviar Lista',
    subtitle: 'AÇÃO',
    icon: '📋',
    bgColor: 'bg-[#1a2e2e]',
    borderColor: 'border-[#3b7d7d]',
    iconBg: 'bg-gradient-to-br from-teal-500 to-teal-600',
  },
  'HTTP_REQUEST': {
    label: 'HTTP Request',
    subtitle: 'AÇÃO',
    icon: '🌐',
    bgColor: 'bg-[#1a2a2e]',
    borderColor: 'border-[#3b7d7d]',
    iconBg: 'bg-gradient-to-br from-cyan-500 to-cyan-600',
  },
  'HTTP_SCRAPE': {
    label: 'Web Scraping',
    subtitle: 'AÇÃO',
    icon: '🕷️',
    bgColor: 'bg-[#2a1a2e]',
    borderColor: 'border-[#7d3b8d]',
    iconBg: 'bg-gradient-to-br from-violet-500 to-violet-600',
  },
  'MANAGE_LABELS': {
    label: 'Gerenciar Etiquetas',
    subtitle: 'AÇÃO',
    icon: '🏷️',
    bgColor: 'bg-[#2e1a2a]',
    borderColor: 'border-[#7d3b5b]',
    iconBg: 'bg-gradient-to-br from-pink-500 to-pink-600',
  },
  'CODE': {
    label: 'Code',
    subtitle: 'TRANSFORMAÇÃO',
    icon: '{}',
    bgColor: 'bg-[#1a1a2e]',
    borderColor: 'border-[#3b3b7d]',
    iconBg: 'bg-gradient-to-br from-purple-500 to-purple-600',
  },
  'EDIT_FIELDS': {
    label: 'Edit Fields',
    subtitle: 'TRANSFORMAÇÃO',
    icon: '✏️',
    bgColor: 'bg-[#1a2a2a]',
    borderColor: 'border-[#3b6b6b]',
    iconBg: 'bg-gradient-to-br from-teal-500 to-teal-600',
  },
  'SET_TAGS': {
    label: 'Gerenciar Tags',
    subtitle: 'AÇÃO',
    icon: '🏷️',
    bgColor: 'bg-[#2a1a2e]',
    borderColor: 'border-[#6b3b7d]',
    iconBg: 'bg-gradient-to-br from-purple-500 to-purple-600',
  },
  'CONDITION': {
    label: 'Condição',
    subtitle: 'LÓGICA',
    icon: '🔀',
    bgColor: 'bg-[#3a2a1a]',
    borderColor: 'border-[#8a6a3a]',
    iconBg: 'bg-gradient-to-br from-yellow-600 to-yellow-700',
  },
  'SWITCH': {
    label: 'Switch',
    subtitle: 'LÓGICA',
    icon: '🔄',
    bgColor: 'bg-[#1a1a3a]',
    borderColor: 'border-[#3b3b7d]',
    iconBg: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
  },
  'WAIT_REPLY': {
    label: 'Aguardar Resposta',
    subtitle: 'AÇÃO',
    icon: '⏳',
    bgColor: 'bg-[#2e2419]',
    borderColor: 'border-[#7d5d39]',
    iconBg: 'bg-gradient-to-br from-orange-500 to-orange-600',
  },
  'WAIT': {
    label: 'Aguardar Tempo',
    subtitle: 'AÇÃO',
    icon: '⏱️',
    bgColor: 'bg-[#2e2419]',
    borderColor: 'border-[#7d5d39]',
    iconBg: 'bg-gradient-to-br from-amber-500 to-amber-600',
  },
  'LOOP': {
    label: 'Loop',
    subtitle: 'LÓGICA',
    icon: '🔁',
    bgColor: 'bg-[#1a2442]',
    borderColor: 'border-[#3b5d8d]',
    iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
  },
  'PIX_RECOGNITION': {
    label: 'Reconhecer PIX',
    subtitle: 'AÇÃO',
    icon: '💸',
    bgColor: 'bg-[#1a2e25]',
    borderColor: 'border-[#3b7d63]',
    iconBg: 'bg-gradient-to-br from-emerald-400 to-emerald-500',
  },
  'END': {
    label: 'Finalizar',
    subtitle: 'FIM',
    icon: '🏁',
    bgColor: 'bg-[#2e1a1a]',
    borderColor: 'border-[#7d3b3b]',
    iconBg: 'bg-gradient-to-br from-red-500 to-red-600',
  },
}

interface CustomNodeProps {
  data: {
    type: WorkflowNodeType
    config: any
    isActive?: boolean
    executionStatus?: 'idle' | 'running' | 'waiting' | 'completed' | 'failed'
    hasExecuted?: boolean
    executionSuccess?: boolean
    onManualTrigger?: (nodeId: string) => void
    onDuplicateNode?: (nodeId: string) => void
  }
}

function CustomNode({ data, id }: CustomNodeProps & { id: string }) {
  const config = nodeConfig[data.type] || {
    label: data.type,
    subtitle: 'NODE',
    icon: '❓',
    bgColor: 'bg-[#1a1a1a]',
    borderColor: 'border-gray-600',
    iconBg: 'bg-gradient-to-br from-gray-500 to-gray-600',
  }

  const { deleteElements } = useReactFlow()
  const [isHovered, setIsHovered] = useState(false)

  const isTrigger =
    data.type === 'TRIGGER_MESSAGE' ||
    data.type === 'TRIGGER_SCHEDULE' ||
    data.type === 'TRIGGER_MANUAL'

  const isEnd = data.type === 'END'
  const isCondition = data.type === 'CONDITION'
  const isSwitch = data.type === 'SWITCH'
  const isLoop = data.type === 'LOOP'

  // Get switch rules for dynamic handles
  const switchRules = isSwitch && data.config.rules ? data.config.rules : []

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }

  const handleDuplicate = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (data.onDuplicateNode) {
      data.onDuplicateNode(id)
    }
  }

  // Determine border style based on execution state
  const getExecutionBorderClass = () => {
    if (!data.isActive) return ''

    if (data.executionStatus === 'completed' && isEnd) {
      return 'ring-2 ring-primary shadow-lg shadow-primary/30'
    }

    if (data.executionStatus === 'waiting') {
      return 'ring-2 ring-yellow-500 animate-pulse shadow-lg shadow-yellow-500/30'
    }

    if (data.executionStatus === 'failed') {
      return 'ring-2 ring-red-500 shadow-lg shadow-red-500/30'
    }

    return 'ring-2 ring-primary animate-pulse shadow-lg shadow-primary/30'
  }

  // Get preview text
  const getPreviewText = () => {
    if (data.config.message) {
      return data.config.message.length > 30
        ? data.config.message.substring(0, 30) + '...'
        : data.config.message
    }
    if (data.type === 'TRIGGER_MESSAGE') {
      if (data.config.pattern && data.config.pattern.trim() !== '') {
        return `Ao receber: ${data.config.pattern}`
      } else {
        return '📨 Todas as mensagens'
      }
    }
    if (data.type === 'TRIGGER_MANUAL') {
      return '▶️ Clique para executar'
    }
    if (data.type === 'WAIT') {
      const amount = data.config.amount || 1
      const unit = data.config.unit || 'seconds'
      const unitLabel: Record<string, string> = {
        seconds: 'segundo(s)',
        minutes: 'minuto(s)',
        hours: 'hora(s)',
        days: 'dia(s)',
      }
      return `⏱️ Aguardar ${amount} ${unitLabel[unit] || unit}`
    }
    if (data.type === 'SEND_MEDIA') {
      const mediaType = data.config.mediaType || 'image'
      const mediaTypeLabel: Record<string, string> = {
        image: '📷 Imagem',
        video: '🎥 Vídeo',
        audio: '🎵 Áudio',
        document: '📄 Documento'
      }
      const label = mediaTypeLabel[mediaType]

      if (data.config.mediaUrl) {
        const url = data.config.mediaUrl.length > 25
          ? data.config.mediaUrl.substring(0, 25) + '...'
          : data.config.mediaUrl
        return `${label}: ${url}`
      }
      return label
    }
    if (data.config.pattern) {
      return `Ao receber: ${data.config.pattern}`
    }
    if (data.config.saveAs) {
      return `Salvar em: ${data.config.saveAs}`
    }
    if (data.config.expression) {
      return data.config.expression.length > 30
        ? data.config.expression.substring(0, 30) + '...'
        : data.config.expression
    }
    if (data.config.rules && Array.isArray(data.config.rules)) {
      const count = data.config.rules.length
      return `${count} ${count === 1 ? 'regra' : 'regras'} configurada${count === 1 ? '' : 's'}`
    }
    if (data.type === 'HTTP_REQUEST' && data.config.url) {
      const method = data.config.method || 'GET'
      return `${method} ${data.config.url.length > 25 ? data.config.url.substring(0, 25) + '...' : data.config.url}`
    }
    if (data.type === 'HTTP_SCRAPE' && data.config.url) {
      return `🕷️ ${data.config.url.length > 25 ? data.config.url.substring(0, 25) + '...' : data.config.url}`
    }
    if (data.type === 'CODE' && data.config.code) {
      const mode = data.config.mode === 'runOnceForEachItem' ? 'Para cada item' : 'Uma vez'
      const lines = data.config.code.split('\n').length
      return `${mode} • ${lines} linha${lines > 1 ? 's' : ''}`
    }
    if (data.type === 'EDIT_FIELDS') {
      const mode = data.config.mode || 'fields'
      const count = data.config.operations?.length || 0
      if (mode === 'json') {
        return '📝 Modo JSON'
      }
      return `✏️ ${count} campo${count !== 1 ? 's' : ''}`
    }
    if (data.type === 'SET_TAGS') {
      const action = data.config.action || 'add'
      const tags = data.config.tags || []
      const actionLabels: Record<string, string> = {
        add: '➕ Adicionar',
        remove: '➖ Remover',
        set: '🔄 Substituir',
        clear: '🗑️ Limpar todas'
      }
      const actionLabel = actionLabels[action]

      if (action === 'clear') {
        return actionLabel
      }

      const count = tags.length
      if (count === 0) {
        return `${actionLabel} (nenhuma tag)`
      }
      if (count === 1) {
        return `${actionLabel}: ${tags[0]}`
      }
      return `${actionLabel} ${count} tags`
    }
    if (data.type === 'LOOP') {
      const mode = data.config.loopMode || 'array'
      if (mode === 'count') {
        const count = data.config.count || 1
        return `🔁 Executar ${count}x`
      } else {
        const source = data.config.arraySource || 'array'
        return `🔁 Iterar: ${source.length > 20 ? source.substring(0, 20) + '...' : source}`
      }
    }
    if (data.type === 'PIX_RECOGNITION') {
      const validate = data.config.validateAmount
      const amount = data.config.expectedAmount
      return validate
        ? `💸 Validar R$ ${amount || '?'}`
        : '💸 Ler comprovante PIX'
    }
    return null
  }

  const previewText = getPreviewText()

  // Get execution badge
  const getExecutionBadge = () => {
    if (!data.hasExecuted) return null

    if (data.executionSuccess) {
      return (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg z-10">
          <span className="text-white text-sm font-bold">✓</span>
        </div>
      )
    } else {
      return (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg z-10">
          <span className="text-white text-sm font-bold">✗</span>
        </div>
      )
    }
  }

  return (
    <div
      className={`
        ${config.bgColor} ${config.borderColor}
        border-2 rounded-xl min-w-[200px] max-w-[280px]
        transition-all duration-200 hover:scale-105
        ${getExecutionBorderClass()}
        backdrop-blur-sm
        relative
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Action Buttons - appear on hover */}
      {isHovered && (
        <div
          className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1 z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleDuplicate}
            className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded transition-colors"
            title="Duplicar"
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded transition-colors"
            title="Deletar"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {/* Execution Badge */}
      {getExecutionBadge()}
      {/* Input Handle */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-gray-400 !border-2 !border-gray-600 hover:!bg-primary hover:!border-primary transition-colors"
        />
      )}

      {/* Node Content */}
      <div className="p-3">
        {/* Header with Icon and Title */}
        <div className="flex items-start gap-3 mb-2">
          {/* Icon */}
          <div className={`
            ${config.iconBg}
            w-10 h-10 rounded-lg flex items-center justify-center text-lg
            flex-shrink-0 shadow-lg
          `}>
            {config.icon}
          </div>

          {/* Title and Subtitle */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {config.subtitle}
              </span>
              {data.isActive && (
                <div className={`w-1.5 h-1.5 rounded-full ${data.executionStatus === 'waiting' ? 'bg-yellow-500 animate-pulse' :
                  data.executionStatus === 'completed' ? 'bg-primary' :
                    data.executionStatus === 'failed' ? 'bg-red-500' :
                      'bg-blue-500 animate-pulse'
                  }`} />
              )}
            </div>
            <h3 className="text-sm font-semibold text-white leading-tight">
              {config.label}
            </h3>
          </div>
        </div>

        {/* Preview/Description */}
        {previewText && (
          <div className="mt-2 pt-2 border-t border-gray-700/50">
            <p className="text-xs text-gray-400 leading-relaxed">
              {previewText}
            </p>
          </div>
        )}

        {/* Start Button for TRIGGER_MANUAL */}
        {data.type === 'TRIGGER_MANUAL' && (
          <div className="mt-3 pt-3 border-t border-gray-700/50">
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (data.onManualTrigger) {
                  data.onManualTrigger(id)
                }
              }}
              className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              <Play size={16} />
              <span>Executar Agora</span>
            </button>
          </div>
        )}
      </div>

      {/* Small Test Button for LOOP (top-right corner) */}
      {data.type === 'LOOP' && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (data.onManualTrigger) {
              data.onManualTrigger(id)
            }
          }}
          className="absolute top-2 right-2 w-6 h-6 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center transition-all duration-200 shadow-md hover:shadow-lg z-10 group"
          title="Testar Loop"
        >
          <Play size={12} className="text-white" fill="white" />
        </button>
      )}


      {/* Output Handles */}
      {!isEnd && (
        <>
          {isCondition ? (
            <>
              <Handle
                type="source"
                position={Position.Right}
                id="true"
                style={{ top: '35%' }}
                className="!w-3 !h-3 !bg-green-400 !border-2 !border-green-600 hover:!bg-green-300 transition-colors"
              />
              <Handle
                type="source"
                position={Position.Right}
                id="false"
                style={{ top: '65%' }}
                className="!w-3 !h-3 !bg-red-400 !border-2 !border-red-600 hover:!bg-red-300 transition-colors"
              />
              {/* Labels for condition outputs */}
              <div className="absolute -bottom-5 left-0 right-0 flex justify-around text-[9px] font-bold">
                <span className="text-green-400">True</span>
                <span className="text-red-400">False</span>
              </div>
            </>
          ) : isSwitch ? (
            <>
              {/* Dynamic handles for each switch rule */}
              {switchRules.map((rule: any, index: number) => {
                const total = switchRules.length + 1 // +1 for default
                const position = ((index + 1) / (total + 1)) * 100
                const colors = [
                  '!bg-blue-400 !border-blue-600 hover:!bg-blue-300',
                  '!bg-purple-400 !border-purple-600 hover:!bg-purple-300',
                  '!bg-pink-400 !border-pink-600 hover:!bg-pink-300',
                  '!bg-cyan-400 !border-cyan-600 hover:!bg-cyan-300',
                ]
                const colorClass = colors[index % colors.length]

                return (
                  <Handle
                    key={rule.id || index}
                    type="source"
                    position={Position.Right}
                    id={rule.outputKey || String(index)}
                    style={{ top: `${position}%` }}
                    className={`!w-3 !h-3 !border-2 transition-colors ${colorClass}`}
                  />
                )
              })}
              {/* Default handle (always present) */}
              <Handle
                type="source"
                position={Position.Right}
                id="default"
                style={{ top: `${((switchRules.length + 1) / (switchRules.length + 2)) * 100}%` }}
                className="!w-3 !h-3 !bg-yellow-400 !border-2 !border-yellow-600 hover:!bg-yellow-300 transition-colors"
              />
              {/* Labels for switch outputs */}
              <div className="absolute -right-5 top-0 bottom-0 flex flex-col justify-around text-[9px] font-bold py-2">
                {switchRules.map((rule: any, index: number) => (
                  <span key={rule.id || index} className="text-indigo-400 truncate">
                    {index}
                  </span>
                ))}
                <span className="text-yellow-400">Def</span>
              </div>
            </>
          ) : isLoop ? (
            <>
              {/* Loop iteration handle (top) */}
              <Handle
                type="source"
                position={Position.Right}
                id="loop"
                style={{ top: '35%' }}
                className="!w-3 !h-3 !bg-blue-400 !border-2 !border-blue-600 hover:!bg-blue-300 transition-colors"
              />
              {/* Loop done handle (bottom) */}
              <Handle
                type="source"
                position={Position.Right}
                id="done"
                style={{ top: '65%' }}
                className="!w-3 !h-3 !bg-green-400 !border-2 !border-green-600 hover:!bg-green-300 transition-colors"
              />
              {/* Labels for loop outputs */}
              <div className="absolute -bottom-5 left-0 right-0 flex justify-around text-[9px] font-bold">
                <span className="text-blue-400">Loop</span>
                <span className="text-green-400">Done</span>
              </div>
            </>
          ) : (
            <Handle
              type="source"
              position={Position.Right}
              className="!w-3 !h-3 !bg-gray-400 !border-2 !border-gray-600 hover:!bg-primary hover:!border-primary transition-colors"
            />
          )}
        </>
      )}
    </div>
  )
}

export default memo(CustomNode)

