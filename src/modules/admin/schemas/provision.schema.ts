import { z } from 'zod'

export const ProvisionUserSchema = z.discriminatedUnion('path', [
  // Path A — send email invite
  z.object({
    path:     z.literal('invite'),
    memberId: z.string().uuid(),
    role:     z.string().min(1),
    email:    z.string().email('Valid email required for invite').optional(),
  }),

  // Path B — use assembly default password (phone identifier)
  z.object({
    path:     z.literal('default_password'),
    memberId: z.string().uuid(),
    role:     z.string().min(1),
  }),

  // Path C — admin sets a custom password
  z.object({
    path:     z.literal('custom_password'),
    memberId: z.string().uuid(),
    role:     z.string().min(1),
    email:    z.string().email('Valid email required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
])

export type ProvisionUserInput = z.infer<typeof ProvisionUserSchema>

export const AssemblyDefaultPasswordSchema = z.string()
  .min(8,                    'Minimum 8 characters')
  .regex(/[A-Z]/,            'Must include at least one uppercase letter')
  .regex(/[0-9]/,            'Must include at least one number')
  .regex(/[^A-Za-z0-9]/,    'Must include at least one special character')
