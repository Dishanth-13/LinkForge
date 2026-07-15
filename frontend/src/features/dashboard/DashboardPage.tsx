import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ContentContainer } from '../../shared/components/ContentContainer'
import { DashboardGreeting } from './components/DashboardGreeting'
import { PlatformHealthCard } from './components/PlatformHealthCard'
import { KpiGrid } from './components/KpiGrid'
import { TrafficChart } from './components/TrafficChart'
import { TopLinksTable } from './components/TopLinksTable'
import { ActivityTimeline } from './components/ActivityTimeline'
import { InfrastructureSummary } from './components/InfrastructureSummary'
import { useHealthStatus } from './hooks/useHealthStatus'
import { useLinks } from './hooks/useLinks'
import { usePrometheusMetrics } from './hooks/usePrometheusMetrics'

// Decode org name from JWT stored in localStorage — no extra library needed
function decodeOrgFromToken(): string {
  try {
    const token = localStorage.getItem('linkforge:token')
    if (!token) return 'Your Workspace'
    const payloadB64 = token.split('.')[1]
    const decoded = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))
    // Backend puts org_id in the claim but not org_name — use a friendly fallback
    return decoded.org_name ?? decoded.org_id?.slice(0, 8) ?? 'Your Workspace'
  } catch {
    return 'Your Workspace'
  }
}

interface FadeInSectionProps {
  children: React.ReactNode
  index: number
}

const FadeInSection: React.FC<FadeInSectionProps> = ({ children, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.07, duration: 0.3 }}
  >
    {children}
  </motion.div>
)

export const DashboardPage: React.FC = () => {
  const { data: health, isLoading: healthLoading } = useHealthStatus()
  const { data: linksData, isLoading: linksLoading } = useLinks()
  const { data: metrics, isLoading: metricsLoading } = usePrometheusMetrics()

  const orgName = useMemo(() => decodeOrgFromToken(), [])

  return (
    <ContentContainer className="space-y-8">
      {/* 0 — Greeting + Quick Actions */}
      <FadeInSection index={0}>
        <DashboardGreeting orgName={orgName} />
      </FadeInSection>

      {/* 1 — Platform Health strip */}
      <FadeInSection index={1}>
        <PlatformHealthCard health={health} isLoading={healthLoading} />
      </FadeInSection>

      {/* 2 — KPI cards */}
      <FadeInSection index={2}>
        <KpiGrid
          linksData={linksData}
          linksLoading={linksLoading}
          metrics={metrics}
          metricsLoading={metricsLoading}
        />
      </FadeInSection>

      {/* 3 — Traffic chart + Top Links (two-column on large screens) */}
      <FadeInSection index={3}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
          <TrafficChart />
          <TopLinksTable links={linksData?.topLinks} loading={linksLoading} />
        </div>
      </FadeInSection>

      {/* 4 — Recent Activity + Infrastructure (two-column on large screens) */}
      <FadeInSection index={4}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ActivityTimeline />
          <InfrastructureSummary health={health} loading={healthLoading} />
        </div>
      </FadeInSection>
    </ContentContainer>
  )
}
