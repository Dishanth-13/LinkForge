import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../shared/lib/api'
import type { ApiKeyRecord, CreatedApiKeyResponse, CreateApiKeyPayload } from '../types'

export const API_KEYS_QUERY_KEY = ['api-keys'] as const

export function useApiKeysQuery() {
  return useQuery<ApiKeyRecord[]>({
    queryKey: API_KEYS_QUERY_KEY,
    queryFn: async () => {
      const res = await api.get<ApiKeyRecord[]>('/api/v1/api-keys')
      return res.data
    },
    staleTime: 30_000,
  })
}

export function useCreateApiKeyMutation() {
  const qc = useQueryClient()
  return useMutation<CreatedApiKeyResponse, Error, CreateApiKeyPayload>({
    mutationFn: async (payload) => {
      const res = await api.post<CreatedApiKeyResponse>('/api/v1/api-keys', payload)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY })
    },
  })
}

export function useRevokeApiKeyMutation() {
  const qc = useQueryClient()
  return useMutation<ApiKeyRecord, Error, string>({
    mutationFn: async (id) => {
      const res = await api.delete<ApiKeyRecord>(`/api/v1/api-keys/${id}`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY })
    },
  })
}

export function useRegenerateApiKeyMutation() {
  const qc = useQueryClient()
  return useMutation<CreatedApiKeyResponse, Error, string>({
    mutationFn: async (id) => {
      const res = await api.post<CreatedApiKeyResponse>(`/api/v1/api-keys/${id}/regenerate`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY })
    },
  })
}
