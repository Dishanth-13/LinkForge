import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ExternalLink, Calendar, MousePointerClick, Hash, Link2 } from 'lucide-react'
import { StatusBadge } from '../../../shared/ui/StatusBadge'
import { CopyButton } from '../../../shared/ui/CopyButton'
import type { LinkRecord } from '../hooks/useLinksQuery'
import { buildBackendUrl } from '../../../shared/lib/api'

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

interface DrawerRowProps {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}

const DrawerRow: React.FC<DrawerRowProps> = ({ icon, label, children }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-text-secondary/50">
      {icon}
      {label}
    </div>
    <div className="text-xs text-brand-text-primary break-words">{children}</div>
  </div>
)

interface LinkDetailsDrawerProps {
  link: LinkRecord | null
  onClose: () => void
  onEdit: (link: LinkRecord) => void
}

export const LinkDetailsDrawer: React.FC<LinkDetailsDrawerProps> = ({ link, onClose, onEdit }) => {
  const isOpen = link !== null
  const shortPath = link ? (link.custom_alias ?? link.short_code) : ''
  const shortUrl = shortPath ? buildBackendUrl(shortPath) : ''

  return (
    <AnimatePresence>
      {isOpen && link && (
        <>
          {/* Backdrop */}
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            key="drawer-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-sm bg-brand-surface border-l border-brand-border shadow-2xl shadow-black/60 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border shrink-0">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-brand-text-primary">Link Details</span>
                <span className="font-mono text-[11px] text-brand-accent">
                  /{link.custom_alias ?? link.short_code}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEdit(link)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium border border-brand-border text-brand-text-secondary hover:text-brand-text-primary hover:bg-white/5 transition-all cursor-pointer"
                >
                  Edit
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-md text-brand-text-secondary hover:text-brand-text-primary hover:bg-white/5 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
              {/* Status */}
              <div className="flex items-center justify-between">
                <StatusBadge variant={link.is_active ? 'success' : 'neutral'}>
                  {link.is_active ? 'Active' : 'Inactive'}
                </StatusBadge>
                <span className="text-[10px] text-brand-text-secondary/50 font-mono">
                  ID: {link.id}
                </span>
              </div>

              {/* Short URL */}
              <DrawerRow icon={<Link2 className="w-3 h-3" />} label="Short URL">
                <div className="flex items-center gap-2 font-mono text-brand-accent">
                  <span className="break-all">{shortUrl}</span>
                  <CopyButton text={shortUrl} />
                  <a
                    href={shortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-text-secondary hover:text-brand-text-primary transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </DrawerRow>

              {/* Destination */}
              <DrawerRow icon={<ExternalLink className="w-3 h-3" />} label="Destination">
                <a
                  href={link.original_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-text-secondary hover:text-brand-accent transition-colors break-all"
                >
                  {link.original_url}
                </a>
              </DrawerRow>

              {/* Redirects */}
              <DrawerRow icon={<MousePointerClick className="w-3 h-3" />} label="Total Redirects">
                <span className="font-mono text-xl font-bold text-brand-text-primary">
                  {link.click_count.toLocaleString()}
                </span>
              </DrawerRow>

              {/* Title / Description */}
              {link.title && (
                <DrawerRow icon={<Hash className="w-3 h-3" />} label="Title">
                  {link.title}
                </DrawerRow>
              )}
              {link.description && (
                <DrawerRow icon={<Hash className="w-3 h-3" />} label="Description">
                  <span className="text-brand-text-secondary">{link.description}</span>
                </DrawerRow>
              )}

              {/* Dates */}
              <div className="border-t border-brand-border pt-4 flex flex-col gap-4">
                <DrawerRow icon={<Calendar className="w-3 h-3" />} label="Created">
                  <span className="text-brand-text-secondary">{fmtDateTime(link.created_at)}</span>
                </DrawerRow>
                {link.expires_at && (
                  <DrawerRow icon={<Calendar className="w-3 h-3" />} label="Expires">
                    <span className={new Date(link.expires_at) < new Date() ? 'text-brand-danger' : 'text-brand-warning'}>
                      {fmtDateTime(link.expires_at)}
                    </span>
                  </DrawerRow>
                )}
                <DrawerRow icon={<Calendar className="w-3 h-3" />} label="Last Updated">
                  <span className="text-brand-text-secondary">{fmtDateTime(link.updated_at)}</span>
                </DrawerRow>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
