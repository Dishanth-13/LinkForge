import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../shared/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LinkRecord {
  id: string
  organization_id: string
  created_by: string
  original_url: string
  short_code: string
  custom_alias: string | null
  title: string | null
  description: string | null
  is_active: boolean
  expires_at: string | null
  click_count: number
  created_at: string
  updated_at: string
}

interface LinkListResponse {
  links: LinkRecord[]
  next_cursor: string | null
}

export interface CreateLinkPayload {
  original_url: string
  custom_alias?: string
  title?: string
  description?: string
  expires_at?: string
}

export interface UpdateLinkPayload {
  title?: string
  description?: string
  expires_at?: string | null
  is_active?: boolean
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const LINKS_QUERY_KEY = ['links-page'] as const

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchAllLinks(): Promise<LinkRecord[]> {
  // Fetch enough links for the management view — paginate in batches of 100
  const allLinks: LinkRecord[] = []
  let cursor: string | null = null

  do {
    const params: Record<string, string | number> = { limit: 100 }
    if (cursor) params.cursor = cursor

    const res = await api.get<LinkListResponse>('/api/v1/links/', { params })
    allLinks.push(...res.data.links)
    cursor = res.data.next_cursor
  } while (cursor)

  return allLinks
}

// ─── Query Hook ───────────────────────────────────────────────────────────────

export function useLinksQuery() {
  return useQuery<LinkRecord[]>({
    queryKey: LINKS_QUERY_KEY,
    queryFn: fetchAllLinks,
    staleTime: 30_000,
    retry: 1,
  })
}

// ─── Create Mutation ──────────────────────────────────────────────────────────

export function useCreateLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateLinkPayload) =>
      api.post<LinkRecord>('/api/v1/links/', payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LINKS_QUERY_KEY })
    },
  })
}

// ─── Update Mutation ──────────────────────────────────────────────────────────

export function useUpdateLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateLinkPayload }) =>
      api.patch<LinkRecord>(`/api/v1/links/${id}`, payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LINKS_QUERY_KEY })
    },
  })
}

// ─── Delete Mutation ──────────────────────────────────────────────────────────

export function useDeleteLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/v1/links/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LINKS_QUERY_KEY })
    },
  })
}

// ─── Toggle Active Mutation (shortcut for PATCH is_active) ───────────────────

export function useToggleLinkActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch<LinkRecord>(`/api/v1/links/${id}`, { is_active }).then((r) => r.data),
    // Optimistic update — flip the badge immediately without waiting for server
    onMutate: async ({ id, is_active }) => {
      await qc.cancelQueries({ queryKey: LINKS_QUERY_KEY })
      const previous = qc.getQueryData<LinkRecord[]>(LINKS_QUERY_KEY)
      qc.setQueryData<LinkRecord[]>(LINKS_QUERY_KEY, (old) =>
        old?.map((l) => (l.id === id ? { ...l, is_active } : l)) ?? []
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(LINKS_QUERY_KEY, ctx.previous)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: LINKS_QUERY_KEY })
    },
  })
}
