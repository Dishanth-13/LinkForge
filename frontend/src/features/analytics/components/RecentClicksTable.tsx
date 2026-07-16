import React from 'react'
import { Card } from '../../../shared/ui/Card'
import { Skeleton } from '../../../shared/ui/Skeleton'
import type { RecentClickItem } from '../hooks/useAnalyticsQuery'

interface RecentClicksTableProps {
  clicks: RecentClickItem[] | undefined
  loading: boolean
}

// Inline datetime formatter
const fmtDateTime = (iso: string) => {
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return iso
  }
}

export const RecentClicksTable: React.FC<RecentClicksTableProps> = ({ clicks = [], loading }) => {
  if (loading) {
    return (
      <Card className="flex flex-col gap-4 overflow-hidden">
        <Skeleton className="h-4 w-28" />
        <div className="rounded-lg border border-brand-border overflow-hidden mt-1">
          <div className="grid grid-cols-[2fr_1.5fr_1.5fr_1.5fr_1.5fr_2fr] gap-4 px-4 py-2.5 border-b border-brand-border bg-white/[0.015]">
            {['Timestamp', 'Short Link', 'Browser', 'OS', 'Device', 'Referrer'].map((_, i) => (
              <Skeleton key={i} className="h-3 w-12" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, r) => (
            <div key={r} className="grid grid-cols-[2fr_1.5fr_1.5fr_1.5fr_1.5fr_2fr] gap-4 px-4 py-3.5 border-b border-brand-border last:border-0">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-12" />
              <Skeleton className="h-3.5 w-20" />
            </div>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col gap-4 overflow-hidden">
      <h3 className="text-xs font-semibold text-brand-text-primary select-none">Recent Click Activity</h3>

      {clicks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center select-none border border-dashed border-brand-border rounded-lg bg-white/[0.005]">
          <span className="text-xs font-semibold text-brand-text-primary">No click activity yet</span>
          <span className="text-[10px] text-brand-text-secondary mt-1">
            Redirections will register here as they occur.
          </span>
        </div>
      ) : (
        <div className="rounded-lg border border-brand-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-brand-border bg-white/[0.015] text-[10px] font-bold text-brand-text-secondary/60 uppercase tracking-wider text-left select-none">
                  <th className="px-4 py-2.5">Timestamp</th>
                  <th className="px-4 py-2.5">Short Link</th>
                  <th className="px-4 py-2.5">Browser</th>
                  <th className="px-4 py-2.5">OS</th>
                  <th className="px-4 py-2.5">Device</th>
                  <th className="px-4 py-2.5">Referrer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {clicks.map((click, index) => (
                  <tr key={index} className="text-xs hover:bg-white/[0.01] transition-colors">
                    {/* Timestamp */}
                    <td className="px-4 py-3 text-brand-text-secondary font-mono">
                      {fmtDateTime(click.timestamp)}
                    </td>
                    {/* Short link */}
                    <td className="px-4 py-3 text-brand-accent font-semibold">
                      /{click.short_code}
                    </td>
                    {/* Browser */}
                    <td className="px-4 py-3 text-brand-text-primary truncate max-w-[120px]" title={click.browser}>
                      {click.browser}
                    </td>
                    {/* OS */}
                    <td className="px-4 py-3 text-brand-text-primary truncate max-w-[120px]" title={click.os}>
                      {click.os}
                    </td>
                    {/* Device */}
                    <td className="px-4 py-3 text-brand-text-secondary capitalize">
                      {click.device_type}
                    </td>
                    {/* Referrer */}
                    <td className="px-4 py-3 text-brand-text-secondary truncate max-w-[180px]" title={click.referer || 'Direct / Email'}>
                      {click.referer || <span className="text-brand-text-secondary/40 italic">Direct / Email</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  )
}
