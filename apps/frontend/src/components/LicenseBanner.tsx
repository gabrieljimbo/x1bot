'use client'

import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@/lib/permissions'

export const LicenseBanner = () => {
    const { user } = useAuth()

    if (!user || user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
        return null
    }

    const now = new Date()
    let expirationDate: Date | null = null
    let label = ''

    if (user.role === UserRole.VIP && user.licenseExpiresAt) {
        expirationDate = new Date(user.licenseExpiresAt)
        label = 'Sua licença VIP'
    } else if (user.role === UserRole.USER && user.trialEndsAt) {
        expirationDate = new Date(user.trialEndsAt)
        label = 'Seu período de teste'
    }

    if (!expirationDate) return null

    const diffTime = expirationDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    // Only show warning if less than 2 days remaining and not expired
    if (diffDays <= 2 && diffDays > 0) {
        return (
            <div className="bg-amber-100 border-b border-amber-200 py-2 px-4 text-sm text-amber-800 flex justify-center items-center">
                <span className="font-medium mr-2">⚠️ Atenção:</span>
                {label} expira em {diffDays === 1 ? '1 dia' : `${diffDays} dias`}.
                <a
                    href="https://wa.me/5511999999999"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 font-bold underline hover:text-amber-900"
                >
                    Renove agora para não perder o acesso.
                </a>
            </div>
        )
    }

    return null
}
