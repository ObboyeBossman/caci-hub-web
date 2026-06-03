// src/shell/NotificationBell.ts
// ─────────────────────────────────────────────────────────────────────────────
// Notification badge on the topnav bell icon.
// No CSS of its own — badge elements are styled inside Toolbar.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { on } from '@core/events'

let _notifCount = 0

export function _initNotificationBell(): void {
  on('notification:countUpdated', (data: unknown) => {
    const { count } = data as { count: number }
    setNotificationCount(count)
  })
}

export function setNotificationCount(count: number): void {
  _notifCount = count
  const badge = document.getElementById('notif-badge')
  const dot   = document.getElementById('topnav-notif-dot')

  if (count <= 0) {
    if (badge) { badge.style.display = 'none'; badge.textContent = '0' }
    if (dot)   dot.style.display = 'none'
  } else {
    if (badge) {
      badge.style.display = 'flex'
      badge.textContent   = count > 99 ? '99+' : String(count)
    }
    if (dot) dot.style.display = 'block'
  }
}

export function getNotificationCount(): number { return _notifCount }