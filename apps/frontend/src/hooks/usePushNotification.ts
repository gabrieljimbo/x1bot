'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const bytes = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    bytes[i] = rawData.charCodeAt(i)
  }
  return bytes.buffer as ArrayBuffer
}

async function sendSubscriptionToBackend(
  subscription: PushSubscription,
  apiBase: string,
  token: string,
): Promise<void> {
  const sub = subscription.toJSON()
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return

  await fetch(`${apiBase}/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    }),
  })
}

export function usePushNotification() {
  const { token, isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isAuthenticated || !token) return

    const authToken: string = token
    const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

    async function setup() {
      if (typeof window === 'undefined') return

      if (!('serviceWorker' in navigator)) {
        console.warn('[PWA] Service Worker não suportado neste browser')
        return
      }
      if (!('PushManager' in window)) {
        console.warn('[PWA] Push API não suportada neste browser')
        return
      }
      if (!vapidKey) {
        console.error('[PWA] NEXT_PUBLIC_VAPID_PUBLIC_KEY não definida')
        return
      }

      try {
        // 1. Registrar SW (idempotente — não recria se já existir)
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        await navigator.serviceWorker.ready
        console.log('[PWA] Service Worker registrado')

        // 2. Verificar permissão atual
        if (Notification.permission === 'denied') {
          console.warn('[PWA] Notificações bloqueadas pelo usuário')
          return
        }

        // 3. Solicitar permissão se ainda não foi concedida
        if (Notification.permission !== 'granted') {
          const permission = await Notification.requestPermission()
          console.log(`[PWA] Permissão de notificação: ${permission}`)
          if (permission !== 'granted') return
        }

        // 4. Verificar subscription existente — sempre reenvia ao backend para
        //    lidar com perda de subscription do lado do servidor (restart, migração)
        const existing = await registration.pushManager.getSubscription()
        if (existing) {
          await sendSubscriptionToBackend(existing, apiBase, authToken)
          console.log('[PWA] Subscription existente reenviada ao servidor')
          return
        }

        // 5. Criar nova subscription
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        })

        // 6. Enviar nova subscription ao backend
        await sendSubscriptionToBackend(subscription, apiBase, authToken)
        console.log('[PWA] Nova subscription criada e enviada ao servidor')
      } catch (err) {
        console.error('[PWA] Erro ao configurar push notifications:', err)
      }
    }

    // Pequeno delay para não exibir o prompt de permissão imediatamente ao logar
    const timer = setTimeout(setup, 3000)
    return () => clearTimeout(timer)
  }, [isAuthenticated, token])
}
