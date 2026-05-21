// src/modules/auth/pages/AssemblySelection.ts
// Stage 2 — App Boot Flow
//
// Public page (no auth required) where users pick their church assembly.
// Stores the selection in sessionStorage so Login can display branded UI.
// Ported from: src/splash/caci_assembly_selection_v3.html

import { supabase } from '../../../core/supabase'
import { navigate }  from '../../../core/router'
import type { PageModule } from '../../../types/module.types'

interface Assembly {
  id:               string
  name:             string
  assembly_code:    string
  address:          string | null
}

let _container: HTMLElement | null = null

export const AssemblySelection: PageModule = {

  async render(container: HTMLElement) {
    _container = container

    // Fetch assemblies (public read — no auth needed) ─────────────────────────
    console.log('[AssemblySelection] Fetching assemblies...')
    
    let data: any[] | null = null
    let error: any = null

    try {
      // Race the supabase fetch against a 5 second timeout
      const result = await Promise.race([
        supabase
          .from('assemblies')
          .select('id, name, address, assembly_code')
          .eq('is_active', true)
          .order('name'),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), 5000))
      ])
      data = result.data
      error = result.error
    } catch (e) {
      console.error('[AssemblySelection] Fetch failed or timed out:', e)
      error = e
    }

    console.log('[AssemblySelection] Fetch complete', { count: data?.length, error })
    const assemblies: Assembly[] = (data ?? []) as Assembly[]


    if (error) {
      console.error('[AssemblySelection] fetch failed:', error)
    }

    // ── Render ────────────────────────────────────────────────────────────────
    container.innerHTML = `
      <div class="auth-root" id="asm-root">

        <div class="auth-header">
          <a class="auth-logo" href="#" aria-label="CACI Hub home">
            <div class="auth-cross" aria-hidden="true"></div>
            <div class="auth-logo-text">CACI Hub</div>
          </a>
          <div class="auth-theme-toggle" id="asm-theme-toggle" role="button" tabindex="0" aria-label="Toggle theme">
            <span class="auth-toggle-icon">☀️</span>
            <div class="auth-toggle-track"><div class="auth-toggle-thumb"></div></div>
            <span class="auth-toggle-label">Light</span>
          </div>
        </div>
        <div class="red-bar"></div>

        <div class="auth-container">
          <div class="auth-box">

            <div class="auth-heading">
              <div class="auth-h1">Select your assembly</div>
              <div class="auth-subtitle">Choose the assembly you belong to</div>
            </div>

            ${error ? `
              <div class="auth-alert auth-alert-error" style="margin-bottom:16px;">
                Could not load assemblies. Please check your connection and refresh.
              </div>` : ''}

            <div class="auth-card">

              <div class="auth-field" style="margin-bottom:16px;">
                <label class="auth-label" for="asm-search">Search assemblies</label>
                <div class="auth-input-wrap">
                  <svg class="auth-input-icon" width="14" height="14" viewBox="0 0 16 16" fill="none"
                    stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <circle cx="6.5" cy="6.5" r="5"/><path d="M11 11l3 3"/>
                  </svg>
                  <input class="auth-input" type="text" id="asm-search"
                    placeholder="Name or location…" autocomplete="off" />
                </div>
              </div>

              <span class="section-label">Available assemblies</span>

              <div id="asm-list" class="assembly-list">
                ${assemblies.length === 0 && !error ? `
                  <p style="text-align:center;color:var(--auth-text-secondary);font-size:13px;padding:20px 0;">
                    No assemblies found.
                  </p>` : ''}
                ${assemblies.map(a => `
                  <div class="assembly-item" data-id="${a.id}"
                    data-name="${a.name}"
                    data-code="${a.assembly_code}"
                    data-loc="${a.address ?? ''}"
                    role="button" tabindex="0"
                    aria-label="Select ${a.name}">
                    <div class="assembly-avatar">
                      <span>${a.name.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div class="assembly-info">
                      <p class="assembly-name">${a.name}</p>
                      <p class="assembly-loc">
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none"
                          stroke="currentColor" stroke-width="2" aria-hidden="true">
                          <path d="M8 2C5.79 2 4 3.79 4 6c0 3.5 4 8 4 8s4-4.5 4-8c0-2.21-1.79-4-4-4z"/>
                          <circle cx="8" cy="6" r="1.5"/>
                        </svg>
                        ${a.address ?? 'Location unknown'}
                      </p>
                    </div>
                    <div class="assembly-check">
                      <svg class="assembly-check-icon" width="10" height="10"
                        viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2"
                        style="display:none" aria-hidden="true">
                        <polyline points="2 6 5 9 10 3"/>
                      </svg>
                    </div>
                  </div>
                `).join('')}
              </div>


              <div id="asm-empty" style="display:none;text-align:center;padding:20px 0;">
                <p style="font-size:13px;color:var(--auth-text-secondary);margin:0;">
                  No assemblies match "<span id="asm-empty-term"></span>"
                </p>
              </div>

              <button id="asm-continue-btn" class="auth-btn auth-btn-primary" disabled
                style="margin-top:16px;">
                Continue
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
                  stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4"/>
                </svg>
              </button>

            </div>

            <div class="auth-card" style="text-align:center;padding:14px 20px;">
              <span style="color:var(--auth-text-secondary);font-size:13px;">
                Can't find your assembly?
                <a class="auth-link" href="mailto:support@cacihub.org" style="margin-left:4px;font-size:13px;">
                  Contact support
                </a>
              </span>
            </div>

          </div>
        </div>

        <div class="auth-footer">
          <div class="auth-footer-links">
            <a class="auth-link" style="font-size:12px;color:var(--auth-footer);">Help</a>
            <a class="auth-link" style="font-size:12px;color:var(--auth-footer);">Privacy</a>
            <a class="auth-link" style="font-size:12px;color:var(--auth-footer);">Terms</a>
          </div>
        </div>

      </div>
    `

    // ── Interaction ───────────────────────────────────────────────────────────
    const items      = container.querySelectorAll<HTMLElement>('.assembly-item')
    const searchEl   = container.querySelector<HTMLInputElement>('#asm-search')!
    const continueBtn= container.querySelector<HTMLButtonElement>('#asm-continue-btn')!
    const emptyEl    = container.querySelector<HTMLElement>('#asm-empty')!
    const emptyTerm  = container.querySelector<HTMLElement>('#asm-empty-term')!
    let selectedId: string | null = null

    // Select item
    const selectItem = (item: HTMLElement) => {
      // Deselect previously selected
      items.forEach(i => {
        i.classList.remove('selected')
        const icon = i.querySelector<HTMLElement>('.assembly-check-icon')
        const circle = i.querySelector<HTMLElement>('.assembly-check')
        if (icon)   icon.style.display = 'none'
        if (circle) { circle.style.background = 'transparent'; circle.style.borderColor = 'var(--auth-card-border)' }
      })
      // Mark selected
      item.classList.add('selected')
      const icon   = item.querySelector<HTMLElement>('.assembly-check-icon')
      const circle = item.querySelector<HTMLElement>('.assembly-check')
      if (icon)   icon.style.display = 'block'
      if (circle) { circle.style.background = 'var(--auth-btn-primary)'; circle.style.borderColor = 'var(--auth-btn-primary)' }

      selectedId = item.dataset.id!

      // Persist to sessionStorage for Login branding
      sessionStorage.setItem('selectedAssembly', JSON.stringify({
        id:              item.dataset.id,
        name:            item.dataset.name,
        assembly_code:   item.dataset.code,
        address:         item.dataset.loc   || null,
      }))

      continueBtn.disabled = false
    }


    items.forEach(item => {
      item.addEventListener('click', () => selectItem(item))
      item.addEventListener('keydown', e => { if ((e as KeyboardEvent).key === 'Enter') selectItem(item) })
    })

    // Search filter
    searchEl.addEventListener('input', () => {
      const q = searchEl.value.toLowerCase()
      let visible = 0
      items.forEach(item => {
        const matches = !q ||
          item.dataset.name!.toLowerCase().includes(q) ||
          item.dataset.loc!.toLowerCase().includes(q)
        item.style.display = matches ? '' : 'none'
        if (matches) visible++
      })
      emptyTerm.textContent  = searchEl.value
      emptyEl.style.display  = visible === 0 && q ? 'block' : 'none'
    })

    // Continue → Login
    continueBtn.addEventListener('click', () => {
      if (selectedId) navigate('/login')
    })

    // Theme toggle (mirrors auth.css pattern)
    const themeBtn = container.querySelector<HTMLElement>('#asm-theme-toggle')
    themeBtn?.addEventListener('click', () => {
      const html = document.documentElement
      const next = html.dataset['theme'] === 'dark' ? 'light' : 'dark'
      html.dataset['theme'] = next
      localStorage.setItem('caci-theme', next)
      const icon  = container.querySelector<HTMLElement>('.auth-toggle-icon')
      const lbl   = container.querySelector<HTMLElement>('.auth-toggle-label')
      if (icon)  icon.textContent  = next === 'dark' ? '🌙' : '☀️'
      if (lbl)   lbl.textContent   = next === 'dark' ? 'Dark' : 'Light'
    })

    // Sync theme indicator on mount
    const theme = document.documentElement.dataset['theme'] ?? 'light'
    const icon  = container.querySelector<HTMLElement>('.auth-toggle-icon')
    const lbl   = container.querySelector<HTMLElement>('.auth-toggle-label')
    if (icon)  icon.textContent  = theme === 'dark' ? '🌙' : '☀️'
    if (lbl)   lbl.textContent   = theme === 'dark' ? 'Dark' : 'Light'
  },

  destroy() {
    _container = null
  },
}

export default AssemblySelection
