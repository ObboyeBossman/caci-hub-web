import { z } from 'zod'

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword:     z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  { message: 'Passwords do not match', path: ['confirmPassword'] }
).refine(
  (data) => data.newPassword !== data.currentPassword,
  { message: 'New password must be different from your current password', path: ['newPassword'] }
)

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>
