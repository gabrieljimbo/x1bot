'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { AuthGuard } from '@/components/AuthGuard'
import { isSuperAdmin } from '@/lib/permissions'

function HomeContent() {
  const router = useRouter()
  const { user, tenant } = useAuth()

  useEffect(() => {
    // Redirect to workspaces if SUPER_ADMIN, otherwise redirect to user's workspace
    if (isSuperAdmin(user?.role)) {
      router.replace('/workspaces')
    } else if (tenant?.id) {
      // For ADMIN users, redirect to their workspace
      router.replace(`/workspaces/${tenant.id}`)
    }
  }, [user, tenant, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-gray-400">Redirecting...</p>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  )
}

