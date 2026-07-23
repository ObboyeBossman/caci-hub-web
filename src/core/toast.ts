// src/core/toast.ts
// Robust Toast utility with fallback logging

console.log('[toast] Module loaded');

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

let _toastCounter = 0

function _ensureToastEnvironment() {
  if (!document.getElementById('global-toast-portal')) {
    const portal = document.createElement('div')
    portal.id = 'global-toast-portal'
    // Ensure portal is visible and on top
    Object.assign(portal.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: '100000', // Increased
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      pointerEvents: 'none'
    })
    document.body.appendChild(portal)
    console.log('[toast] Portal created and attached to body');
  }
}

export function showToast(title: string, message: string, variant: ToastVariant = 'info') {
  console.log('[toast] showToast called:', { variant, title, message });
  
  try {
    _ensureToastEnvironment()

    const portal = document.getElementById('global-toast-portal')!
    const id = `toast-${++_toastCounter}`

    const colors = {
      success: '#47D764',
      error: '#ff355b',
      info: '#2F86EB',
      warning: '#FFC021'
    }

    const toast = document.createElement('div')
    toast.id = id
    toast.className = `toast-item ${variant}`

    // Inline styles as fallback for CSS loading issues
    Object.assign(toast.style, {
      pointerEvents: 'auto',
      minWidth: '300px',
      maxWidth: '400px',
      backgroundColor: '#ffffff',
      borderLeft: `8px solid ${colors[variant]}`,
      borderRadius: '8px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      fontFamily: 'sans-serif',
      opacity: '0',
      transform: 'translateY(20px)',
      transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    })

    toast.innerHTML = `
      <div style="flex: 1;">
        <div style="font-weight: 800; color: #101020; margin-bottom: 4px; font-size: 14px;">${title}</div>
        <div style="font-size: 13px; color: #555; line-height: 1.4;">${message}</div>
      </div>
      <button style="background: #eee; border: none; font-size: 18px; cursor: pointer; color: #333; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">&times;</button>
    `

    portal.appendChild(toast)

    // Trigger animation
    setTimeout(() => {
      toast.style.opacity = '1'
      toast.style.transform = 'translateY(0)'
    }, 50)

    const dismiss = () => {
      toast.style.opacity = '0'
      toast.style.transform = 'translateY(20px)'
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 400)
    }

    const btn = toast.querySelector('button');
    if (btn) btn.onclick = dismiss;

    setTimeout(dismiss, 6000)

  } catch (err) {
    console.error('[toast] CRITICAL ERROR:', err);
    alert(`${title}: ${message}`);
  }
}

// @ts-ignore
window.showToast = showToast;
