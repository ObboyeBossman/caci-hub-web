import { z } from 'zod'

export const BulkMemberRowSchema = z.object({
  first_name:        z.string().min(1, 'first_name is required'),
  last_name:         z.string().min(1, 'last_name is required'),
  gender:            z.enum(['male', 'female']),
  membership_status: z.enum(['active','inactive','visitor','prospect','transfer','deceased'])
                      .default('active'),
  phone_number:      z.string().nullable().optional(),
  email:             z.string().email('Invalid email').nullable().optional(),
  date_of_birth:     z.string().date('Use YYYY-MM-DD format').nullable().optional(),
  marital_status:    z.enum(['single','married','widowed','divorced','separated'])
                      .nullable().optional(),
  join_date:         z.string().date('Use YYYY-MM-DD format').nullable().optional(),
  occupation:        z.string().nullable().optional(),
  physical_address:  z.string().nullable().optional(),
}).refine(
  (data) => data.phone_number || data.email,
  {
    message: 'At least one of phone_number or email is required',
    path: ['phone_number'],
  }
)

export type BulkMemberRowInput = z.infer<typeof BulkMemberRowSchema>
