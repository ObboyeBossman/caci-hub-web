// src/modules/membership/pages/Home.ts

import type { PageModule } from '../../../types/module.types'
import { renderBreadcrumbs } from '../../../shell/Breadcrumbs'
import { getCurrentUser } from '@core/auth'

export default {
  async render(container: HTMLElement) {
    const user = getCurrentUser()
    const firstName = user?.fullName?.split(' ')[0] ?? 'Member'

    container.innerHTML = /* html */`
      <!-- Header -->
      <div class="page-header" style="margin-bottom: 24px;">
        <h1 class="page-title">Welcome back, ${firstName}</h1>
        <p class="text-secondary" style="margin-top: 4px; font-size: 0.929rem;">
          Here's a quick overview of your latest updates and activities.
        </p>
      </div>

      <!-- Placeholder content container -->
      <div style="
        background: var(--bg-card); 
        border: 1px solid var(--border-default); 
        border-radius: var(--radius-lg, 10px); 
        padding: 40px; 
        text-align: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.04);
      ">
        <i class="bi bi-rocket-takeoff" style="font-size: 3rem; color: var(--caci-blue-light); opacity: 0.8;"></i>
        <h2 style="font-size: 1.25rem; font-weight: 600; margin-top: 16px; margin-bottom: 8px;">Home Dashboard</h2>
        <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto; font-size: 0.929rem;">
          This area is under active construction. Soon you will see notifications, upcoming events, and quick actions tailored just for you.
        </p>
      </div>
    `
    // Add breadcrumbs at the top
    renderBreadcrumbs(container, [{ label: 'Home' }])
  },

  destroy() {
    // Cleanup if necessary
  }
} satisfies PageModule
