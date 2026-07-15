import React from 'react'
import { Skeleton } from '../../../shared/ui/Skeleton'

export const LinksSkeleton: React.FC = () => (
  <div className="rounded-lg border border-brand-border overflow-hidden">
    {/* Header */}
    <div className="grid grid-cols-[2fr_3fr_2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-brand-border bg-white/[0.015]">
      {['Short Link', 'Original URL', 'Title', 'Status', 'Clicks', 'Created', ''].map((h) => (
        <Skeleton key={h} className="h-3 w-16" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="grid grid-cols-[2fr_3fr_2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-4 border-b border-brand-border last:border-0">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-20" />
        <div className="flex gap-1.5">
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-6 w-6 rounded" />
        </div>
      </div>
    ))}
  </div>
)
