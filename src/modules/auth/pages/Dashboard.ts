// src/modules/auth/pages/Dashboard.ts
// Temporary placeholder for the authenticated root page.
// This will eventually be replaced by the Dashboard module.

import type { PageModule } from '../../../types/module.types'
import { getCurrentUser } from '../../../core/auth'

export const Dashboard: PageModule = {
  async render(container: HTMLElement) {
    const user = getCurrentUser()
    
    container.innerHTML = `
      <div class="p-4">
        <div class="card p-5 text-center shadow-sm" style="border-radius: 12px; border: none; background: var(--caci-n050);">
          <div class="display-6 mb-3" style="color: var(--caci-blue); font-weight: 700;">Welcome, ${user?.fullName}!</div>
          <p class="text-secondary mb-4">You have successfully authenticated into the CACI Hub.</p>
          
          <div class="alert alert-info d-inline-block mx-auto" style="border-radius: 8px;">
            <i class="bi bi-info-circle me-2"></i>
            The full Dashboard module is coming in the next phase of development.
          </div>
          
          <div class="mt-4 pt-3 border-top">
            <p class="small text-muted mb-3">Currently active modules:</p>
            <span class="badge bg-primary px-3 py-2 rounded-pill">
              <i class="bi bi-shield-lock me-1"></i> Authentication
            </span>
          </div>
        </div>
      </div>
    `
  }
}

export default Dashboard
