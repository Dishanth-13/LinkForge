import React from 'react'
import { Dialog } from '../../../shared/ui/Dialog'
import { useRevokeApiKeyMutation } from '../hooks/useApiKeys'
import { useToast } from '../../../shared/ui/Toast'
import { AlertTriangle } from 'lucide-react'
import type { ApiKeyRecord } from '../types'

interface RevokeDialogProps {
  open: boolean
  onClose: () => void
  keyData: ApiKeyRecord | null
}

export const RevokeDialog: React.FC<RevokeDialogProps> = ({ open, onClose, keyData }) => {
  const { toast } = useToast()
  const revokeMutation = useRevokeApiKeyMutation()

  if (!keyData) return null

  const handleRevoke = async () => {
    try {
      await revokeMutation.mutateAsync(keyData.id)
      toast('API Key revoked successfully', 'success')
      onClose()
    } catch {
      toast('Failed to revoke API key', 'error')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Revoke API Key" size="sm">
      <div className="space-y-4">
        {/* Warning Icon & Text */}
        <div className="flex flex-col items-center justify-center text-center p-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-danger/10 text-brand-danger mb-3">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-semibold text-brand-text-primary">
            Are you absolutely sure?
          </h3>
          <p className="mt-1.5 text-[11px] text-brand-text-secondary/80 leading-relaxed max-w-[280px]">
            This will permanently revoke the API key <span className="font-semibold text-brand-text-primary">"{keyData.name}"</span> (Prefix: {keyData.key_prefix}). Any clients or services using this key will immediately fail to authenticate.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-center gap-2.5 pt-2">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-md border border-brand-border hover:bg-white/5 text-brand-text-secondary hover:text-brand-text-primary transition-all cursor-pointer"
            disabled={revokeMutation.isPending}
          >
            Cancel
          </button>
          <button
            onClick={handleRevoke}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-brand-danger hover:bg-brand-danger/90 text-white transition-all shadow-md shadow-brand-danger/25 hover:shadow-lg cursor-pointer"
            disabled={revokeMutation.isPending}
          >
            {revokeMutation.isPending ? 'Revoking...' : 'Revoke Key'}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
export default RevokeDialog
