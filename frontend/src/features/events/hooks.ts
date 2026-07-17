import { useQuery } from '@tanstack/react-query'
import { api } from '../../shared/lib/api'
import type { AuditEventsListResponse, AuditEventsQueryFilters } from './types'

export const EVENTS_QUERY_KEY = ['audit-events'] as const

export function useEventsQuery(filters: AuditEventsQueryFilters) {
  return useQuery<AuditEventsListResponse>({
    queryKey: [...EVENTS_QUERY_KEY, filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.limit !== undefined) params.append('limit', String(filters.limit))
      if (filters.offset !== undefined) params.append('offset', String(filters.offset))
      if (filters.event_type) params.append('event_type', filters.event_type)
      if (filters.resource_type) params.append('resource_type', filters.resource_type)
      if (filters.actor_user_id) params.append('actor_user_id', filters.actor_user_id)
      if (filters.start_date) params.append('start_date', filters.start_date)
      if (filters.end_date) params.append('end_date', filters.end_date)

      const res = await api.get<AuditEventsListResponse>(`/api/v1/events?${params.toString()}`)
      return res.data
    },
    staleTime: 5000,
  })
}

export interface UserRecord {
  id: string
  email: string
  role: string
}

export function useUsersQuery() {
  return useQuery<UserRecord[]>({
    queryKey: ['users-list'] as const,
    queryFn: async () => {
      const res = await api.get<UserRecord[]>('/api/v1/users/')
      return res.data
    },
    staleTime: 60_000,
  })
}
