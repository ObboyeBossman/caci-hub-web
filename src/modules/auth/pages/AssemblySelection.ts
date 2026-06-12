// src/modules/auth/pages/AssemblySelection.ts
// Stage 2 — App Boot Flow
//
// Public page (no auth required) where users pick their church assembly.
// Stores the selection in sessionStorage so Login can display branded UI.

import { supabase } from '../../../core/supabase'
import { navigate } from '../../../core/router'
import type { PageModule } from '../../../types/module.types'
import { logoUrl } from '@shell/Shell'
import { debounce } from '@shared/utils/debounce'

interface Assembly {
  id: string
  name: string
  assembly_code: string
  address: string | null
}

let _container: HTMLElement | null = null



export const AssemblySelection: PageModule = {

  async render(container: HTMLElement) {
    _container = container

    // ── Fetch assemblies (public read — no auth needed) ───────────────────────
    console.log('[AssemblySelection] Fetching assemblies…')

    let data: Assembly[] | null = null
    let fetchError: unknown = null

    try {
      const result = await Promise.race([
        supabase
          .from('assemblies')
          .select('id, name, address, assembly_code')
          .eq('is_active', true)
          .order('name'),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Fetch timeout')), 5000)
        ),
      ])
      data = result.data as Assembly[] | null
      fetchError = result.error
    } catch (e) {
      console.error('[AssemblySelection] Fetch failed or timed out:', e)
      fetchError = e
    }

    console.log('[AssemblySelection] Fetch complete', { count: data?.length, fetchError })
    const assemblies: Assembly[] = data ?? []

    // ── Render ────────────────────────────────────────────────────────────────
    container.innerHTML = `
      <div class="auth-root" id="asm-root">

        <div class="auth-header">
          <a class="auth-logo" href="#" aria-label="CACI Hub home">
            <img src="${logoUrl}" alt="CACI Logo" class="auth-logo-img">
            <div class="auth-logo-text">CACI Hub</div>
          </a>
        </div>
        <div class="red-bar"></div>

        <!-- Body -->
        <div class="auth-container">
          <div class="auth-box">

            <!-- Church Branding -->
            <div class="auth-church-brand">
              <div class="auth-church-logo-wrap">
                <img src="${logoUrl}" alt="Christ Apostolic Church International logo">
              </div>
              <div>
                <div class="auth-church-name">Christ Apostolic Church International</div>
                <div class="auth-church-motto">"One Fold, One Shepherd"</div>
              </div>
              <div class="auth-church-divider"></div>
            </div>

            <div class="auth-heading">
              <div class="auth-h1">Select your assembly</div>
              <div class="auth-subtitle">Choose the assembly you belong to</div>
            </div>

            ${fetchError ? `
              <div class="auth-alert auth-alert-error" style="margin-bottom:16px;">
                Could not load assemblies. Please check your connection and refresh.
              </div>` : ''}

            <div class="auth-card">

              <!-- Search -->
              <div class="auth-field" style="margin-bottom:16px;">
                <label class="auth-label" for="asm-search">Search assemblies</label>
                <div class="auth-input-wrap">
                  <svg class="auth-input-icon" width="14" height="14" viewBox="0 0 16 16"
                    fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <circle cx="6.5" cy="6.5" r="5"/>
                    <path d="M11 11l3 3"/>
                  </svg>
                  <input class="auth-input" type="text" id="asm-search"
                    placeholder="Name or location…" autocomplete="off" />
                </div>
              </div>

              <span class="section-label">Available assemblies</span>

              <!-- Assembly list -->
              <div id="asm-list" class="assembly-list">
                ${assemblies.length === 0 && !fetchError ? `
                  <p style="text-align:center;color:var(--auth-text-secondary);
                             font-size: var(--text-base);padding:20px 0;margin:0;">
                    No assemblies found.
                  </p>` : ''}

                ${assemblies.map(a => `
                  <div class="assembly-item"
                    data-id="${a.id}"
                    data-name="${escapeAttr(a.name)}"
                    data-code="${escapeAttr(a.assembly_code)}"
                    data-loc="${escapeAttr(a.address ?? '')}"
                    role="button" tabindex="0"
                    aria-label="Select ${escapeAttr(a.name)}">

                    <div class="assembly-avatar">
                      ${getInitials(a.name)}
                    </div>

                    <div class="assembly-info">
                      <p class="assembly-name">${escapeHtml(a.name)}</p>

                      <p class="assembly-loc">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                          <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        <span class="assembly-loc-text">${escapeHtml(a.address ?? 'Location unknown')}</span>
                      </p>
                    </div>

                    <div class="assembly-check">
                      <i>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </i>
                    </div>

                  </div>
                `).join('')}
              </div>

              <!-- No-results message (shown by JS) -->
              <div id="asm-empty" class="empty-state" style="display:none;padding:20px 0;text-align:center;">
                <p style="font-size: var(--text-base);color:var(--auth-text-secondary);margin:0;">
                  No assemblies match "<span id="asm-empty-term"></span>"
                </p>
              </div>

              <button id="asm-continue-btn" class="auth-btn auth-btn-primary" disabled>
                Continue
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>

            </div><!-- /.auth-card -->

            <div class="auth-card" style="text-align:center;padding:14px 20px;">
              <span style="color:var(--auth-text-secondary);font-size: var(--text-base);">
                Can't find your assembly?
                <a class="auth-link" href="mailto:support@cacihub.org"
                   style="margin-left:4px;font-size: var(--text-base);">
                  Contact support
                </a>
              </span>
            </div>

          </div><!-- /.auth-box -->
        </div><!-- /.auth-container -->

        <div class="auth-footer">
          <div class="auth-footer-links">
            <a class="auth-link" style="font-size: var(--text-sm);color:var(--auth-footer);">Help</a>
            <a class="auth-link" style="font-size: var(--text-sm);color:var(--auth-footer);">Privacy</a>
            <a class="auth-link" style="font-size: var(--text-sm);color:var(--auth-footer);">Terms</a>
          </div>
        </div>

      </div><!-- /.auth-root -->
    `

    // ── Query elements ────────────────────────────────────────────────────────
    const root = container.querySelector<HTMLElement>('#asm-root')!
    const items = container.querySelectorAll<HTMLElement>('.assembly-item')
    const searchEl = container.querySelector<HTMLInputElement>('#asm-search')!
    const continueBtn = container.querySelector<HTMLButtonElement>('#asm-continue-btn')!
    const emptyEl = container.querySelector<HTMLElement>('#asm-empty')!
    const emptyTerm = container.querySelector<HTMLElement>('#asm-empty-term')!

    let selectedId: string | null = null

    // ── Select an item ────────────────────────────────────────────────────────
    const selectItem = (item: HTMLElement) => {
      // Remove selected state from all items — CSS handles visual diff
      items.forEach(i => i.classList.remove('selected'))

      // Apply selected state — CSS (.assembly-item.selected) takes over styling
      item.classList.add('selected')
      selectedId = item.dataset.id!

      // Persist for Login branding
      sessionStorage.setItem('selectedAssembly', JSON.stringify({
        id: item.dataset.id,
        name: item.dataset.name,
        assembly_code: item.dataset.code,
        address: item.dataset.loc || null,
      }))

      continueBtn.disabled = false
    }

    items.forEach(item => {
      item.addEventListener('click', () => selectItem(item))
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          selectItem(item)
        }
      })
    })

    // ── Search filter ─────────────────────────────────────────────────────────
    // Hide all items initially
    items.forEach(item => item.style.display = 'none')

    const _performSearch = debounce((q: string) => {
      let visible = 0

      items.forEach(item => {
        const nameMatch = item.dataset.name!.toLowerCase().includes(q)
        const locMatch = item.dataset.loc!.toLowerCase().includes(q)

        // Only show if >= 2 chars typed and matches name/location
        const show = q.length >= 2 && (nameMatch || locMatch)

        item.style.display = show ? '' : 'none'
        if (show) visible++
      })

      emptyTerm.textContent = searchEl.value
      // Only show empty state if user has typed >= 2 chars and nothing matches
      emptyEl.style.display = visible === 0 && q.length >= 2 ? 'block' : 'none'
    }, 300)

    searchEl.addEventListener('input', () => {
      _performSearch(searchEl.value.trim().toLowerCase())
    })

    // ── Continue → Login ──────────────────────────────────────────────────────
    continueBtn.addEventListener('click', () => {
      if (selectedId) navigate('/login')
    })

    // sync root class to current theme on mount (for auth.css)
    const isDark = document.documentElement.dataset['theme'] === 'dark'
    root.classList.toggle('dark', isDark)
  },

  destroy() {
    _container = null
  },
}

export default AssemblySelection

// ── Tiny helpers (keep at module level) ──────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function getInitials(name: string): string {
  return name.split(' ')
    .filter(n => n.length > 0)
    .map(n => n[0].toUpperCase())
    .slice(0, 2)
    .join('')
}