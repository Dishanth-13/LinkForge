import { z } from 'zod'

export const createLinkSchema = z.object({
  original_url: z
    .string()
    .min(1, 'URL is required')
    .url('Must be a valid URL starting with http:// or https://'),
  custom_alias: z
    .string()
    .regex(/^[a-zA-Z0-9_-]*$/, 'Only alphanumeric characters, hyphens, and underscores')
    .max(50, 'Alias cannot exceed 50 characters')
    .optional()
    .or(z.literal('')),
  title: z.string().max(255, 'Title cannot exceed 255 characters').optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  expires_at: z
    .string()
    .refine(
      (v) => !v || new Date(v) > new Date(),
      'Expiration date must be in the future'
    )
    .optional()
    .or(z.literal('')),
})

export const editLinkSchema = z.object({
  title: z.string().max(255).optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  expires_at: z
    .string()
    .refine(
      (v) => !v || new Date(v) > new Date(),
      'Expiration date must be in the future'
    )
    .optional()
    .or(z.literal('')),
  is_active: z.boolean(),
})

export type CreateLinkFormValues = z.infer<typeof createLinkSchema>
export type EditLinkFormValues = z.infer<typeof editLinkSchema>
