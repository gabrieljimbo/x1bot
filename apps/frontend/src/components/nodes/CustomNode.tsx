import { memo, useState } from 'react'
import { Handle, Position } from 'reactflow'
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
    label: 'Agendamento / Cron',
    subtitle: 'GATILHO',
    icon: '⏳',
    bgColor: 'bg-[#1a2e2d]',
    borderColor: 'border-[#3b827c]',
    iconBg: 'bg-gradient-to-br from-teal-500 to-teal-600',
  },
  'TRIGGER_GRUPO': {
    label: 'Início de Grupo',
    subtitle: 'GATILHO',
    icon: '👥',
    bgColor: 'bg-[#1e1b4b]',
    borderColor: 'border-[#6366f1]',
    iconBg: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
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
  'SEND_PIX': {
    label: 'Cobrar PIX',
    subtitle: 'AÇÃO',
    icon: '💰',
    bgColor: 'bg-[#1a2e1a]',
    borderColor: 'border-[#3b7d3b]',
    iconBg: 'bg-gradient-to-br from-green-500 to-green-600',
  },
  'PIX_SIMPLES': {
    label: 'Enviar PIX',
    subtitle: 'AÇÃO',
    icon: '🟢',
    bgColor: 'bg-[#1a2e1a]',
    borderColor: 'border-[#4d9b4d]',
    iconBg: 'bg-gradient-to-br from-lime-500 to-green-500',
  },
  'SEND_CONTACT': {
    label: 'Enviar Contato',
    subtitle: 'AÇÃO',
    icon: '👤',
    bgColor: 'bg-[#1a2535]',
    borderColor: 'border-[#3b6e8f]',
    iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-500',
  },
  'PROMO_SHOPEE': {
    label: 'Ofertas Shopee',
    subtitle: 'AFILIADO',
    icon: '🟠',
    bgColor: 'bg-[#2e1a0e]',
    borderColor: 'border-[#8f4a1a]',
    iconBg: 'bg-gradient-to-br from-orange-500 to-orange-600',
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
  'RMKT': {
    label: 'Remarketing',
    subtitle: 'AÇÃO',
    icon: '🎯',
    bgColor: 'bg-[#2a1a1a]',
    borderColor: 'border-[#7d3b3b]',
    iconBg: 'bg-gradient-to-br from-red-600 to-red-700',
  },
  'END': {
    label: 'Finalizar',
    subtitle: 'FIM',
    icon: '🏁',
    bgColor: 'bg-[#2e1a1a]',
    borderColor: 'border-[#7d3b3b]',
    iconBg: 'bg-gradient-to-br from-red-500 to-red-600',
  },
  'MARK_STAGE': {
    label: 'Marcar Etapa',
    subtitle: 'METRICA',
    icon: '🚩',
    bgColor: 'bg-[#2a1a0e]',
    borderColor: 'border-[#7d5d39]',
    iconBg: 'bg-gradient-to-br from-orange-400 to-orange-500',
  },
  'PIXEL_EVENT': {
    label: 'Pixel Event',
    subtitle: 'META CAPI',
    icon: '📊',
    bgColor: 'bg-[#1a1a35]',
    borderColor: 'border-[#6366f1]',
    iconBg: 'bg-gradient-to-br from-blue-500 to-violet-600',
  },
  'PROMO_ML': {
    label: 'Promo ML',
    subtitle: 'AÇÃO',
    icon: '🛒',
    bgColor: 'bg-[#2a2a0a]',
    borderColor: 'border-[#8a7a0a]',
    iconBg: 'bg-gradient-to-br from-[#FFE600] to-[#FFCC00]',
    iconColor: 'text-black',
  },
  'MENCIONAR_TODOS': {
    label: 'Mencionar Todos',
    subtitle: 'GRUPO',
    icon: '📣',
    bgColor: 'bg-[#2a1a3a]',
    borderColor: 'border-[#7c3aed]',
    iconBg: 'bg-gradient-to-br from-violet-500 to-violet-600',
  },
  'AQUECIMENTO': {
    label: 'Aquecimento',
    subtitle: 'GRUPO',
    icon: '🔥',
    bgColor: 'bg-[#2e1a0e]',
    borderColor: 'border-[#f97316]',
    iconBg: 'bg-gradient-to-br from-orange-500 to-orange-600',
  },
  'OFERTA_RELAMPAGO': {
    label: 'Oferta Relâmpago',
    subtitle: 'GRUPO',
    icon: '⚡',
    bgColor: 'bg-[#2e2a12]',
    borderColor: 'border-[#eab308]',
    iconBg: 'bg-gradient-to-br from-yellow-500 to-yellow-600',
  },
  'LEMBRETE_RECORRENTE': {
    label: 'Lembrete',
    subtitle: 'GRUPO',
    icon: '⏰',
    bgColor: 'bg-[#1a2e1a]',
    borderColor: 'border-[#22c55e]',
    iconBg: 'bg-gradient-to-br from-green-500 to-green-600',
  },
  'ENQUETE_GRUPO': {
    label: 'Enquete',
    subtitle: 'GRUPO',
    icon: '📊',
    bgColor: 'bg-[#2e1a26]',
    borderColor: 'border-[#ec4899]',
    iconBg: 'bg-gradient-to-br from-pink-500 to-pink-600',
  },
  'SEQUENCIA_LANCAMENTO': {
    label: 'Lançamento',
    subtitle: 'GRUPO',
    icon: '🎯',
    bgColor: 'bg-[#2e1a1a]',
    borderColor: 'border-[#ef4444]',
    iconBg: 'bg-gradient-to-br from-red-500 to-red-600',
  },
  'PROMO_ML_API': {
    label: 'Promo ML API',
    subtitle: 'API',
    icon: '🛒',
    bgColor: 'bg-[#2a2a0a]',
    borderColor: 'border-[#ffe600]',
    iconBg: 'bg-gradient-to-br from-[#ffe600] to-[#ffcc00]',
    iconColor: 'text-black',
  },
  'GRUPO_MEDIA': {
    label: 'Mídia para Grupo',
    subtitle: 'GRUPO',
    icon: '📲',
    bgColor: 'bg-[#1e1b4b]',
    borderColor: 'border-[#6366f1]',
    iconBg: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
  },
  'RANDOMIZER': {
    label: 'Randomizador',
    subtitle: 'LÓGICA',
    icon: '🎲',
    bgColor: 'bg-[#2a1a3a]',
    borderColor: 'border-[#A855F7]',
    iconBg: 'bg-gradient-to-br from-[#A855F7] to-[#9333EA]',
  },
  'CAMPAIGN_START': {
    label: 'Início de Campanha',
    subtitle: 'CAMPANHA',
    icon: '🚀',
    bgColor: 'bg-[#1a2e1a]',
    borderColor: 'border-[#22c55e]',
    iconBg: 'bg-gradient-to-br from-green-500 to-emerald-600',
  },
  'STOP_CAMPAIGN': {
    label: 'Parar Campanha',
    subtitle: 'CAMPANHA',
    icon: '🛑',
    bgColor: 'bg-[#2e1a1a]',
    borderColor: 'border-[#ef4444]',
    iconBg: 'bg-gradient-to-br from-red-500 to-red-600',
  },
  'SEND_GROUP_INVITE': {
    label: 'Enviar Convite de Grupo',
    subtitle: 'CAMPANHA',
    icon: '👥',
    bgColor: 'bg-[#1e1b4b]',
    borderColor: 'border-[#6366f1]',
    iconBg: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
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
    onRemoveNode?: (nodeId: string) => void
  }
  selected?: boolean
}

function CustomNode({ data, id, selected }: CustomNodeProps & { id: string }) {
  const config = nodeConfig[data.type] || {
    label: data.type,
    subtitle: 'NODE',
    icon: '❓',
    bgColor: 'bg-[#1a1a1a]',
    borderColor: 'border-gray-600',
    iconBg: 'bg-gradient-to-br from-gray-500 to-gray-600',
  }

  const [isHovered, setIsHovered] = useState(false)

  const isTrigger =
    data.type === 'TRIGGER_MESSAGE' ||
    data.type === 'TRIGGER_SCHEDULE' ||
    data.type === 'TRIGGER_MANUAL'

  const isEnd = data.type === 'END'
  const isCondition = data.type === 'CONDITION'
  const isSwitch = data.type === 'SWITCH'
  const isRandomizer = data.type === 'RANDOMIZER'
  const isLoop = data.type === 'LOOP'
  const isButtons = data.type === 'SEND_BUTTONS'
  const isPix = data.type === 'SEND_PIX'

  // Get switch/randomizer rules for dynamic handles
  const switchRules = isSwitch && data.config.rules ? data.config.rules : []
  const randomizerSaidas = isRandomizer && data.config.saidas ? data.config.saidas : []
  const buttonsNode = isButtons && data.config.buttons ? data.config.buttons : []

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (data.onRemoveNode) {
      data.onRemoveNode(id)
    }
  }

  const handleDuplicate = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (data.onDuplicateNode) {
      data.onDuplicateNode(id)
    }
  }

  // Determine border style based on execution state AND selection
  const getBorderStyles = () => {
    let classes = ''

    // Selection style - highest priority for visual feedback
    if (selected) {
      classes += ' ring-4 ring-[#00FF88] ring-offset-4 ring-offset-[#0a0a0a] shadow-[0_0_30px_rgba(0,255,136,0.5)] z-[1000] '
    }

    if (!data.isActive) return classes

    if (data.executionStatus === 'completed' && isEnd) {
      return classes + ' ring-2 ring-primary shadow-lg shadow-primary/30'
    }

    if (data.executionStatus === 'waiting') {
      return classes + ' ring-2 ring-yellow-500 animate-pulse shadow-lg shadow-yellow-500/30'
    }

    if (data.executionStatus === 'failed') {
      return classes + ' ring-2 ring-red-500 shadow-lg shadow-red-500/30'
    }

    return classes + ' ring-2 ring-primary animate-pulse shadow-lg shadow-primary/30'
  }

  // Get preview text
  const getPreviewText = () => {
    const { type } = data
    const config = data.config || {}
    if (config.message) {
      return config.message.length > 30
        ? config.message.substring(0, 30) + '...'
        : config.message
    }
    if (type === 'TRIGGER_MESSAGE') {
      if (config.pattern && config.pattern.trim() !== '') {
        return `Ao receber: ${config.pattern}`
      } else {
        return '📨 Todas as mensagens'
      }
    }
    if (type === 'TRIGGER_MANUAL') {
      return '▶️ Clique para executar'
    }
    if (type === 'WAIT') {
      const amount = config.amount || 1
      const unit = config.unit || 'seconds'
      const unitLabel: Record<string, string> = {
        seconds: 'segundo(s)',
        minutes: 'minuto(s)',
        hours: 'hora(s)',
        days: 'dia(s)',
      }
      return `⏱️ Aguardar ${amount} ${unitLabel[unit] || unit}`
    }
    if (type === 'SEND_MEDIA') {
      const mediaType = config.mediaType || 'image'
      const mediaTypeLabel: Record<string, string> = {
        image: '📷 Imagem',
        video: '🎥 Vídeo',
        audio: '🎵 Áudio',
        document: '📄 Documento'
      }
      const label = mediaTypeLabel[mediaType]

      if (config.mediaUrl) {
        const url = config.mediaUrl.length > 25
          ? config.mediaUrl.substring(0, 25) + '...'
          : config.mediaUrl
        return `${label}: ${url}`
      }
      return label
    }
    if (config.pattern) {
      return `Ao receber: ${config.pattern}`
    }
    if (config.saveAs) {
      return `Salvar em: ${config.saveAs}`
    }
    if (config.expression) {
      return config.expression.length > 30
        ? config.expression.substring(0, 30) + '...'
        : config.expression
    }
    if (config.rules && Array.isArray(config.rules)) {
      const count = config.rules.length
      return `${count} ${count === 1 ? 'regra' : 'regras'} configurada${count === 1 ? '' : 's'}`
    }
    if (type === 'HTTP_REQUEST' && config.url) {
      const method = config.method || 'GET'
      return `${method} ${config.url.length > 25 ? config.url.substring(0, 25) + '...' : config.url}`
    }
    if (type === 'HTTP_SCRAPE' && config.url) {
      return `🕷️ ${config.url.length > 25 ? config.url.substring(0, 25) + '...' : config.url}`
    }
    if (type === 'CODE' && config.code) {
      const mode = config.mode === 'runOnceForEachItem' ? 'Para cada item' : 'Uma vez'
      const lines = config.code.split('\n').length
      return `${mode} • ${lines} linha${lines > 1 ? 's' : ''}`
    }
    if (type === 'EDIT_FIELDS') {
      const mode = config.mode || 'fields'
      const count = config.operations?.length || 0
      if (mode === 'json') {
        return '📝 Modo JSON'
      }
      return `✏️ ${count} campo${count !== 1 ? 's' : ''}`
    }
    if (type === 'SET_TAGS') {
      const action = config.action || 'add'
      const tags = config.tags || []
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
    if (type === 'LOOP') {
      const mode = config.loopMode || 'array'
      if (mode === 'count') {
        const count = config.count || 1
        return `🔁 Executar ${count}x`
      } else {
        const source = config.arraySource || 'array'
        return `🔁 Iterar: ${source.length > 20 ? source.substring(0, 20) + '...' : source}`
      }
    }
    if (type === 'PIX_RECOGNITION') {
      const validate = config.validateAmount
      const amount = config.expectedAmount
      return validate
        ? `💸 Validar R$ ${amount || '?'}`
        : '💸 Ler comprovante PIX'
    }
    if (type === 'RMKT') {
      const amount = config.amount || 0
      const unit = config.unit || 'seconds'
      const type = config.messageType || 'text'
      const icons = { text: '📝', image: '📸', audio: '🎵' }
      const unitLabels = { seconds: 's', minutes: 'min', hours: 'h', days: 'd' }
      return `⏱ ${amount}${unitLabels[unit as keyof typeof unitLabels]} → ${icons[type as keyof typeof icons]}`
    }
    if (type === 'TRIGGER_SCHEDULE') {
      if (config.scheduleMode === 'datetime' && config.specificDate) {
        return `📅 ${new Date(config.specificDate).toLocaleDateString('pt-BR')} às ${config.time || '09:00'}`
      }
      if (config.scheduleMode === 'daily') {
        const days = config.selectedDays?.length ? `${config.selectedDays.length} dias` : 'Todo dia'
        return `🕐 ${days} às ${config.time || '09:00'}`
      }
      if (config.scheduleMode === 'interval') {
        return `⏱️ A cada ${config.intervalHours || 2}h`
      }
      if (config.scheduleMode === 'weekly' && config.selectedDays?.length) {
        return `📆 ${config.selectedDays.length} dias na semana às ${config.time || '09:00'}`
      }
      if (config.cronExpression) return `⚙️ Cron: ${config.cronExpression}`
      return '⏳ Não configurado'
    }

    if (type === 'TRIGGER_GRUPO') {
      if (!config.executions || config.executions.length === 0) return '👥 Nenhuma execução'
      return `📅 ${config.executions.length} execução(ões) configurada(s)`
    }

    if (type === 'PIX_SIMPLES') {
      return `🟢 R$ ${config.valor || '?'} • ${config.chavePix || 'chave não configurada'}`
    }

    if (type === 'SEND_CONTACT') {
      return `👤 ${config.nome || 'Nome'} • ${config.telefone || 'Telefone'}`
    }

    if (type === 'PROMO_SHOPEE') {
      return `🟠 ${config.searchTerm || 'Busca não configurada'} • ${config.maxQuantity || 5} produtos`
    }

    if (type === 'PIXEL_EVENT') {
      const eventLabel: Record<string, string> = {
        Lead: 'Lead', Purchase: 'Purchase', InitiateCheckout: 'InitiateCheckout',
        AddToCart: 'AddToCart', ViewContent: 'ViewContent', CompleteRegistration: 'CompleteRegistration',
        Contact: 'Contact', Schedule: 'Schedule', QualifiedLead: 'QualifiedLead',
        DisqualifiedLead: 'DisqualifiedLead', CustomEvent: config.customEventName || 'Custom',
      }
      return `📊 ${eventLabel[config.eventType] || config.eventType || 'Evento não configurado'}`
    }

    if (type === 'SEND_PIX') {
      const valor = config.valor || '?'
      const timeout = config.timeoutMinutos || 30
      return `💰 R$ ${valor} • ⏱ ${timeout}min`
    }
    if (type === 'MARK_STAGE') {
      const stageName = config.stageName || 'Nova Etapa'
      const emoji = config.emoji || '🚩'
      return `${emoji} Etapa: ${stageName}`
    }
    if (type === 'MENCIONAR_TODOS') {
      return '📣 Chamar a atenção de todos'
    }
    if (data.type === 'AQUECIMENTO') {
      const count = data.config.sequencia?.length || 0
      return `🔥 ${count} dia${count !== 1 ? 's' : ''} de aquecimento`
    }
    if (data.type === 'OFERTA_RELAMPAGO') {
      return `⚡ Oferta: ${data.config.mensagemOferta?.substring(0, 20)}...`
    }
    if (data.type === 'LEMBRETE_RECORRENTE') {
      return `⏰ Diariamente às ${data.config.horario || '09:00'}`
    }
    if (data.type === 'ENQUETE_GRUPO') {
      return `📊 Pergunta: ${data.config.question?.substring(0, 20)}...`
    }
    if (data.type === 'SEQUENCIA_LANCAMENTO') {
      const count = data.config.fases?.length || 0
      return `🎯 Lançamento: ${count} fase${count !== 1 ? 's' : ''}`
    }
    if (data.type === 'PROMO_ML_API') {
      return '🛒 Busca em tempo real (API)'
    }
    if (data.type === 'GRUPO_MEDIA') {
      const types: Record<string, string> = { image: '🖼️ Imagem', audio: '🎵 Áudio', ptt: '🎤 Áudio Voz', video: '🎬 Vídeo' }
      const label = types[data.config.mediaType] || '📲 Mídia'
      return data.config.scheduling?.enabled ? `${label} ⏰ Agendado` : label
    }
    if (data.type === 'RANDOMIZER') {
      const count = data.config.saidas?.length || 0
      const percentages = data.config.saidas?.map((s: any) => s.porcentagem).join('/') || '0'
      return `🎲 ${count} saídas: ${percentages}%`
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
        ${getBorderStyles()}
        backdrop-blur-sm
        relative
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Action Buttons - appear on hover */}
      {isHovered && (
        <div
          className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1.5 z-[100] pointer-events-auto"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleDuplicate(e);
            }}
            className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-md transition-colors flex items-center justify-center min-w-[32px] min-h-[32px] relative z-[110]"
            title="Duplicar"
          >
            <Copy size={16} />
          </button>
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-0.5" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleDelete(e);
            }}
            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-md transition-colors flex items-center justify-center min-w-[32px] min-h-[32px] relative z-[110]"
            title="Deletar"
          >
            <Trash2 size={16} />
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

        {/* Buttons Preview */}
        {isButtons && buttonsNode.length > 0 && (
          <div className="mt-2 space-y-1.5 pt-2 border-t border-gray-700/50">
            {buttonsNode.map((btn: any, idx: number) => (
              <div
                key={idx}
                className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-[10px] text-emerald-400 text-center font-medium truncate"
              >
                {btn.text || `Botão ${idx + 1}`}
              </div>
            ))}
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
                  <span key={rule.id || index} className="text-indigo-400 truncate max-w-[40px]" title={rule.value2 || String(index)}>
                    {rule.value2 || index}
                  </span>
                ))}
                <span className="text-yellow-400">Def</span>
              </div>
            </>
          ) : isPix ? (
            <div className="absolute -right-3 top-3 bottom-3 flex flex-col justify-between pointer-events-none w-28">
              <div className="relative flex items-center justify-end translate-x-3">
                <span className="mr-2 text-[10px] font-bold text-green-400 bg-[#0f172a] px-1.5 py-0.5 rounded border border-green-500/30 whitespace-nowrap shadow-sm backdrop-blur-sm">
                  PAGO
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id="success"
                  className="w-3 h-3 !bg-green-500 border-2 border-[#1a1c2e] hover:!bg-green-400 transition-colors !cursor-crosshair pointer-events-auto"
                />
              </div>
              <div className="relative flex items-center justify-end translate-x-3">
                <span className="mr-2 text-[10px] font-bold text-blue-400 bg-[#0f172a] px-1.5 py-0.5 rounded border border-blue-500/30 whitespace-nowrap shadow-sm backdrop-blur-sm">
                  DOCUMENTO
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id="document"
                  className="w-3 h-3 !bg-blue-500 border-2 border-[#1a1c2e] hover:!bg-blue-400 transition-colors !cursor-crosshair pointer-events-auto"
                />
              </div>
              <div className="relative flex items-center justify-end translate-x-3">
                <span className="mr-2 text-[10px] font-bold text-orange-400 bg-[#0f172a] px-1.5 py-0.5 rounded border border-orange-500/30 whitespace-nowrap shadow-sm backdrop-blur-sm">
                  TIMEOUT
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id="timeout"
                  className="w-3 h-3 !bg-orange-500 border-2 border-[#1a1c2e] hover:!bg-orange-400 transition-colors !cursor-crosshair pointer-events-auto"
                />
              </div>
            </div>
          ) : isRandomizer ? (
            <>
              {/* Dynamic handles for each output */}
              {randomizerSaidas.map((saida: any, index: number) => {
                const total = randomizerSaidas.length
                const position = ((index + 1) / (total + 1)) * 100
                const colors = [
                  '!bg-purple-400 !border-purple-600 hover:!bg-purple-300',
                  '!bg-blue-400 !border-blue-600 hover:!bg-blue-300',
                  '!bg-pink-400 !border-pink-600 hover:!bg-pink-300',
                  '!bg-cyan-400 !border-cyan-600 hover:!bg-cyan-300',
                  '!bg-indigo-400 !border-indigo-600 hover:!bg-indigo-300',
                ]
                const colorClass = colors[index % colors.length]

                return (
                  <Handle
                    key={saida.id || index}
                    type="source"
                    position={Position.Right}
                    id={saida.id || String(index)}
                    style={{ top: `${position}%` }}
                    className={`!w-3 !h-3 !border-2 transition-colors ${colorClass}`}
                  />
                )
              })}
              {/* Labels for randomizer outputs */}
              <div className="absolute -right-2 top-0 bottom-0 flex flex-col justify-around text-[8px] font-bold py-2 translate-x-full">
                {randomizerSaidas.map((saida: any, index: number) => (
                  <div key={saida.id || index} className="flex items-center">
                    <div className="bg-[#151515] px-1.5 py-0.5 rounded border border-purple-900/50 text-purple-400 truncate max-w-[100px] shadow-sm">
                      {saida.nome || `Saída ${index + 1}`} ({saida.porcentagem}%)
                    </div>
                  </div>
                ))}
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
          ) : isButtons ? (
            <>
              {/* Dynamic handles for each button */}
              {buttonsNode.map((button: any, index: number) => {
                const total = buttonsNode.length
                const position = ((index + 1) / (total + 1)) * 100
                return (
                  <Handle
                    key={button.id || index}
                    type="source"
                    position={Position.Right}
                    id={button.id || String(index)}
                    style={{ top: `${position}%` }}
                    className="!w-3 !h-3 !bg-emerald-400 !border-2 !border-emerald-600 hover:!bg-emerald-300 transition-colors"
                  />
                )
              })}
              {/* Labels for buttons on the side */}
              <div className="absolute -right-2 top-0 bottom-0 flex flex-col justify-around text-[8px] font-bold py-2 translate-x-full">
                {buttonsNode.map((button: any, index: number) => (
                  <div key={button.id || index} className="flex items-center">
                    <div className="bg-[#151515] px-1.5 py-0.5 rounded border border-emerald-900/50 text-emerald-400 truncate max-w-[80px] shadow-sm">
                      {button.text || `Btn ${index + 1}`}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : data.type === 'WAIT_REPLY' ? (
            <div className="absolute -right-3 top-3 bottom-3 flex flex-col justify-between pointer-events-none w-28">
              <div className="relative flex items-center justify-end translate-x-3">
                <span className="mr-2 text-[10px] font-bold text-green-400 bg-[#0f172a] px-1.5 py-0.5 rounded border border-green-500/30 whitespace-nowrap shadow-sm backdrop-blur-sm">
                  RETORNOU
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id="success"
                  className="w-3 h-3 !bg-green-500 border-2 border-[#1a1c2e] hover:!bg-green-400 transition-colors !cursor-crosshair pointer-events-auto"
                />
              </div>
              <div className="relative flex items-center justify-end translate-x-3">
                <span className="mr-2 text-[10px] font-bold text-blue-400 bg-[#0f172a] px-1.5 py-0.5 rounded border border-blue-500/30 whitespace-nowrap shadow-sm backdrop-blur-sm">
                  REMK.
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id="remarketing"
                  className="w-3 h-3 !bg-blue-500 border-2 border-[#1a1c2e] hover:!bg-blue-400 transition-colors !cursor-crosshair pointer-events-auto"
                />
              </div>
              <div className="relative flex items-center justify-end translate-x-3">
                <span className="mr-2 text-[10px] font-bold text-orange-400 bg-[#0f172a] px-1.5 py-0.5 rounded border border-orange-500/30 whitespace-nowrap shadow-sm backdrop-blur-sm">
                  TIMEOUT
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id="timeout"
                  className="w-3 h-3 !bg-orange-500 border-2 border-[#1a1c2e] hover:!bg-orange-400 transition-colors !cursor-crosshair pointer-events-auto"
                />
              </div>
            </div>
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
