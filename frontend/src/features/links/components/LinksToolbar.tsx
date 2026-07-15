import React from 'react'
import { Search, Plus, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { cn } from '../../../shared/lib/utils'

interface LinksToolbarProps {
  search: string
  onSearchChange: (v: string) => void
  filter: 'all' | 'active' | 'inactive'
  onFilterChange: (f: 'all' | 'active' | 'inactive') => void
  onRefresh: () => void
  onCreateClick: () => void
  isRefreshing: boolean
}

const FILTERS: { label: string; value: 'all' | 'active' | 'inactive' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
]

export const LinksToolbar: React.FC<LinksToolbarProps> = ({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  onRefresh,
  onCreateClick,
  isRefreshing,
}) => {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Left — Search + Filter */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-text-secondary pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search links…"
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-brand-card border border-brand-border rounded-md text-brand-text-primary placeholder:text-brand-text-secondary/50 focus:outline-none focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/20 transition-all"
          />
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-0.5 bg-brand-card border border-brand-border rounded-md p-0.5 shrink-0">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              className={cn(
                'px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer select-none',
                filter === f.value
                  ? 'bg-white/10 text-brand-text-primary'
                  : 'text-brand-text-secondary hover:text-brand-text-primary'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="hidden sm:flex items-center gap-1 text-[10px] text-brand-text-secondary/50 select-none">
          <SlidersHorizontal className="w-3 h-3" />
        </div>
      </div>

      {/* Right — Refresh + Create */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center justify-center w-7 h-7 rounded-md border border-brand-border bg-brand-card text-brand-text-secondary hover:text-brand-text-primary hover:border-white/10 transition-all cursor-pointer disabled:opacity-50"
          aria-label="Refresh links"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
        </button>
        <button
          onClick={onCreateClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-accent hover:bg-brand-accent/90 text-white text-xs font-semibold shadow-sm shadow-brand-accent/20 hover:shadow-md hover:shadow-brand-accent/30 transition-all cursor-pointer select-none"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Link
        </button>
      </div>
    </div>
  )
}
