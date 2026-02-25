'use client'

import { useAuth } from '@/contexts/AuthContext'
import { LogOut, User } from 'lucide-react'
import { isSuperAdmin } from '@/lib/permissions'
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
          {isSuperAdmin(user?.role) && (
            <>
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
                <p className="text-sm text-white font-medium">{user.name || user.email}</p>
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

