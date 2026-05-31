// src/shared/components/ConfirmDialog.ts

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export class ConfirmDialog {
  /**
   * Shows a custom confirmation dialog and returns a Promise that resolves
   * to true if confirmed, false if cancelled.
   */
  static show(options: ConfirmDialogOptions | string): Promise<boolean> {
    if (typeof options === 'string') {
      options = { message: options };
    }
    
    const {
      title = 'Confirm',
      message,
      confirmText = 'OK',
      cancelText = 'Cancel',
      danger = false,
    } = options;

    return new Promise((resolve) => {
      // Remove any existing instance
      document.getElementById('caci-confirm-overlay')?.remove();

      const overlay = document.createElement('div');
      overlay.id = 'caci-confirm-overlay';
      overlay.style.cssText = [
        'position:fixed; inset:0; z-index:99999;',
        'background:rgba(0,0,0,0.6);',
        'display:flex; align-items:center; justify-content:center;',
        'padding:16px;',
        'transition: opacity 0.2s ease-out;'
      ].join('');

      const modalStyle = [
        'width:100%; max-width:400px;',
        'background:var(--bg-page);',
        'border:1px solid var(--border-default);',
        'border-radius:12px;',
        'padding:24px;',
        'box-shadow: 0 10px 40px rgba(0,0,0,0.3);',
        'display:flex; flexDirection:column; align-items:center;'
      ].join('');

      const primaryColor = danger ? 'var(--caci-danger, #f85149)' : 'var(--caci-blue, #58a6ff)';
      const primaryHover = danger ? 'var(--caci-danger-hover, #da3633)' : 'var(--caci-blue-hover, #3182ce)';

      overlay.innerHTML = `
        <div style="${modalStyle}">
          <!-- Heading -->
          <div style="font-size: var(--text-xl, 20px); font-weight:600; color:var(--text-primary); text-align:center; margin-bottom:12px; letter-spacing:-0.01em;">
            ${title}
          </div>
          
          <!-- Message -->
          <div style="font-size: var(--text-base, 14px); color:var(--text-secondary); text-align:center; line-height:1.5; margin-bottom:28px;">
            ${message}
          </div>

          <!-- Actions -->
          <div style="display:flex; gap:12px; width:100%;">
            <button id="cd-cancel" style="
              flex: 1;
              padding: 10px 16px;
              background: transparent;
              color: var(--text-primary);
              border: 1px solid var(--border-default);
              border-radius: 8px;
              font-family: inherit;
              font-size: var(--text-base, 14px);
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s ease;
            ">${cancelText}</button>
            <button id="cd-confirm" style="
              flex: 1;
              padding: 10px 16px;
              background: ${primaryColor};
              color: #ffffff;
              border: none;
              border-radius: 8px;
              font-family: inherit;
              font-size: var(--text-base, 14px);
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s ease;
            ">${confirmText}</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const cancelBtn = overlay.querySelector<HTMLButtonElement>('#cd-cancel')!;
      const confirmBtn = overlay.querySelector<HTMLButtonElement>('#cd-confirm')!;

      // Hover effects
      cancelBtn.addEventListener('mouseenter', () => cancelBtn.style.background = 'var(--bg-hover)');
      cancelBtn.addEventListener('mouseleave', () => cancelBtn.style.background = 'transparent');
      confirmBtn.addEventListener('mouseenter', () => confirmBtn.style.background = primaryHover);
      confirmBtn.addEventListener('mouseleave', () => confirmBtn.style.background = primaryColor);

      const close = (result: boolean) => {
        overlay.style.opacity = '0';
        setTimeout(() => {
          overlay.remove();
          resolve(result);
        }, 150); // slight delay for animation
      };

      cancelBtn.addEventListener('click', () => close(false));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
      confirmBtn.addEventListener('click', () => close(true));
    });
  }
}
