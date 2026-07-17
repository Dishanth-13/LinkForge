import React, { useState } from 'react'
import { PageHeader } from '../../shared/components/PageHeader'
import { ContentContainer } from '../../shared/components/ContentContainer'
import { 
  Link as LinkIcon, 
  Trash2, 
  Play, 
  Square, 
  RefreshCw, 
  Key, 
  LogIn, 
  LogOut, 
  UserPlus, 
  Activity, 
  Search, 
  Calendar, 
  User as UserIcon,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react'
import { useEventsQuery, useUsersQuery } from './hooks'

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  return `${diffDays}d ago`
}

export const EventsPage: React.FC = () => {
  // Filters State
  const [limit] = useState(20)
  const [page, setPage] = useState(1)
  const [resourceType, setResourceType] = useState<string>('')
  const [actorUserId, setActorUserId] = useState<string>('')
  const [dateRange, setDateRange] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({})

  // Date Filters Calculations
  const getStartDate = () => {
    if (dateRange === 'all') return undefined
    const now = new Date()
    if (dateRange === '24h') {
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    }
    if (dateRange === '7d') {
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    }
    if (dateRange === '30d') {
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    }
    return undefined
  }

  const offset = (page - 1) * limit
  const startDate = getStartDate()

  const { data, isLoading, isError, refetch } = useEventsQuery({
    limit,
    offset,
    resource_type: resourceType || undefined,
    actor_user_id: actorUserId || undefined,
    start_date: startDate,
  })

  const { data: users } = useUsersQuery()

  // Helper: toggle collapse metadata json
  const toggleExpand = (id: string) => {
    setExpandedEvents(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  // Helper: Event Category Icons & Colors
  const getEventStyle = (type: string) => {
    switch (type) {
      case 'link.created':
        return {
          icon: <LinkIcon className="w-4 h-4 text-emerald-400" />,
          bg: 'bg-emerald-500/10 border border-emerald-500/20'
        }
      case 'link.deleted':
        return {
          icon: <Trash2 className="w-4 h-4 text-rose-400" />,
          bg: 'bg-rose-500/10 border border-rose-500/20'
        }
      case 'link.activated':
        return {
          icon: <Play className="w-4 h-4 text-teal-400" />,
          bg: 'bg-teal-500/10 border border-teal-500/20'
        }
      case 'link.deactivated':
        return {
          icon: <Square className="w-4 h-4 text-amber-400" />,
          bg: 'bg-amber-500/10 border border-amber-500/20'
        }
      case 'link.updated':
        return {
          icon: <LinkIcon className="w-4 h-4 text-blue-400" />,
          bg: 'bg-blue-500/10 border border-blue-500/20'
        }
      case 'api_key.created':
        return {
          icon: <Key className="w-4 h-4 text-indigo-400" />,
          bg: 'bg-indigo-500/10 border border-indigo-500/20'
        }
      case 'api_key.revoked':
        return {
          icon: <Trash2 className="w-4 h-4 text-red-400" />,
          bg: 'bg-red-500/10 border border-red-500/20'
        }
      case 'api_key.regenerated':
        return {
          icon: <RefreshCw className="w-4 h-4 text-sky-400" />,
          bg: 'bg-sky-500/10 border border-sky-500/20'
        }
      case 'user.login':
        return {
          icon: <LogIn className="w-4 h-4 text-purple-400" />,
          bg: 'bg-purple-500/10 border border-purple-500/20'
        }
      case 'user.logout':
        return {
          icon: <LogOut className="w-4 h-4 text-zinc-400" />,
          bg: 'bg-zinc-500/10 border border-zinc-500/20'
        }
      case 'user.registered':
      case 'user.created':
        return {
          icon: <UserPlus className="w-4 h-4 text-fuchsia-400" />,
          bg: 'bg-fuchsia-500/10 border border-fuchsia-500/20'
        }
      default:
        return {
          icon: <Activity className="w-4 h-4 text-brand-text-secondary" />,
          bg: 'bg-zinc-800 border border-zinc-700'
        }
    }
  }

  // Filter events client-side by dynamic search query (message matching)
  const filteredEvents = data?.events.filter(event => {
    if (!searchQuery) return true
    return (
      event.human_readable_message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.event_type.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }) || []

  const totalPages = Math.ceil((data?.total_count || 0) / limit)

  return (
    <ContentContainer>
      <PageHeader
        title="Security & Audit Events"
        description="Administrative activity logs across organizations, links, settings, and credentials."
      />

      {/* Toolbar / Filters Panel */}
      <div className="p-4 bg-brand-card/30 border border-brand-border/40 rounded-xl mb-6 shadow-sm backdrop-blur-md">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
          {/* Search bar */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
            <input
              type="text"
              placeholder="Search event messages..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              className="w-full pl-10 pr-4 py-2 text-sm bg-brand-bg/50 border border-brand-border/50 rounded-lg text-brand-text focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all"
            />
          </div>

          {/* Event Type Filter */}
          <div className="relative">
            <Activity className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
            <select
              value={resourceType}
              onChange={e => {
                setResourceType(e.target.value)
                setPage(1)
              }}
              className="w-full pl-10 pr-8 py-2 text-sm bg-brand-bg/50 border border-brand-border/50 rounded-lg text-brand-text focus:outline-none focus:border-brand-accent transition-all appearance-none cursor-pointer"
            >
              <option value="">All Resource Types</option>
              <option value="link">Links</option>
              <option value="api_key">API Keys</option>
              <option value="user">Users</option>
              <option value="organization">Organizations</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted pointer-events-none" />
          </div>

          {/* Actor Filter */}
          <div className="relative">
            <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
            <select
              value={actorUserId}
              onChange={e => {
                setActorUserId(e.target.value)
                setPage(1)
              }}
              className="w-full pl-10 pr-8 py-2 text-sm bg-brand-bg/50 border border-brand-border/50 rounded-lg text-brand-text focus:outline-none focus:border-brand-accent transition-all appearance-none cursor-pointer"
            >
              <option value="">All Actors</option>
              {users?.map(user => (
                <option key={user.id} value={user.id}>
                  {user.email}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted pointer-events-none" />
          </div>

          {/* Date presets */}
          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
            <select
              value={dateRange}
              onChange={e => {
                setDateRange(e.target.value)
                setPage(1)
              }}
              className="w-full pl-10 pr-8 py-2 text-sm bg-brand-bg/50 border border-brand-border/50 rounded-lg text-brand-text focus:outline-none focus:border-brand-accent transition-all appearance-none cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-4 p-4 border border-brand-border/30 rounded-xl bg-brand-card/10 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 bg-zinc-800 rounded w-1/3" />
                <div className="h-3 bg-zinc-800 rounded w-2/3" />
              </div>
              <div className="w-20 h-4 bg-zinc-800 rounded shrink-0 self-start mt-1" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center p-12 bg-rose-500/5 border border-rose-500/10 rounded-xl text-center">
          <AlertCircle className="w-8 h-8 text-rose-400 mb-3" />
          <h3 className="text-base font-semibold text-brand-text mb-1">Failed to fetch events</h3>
          <p className="text-sm text-brand-text-secondary mb-4">An error occurred while loading audit events from the server.</p>
          <button 
            onClick={() => refetch()}
            className="px-4 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all"
          >
            Retry Call
          </button>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-brand-card/20 border border-brand-border/30 rounded-2xl text-center">
          <Activity className="w-10 h-10 text-brand-text-muted mb-4 stroke-1" />
          <h3 className="text-base font-semibold text-brand-text mb-1">No administrative events found</h3>
          <p className="text-sm text-brand-text-secondary max-w-sm">
            Try adjusting your search query or dropdown filters to find matching activity logs.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5 relative before:absolute before:left-[34px] before:top-2 before:bottom-2 before:w-[1px] before:bg-brand-border/40">
          {filteredEvents.map(event => {
            const style = getEventStyle(event.event_type)
            const timeAgo = formatTimeAgo(event.timestamp)
            const exactTime = new Date(event.timestamp).toLocaleString()
            const isExpanded = !!expandedEvents[event.id]
            const hasMetadata = event.metadata_json && Object.keys(event.metadata_json).length > 0

            return (
              <div 
                key={event.id}
                className="relative flex gap-4 p-4 border border-brand-border/20 hover:border-brand-border/45 bg-brand-card/10 hover:bg-brand-card/15 rounded-xl shadow-sm hover:shadow-md transition-all backdrop-blur-md"
              >
                {/* Timeline node icon */}
                <div className={`w-9 h-9 rounded-full ${style.bg} flex items-center justify-center shrink-0 z-10 shadow-inner`}>
                  {style.icon}
                </div>

                {/* Event core metadata */}
                <div className="flex-1 space-y-1 text-sm self-center">
                  <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                    <span className="font-medium text-brand-text">
                      {event.human_readable_message}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-brand-bg/60 border border-brand-border/50 text-brand-text-secondary font-mono">
                      {event.event_type}
                    </span>
                  </div>
                  
                  {/* Collapsible metadata accordion */}
                  {hasMetadata && (
                    <div className="pt-1.5">
                      <button 
                        onClick={() => toggleExpand(event.id)}
                        className="flex items-center gap-1 text-brand-text-muted hover:text-brand-accent text-xs font-medium cursor-pointer transition-all focus:outline-none"
                      >
                        <span>{isExpanded ? 'Hide parameters' : 'View parameters'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                      
                      {isExpanded && (
                        <pre className="mt-2 p-3 text-xs bg-brand-bg/90 border border-brand-border/40 rounded-lg text-brand-accent font-mono overflow-x-auto shadow-inner">
                          {JSON.stringify(event.metadata_json, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>

                {/* Time Indicator */}
                <div className="text-right shrink-0 mt-0.5 z-10">
                  <span 
                    title={exactTime} 
                    className="text-xs text-brand-text-secondary cursor-help hover:text-brand-text hover:underline underline-offset-2 transition-all"
                  >
                    {timeAgo}
                  </span>
                </div>
              </div>
            )
          })}

          {/* Pagination bar controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border border-brand-border/30 rounded-xl bg-brand-card/10 mt-6 backdrop-blur-md">
              <span className="text-xs text-brand-text-secondary">
                Page {page} of {totalPages} ({data?.total_count || 0} total logs)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3.5 py-1.5 rounded-lg border border-brand-border/50 text-xs font-semibold text-brand-text hover:bg-brand-bg/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3.5 py-1.5 rounded-lg border border-brand-border/50 text-xs font-semibold text-brand-text hover:bg-brand-bg/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </ContentContainer>
  )
}
