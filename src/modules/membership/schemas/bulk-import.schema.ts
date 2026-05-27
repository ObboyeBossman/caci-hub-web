import { z } from 'zod'

export const BulkMemberRowSchema = z.object({
  first_name:        z.string().min(1, 'first_name is required'),
  last_name:         z.string().min(1, 'last_name is required'),
  gender:            z.enum(['male', 'female']),
  membership_status: z.enum(['active','inactive','visitor','prospect','transfer','deceased'])
                      .default('active'),
  primary_phone:     z.string().nullable().optional(),
  secondary_phone:   z.string().nullable().optional(),
  email:             z.string().email('Invalid email').nullable().optional(),
  date_of_birth:     z.string().date('Use YYYY-MM-DD format').nullable().optional(),
  marital_status:    z.enum(['single','married','widowed','divorced','separated'])
                      .nullable().optional(),
  join_date:         z.string().date('Use YYYY-MM-DD format').nullable().optional(),
  occupation:        z.string().nullable().optional(),
  physical_address:  z.string().nullable().optional(),
}).refine(
  (data) => data.primary_phone || data.email,
  {
    message: 'At least one of primary_phone or email is required',
    path: ['primary_phone'],
  }
)

export type BulkMemberRowInput = z.infer<typeof BulkMemberRowSchema>
