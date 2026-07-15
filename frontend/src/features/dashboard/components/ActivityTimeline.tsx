import React from 'react'
import { Activity } from 'lucide-react'

/**
 * ActivityTimeline — Recent Activity section.
 *
 * No audit event listing API endpoint is currently publicly exposed.
 * The backend records AuditEvents internally but there is no GET route.
 * This component renders a meaningful empty state rather than fabricating data.
 */
export const ActivityTimeline: React.FC = () => {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest select-none">
        Recent Activity
      </h2>

      <div className="rounded-lg border border-dashed border-brand-border bg-white/[0.01] p-6 flex flex-col items-center justify-center text-center gap-3 min-h-[180px] select-none">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-brand-border text-brand-text-secondary/60">
          <Activity className="w-4.5 h-4.5" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-brand-text-primary">
            No activity events yet
          </p>
          <p className="text-[11px] text-brand-text-secondary/60 max-w-[240px]">
            Audit event streaming will appear here once a listing endpoint is available.
          </p>
        </div>
      </div>
    </div>
  )
}
