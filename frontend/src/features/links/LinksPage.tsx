import React, { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ContentContainer } from '../../shared/components/ContentContainer'
import { PageHeader } from '../../shared/components/PageHeader'
import { ErrorState } from '../../shared/components/ErrorState'
import { LinksToolbar } from './components/LinksToolbar'
import { LinksSummaryCards } from './components/LinksSummaryCards'
import { LinksTable } from './components/LinksTable'
import { LinksSkeleton } from './components/LinksSkeleton'
import { EmptyLinksState } from './components/EmptyLinksState'
import { CreateLinkModal } from './components/CreateLinkModal'
import { EditLinkModal } from './components/EditLinkModal'
import { DeleteDialog } from './components/DeleteDialog'
import { LinkDetailsDrawer } from './components/LinkDetailsDrawer'
import { BulkActionsBar } from './components/BulkActionsBar'
import {
  useLinksQuery,
  useToggleLinkActive,
  useUpdateLink,
  useDeleteLink,
} from './hooks/useLinksQuery'
import { useToast } from '../../shared/ui/Toast'
import type { LinkRecord } from './hooks/useLinksQuery'

type FilterState = 'all' | 'active' | 'inactive'

export const LinksPage: React.FC = () => {
  const navigate = useNavigate()
  const { toast } = useToast()

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data: links, isLoading, isError, error, refetch, isFetching } = useLinksQuery()
  const { mutateAsync: toggleActive } = useToggleLinkActive()
  const { mutateAsync: updateLink } = useUpdateLink()
  const { mutateAsync: deleteLink } = useDeleteLink()

  // ── UI State ───────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterState>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [editLink, setEditLink] = useState<LinkRecord | null>(null)
  const [deleteLink_, setDeleteLink] = useState<LinkRecord | null>(null)
  const [detailLink, setDetailLink] = useState<LinkRecord | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  // ── Filtered / Searched list ───────────────────────────────────────────────
  const displayedLinks = useMemo(() => {
    const src = links ?? []
    return src.filter((l) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && l.is_active) ||
        (filter === 'inactive' && !l.is_active)

      if (!matchesFilter) return false

      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        l.short_code.toLowerCase().includes(q) ||
        (l.custom_alias?.toLowerCase().includes(q) ?? false) ||
        l.original_url.toLowerCase().includes(q) ||
        (l.title?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [links, filter, search])

  // ── Selection ──────────────────────────────────────────────────────────────
  const handleSelectId = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }, [])

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? new Set(displayedLinks.map((l) => l.id)) : new Set())
    },
    [displayedLinks]
  )

  const clearSelection = () => setSelectedIds(new Set())

  // ── Toggle active ──────────────────────────────────────────────────────────
  const handleToggleActive = async (link: LinkRecord) => {
    setTogglingId(link.id)
    try {
      await toggleActive({ id: link.id, is_active: !link.is_active })
      toast(link.is_active ? 'Link deactivated' : 'Link activated', 'success')
    } catch {
      toast('Failed to update link status', 'error')
    } finally {
      setTogglingId(null)
    }
  }

  // ── Bulk operations ────────────────────────────────────────────────────────
  const bulkOp = async (op: (id: string) => Promise<unknown>, successMsg: string) => {
    setBulkBusy(true)
    const ids = Array.from(selectedIds)
    let failed = 0
    for (const id of ids) {
      try {
        await op(id)
      } catch {
        failed++
      }
    }
    setBulkBusy(false)
    clearSelection()
    if (failed === 0) toast(successMsg, 'success')
    else toast(`${failed} operation(s) failed`, 'error')
    refetch()
  }

  const handleBulkEnable = () =>
    bulkOp((id) => updateLink({ id, payload: { is_active: true } }), 'Selected links enabled')

  const handleBulkDisable = () =>
    bulkOp((id) => updateLink({ id, payload: { is_active: false } }), 'Selected links disabled')

  const handleBulkDelete = () =>
    bulkOp((id) => deleteLink(id), 'Selected links deleted')

  // ── Auth error redirect ────────────────────────────────────────────────────
  if (isError) {
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status === 401) {
      localStorage.removeItem('linkforge:token')
      navigate('/login', { replace: true })
      return null
    }
  }

  return (
    <>
      <ContentContainer className="space-y-6">
        {/* Page header */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <PageHeader
            title="Links"
            description="Create, manage, and analyse your branded short URLs."
          />
        </motion.div>

        {/* Toolbar */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.25 }}>
          <LinksToolbar
            search={search}
            onSearchChange={(v) => { setSearch(v); setSelectedIds(new Set()) }}
            filter={filter}
            onFilterChange={(f) => { setFilter(f); setSelectedIds(new Set()) }}
            onRefresh={() => refetch()}
            onCreateClick={() => setCreateOpen(true)}
            isRefreshing={isFetching && !isLoading}
          />
        </motion.div>

        {/* Summary cards */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.25 }}>
          <LinksSummaryCards links={links} loading={isLoading} />
        </motion.div>

        {/* Bulk bar */}
        <BulkActionsBar
          selectedCount={selectedIds.size}
          onClearSelection={clearSelection}
          onBulkDelete={handleBulkDelete}
          onBulkEnable={handleBulkEnable}
          onBulkDisable={handleBulkDisable}
          isBusy={bulkBusy}
        />

        {/* Main content */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.25 }}>
          {isLoading ? (
            <LinksSkeleton />
          ) : isError ? (
            <ErrorState
              title="Failed to load links"
              message="Could not fetch your links from the server. Please retry."
              retryAction={() => refetch()}
            />
          ) : displayedLinks.length === 0 && !search && filter === 'all' ? (
            <EmptyLinksState onCreateClick={() => setCreateOpen(true)} />
          ) : displayedLinks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-brand-border py-16 text-center select-none">
              <p className="text-xs font-semibold text-brand-text-primary">No matching links</p>
              <p className="text-[11px] text-brand-text-secondary mt-1">
                Try adjusting your search or filter.
              </p>
            </div>
          ) : (
            <LinksTable
              links={displayedLinks}
              selectedIds={selectedIds}
              onSelectId={handleSelectId}
              onSelectAll={handleSelectAll}
              onEdit={(l) => { setEditLink(l); setDetailLink(null) }}
              onDelete={(l) => { setDeleteLink(l); setDetailLink(null) }}
              onToggleActive={handleToggleActive}
              onViewDetails={(l) => setDetailLink(l)}
              togglingId={togglingId}
            />
          )}
        </motion.div>
      </ContentContainer>

      {/* Modals & Drawers */}
      <CreateLinkModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditLinkModal open={editLink !== null} link={editLink} onClose={() => setEditLink(null)} />
      <DeleteDialog open={deleteLink_ !== null} link={deleteLink_} onClose={() => setDeleteLink(null)} />
      <LinkDetailsDrawer
        link={detailLink}
        onClose={() => setDetailLink(null)}
        onEdit={(l) => { setDetailLink(null); setEditLink(l) }}
      />
    </>
  )
}
