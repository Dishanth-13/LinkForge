import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../../shared/ui/Toast'
import { queryClient } from '../../shared/lib/queryClient'
import { AuthProvider } from '../../features/auth/AuthContext'

interface AppProvidersProps {
  children: React.ReactNode
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
