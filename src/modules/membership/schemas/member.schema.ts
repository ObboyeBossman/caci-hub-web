// src/modules/membership/schemas/member.schema.ts
// Zod schemas for member create/update/filter.
// Mirrors: create_member_request.dart, update_member_request.dart, member_filter.dart
// Field names follow DB snake_case exactly (matching CreateMemberPayload / UpdateMemberPayload).

import { z } from 'zod'

// ── Enum literals — mirror GenderType, MembershipStatus, MaritalStatus ────────
export const GenderSchema = z.enum(['male', 'female'])

export const MembershipStatusSchema = z.enum([
  'active',
  'inactive',
  'visitor',
  'prospect',
  'transfer',
  'deceased',
])

export const MaritalStatusSchema = z.enum([
  'single',
  'married',
  'widowed',
  'divorced',
  'separated',
])

// ── CreateMemberSchema — mirrors CreateMemberRequest.toJson() ─────────────────
// assembly_id is injected by the service (never from the form).
// Required: first_name, last_name, gender, membership_status.
// All contact/social/emergency fields are optional.
export const CreateMemberSchema = z.object({
  // Injected by service — not a form field
  assembly_id: z.string().uuid(),

  // Required identity
  first_name: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name is too long'),
  last_name: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name is too long'),
  gender: GenderSchema,
  membership_status: MembershipStatusSchema,

  // Optional identity
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .nullable()
    .optional(),
  marital_status: MaritalStatusSchema.nullable().optional(),

  // Contact
  phone_number: z
    .string()
    .max(30)
    .nullable()
    .optional(),
  email: z
    .string()
    .email('Invalid email address')
    .nullable()
    .optional(),
  physical_address: z.string().max(300).nullable().optional(),
  occupation: z.string().max(150).nullable().optional(),

  // Social
  facebook_url: z.string().url('Invalid URL').nullable().optional(),
  whatsapp_number: z.string().max(30).nullable().optional(),
  instagram_url: z.string().url('Invalid URL').nullable().optional(),

  // Emergency contact
  emergency_contact_name: z.string().max(150).nullable().optional(),
  emergency_contact_phone: z.string().max(30).nullable().optional(),
  emergency_contact_relationship: z.string().max(100).nullable().optional(),

  // Membership
  join_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .nullable()
    .optional(),
  household_id: z.string().uuid().nullable().optional(),
})

export type CreateMemberInput = z.infer<typeof CreateMemberSchema>

// ── UpdateMemberSchema — patch semantics, all optional except id ──────────────
// Mirrors UpdateMemberRequest — only set fields are sent to Supabase.
// Admin/pastor-only fields (pastoral_notes, is_active, deleted_at) are
// included here; the DB enforces 42501 for unauthorised roles.
export const UpdateMemberSchema = z.object({
  id: z.string().uuid(),

  // Basic info
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  gender: GenderSchema.optional(),
  marital_status: MaritalStatusSchema.nullable().optional(),

  // Contact
  phone_number: z.string().max(30).nullable().optional(),
  email: z.string().email().nullable().optional(),
  physical_address: z.string().max(300).nullable().optional(),
  occupation: z.string().max(150).nullable().optional(),

  // Social
  facebook_url: z.string().url().nullable().optional(),
  whatsapp_number: z.string().max(30).nullable().optional(),
  instagram_url: z.string().url().nullable().optional(),

  // Emergency contact
  emergency_contact_name: z.string().max(150).nullable().optional(),
  emergency_contact_phone: z.string().max(30).nullable().optional(),
  emergency_contact_relationship: z.string().max(100).nullable().optional(),

  // Membership
  membership_status: MembershipStatusSchema.optional(),
  join_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  household_id: z.string().uuid().nullable().optional(),
  profile_photo_url: z.string().url().nullable().optional(),

  // Admin/pastor only — DB enforces 42501 for other roles
  pastoral_notes: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  deleted_at: z.string().datetime().nullable().optional(),
})

export type UpdateMemberInput = z.infer<typeof UpdateMemberSchema>

// ── MemberFilterSchema — mirrors MemberFilter class ───────────────────────────
export const MemberFilterSchema = z.object({
  statuses: z.array(MembershipStatusSchema).optional(),
  gender: GenderSchema.optional(),
  householdId: z.string().uuid().optional(),
  searchQuery: z.string().optional(),
  includeDeleted: z.boolean().optional(),
  // Injected for super_admin; RLS handles scoping for all other roles
  assemblyId: z.string().uuid().optional(),
})

export type MemberFilterInput = z.infer<typeof MemberFilterSchema>