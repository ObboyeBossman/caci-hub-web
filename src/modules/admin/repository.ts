import { supabase }        from '../../core/supabase'
import { RepositoryError } from '../../types/common.types'
import type {
  ProvisionUserPayload,
  ProvisionUserResult,
} from '../../types/member.types'

export async function provisionUser(
  payload: ProvisionUserPayload
): Promise<ProvisionUserResult> {
  const { data, error } = await supabase.functions.invoke('provision-user', {
    body: payload,
  })
  if (error) throw new RepositoryError(
    extractErrorMessage(error, 'Provisioning failed'),
    error,
    extractErrorCode(error),
  )
  return data as ProvisionUserResult
}

export async function resetMemberPassword(memberId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('reset-member-password', {
    body: { memberId },
  })
  if (error) throw new RepositoryError(
    extractErrorMessage(error, 'Password reset failed'),
    error,
  )
}

export async function deleteMemberAuth(memberId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-member-auth', {
    body: { memberId },
  })
  if (error) throw new RepositoryError(
    extractErrorMessage(error, 'Failed to delete login account'),
    error,
  )
}

export async function setAssemblyDefaultPassword(password: string): Promise<void> {
  const { error } = await supabase.functions.invoke(
    'set-assembly-default-password',
    { body: { password } }
  )
  if (error) throw new RepositoryError(
    extractErrorMessage(error, 'Failed to set default password'),
    error,
  )
}

export async function getAssembly(assemblyId: string) {
  const { data, error } = await supabase
    .from('assemblies')
    .select('id, name, assembly_code, address, default_member_password')
    .eq('id', assemblyId)
    .single()
  if (error) throw new RepositoryError('Failed to load assembly', error)
  return data
}

// Helpers to extract message and code from Supabase FunctionsHttpError
function extractErrorMessage(error: any, fallback: string): string {
  if (error && typeof error === 'object' && 'context' in error) {
    const ctx = (error as any).context
    if (ctx?.error) return ctx.error
  }
  return fallback
}

function extractErrorCode(error: any): string | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    return String((error as any).status)
  }
  return undefined
}
