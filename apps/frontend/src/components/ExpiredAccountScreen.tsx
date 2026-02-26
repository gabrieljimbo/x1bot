'use client'

import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@/lib/permissions'

export const ExpiredAccountScreen = () => {
    const { user, logout } = useAuth()

    if (!user || user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
        return null
    }

    const now = new Date()
    let isExpired = false
    let message = ''

    if (user.role === UserRole.VIP) {
        if (user.licenseStatus !== 'ACTIVE' || (user.licenseExpiresAt && new Date(user.licenseExpiresAt) < now)) {
            isExpired = true
            message = 'Sua licença VIP expirou.'
        }
    } else if (user.role === UserRole.USER) {
        if (user.trialEndsAt && new Date(user.trialEndsAt) < now) {
            isExpired = true
            message = 'Seu período de teste gratuito terminou.'
        }
    }

    if (!isExpired) return null

    return (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md w-full">
                <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600 text-4xl">
                    🔒
                </div>
                <h1 className="text-3xl font-bold text-slate-900 mb-4">Acesso Bloqueado</h1>
                <p className="text-slate-600 mb-8 text-lg">
                    {message} Para continuar utilizando o X1Bot e não interromper suas automações, você precisa de uma licença ativa.
                </p>
                <div className="space-y-4">
                    <a
                        href="https://wa.me/5511999999999"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center rounded-lg bg-green-600 px-4 py-4 text-lg font-semibold text-white shadow-lg transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                    >
                        Falar com Suporte & Renovar
                    </a>
                    <button
                        onClick={() => logout()}
                        className="w-full text-slate-500 hover:text-slate-700 font-medium py-2"
                    >
                        Sair da conta
                    </button>
                </div>
            </div>
            <div className="absolute bottom-10 text-slate-400 text-sm">
                X1Bot - O seu motor de automação conversaional
            </div>
        </div>
    )
}
