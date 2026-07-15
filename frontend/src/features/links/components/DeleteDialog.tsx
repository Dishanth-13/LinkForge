import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, AlertTriangle } from 'lucide-react'
import { LoadingSpinner } from '../../../shared/ui/LoadingSpinner'
import { useDeleteLink } from '../hooks/useLinksQuery'
import { useToast } from '../../../shared/ui/Toast'
import type { LinkRecord } from '../hooks/useLinksQuery'
import { isApiError, getApiErrorDetail } from '../../../shared/lib/api'

interface DeleteDialogProps {
  open: boolean
  link: LinkRecord | null
  onClose: () => void
}

export const DeleteDialog: React.FC<DeleteDialogProps> = ({ open, link, onClose }) => {
  const { toast } = useToast()
  const { mutateAsync: deleteLink, isPending } = useDeleteLink()

  const handleDelete = async () => {
    if (!link) return
    try {
      await deleteLink(link.id)
      toast(`Deleted /${link.custom_alias ?? link.short_code}`, 'success')
      onClose()
    } catch (err: unknown) {
      if (isApiError(err)) {
        toast(getApiErrorDetail(err, 'Failed to delete link.'), 'error')
      } else {
        toast('An unexpected error occurred.', 'error')
      }
    }
  }

  return (
    <AnimatePresence>
      {open && link && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            key="del-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            key="del-panel"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-sm rounded-xl bg-brand-surface border border-brand-border shadow-2xl shadow-black/60 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon */}
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-brand-danger/10 border border-brand-danger/20 text-brand-danger mx-auto mb-4">
              <Trash2 className="w-5 h-5" />
            </div>

            <h2 className="text-sm font-bold text-brand-text-primary text-center mb-1">
              Delete link?
            </h2>
            <p className="text-xs text-brand-text-secondary text-center mb-5">
              This will soft-delete{' '}
              <span className="font-mono text-brand-accent">
                /{link.custom_alias ?? link.short_code}
              </span>{' '}
              and it will stop resolving immediately.
            </p>

            {/* Info row */}
            <div className="rounded-md bg-white/[0.02] border border-brand-border p-3 mb-5 flex flex-col gap-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-brand-text-secondary">Destination</span>
                <span className="text-brand-text-primary truncate max-w-[180px] text-right">
                  {link.original_url}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-brand-text-secondary">Redirect count</span>
                <span className="font-mono font-semibold text-brand-text-primary">
                  {link.click_count.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 text-[11px] text-brand-warning mb-5 bg-brand-warning/5 border border-brand-warning/20 rounded-md p-2.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              This action cannot be reversed through the UI.
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-1.5 rounded-md text-xs font-medium text-brand-text-secondary hover:text-brand-text-primary border border-brand-border hover:bg-white/5 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md bg-brand-danger hover:bg-brand-danger/90 text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isPending ? <><LoadingSpinner size="sm" />Deleting…</> : 'Delete Link'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
