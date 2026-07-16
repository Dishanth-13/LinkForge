import React from 'react'
import { MousePointerClick, Users, Compass, Globe } from 'lucide-react'
import { Skeleton } from '../../../shared/ui/Skeleton'

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string | number | null | undefined
  loading: boolean
}

const KpiCard: React.FC<KpiCardProps> = ({ icon, label, value, loading }) => (
  <div className="flex items-center gap-3 p-4 rounded-lg bg-brand-card border border-brand-border">
    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-white/5 border border-brand-border text-brand-text-secondary shrink-0">
      {icon}
    </div>
    <div className="flex flex-col min-w-0">
      <span className="text-[10px] text-brand-text-secondary/70 font-semibold uppercase tracking-wider select-none">
        {label}
      </span>
      {loading ? (
        <Skeleton className="h-5 w-16 mt-1" />
      ) : (
        <span className="font-mono text-base font-bold text-brand-text-primary leading-tight truncate">
          {value || '—'}
        </span>
      )}
    </div>
  </div>
)

interface AnalyticsSummaryCardsProps {
  totalClicks: number | undefined
  uniqueVisitors: number | undefined
  topBrowser: string | null | undefined
  topReferrer: string | null | undefined
  loading: boolean
}

export const AnalyticsSummaryCards: React.FC<AnalyticsSummaryCardsProps> = ({
  totalClicks,
  uniqueVisitors,
  topBrowser,
  topReferrer,
  loading,
}) => {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      <KpiCard
        icon={<MousePointerClick className="w-4 h-4 text-brand-accent" />}
        label="Total Clicks"
        value={totalClicks !== undefined ? totalClicks.toLocaleString() : null}
        loading={loading}
      />
      <KpiCard
        icon={<Users className="w-4 h-4 text-brand-success" />}
        label="Unique Visitors"
        value={uniqueVisitors !== undefined ? uniqueVisitors.toLocaleString() : null}
        loading={loading}
      />
      <KpiCard
        icon={<Compass className="w-4 h-4 text-brand-warning" />}
        label="Top Browser"
        value={topBrowser}
        loading={loading}
      />
      <KpiCard
        icon={<Globe className="w-4 h-4 text-[#C084FC]" />}
        label="Top Referrer"
        value={topReferrer}
        loading={loading}
      />
    </div>
  )
}
