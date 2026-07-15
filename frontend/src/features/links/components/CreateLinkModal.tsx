import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Dialog } from '../../../shared/ui/Dialog'
import { LoadingSpinner } from '../../../shared/ui/LoadingSpinner'
import { useCreateLink } from '../hooks/useLinksQuery'
import { useToast } from '../../../shared/ui/Toast'
import { createLinkSchema, type CreateLinkFormValues } from '../schemas/linkSchemas'
import { cn } from '../../../shared/lib/utils'
import axios from 'axios'

interface CreateLinkModalProps {
  open: boolean
  onClose: () => void
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
  required?: boolean
}

const Field: React.FC<FieldProps> = ({ label, error, hint, required, ...props }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-brand-text-secondary select-none">
      {label} {required && <span className="text-brand-danger">*</span>}
    </label>
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

export const CreateLinkModal: React.FC<CreateLinkModalProps> = ({ open, onClose }) => {
  const { toast } = useToast()
  const { mutateAsync: createLink, isPending } = useCreateLink()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateLinkFormValues>({
    resolver: zodResolver(createLinkSchema),
    defaultValues: { original_url: '', custom_alias: '', title: '', description: '', expires_at: '' },
  })

  const handleClose = () => {
    reset()
    onClose()
  }

  const onSubmit = async (values: CreateLinkFormValues) => {
    try {
      await createLink({
        original_url: values.original_url,
        custom_alias: values.custom_alias || undefined,
        title: values.title || undefined,
        description: values.description || undefined,
        expires_at: values.expires_at || undefined,
      })
      toast('Link created successfully', 'success')
      handleClose()
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail
        if (typeof detail === 'string') {
          toast(detail, 'error')
        } else if (Array.isArray(detail)) {
          toast(detail[0]?.msg ?? 'Validation error', 'error')
        } else {
          toast('Failed to create link. Check your inputs.', 'error')
        }
      } else {
        toast('An unexpected error occurred.', 'error')
      }
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Create Short Link"
      description="Generate a new branded short URL with an optional alias and expiration."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field
          label="Destination URL"
          required
          type="url"
          placeholder="https://example.com/your-long-url"
          error={errors.original_url?.message}
          {...register('original_url')}
        />
        <Field
          label="Custom Alias"
          type="text"
          placeholder="my-link (optional)"
          hint="Only letters, numbers, hyphens, and underscores"
          error={errors.custom_alias?.message}
          {...register('custom_alias')}
        />
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
            className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-brand-accent hover:bg-brand-accent/90 text-white text-xs font-semibold shadow-sm shadow-brand-accent/20 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <LoadingSpinner size="sm" />
                Creating…
              </>
            ) : (
              'Create Link'
            )}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
