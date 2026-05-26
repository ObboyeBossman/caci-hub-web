import type { PageModule } from '../../../types/module.types'
import { Toast } from '../../../shared/components/Toast'
import { navigate } from '../../../core/router'
import { supabase } from '../../../core/supabase'
import { emit } from '../../../core/events'
import { injectMembershipCSS } from '../utils/member-helpers'

let _container: HTMLElement | null = null

const BulkImport: PageModule = {
  async render(container) {
    _container = container
    injectMembershipCSS()

    container.innerHTML = `
<div class="mm-root" style="padding:24px;max-width:720px;margin:0 auto;">
  <button id="bi-back-btn" style="display:inline-flex;align-items:center;gap:6px;
    color:var(--mm-text-secondary);font-size:13px;border:none;background:none;
    cursor:pointer;margin-bottom:20px;font-family:inherit;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
    Back to Members
  </button>

  <div style="background:var(--mm-bg-card);border:1px solid var(--mm-border);border-radius:12px;padding:28px;">
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:var(--mm-text-primary);">Bulk Import Members</h2>
    <div style="font-size:13px;color:var(--mm-text-secondary);margin-bottom:24px;">Upload a CSV file to import multiple members at once. The file must include required fields like first name, last name, and a contact method.</div>

    <div class="mm-form-group">
      <label class="mm-form-label">CSV File *</label>
      <input class="mm-form-input" style="padding:8px" type="file" id="bi-file" accept=".csv">
    </div>

    <div class="mm-form-group" style="margin-top:16px;">
      <label class="mm-form-label" style="display:flex;align-items:center;gap:8px;font-weight:normal;cursor:pointer;">
        <input type="checkbox" id="bi-dryRun" checked style="width:16px;height:16px;">
        Dry Run (Validate without importing)
      </label>
    </div>

    <div style="display:flex;gap:10px;margin-top:24px;">
      <button class="mm-btn-primary" id="bi-save" style="flex:1;">Process Import</button>
      <button class="mm-btn-outline" id="bi-cancel">Cancel</button>
    </div>
  </div>
</div>`

    container.querySelector('#bi-back-btn')?.addEventListener('click', () => navigate('/members'))
    container.querySelector('#bi-cancel')?.addEventListener('click', () => navigate('/members'))
    container.querySelector('#bi-save')?.addEventListener('click', _handleImport)
  },
  destroy() {
    _container = null
  }
}

async function _handleImport() {
  if (!_container) return
  const fileInput = _container.querySelector<HTMLInputElement>('#bi-file')
  const dryRunEl = _container.querySelector<HTMLInputElement>('#bi-dryRun')

  const file = fileInput?.files?.[0]
  if (!file) {
    Toast.error('Please select a CSV file.')
    return
  }

  const isDryRun = dryRunEl?.checked ?? false

  const btn = _container.querySelector<HTMLButtonElement>('#bi-save')!
  btn.disabled = true
  btn.textContent = 'Processing...'

  try {
    const text = await file.text()
    // encode utf-8 strictly
    const utf8Bytes = new TextEncoder().encode(text)
    let binary = ''
    utf8Bytes.forEach((b) => binary += String.fromCharCode(b))
    const base64Data = btoa(binary)

    const { data, error } = await supabase.functions.invoke('bulk-import-members', {
      body: { fileData: base64Data, format: 'csv', dryRun: isDryRun }
    })

    if (error) {
      // try to parse message from supersabase edge fn
      let msg = 'Import failed'
      if (typeof error === 'object' && error !== null) {
        if ('context' in error) {
          try {
            const ctx = await (error as any).context.json()
            if (ctx.error) msg = ctx.error
          } catch {}
        }
        if ('message' in error) msg = (error as any).message
      }
      throw new Error(msg)
    }

    if (isDryRun) {
      if (data.errors && data.errors.length > 0) {
        Toast.warning(`Dry run finished with ${data.errors.length} errors. Disable dry run to force import valid records.`)
        console.error('Dry Run Errors:', data.errors)
      } else {
        Toast.success(`Dry run successful. ${data.successful} records ready to import.`)
      }
    } else {
      if (data.errors && data.errors.length > 0) {
        Toast.warning(`Imported ${data.successful} members. ${data.errors.length} records failed.`)
        console.error('Import Errors:', data.errors)
      } else {
        Toast.success(`Successfully imported ${data.successful} members.`)
      }
      emit('bulk-import:success')
      navigate('/members')
    }
  } catch (err: any) {
    Toast.error(err.message ?? 'An error occurred during import.')
  } finally {
    btn.disabled = false
    btn.textContent = 'Process Import'
  }
}

export default BulkImport
