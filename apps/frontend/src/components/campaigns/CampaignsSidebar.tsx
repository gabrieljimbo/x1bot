'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Send, GitBranch, Users, Ban, BarChart3, ShieldCheck } from 'lucide-react'

const links = [
  { href: '/campaigns/simple', label: 'Disparos', icon: Send },
  { href: '/campaigns/workflows', label: 'Fluxos', icon: GitBranch },
  { href: '/campaigns/lists', label: 'Listas', icon: Users },
  { href: '/campaigns/blacklist', label: 'Blacklist', icon: Ban },
  { href: '/campaigns/insights', label: 'Insights', icon: BarChart3 },
  { href: '/campaigns/settings', label: 'Proteções', icon: ShieldCheck },
]

export default function CampaignsSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-48 min-h-screen bg-[#111] border-r border-white/5 py-6 flex-shrink-0">
      <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-4 mb-3">Campanhas</p>
      <nav className="space-y-0.5 px-2">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                active
                  ? 'bg-[#00ff88]/10 text-[#00ff88]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
