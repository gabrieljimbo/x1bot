'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Save, ArrowLeft, Play, Pause, Users, X, Plus, Upload, Phone, List } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import { AuthGuard } from '@/components/AuthGuard'
import AppHeader from '@/components/AppHeader'
import { WorkflowNode, WorkflowEdge, WorkflowNodeType } from '@n9n/shared'
import NodeConfigModal from '@/components/NodeConfigModal'

const WorkflowCanvas = dynamic(() => import('@/components/WorkflowCanvas'), { ssr: false })

// Nodes blocked for campaign workflows
const BLOCKED_NODES = new Set([
  'MENCIONAR_TODOS', 'INICIO_DE_GRUPO', 'FLUXO_DE_GRUPO', 'PROMO_ML', 'PROMO_SHOPEE',
  'TRIGGER_WHATSAPP', 'TRIGGER_KEYWORD', 'TRIGGER_MESSAGE', 'TRIGGER_SCHEDULE',
  'TRIGGER_MANUAL', 'TRIGGER_GRUPO',
])

// Campaign-specific node types
const CAMPAIGN_START_NODE_TYPE = 'CAMPAIGN_START' as WorkflowNodeType
const STOP_CAMPAIGN_NODE_TYPE = 'STOP_CAMPAIGN' as WorkflowNodeType
const SEND_GROUP_INVITE_NODE_TYPE = 'SEND_GROUP_INVITE' as WorkflowNodeType

const CAMPAIGN_NODES = [
  { type: CAMPAIGN_START_NODE_TYPE, label: 'Início de Campanha', icon: '🚀', color: 'from-green-500 to-emerald-600', description: 'Ponto de entrada do fluxo de campanha', canDelete: false },
  { type: STOP_CAMPAIGN_NODE_TYPE, label: 'Parar Campanha', icon: '🛑', color: 'from-red-500 to-red-600', description: 'Para a execução para este contato' },
  { type: SEND_GROUP_INVITE_NODE_TYPE, label: 'Enviar Convite de Grupo', icon: '👥', color: 'from-indigo-500 to-indigo-600', description: 'Envia convite para um grupo WhatsApp' },
]

const ALLOWED_ACTION_NODES = [
  'SEND_MESSAGE', 'SEND_MEDIA', 'SEND_CONTACT', 'PIX_RECOGNITION', 'RMKT', 'RANDOMIZER',
  'SET_TAGS', 'MANAGE_LABELS', 'WAIT_REPLY', 'WAIT', 'CONDITION', 'SWITCH', 'MARK_STAGE', 'END',
]

interface ContactList { id: string; name: string; _count: { contacts: number } }

