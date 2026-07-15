import { useQuery } from '@tanstack/react-query'
import { api } from '../../../shared/lib/api'
import { parsePrometheusText, getCounter } from '../../../shared/lib/parseMetrics'

export interface PrometheusKpis {
  cacheHits: number | null
  cacheMisses: number | null
  cacheHitRatio: number | null   // 0–100 percentage, null if no data
  rateLimitBlocked: number | null
  httpRequestsTotal: number | null
}

async function fetchPrometheusKpis(): Promise<PrometheusKpis> {
  const res = await api.get<string>('/metrics', {
    timeout: 8000,
    responseType: 'text',
    // Override content-type negotiation
    headers: { Accept: 'text/plain' },
  })

  const map = parsePrometheusText(res.data)

  const hits = getCounter(map, 'linkforge_cache_hits_total')
  const misses = getCounter(map, 'linkforge_cache_misses_total')

  let ratio: number | null = null
  if (hits !== null && misses !== null) {
    const total = hits + misses
    ratio = total > 0 ? (hits / total) * 100 : null
  }

  return {
    cacheHits: hits,
    cacheMisses: misses,
    cacheHitRatio: ratio,
    rateLimitBlocked: getCounter(map, 'linkforge_rate_limit_blocked_total'),
    httpRequestsTotal: getCounter(map, 'linkforge_http_requests_total'),
  }
}

export function usePrometheusMetrics() {
  return useQuery<PrometheusKpis>({
    queryKey: ['prometheus-kpis'],
    queryFn: fetchPrometheusKpis,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  })
}
