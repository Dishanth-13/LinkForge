import { useQuery } from '@tanstack/react-query'
import { api } from '../../../shared/lib/api'

export interface LinkRecord {
  id: string
  short_code: string
  custom_alias: string | null
  original_url: string
  title: string | null
  is_active: boolean
  click_count: number
  created_at: string
  expires_at: string | null
}

interface LinkListResponse {
  links: LinkRecord[]
  next_cursor: string | null
}

export interface LinksDerivedData {
  activeLinksCount: number
  totalRedirects: number
  topLinks: LinkRecord[]
  allLinks: LinkRecord[]
}

async function fetchLinks(): Promise<LinksDerivedData> {
  // Fetch active links (up to 100) — enough to derive meaningful KPIs
  const res = await api.get<LinkListResponse>('/api/v1/links/', {
    params: { limit: 100 },
  })

  const all = res.data.links
  const activeLinks = all.filter((l) => l.is_active)
  const totalRedirects = all.reduce((sum, l) => sum + l.click_count, 0)

  // Top 5 by click_count descending
  const topLinks = [...all]
    .sort((a, b) => b.click_count - a.click_count)
    .slice(0, 5)

  return {
    activeLinksCount: activeLinks.length,
    totalRedirects,
    topLinks,
    allLinks: all,
  }
}

export function useLinks() {
  return useQuery<LinksDerivedData>({
    queryKey: ['dashboard-links'],
    queryFn: fetchLinks,
    staleTime: 60_000,
    retry: 1,
  })
}
