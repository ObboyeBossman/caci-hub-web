// src/modules/accounts/pages/RoleManagerPage.ts
// Shell page that mounts the RoleManager component.
// Route: /accounts/roles

import type { PageModule } from '../../../types/module.types'
import { renderRoleManager } from '../components/RoleManager'
import { navigate } from '@core/router'

let _container: HTMLElement | null = null

const RoleManagerPage: PageModule = {
  async render(container) {
    _container = container
    
    container.innerHTML = `
      <div class="mm-root" style="padding:24px;max-width:960px;margin:0 auto;">
        <!-- Back Link -->
        <button id="rmp-back" style="display:inline-flex;align-items:center;gap:6px;
          color:var(--mm-text-secondary);font-size:13px;border:none;background:none;
          cursor:pointer;margin-bottom:20px;font-family:inherit;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to Accounts
        </button>

        <h1 style="font-size:24px;margin:0 0 8px;color:var(--mm-text-primary);">Role Management</h1>
        <p style="color:var(--mm-text-secondary);margin:0 0 24px;font-size:14px;max-width:600px;line-height:1.5;">
          Define custom roles for this assembly and assign them specific permissions. 
          These roles act as an additional layer of access control on top of the base user level.
        </p>

        <!-- RoleManager mounts here -->
        <div id="rmp-mount"></div>
      </div>
    `

    container.querySelector('#rmp-back')?.addEventListener('click', () => navigate('/accounts'))

    const mountPoint = container.querySelector('#rmp-mount') as HTMLElement
    if (mountPoint) {
      await renderRoleManager(mountPoint)
    }
  },

  destroy() {
    _container = null
  }
}

export default RoleManagerPage
