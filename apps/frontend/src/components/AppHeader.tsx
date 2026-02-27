import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { LogOut, User, ShieldCheck, Star, MessageSquare, Menu, X, Building2, Shield } from 'lucide-react'
import { isSuperAdmin, UserRole } from '@/lib/permissions'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { wsClient } from '@/lib/websocket'

export default function AppHeader() {
  const { user, tenant, logout } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const loadStats = async () => {
    if (!user || !tenant) return;
    try {
      const stats = await apiClient.getInboxStats()
      setUnreadCount(stats.totalUnread || 0)
    } catch (e) {
      // Silet error for stats since it fails if no session is active
      console.warn('AppHeader: Could not load inbox stats')
    }
  }

  useEffect(() => {
    if (user && tenant) {
      loadStats()
    }
  }, [user, tenant])

  useEffect(() => {
    const handler = () => {
      loadStats()
    }
    wsClient.onRaw('inbox:conversation-updated', handler)
    wsClient.onRaw('inbox:message-received', handler)
    return () => {
      wsClient.offRaw('inbox:conversation-updated', handler)
      wsClient.offRaw('inbox:message-received', handler)
    }
  }, [])

  return (
    <header className="bg-[#151515] border-b border-gray-800 px-6 py-4 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-2xl font-bold text-white hover:text-[#00ff88] transition flex items-center gap-2"
          >
            <div className="w-8 h-8 bg-[#00ff88]/10 rounded-lg flex items-center justify-center border border-[#00ff88]/20">
              <span className="text-[#00ff88]">X</span>
            </div>
            N9N
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/inbox"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm font-medium relative py-1"
            >
              <MessageSquare size={16} />
              Inbox
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-[#00ff88] text-black text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center border-2 border-[#151515]">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>

            {isSuperAdmin(user?.role) && (
              <>
                <Link
                  href="/workspaces"
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm font-medium"
                >
                  <Building2 size={16} />
                  Workspaces
                </Link>
                <Link
                  href="/settings/whatsapp"
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm font-medium"
                >
                  <Shield size={16} />
                  Safe Settings
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* User Actions (Desktop) */}
        <div className="hidden md:flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="flex items-center justify-end gap-2 text-xs">
                  {user.role === UserRole.SUPER_ADMIN ? (
                    <span className="flex items-center gap-1 bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20 font-bold tracking-wider">
                      <ShieldCheck size={10} /> Super Admin
                    </span>
                  ) : user.role === UserRole.ADMIN ? (
                    <span className="flex items-center gap-1 bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 font-bold tracking-wider">
                      <Shield size={10} /> Admin
                    </span>
                  ) : user.role === UserRole.VIP ? (
                    <span className="flex items-center gap-1 bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 font-bold tracking-wider">
                      <Star size={10} /> VIP
                    </span>
                  ) : (
                    <span className="bg-gray-500/10 text-gray-400 px-2 py-0.5 rounded-full border border-gray-500/20 font-bold tracking-wider uppercase">
                      Usuário
                    </span>
                  )}
                  <p className="text-white font-semibold">{user.name || user.email}</p>
                </div>
                {tenant && (
                  <p className="text-[10px] text-gray-500 flex items-center justify-end gap-1">
                    <Building2 size={8} /> {tenant.name}
                  </p>
                )}
              </div>
              <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                <User size={18} className="text-gray-400" />
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition text-red-400 text-sm font-medium"
            title="Logout"
          >
            <LogOut size={16} />
            <span className="hidden lg:inline">Logout</span>
          </button>
        </div>

        {/* Mobile menu button */}
        <div className="md:hidden flex items-center gap-3">
          {unreadCount > 0 && !isMenuOpen && (
            <Link href="/inbox" className="relative p-2 text-gray-400">
              <MessageSquare size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#00ff88] rounded-full border border-[#151515]"></span>
            </Link>
          )}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 text-gray-400 hover:text-white transition"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[65px] bg-[#0a0a0a] z-40 border-t border-white/5 flex flex-col p-6 animate-in slide-in-from-top duration-200">
          <div className="space-y-1 mb-8">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest pl-3 mb-2">Principal</p>
            <Link
              href="/"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-[#00ff88] hover:bg-white/5 rounded-xl transition"
            >
              <Building2 size={18} />
              <span className="font-medium">Overview</span>
            </Link>
            <Link
              href="/inbox"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center justify-between px-4 py-3 text-gray-300 hover:text-[#00ff88] hover:bg-white/5 rounded-xl transition"
            >
              <div className="flex items-center gap-3">
                <MessageSquare size={18} />
                <span className="font-medium">Inbox</span>
              </div>
              {unreadCount > 0 && (
                <span className="bg-[#00ff88] text-black text-[10px] font-bold rounded-full px-2 py-0.5">
                  {unreadCount} novo
                </span>
              )}
            </Link>
          </div>

          {isSuperAdmin(user?.role) && (
            <div className="space-y-1 mb-8">
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest pl-3 mb-2">Administração</p>
              <Link
                href="/workspaces"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition"
              >
                <Building2 size={18} />
                <span className="font-medium">Workspaces</span>
              </Link>
              <Link
                href="/settings/whatsapp"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition"
              >
                <Shield size={18} />
                <span className="font-medium">Safe Settings</span>
              </Link>
            </div>
          )}

          <div className="mt-auto border-t border-white/5 pt-6 flex flex-col gap-4">
            <div className="flex items-center gap-3 px-4 py-2">
              <div className="w-10 h-10 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/20 flex items-center justify-center font-bold text-[#00ff88]">
                {user?.name?.charAt(0) || user?.email.charAt(0)}
              </div>
              <div>
                <p className="text-white font-medium text-sm">{user?.name || user?.email}</p>
                <p className="text-xs text-gray-500">{tenant?.name || 'Workspace'}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-bold hover:bg-red-500/20 transition"
            >
              <LogOut size={18} />
              Sair da Conta
            </button>
          </div>
        </div>
      )}
    </header>
  )
}

