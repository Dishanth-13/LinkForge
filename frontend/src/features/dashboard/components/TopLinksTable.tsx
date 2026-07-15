import React, { useState } from 'react'
import { Skeleton } from '../../../shared/ui/Skeleton'
import { StatusBadge } from '../../../shared/ui/StatusBadge'
import { EmptyState } from '../../../shared/components/EmptyState'
import type { LinkRecord } from '../hooks/useLinks'
import { Link2, Copy, Check, ExternalLink } from 'lucide-react'
import { buildBackendUrl } from '../../../shared/lib/api'

interface CopyButtonProps {
  text: string
}

const CopyButton: React.FC<CopyButtonProps> = ({ text }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard not available — silently ignore
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded text-brand-text-secondary hover:text-brand-text-primary hover:bg-white/5 transition-all cursor-pointer"
      aria-label="Copy short URL"
    >
      {copied ? (
        <Check className="w-3 h-3 text-brand-success" />
      ) : (
        <Copy className="w-3 h-3" />
      )}
    </button>
  )
}

interface TopLinksTableProps {
  links: LinkRecord[] | undefined
  loading: boolean
}

export const TopLinksTable: React.FC<TopLinksTableProps> = ({ links, loading }) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest select-none">
          Top Links by Clicks
        </h2>
        <span className="text-[10px] text-brand-text-secondary/50 select-none">Top 5</span>
      </div>

      <div className="rounded-lg border border-brand-border overflow-hidden bg-brand-card">
        {/* Table header */}
        <div className="grid grid-cols-[2fr_3fr_1fr_1fr] gap-4 px-4 py-2.5 border-b border-brand-border bg-white/[0.02]">
          {['Short URL', 'Destination', 'Clicks', 'Status'].map((h) => (
            <span key={h} className="text-[10px] font-bold text-brand-text-secondary/50 uppercase tracking-wider select-none">
              {h}
            </span>
          ))}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col divide-y divide-brand-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[2fr_3fr_1fr_1fr] gap-4 px-4 py-3">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3.5 w-10" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && (!links || links.length === 0) && (
          <EmptyState
            title="No links created yet"
            description="Create your first shortened link to see it appear here."
            icon={<Link2 className="w-4 h-4" />}
            className="border-none rounded-none min-h-[160px]"
          />
        )}

        {/* Data rows */}
        {!loading && links && links.length > 0 && (
          <div className="flex flex-col divide-y divide-brand-border">
            {links.map((link) => {
              const shortUrl = buildBackendUrl(link.custom_alias ?? link.short_code)
              const destDisplay =
                link.original_url.length > 40
                  ? link.original_url.slice(0, 40) + '…'
                  : link.original_url

              return (
                <div
                  key={link.id}
                  className="grid grid-cols-[2fr_3fr_1fr_1fr] gap-4 px-4 py-3 items-center hover:bg-white/[0.015] transition-colors"
                >
                  {/* Short URL */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-xs text-brand-accent truncate">
                      /{link.custom_alias ?? link.short_code}
                    </span>
                    <CopyButton text={shortUrl} />
                  </div>

                  {/* Destination */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <a
                      href={link.original_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-text-secondary hover:text-brand-text-primary truncate transition-colors"
                      title={link.original_url}
                    >
                      {destDisplay}
                    </a>
                    <ExternalLink className="w-3 h-3 text-brand-text-secondary/40 shrink-0" />
                  </div>

                  {/* Clicks */}
                  <span className="font-mono text-xs font-semibold text-brand-text-primary tabular-nums">
                    {link.click_count.toLocaleString()}
                  </span>

                  {/* Status */}
                  <StatusBadge variant={link.is_active ? 'success' : 'neutral'}>
                    {link.is_active ? 'Active' : 'Inactive'}
                  </StatusBadge>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
