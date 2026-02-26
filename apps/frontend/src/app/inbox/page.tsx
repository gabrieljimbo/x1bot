'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { AuthGuard } from '@/components/AuthGuard'
import AppHeader from '@/components/AppHeader'
import { apiClient } from '@/lib/api-client'
import { wsClient } from '@/lib/websocket'
import {
    MessageSquare, Search, Filter, Send, ChevronDown, Check, CheckCheck,
    ArrowLeft, Users, User, Zap, Circle, RefreshCw, X, Phone, Image,
    FileText, Mic, Play
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type ConversationStatus = 'OPEN' | 'PENDING' | 'RESOLVED' | 'BOT'
type MessageStatus = 'SENT' | 'DELIVERED' | 'READ'

interface Conversation {
    id: string
    sessionId: string
    contactId: string
    contactName?: string
    contactPhone: string
    contactAvatar?: string
    lastMessage?: string
    lastMessageAt?: string
    unreadCount: number
    isGroup: boolean
    status: ConversationStatus
    activeFlowId?: string
    labels: string[]
    session?: { name: string }
}

interface Message {
    id: string
    conversationId: string
    content: string
    mediaUrl?: string
    mediaType?: string
    fromMe: boolean
    timestamp: string
    status: MessageStatus
}

interface Workflow {
    id: string
    name: string
    isActive: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusColors: Record<ConversationStatus, string> = {
    OPEN: 'text-emerald-400 bg-emerald-400/10',
    PENDING: 'text-yellow-400 bg-yellow-400/10',
    RESOLVED: 'text-gray-400 bg-gray-400/10',
    BOT: 'text-violet-400 bg-violet-400/10',
}

const statusLabels: Record<ConversationStatus, string> = {
    OPEN: 'Aberto',
    PENDING: 'Pendente',
    RESOLVED: 'Resolvido',
    BOT: 'Bot',
}

function formatTime(ts?: string | null) {
    if (!ts) return ''
    const d = new Date(ts)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 86400000) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    if (diff < 172800000) return 'Ontem'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function formatFullDate(ts: string) {
    const d = new Date(ts)
    const now = new Date()
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
    if (d.toDateString() === now.toDateString()) return 'Hoje'
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function getInitials(name?: string, phone?: string) {
    if (name) return name.charAt(0).toUpperCase()
    return (phone || '?').charAt(0)
}

function Avatar({ name, phone, size = 'md' }: { name?: string; phone?: string; size?: 'sm' | 'md' | 'lg' }) {
    const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm'
    const colors = ['bg-violet-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500', 'bg-cyan-500']
    const idx = (phone || '').charCodeAt(0) % colors.length
    return (
        <div className={`${sz} ${colors[idx]} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
            {getInitials(name, phone)}
        </div>
    )
}

// ─── ConversationListItem ─────────────────────────────────────────────────────

function ConversationListItem({
    conv,
    selected,
    onClick,
}: {
    conv: Conversation
    selected: boolean
    onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-colors relative ${selected ? 'bg-white/[0.07] border-l-2 border-[#00ff88]' : 'border-l-2 border-transparent'}`}
        >
            <div className="relative flex-shrink-0">
                <Avatar name={conv.contactName} phone={conv.contactPhone} />
                {conv.isGroup && (
                    <span className="absolute -bottom-0.5 -right-0.5 bg-[#111] rounded-full p-px">
                        <Users size={10} className="text-gray-400" />
                    </span>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm text-white truncate">
                        {conv.contactName || conv.contactPhone}
                    </span>
                    <span className="text-[10px] text-gray-500 flex-shrink-0">{formatTime(conv.lastMessageAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-gray-500 truncate">{conv.lastMessage || 'Sem mensagens'}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        {conv.unreadCount > 0 && (
                            <span className="bg-[#00ff88] text-black text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColors[conv.status]}`}>
                        {statusLabels[conv.status]}
                    </span>
                    {conv.session?.name && (
                        <span className="text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded-full truncate max-w-[80px]">
                            {conv.session.name}
                        </span>
                    )}
                </div>
            </div>
        </button>
    )
}

// ─── MediaMessage ─────────────────────────────────────────────────────────────

function MediaMessage({ msg }: { msg: Message }) {
    if (msg.mediaType === 'image') {
        return (
            <div>
                <img src={msg.mediaUrl} alt="imagem" className="max-w-[240px] rounded-lg mb-1 cursor-pointer" />
                {msg.content && <p className="text-sm">{msg.content}</p>}
            </div>
        )
    }
    if (msg.mediaType === 'audio' || msg.mediaType === 'ptt') {
        return (
            <div className="flex items-center gap-2">
                <Mic size={16} />
                <div className="flex-1 h-1 bg-white/30 rounded-full" />
                <span className="text-xs opacity-70">áudio</span>
            </div>
        )
    }
    if (msg.mediaType === 'video') {
        return (
            <div className="flex items-center gap-2">
                <Play size={16} />
                <span className="text-sm">Vídeo</span>
            </div>
        )
    }
    return (
        <div className="flex items-center gap-2">
            <FileText size={16} />
            <span className="text-sm">{msg.content || 'Documento'}</span>
        </div>
    )
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, prevMsg }: { msg: Message; prevMsg?: Message }) {
    const isFromMe = msg.fromMe
    const sameSender = prevMsg && prevMsg.fromMe === msg.fromMe

    return (
        <div className={`flex ${isFromMe ? 'justify-end' : 'justify-start'} ${sameSender ? 'mt-0.5' : 'mt-3'}`}>
            <div
                className={`max-w-[70%] px-3 py-2 text-sm ${isFromMe
                    ? 'bg-[#6d28d9] text-white rounded-[18px] rounded-br-[4px]'
                    : 'bg-[#1a1a1a] text-white rounded-[18px] rounded-bl-[4px]'
                    }`}
            >
                {msg.mediaUrl ? <MediaMessage msg={msg} /> : <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                <div className={`flex items-center gap-1 mt-1 ${isFromMe ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-[10px] opacity-50">
                        {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isFromMe && (
                        <span className="opacity-60">
                            {msg.status === 'READ' ? <CheckCheck size={12} className="text-blue-300" /> : <Check size={12} />}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── ChatArea ─────────────────────────────────────────────────────────────────

function ChatArea({
    conversation,
    onBack,
    onStatusUpdate,
}: {
    conversation: Conversation
    onBack: () => void
    onStatusUpdate: (conv: Conversation) => void
}) {
    const [messages, setMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(true)
    const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
    const [loadingMore, setLoadingMore] = useState(false)
    const [text, setText] = useState('')
    const [sending, setSending] = useState(false)
    const [workflows, setWorkflows] = useState<Workflow[]>([])
    const [showFlowMenu, setShowFlowMenu] = useState(false)
    const [showStatusMenu, setShowStatusMenu] = useState(false)
    const [currentStatus, setCurrentStatus] = useState<ConversationStatus>(conversation.status)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const messagesContainerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    const loadMessages = useCallback(async (cursor?: string) => {
        try {
            const result = await apiClient.getInboxMessages(conversation.id, cursor, 50)
            if (cursor) {
                setMessages((prev) => [...result.data, ...prev])
            } else {
                setMessages(result.data)
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'instant' }), 0)
            }
            setNextCursor(result.nextCursor)
        } catch (e) {
            console.error(e)
        }
    }, [conversation.id])

    useEffect(() => {
        setLoading(true)
        setMessages([])
        setNextCursor(undefined)
        loadMessages().finally(() => setLoading(false))
        // mark as read
        apiClient.markConversationRead(conversation.id).catch(() => { })
        // load workflows
        apiClient.getWorkflows().then((data: any[]) =>
            setWorkflows(data.filter((w) => w.isActive))
        ).catch(() => { })
    }, [conversation.id, loadMessages])

    // Real-time new message listener
    useEffect(() => {
        const handler = (data: any) => {
            if (data.conversationId !== conversation.id) return
            // Refetch latest messages when we get a notification
            apiClient.getInboxMessages(conversation.id, undefined, 1).then((res) => {
                if (res.data.length > 0) {
                    const newMsg = res.data[0]
                    setMessages((prev) => {
                        if (prev.find((m) => m.id === newMsg.id)) return prev
                        return [...prev, newMsg]
                    })
                    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
                }
            }).catch(() => { })
        }
        wsClient.onRaw('inbox:message-received', handler)
        return () => wsClient.offRaw('inbox:message-received', handler)
    }, [conversation.id])

    const handleSend = async () => {
        if (!text.trim() || sending) return
        const content = text.trim()
        setText('')
        setSending(true)
        try {
            const msg = await apiClient.sendInboxMessage(conversation.id, { text: content })
            setMessages((prev) => [...prev, msg])
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        } catch (e) {
            console.error(e)
        } finally {
            setSending(false)
            inputRef.current?.focus()
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleTriggerFlow = async (workflowId: string) => {
        setShowFlowMenu(false)
        try {
            await apiClient.triggerInboxFlow(conversation.id, workflowId)
        } catch (e) {
            console.error(e)
        }
    }

    const handleStatusChange = async (status: ConversationStatus) => {
        setShowStatusMenu(false)
        try {
            await apiClient.updateConversationStatus(conversation.id, status)
            setCurrentStatus(status)
            onStatusUpdate({ ...conversation, status })
        } catch (e) {
            console.error(e)
        }
    }

    // Group messages by date
    const grouped: Array<{ date: string; messages: Message[] }> = []
    messages.forEach((msg) => {
        const date = new Date(msg.timestamp).toDateString()
        const last = grouped[grouped.length - 1]
        if (last && last.date === date) {
            last.messages.push(msg)
        } else {
            grouped.push({ date, messages: [msg] })
        }
    })

    return (
        <div className="flex flex-col h-full">
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3 bg-[#111] flex-shrink-0">
                <button onClick={onBack} className="md:hidden text-gray-400 hover:text-white p-1">
                    <ArrowLeft size={20} />
                </button>
                <Avatar name={conversation.contactName} phone={conversation.contactPhone} size="md" />
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white text-sm truncate">
                        {conversation.contactName || conversation.contactPhone}
                    </h3>
                    <p className="text-[11px] text-gray-500 truncate">
                        {conversation.contactPhone} · {conversation.session?.name || 'Sessão desconhecida'}
                    </p>
                </div>
                {/* Status badge & menu */}
                <div className="relative">
                    <button
                        onClick={() => { setShowStatusMenu((v) => !v); setShowFlowMenu(false) }}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1 ${statusColors[currentStatus]}`}
                    >
                        {statusLabels[currentStatus]}
                        <ChevronDown size={12} />
                    </button>
                    {showStatusMenu && (
                        <div className="absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden min-w-[130px]">
                            {(['OPEN', 'PENDING', 'RESOLVED', 'BOT'] as ConversationStatus[]).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => handleStatusChange(s)}
                                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center gap-2"
                                >
                                    <span className={`w-2 h-2 rounded-full ${statusColors[s].split(' ')[0].replace('text-', 'bg-')}`} />
                                    {statusLabels[s]}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {/* Trigger flow */}
                <div className="relative">
                    <button
                        onClick={() => { setShowFlowMenu((v) => !v); setShowStatusMenu(false) }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/20 border border-violet-500/30 text-violet-400 rounded-lg text-xs hover:bg-violet-500/30 transition-colors"
                    >
                        <Zap size={12} />
                        Fluxo
                        <ChevronDown size={11} />
                    </button>
                    {showFlowMenu && (
                        <div className="absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden min-w-[180px] max-h-60 overflow-y-auto">
                            {workflows.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-gray-500">Nenhum fluxo ativo</div>
                            ) : workflows.map((wf) => (
                                <button
                                    key={wf.id}
                                    onClick={() => handleTriggerFlow(wf.id)}
                                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors text-white truncate"
                                >
                                    {wf.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto px-4 py-3 space-y-0 scrollbar-thin"
                style={{ scrollbarColor: '#333 transparent' }}
            >
                {nextCursor && (
                    <div className="text-center mb-3">
                        <button
                            onClick={async () => {
                                setLoadingMore(true)
                                await loadMessages(nextCursor)
                                setLoadingMore(false)
                            }}
                            disabled={loadingMore}
                            className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-4 py-1.5 bg-white/5 rounded-full"
                        >
                            {loadingMore ? 'Carregando...' : 'Carregar mais'}
                        </button>
                    </div>
                )}
                {loading ? (
                    <div className="flex justify-center items-center h-32">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-400" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-gray-600 text-sm mt-10">Nenhuma mensagem ainda</div>
                ) : (
                    grouped.map((group) => (
                        <div key={group.date}>
                            <div className="flex items-center gap-3 my-4">
                                <div className="flex-1 h-px bg-white/5" />
                                <span className="text-[11px] text-gray-600 px-2">{formatFullDate(group.messages[0].timestamp)}</span>
                                <div className="flex-1 h-px bg-white/5" />
                            </div>
                            {group.messages.map((msg, i) => (
                                <MessageBubble key={msg.id} msg={msg} prevMsg={group.messages[i - 1]} />
                            ))}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-white/5 bg-[#111] flex-shrink-0">
                <div className="flex items-end gap-2 bg-[#1a1a1a] rounded-2xl px-4 py-2 border border-white/5 focus-within:border-violet-500/50 transition-colors">
                    <textarea
                        ref={inputRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Digite uma mensagem..."
                        rows={1}
                        className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 resize-none outline-none max-h-28 py-1 leading-relaxed"
                        style={{ scrollbarWidth: 'none' }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!text.trim() || sending}
                        className="p-2 bg-[#00ff88] text-black rounded-xl hover:bg-[#00ff88]/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0 mb-0.5"
                    >
                        {sending ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black" />
                        ) : (
                            <Send size={16} />
                        )}
                    </button>
                </div>
                <p className="text-[10px] text-gray-700 mt-1.5 text-center">Enter para enviar · Shift+Enter para nova linha</p>
            </div>
        </div>
    )
}

// ─── Main Inbox Page ──────────────────────────────────────────────────────────

function InboxContent() {
    const { tenant } = useAuth()

    const [conversations, setConversations] = useState<Conversation[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
    const [showChat, setShowChat] = useState(false)  // mobile nav

    // Filters
    const [search, setSearch] = useState('')
    const [sessions, setSessions] = useState<any[]>([])
    const [filterSession, setFilterSession] = useState('')
    const [filterStatus, setFilterStatus] = useState('')
    const [filterType, setFilterType] = useState('')
    const [showFilters, setShowFilters] = useState(false)

    // Counts
    const openCount = conversations.filter((c) => c.status === 'OPEN').length
    const pendingCount = conversations.filter((c) => c.status === 'PENDING').length

    const loadConversations = useCallback(async () => {
        try {
            const params: any = {}
            if (filterSession) params.sessionId = filterSession
            if (filterStatus) params.status = filterStatus
            if (filterType) params.type = filterType
            params.limit = 50
            const result = await apiClient.getConversations(params)
            setConversations(result.data || [])
        } catch (e) {
            console.error(e)
        }
    }, [filterSession, filterStatus, filterType])

    useEffect(() => {
        setLoading(true)
        loadConversations().finally(() => setLoading(false))
    }, [loadConversations])

    useEffect(() => {
        apiClient.getWhatsappSessions().then(setSessions).catch(() => { })
    }, [])

    // WebSocket real-time updates
    useEffect(() => {
        const handler = (data: any) => {
            // Reload conversation list when a conversation is updated
            loadConversations()
        }
        wsClient.onRaw('inbox:conversation-updated', handler)
        return () => wsClient.offRaw('inbox:conversation-updated', handler)
    }, [loadConversations])

    // Filtered conversations
    const filtered = conversations.filter((c) => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
            (c.contactName || '').toLowerCase().includes(q) ||
            c.contactPhone.toLowerCase().includes(q)
        )
    })

    const handleSelectConv = (conv: Conversation) => {
        setSelectedConv(conv)
        setShowChat(true)
        // Reset unread in local state
        setConversations((prev) =>
            prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
        )
    }

    const handleStatusUpdate = (updated: Conversation) => {
        setConversations((prev) =>
            prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
        )
        setSelectedConv((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev))
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
            <AppHeader />

            {/* Top bar */}
            <div className="bg-[#111] border-b border-white/5 px-4 py-3 flex items-center gap-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <MessageSquare size={18} className="text-[#00ff88]" />
                    <h1 className="text-white font-semibold text-sm">Inbox</h1>
                </div>
                <div className="flex items-center gap-2 ml-2">
                    <span className="text-[11px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                        {openCount} abertos
                    </span>
                    {pendingCount > 0 && (
                        <span className="text-[11px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                            {pendingCount} pendentes
                        </span>
                    )}
                </div>
                <div className="flex-1" />
                <button
                    onClick={loadConversations}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                    title="Atualizar"
                >
                    <RefreshCw size={15} />
                </button>
            </div>

            {/* Main layout */}
            <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 110px)' }}>

                {/* ── Conversation list (left panel) ── */}
                <div className={`${showChat ? 'hidden md:flex' : 'flex'} w-full md:w-[340px] lg:w-[380px] flex-col border-r border-white/5 flex-shrink-0`}>

                    {/* Search + Filter bar */}
                    <div className="p-3 border-b border-white/5 bg-[#0d0d0d]">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 flex items-center gap-2 bg-[#1a1a1a] rounded-xl px-3 py-2 border border-white/5 focus-within:border-[#00ff88]/40 transition-colors">
                                <Search size={14} className="text-gray-500 flex-shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Buscar contato ou número..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none min-w-0"
                                />
                                {search && (
                                    <button onClick={() => setSearch('')}>
                                        <X size={13} className="text-gray-500 hover:text-white" />
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => setShowFilters((v) => !v)}
                                className={`p-2 rounded-xl border transition-colors flex-shrink-0 ${showFilters ? 'bg-[#00ff88]/20 border-[#00ff88]/40 text-[#00ff88]' : 'bg-[#1a1a1a] border-white/5 text-gray-400 hover:text-white'}`}
                            >
                                <Filter size={15} />
                            </button>
                        </div>

                        {/* Filters expanded */}
                        {showFilters && (
                            <div className="mt-3 grid grid-cols-3 gap-2">
                                <select
                                    value={filterSession}
                                    onChange={(e) => setFilterSession(e.target.value)}
                                    className="bg-[#1a1a1a] border border-white/5 text-xs text-gray-300 rounded-lg px-2 py-1.5 outline-none"
                                >
                                    <option value="">Todas sessões</option>
                                    {sessions.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="bg-[#1a1a1a] border border-white/5 text-xs text-gray-300 rounded-lg px-2 py-1.5 outline-none"
                                >
                                    <option value="">Todos status</option>
                                    <option value="OPEN">Aberto</option>
                                    <option value="PENDING">Pendente</option>
                                    <option value="RESOLVED">Resolvido</option>
                                    <option value="BOT">Bot</option>
                                </select>
                                <select
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value)}
                                    className="bg-[#1a1a1a] border border-white/5 text-xs text-gray-300 rounded-lg px-2 py-1.5 outline-none"
                                >
                                    <option value="">Todos tipos</option>
                                    <option value="individual">Individual</option>
                                    <option value="group">Grupo</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#222 transparent' }}>
                        {loading ? (
                            <div className="flex justify-center items-center h-32">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#00ff88]" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center px-6">
                                <MessageSquare size={32} className="text-gray-700" />
                                <div>
                                    <p className="text-gray-500 text-sm font-medium">Nenhuma conversa</p>
                                    <p className="text-gray-700 text-xs mt-1">Quando alguém enviar uma mensagem, ela aparecerá aqui</p>
                                </div>
                            </div>
                        ) : (
                            <div>
                                {filtered.map((conv) => (
                                    <ConversationListItem
                                        key={conv.id}
                                        conv={conv}
                                        selected={selectedConv?.id === conv.id}
                                        onClick={() => handleSelectConv(conv)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Chat area (right panel) ── */}
                <div className={`${showChat ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
                    {selectedConv ? (
                        <ChatArea
                            key={selectedConv.id}  // remount when conv changes
                            conversation={selectedConv}
                            onBack={() => setShowChat(false)}
                            onStatusUpdate={handleStatusUpdate}
                        />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
                            <div className="w-20 h-20 rounded-2xl bg-[#111] border border-white/5 flex items-center justify-center">
                                <MessageSquare size={36} className="text-gray-700" />
                            </div>
                            <div>
                                <p className="text-gray-400 font-medium">Selecione uma conversa</p>
                                <p className="text-gray-700 text-sm mt-1">Escolha uma conversa na lista para ver as mensagens</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function InboxPage() {
    return (
        <AuthGuard>
            <InboxContent />
        </AuthGuard>
    )
}
