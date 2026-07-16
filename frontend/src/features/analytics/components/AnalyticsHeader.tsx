import React from 'react'
import { ChevronDown, Filter } from 'lucide-react'
import { useLinksQuery } from '../../links/hooks/useLinksQuery'
import { cn } from '../../../shared/lib/utils'

interface AnalyticsHeaderProps {
  selectedLinkId: number | undefined
  onSelectLinkId: (id: number | undefined) => void
  selectedRange: string
  onSelectRange: (range: string) => void
}

const RANGES = [
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: 'All Time', value: 'all' },
]

export const AnalyticsHeader: React.FC<AnalyticsHeaderProps> = ({
  selectedLinkId,
  onSelectLinkId,
  selectedRange,
  onSelectRange,
}) => {
  const { data: links = [] } = useLinksQuery()

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-brand-border pb-5 select-none">
      {/* Title & Desc */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-brand-text-primary tracking-tight">Analytics</h1>
        <p className="text-xs text-brand-text-secondary">
          Track link performance, browser footprints, and visitor metrics.
        </p>
      </div>

      {/* Selectors */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Link Filter Dropdown */}
        <div className="relative group">
          <select
            value={selectedLinkId !== undefined ? String(selectedLinkId) : ''}
            onChange={(e) => {
              const val = e.target.value
              onSelectLinkId(val ? Number(val) : undefined)
            }}
            className="appearance-none pl-8 pr-8 py-1.5 text-xs font-semibold bg-brand-card border border-brand-border rounded-md text-brand-text-primary focus:outline-none focus:border-brand-accent/50 cursor-pointer transition-all"
          >
            <option value="">All Links</option>
            {links.map((link) => (
              <option key={link.id} value={link.id}>
                /{link.custom_alias ?? link.short_code} ({link.title || 'Untitled'})
              </option>
            ))}
          </select>
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-text-secondary pointer-events-none" />
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-text-secondary pointer-events-none" />
        </div>

        {/* Time-Range pills */}
        <div className="flex items-center gap-0.5 bg-brand-card border border-brand-border rounded-md p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => onSelectRange(r.value)}
              className={cn(
                'px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer',
                selectedRange === r.value
                  ? 'bg-white/10 text-brand-text-primary'
                  : 'text-brand-text-secondary hover:text-brand-text-primary'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
