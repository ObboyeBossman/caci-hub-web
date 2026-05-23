// src/shell/NotificationBell.ts
// Updates the notification badge count in the toolbar.
// Driven by events from modules — the shell never polls directly.

import { on } from '@core/events'

let _count = 0

/**
 * Initialise the notification bell listener.
 * Called once from Shell.ts after mounting.
 * Listens for notification count updates emitted by any module.
 */
export function initNotificationBell(): void {
  on('notification:countUpdated', (data) => {
    const { count } = data as { count: number }
    setNotificationCount(count)
  })
}

export function setNotificationCount(count: number): void {
  _count = count
  const badge = document.getElementById('notif-badge')
  const dot   = document.getElementById('topnav-notif-dot')

  if (count <= 0) {
    if (badge) { badge.style.display = 'none'; badge.textContent = '0' }
    if (dot)   dot.style.display = 'none'
  } else {
    if (badge) { badge.style.display = 'flex'; badge.textContent = count > 99 ? '99+' : String(count) }
    if (dot)   dot.style.display = 'block'
  }
}

export function getNotificationCount(): number {
  return _count
}