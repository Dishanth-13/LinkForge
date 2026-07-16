import React from 'react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import { useDashboardTraffic } from '../hooks/useDashboardTraffic'
import { Skeleton } from '../../../shared/ui/Skeleton'

/**
 * Dashboard TrafficChart — renders the last 7 days of redirect traffic using
 * the existing analytics overview endpoint. Falls back to a compact empty
 * state when no ClickEvent rows exist yet.
 */
export const TrafficChart: React.FC = () => {
  const { data, isLoading } = useDashboardTraffic()

  const series = data?.time_series ?? []
  const hasData = series.length > 0

  const totalClicks = data?.total_clicks ?? 0

  const formatDay = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return iso
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest select-none">
            Traffic Overview
          </h2>
          <p className="text-[11px] text-brand-text-secondary/50">
            Redirect events — last 7 days
          </p>
        </div>
        {!isLoading && hasData && (
          <span className="text-[11px] font-semibold font-mono text-brand-accent tabular-nums">
            {totalClicks.toLocaleString()} clicks
          </span>
        )}
      </div>

      {/* Chart area */}
      <div className="relative rounded-lg border border-brand-border bg-white/[0.01] h-52 overflow-hidden">
        {isLoading ? (
          <div className="absolute inset-0 flex items-end gap-1 p-3 pb-4">
            {Array.from({ length: 14 }).map((_, i) => (
              <Skeleton
                key={i}
                className="flex-1 rounded-t-sm"
                style={{ height: `${20 + ((i * 7) % 70)}%` }}
              />
            ))}
          </div>
        ) : !hasData ? (
          /* Empty state */
          <>
            {/* SVG ghost grid */}
            <svg
              className="absolute inset-0 w-full h-full opacity-[0.06]"
              aria-hidden="true"
              preserveAspectRatio="none"
            >
              {[0.3, 0.55, 0.75].map((y) => (
                <line
                  key={y}
                  x1="0"
                  y1={`${y * 100}%`}
                  x2="100%"
                  y2={`${y * 100}%`}
                  stroke="white"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              ))}
              <polyline
                points="0,208 120,208 240,208 360,208 480,208 600,208 720,208 840,208"
                fill="none"
                stroke="white"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white/5 border border-brand-border text-brand-text-secondary/60">
                <TrendingUp className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-brand-text-primary">No traffic yet</p>
              <p className="text-[11px] text-brand-text-secondary/60 text-center max-w-[180px]">
                Share a short link and traffic will appear here.
              </p>
            </div>
          </>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 12, right: 8, left: -28, bottom: 4 }}>
              <defs>
                <linearGradient id="dashTrafficGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F8EF7" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#4F8EF7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatDay}
                stroke="transparent"
                tick={{ fill: '#ffffff', opacity: 0.35, fontSize: 9, fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                stroke="transparent"
                tick={{ fill: '#ffffff', opacity: 0.35, fontSize: 9, fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const pt = payload[0].payload as { timestamp: string; clicks: number }
                    return (
                      <div className="bg-brand-surface border border-brand-border px-3 py-2 rounded-lg shadow-xl text-xs flex flex-col gap-1">
                        <span className="text-[10px] text-brand-text-secondary font-mono">
                          {new Date(pt.timestamp).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-accent" />
                          <span className="text-brand-text-primary">
                            {pt.clicks} {pt.clicks === 1 ? 'click' : 'clicks'}
                          </span>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Area
                type="monotone"
                dataKey="clicks"
                stroke="#4F8EF7"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#dashTrafficGrad)"
                isAnimationActive
                animationDuration={700}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
