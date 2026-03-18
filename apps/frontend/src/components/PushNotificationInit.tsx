'use client'

import { usePushNotification } from '@/hooks/usePushNotification'

/**
 * Componente headless que inicializa as push notifications quando o
 * usuário está autenticado. Deve ser montado dentro de <AuthProvider>.
 * Não renderiza nada na UI.
 */
export function PushNotificationInit() {
  usePushNotification()
  return null
}
