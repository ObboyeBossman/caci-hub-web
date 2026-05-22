// src/modules/settings/pages/utils/settingsToast.ts

export function makeToast(overlayEl: HTMLElement) {
  return function toast(msg: string, type: 'check' | 'error' | 'warn' = 'check'): void {
    const t = overlayEl.querySelector<HTMLElement>('#s-toast');
    if (!t) return;
    const icon = type === 'check' ? 'check-circle' : type === 'error' ? 'x-circle' : 'exclamation-triangle';
    t.className = `settings-toast${type === 'error' ? ' toast-error' : type === 'warn' ? ' toast-warn' : ''}`;
    t.innerHTML = `<i class="bi bi-${icon}"></i> ${msg}`;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
  };
}