// src/core/upgrade.ts
// Upgrade/Maintenance View
// Displays a waiting screen indicating system is under upgrade

export interface UpgradeConfig {
  title?: string
  message?: string
  estimatedTime?: string
  showStatus?: boolean
}

const DEFAULT_CONFIG: UpgradeConfig = {
  title: 'System Upgrade in Progress',
  message: 'We\'re currently upgrading CACI Hub to bring you better performance and features. Thank you for your patience.',
  estimatedTime: '30 minutes',
  showStatus: true
}

export function createUpgradeView(config: Partial<UpgradeConfig> = {}): HTMLDivElement {
  const settings = { ...DEFAULT_CONFIG, ...config }

  const container = document.createElement('div')
  container.id = 'upgrade-view'
  container.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    width: 100%;
    background: linear-gradient(160deg, #0a1628 0%, #004BA0 60%, #0d2a5e 100%);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #fff;
    padding: 2rem;
  `

  container.innerHTML = `
    <style>
      @keyframes upgrade-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes upgrade-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.85; transform: scale(0.97); }
      }
      @keyframes upgrade-fadein {
        from { opacity: 0; transform: translateY(16px); }
        to { opacity: 1; transform: translateY(0); }
      }
      #upgrade-view .upgrade-card {
        animation: upgrade-fadein 0.6s ease both;
      }
      #upgrade-view .upgrade-logo-ring {
        animation: upgrade-spin 3s linear infinite;
      }
      #upgrade-view .upgrade-logo-wrap {
        animation: upgrade-pulse 3s ease-in-out infinite;
      }
    </style>

    <div class="upgrade-card" style="
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2rem;
      max-width: 480px;
      text-align: center;
    ">

      <!-- Logo in spinning ring -->
      <div class="upgrade-logo-wrap" style="
        position: relative;
        width: 110px;
        height: 110px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <!-- Spinning ring -->
        <svg
          class="upgrade-logo-ring"
          width="110"
          height="110"
          viewBox="0 0 110 110"
          style="position: absolute; top: 0; left: 0;"
        >
          <circle
            cx="55" cy="55" r="50"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            stroke-width="3"
          />
          <circle
            cx="55" cy="55" r="50"
            fill="none"
            stroke="#C60026"
            stroke-width="3"
            stroke-dasharray="80 234"
            stroke-linecap="round"
          />
        </svg>

        <!-- Logo circle -->
        <div style="
          width: 84px;
          height: 84px;
          border-radius: 50%;
          overflow: hidden;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(198, 0, 38, 0.35), 0 8px 32px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <img
            src="/caci-logo.jpeg"
            alt="CACI Hub Logo"
            style="
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
            "
          />
        </div>
      </div>

      <!-- Title -->
      <div>
        <h1 style="
          font-size: 26px;
          font-weight: 700;
          margin: 0 0 0.4rem 0;
          color: #ffffff;
          letter-spacing: -0.3px;
        ">${settings.title}</h1>
        <div style="
          width: 40px;
          height: 3px;
          background: #C60026;
          border-radius: 2px;
          margin: 0 auto;
        "></div>
      </div>

      <!-- Message -->
      <p style="
        font-size: 15px;
        line-height: 1.7;
        margin: 0;
        color: rgba(255, 255, 255, 0.8);
      ">${settings.message}</p>

      <!-- Status badge -->
      ${settings.showStatus ? `
        <div style="
          background: rgba(198, 0, 38, 0.12);
          border: 1px solid rgba(198, 0, 38, 0.35);
          border-radius: 100px;
          padding: 0.5rem 1.25rem;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255,255,255,0.9);
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C60026" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          Come back later
        </div>
      ` : ''}

      <!-- Additional Info -->
      <div style="
        margin-top: 0.5rem;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.5);
        line-height: 1.8;
      ">
        <p style="margin: 0.3rem 0;">
          No action is required from you. We'll be back online shortly.
        </p>
        <p style="margin: 0.3rem 0;">
          For support, contact us at <a href="mailto:support@cacihub.org" style="
            color: rgba(255,255,255,0.75);
            text-decoration: underline;
            text-underline-offset: 2px;
          ">support@cacihub.org</a>
        </p>
      </div>

    </div>
  `

  return container
}

export function renderUpgradeView(
  targetElement: string | HTMLElement = '#app',
  config?: Partial<UpgradeConfig>
): void {
  const target = typeof targetElement === 'string'
    ? document.querySelector(targetElement)
    : targetElement

  if (!target) {
    console.error('[upgrade] Target element not found')
    return
  }

  const view = createUpgradeView(config)
  target.innerHTML = ''
  target.appendChild(view)
}

export function isInUpgradeMode(): boolean {
  // Check for an environment variable or feature flag
  // Can be set via:
  // - VITE_UPGRADE_MODE=true
  // - localStorage
  // - Server response
  return (
    import.meta.env.VITE_UPGRADE_MODE === 'true' ||
    localStorage.getItem('upgradeMode') === 'true'
  )
}
