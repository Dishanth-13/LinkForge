import React from 'react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card } from '../../../shared/ui/Card'
import { Skeleton } from '../../../shared/ui/Skeleton'
import type { TimeSeriesPoint } from '../hooks/useAnalyticsQuery'

interface TrafficChartProps {
  data: TimeSeriesPoint[] | undefined
  range: string
  loading: boolean
}

// Formats X-axis date values
const formatDate = (iso: string, range: string) => {
  try {
    const d = new Date(iso)
    if (range === '24h') {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

export const TrafficChart: React.FC<TrafficChartProps> = ({ data = [], range, loading }) => {
  if (loading) {
    return (
      <Card className="flex flex-col gap-4 min-h-[320px] justify-between">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3.5 w-44" />
        </div>
        <div className="h-52 w-full flex items-end gap-2">
          {Array.from({ length: 15 }).map((_, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t-sm"
              style={{ height: `${Math.random() * 80 + 10}%` }}
            />
          ))}
        </div>
      </Card>
    )
  }

  const hasData = data && data.length > 0

  return (
    <Card className="flex flex-col gap-4 min-h-[320px]">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-xs font-semibold text-brand-text-primary select-none">Click Traffic</h3>
        <p className="text-[10px] text-brand-text-secondary select-none">
          {range === '24h' ? 'Redirection volume by hour' : 'Redirection volume by day'}
        </p>
      </div>

      <div className="flex-1 w-full min-h-[220px] relative">
        {!hasData ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xs text-brand-text-secondary">No traffic data in this range</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F8EF7" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#4F8EF7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="timestamp"
                tickFormatter={(val) => formatDate(val, range)}
                stroke="#ffffff"
                opacity={0.15}
                tick={{ fill: '#ffffff', opacity: 0.5, fontSize: 9, fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                stroke="#ffffff"
                opacity={0.15}
                tick={{ fill: '#ffffff', opacity: 0.5, fontSize: 9, fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const point = payload[0].payload as TimeSeriesPoint
                    const formattedDate = new Date(point.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: range === '24h' ? '2-digit' : undefined,
                      minute: range === '24h' ? '2-digit' : undefined,
                    })
                    return (
                      <div className="bg-brand-surface border border-brand-border px-3 py-2 rounded-lg shadow-xl text-xs flex flex-col gap-1">
                        <span className="text-[10px] text-brand-text-secondary font-mono">
                          {formattedDate}
                        </span>
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-accent" />
                          <span className="text-brand-text-primary">
                            {point.clicks} {point.clicks === 1 ? 'click' : 'clicks'}
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
                fill="url(#colorClicks)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}
