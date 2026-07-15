import React from 'react'
import { StatusBadge } from '../../../shared/ui/StatusBadge'
import { LoadingSpinner } from '../../../shared/ui/LoadingSpinner'
import type { PlatformHealth } from '../hooks/useHealthStatus'
import { Globe, Database, Zap, Cpu } from 'lucide-react'

interface ServiceCardProps {
  icon: React.ReactNode
  name: string
  status: string
  description: string
}

const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'neutral' => {
  if (s === 'healthy' || s === 'active') return 'success'
  if (s === 'degraded' || s === 'unhealthy') return 'danger'
  if (s === 'not_monitored') return 'neutral'
  return 'neutral'
}

const statusLabel = (s: string): string => {
  const labels: Record<string, string> = {
    healthy: 'Healthy',
    degraded: 'Degraded',
    unhealthy: 'Unhealthy',
    active: 'Active',
    not_monitored: 'Not monitored',
    unknown: 'Unknown',
  }
  return labels[s] ?? s
}

const ServiceCard: React.FC<ServiceCardProps> = ({ icon, name, status, description }) => (
  <div className="flex items-center gap-3 p-4 rounded-lg bg-brand-card border border-brand-border hover:border-white/10 transition-all">
    <div className="flex items-center justify-center w-9 h-9 rounded-md bg-white/5 border border-brand-border text-brand-text-secondary shrink-0">
      {icon}
    </div>
    <div className="flex flex-col gap-1 min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-brand-text-primary">{name}</span>
        <StatusBadge variant={statusVariant(status)}>{statusLabel(status)}</StatusBadge>
      </div>
      <span className="text-[10px] text-brand-text-secondary/60 truncate">{description}</span>
    </div>
  </div>
)

interface PlatformHealthCardProps {
  health: PlatformHealth | undefined
  isLoading: boolean
}

export const PlatformHealthCard: React.FC<PlatformHealthCardProps> = ({ health, isLoading }) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest select-none">
          Platform Health
        </h2>
        {isLoading && <LoadingSpinner size="sm" />}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <ServiceCard
          icon={<Globe className="w-4 h-4" />}
          name="API"
          status={health?.api ?? 'unknown'}
          description="FastAPI application process"
        />
        <ServiceCard
          icon={<Database className="w-4 h-4" />}
          name="PostgreSQL"
          status={health?.database ?? 'unknown'}
          description="Primary relational datastore"
        />
        <ServiceCard
          icon={<Zap className="w-4 h-4" />}
          name="Redis"
          status={health?.redis ?? 'unknown'}
          description="In-memory cache & broker"
        />
        <ServiceCard
          icon={<Cpu className="w-4 h-4" />}
          name="Celery"
          status={health?.celery ?? 'not_monitored'}
          description="Background task workers"
        />
      </div>
    </div>
  )
}
