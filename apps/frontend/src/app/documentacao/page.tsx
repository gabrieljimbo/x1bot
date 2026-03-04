'use client'

import React, { useState, useEffect } from 'react'
import { Search, ChevronUp, Menu, X, Rocket, Crosshair, Zap, Users, BookOpen, HelpCircle } from 'lucide-react'

// --- Types ---
type SectionType = {
    id: string
    title: string
    icon?: React.ReactNode
    subitems?: { id: string; title: string }[]
}

// --- Navigation Structure ---
const DOC_SECTIONS: SectionType[] = [
    { id: 'inicio', title: 'Início', icon: <Rocket className="w-4 h-4" /> },
    { id: 'quickstart', title: 'Guia de Início Rápido', icon: <BookOpen className="w-4 h-4" /> },
    {
        id: 'triggers',
        title: 'Gatilhos',
        icon: <Crosshair className="w-4 h-4" />,
        subitems: [
            { id: 'trigger-whatsapp', title: 'WhatsApp' },
            { id: 'trigger-manual', title: 'Manual' },
            { id: 'trigger-agendamento', title: 'Agendamento' },
            { id: 'trigger-keyword', title: 'Keyword' },
            { id: 'trigger-grupo', title: 'Grupo' },
        ],
    },
    {
        id: 'actions',
        title: 'Ações do Fluxo',
        icon: <Zap className="w-4 h-4" />,
        subitems: [
            { id: 'action-mensagem', title: 'Enviar Mensagem' },
            { id: 'action-midia', title: 'Enviar Mídia' },
            { id: 'action-wait', title: 'Aguardar (Wait)' },
            { id: 'action-condicao', title: 'Condição (If/Else)' },
            { id: 'action-variavel', title: 'Definir Variável' },
            { id: 'action-http', title: 'Requisição HTTP' },
            { id: 'action-webhook', title: 'Webhook Externo' },
            { id: 'action-ia', title: 'Agente de IA' },
            { id: 'action-pix', title: 'Enviar PIX' },
            { id: 'action-lista', title: 'Enviar Lista' },
            { id: 'action-botoes', title: 'Enviar Botões' },
            { id: 'action-etapa', title: 'Marcar Etapa' },
            { id: 'action-reengajamento', title: 'Reengajamento' },
            { id: 'action-rec-pix', title: 'Reconhecimento PIX' },
            { id: 'action-scrape', title: 'HTTP Scrape' },
            { id: 'action-promoml-puppeteer', title: 'Promo ML (Puppeteer)' },
            { id: 'action-promoml-api', title: 'Promo ML API' },
            { id: 'action-randomizer', title: 'Randomizador' },
        ],
    },
    {
        id: 'group-nodes',
        title: 'Nodes de Grupo',
        icon: <Users className="w-4 h-4" />,
        subitems: [
            { id: 'group-mencionar', title: 'Mencionar Todos' },
            { id: 'group-aquecimento', title: 'Aquecimento' },
            { id: 'group-oferta', title: 'Oferta Relâmpago' },
            { id: 'group-lembrete', title: 'Lembrete Recorrente' },
            { id: 'group-enquete', title: 'Enquete' },
            { id: 'group-sequencia', title: 'Sequência de Lançamento' },
            { id: 'group-midia', title: 'Mídia para Grupo' },
            { id: 'group-wait', title: 'Aguardar Grupo' },
        ],
    },
    {
        id: 'tutorials',
        title: 'Tutoriais',
        icon: <BookOpen className="w-4 h-4" />,
        subitems: [
            { id: 'tut-primeiro', title: 'Criar primeiro fluxo' },
            { id: 'tut-atendimento', title: 'Bot de atendimento' },
            { id: 'tut-funil', title: 'Funil de vendas' },
            { id: 'tut-validar', title: 'Validar comprovante' },
            { id: 'tut-achadinhos', title: 'Achadinhos do ML' },
            { id: 'tut-lancamento', title: 'Lançamento em grupos' },
        ],
    },
    { id: 'faq', title: 'FAQ', icon: <HelpCircle className="w-4 h-4" /> },
]

