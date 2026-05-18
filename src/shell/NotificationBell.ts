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
  if (!badge) return

  if (count <= 0) {
    badge.style.display = 'none'
    badge.textContent = '0'
  } else {
    badge.style.display = 'flex'
    badge.textContent = count > 99 ? '99+' : String(count)
  }
}

export function getNotificationCount(): number {
  return _count
}