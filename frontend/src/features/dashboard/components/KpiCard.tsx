import React from 'react'
import { cn } from '../../../shared/lib/utils'
import { Skeleton } from '../../../shared/ui/Skeleton'

interface KpiCardProps {
  title: string
  value: string
  subtext?: string
  icon: React.ReactNode
  loading?: boolean
  className?: string
  accent?: boolean
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtext,
  icon,
  loading = false,
  className,
  accent = false,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-5 rounded-lg border transition-all hover:border-white/10',
        accent
          ? 'bg-brand-accent/5 border-brand-accent/20'
          : 'bg-brand-card border-brand-border',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-brand-text-secondary select-none">{title}</span>
        <div
          className={cn(
            'flex items-center justify-center w-7 h-7 rounded-md border',
            accent
              ? 'bg-brand-accent/10 border-brand-accent/20 text-brand-accent'
              : 'bg-white/5 border-brand-border text-brand-text-secondary'
          )}
        >
          {icon}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <span
            className={cn(
              'font-mono text-[26px] font-bold tracking-tight leading-none',
              accent ? 'text-brand-accent' : 'text-brand-text-primary'
            )}
          >
            {value}
          </span>
          {subtext && (
            <span className="text-[11px] text-brand-text-secondary">{subtext}</span>
          )}
        </div>
      )}
    </div>
  )
}
