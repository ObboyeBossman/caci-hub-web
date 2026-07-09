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
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #fff;
    padding: 2rem;
  `

  container.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2rem;
      max-width: 500px;
      text-align: center;
    ">
      <!-- Animated Loading Icon -->
      <div style="
        width: 80px;
        height: 80px;
        position: relative;
      ">
        <svg
          width="80"
          height="80"
          viewBox="0 0 80 80"
          style="
            animation: rotation 2s linear infinite;
          "
        >
          <defs>
            <style>
              @keyframes rotation {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            </style>
          </defs>
          <circle
            cx="40"
            cy="40"
            r="35"
            fill="none"
            stroke="rgba(255, 255, 255, 0.3)"
            stroke-width="4"
          />
          <circle
            cx="40"
            cy="40"
            r="35"
            fill="none"
            stroke="#fff"
            stroke-width="4"
            stroke-dasharray="54.98 219.92"
            stroke-linecap="round"
            style="
              animation: rotation 2s linear infinite;
            "
          />
        </svg>
      </div>

      <!-- Title -->
      <div>
        <h1 style="
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 0.5rem 0;
          color: #fff;
        ">${settings.title}</h1>
      </div>

      <!-- Message -->
      <p style="
        font-size: 16px;
        line-height: 1.6;
        margin: 0;
        opacity: 0.95;
        color: rgba(255, 255, 255, 0.9);
      ">${settings.message}</p>

      <!-- Status Information -->
      ${settings.showStatus ? `
        <div style="
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          padding: 1rem;
          width: 100%;
          margin-top: 1rem;
        ">
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            font-size: 14px;
            opacity: 0.9;
          ">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>Estimated time: ${settings.estimatedTime}</span>
          </div>
        </div>
      ` : ''}

      <!-- Additional Info -->
      <div style="
        margin-top: 2rem;
        font-size: 13px;
        opacity: 0.75;
        color: rgba(255, 255, 255, 0.85);
      ">
        <p style="margin: 0.5rem 0;">
          No action is required from you. We'll be back online shortly.
        </p>
        <p style="margin: 0.5rem 0;">
          For support, contact us at <a href="mailto:support@cacihub.org" style="
            color: #fff;
            text-decoration: underline;
            opacity: 0.9;
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
