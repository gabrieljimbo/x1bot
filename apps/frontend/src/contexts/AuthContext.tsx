'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'

interface User {
  id: string
  email: string
  name?: string
  tenantId: string
  role?: string
  trialStartedAt?: string
  trialEndsAt?: string
  licenseStatus?: string
  licenseExpiresAt?: string
}

interface Tenant {
  id: string
  name: string
  email: string
}

interface AuthContextType {
  user: User | null
  tenant: Tenant | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string, tenantName?: string) => Promise<void>
  logout: () => void
  isLoading: boolean
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'n9n_token'
const REFRESH_TOKEN_KEY = 'n9n_refresh_token'
const USER_KEY = 'n9n_user'
const TENANT_KEY = 'n9n_tenant'

// 60 minutes of inactivity before logout
const INACTIVITY_TIMEOUT = 60 * 60 * 1000 

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY)
    const storedUser = localStorage.getItem(USER_KEY)
    const storedTenant = localStorage.getItem(TENANT_KEY)

    if (storedToken) {
      try {
        setToken(storedToken)
        apiClient.setToken(storedToken)

        if (storedUser) {
          setUser(JSON.parse(storedUser))
        }

        if (storedTenant && storedTenant !== 'undefined') {
          setTenant(JSON.parse(storedTenant))
        }
      } catch (error) {
        console.error('Error loading auth state:', error)
        // Only clear if it's a critical failure
        if (error instanceof SyntaxError) {
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(USER_KEY)
          localStorage.removeItem(TENANT_KEY)
        }
      }
    }

    setIsLoading(false)
  }, [])

  // Stabilize functions to avoid unnecessary effect re-runs
  const logout = React.useCallback(() => {
    setToken(null)
    setUser(null)
    setTenant(null)

    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(TENANT_KEY)

    apiClient.setToken(null)

    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
  }, [])

  // Inactivity tracking
  useEffect(() => {
    if (!token || !user) return

    const resetTimer = () => {
      localStorage.setItem('n9n_last_activity', Date.now().toString())
    }

    const checkInactivity = () => {
      const lastActivity = localStorage.getItem('n9n_last_activity')
      if (lastActivity) {
        const inactiveTime = Date.now() - parseInt(lastActivity)
        if (inactiveTime > INACTIVITY_TIMEOUT) {
          console.log('User inactive for too long. Logging out...')
          logout()
        }
      } else {
        resetTimer()
      }
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    events.forEach(event => window.addEventListener(event, resetTimer))

    const interval = setInterval(checkInactivity, 60000)

    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimer))
      clearInterval(interval)
    }
  }, [token, user, logout])

  const login = React.useCallback(async (email: string, password: string) => {
    const response = await apiClient.login(email, password)

    setToken(response.accessToken)
    setUser(response.user)
    setTenant(response.tenant)

    localStorage.setItem(TOKEN_KEY, response.accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken)
    localStorage.setItem(USER_KEY, JSON.stringify(response.user))
    localStorage.setItem(TENANT_KEY, JSON.stringify(response.tenant))

    apiClient.setToken(response.accessToken)
  }, [])

  const register = React.useCallback(async (email: string, password: string, name?: string, tenantName?: string) => {
    const response = await apiClient.register(email, password, name, tenantName || '')

    setToken(response.accessToken)
    setUser(response.user)
    setTenant(response.tenant)

    localStorage.setItem(TOKEN_KEY, response.accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken)
    localStorage.setItem(USER_KEY, JSON.stringify(response.user))
    localStorage.setItem(TENANT_KEY, JSON.stringify(response.tenant))

    apiClient.setToken(response.accessToken)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        token,
        login,
        register,
        logout,
        isLoading,
        isAuthenticated: !!token && !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}


