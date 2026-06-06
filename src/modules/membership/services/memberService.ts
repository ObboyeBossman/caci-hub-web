// src/modules/membership/services/memberService.ts
// Orchestrates multi-step member operations that span the repository and Edge Functions.
// Mirrors: MemberCreateNotifier._assignMembershipNumber() background pattern (Flutter)
//
// registerMember():
//   1. createMember() in repository (INSERT → re-fetch via view)
//   2. assign-membership-number EF (background, non-fatal)
//   3. create-member-user EF (creates auth account — if email/phone provided)
//   4. send-welcome-email EF (non-fatal)
//   5. send-welcome-sms EF (non-fatal)
//
// exportCsv():
//   Calls the export-members-csv Edge Function.

import { supabase }            from '@core/supabase'
import { getActiveAssemblyId } from '@core/auth'
import { RepositoryError }     from '../../../types/common.types'
import {
  createMember,
  assignMembershipNumber,
  updateMember,
} from '../repository'
import type { CreateMemberPayload, MemberView } from '../../../types/member.types'

// ── registerMember ────────────────────────────────────────────────────────────

export interface RegisterMemberResult {
  member:                MemberView
  membershipNumber:      string | null    // null if EF failed (non-fatal)
  authAccountCreated:    boolean
  welcomeEmailSent:      boolean
  welcomeSmsSent:        boolean
}

/**
 * Full member registration flow.
 * assembly_id is always injected from getActiveAssemblyId() — never from payload.
 * Mirrors: Flutter MemberCreateNotifier.create() + _assignMembershipNumber()
 *
 * Steps 3–5 are best-effort — failures are logged but do not throw.
 * The caller receives a result object describing what succeeded.
 */
export async function registerMember(
  payload: Omit<CreateMemberPayload, 'assembly_id'> & { profile_photo_file?: File | null }
): Promise<RegisterMemberResult> {
  const { profile_photo_file, ...dbPayload } = payload
  // Step 1: Create member record
  const member = await createMember(dbPayload)

  const result: RegisterMemberResult = {
    member,
    membershipNumber:   null,
    authAccountCreated: false,
    welcomeEmailSent:   false,
    welcomeSmsSent:     false,
  }

  // Step 1.5: Upload photo if provided
  if (profile_photo_file) {
    try {
      // RLS policy requires folder prefix = auth.uid() (not member.id)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')

      const { uploadProfilePhoto } = await import('../repository')
      const photoUrl = await uploadProfilePhoto({
        authUid: user.id,               // ← must be auth.uid(), not member.id
        fileName: `profile_${Date.now()}_${profile_photo_file.name}`,
        blob: profile_photo_file,
        mimeType: profile_photo_file.type
      })
      result.member = await updateMember(member.id, { profile_photo_url: photoUrl })
    } catch (err) {
      console.warn('[memberService] Photo upload failed:', err)
    }
  }

  // Step 2: Assign membership number (background, non-fatal)
  // Mirrors: MemberCreateNotifier._assignMembershipNumber()
  try {
    const number = await assignMembershipNumber(member.id)
    result.membershipNumber = number
    // Re-fetch for the number — the EF updates the DB row directly
    const { getMember } = await import('../repository')
    result.member = await getMember(member.id)
  } catch (err) {
    console.warn('[memberService] Membership number assignment failed (non-fatal):', err)
  }

  // Step 3: create-member-user EF — only if email or phone provided
  if (payload.email || payload.primary_phone) {
    try {
      const { error } = await supabase.functions.invoke('create-member-user', {
        body: {
          memberId: member.id,
          email:    payload.email ?? null,
          phone:    payload.primary_phone ?? null,
        },
      })
      if (error) throw error
      result.authAccountCreated = true
    } catch (err) {
      console.warn('[memberService] create-member-user EF failed (non-fatal):', err)
    }
  }

  // Step 4: send-welcome-email EF
  if (payload.email) {
    try {
      const { error } = await supabase.functions.invoke('send-welcome-email', {
        body: { memberId: member.id, email: payload.email },
      })
      if (error) throw error
      result.welcomeEmailSent = true
    } catch (err) {
      console.warn('[memberService] send-welcome-email EF failed (non-fatal):', err)
    }
  }

  // Step 5: send-welcome-sms EF
  if (payload.primary_phone) {
    try {
      const { error } = await supabase.functions.invoke('send-welcome-sms', {
        body: { memberId: member.id, phone: payload.primary_phone },
      })
      if (error) throw error
      result.welcomeSmsSent = true
    } catch (err) {
      console.warn('[memberService] send-welcome-sms EF failed (non-fatal):', err)
    }
  }

  return result
}

// ── exportCsv ─────────────────────────────────────────────────────────────────

/**
 * Call the export-members-csv Edge Function.
 * Returns the CSV string. The page layer handles the download trigger.
 * Mirrors: Flutter IMemberRepository — exportCsv is web-only (no Flutter equivalent).
 */
export async function exportMembersCsv(filter?: {
  statuses?: string[]
  gender?: string
  householdId?: string
  includeDeleted?: boolean
}): Promise<string> {
  const assemblyId = getActiveAssemblyId()
  if (!assemblyId) throw new RepositoryError('No active assembly selected.', null, 'NO_ASSEMBLY')

  try {
    const { data, error } = await supabase.functions.invoke('export-members-csv', {
      body: { assemblyId, filter: filter ?? {} },
    })

    if (error) throw error

    // EF returns a CSV string in data
    if (typeof data === 'string') return data

    throw new Error('export-members-csv EF returned unexpected shape')
  } catch (err) {
    throw new RepositoryError(
      'Export failed. Please try again.',
      err,
      'EF_ERROR'
    )
  }
}

// ── downloadCsv ───────────────────────────────────────────────────────────────

/**
 * Trigger a browser file download from a CSV string.
 * Utility used by MemberList page after exportMembersCsv() resolves.
 */
export function downloadCsv(csvString: string, filename = 'members-export.csv'): void {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}