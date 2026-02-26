'use client'

import { useAuth } from '@/contexts/AuthContext'
import { LogOut, User, ShieldCheck, Star, MessageSquare } from 'lucide-react'
import { isSuperAdmin, UserRole } from '@/lib/permissions'
import Link from 'next/link'

export default function AppHeader() {
  const { user, tenant, logout } = useAuth()

  return (
    <header className="bg-[#151515] border-b border-gray-800 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-2xl font-bold text-white hover:text-primary transition"
          >
            N9N
          </Link>
          {user && !isSuperAdmin(user?.role) && (
            <Link
              href="/inbox"
              className="flex items-center gap-1.5 text-gray-400 hover:text-white transition text-sm"
            >
              <MessageSquare size={15} />
              Inbox
            </Link>
          )}
          {isSuperAdmin(user?.role) && (
            <>
              <Link
                href="/inbox"
                className="flex items-center gap-1.5 text-gray-400 hover:text-white transition text-sm"
              >
                <MessageSquare size={15} />
                Inbox
              </Link>
              <Link
                href="/workspaces"
                className="text-gray-400 hover:text-white transition text-sm"
              >
                Workspaces
              </Link>
              <Link
                href="/settings/whatsapp"
                className="text-gray-400 hover:text-white transition text-sm"
              >
                Anti-Ban Settings
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {user.role === UserRole.SUPER_ADMIN && (
                    <span className="flex items-center gap-1 text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/30 uppercase font-bold">
                      <ShieldCheck size={10} /> Super Admin
                    </span>
                  )}
                  {user.role === UserRole.VIP && (
                    <span className="flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 uppercase font-bold">
                      <Star size={10} /> VIP
                    </span>
                  )}
                  {user.role === UserRole.USER && (
                    <span className="text-[10px] bg-slate-500/20 text-slate-400 px-1.5 py-0.5 rounded border border-slate-500/30 uppercase font-bold">
                      Trial
                    </span>
                  )}
                  <p className="text-sm text-white font-medium">{user.name || user.email}</p>
                </div>
                {tenant && (
                  <p className="text-xs text-gray-400">{tenant.name}</p>
                )}
              </div>
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <User size={16} className="text-primary" />
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded hover:bg-red-500/30 transition text-red-400"
            title="Logout"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  )
}

