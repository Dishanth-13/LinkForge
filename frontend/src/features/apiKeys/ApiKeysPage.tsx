import React, { useState } from 'react'
import { Plus, Key, AlertTriangle } from 'lucide-react'
import { ContentContainer } from '../../shared/components/ContentContainer'
import { ErrorState } from '../../shared/components/ErrorState'
import { Skeleton } from '../../shared/ui/Skeleton'
import { useApiKeysQuery, useRegenerateApiKeyMutation } from './hooks/useApiKeys'
import { ApiKeysTable } from './components/ApiKeysTable'
import { CreateApiKeyDialog } from './components/CreateApiKeyDialog'
import { RevealApiKeyDialog } from './components/RevealApiKeyDialog'
import { RevokeDialog } from './components/RevokeDialog'
import { Dialog } from '../../shared/ui/Dialog'
import { useToast } from '../../shared/ui/Toast'
import type { ApiKeyRecord, CreatedApiKeyResponse } from './types'

export const ApiKeysPage: React.FC = () => {
  const { toast } = useToast()
  const { data: keys = [], isLoading, isError, refetch } = useApiKeysQuery()
  const regenerateMutation = useRegenerateApiKeyMutation()

  // State managers
  const [createOpen, setCreateOpen] = useState(false)
  const [revealOpen, setRevealOpen] = useState(false)
  const [revealData, setRevealData] = useState<CreatedApiKeyResponse | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRecord | null>(null)
  const [regenerateTarget, setRegenerateTarget] = useState<ApiKeyRecord | null>(null)

  const handleCreateSuccess = (newKey: CreatedApiKeyResponse) => {
    setCreateOpen(false)
    setRevealData(newKey)
    setRevealOpen(true)
  }

  const handleRegenerateConfirm = async () => {
    if (!regenerateTarget) return
    try {
      const result = await regenerateMutation.mutateAsync(regenerateTarget.id)
      toast('API Key regenerated successfully', 'success')
      setRegenerateTarget(null)
      setRevealData(result)
      setRevealOpen(true)
    } catch {
      toast('Failed to regenerate API key', 'error')
    }
  }

  const hasKeys = keys.length > 0

  return (
    <ContentContainer className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-brand-border pb-5 select-none">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-brand-text-primary tracking-tight">API Keys</h1>
          <p className="text-xs text-brand-text-secondary">
            Manage credentials for accessing LinkForge services programmatically.
          </p>
        </div>
        {hasKeys && (
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-accent hover:bg-brand-accent/90 text-white text-xs font-semibold transition-all shadow-md shadow-brand-accent/25 hover:shadow-lg cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create API Key</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="border border-brand-border rounded-lg p-4 space-y-3.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center gap-4">
                <Skeleton className="h-3 w-1/4" />
                <Skeleton className="h-3 w-1/6" />
                <Skeleton className="h-3 w-1/5" />
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to load API keys"
          message="We encountered an error connecting to the server. Please verify your connection."
          retryAction={() => refetch()}
        />
      ) : !hasKeys ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center text-center p-8 py-20 rounded-lg border border-dashed border-brand-border bg-white/[0.005] select-none min-h-[300px]">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/5 border border-brand-border text-brand-text-secondary/70 mb-4">
            <Key className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-brand-text-primary">No API keys generated</h3>
          <p className="mt-1.5 text-xs text-brand-text-secondary/75 max-w-[280px] leading-relaxed">
            Create an API key to configure server-side integrations or schedule jobs.
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="mt-5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-brand-accent hover:bg-brand-accent/90 text-white text-xs font-semibold transition-all shadow-md shadow-brand-accent/25 hover:shadow-lg cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create API Key</span>
          </button>
        </div>
      ) : (
        /* Table Grid */
        <div className="space-y-4">
          <ApiKeysTable
            keys={keys}
            onRevoke={(k) => setRevokeTarget(k)}
            onRegenerate={(k) => setRegenerateTarget(k)}
          />
          <p className="text-[10px] text-brand-text-secondary/50 font-medium select-none pl-1">
            Note: Revoked API keys will remain visible in the dashboard for audits, but cannot authenticate requests.
          </p>
        </div>
      )}

      {/* Create Dialog */}
      <CreateApiKeyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Reveal Dialog */}
      <RevealApiKeyDialog
        open={revealOpen}
        onClose={() => {
          setRevealOpen(false)
          setRevealData(null)
        }}
        keyData={revealData}
      />

      {/* Revoke Dialog */}
      <RevokeDialog
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        keyData={revokeTarget}
      />

      {/* Regenerate Confirmation Dialog */}
      <Dialog
        open={!!regenerateTarget}
        onClose={() => setRegenerateTarget(null)}
        title="Regenerate API Key"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center text-center p-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-warning/10 text-brand-warning mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-semibold text-brand-text-primary">
              Regenerate API Key?
            </h3>
            <p className="mt-1.5 text-[11px] text-brand-text-secondary/80 leading-relaxed max-w-[280px]">
              This will immediately revoke the current key <span className="font-semibold text-brand-text-primary">"{regenerateTarget?.name}"</span> and issue a replacement. Any systems using the existing key will break instantly.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2.5 pt-2">
            <button
              onClick={() => setRegenerateTarget(null)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-md border border-brand-border hover:bg-white/5 text-brand-text-secondary hover:text-brand-text-primary transition-all cursor-pointer"
              disabled={regenerateMutation.isPending}
            >
              Cancel
            </button>
            <button
              onClick={handleRegenerateConfirm}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-brand-accent hover:bg-brand-accent/90 text-white transition-all shadow-md shadow-brand-accent/25 hover:shadow-lg cursor-pointer"
              disabled={regenerateMutation.isPending}
            >
              {regenerateMutation.isPending ? 'Regenerating...' : 'Regenerate Key'}
            </button>
          </div>
        </div>
      </Dialog>
    </ContentContainer>
  )
}
export default ApiKeysPage
