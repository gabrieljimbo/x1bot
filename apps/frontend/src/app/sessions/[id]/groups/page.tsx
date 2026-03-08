'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/AuthGuard'

function GroupManagementPageContent({ params }: { params: { id: string } }) {
    const router = useRouter()

    useEffect(() => {
        // Group management was moved to the Group Workflows page
        router.replace('/workflows/groups')
    }, [router])

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
            <p className="text-gray-400 text-sm">Redirecionando para Fluxos de Grupo...</p>
        </div>
    )
}

export default function GroupManagementPage({ params }: { params: { id: string } }) {
    return (
        <AuthGuard>
            <GroupManagementPageContent params={params} />
        </AuthGuard>
    )
}
