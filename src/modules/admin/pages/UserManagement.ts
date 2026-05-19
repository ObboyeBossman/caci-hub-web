// src/modules/admin/pages/UserManagement.ts
// Phase 2 stub — not yet implemented.

import type { PageModule } from '../../../types/module.types'

export default {
  render(container: HTMLElement): Promise<void> {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;
        justify-content:center;min-height:60vh;gap:1rem;
        font-family:var(--font-sans);color:var(--text-secondary)">
        <i class="bi bi-people" style="font-size:3rem;color:var(--caci-n400)"></i>
        <h2 style="margin:0;color:var(--text-primary);font-size:1.25rem">
          User Management
        </h2>
        <p style="margin:0;font-size:0.875rem;text-align:center;max-width:320px">
          User provisioning and role management are coming in Phase 2.
        </p>
      </div>
    `
    return Promise.resolve()
  },
} satisfies PageModule