import React from 'react'
import { Skeleton } from '../../../shared/ui/Skeleton'
import type { LinkRecord } from '../hooks/useLinksQuery'
import { Link2, CheckCircle2, XCircle, MousePointerClick } from 'lucide-react'

interface SummaryCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  loading: boolean
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, label, value, loading }) => (
  <div className="flex items-center gap-3 p-4 rounded-lg bg-brand-card border border-brand-border">
    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-white/5 border border-brand-border text-brand-text-secondary shrink-0">
      {icon}
    </div>
    <div className="flex flex-col min-w-0">
      <span className="text-[10px] text-brand-text-secondary/70 font-medium uppercase tracking-wider select-none">
        {label}
      </span>
      {loading ? (
        <Skeleton className="h-5 w-12 mt-0.5" />
      ) : (
        <span className="font-mono text-lg font-bold text-brand-text-primary leading-tight tabular-nums">
          {value}
        </span>
      )}
    </div>
  </div>
)

interface LinksSummaryCardsProps {
  links: LinkRecord[] | undefined
  loading: boolean
}

export const LinksSummaryCards: React.FC<LinksSummaryCardsProps> = ({ links, loading }) => {
  const total = links?.length ?? 0
  const active = links?.filter((l) => l.is_active).length ?? 0
  const inactive = total - active
  const totalClicks = links?.reduce((s, l) => s + l.click_count, 0) ?? 0

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      <SummaryCard icon={<Link2 className="w-4 h-4" />} label="Total Links" value={total} loading={loading} />
      <SummaryCard icon={<CheckCircle2 className="w-4 h-4 text-brand-success" />} label="Active" value={active} loading={loading} />
      <SummaryCard icon={<XCircle className="w-4 h-4 text-brand-danger" />} label="Inactive" value={inactive} loading={loading} />
      <SummaryCard icon={<MousePointerClick className="w-4 h-4 text-brand-accent" />} label="Total Redirects" value={totalClicks.toLocaleString()} loading={loading} />
    </div>
  )
}
