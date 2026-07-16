import { useQuery } from '@tanstack/react-query'
import { api } from '../../../shared/lib/api'

export interface TimeSeriesPoint {
  timestamp: string
  clicks: number
}

export interface DistributionItem {
  name: string
  count: number
}

export interface RecentClickItem {
  timestamp: string
  short_code: string
  browser: string
  os: string
  device_type: string
  referer: string | null
}

export interface AnalyticsOverviewData {
  total_clicks: number
  unique_visitors: number
  top_browser: string | null
  top_referrer: string | null
  time_series: TimeSeriesPoint[]
  browser_distribution: DistributionItem[]
  os_distribution: DistributionItem[]
  device_distribution: DistributionItem[]
  referrer_distribution: DistributionItem[]
  recent_clicks: RecentClickItem[]
}

interface AnalyticsQueryParams {
  link_id?: number
  range?: string
}

export const ANALYTICS_QUERY_KEY = 'analytics-overview'

export function useAnalyticsQuery(params: AnalyticsQueryParams) {
  const { link_id, range = '7d' } = params

  return useQuery<AnalyticsOverviewData>({
    queryKey: [ANALYTICS_QUERY_KEY, link_id, range],
    queryFn: async () => {
      const queryParams: Record<string, string | number> = { range }
      if (link_id !== undefined) {
        queryParams.link_id = link_id
      }

      const res = await api.get<AnalyticsOverviewData>('/api/v1/analytics/overview', {
        params: queryParams,
      })
      return res.data
    },
    staleTime: 15_000,
    retry: 1,
  })
}
