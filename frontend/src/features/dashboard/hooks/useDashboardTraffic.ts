import { useQuery } from '@tanstack/react-query'
import { api } from '../../../shared/lib/api'

export interface DashboardTrafficPoint {
  timestamp: string
  clicks: number
}

interface AnalyticsOverviewSlim {
  total_clicks: number
  time_series: DashboardTrafficPoint[]
}

export function useDashboardTraffic() {
  return useQuery<AnalyticsOverviewSlim>({
    queryKey: ['dashboard-traffic-7d'],
    queryFn: async () => {
      const res = await api.get<AnalyticsOverviewSlim>('/api/v1/analytics/overview', {
        params: { range: '7d' },
      })
      return res.data
    },
    staleTime: 60_000,
    retry: 1,
  })
}
