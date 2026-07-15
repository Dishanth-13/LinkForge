import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronUp, ChevronDown, ExternalLink,
  MoreHorizontal, ToggleLeft, ToggleRight, Eye, Pencil, Trash2
} from 'lucide-react'
import { StatusBadge } from '../../../shared/ui/StatusBadge'
import { CopyButton } from '../../../shared/ui/CopyButton'
import { cn } from '../../../shared/lib/utils'
import type { LinkRecord } from '../hooks/useLinksQuery'
import { buildBackendUrl } from '../../../shared/lib/api'

// Lightweight date formatter — avoids adding date-fns dependency
const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}


// ─── Types ────────────────────────────────────────────────────────────────────

type SortField = 'short_code' | 'original_url' | 'title' | 'click_count' | 'created_at' | 'is_active'
type SortDir = 'asc' | 'desc'

interface LinksTableProps {
  links: LinkRecord[]
  selectedIds: Set<string>
  onSelectId: (id: string, checked: boolean) => void
  onSelectAll: (checked: boolean) => void
  onEdit: (link: LinkRecord) => void
  onDelete: (link: LinkRecord) => void
  onToggleActive: (link: LinkRecord) => void
  onViewDetails: (link: LinkRecord) => void
  togglingId: string | null
}

// ─── Column header ────────────────────────────────────────────────────────────

interface ColHeaderProps {
  label: string
  field?: SortField
  sort: { field: SortField; dir: SortDir }
  onSort: (field: SortField) => void
  className?: string
}

const ColHeader: React.FC<ColHeaderProps> = ({ label, field, sort, onSort, className }) => (
  <th
    className={cn(
      'px-4 py-3 text-left text-[10px] font-bold text-brand-text-secondary/60 uppercase tracking-wider select-none',
      field && 'cursor-pointer hover:text-brand-text-secondary transition-colors',
      className
    )}
    onClick={() => field && onSort(field)}
  >
    <span className="flex items-center gap-1">
      {label}
      {field && sort.field === field && (
        sort.dir === 'asc'
          ? <ChevronUp className="w-3 h-3" />
          : <ChevronDown className="w-3 h-3" />
      )}
    </span>
  </th>
)

// ─── Action menu ──────────────────────────────────────────────────────────────

interface ActionMenuProps {
  link: LinkRecord
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onView: () => void
  isToggling: boolean
}

