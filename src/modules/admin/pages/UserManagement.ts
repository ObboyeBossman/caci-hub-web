import type { PageModule } from '../../../types/module.types'

const UserManagement: PageModule = {
  async render(container) {
    container.innerHTML = `
      <div style="padding:24px;max-width:800px;margin:0 auto;">
        <h2 style="margin-bottom: 24px;">User Management</h2>
        <div style="background:var(--card-bg, #fff);border:1px solid var(--border-color, #ccc);border-radius:12px;padding:24px;">
          <p style="color:var(--text-secondary, #666);margin-bottom:16px;">User Management (Stub)</p>
          <p>Please implement the full datagrid of Auth Users here.</p>
        </div>
      </div>
    `
  },
  destroy() {}
}

export default UserManagement
