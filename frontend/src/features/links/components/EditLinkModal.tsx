import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Dialog } from '../../../shared/ui/Dialog'
import { LoadingSpinner } from '../../../shared/ui/LoadingSpinner'
import { useUpdateLink } from '../hooks/useLinksQuery'
import { useToast } from '../../../shared/ui/Toast'
import { editLinkSchema, type EditLinkFormValues } from '../schemas/linkSchemas'
import { cn } from '../../../shared/lib/utils'
import type { LinkRecord } from '../hooks/useLinksQuery'
import { isApiError, getApiErrorDetail } from '../../../shared/lib/api'

interface EditLinkModalProps {
  open: boolean
  link: LinkRecord | null
  onClose: () => void
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

const Field: React.FC<FieldProps> = ({ label, error, hint, ...props }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-brand-text-secondary select-none">{label}</label>
    <input
      {...props}
      className={cn(
        'w-full px-3 py-2 text-sm bg-brand-bg border rounded-md text-brand-text-primary placeholder:text-brand-text-secondary/40 focus:outline-none transition-all font-sans',
        error
          ? 'border-brand-danger/60 focus:border-brand-danger focus:ring-1 focus:ring-brand-danger/20'
          : 'border-brand-border focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/20'
      )}
    />
    {hint && !error && <p className="text-[11px] text-brand-text-secondary/60">{hint}</p>}
    {error && <p className="text-[11px] text-brand-danger">{error}</p>}
  </div>
)

// Convert ISO datetime to datetime-local format
const toDatetimeLocal = (iso: string | null | undefined): string => {
  if (!iso) return ''
  try {
    return new Date(iso).toISOString().slice(0, 16)
  } catch {
    return ''
  }
}

export const EditLinkModal: React.FC<EditLinkModalProps> = ({ open, link, onClose }) => {
  const { toast } = useToast()
  const { mutateAsync: updateLink, isPending } = useUpdateLink()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditLinkFormValues>({
    resolver: zodResolver(editLinkSchema),
  })

  // Re-populate form when link changes
  useEffect(() => {
    if (link) {
      reset({
        title: link.title ?? '',
        description: link.description ?? '',
        expires_at: toDatetimeLocal(link.expires_at),
        is_active: link.is_active,
      })
    }
  }, [link, reset])

  if (!link) return null

  const handleClose = () => {
    reset()
    onClose()
  }

  const onSubmit = async (values: EditLinkFormValues) => {
    try {
      await updateLink({
        id: link.id,
        payload: {
          title: values.title || undefined,
          description: values.description || undefined,
          expires_at: values.expires_at ? new Date(values.expires_at).toISOString() : null,
          is_active: values.is_active,
        },
      })
      toast('Link updated successfully', 'success')
      handleClose()
    } catch (err: unknown) {
      if (isApiError(err)) {
        toast(getApiErrorDetail(err, 'Failed to update link.'), 'error')
      } else {
        toast('An unexpected error occurred.', 'error')
      }
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Edit Link"
      description={`Editing /${link.custom_alias ?? link.short_code}`}
    >
      {/* Read-only info */}
      <div className="rounded-md bg-white/[0.02] border border-brand-border px-3 py-2.5 text-xs text-brand-text-secondary flex flex-col gap-1">
        <span className="font-semibold text-brand-text-primary/70 text-[10px] uppercase tracking-wider">
          Destination (read-only)
        </span>
        <span className="text-brand-accent truncate">{link.original_url}</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Title"
            type="text"
            placeholder="Campaign name…"
            error={errors.title?.message}
            {...register('title')}
          />
          <Field
            label="Expires At"
            type="datetime-local"
            error={errors.expires_at?.message}
            {...register('expires_at')}
          />
        </div>
        <Field
          label="Description"
          type="text"
          placeholder="Optional internal note"
          error={errors.description?.message}
          {...register('description')}
        />

        {/* is_active toggle */}
        <div className="flex items-center justify-between py-2 px-3 rounded-md bg-white/[0.02] border border-brand-border">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-brand-text-primary select-none">Active</span>
            <span className="text-[11px] text-brand-text-secondary/60">Enable or disable this short URL</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" {...register('is_active')} />
            <div className="w-9 h-5 rounded-full bg-white/10 peer peer-checked:bg-brand-accent transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4" />
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-brand-border mt-1">
          <button
            type="button"
            onClick={handleClose}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-brand-text-secondary hover:text-brand-text-primary hover:bg-white/5 border border-brand-border transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-brand-accent hover:bg-brand-accent/90 text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? <><LoadingSpinner size="sm" />Saving…</> : 'Save Changes'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
