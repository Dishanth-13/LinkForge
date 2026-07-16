export type ApiKeyPermission = 'READ_LINKS' | 'CREATE_LINKS' | 'UPDATE_LINKS' | 'DELETE_LINKS' | 'READ_ANALYTICS'

export interface ApiKeyRecord {
  id: string
  organization_id: string
  name: string
  environment: 'production' | 'testing'
  key_prefix: string
  permissions: ApiKeyPermission[]
  created_by: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export interface CreateApiKeyPayload {
  name: string
  environment: 'production' | 'testing'
  permissions: ApiKeyPermission[]
}

export interface CreatedApiKeyResponse extends ApiKeyRecord {
  plain_text_key: string
}