export default function DocumentationPage() {
    const [activeSection, setActiveSection] = useState<string>('inicio')
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [showScrollTop, setShowScrollTop] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    // Scroll Spy & Scroll to Top logic
    useEffect(() => {
        const handleScroll = () => {
            // Show/hide scroll to top
            setShowScrollTop(window.scrollY > 300)

            // Find the current section
            const sections = document.querySelectorAll('section[id]')
            let currentId = 'inicio'

            sections.forEach((section) => {
                const sectionTop = (section as HTMLElement).offsetTop
                if (window.scrollY >= sectionTop - 100) {
                    currentId = section.getAttribute('id') || 'inicio'
                }
            })

            setActiveSection(currentId)
        }

        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    // Handle Ctrl+K for search (mocking focus for now)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault()
                document.getElementById('doc-search')?.focus()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id)
        if (element) {
            window.scrollTo({
                top: element.offsetTop - 80, // Offset for header/padding
                behavior: 'smooth',
            })
            setActiveSection(id)
            setIsSidebarOpen(false) // Close mobile sidebar on click
        }
    }

    return (
        <div className="flex min-h-screen bg-[#0a0a0a] text-gray-300 font-sans">

            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0f0f0f] border-b border-gray-800 flex items-center justify-between px-4 z-50">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
                        <Rocket className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-bold text-white text-lg">X1Bot Docs</span>
                </div>
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-400 hover:text-white">
                    {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>

            {/* Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-[#0f0f0f] border-r border-gray-800
        transform transition-transform duration-300 ease-in-out lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col h-full overflow-y-auto custom-scrollbar
      `}>
                <div className="p-6 hidden lg:flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                        <Rocket className="w-6 h-6 text-primary" />
                    </div>
                    <span className="font-bold text-white text-xl tracking-tight">X1Bot Docs</span>
                </div>

                <div className="px-6 pb-4 pt-4 lg:pt-0">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-primary transition-colors" />
                        <input
                            id="doc-search"
                            type="text"
                            placeholder="Buscar..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#1a1a1a] border border-gray-800 rounded-lg pl-9 pr-12 py-2 text-sm text-gray-200 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all placeholder-gray-600"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <span className="bg-gray-800 text-gray-500 text-[10px] px-1.5 py-0.5 rounded font-medium border border-gray-700">Ctrl</span>
                            <span className="bg-gray-800 text-gray-500 text-[10px] px-1.5 py-0.5 rounded font-medium border border-gray-700">K</span>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 px-4 pb-8 space-y-1 relative">
                    {DOC_SECTIONS.map((section) => (
                        <div key={section.id} className="mb-6">
                            <button
                                onClick={() => scrollToSection(section.id)}
                                className={`
                  flex items-center gap-2 w-full px-3 py-2 text-sm font-semibold rounded-md transition-colors
                  ${activeSection === section.id || section.subitems?.some(sub => activeSection === sub.id)
                                        ? 'text-white'
                                        : 'text-gray-400 hover:text-gray-200'
                                    }
                `}
                            >
                                <span className={`${activeSection === section.id || section.subitems?.some(sub => activeSection === sub.id) ? 'text-primary' : 'text-gray-500'}`}>
                                    {section.icon}
                                </span>
                                {section.title}
                            </button>

                            {section.subitems && section.subitems.length > 0 && (
                                <div className="ml-5 mt-1 pl-4 border-l border-gray-800 flex flex-col gap-1">
                                    {section.subitems.map((subitem) => (
                                        <button
                                            key={subitem.id}
                                            onClick={() => scrollToSection(subitem.id)}
                                            className={`
                        text-left px-3 py-1.5 text-xs rounded-md transition-all
                        ${activeSection === subitem.id
                                                    ? 'text-primary bg-primary/10 font-medium'
                                                    : 'text-gray-500 hover:text-gray-300 hover:bg-[#1a1a1a]'
                                                }
                      `}
                                        >
                                            {subitem.title}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 lg:ml-72 min-h-screen pt-16 lg:pt-0">
                <div className="max-w-4xl mx-auto px-6 lg:px-12 py-10 lg:py-16">

                    {/* INÍCIO */}
                    <section id="inicio" className="mb-24 scroll-mt-24">
                        <h1 className="text-4xl lg:text-5xl font-extrabold text-white mb-6 tracking-tight">
                            Aprenda a criar fluxos incríveis no X1Bot 🚀
                        </h1>
                        <p className="text-lg text-gray-400 mb-10 max-w-2xl leading-relaxed">
                            Bem-vindo à documentação oficial da plataforma mais versátil para automação de WhatsApp. Masterize os nodes, entenda os gatilhos e construa atendimentos imbatíveis.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-[#111] border border-gray-800 p-6 rounded-2xl hover:border-primary/50 transition-all group cursor-pointer" onClick={() => scrollToSection('quickstart')}>
                                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                                    <Rocket className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="text-white font-semibold text-lg mb-2">Início Rápido</h3>
                                <p className="text-gray-500 text-sm">Configure sua primeira sessão e monte seu fluxo em 5 minutos.</p>
                            </div>

                            <div className="bg-[#111] border border-gray-800 p-6 rounded-2xl hover:border-[#3b82f6]/50 transition-all group cursor-pointer" onClick={() => scrollToSection('actions')}>
                                <div className="w-12 h-12 bg-[#3b82f6]/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#3b82f6]/20 transition-colors">
                                    <Zap className="w-6 h-6 text-[#3b82f6]" />
                                </div>
                                <h3 className="text-white font-semibold text-lg mb-2">Nodes do Fluxo</h3>
                                <p className="text-gray-500 text-sm">Entenda como funcionam as IAs, envios de mídia, aguardos e condições.</p>
                            </div>

                            <div className="bg-[#111] border border-gray-800 p-6 rounded-2xl hover:border-[#10b981]/50 transition-all group cursor-pointer" onClick={() => scrollToSection('tutorials')}>
                                <div className="w-12 h-12 bg-[#10b981]/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#10b981]/20 transition-colors">
                                    <BookOpen className="w-6 h-6 text-[#10b981]" />
                                </div>
                                <h3 className="text-white font-semibold text-lg mb-2">Tutoriais Reais</h3>
                                <p className="text-gray-500 text-sm">Passo a passo para criar funis de venda, Lançamentos em Grupo e mais.</p>
                            </div>
                        </div>
                    </section>

                    {/* GUIA DE INÍCIO RÁPIDO */}
                    <section id="quickstart" className="mb-24 scroll-mt-24 border-t border-gray-800 pt-16">
                        <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
                            <BookOpen className="text-primary" /> Guia de Início Rápido
                        </h2>

                        <div className="space-y-12">
                            <div>
                                <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 text-xs text-white">1</span>
                                    Conectar seu WhatsApp
                                </h3>
                                <p className="text-gray-400 mb-4">
                                    O X1Bot requer uma sessão de WhatsApp conectada para operar. Navegue até o menu de <strong>Sessões</strong> no painel lateral esquerdo, clique em &quot;Nova Sessão&quot; e faça o escaneamento do QR Code com o seu celular pelo WhatsApp Web.
                                </p>
                                <div className="bg-[#131313] border border-gray-800 rounded-lg p-8 flex items-center justify-center">
                                    <p className="text-gray-600 italic">Screenshot: QR Code Scan (Emulação)</p>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 text-xs text-white">2</span>
                                    Criar seu primeiro fluxo
                                </h3>
                                <p className="text-gray-400 mb-4">
                                    No menu <strong>Fluxos</strong>, clique em &quot;Novo Fluxo&quot;. Você verá o <em>Canvas</em> principal. Todo fluxo começa com um &quot;Gatilho&quot; (Trigger). Arraste um &quot;Trigger WhatsApp&quot;, defina uma palavra-chave como &quot;Olá&quot;, e conecte ele a um node de &quot;Enviar Mensagem&quot; puxando a linha do ponto à direita.
                                </p>
                            </div>

                            <div>
                                <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 text-xs text-white">3</span>
                                    Uso de Variáveis Mágicas
                                </h3>
                                <p className="text-gray-400 mb-4">
                                    Personalize as mensagens usando as chaves duplas <code>{"{{ }}"}</code>. O sistema substitui isso por dados reais no momento do envio.
                                </p>

                                <div className="overflow-x-auto rounded-lg border border-gray-800">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-[#151515] text-gray-300 font-semibold uppercase text-xs">
                                            <tr>
                                                <th className="px-6 py-4 border-b border-gray-800">Variável Mágica</th>
                                                <th className="px-6 py-4 border-b border-gray-800">Descrição do que injeta</th>
                                                <th className="px-6 py-4 border-b border-gray-800">Exemplo Visível</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800 bg-[#0d0d0d]">
                                            <tr>
                                                <td className="px-6 py-4 font-mono text-primary">{"{{contact.phone}}"}</td>
                                                <td className="px-6 py-4 text-gray-400">O telefone completo do lead</td>
                                                <td className="px-6 py-4 text-gray-400">5511999999999</td>
                                            </tr>
                                            <tr>
                                                <td className="px-6 py-4 font-mono text-primary">{"{{contact.name}}"}</td>
                                                <td className="px-6 py-4 text-gray-400">Nome do contato (se salvo)</td>
                                                <td className="px-6 py-4 text-gray-400">Júlia Almeida</td>
                                            </tr>
                                            <tr>
                                                <td className="px-6 py-4 font-mono text-[#3b82f6]">{"{{variables.XPTO}}"}</td>
                                                <td className="px-6 py-4 text-gray-400">Qualquer variável criada no node Definir Variável ou salva de um Wait</td>
                                                <td className="px-6 py-4 text-gray-400">&quot;Sim&quot;, &quot;150.00&quot;</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* GATILHOS */}
                    <section id="triggers" className="mb-24 scroll-mt-24 border-t border-gray-800 pt-16">
                        <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
                            <Crosshair className="text-primary" /> Gatilhos (Triggers)
                        </h2>
                        <p className="text-gray-400 mb-8">Triggers são a porta de entrada. Um fluxo sempre deve começar por pelo menos um Trigger ativo.</p>

                        <div className="space-y-12">
                            {/* Trigger WhatsApp */}
                            <div id="trigger-whatsapp" className="bg-[#111] border border-gray-800 rounded-2xl overflow-hidden scroll-mt-24">
                                <div className="bg-[#151515] p-5 border-b border-gray-800 flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        📱 Trigger WhatsApp
                                    </h3>
                                    <span className="bg-primary/20 text-primary text-xs font-bold px-3 py-1 rounded-full border border-primary/30 uppercase tracking-wider">Gatilho</span>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div>
                                        <h4 className="text-gray-300 font-semibold mb-2 flex items-center gap-2"><BookOpen className="w-4 h-4 text-gray-500" /> O que faz</h4>
                                        <p className="text-gray-400 text-sm">Inicia o fluxo quando alguém envia mensagem no WhatsApp para a sessão configurada.</p>
                                    </div>

                                    <div>
                                        <h4 className="text-gray-300 font-semibold mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-gray-500" /> Configurações</h4>
                                        <div className="overflow-x-auto rounded-lg border border-gray-800">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-[#151515] text-gray-400 font-semibold text-xs">
                                                    <tr><th className="px-4 py-3">Campo</th><th className="px-4 py-3">Descrição</th></tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-800 text-gray-300">
                                                    <tr><td className="px-4 py-3 font-medium">Sessão</td><td className="px-4 py-3 text-gray-500">Qual número do WhatsApp vai ouvir</td></tr>
                                                    <tr><td className="px-4 py-3 font-medium">Palavra-chave</td><td className="px-4 py-3 text-gray-500">Opcional — só dispara se mensagem contiver</td></tr>
                                                    <tr><td className="px-4 py-3 font-medium">Tipo de msg</td><td className="px-4 py-3 text-gray-500">Texto, imagem, qualquer</td></tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                                        <h4 className="text-primary font-semibold mb-2 text-sm">💡 Dicas de uso</h4>
                                        <ul className="text-gray-400 text-sm list-disc list-inside space-y-1">
                                            <li>Deixe sem palavra-chave para responder qualquer mensagem.</li>
                                            <li>Use palavra-chave para criar menus (ex: &quot;1&quot;, &quot;comprar&quot;).</li>
                                            <li>Combine com node Condição (If/Else) para fluxos complexos.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Trigger Manual */}
                            <div id="trigger-manual" className="bg-[#111] border border-gray-800 rounded-2xl overflow-hidden scroll-mt-24">
                                <div className="bg-[#151515] p-5 border-b border-gray-800 flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        🖱️ Trigger Manual
                                    </h3>
                                    <span className="bg-primary/20 text-primary text-xs font-bold px-3 py-1 rounded-full border border-primary/30 uppercase tracking-wider">Gatilho</span>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div>
                                        <h4 className="text-gray-300 font-semibold mb-2 flex items-center gap-2"><BookOpen className="w-4 h-4 text-gray-500" /> O que faz</h4>
                                        <p className="text-gray-400 text-sm">Permite disparar o fluxo manualmente via painel para um contato ou grupo específico, sem precisar de mensagem inicial.</p>
                                    </div>

                                    <div>
                                        <h4 className="text-gray-300 font-semibold mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-gray-500" /> Configurações</h4>
                                        <div className="overflow-x-auto rounded-lg border border-gray-800">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-[#151515] text-gray-400 font-semibold text-xs">
                                                    <tr><th className="px-4 py-3">Campo</th><th className="px-4 py-3">Descrição</th></tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-800 text-gray-300">
                                                    <tr><td className="px-4 py-3 font-medium">Destino</td><td className="px-4 py-3 text-gray-500">Contato individual ou grupo</td></tr>
                                                    <tr><td className="px-4 py-3 font-medium">Número</td><td className="px-4 py-3 text-gray-500">Telefone do destinatário</td></tr>
                                                    <tr><td className="px-4 py-3 font-medium">Sessão</td><td className="px-4 py-3 text-gray-500">Qual WhatsApp usar para o envio ativo</td></tr>
                                                    <tr><td className="px-4 py-3 font-medium">Variáveis</td><td className="px-4 py-3 text-gray-500">Dados customizados para o fluxo injetar</td></tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                                        <h4 className="text-primary font-semibold mb-2 text-sm">💡 Dicas de uso</h4>
                                        <ul className="text-gray-400 text-sm list-disc list-inside space-y-1">
                                            <li>Ideal para disparos pontuais, testes A/B internos e reinício de funis quebrados.</li>
                                            <li>Use variáveis dinâmicas ao disparar para preencher `{"{{variables.X}}"}`.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Trigger Agendamento */}
                            <div id="trigger-agendamento" className="bg-[#111] border border-gray-800 rounded-2xl overflow-hidden scroll-mt-24">
                                <div className="bg-[#151515] p-5 border-b border-gray-800 flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        ⏰ Trigger Agendamento
                                    </h3>
                                    <span className="bg-primary/20 text-primary text-xs font-bold px-3 py-1 rounded-full border border-primary/30 uppercase tracking-wider">Gatilho</span>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div>
                                        <h4 className="text-gray-300 font-semibold mb-2 flex items-center gap-2"><BookOpen className="w-4 h-4 text-gray-500" /> O que faz</h4>
                                        <p className="text-gray-400 text-sm">Executa o fluxo automaticamente e em background em horários configurados — diário, semanal ou em data/hora específica.</p>
                                    </div>

                                    <div>
                                        <h4 className="text-gray-300 font-semibold mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-gray-500" /> Modos Disponíveis</h4>
                                        <ul className="text-gray-400 text-sm space-y-2">
                                            <li className="flex gap-2"><span>📅</span> Data e hora específica (Disparo único)</li>
                                            <li className="flex gap-2"><span>🕐</span> Hora fixa diária (Disparo repetitivo, com filtro de dias da semana)</li>
                                            <li className="flex gap-2"><span>⏱️</span> Intervalo regular (Executar a cada X horas/minutos)</li>
                                        </ul>
                                    </div>

                                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                                        <h4 className="text-gray-300 font-semibold mb-2 text-sm">📝 Exemplo Prático</h4>
                                        <p className="text-gray-500 text-sm">Enviar um resumo diário para você mesmo ou para sua lista VIP todos os dias às 09:00.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* AÇÕES DO FLUXO */}
                    <section id="actions" className="mb-24 scroll-mt-24 border-t border-gray-800 pt-16">
                        <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
                            <Zap className="text-[#3b82f6]" /> Ações do Fluxo
                        </h2>
                        <p className="text-gray-400 mb-8">Com os triggers definidos, utilize os nodes de Ação para construir a inteligência e o envio do fluxo.</p>

                        <div className="space-y-12">

                            {/* Enviar Mensagem */}
                            <div id="action-mensagem" className="bg-[#111] border border-gray-800 rounded-2xl overflow-hidden scroll-mt-24">
                                <div className="bg-[#151515] p-5 border-b border-gray-800 flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        💬 Enviar Mensagem
                                    </h3>
                                    <span className="bg-[#3b82f6]/20 text-[#3b82f6] text-xs font-bold px-3 py-1 rounded-full border border-[#3b82f6]/30 uppercase tracking-wider">Ação</span>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div>
                                        <h4 className="text-gray-300 font-semibold mb-2 flex items-center gap-2"><BookOpen className="w-4 h-4 text-gray-500" /> O que faz</h4>
                                        <p className="text-gray-400 text-sm">Envia uma mensagem de texto rica para o contato ou grupo que originou o engajamento no fluxo.</p>
                                    </div>

                                    <div>
                                        <h4 className="text-gray-300 font-semibold mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-gray-500" /> Configurações</h4>
                                        <div className="overflow-x-auto rounded-lg border border-gray-800">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-[#151515] text-gray-400 font-semibold text-xs">
                                                    <tr><th className="px-4 py-3">Campo</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Exemplo</th></tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-800 text-gray-300">
                                                    <tr><td className="px-4 py-3 font-medium">Mensagem</td><td className="px-4 py-3 text-gray-500">Texto a enviar</td><td className="px-4 py-3 font-mono text-xs">&quot;Olá {"{{contact.name}}"}!&quot;</td></tr>
                                                    <tr><td className="px-4 py-3 font-medium">Simular di...</td><td className="px-4 py-3 text-gray-500">Mostra &quot;digitando...&quot; antes</td><td className="px-4 py-3 text-green-400">Ativado</td></tr>
                                                    <tr><td className="px-4 py-3 font-medium">Duração</td><td className="px-4 py-3 text-gray-500">Segundos digitando no celular</td><td className="px-4 py-3">3</td></tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="bg-[#3b82f6]/5 border border-[#3b82f6]/20 rounded-lg p-4">
                                        <h4 className="text-[#3b82f6] font-semibold mb-2 text-sm">💡 Dicas de uso</h4>
                                        <ul className="text-gray-400 text-sm list-disc list-inside space-y-1">
                                            <li>Use <code>{"{{contact.name}}"}</code> para chamar pelo nome.</li>
                                            <li>Ative &quot;simular digitando&quot; (pelo menos 2s a cada 3 linhas) para parecer mais humano.</li>
                                            <li>Quebre textos gigantes em vários nodes conectados em sequência para leitura mais leve.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Enviar Mídia */}
                            <div id="action-midia" className="bg-[#111] border border-gray-800 rounded-2xl overflow-hidden scroll-mt-24">
                                <div className="bg-[#151515] p-5 border-b border-gray-800 flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        🖼️ Enviar Mídia
                                    </h3>
                                    <span className="bg-[#3b82f6]/20 text-[#3b82f6] text-xs font-bold px-3 py-1 rounded-full border border-[#3b82f6]/30 uppercase tracking-wider">Ação</span>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div>
                                        <h4 className="text-gray-300 font-semibold mb-2 flex items-center gap-2"><BookOpen className="w-4 h-4 text-gray-500" /> O que faz</h4>
                                        <p className="text-gray-400 text-sm">Envia um arquivo anexado (com ou sem legenda) direto no chat.</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="text-gray-300 font-semibold mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-gray-500" /> Tipos Suportados</h4>
                                            <ul className="text-gray-400 text-sm space-y-2">
                                                <li>🖼️ Imagem: JPG, PNG, WEBP (máx 5MB)</li>
                                                <li>🎵 Áudio: MP3, OGG (máx 10MB)</li>
                                                <li>🎤 Áudio de voz (PTT): O famoso &quot;áudio gravado na hora&quot;</li>
                                                <li>🎬 Vídeo: MP4 (máx 50MB)</li>
                                                <li>📄 Documento: PDF, DOCX (máx 20MB)</li>
                                            </ul>
                                        </div>
                                        <div>
                                            <h4 className="text-gray-300 font-semibold mb-3 flex items-center gap-2"><Crosshair className="w-4 h-4 text-gray-500" /> Origem da Mídia</h4>
                                            <ul className="text-gray-400 text-sm space-y-2 list-disc list-inside">
                                                <li>URL externa (https://seusite.com/video.mp4)</li>
                                                <li>Upload direto via painel da plataforma</li>
                                                <li>Extraído de uma variável (ex: <code>{"{{variables.imageUrl}}"}</code>)</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Aguardar (Wait) */}
                            <div id="action-wait" className="bg-[#111] border border-gray-800 rounded-2xl overflow-hidden scroll-mt-24">
                                <div className="bg-[#151515] p-5 border-b border-gray-800 flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        ⏳ Aguardar (Wait)
                                    </h3>
                                    <span className="bg-[#3b82f6]/20 text-[#3b82f6] text-xs font-bold px-3 py-1 rounded-full border border-[#3b82f6]/30 uppercase tracking-wider">Ação</span>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div>
                                        <h4 className="text-gray-300 font-semibold mb-2 flex items-center gap-2"><BookOpen className="w-4 h-4 text-gray-500" /> O que faz</h4>
                                        <p className="text-gray-400 text-sm">Intencionalmente pausa e segura o fluxo. Essencial para criar delays humanizados, aguardar o cliente pensar ou suspender a automação até o dia seguinte.</p>
                                    </div>

                                    <div>
                                        <h4 className="text-gray-300 font-semibold mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-gray-500" /> Modos Diversos</h4>
                                        <ul className="text-gray-400 text-sm space-y-2">
                                            <li><strong>Tempo fixo:</strong> Segundos, minutos ou horas fixas.</li>
                                            <li><strong>Aguardar Resposta:</strong> O fluxo para DEFINITIVAMENTE ali até que o usuário responda. O texto enviado por ele será sempre salvo em <code>{"{{variables.userResponse}}"}</code> ou numa variável de sua escolha.</li>
                                            <li><strong>Até data específica:</strong> Para envios baseados num calendário futuro.</li>
                                        </ul>
                                    </div>

                                    <div className="bg-[#3b82f6]/5 border border-[#3b82f6]/20 rounded-lg p-4 flex gap-4">
                                        <div className="text-[#3b82f6] text-2xl">💡</div>
                                        <p className="text-gray-400 text-sm leading-relaxed">O &quot;Aguardar Resposta&quot; é a principal ferramenta para receber dados e enviar para a IA. Toda resposta que rompe um estágio de Wait fica acessível para o próximo node através da variável referenciada.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Condição (If/Else) */}
                            <div id="action-condicao" className="bg-[#111] border border-gray-800 rounded-2xl overflow-hidden scroll-mt-24">
                                <div className="bg-[#151515] p-5 border-b border-gray-800 flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        ⚖️ Condição (If/Else)
                                    </h3>
                                    <span className="bg-[#3b82f6]/20 text-[#3b82f6] text-xs font-bold px-3 py-1 rounded-full border border-[#3b82f6]/30 uppercase tracking-wider">Ação</span>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div>
                                        <h4 className="text-gray-300 font-semibold mb-2 flex items-center gap-2"><BookOpen className="w-4 h-4 text-gray-500" /> O que faz</h4>
                                        <p className="text-gray-400 text-sm">Bifurca o fluxo de automação. Cria um caminho para SIM (quando a condição é atingida) e um caminho para NÃO (quando falha).</p>
                                    </div>

                                    <div>
                                        <h4 className="text-gray-300 font-semibold mb-3 flex items-center gap-2"><Crosshair className="w-4 h-4 text-gray-500" /> Operadores Base</h4>
                                        <ul className="text-gray-400 text-sm space-y-1 w-full md:w-1/2 list-disc list-inside">
                                            <li>igual a / diferente de</li>
                                            <li>contém / não contém</li>
                                            <li>maior que / menor que (Para valores numéricos)</li>
                                            <li>está vazio / não está vazio</li>
                                        </ul>
                                    </div>

                                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 font-mono text-sm text-gray-300">
                                        <p className="text-gray-500 mb-2">{'// Exemplo de roteamento'}</p>
                                        <p>SE <span className="text-[#3b82f6]">{'{{variables.pagamento}}'}</span> == <span className="text-green-400">&quot;aprovado&quot;</span></p>
                                        <p className="ml-4 text-green-400">→ Caminho SIM: Node Enviar Acesso</p>
                                        <p className="ml-4 text-red-400">→ Caminho NÃO: Node Aguardar 2h reengajamento</p>
                                    </div>
                                </div>
                            </div>

                            {/* Agente de IA */}
                            <div id="action-ia" className="bg-[#111] border border-gray-800 rounded-2xl overflow-hidden scroll-mt-24">
                                <div className="bg-[#151515] p-5 border-b border-gray-800 flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        🤖 Agente de IA
                                    </h3>
                                    <span className="bg-[#3b82f6]/20 text-[#3b82f6] text-xs font-bold px-3 py-1 rounded-full border border-[#3b82f6]/30 uppercase tracking-wider">Ação Efetiva</span>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div>
                                        <h4 className="text-gray-300 font-semibold mb-2 flex items-center gap-2"><BookOpen className="w-4 h-4 text-gray-500" /> O que faz</h4>
                                        <p className="text-gray-400 text-sm">Passa a batuta da operação para uma Inteligência Artificial generativa via API. A resposta gerada pela IA pode tanto ser enviada de imediato ao cliente, quanto ser salva para ser avaliada em condicionais.</p>
                                    </div>

                                    <div className="overflow-x-auto rounded-lg border border-gray-800">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-[#151515] text-gray-400 font-semibold text-xs">
                                                <tr><th className="px-4 py-3">Configuração</th><th className="px-4 py-3">Explicação</th></tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-800 text-gray-300">
                                                <tr><td className="px-4 py-3 font-medium text-white">Prompt do Sistema</td><td className="px-4 py-3 text-gray-400">As regras e as amarras em que a IA deve atuar.</td></tr>
                                                <tr><td className="px-4 py-3 font-medium text-white">Modelo</td><td className="px-4 py-3 text-gray-400">Qual tecnologia base usar (OpenAI, Claude, etc).</td></tr>
                                                <tr><td className="px-4 py-3 font-medium text-white">Temperatura</td><td className="px-4 py-3 text-gray-400">0=Focado/Preciso, 1=Super Criativo/Devaneio.</td></tr>
                                                <tr><td className="px-4 py-3 font-medium text-white">Memória</td><td className="px-4 py-3 text-gray-400">Relembrar contexto das últimas X mensagens daquele contato.</td></tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="bg-[#3b82f6]/5 border border-[#3b82f6]/20 rounded-lg p-5">
                                        <h4 className="text-[#3b82f6] font-semibold mb-2 text-sm">💡 Boas Práticas de Prompt</h4>
                                        <div className="text-gray-300 text-sm font-mono bg-black/40 p-3 rounded">
                                            &quot;Você é a Júlia, assistente virtual da Loja. Responda apenas e estritamente em português, de forma empática.&quot;<br />
                                            &quot;Se não souber a resposta da tabela de preços fornecida a você, diga: &apos;Deixe-me conferir com o meu gerente.&apos;&quot;
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Randomizador */}
                            <div id="action-randomizer" className="bg-[#111] border border-gray-800 rounded-2xl overflow-hidden scroll-mt-24">
                                <div className="bg-[#151515] p-5 border-b border-gray-800 flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        🎲 Randomizador
                                    </h3>
                                    <span className="bg-[#a855f7]/20 text-[#a855f7] text-xs font-bold px-3 py-1 rounded-full border border-[#a855f7]/30 uppercase tracking-wider">Ação de Roteamento</span>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div>
                                        <h4 className="text-gray-300 font-semibold mb-2 flex items-center gap-2"><BookOpen className="w-4 h-4 text-gray-500" /> O que faz</h4>
                                        <p className="text-gray-400 text-sm">Distribui contatos (leads) de forma randômica ou ponderada entre diferentes caminhos de saída do nó. Essencial para A/B Testing e roteamento de atendentes.</p>
                                    </div>

                                    <div className="bg-[#a855f7]/5 border border-[#a855f7]/20 rounded-lg p-4">
                                        <h4 className="text-[#a855f7] font-semibold mb-2 text-sm">📝 Casos de uso ideais:</h4>
                                        <ul className="text-gray-300 text-sm list-disc list-inside space-y-2">
                                            <li>Teste A/B de cópias: Saída A (50%) com texto longo, Saída B (50%) com texto curto.</li>
                                            <li>Roleta de Vendedores: Mandar fluxos alternados para ramificações diferentes de atendentes do comercial.</li>
                                            <li>Sorteios interativos dentro de engajamento do funil.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </section>

                    {/* NODES DE GRUPO */}
                    <section id="group-nodes" className="mb-24 scroll-mt-24 border-t border-gray-800 pt-16">
                        <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
                            <Users className="text-teal-400" /> Nodes Específicos para Grupos
                        </h2>
                        <p className="text-gray-400 mb-8">Ferramentas de alta conversão criadas especificamente para gerir engajamento em massa e lançamentos de grupos de WhatsApp.</p>

                        <div className="space-y-12">
                            {/* Mencionar Todos */}
                            <div id="group-mencionar" className="bg-[#111] border border-gray-800 rounded-2xl overflow-hidden scroll-mt-24">
                                <div className="bg-[#151515] p-5 border-b border-gray-800 flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        📢 Mencionar Todos
                                    </h3>
                                    <span className="bg-teal-400/20 text-teal-400 text-xs font-bold px-3 py-1 rounded-full border border-teal-400/30 uppercase tracking-wider">Node de Grupo</span>
                                </div>
                                <div className="p-6 space-y-4">
                                    <p className="text-gray-400 text-sm">Marca secretamente todos os participantes do grupo para forçar a notificação chegar (bypass de grupos silenciados). Possui sistema de <b>Cooldown (Resfriamento)</b> embutido para evitar banimentos do WhatsApp por spam de marcação em curto período de tempo.</p>
                                </div>
                            </div>

                            {/* Aquecimento */}
                            <div id="group-aquecimento" className="bg-[#111] border border-gray-800 rounded-2xl overflow-hidden scroll-mt-24">
                                <div className="bg-[#151515] p-5 border-b border-gray-800 flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        🔥 Múltiplas Mensagens de Aquecimento
                                    </h3>
                                    <span className="bg-teal-400/20 text-teal-400 text-xs font-bold px-3 py-1 rounded-full border border-teal-400/30 uppercase tracking-wider">Lançamentos</span>
                                </div>
                                <div className="p-6 space-y-4">
                                    <p className="text-gray-400 text-sm">Gera um schedule automático de mensagens baseadas no tempo de vida (ativação) de um grupo específico. Por exemplo:<br /><br />
                                        - Enviar msg A de Boas Vindas no <strong>Dia 0</strong> (Criação)<br />
                                        - Enviar msg B no <strong>Dia 1</strong> (Gerando Autoridade)<br />
                                        - Enviar msg C no <strong>Dia 2</strong> (Antecipação)</p>
                                    <p className="text-teal-400/80 text-sm italic">Ele calcula a diferença de dias automaticamente usando os metadados do grupo atrelado.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* TUTORIAIS */}
                    <section id="tutorials" className="mb-24 scroll-mt-24 border-t border-gray-800 pt-16">
                        <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
                            <BookOpen className="text-[#10b981]" /> Guias Práticos e Tutoriais
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div id="tut-funil" className="p-5 bg-[#151515] hover:bg-[#1a1a1a] transition-colors border border-gray-800 rounded-xl cursor-pointer scroll-mt-24">
                                <h3 className="text-lg font-bold text-white mb-2">Construindo um Funil de Vendas</h3>
                                <p className="text-gray-500 text-sm mb-4">Aprenda a conectar os nodes Enviar Mensagem, IF/ELSE e Botões para qualificar um lead até o fechamento com PIX.</p>
                                <span className="text-[#10b981] text-sm font-semibold flex items-center gap-1">Ler o guia <Crosshair className="w-3 h-3" /></span>
                            </div>

                            <div id="tut-lancamento" className="p-5 bg-[#151515] hover:bg-[#1a1a1a] transition-colors border border-gray-800 rounded-xl cursor-pointer scroll-mt-24">
                                <h3 className="text-lg font-bold text-white mb-2">Automação de Lançamento em 50 Grupos</h3>
                                <p className="text-gray-500 text-sm mb-4">Como usar o Trigger de Agendamento junto com o &quot;Sequência de Lançamento&quot; para disparar o Carrinho Aberto.</p>
                                <span className="text-[#10b981] text-sm font-semibold flex items-center gap-1">Ler o guia <Crosshair className="w-3 h-3" /></span>
                            </div>
                        </div>
                    </section>

                    {/* FAQ */}
                    <section id="faq" className="mb-24 scroll-mt-24 border-t border-gray-800 pt-16">
                        <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
                            <HelpCircle className="text-gray-400" /> Perguntas Frequentes
                        </h2>

                        <div className="space-y-4">
                            <div className="bg-[#111] border border-gray-800 rounded-xl p-5">
                                <h4 className="text-white font-semibold mb-2 text-lg">Posso usar o bot em múltiplos celulares?</h4>
                                <p className="text-gray-400 text-sm">Sim, o limite de sessões de WhatsApp vinculadas dependerá do plano da sua licença. Depois de conectar os QRCodes, você escolhe no Trigger do fluxo qual número irá responder.</p>
                            </div>
                            <div className="bg-[#111] border border-gray-800 rounded-xl p-5">
                                <h4 className="text-white font-semibold mb-2 text-lg">As mensagens são enviadas como um celular normal?</h4>
                                <p className="text-gray-400 text-sm">Sim. A tecnologia Baileys emula o WhatsApp Web perfeitamente. Se usar a opção de simular &quot;digitando...&quot;, o delay é transmitido para os contatos assim como você faria escrevendo à mão livre.</p>
                            </div>
                            <div className="bg-[#111] border border-gray-800 rounded-xl p-5">
                                <h4 className="text-white font-semibold mb-2 text-lg">As mídias de vídeo e imagem ficam pesadas pro bot disparar?</h4>
                                <p className="text-gray-400 text-sm">Depende inteiramente dos limites do seu servidor, que faz o proxy das mídias. Mídias como PTT de voz devem ser encodadas nativamente em Opus (codec para que seja reconhecido como &quot;voz&quot;). A plataforma já se encarrega disso via conversor embutido (exigindo FFmpeg instalado na VPS).</p>
                            </div>
                        </div>
                    </section>
                </div>
            </main>

            {/* Botão flutuante Voltar ao Topo */}
            <button
                onClick={scrollToTop}
                className={`
          fixed bottom-8 right-8 p-3 rounded-full bg-primary/20 hover:bg-primary/40 
          border border-primary/50 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)]
          transition-all duration-300 z-50
          ${showScrollTop ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0 pointer-events-none'}
        `}
            >
                <ChevronUp className="w-5 h-5" />
            </button>

        </div>
    )
}
