import React from 'react'
import { KpiCard } from './KpiCard'
import type { LinksDerivedData } from '../hooks/useLinks'
import type { PrometheusKpis } from '../hooks/usePrometheusMetrics'
import { Link2, MousePointerClick, Layers, ShieldOff } from 'lucide-react'

interface KpiGridProps {
  linksData: LinksDerivedData | undefined
  linksLoading: boolean
  metrics: PrometheusKpis | undefined
  metricsLoading: boolean
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export const KpiGrid: React.FC<KpiGridProps> = ({
  linksData,
  linksLoading,
  metrics,
  metricsLoading,
}) => {
  // Active Links
  const activeLinksValue =
    linksData !== undefined ? formatNumber(linksData.activeLinksCount) : '—'
  const activeLinksSubtext =
    linksData !== undefined
      ? `${linksData.allLinks.length} total links in workspace`
      : 'No data yet'

  // Total Redirects
  const redirectsValue =
    linksData !== undefined ? formatNumber(linksData.totalRedirects) : '—'
  const redirectsSubtext =
    linksData !== undefined ? 'Cumulative click events' : 'No data yet'

  // Cache Hit Ratio
  const cacheRatioValue =
    metrics?.cacheHitRatio !== null && metrics?.cacheHitRatio !== undefined
      ? `${metrics.cacheHitRatio.toFixed(1)}%`
      : '—'
  const cacheSubtext =
    metrics?.cacheHits !== null && metrics?.cacheHits !== undefined
      ? `${formatNumber(metrics.cacheHits ?? 0)} hits / ${formatNumber(
          (metrics.cacheHits ?? 0) + (metrics.cacheMisses ?? 0)
        )} total`
      : 'No data yet'

  // Rate Limit Blocks
  const rateLimitValue =
    metrics?.rateLimitBlocked !== null && metrics?.rateLimitBlocked !== undefined
      ? formatNumber(metrics.rateLimitBlocked)
      : '—'
  const rateLimitSubtext =
    metrics?.rateLimitBlocked !== null && metrics?.rateLimitBlocked !== undefined
      ? 'Blocked requests since startup'
      : 'No data yet'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiCard
        title="Active Links"
        value={activeLinksValue}
        subtext={activeLinksSubtext}
        icon={<Link2 className="w-3.5 h-3.5" />}
        loading={linksLoading}
        accent
      />
      <KpiCard
        title="Total Redirects"
        value={redirectsValue}
        subtext={redirectsSubtext}
        icon={<MousePointerClick className="w-3.5 h-3.5" />}
        loading={linksLoading}
      />
      <KpiCard
        title="Cache Hit Ratio"
        value={cacheRatioValue}
        subtext={cacheSubtext}
        icon={<Layers className="w-3.5 h-3.5" />}
        loading={metricsLoading}
      />
      <KpiCard
        title="Rate Limit Blocks"
        value={rateLimitValue}
        subtext={rateLimitSubtext}
        icon={<ShieldOff className="w-3.5 h-3.5" />}
        loading={metricsLoading}
      />
    </div>
  )
}
