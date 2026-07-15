import React, { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { DashboardLayout } from '../../layouts/dashboard/DashboardLayout'
import { LoginPage } from '../../features/auth/LoginPage'
import { LoadingSpinner } from '../../shared/ui/LoadingSpinner'

// Lazy-loaded pages (code split at route boundary)
const DashboardPage = lazy(() =>
  import('../../features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage }))
)
const LinksPage = lazy(() =>
  import('../../features/links/LinksPage').then((m) => ({ default: m.LinksPage }))
)
const AnalyticsPage = lazy(() =>
  import('../../features/analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage }))
)
const EventsPage = lazy(() =>
  import('../../features/events/EventsPage').then((m) => ({ default: m.EventsPage }))
)
const InfrastructurePage = lazy(() =>
  import('../../features/infrastructure/InfrastructurePage').then((m) => ({
    default: m.InfrastructurePage,
  }))
)
const ObservabilityPage = lazy(() =>
  import('../../features/observability/ObservabilityPage').then((m) => ({
    default: m.ObservabilityPage,
  }))
)
const TeamPage = lazy(() =>
  import('../../features/team/TeamPage').then((m) => ({ default: m.TeamPage }))
)
const SettingsPage = lazy(() =>
  import('../../features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))
)

// Shared Suspense fallback — full-page centred spinner
const PageFallback = () => (
  <div className="flex items-center justify-center h-full min-h-[300px]">
    <LoadingSpinner size="lg" />
  </div>
)

const withSuspense = (element: React.ReactNode) => (
  <Suspense fallback={<PageFallback />}>{element}</Suspense>
)

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <DashboardLayout />,
    children: [
      { path: '', element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: withSuspense(<DashboardPage />) },
      { path: 'links', element: withSuspense(<LinksPage />) },
      { path: 'analytics', element: withSuspense(<AnalyticsPage />) },
      { path: 'events', element: withSuspense(<EventsPage />) },
      { path: 'infrastructure', element: withSuspense(<InfrastructurePage />) },
      { path: 'observability', element: withSuspense(<ObservabilityPage />) },
      { path: 'team', element: withSuspense(<TeamPage />) },
      { path: 'settings', element: withSuspense(<SettingsPage />) },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
])
