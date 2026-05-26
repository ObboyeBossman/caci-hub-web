import type { PageModule } from '../../../types/module.types'

const ProvisionUser: PageModule = {
  async render(container) {
    const params = new URLSearchParams(window.location.hash.split('?')[1])
    const memberId = params.get('memberId')

    container.innerHTML = `
      <div style="padding:24px;max-width:600px;margin:0 auto;">
        <h2 style="margin-bottom: 24px;">Provision Login</h2>
        <div style="background:var(--card-bg, #fff);border:1px solid var(--border-color, #ccc);border-radius:12px;padding:24px;">
          <p style="color:var(--text-secondary, #666);margin-bottom:16px;">Provision User (Stub) for memberId ${memberId}</p>
          <p>Please implement the three-path provisioning here.</p>
          <button onclick="history.back()">Back</button>
        </div>
      </div>
    `
  },
  destroy() {}
}

export default ProvisionUser
