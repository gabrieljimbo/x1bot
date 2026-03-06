'use client'

import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/AuthGuard'
import WhatsAppConnect from '@/components/WhatsAppConnect'

function NewSessionPageContent() {
  const router = useRouter()

  const handleSuccess = () => {
    setTimeout(() => {
      router.push('/sessions')
    }, 2000)
  }

  const handleCancel = () => {
    router.push('/sessions')
  }

  return (
    <div className="min-h-screen p-8 bg-[#0a0a0a]">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-surface border border-gray-800 rounded-lg hover:border-primary transition mb-4 text-gray-400 hover:text-white"
          >
            ← Voltar
          </button>
          <h1 className="text-4xl font-bold mb-2 text-white">Conectar WhatsApp</h1>
          <p className="text-gray-400">Escaneie o QR Code abaixo para habilitar o envio de mensagens.</p>
        </div>

        <div className="bg-[#151515] border border-gray-800 rounded-2xl p-8 shadow-xl">
          <WhatsAppConnect
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>

        <div className="mt-8 p-6 bg-black/20 border border-gray-800 rounded-2xl">
          <h2 className="text-lg font-bold mb-4 text-gray-300">Sobre as Sessões</h2>
          <ul className="space-y-3 text-sm text-gray-500">
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              Cada sessão representa uma conexão de WhatsApp.
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              Você pode ter múltiplas sessões para números diferentes.
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              As sessões permanecem conectadas mesmo se você fechar o navegador.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function NewSessionPage() {
  return (
    <AuthGuard>
      <NewSessionPageContent />
    </AuthGuard>
  )
}
