// src/modules/membership/schemas/filter.schema.ts
// Mirrors: member_filter.dart MemberFilter, household_filter.dart HouseholdFilter
// HouseholdFilterSchema here drives the AG Grid query on HouseholdList (server-side filter).
// HouseholdDropdownItem shape (for form pickers) lives in member.types.ts.

import { z } from 'zod'

// Re-export member filter from member.schema.ts for convenience
export { MemberFilterSchema, type MemberFilterInput } from './member.schema'

// ── HouseholdFilterSchema — drives HouseholdList AG Grid query ────────────────
// NOTE: This is the WEB query filter, not the Flutter dropdown item.
// The Flutter HouseholdFilter (id + familyName) is HouseholdDropdownItem in member.types.ts.
export const HouseholdFilterSchema = z.object({
  search: z.string().optional(),
  // Required for national_admin / district_overseer; RLS handles others
  assembly_id: z.string().uuid().optional(),
})

export type HouseholdFilterInput = z.infer<typeof HouseholdFilterSchema>