function RecipientsDrawer({ campaignId, onClose }: { campaignId: string; onClose: () => void }) {
  const [mode, setMode] = useState<'phones' | 'csv' | 'inbox' | 'list'>('phones')
  const [contactLists, setContactLists] = useState<ContactList[]>([])
  const [phonesText, setPhonesText] = useState('')
  const [csvText, setCsvText] = useState('')
  const [tags, setTags] = useState('')
  const [selectedListId, setSelectedListId] = useState('')
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => { apiClient.getContactLists().then(setContactLists).catch(() => {}) }, [])

  const handleAdd = async () => {
    try {
      let r: any
      if (mode === 'phones') {
        r = await apiClient.addCampaignRecipientsFromPhones(campaignId, phonesText.split(/[\n,]/).map(p => p.trim()).filter(Boolean))
      } else if (mode === 'csv') {
        r = await apiClient.addCampaignRecipientsFromCsv(campaignId, csvText)
      } else if (mode === 'inbox') {
        r = await apiClient.addCampaignRecipientsFromContacts(campaignId, tags.split(',').map(t => t.trim()).filter(Boolean))
      } else {
        if (!selectedListId) return alert('Selecione uma lista')
        r = await apiClient.addCampaignRecipientsFromList(campaignId, selectedListId)
      }
      setResult(`${r.added} adicionados. Total: ${r.total}`)
    } catch (e: any) {
      setResult('Erro: ' + (e?.response?.data?.message || e.message))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-white font-bold">Vincular Destinatários</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            {([
              { m: 'phones' as const, label: 'Números', icon: <Phone size={12} /> },
              { m: 'csv' as const, label: 'CSV', icon: <Upload size={12} /> },
              { m: 'inbox' as const, label: 'Do Inbox', icon: <List size={12} /> },
              { m: 'list' as const, label: 'Listas', icon: <List size={12} /> },
            ]).map(({ m, label, icon }) => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${mode === m ? 'bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/40' : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white'}`}>
                {icon} {label}
              </button>
            ))}
          </div>
          {mode === 'phones' && (
            <textarea rows={5} value={phonesText} onChange={e => setPhonesText(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono resize-none"
              placeholder={'5511999990000\n5521988880000'} />
          )}
          {mode === 'csv' && (
            <textarea rows={5} value={csvText} onChange={e => setCsvText(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono resize-none"
              placeholder={'5511999990000,João\n5521988880000,Maria'} />
          )}
          {mode === 'inbox' && (
            <input value={tags} onChange={e => setTags(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              placeholder="Tags (vazio = todos)" />
          )}
          {mode === 'list' && (
            <select value={selectedListId} onChange={e => setSelectedListId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
              <option value="">Selecione uma lista...</option>
              {contactLists.map(l => (
                <option key={l.id} value={l.id}>{l.name} ({l._count.contacts})</option>
              ))}
            </select>
          )}
          <button onClick={handleAdd}
            className="w-full py-2 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-lg text-[#00ff88] text-sm font-medium hover:bg-[#00ff88]/20 transition">
            Adicionar
          </button>
          {result && <p className="text-xs text-green-400">{result}</p>}
        </div>
      </div>
    </div>
  )
}

// Campaign-specific NodesSidebar (excludes blocked nodes, adds campaign nodes)
function CampaignNodesSidebar({ onAddNode, onClose }: { onAddNode: (type: WorkflowNodeType) => void; onClose: () => void }) {
  const allowedActions = [
    { type: 'SEND_MESSAGE' as WorkflowNodeType, label: 'Enviar Mensagem', icon: '💬' },
    { type: 'SEND_MEDIA' as WorkflowNodeType, label: 'Enviar Mídia', icon: '📸' },
    { type: 'SEND_CONTACT' as WorkflowNodeType, label: 'Enviar Contato', icon: '👤' },
    { type: 'PIX_RECOGNITION' as WorkflowNodeType, label: 'Reconhecer PIX', icon: '💸' },
    { type: 'RMKT' as WorkflowNodeType, label: 'Remarketing', icon: '🎯' },
    { type: WorkflowNodeType.RANDOMIZER, label: 'Randomizador', icon: '🎲' },
    { type: 'SET_TAGS' as WorkflowNodeType, label: 'Gerenciar Tags', icon: '🏷️' },
    { type: 'MANAGE_LABELS' as WorkflowNodeType, label: 'Gerenciar Etiquetas', icon: '🏷️' },
    { type: 'WAIT_REPLY' as WorkflowNodeType, label: 'Aguardar Resposta', icon: '⏳' },
    { type: 'WAIT' as WorkflowNodeType, label: 'Aguardar Tempo', icon: '⏱️' },
    { type: 'CONDITION' as WorkflowNodeType, label: 'Condição', icon: '🔀' },
    { type: 'MARK_STAGE' as WorkflowNodeType, label: 'Marcar Etapa', icon: '🚩' },
    { type: 'END' as WorkflowNodeType, label: 'Finalizar', icon: '🔴' },
  ]

  return (
    <div className="w-56 bg-[#1a1a1a] border-r border-white/10 h-full overflow-y-auto flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nodes</span>
        <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={14} /></button>
      </div>
      <div className="p-2 space-y-1">
        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-2 py-1">Campanha</p>
        {CAMPAIGN_NODES.slice(1).map(node => (
          <button key={node.type} onClick={() => onAddNode(node.type)}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition text-left">
            <span>{node.icon}</span> {node.label}
          </button>
        ))}
        <div className="border-t border-white/5 my-1" />
        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-2 py-1">Ações</p>
        {allowedActions.map(node => (
          <button key={String(node.type)} onClick={() => onAddNode(node.type)}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition text-left">
            <span>{node.icon}</span> {node.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function CampaignWorkflowEditorContent() {
  const params = useParams()
  const router = useRouter()
  const campaignId = params.id as string
  const { tenant } = useAuth()

  const [campaign, setCampaign] = useState<any>(null)
  const [nodes, setNodes] = useState<WorkflowNode[]>([])
  const [edges, setEdges] = useState<WorkflowEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null)
  const [showSidebar, setShowSidebar] = useState(true)
  const [showRecipients, setShowRecipients] = useState(false)

  const nodesRef = useRef<WorkflowNode[]>([])
  const edgesRef = useRef<WorkflowEdge[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const [camp, wf] = await Promise.all([
          apiClient.getCampaign(campaignId),
          apiClient.getCampaignWorkflow(campaignId),
        ])
        setCampaign(camp)

        let wfNodes: WorkflowNode[] = wf.nodes || []
        const wfEdges: WorkflowEdge[] = wf.edges || []

        // Ensure CAMPAIGN_START node always exists
        if (!wfNodes.find((n: WorkflowNode) => n.type === CAMPAIGN_START_NODE_TYPE)) {
          wfNodes = [{
            id: 'campaign-start',
            type: CAMPAIGN_START_NODE_TYPE,
            position: { x: 300, y: 100 },
            config: {},
          }, ...wfNodes]
        }

        setNodes(wfNodes)
        setEdges(wfEdges)
        nodesRef.current = wfNodes
        edgesRef.current = wfEdges
      } catch { /* noop */ } finally { setLoading(false) }
    }
    load()
  }, [campaignId])

  const handleChange = async (n: WorkflowNode[], e: WorkflowEdge[]) => {
    nodesRef.current = n
    edgesRef.current = e
    // Sync state for components that might rely on it
    setNodes(n)
    setEdges(e)

    // Auto-save on significant changes (node movement, edge changes, etc)
    try {
      setSaveStatus('saving')
      await apiClient.saveCampaignWorkflow(campaignId, n, e)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiClient.saveCampaignWorkflow(campaignId, nodesRef.current, edgesRef.current)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const handleAddNode = async (type: WorkflowNodeType) => {
    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      type,
      position: { x: 300 + Math.random() * 200, y: 200 + Math.random() * 100 },
      config: {},
    }
    const updated = [...nodesRef.current, newNode]
    const currentEdges = edgesRef.current

    try {
      setSaveStatus('saving')
      await apiClient.saveCampaignWorkflow(campaignId, updated, currentEdges)
      setNodes(updated)
      setEdges([...currentEdges]) // Sync state
      nodesRef.current = updated
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
    }
  }

  const handleDuplicateNode = async (nodeId: string) => {
    const sourceNode = nodesRef.current.find(n => n.id === nodeId)
    if (!sourceNode) return

    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      type: sourceNode.type,
      position: {
        x: (sourceNode.position?.x || 0) + 40,
        y: (sourceNode.position?.y || 0) + 40,
      },
      config: { ...sourceNode.config },
    }

    const updatedNodes = [...nodesRef.current, newNode]
    const currentEdges = edgesRef.current

    try {
      setSaveStatus('saving')
      await apiClient.saveCampaignWorkflow(campaignId, updatedNodes, currentEdges)
      setNodes(updatedNodes)
      setEdges([...currentEdges])
      nodesRef.current = updatedNodes
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00ff88]/30 border-t-[#00ff88] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      <AppHeader />
      {/* Editor header */}
      <div className="flex-none flex items-center gap-4 px-6 py-3 bg-[#111] border-b border-white/10">
        <button onClick={() => router.push('/campaigns/workflows')}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="w-px h-5 bg-white/10" />
        <h1 className="text-white font-semibold text-sm">{campaign?.name}</h1>
        <div className="flex-1" />
        <button onClick={() => setShowRecipients(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 text-gray-300 rounded-lg text-sm hover:border-white/20 transition">
          <Users size={14} /> Destinatários ({campaign?._count?.recipients ?? 0})
        </button>
        {campaign?.status === 'DRAFT' || campaign?.status === 'PAUSED' ? (
          <button onClick={() => campaign.status === 'PAUSED'
            ? apiClient.resumeCampaign(campaignId).then(() => setCampaign((c: any) => ({ ...c, status: 'RUNNING' })))
            : apiClient.startCampaign(campaignId).then(() => setCampaign((c: any) => ({ ...c, status: 'RUNNING' }))).catch(e => alert(e?.response?.data?.message))}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg text-sm hover:bg-green-500/30 transition">
            <Play size={14} /> {campaign?.status === 'PAUSED' ? 'Retomar' : 'Iniciar'}
          </button>
        ) : campaign?.status === 'RUNNING' ? (
          <button onClick={() => apiClient.pauseCampaign(campaignId).then(() => setCampaign((c: any) => ({ ...c, status: 'PAUSED' })))}
            className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded-lg text-sm hover:bg-yellow-500/30 transition">
            <Pause size={14} /> Pausar
          </button>
        ) : null}
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-1.5 bg-[#00ff88] text-black font-bold rounded-lg text-sm hover:bg-[#00dd77] transition disabled:opacity-50">
          <Save size={14} />
          {saving ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo!' : saveStatus === 'error' ? 'Erro!' : 'Salvar'}
        </button>
      </div>

      {/* Editor body */}
      <div className="flex flex-1 overflow-hidden">
        {showSidebar && (
          <CampaignNodesSidebar
            onAddNode={handleAddNode}
            onClose={() => setShowSidebar(false)}
          />
        )}
        <div className="flex-1 overflow-hidden relative">
          {!showSidebar && (
            <button onClick={() => setShowSidebar(true)}
              className="absolute top-4 left-4 z-10 px-3 py-1.5 bg-[#1a1a1a] border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white transition flex items-center gap-2">
              <Plus size={14} /> Adicionar Node
            </button>
          )}
          <WorkflowCanvas
            initialNodes={nodes}
            initialEdges={edges}
            onChange={handleChange}
            onNodeDoubleClick={(node) => {
              if (node.type !== CAMPAIGN_START_NODE_TYPE) setSelectedNode(node)
            }}
            onAddNode={handleAddNode}
            onDuplicateNode={handleDuplicateNode}
          />
        </div>
      </div>

      {selectedNode && tenant?.id && (
        <NodeConfigModal
          node={selectedNode}
          tenantId={tenant.id}
          workflowId={campaignId}
          onClose={() => setSelectedNode(null)}
          onSave={async (nodeId, config) => {
            const updated = nodesRef.current.map(n => n.id === nodeId ? { ...n, config } : n)
            const currentEdges = edgesRef.current
            
            try {
              setSaveStatus('saving')
              await apiClient.saveCampaignWorkflow(campaignId, updated, currentEdges)
              setNodes(updated)
              setEdges([...currentEdges])
              nodesRef.current = updated
              setSaveStatus('saved')
              setTimeout(() => setSaveStatus('idle'), 2000)
            } catch {
              setSaveStatus('error')
            }
            setSelectedNode(null)
          }}
        />
      )}

      {showRecipients && (
        <RecipientsDrawer campaignId={campaignId} onClose={() => setShowRecipients(false)} />
      )}
    </div>
  )
}

export default function CampaignWorkflowEditorPage() {
  return <AuthGuard><CampaignWorkflowEditorContent /></AuthGuard>
}
