import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'
import { useAuth } from './AuthContext'

const FullPageSpinner: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen bg-brand-bg">
    <LoadingSpinner size="lg" />
  </div>
)

export const AuthGuard: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children ? <>{children}</> : <Outlet />
}

export const PublicOnlyRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return <FullPageSpinner />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return children ? <>{children}</> : <Outlet />
}
