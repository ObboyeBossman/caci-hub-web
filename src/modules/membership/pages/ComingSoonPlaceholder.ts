// src/modules/membership/pages/ComingSoonPlaceholder.ts
import type { PageModule } from '../../../types/module.types'
import { renderBreadcrumbs } from '../../../shell/Breadcrumbs'

export function createPlaceholder(title: string): PageModule {
  return {
    async render(container: HTMLElement) {
      container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:60vh; padding:24px; text-align:center; font-family:var(--font-sans);">
          <div style="width:80px; height:80px; border-radius:50%; background:var(--bg-info); display:flex; align-items:center; justify-content:center; font-size:32px; margin-bottom:24px; color:var(--caci-blue);">
            <i class="bi bi-rocket-takeoff"></i>
          </div>
          <h1 style="font-size:2rem; font-weight:700; color:var(--text-primary); margin:0 0 12px 0;">${title} is Coming Soon</h1>
          <p style="font-size:1.1rem; color:var(--text-secondary); max-width:480px; line-height:1.6; margin:0 0 32px 0;">
            We're working hard to bring you this feature. Check back soon for updates!
          </p>
          <button class="btn btn-primary" onclick="history.back()">Go Back</button>
        </div>
      `
      renderBreadcrumbs(container, [{ label: title }])
    },
    destroy() {}
  }
}
