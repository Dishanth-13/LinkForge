import { useQuery } from '@tanstack/react-query'
import { api } from '../../../shared/lib/api'

interface HealthComponents {
  database?: string
  redis?: string
}

interface HealthResponse {
  status: string
  components?: HealthComponents
  environment?: string
}

export interface PlatformHealth {
  api: 'healthy' | 'degraded' | 'unknown'
  database: 'healthy' | 'unhealthy' | 'unknown'
  redis: 'healthy' | 'unhealthy' | 'unknown'
  celery: 'not_monitored'
}

async function fetchHealth(): Promise<PlatformHealth> {
  const [liveRes, readyRes] = await Promise.allSettled([
    api.get<HealthResponse>('/live', { timeout: 5000 }),
    api.get<HealthResponse>('/ready', { timeout: 5000 }),
  ])

  const apiStatus =
    liveRes.status === 'fulfilled' && liveRes.value.data.status === 'ok'
      ? 'healthy'
      : 'degraded'

  let dbStatus: 'healthy' | 'unhealthy' | 'unknown' = 'unknown'
  let redisStatus: 'healthy' | 'unhealthy' | 'unknown' = 'unknown'

  if (readyRes.status === 'fulfilled') {
    const components = readyRes.value.data.components ?? {}
    dbStatus = components.database === 'healthy' ? 'healthy' : 'unhealthy'
    redisStatus = components.redis === 'healthy' ? 'healthy' : 'unhealthy'
  }

  return {
    api: apiStatus,
    database: dbStatus,
    redis: redisStatus,
    celery: 'not_monitored',
  }
}

export function useHealthStatus() {
  return useQuery<PlatformHealth>({
    queryKey: ['platform-health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    staleTime: 20_000,
    retry: 1,
  })
}
