import React from 'react'
import { Skeleton } from '../../../shared/ui/Skeleton'
import { StatusBadge } from '../../../shared/ui/StatusBadge'
import type { PlatformHealth } from '../hooks/useHealthStatus'
import { Database, Zap, Cpu, BarChart2 } from 'lucide-react'

interface InfraCardProps {
  icon: React.ReactNode
  name: string
  detail: string
  status: string
}

const statusVariant = (s: string): 'success' | 'danger' | 'neutral' => {
  if (s === 'healthy') return 'success'
  if (s === 'unhealthy' || s === 'degraded') return 'danger'
  return 'neutral'
}

const statusLabel = (s: string): string => {
  const labels: Record<string, string> = {
    healthy: 'Online',
    unhealthy: 'Offline',
    degraded: 'Degraded',
    not_monitored: 'Not monitored',
    unknown: 'Unknown',
  }
  return labels[s] ?? s
}

const InfraCard: React.FC<InfraCardProps> = ({ icon, name, detail, status }) => (
  <div className="flex flex-col gap-3 p-4 rounded-lg bg-brand-card border border-brand-border hover:border-white/10 transition-all">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-white/5 border border-brand-border text-brand-text-secondary">
          {icon}
        </div>
        <span className="text-xs font-semibold text-brand-text-primary">{name}</span>
      </div>
      <StatusBadge variant={statusVariant(status)}>{statusLabel(status)}</StatusBadge>
    </div>
    <p className="text-[10px] text-brand-text-secondary/60 leading-relaxed">{detail}</p>
  </div>
)

interface InfrastructureSummaryProps {
  health: PlatformHealth | undefined
  loading: boolean
}

export const InfrastructureSummary: React.FC<InfrastructureSummaryProps> = ({
  health,
  loading,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest select-none">
        Infrastructure Summary
      </h2>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4 rounded-lg border border-brand-border bg-brand-card flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <InfraCard
            icon={<Database className="w-3.5 h-3.5" />}
            name="PostgreSQL"
            detail="Pool size: 20 connections · asyncpg driver · WAL mode"
            status={health?.database ?? 'unknown'}
          />
          <InfraCard
            icon={<Zap className="w-3.5 h-3.5" />}
            name="Redis"
            detail="Read-through cache · Lua rate limiter · Celery broker"
            status={health?.redis ?? 'unknown'}
          />
          <InfraCard
            icon={<Cpu className="w-3.5 h-3.5" />}
            name="Celery"
            detail="solo pool · acks_late=True · No programmatic probe"
            status={health?.celery ?? 'not_monitored'}
          />
          <InfraCard
            icon={<BarChart2 className="w-3.5 h-3.5" />}
            name="Prometheus"
            detail="Metrics scraped from /metrics · Standard text exposition"
            status="healthy"
          />
        </div>
      )}
    </div>
  )
}