const ActionMenu: React.FC<ActionMenuProps> = ({ link, onEdit, onDelete, onToggle, onView, isToggling }) => {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 rounded text-brand-text-secondary hover:text-brand-text-primary hover:bg-white/5 transition-colors cursor-pointer"
        aria-label="Actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-brand-border bg-brand-surface shadow-xl shadow-black/50 py-1 overflow-hidden"
            >
              {[
                { icon: <Eye className="w-3.5 h-3.5" />, label: 'View Details', action: () => { onView(); setOpen(false) } },
                { icon: <Pencil className="w-3.5 h-3.5" />, label: 'Edit', action: () => { onEdit(); setOpen(false) } },
                {
                  icon: link.is_active
                    ? <ToggleLeft className="w-3.5 h-3.5" />
                    : <ToggleRight className="w-3.5 h-3.5 text-brand-success" />,
                  label: link.is_active ? 'Deactivate' : 'Activate',
                  action: () => { onToggle(); setOpen(false) },
                  disabled: isToggling,
                },
                { icon: <Trash2 className="w-3.5 h-3.5 text-brand-danger" />, label: 'Delete', action: () => { onDelete(); setOpen(false) }, danger: true },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  disabled={item.disabled}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50',
                    item.danger
                      ? 'text-brand-danger hover:bg-brand-danger/10'
                      : 'text-brand-text-secondary hover:text-brand-text-primary hover:bg-white/5'
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Table ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 15

export const LinksTable: React.FC<LinksTableProps> = ({
  links,
  selectedIds,
  onSelectId,
  onSelectAll,
  onEdit,
  onDelete,
  onToggleActive,
  onViewDetails,
  togglingId,
}) => {
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({
    field: 'created_at',
    dir: 'desc',
  })
  const [page, setPage] = useState(1)

  const handleSort = (field: SortField) => {
    setSort((prev) =>
      prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' }
    )
    setPage(1)
  }

  const sorted = useMemo(() => {
    return [...links].sort((a, b) => {
      const va = a[sort.field]
      const vb = b[sort.field]
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va ?? '').localeCompare(String(vb ?? ''))
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [links, sort])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageLinks = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const allOnPageSelected = pageLinks.length > 0 && pageLinks.every((l) => selectedIds.has(l.id))

  const colProps = { sort, onSort: handleSort }

  return (
    <div className="flex flex-col gap-3">
      {/* Table */}
      <div className="rounded-lg border border-brand-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-brand-border bg-white/[0.015]">
                {/* Select all */}
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={(e) => onSelectAll(e.target.checked)}
                    className="w-3.5 h-3.5 accent-brand-accent cursor-pointer"
                  />
                </th>
                <ColHeader label="Short Link" field="short_code" {...colProps} />
                <ColHeader label="Destination" field="original_url" {...colProps} />
                <ColHeader label="Title" field="title" {...colProps} />
                <ColHeader label="Status" field="is_active" {...colProps} />
                <ColHeader label="Clicks" field="click_count" {...colProps} className="text-right" />
                <ColHeader label="Created" field="created_at" {...colProps} />
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {pageLinks.map((link, i) => {
                  const shortPath = link.custom_alias ?? link.short_code
                  const shortUrl = buildBackendUrl(shortPath)
                  const isSelected = selectedIds.has(link.id)

                  return (
                    <motion.tr
                      key={link.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.02, duration: 0.15 }}
                      onClick={() => onViewDetails(link)}
                      className={cn(
                        'border-b border-brand-border last:border-0 transition-colors cursor-pointer',
                        isSelected ? 'bg-brand-accent/5' : 'hover:bg-white/[0.018]'
                      )}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => onSelectId(link.id, e.target.checked)}
                          className="w-3.5 h-3.5 accent-brand-accent cursor-pointer"
                        />
                      </td>

                      {/* Short Link */}
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold text-brand-accent">
                            /{shortPath}
                          </span>
                          <CopyButton text={shortUrl} />
                          <a
                            href={shortUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-text-secondary hover:text-brand-text-primary transition-colors"
                            title="Open short URL"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </td>

                      {/* Destination */}
                      <td className="px-4 py-3.5 max-w-[240px]">
                        <span
                          className="text-xs text-brand-text-secondary truncate block"
                          title={link.original_url}
                        >
                          {link.original_url}
                        </span>
                      </td>

                      {/* Title */}
                      <td className="px-4 py-3.5 max-w-[180px]">
                        <span className="text-xs text-brand-text-primary truncate block">
                          {link.title ?? <span className="text-brand-text-secondary/40 italic">—</span>}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onToggleActive(link)}
                          disabled={togglingId === link.id}
                          className="cursor-pointer disabled:opacity-60"
                          title={link.is_active ? 'Click to deactivate' : 'Click to activate'}
                        >
                          <StatusBadge variant={link.is_active ? 'success' : 'neutral'}>
                            {togglingId === link.id ? '…' : link.is_active ? 'Active' : 'Inactive'}
                          </StatusBadge>
                        </button>
                      </td>

                      {/* Clicks */}
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-mono text-xs font-semibold text-brand-text-primary tabular-nums">
                          {link.click_count.toLocaleString()}
                        </span>
                      </td>

                      {/* Created */}
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-brand-text-secondary">
                          {fmtDate(link.created_at)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <ActionMenu
                          link={link}
                          onEdit={() => onEdit(link)}
                          onDelete={() => onDelete(link)}
                          onToggle={() => onToggleActive(link)}
                          onView={() => onViewDetails(link)}
                          isToggling={togglingId === link.id}
                        />
                      </td>
                    </motion.tr>
                  )
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-brand-text-secondary select-none">
          <span>{sorted.length} links · Page {page} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 rounded border border-brand-border bg-brand-card hover:bg-white/5 disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pg = page <= 3 ? i + 1 : page - 2 + i
              if (pg > totalPages) return null
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={cn(
                    'w-7 h-7 rounded border text-[11px] font-medium transition-colors cursor-pointer',
                    pg === page
                      ? 'border-brand-accent bg-brand-accent/10 text-brand-accent'
                      : 'border-brand-border bg-brand-card hover:bg-white/5 text-brand-text-secondary'
                  )}
                >
                  {pg}
                </button>
              )
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1 rounded border border-brand-border bg-brand-card hover:bg-white/5 disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
