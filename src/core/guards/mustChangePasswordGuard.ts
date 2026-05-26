import { getCurrentUser } from '../auth'
import type { GuardFn }   from '../../types/module.types'

export const mustChangePasswordGuard: GuardFn = async () => {
  const user = getCurrentUser()
  if (!user) return { allowed: true }  // authGuard handles unauthenticated

  if ((user as any).must_change_password === true) {
    return { allowed: false, redirect: '/change-password?forced=true' }
  }

  return { allowed: true }
}
