import './toast.css'

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

let _toastCounter = 0

// Inject required fonts and portal if not present
function _ensureToastEnvironment() {
  if (!document.getElementById('font-awesome-cdn')) {
    const link = document.createElement('link')
    link.id = 'font-awesome-cdn'
    link.rel = 'stylesheet'
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css'
    document.head.appendChild(link)
  }
  
  if (!document.getElementById('poppins-font-cdn')) {
    const link = document.createElement('link')
    link.id = 'poppins-font-cdn'
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap'
    document.head.appendChild(link)
  }

  if (!document.getElementById('global-toast-portal')) {
    const portal = document.createElement('div')
    portal.id = 'global-toast-portal'
    portal.className = 'toast-wrapper'
    document.body.appendChild(portal)
  }
}

export function showToast(title: string, message: string, variant: ToastVariant = 'info') {
  _ensureToastEnvironment()
  
  const portal = document.getElementById('global-toast-portal')!
  const id = `global-toast-${++_toastCounter}`
  
  const icons: Record<ToastVariant, string> = {
    success: 'fas fa-check-circle',
    error: 'fas fa-times-circle',
    info: 'fas fa-info-circle',
    warning: 'fas fa-exclamation-circle'
  }

  const toast = document.createElement('div')
  toast.id = id
  toast.className = `toast ${variant}`
  toast.innerHTML = `
    <div class="container-1">
        <i class="${icons[variant]}"></i>
    </div>
    <div class="container-2">
        <p>${title}</p>
        <p>${message}</p>
    </div>
    <button class="toast-close-btn">&times;</button>
  `

  toast.querySelector('.toast-close-btn')!.addEventListener('click', () => dismissToast(id))
  
  portal.appendChild(toast)

  // Trigger animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('toast-visible')
    })
  })

  // Auto-dismiss after 5 seconds
  setTimeout(() => dismissToast(id), 5000)
}

function dismissToast(id: string) {
  const toast = document.getElementById(id)
  if (!toast) return
  
  toast.classList.remove('toast-visible')
  toast.classList.add('toast-leaving')
  
  const cleanup = () => toast.remove()
  toast.addEventListener('transitionend', cleanup, { once: true })
  setTimeout(cleanup, 300)
}
