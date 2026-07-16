import React from 'react'
import { Dialog } from '../../../shared/ui/Dialog'
import { CopyButton } from '../../../shared/ui/CopyButton'
import { AlertCircle } from 'lucide-react'
import type { CreatedApiKeyResponse } from '../types'

interface RevealApiKeyDialogProps {
  open: boolean
  onClose: () => void
  keyData: CreatedApiKeyResponse | null
}

export const RevealApiKeyDialog: React.FC<RevealApiKeyDialogProps> = ({
  open,
  onClose,
  keyData,
}) => {
  if (!keyData) return null

  return (
    <Dialog open={open} onClose={onClose} title="API Key Generated" size="md">
      <div className="space-y-4">
        {/* Warning card */}
        <div className="flex items-start gap-3 p-3.5 rounded-lg border border-brand-warning/20 bg-brand-warning/5 text-brand-warning/90">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5 text-xs select-none">
            <span className="font-bold">Save this key somewhere secure</span>
            <span className="opacity-80">
              For security, this key will only be shown once. You will not be able to retrieve it again.
            </span>
          </div>
        </div>

        {/* The Key box */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-brand-text-secondary uppercase tracking-wider select-none">
            API Key
          </label>
          <div className="flex items-center justify-between gap-3 px-3 py-2 border border-brand-border bg-brand-card/50 rounded-lg font-mono text-xs text-brand-text-primary select-all break-all">
            <span>{keyData.plain_text_key}</span>
            <CopyButton
              text={keyData.plain_text_key}
              label="Copy"
              className="px-2.5 py-1 rounded bg-white/5 border border-brand-border text-brand-text-secondary hover:text-brand-text-primary text-[10px] font-medium transition-all shadow-sm shrink-0"
            />
          </div>
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-md bg-brand-accent hover:bg-brand-accent/90 text-white transition-all shadow-md shadow-brand-accent/25 hover:shadow-lg cursor-pointer"
          >
            I've copied it
          </button>
        </div>
      </div>
    </Dialog>
  )
}
export default RevealApiKeyDialog
