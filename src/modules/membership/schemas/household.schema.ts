// src/modules/membership/schemas/household.schema.ts
// Mirrors: create_household_screen.dart form validation
// DB column is `family_name` (not `name`) — per migration 20260427000004

import { z } from 'zod'

// ── CreateHouseholdSchema ─────────────────────────────────────────────────────
// assembly_id is injected by the repository (from getActiveAssemblyId()).
export const CreateHouseholdSchema = z.object({
  family_name: z
    .string()
    .min(2, 'Household name must be at least 2 characters')
    .max(150, 'Household name is too long'),
  address: z.string().max(300).nullable().optional(),
  // Injected by repository — not a form field
  assembly_id: z.string().uuid(),
  primary_contact_id: z.string().uuid().nullable().optional(),
})

export type CreateHouseholdInput = z.infer<typeof CreateHouseholdSchema>

// ── UpdateHouseholdSchema — patch semantics ───────────────────────────────────
export const UpdateHouseholdSchema = z.object({
  id: z.string().uuid(),
  family_name: z.string().min(2).max(150).optional(),
  address: z.string().max(300).nullable().optional(),
  primary_contact_id: z.string().uuid().nullable().optional(),
})

export type UpdateHouseholdInput = z.infer<typeof UpdateHouseholdSchema>