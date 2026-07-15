import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, CheckCircle2, XCircle, X } from 'lucide-react'
import { LoadingSpinner } from '../../../shared/ui/LoadingSpinner'

interface BulkActionsBarProps {
  selectedCount: number
  onClearSelection: () => void
  onBulkDelete: () => void
  onBulkEnable: () => void
  onBulkDisable: () => void
  isBusy: boolean
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  onClearSelection,
  onBulkDelete,
  onBulkEnable,
  onBulkDisable,
  isBusy,
}) => {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-brand-accent/20 bg-brand-accent/5"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-brand-accent">
            <div className="w-5 h-5 rounded flex items-center justify-center bg-brand-accent/20 font-mono font-bold text-[11px]">
              {selectedCount}
            </div>
            {selectedCount === 1 ? 'link' : 'links'} selected
          </div>

          <div className="h-4 w-px bg-brand-border mx-1" />

          <div className="flex items-center gap-1.5">
            <button
              onClick={onBulkEnable}
              disabled={isBusy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-brand-success hover:bg-brand-success/10 border border-transparent hover:border-brand-success/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isBusy ? <LoadingSpinner size="sm" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Enable
            </button>
            <button
              onClick={onBulkDisable}
              disabled={isBusy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-brand-text-secondary hover:bg-white/5 border border-transparent hover:border-brand-border transition-all cursor-pointer disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" />
              Disable
            </button>
            <button
              onClick={onBulkDelete}
              disabled={isBusy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-brand-danger hover:bg-brand-danger/10 border border-transparent hover:border-brand-danger/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>

          <div className="flex-1" />

          <button
            onClick={onClearSelection}
            className="p-1 text-brand-text-secondary hover:text-brand-text-primary transition-colors cursor-pointer"
            aria-label="Clear selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
