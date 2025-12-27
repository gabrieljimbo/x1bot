import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { WorkflowNodeType } from '@n9n/shared'

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
  'SEND_MESSAGE': {
    label: 'Enviar Mensagem',
    subtitle: 'AÇÃO',
    icon: '💬',
    bgColor: 'bg-[#1a2e1a]',
    borderColor: 'border-[#3b7d3b]',
    iconBg: 'bg-gradient-to-br from-green-500 to-green-600',
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
  }
}

function CustomNode({ data }: CustomNodeProps) {
  const config = nodeConfig[data.type] || {
    label: data.type,
    subtitle: 'NODE',
    icon: '❓',
    bgColor: 'bg-[#1a1a1a]',
    borderColor: 'border-gray-600',
    iconBg: 'bg-gradient-to-br from-gray-500 to-gray-600',
  }

  const isTrigger =
    data.type === 'TRIGGER_MESSAGE' ||
    data.type === 'TRIGGER_SCHEDULE'

  const isEnd = data.type === 'END'
  const isCondition = data.type === 'CONDITION'
  const isSwitch = data.type === 'SWITCH'
  
  // Get switch rules for dynamic handles
  const switchRules = isSwitch && data.config.rules ? data.config.rules : []

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
    >
      {/* Execution Badge */}
      {getExecutionBadge()}
      {/* Input Handle */}
      {!isTrigger && (
        <Handle 
          type="target" 
          position={Position.Top}
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
                <div className={`w-1.5 h-1.5 rounded-full ${
                  data.executionStatus === 'waiting' ? 'bg-yellow-500 animate-pulse' :
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
      </div>

      {/* Output Handles */}
      {!isEnd && (
        <>
          {isCondition ? (
            <>
              <Handle 
                type="source" 
                position={Position.Bottom}
                id="true"
                style={{ left: '35%' }}
                className="!w-3 !h-3 !bg-green-400 !border-2 !border-green-600 hover:!bg-green-300 transition-colors"
              />
              <Handle 
                type="source" 
                position={Position.Bottom}
                id="false"
                style={{ left: '65%' }}
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
                    position={Position.Bottom}
                    id={rule.outputKey || String(index)}
                    style={{ left: `${position}%` }}
                    className={`!w-3 !h-3 !border-2 transition-colors ${colorClass}`}
                  />
                )
              })}
              {/* Default handle (always present) */}
              <Handle
                type="source"
                position={Position.Bottom}
                id="default"
                style={{ left: `${((switchRules.length + 1) / (switchRules.length + 2)) * 100}%` }}
                className="!w-3 !h-3 !bg-yellow-400 !border-2 !border-yellow-600 hover:!bg-yellow-300 transition-colors"
              />
              {/* Labels for switch outputs */}
              <div className="absolute -bottom-5 left-0 right-0 flex justify-around text-[9px] font-bold px-2">
                {switchRules.map((rule: any, index: number) => (
                  <span key={rule.id || index} className="text-indigo-400 truncate">
                    {index}
                  </span>
                ))}
                <span className="text-yellow-400">Def</span>
              </div>
            </>
          ) : (
            <Handle 
              type="source" 
              position={Position.Bottom}
              className="!w-3 !h-3 !bg-gray-400 !border-2 !border-gray-600 hover:!bg-primary hover:!border-primary transition-colors"
            />
          )}
        </>
      )}
    </div>
  )
}

export default memo(CustomNode)

