import React from 'react'
import { CopyButton } from '../../../shared/ui/CopyButton'
import { Calendar, Activity, RotateCw, Trash2 } from 'lucide-react'
import type { ApiKeyRecord } from '../types'

interface ApiKeysTableProps {
  keys: ApiKeyRecord[]
  onRevoke: (record: ApiKeyRecord) => void
  onRegenerate: (record: ApiKeyRecord) => void
}

export const ApiKeysTable: React.FC<ApiKeysTableProps> = ({ keys, onRevoke, onRegenerate }) => {
  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return 'Never'
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return 'Never'
    }
  }

  const renderPermissions = (perms: string[]) => {
    return (
      <div className="flex flex-wrap gap-1">
        {perms.map((p) => (
          <span
            key={p}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white/5 border border-brand-border text-brand-text-secondary select-none"
          >
            {p.toLowerCase().replace('_', ' ')}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-brand-border bg-brand-surface/40">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-brand-border bg-white/[0.01] text-[10px] font-bold text-brand-text-secondary uppercase tracking-widest select-none">
            <th className="px-4 py-3.5">Name</th>
            <th className="px-4 py-3.5">Prefix</th>
            <th className="px-4 py-3.5">Environment</th>
            <th className="px-4 py-3.5">Permissions</th>
            <th className="px-4 py-3.5">Created</th>
            <th className="px-4 py-3.5">Last Used</th>
            <th className="px-4 py-3.5">Status</th>
            <th className="px-4 py-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-border text-xs text-brand-text-primary">
          {keys.map((key) => {
            const isRevoked = !!key.revoked_at
            return (
              <tr
                key={key.id}
                className={`group hover:bg-white/[0.005] transition-all ${
                  isRevoked ? 'opacity-55' : ''
                }`}
              >
                {/* Name */}
                <td className="px-4 py-4 font-semibold max-w-[200px] truncate" title={key.name}>
                  {key.name}
                </td>

                {/* Prefix */}
                <td className="px-4 py-4 font-mono select-all">
                  <div className="flex items-center gap-1.5">
                    <span>{key.key_prefix}</span>
                    <CopyButton
                      text={key.key_prefix}
                      className="opacity-0 group-hover:opacity-100 hover:text-brand-text-primary transition-all p-0.5"
                    />
                  </div>
                </td>

                {/* Environment */}
                <td className="px-4 py-4 capitalize font-medium select-none">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      key.environment === 'production'
                        ? 'bg-brand-accent/10 border border-brand-accent/25 text-brand-accent'
                        : 'bg-white/5 border border-brand-border text-brand-text-secondary'
                    }`}
                  >
                    {key.environment}
                  </span>
                </td>

                {/* Permissions */}
                <td className="px-4 py-4">{renderPermissions(key.permissions)}</td>

                {/* Created */}
                <td className="px-4 py-4 text-brand-text-secondary select-none">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 opacity-60 shrink-0" />
                    <span>{formatDate(key.created_at)}</span>
                  </div>
                </td>

                {/* Last Used */}
                <td className="px-4 py-4 text-brand-text-secondary select-none font-mono">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 opacity-60 shrink-0" />
                    <span>{formatDate(key.last_used_at)}</span>
                  </div>
                </td>

                {/* Status */}
                <td className="px-4 py-4 select-none">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isRevoked ? 'bg-brand-danger shadow-[0_0_8px_rgba(239,90,90,0.5)]' : 'bg-brand-success shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                      }`}
                    />
                    <span className={isRevoked ? 'text-brand-danger' : 'text-brand-success'}>
                      {isRevoked ? 'Revoked' : 'Active'}
                    </span>
                  </span>
                </td>

                {/* Actions */}
                <td className="px-4 py-4 text-right">
                  <div className="inline-flex items-center gap-2">
                    {!isRevoked && (
                      <>
                        <button
                          onClick={() => onRegenerate(key)}
                          title="Regenerate (revokes old & creates replacement)"
                          className="p-1 rounded border border-brand-border bg-brand-surface hover:bg-white/5 text-brand-text-secondary hover:text-brand-text-primary transition-all cursor-pointer shadow-sm"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onRevoke(key)}
                          title="Revoke permanently"
                          className="p-1 rounded border border-brand-border bg-brand-surface hover:bg-brand-danger/10 hover:border-brand-danger/25 text-brand-text-secondary hover:text-brand-danger transition-all cursor-pointer shadow-sm"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
export default ApiKeysTable
