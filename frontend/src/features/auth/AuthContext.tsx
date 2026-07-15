import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, AUTH_LOGOUT_EVENT, AUTH_TOKEN_STORAGE_KEY, emitAuthLogout, isApiError } from '../../shared/lib/api'
import { queryClient } from '../../shared/lib/queryClient'

export type AuthRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface AuthUser {
  id: string
  organization_id: string
  email: string
  role: AuthRole
  is_active: boolean
  created_at: string
  updated_at: string
}

interface LoginPayload {
  email: string
  password: string
}

interface RegisterPayload {
  full_name: string
  org_name: string
  email: string
  password: string
}

interface LoginResponse {
  access_token: string
  token_type: string
}

interface RegisterResponse {
  access_token?: string
  token_type?: string
  status?: string
  message?: string
}

interface AuthContextValue {
  currentUser: AuthUser | null
  isAuthenticated: boolean
  loading: boolean
  login: (payload: LoginPayload) => Promise<LoginResponse>
  register: (payload: RegisterPayload) => Promise<RegisterResponse>
  logout: () => Promise<void>
  refreshCurrentUser: () => Promise<AuthUser | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const clearStoredSession = () => {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshCurrentUser = useCallback(async () => {
    try {
      const response = await api.get<AuthUser>('/api/v1/users/me')
      setCurrentUser(response.data)
      return response.data
    } catch (error) {
      if (isApiError(error) && error.response?.status === 401) {
        clearStoredSession()
      }
      setCurrentUser(null)
      return null
    }
  }, [])

  const clearSession = useCallback(() => {
    clearStoredSession()
    setCurrentUser(null)
    queryClient.clear()
  }, [])

  useEffect(() => {
    let active = true

    const bootstrap = async () => {
      const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
      if (!token) {
        if (active) setLoading(false)
        return
      }

      try {
        await refreshCurrentUser()
      } finally {
        if (active) setLoading(false)
      }
    }

    const handleForcedLogout = () => {
      clearSession()
      setLoading(false)
    }

    window.addEventListener(AUTH_LOGOUT_EVENT, handleForcedLogout)
    bootstrap()

    return () => {
      active = false
      window.removeEventListener(AUTH_LOGOUT_EVENT, handleForcedLogout)
    }
  }, [clearSession, refreshCurrentUser])

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await api.post<LoginResponse>('/api/v1/auth/login', payload)
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, response.data.access_token)
    queryClient.clear()
    await refreshCurrentUser()
    return response.data
  }, [refreshCurrentUser])

  const register = useCallback(async (payload: RegisterPayload) => {
    const response = await api.post<RegisterResponse>('/api/v1/auth/register', {
      org_name: payload.org_name,
      email: payload.email,
      password: payload.password,
    })

    if (response.data.access_token) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, response.data.access_token)
      queryClient.clear()
      await refreshCurrentUser()
    }

    return response.data
  }, [refreshCurrentUser])

  const logout = useCallback(async () => {
    try {
      await api.post('/api/v1/auth/logout', {}, { skipAuthRefresh: true })
    } catch {
      // Best-effort server revocation; local state is cleared regardless.
    } finally {
      clearSession()
      emitAuthLogout()
    }
  }, [clearSession])

  const value = useMemo<AuthContextValue>(() => ({
    currentUser,
    isAuthenticated: Boolean(currentUser),
    loading,
    login,
    register,
    logout,
    refreshCurrentUser,
  }), [currentUser, loading, login, register, logout, refreshCurrentUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return ctx
}
