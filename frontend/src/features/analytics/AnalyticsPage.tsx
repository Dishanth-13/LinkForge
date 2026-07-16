import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, ExternalLink } from 'lucide-react'
import { ContentContainer } from '../../shared/components/ContentContainer'
import { ErrorState } from '../../shared/components/ErrorState'
import { CopyButton } from '../../shared/ui/CopyButton'
import { AnalyticsHeader } from './components/AnalyticsHeader'
import { AnalyticsSummaryCards } from './components/AnalyticsSummaryCards'
import { TrafficChart } from './components/TrafficChart'
import { AnalyticsDistributionGrid } from './components/AnalyticsDistributionGrid'
import { RecentClicksTable } from './components/RecentClicksTable'
import { useAnalyticsQuery } from './hooks/useAnalyticsQuery'
import { useLinksQuery } from '../links/hooks/useLinksQuery'
import { API_BASE_URL } from '../../shared/lib/api'

interface CompactEmptyStateProps {
  title: string
  description: string
  action?: React.ReactNode
}

const CompactEmptyState: React.FC<CompactEmptyStateProps> = ({ title, description, action }) => (
  <div className="flex flex-col items-center justify-center text-center p-6 py-12 rounded-lg border border-dashed border-brand-border bg-white/[0.005] select-none min-h-[220px] shadow-inner">
    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white/5 border border-brand-border text-brand-text-secondary/70 mb-3 shrink-0">
      <BarChart3 className="w-4 h-4" />
    </div>
    <h3 className="text-xs font-semibold text-brand-text-primary">{title}</h3>
    <p className="mt-1 text-[11px] text-brand-text-secondary/80 max-w-[320px] leading-relaxed">
      {description}
    </p>
    {action && <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">{action}</div>}
  </div>
)

export const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate()

  // 1. Persist selectors state in localStorage
  const [selectedLinkId, setSelectedLinkId] = useState<number | undefined>(() => {
    const saved = localStorage.getItem('linkforge:analytics-link-id')
    return saved ? Number(saved) : undefined
  })
  const [selectedRange, setSelectedRange] = useState<string>(() => {
    return localStorage.getItem('linkforge:analytics-range') || '7d'
  })

  // Load organization links list
  const { data: links = [] } = useLinksQuery()

  // Clean stale/deleted link selections automatically
  useEffect(() => {
    if (selectedLinkId && links.length > 0) {
      const exists = links.some((l) => Number(l.id) === selectedLinkId)
      if (!exists) {
        setSelectedLinkId(undefined)
        localStorage.removeItem('linkforge:analytics-link-id')
      }
    }
  }, [links, selectedLinkId])

  const handleSelectLinkId = (id: number | undefined) => {
    setSelectedLinkId(id)
    if (id !== undefined) {
      localStorage.setItem('linkforge:analytics-link-id', String(id))
    } else {
      localStorage.removeItem('linkforge:analytics-link-id')
    }
  }

  const handleSelectRange = (range: string) => {
    setSelectedRange(range)
    localStorage.setItem('linkforge:analytics-range', range)
  }

  // Load analytics overview
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useAnalyticsQuery({
    link_id: selectedLinkId,
    range: selectedRange,
  })

  // Identify currently selected link record
  const selectedLink = selectedLinkId ? links.find((l) => Number(l.id) === selectedLinkId) : null

  // Determine if no click telemetry events exist in the current query scope
  const hasNoData = !isLoading && !isError && data?.total_clicks === 0

  return (
    <ContentContainer className="space-y-6">
      {/* Header Selector Bar */}
      <AnalyticsHeader
        selectedLinkId={selectedLinkId}
        onSelectLinkId={handleSelectLinkId}
        selectedRange={selectedRange}
        onSelectRange={handleSelectRange}
      />

      {isError ? (
        <ErrorState
          title="Failed to load analytics"
          message="Could not fetch telemetry records from the server. Check your connection."
          retryAction={() => refetch()}
        />
      ) : hasNoData ? (
        <CompactEmptyState
          title="No analytics yet"
          description={
            selectedLink
              ? `The short link /${selectedLink.custom_alias ?? selectedLink.short_code} has not received redirection clicks yet.`
              : 'Create a link and share it to start collecting click insights.'
          }
          action={
            selectedLink ? (
              <>
                <CopyButton
                  text={`${API_BASE_URL}/${selectedLink.custom_alias ?? selectedLink.short_code}`}
                  label="Copy Link"
                  className="px-3 py-1.5 rounded-md border border-brand-border bg-brand-surface hover:bg-white/5 text-brand-text-secondary hover:text-brand-text-primary text-xs font-medium transition-all shadow-sm"
                />
                <a
                  href={`${API_BASE_URL}/${selectedLink.custom_alias ?? selectedLink.short_code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-brand-border bg-brand-accent hover:bg-brand-accent/90 text-white text-xs font-semibold transition-all shadow-md shadow-brand-accent/25 hover:shadow-lg"
                >
                  <span>Open Link</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </>
            ) : (
              <button
                onClick={() => navigate('/links')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-brand-accent hover:bg-brand-accent/90 text-white text-xs font-semibold transition-all shadow-md shadow-brand-accent/25 hover:shadow-lg cursor-pointer"
              >
                Create a Link
              </button>
            )
          }
        />
      ) : (
        <>
          {/* KPI Summary Cards */}
          <AnalyticsSummaryCards
            totalClicks={data?.total_clicks}
            uniqueVisitors={data?.unique_visitors}
            topBrowser={data?.top_browser}
            topReferrer={data?.top_referrer}
            loading={isLoading}
          />

          {/* Time Series Traffic Chart */}
          <TrafficChart
            data={data?.time_series}
            range={selectedRange}
            loading={isLoading}
          />

          {/* Progress-bar Distributions Grid */}
          <AnalyticsDistributionGrid
            browsers={data?.browser_distribution}
            os={data?.os_distribution}
            devices={data?.device_distribution}
            referrers={data?.referrer_distribution}
            loading={isLoading}
          />

          {/* List of 10 Latest Click logs */}
          <RecentClicksTable
            clicks={data?.recent_clicks}
            loading={isLoading}
          />
        </>
      )}
    </ContentContainer>
  )
}
