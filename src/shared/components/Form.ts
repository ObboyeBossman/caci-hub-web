// src/shared/components/Form.ts
// Zod error display helpers and form utility functions.
// All form pages use these to show field-level validation errors.

import type { ZodError, ZodIssue } from 'zod'

/**
 * Show Zod validation errors in the form.
 * Finds [data-field="fieldName"] elements and inserts error messages below them.
 *
 * Usage:
 *   const result = Schema.safeParse(formData)
 *   if (!result.success) {
 *     showFormErrors(formEl, result.error)
 *     return
 *   }
 */
export function showFormErrors(form: HTMLElement, error: ZodError): void {
  // Clear existing errors first
  clearFormErrors(form)

  for (const issue of error.issues) {
    const field = issue.path[0] as string
    if (!field) continue

    const input = form.querySelector<HTMLElement>(`[data-field="${field}"]`)
    if (!input) continue

    input.classList.add('is-invalid')

    const msg = document.createElement('div')
    msg.className = 'field-error'
    msg.dataset['errorFor'] = field
    msg.innerHTML = `<i class="bi bi-exclamation-circle-fill" style="font-size:11px"></i> ${issue.message}`
    input.insertAdjacentElement('afterend', msg)
  }

  // Focus the first invalid field
  const firstInvalid = form.querySelector<HTMLElement>('.is-invalid')
  firstInvalid?.focus()
}

/** Clear all validation errors from the form. */
export function clearFormErrors(form: HTMLElement): void {
  form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'))
  form.querySelectorAll('[data-error-for]').forEach(el => el.remove())
}

/** Clear the error for a single field (on input change). */
export function clearFieldError(form: HTMLElement, field: string): void {
  const input = form.querySelector<HTMLElement>(`[data-field="${field}"]`)
  input?.classList.remove('is-invalid')
  form.querySelector(`[data-error-for="${field}"]`)?.remove()
}

/**
 * Collect form field values into a plain object.
 * Reads all [data-field] inputs, selects, and textareas.
 * Returns null values for empty strings (for optional DB fields).
 */
export function collectFormData(form: HTMLElement): Record<string, string | null> {
  const data: Record<string, string | null> = {}

  form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    '[data-field]'
  ).forEach(el => {
    const field = el.dataset['field']!
    const value = el.value.trim()
    data[field] = value === '' ? null : value
  })

  return data
}

/**
 * Set a form submit button into loading state.
 * Returns a function to restore the original state.
 */
export function setSubmitLoading(btn: HTMLButtonElement): () => void {
  const original = btn.innerHTML
  btn.disabled  = true
  btn.innerHTML = `
    <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
    Saving…
  `
  return () => {
    btn.disabled  = false
    btn.innerHTML = original
  }
}