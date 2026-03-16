'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, ShieldCheck, Zap, AlertTriangle } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import AppHeader from '@/components/AppHeader'
import CampaignsSidebar from '@/components/campaigns/CampaignsSidebar'

const DEFAULT_SETTINGS = {
  autoBlacklistOptOut: true,
  autoBlacklistBadNumbers: true,
  exposureLimitsEnabled: true,
  reputationQuarantineEnabled: true,
  sessionHealthFilterEnabled: true,
  timingOptimizationEnabled: false,
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <div
      className={`w-12 h-6 rounded-full cursor-pointer transition-colors relative flex-shrink-0 ${enabled ? 'bg-[#00ff88]' : 'bg-gray-700'}`}
      onClick={onChange}
    >
      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
    </div>
  )
}

export default function CampaignSettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiClient.getCampaignSettings()
      .then(data => { if (data) setSettings({ ...DEFAULT_SETTINGS, ...data }) })
      .catch(() => setError('Erro ao carregar configurações'))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (key: keyof typeof settings) =>
    setSettings(s => ({ ...s, [key]: !s[key] }))

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      await apiClient.updateCampaignSettings(settings)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  const protections = [
    {
      group: 'Blacklist Automático',
      description: 'Adiciona contatos ao blacklist automaticamente em casos específicos.',
      icon: <AlertTriangle size={18} className="text-yellow-400" />,
      items: [
        {
          key: 'autoBlacklistOptOut' as const,
          label: 'Blacklist por Opt-Out',
          description: 'Adiciona ao blacklist quando o contato envia "pare", "stop" ou similar. Respeita LGPD.',
        },
        {
          key: 'autoBlacklistBadNumbers' as const,
          label: 'Blacklist por Número Inválido',
          description: 'Adiciona ao blacklist após 2+ erros de entrega consecutivos (número inexistente ou bloqueado).',
        },
      ],
    },
    {
      group: 'Controle de Exposição',
      description: 'Limita a frequência de envios para proteger a experiência do contato.',
      icon: <ShieldCheck size={18} className="text-blue-400" />,
      items: [
        {
          key: 'exposureLimitsEnabled' as const,
          label: 'Limite de Exposição Diário/Semanal',
          description: 'Máximo de 1 campanha por dia e 3 por semana para cada número. Evita sobrecarga.',
        },
        {
          key: 'reputationQuarantineEnabled' as const,
          label: 'Respeitar Quarentena de Opt-Out',
          description: 'Não envia para contatos em quarentena (pediram para parar). Período: 30 dias.',
        },
      ],
    },
    {
      group: 'Saúde das Sessões',
      description: 'Protege os números de WhatsApp de comportamentos suspeitos.',
      icon: <Zap size={18} className="text-green-400" />,
      items: [
        {
          key: 'sessionHealthFilterEnabled' as const,
          label: 'Filtro de Saúde da Sessão',
          description: 'Pausa sessões com score de saúde < 40/100 para evitar banimento. Recomendado.',
        },
        {
          key: 'timingOptimizationEnabled' as const,
          label: 'Otimização de Horário',
          description: 'Adia envios em horários com baixo engajamento histórico (requer 100+ envios por hora para ativar).',
        },
      ],
    },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
        <AppHeader />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-[#00ff88]" size={32} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <AppHeader />
      <div className="flex flex-1">
        <CampaignsSidebar />
        <main className="flex-1 p-8 max-w-3xl">
          <div className="mb-8">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <ShieldCheck className="text-[#00ff88]" size={28} />
              Proteções Anti-Spam
            </h1>
            <p className="text-gray-400 mt-1 text-sm">
              Configure quais filtros de proteção ficam ativos nas campanhas deste workspace.
            </p>
          </div>

          {success && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 flex items-center gap-3">
              <Zap size={16} />
              Configurações salvas com sucesso.
            </div>
          )}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {protections.map(group => (
              <div key={group.group} className="bg-[#151515] border border-gray-800 rounded-xl overflow-hidden">
                <div className="p-5 border-b border-gray-800 bg-[#1a1a1a] flex items-center gap-3">
                  {group.icon}
                  <div>
                    <h3 className="font-semibold text-sm">{group.group}</h3>
                    <p className="text-gray-500 text-xs mt-0.5">{group.description}</p>
                  </div>
                </div>
                <div className="divide-y divide-gray-800/60">
                  {group.items.map(item => (
                    <div key={item.key} className="flex items-center justify-between p-5 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-200">{item.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                      </div>
                      <Toggle enabled={settings[item.key]} onChange={() => toggle(item.key)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-8">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-8 py-3 bg-[#00ff88] text-black font-bold rounded-lg hover:bg-[#00ff88]/90 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}
