import React, { useEffect, useRef, useState } from 'react'
import { Globe, Monitor, Smartphone, Link2 } from 'lucide-react'
import { Card } from '../../../shared/ui/Card'
import { Skeleton } from '../../../shared/ui/Skeleton'
import type { DistributionItem } from '../hooks/useAnalyticsQuery'

// ── Palette ──────────────────────────────────────────────────────────────────
// Five visually distinct accent colours drawn from the dark-SaaS palette.
const BAR_COLORS = [
  { bar: '#4F8EF7', glow: 'rgba(79,142,247,0.25)' },   // brand blue
  { bar: '#7C5EFC', glow: 'rgba(124,94,252,0.22)' },   // violet
  { bar: '#2BCEB3', glow: 'rgba(43,206,179,0.22)' },   // teal
  { bar: '#F5A623', glow: 'rgba(245,166,35,0.22)' },   // amber
  { bar: '#EF5A5A', glow: 'rgba(239,90,90,0.22)' },    // red
]

// ── AnimatedBar ───────────────────────────────────────────────────────────────
interface AnimatedBarProps {
  percentage: number
  color: (typeof BAR_COLORS)[number]
  delay: number
}

const AnimatedBar: React.FC<AnimatedBarProps> = ({ percentage, color, delay }) => {
  const [width, setWidth] = useState(0)
  const rafRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    rafRef.current = setTimeout(() => setWidth(percentage), delay)
    return () => {
      if (rafRef.current) clearTimeout(rafRef.current)
    }
  }, [percentage, delay])

  return (
    <div className="relative w-full h-[5px] rounded-full bg-white/[0.05] overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
        style={{
          width: `${width}%`,
          background: `linear-gradient(90deg, ${color.bar}CC, ${color.bar})`,
          boxShadow: width > 0 ? `0 0 8px ${color.glow}` : 'none',
        }}
      />
    </div>
  )
}

// ── DistributionCard ──────────────────────────────────────────────────────────
interface DistributionCardProps {
  title: string
  icon: React.ReactNode
  items: DistributionItem[] | undefined
  loading: boolean
}

const DistributionCard: React.FC<DistributionCardProps> = ({ title, icon, items = [], loading }) => {
  if (loading) {
    return (
      <Card className="flex flex-col gap-4">
        {/* header */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-3.5 w-28" />
        </div>
        {/* rows */}
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-2.5 w-12" />
              </div>
              <Skeleton className="h-[5px] w-full rounded-full" />
            </div>
          ))}
        </div>
      </Card>
    )
  }

  // Cap to top-5
  const top5 = items.slice(0, 5)
  const total = top5.reduce((s, it) => s + it.count, 0)

  return (
    <Card className="flex flex-col gap-4">
      {/* Card header */}
      <div className="flex items-center gap-2.5 select-none">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-white/[0.06] border border-brand-border text-brand-text-secondary shrink-0">
          {icon}
        </div>
        <h3 className="text-[11px] font-bold text-brand-text-primary uppercase tracking-widest">
          {title}
        </h3>
      </div>

      {/* Rows */}
      {top5.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-1 select-none">
          <span className="text-[11px] text-brand-text-secondary/60 font-medium">
            No data in this range
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {top5.map((item, idx) => {
            const pct = total > 0 ? (item.count / total) * 100 : 0
            const color = BAR_COLORS[idx % BAR_COLORS.length]
            return (
              <div key={item.name} className="flex flex-col gap-1.5">
                {/* Label row */}
                <div className="flex items-center justify-between gap-2 select-none">
                  {/* Rank dot + name */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: color.bar }}
                    />
                    <span
                      className="text-[11px] font-medium text-brand-text-primary truncate"
                      title={item.name}
                    >
                      {item.name || '(direct)'}
                    </span>
                  </div>
                  {/* Count + percentage */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono text-brand-text-secondary tabular-nums">
                      {item.count.toLocaleString()}
                    </span>
                    <span
                      className="text-[9px] font-bold px-1 py-0.5 rounded"
                      style={{
                        color: color.bar,
                        background: color.glow,
                      }}
                    >
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
                {/* Animated bar */}
                <AnimatedBar percentage={pct} color={color} delay={idx * 60} />
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ── AnalyticsDistributionGrid ─────────────────────────────────────────────────
interface AnalyticsDistributionGridProps {
  browsers: DistributionItem[] | undefined
  os: DistributionItem[] | undefined
  devices: DistributionItem[] | undefined
  referrers: DistributionItem[] | undefined
  loading: boolean
}

export const AnalyticsDistributionGrid: React.FC<AnalyticsDistributionGridProps> = ({
  browsers,
  os,
  devices,
  referrers,
  loading,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <DistributionCard
        title="Browsers"
        icon={<Globe className="w-3.5 h-3.5" />}
        items={browsers}
        loading={loading}
      />
      <DistributionCard
        title="Operating Systems"
        icon={<Monitor className="w-3.5 h-3.5" />}
        items={os}
        loading={loading}
      />
      <DistributionCard
        title="Device Types"
        icon={<Smartphone className="w-3.5 h-3.5" />}
        items={devices}
        loading={loading}
      />
      <DistributionCard
        title="Referrers"
        icon={<Link2 className="w-3.5 h-3.5" />}
        items={referrers}
        loading={loading}
      />
    </div>
  )
}
