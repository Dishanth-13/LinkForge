import React, { useState } from 'react'
import { Dialog } from '../../../shared/ui/Dialog'
import { useCreateApiKeyMutation } from '../hooks/useApiKeys'
import { useToast } from '../../../shared/ui/Toast'
import type { ApiKeyPermission, CreatedApiKeyResponse } from '../types'

interface CreateApiKeyDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: (data: CreatedApiKeyResponse) => void
}

const AVAILABLE_PERMISSIONS: { label: string; value: ApiKeyPermission; desc: string }[] = [
  { value: 'READ_LINKS', label: 'Read Links', desc: 'Allows listing and retrieving short link records.' },
  { value: 'CREATE_LINKS', label: 'Create Links', desc: 'Allows generating new short links.' },
  { value: 'UPDATE_LINKS', label: 'Update Links', desc: 'Allows modifying existing link aliases, details, and active status.' },
  { value: 'DELETE_LINKS', label: 'Delete Links', desc: 'Allows revoking/deleting link records.' },
  { value: 'READ_ANALYTICS', label: 'Read Analytics', desc: 'Allows retrieving click tracking and device/browser statistics.' },
]

export const CreateApiKeyDialog: React.FC<CreateApiKeyDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { toast } = useToast()
  const createMutation = useCreateApiKeyMutation()

  const [name, setName] = useState('')
  const [environment, setEnvironment] = useState<'production' | 'testing'>('production')
  const [permissions, setPermissions] = useState<ApiKeyPermission[]>([
    'READ_LINKS',
    'CREATE_LINKS',
  ])

  const handlePermissionChange = (perm: ApiKeyPermission, checked: boolean) => {
    if (checked) {
      setPermissions((prev) => [...prev, perm])
    } else {
      setPermissions((prev) => prev.filter((p) => p !== perm))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast('API Key name is required', 'error')
      return
    }
    if (permissions.length === 0) {
      toast('Please select at least one permission scope', 'error')
      return
    }

    try {
      const result = await createMutation.mutateAsync({
        name: name.trim(),
        environment,
        permissions,
      })
      toast('API Key generated successfully', 'success')
      setName('')
      setEnvironment('production')
      setPermissions(['READ_LINKS', 'CREATE_LINKS'])
      onSuccess(result)
    } catch {
      toast('Failed to generate API key', 'error')
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Create API Key" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Key Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-brand-text-secondary uppercase tracking-wider select-none">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Production Worker Server"
            className="w-full px-3 py-1.5 text-xs bg-brand-card border border-brand-border rounded-md text-brand-text-primary focus:outline-none focus:border-brand-accent/50"
            disabled={createMutation.isPending}
            required
            maxLength={100}
          />
        </div>

        {/* Environment */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-brand-text-secondary uppercase tracking-wider select-none">
            Environment
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-all ${
                environment === 'production'
                  ? 'border-brand-accent bg-brand-accent/5 text-brand-text-primary'
                  : 'border-brand-border bg-brand-card hover:bg-white/[0.02] text-brand-text-secondary'
              }`}
            >
              <input
                type="radio"
                name="environment"
                value="production"
                checked={environment === 'production'}
                onChange={() => setEnvironment('production')}
                className="hidden"
                disabled={createMutation.isPending}
              />
              <div className="flex flex-col select-none">
                <span className="text-xs font-semibold">Production</span>
                <span className="text-[9px] opacity-70">Starts with lf_live_</span>
              </div>
            </label>
            <label
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-all ${
                environment === 'testing'
                  ? 'border-brand-accent bg-brand-accent/5 text-brand-text-primary'
                  : 'border-brand-border bg-brand-card hover:bg-white/[0.02] text-brand-text-secondary'
              }`}
            >
              <input
                type="radio"
                name="environment"
                value="testing"
                checked={environment === 'testing'}
                onChange={() => setEnvironment('testing')}
                className="hidden"
                disabled={createMutation.isPending}
              />
              <div className="flex flex-col select-none">
                <span className="text-xs font-semibold">Testing</span>
                <span className="text-[9px] opacity-70">Starts with lf_test_</span>
              </div>
            </label>
          </div>
        </div>

        {/* Permissions */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-brand-text-secondary uppercase tracking-wider select-none">
            Permissions
          </label>
          <div className="border border-brand-border rounded-lg bg-brand-card/50 overflow-hidden divide-y divide-brand-border">
            {AVAILABLE_PERMISSIONS.map((perm) => {
              const isChecked = permissions.includes(perm.value)
              return (
                <label
                  key={perm.value}
                  className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-white/[0.01] transition-all select-none`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => handlePermissionChange(perm.value, e.target.checked)}
                    className="mt-0.5 rounded border-brand-border text-brand-accent bg-brand-card focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    disabled={createMutation.isPending}
                  />
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="text-xs font-semibold text-brand-text-primary">{perm.label}</span>
                    <span className="text-[10px] text-brand-text-secondary/70">{perm.desc}</span>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-md border border-brand-border hover:bg-white/5 text-brand-text-secondary hover:text-brand-text-primary transition-all cursor-pointer"
            disabled={createMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-brand-accent hover:bg-brand-accent/90 text-white transition-all shadow-md shadow-brand-accent/25 hover:shadow-lg cursor-pointer"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Generating...' : 'Generate API Key'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
