// src/shared/components/Toast.ts
// Notyf wrapper — typed toast notifications.
// Mirrors: app_toast.dart + app_snack_bar.dart (Flutter)
// Provides: Toast.success(), Toast.error(), Toast.warning(), Toast.info()

import { Notyf } from 'notyf'

let _notyf: Notyf | null = null

function _getInstance(): Notyf {
  if (!_notyf) {
    _notyf = new Notyf({
      duration: 4000,
      position: { x: 'right', y: 'bottom' },
      dismissible: true,
      ripple: false,
      types: [
        {
          type:       'success',
          background: '#1A7F37',
          icon:       { className: 'bi bi-check-circle-fill', tagName: 'i', color: '#fff' },
        },
        {
          type:       'error',
          background: '#C60026',
          icon:       { className: 'bi bi-exclamation-circle-fill', tagName: 'i', color: '#fff' },
        },
        {
          type:       'warning',
          background: '#9A6700',
          icon:       { className: 'bi bi-exclamation-triangle-fill', tagName: 'i', color: '#fff' },
        },
        {
          type:       'info',
          background: '#004BA0',
          icon:       { className: 'bi bi-info-circle-fill', tagName: 'i', color: '#fff' },
        },
      ],
    })
  }
  return _notyf
}

export const Toast = {
  success(message: string): void {
    _getInstance().success(message)
  },

  error(message: string): void {
    _getInstance().error(message)
  },

  warning(message: string): void {
    _getInstance().open({ type: 'warning', message })
  },

  info(message: string): void {
    _getInstance().open({ type: 'info', message })
  },

  /** Show a toast from an unknown error — maps codes to friendly messages */
  fromError(error: unknown): void {
    const err = error as { code?: string; message?: string; name?: string }
    let msg = 'Something went wrong. Please try again.'
    switch (err?.code) {
      case '42501':    msg = "You don't have permission to perform this action."; break
      case 'PGRST116': msg = 'The record was not found.'; break
      case 'PGRST301': msg = 'Your session has expired. Please log in again.'; break
      case '23505':    msg = 'A record with these details already exists.'; break
      default:
        // Respect custom messages passed down from RepositoryError
        if (err?.message) {
          msg = err.message
        }
        break
    }
    _getInstance().error(msg)
  },
}