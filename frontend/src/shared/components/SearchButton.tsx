import React from 'react'
import { cn } from '../lib/utils'
import { Search } from 'lucide-react'

interface SearchButtonProps {
  className?: string
  onClick?: () => void
}

export const SearchButton: React.FC<SearchButtonProps> = ({ className, onClick }) => {
  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-between w-full max-w-[240px] px-3 py-1.5 rounded-md border border-brand-border bg-white/[0.02] text-brand-text-secondary hover:text-brand-text-primary hover:border-white/10 hover:bg-white/[0.04] transition-all text-xs font-medium cursor-pointer",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Search className="w-3.5 h-3.5" />
        <span>Search Workspace...</span>
      </div>
      <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-brand-border bg-brand-surface px-1.5 font-mono text-[9px] font-medium text-brand-text-secondary">
        <span>{isMac ? "⌘" : "Ctrl"}</span>K
      </kbd>
    </button>
  )
}
