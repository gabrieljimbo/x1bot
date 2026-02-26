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
const USER_KEY = 'n9n_user'
const TENANT_KEY = 'n9n_tenant'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Load auth state from localStorage
    const storedToken = localStorage.getItem(TOKEN_KEY)
    const storedUser = localStorage.getItem(USER_KEY)
    const storedTenant = localStorage.getItem(TENANT_KEY)

    if (storedToken && storedUser && storedTenant) {
      try {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
        setTenant(JSON.parse(storedTenant))
        apiClient.setToken(storedToken)
      } catch (error) {
        console.error('Error loading auth state:', error)
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        localStorage.removeItem(TENANT_KEY)
      }
    }

    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    const response = await apiClient.login(email, password)

    setToken(response.accessToken)
    setUser(response.user)
    setTenant(response.tenant)

    localStorage.setItem(TOKEN_KEY, response.accessToken)
    localStorage.setItem(USER_KEY, JSON.stringify(response.user))
    localStorage.setItem(TENANT_KEY, JSON.stringify(response.tenant))

    apiClient.setToken(response.accessToken)
  }

  const register = async (email: string, password: string, name?: string, tenantName?: string) => {
    const response = await apiClient.register(email, password, name, tenantName || '')

    setToken(response.accessToken)
    setUser(response.user)
    setTenant(response.tenant)

    localStorage.setItem(TOKEN_KEY, response.accessToken)
    localStorage.setItem(USER_KEY, JSON.stringify(response.user))
    localStorage.setItem(TENANT_KEY, JSON.stringify(response.tenant))

    apiClient.setToken(response.accessToken)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    setTenant(null)

    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(TENANT_KEY)

    apiClient.setToken(null)

    // Redirect to login page
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
  }

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


