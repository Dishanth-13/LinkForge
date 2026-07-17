export interface Actor {
  id: string
  email: string
  role: string
}

export interface AuditEventRecord {
  id: string
  timestamp: string
  event_type: string
  resource_type: string | null
  resource_id: string | null
  actor: Actor | null
  metadata_json: Record<string, any> | null
  human_readable_message: string
}

export interface AuditEventsListResponse {
  events: AuditEventRecord[]
  total_count: number
}

export interface AuditEventsQueryFilters {
  limit?: number
  offset?: number
  event_type?: string
  resource_type?: string
  actor_user_id?: string
  start_date?: string
  end_date?: string
}
