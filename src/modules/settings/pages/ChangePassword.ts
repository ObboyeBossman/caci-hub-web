import { ChangePasswordSchema } from '../schemas/change-password.schema'
import { supabase }             from '../../../core/supabase'
import { loadCurrentUser,
         getCurrentUser }       from '../../../core/auth'
import { navigate }             from '../../../core/router'
import { getFirstModuleRoute }  from '../../../core/registry'
import { Toast }                from '../../../shared/components/Toast'
import type { PageModule }      from '../../../types/module.types'

const ChangePassword: PageModule = {

  async render(container) {
    const forced = new URLSearchParams(
      location.hash.split('?')[1] ?? ''
    ).get('forced') === 'true'

    container.innerHTML = `
      <div class="auth-root" style="align-items: center; justify-content: center; min-height: 100vh; background: var(--auth-body-bg);">
        <div class="auth-box" style="width: 100%; max-width: 400px; background: var(--auth-card-bg); padding: 32px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <div class="auth-heading" style="margin-bottom: 24px; text-align: center;">
            <div class="auth-h1" style="font-size: 24px; font-weight: 700;">Welcome to CACI Hub</div>
            <div class="auth-subtitle" style="color: var(--text-secondary); margin-top: 8px;">
              You need to set a new password before continuing.
            </div>
          </div>
          <form id="change-password-form">
            <div class="auth-field" style="margin-bottom: 16px;">
              <label class="auth-label" style="display: block; margin-bottom: 8px; font-weight: 600;">Current password</label>
              <input type="password" id="current-password" class="auth-input" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 4px;" required>
            </div>
            <div class="auth-field" style="margin-bottom: 16px;">
              <label class="auth-label" style="display: block; margin-bottom: 8px; font-weight: 600;">New password</label>
              <input type="password" id="new-password" class="auth-input" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 4px;" required>
            </div>
            <div class="auth-field" style="margin-bottom: 24px;">
              <label class="auth-label" style="display: block; margin-bottom: 8px; font-weight: 600;">Confirm password</label>
              <input type="password" id="confirm-password" class="auth-input" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 4px;" required>
            </div>
            <button type="submit" class="auth-btn auth-btn-primary" style="width: 100%; padding: 10px; background: var(--primary-color); color: white; border: none; border-radius: 4px; font-weight: 600; cursor: pointer;">
              Set password
            </button>
            ${!forced ? `<div style="text-align: center; margin-top: 16px;"><a href="javascript:history.back()" style="color: var(--primary-color); text-decoration: none;">← Back</a></div>` : ''}
          </form>
        </div>
      </div>
    `
    bindSubmit(container, forced)

    // Forced mode: disable all sidebar links and back navigation
    if (forced) {
      document.querySelectorAll('.sidebar a, .toolbar a').forEach(a => {
        (a as HTMLAnchorElement).style.pointerEvents = 'none'
      })
    }
  },

  destroy() {
    // Re-enable navigation links if they were disabled
    document.querySelectorAll('.sidebar a, .toolbar a').forEach(a => {
      (a as HTMLAnchorElement).style.pointerEvents = ''
    })
  }
}

async function bindSubmit(container: HTMLElement, forced: boolean) {
  container.querySelector('form')!.addEventListener('submit', async (e) => {
    e.preventDefault()

    const currentPassword = (container.querySelector('#current-password') as HTMLInputElement).value
    const newPassword     = (container.querySelector('#new-password') as HTMLInputElement).value
    const confirmPassword = (container.querySelector('#confirm-password') as HTMLInputElement).value

    // 1. Zod validation
    const result = ChangePasswordSchema.safeParse({ currentPassword, newPassword, confirmPassword })
    if (!result.success) {
      Toast.error(result.error.errors[0].message)
      return
    }

    // 2. Disable submit button + show spinner
    const btn = container.querySelector<HTMLButtonElement>('[type=submit]')!
    btn.disabled = true
    btn.textContent = 'Updating...'

    // 3. Re-authenticate with current password
    const user = getCurrentUser()!
    const identifier = user.email
      ? { email: user.email,  password: currentPassword }
      : { phone: user.phone!, password: currentPassword }

    const { error: reAuthError } = await supabase.auth.signInWithPassword(identifier)
    if (reAuthError) {
      Toast.error('Current password is incorrect.')
      btn.disabled = false
      btn.textContent = 'Set password'
      return
    }

    // 4. Update password
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      Toast.error('Failed to update password. Please try again.')
      btn.disabled = false
      btn.textContent = 'Set password'
      return
    }

    // 5. Clear must_change_password flag
    if (forced) {
      await (supabase.from('user_profiles') as any)
        .update({ must_change_password: false })
        .eq('id', user.id)
    }

    // 6. Refresh in-memory user
    await loadCurrentUser()

    // 7. Navigate
    if (forced) {
      navigate(getFirstModuleRoute())
    } else {
      Toast.success('Password changed successfully.')
      navigate('/settings') // Wait, settings is an overlay, this just navigates back ideally.
    }
  })
}

export default ChangePassword
