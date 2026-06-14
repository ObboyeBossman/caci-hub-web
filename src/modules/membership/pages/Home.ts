// src/modules/membership/pages/Home.ts
// Member portal home — greeting hero, key stats, quick actions, announcements, recent giving.
// Route: /home  (no permission required, auth only)

import type { PageModule }   from '../../../types/module.types'
import { getCurrentUser }    from '@core/auth'
import { supabase }          from '@core/supabase'
import { renderBreadcrumbs } from '../../../shell/Breadcrumbs'
import { renderSkeleton, renderError } from '@shared/utils/pageHelpers'
import { avatarColor, initials } from '../utils/member-helpers'
import type { MemberView } from '../../../types/member.types'

// ── Listener cleanup ──────────────────────────────────────────────────────────
const _listeners: [EventTarget, string, EventListener][] = []

function _on<K extends keyof HTMLElementEventMap>(
  el: EventTarget | null, ev: K, fn: (e: HTMLElementEventMap[K]) => void
): void {
  if (!el) return
  el.addEventListener(ev, fn as EventListener)
  _listeners.push([el, ev, fn as EventListener])
}

function _cleanup(): void {
  _listeners.forEach(([el, ev, fn]) => el.removeEventListener(ev, fn))
  _listeners.length = 0
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS_ID = 'member-home-css'

const CSS = /* css */`

/* ── Page wrap ──────────────────────────────────────────────────────────── */
.mhome-wrap {
  padding: 20px 0 64px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  animation: mhome-fade-up 0.35s ease both;
}

/* ── Fade-up ─────────────────────────────────────────────────────────────── */
@keyframes mhome-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.mhome-anim { animation: mhome-fade-up 0.35s ease both; }

/* ── Hero card ───────────────────────────────────────────────────────────── */
.mhome-hero {
  background: linear-gradient(135deg, #003578 0%, #004BA0 50%, #1A6FC4 100%);
  border-radius: 20px;
  overflow: hidden;
  position: relative;
  box-shadow: 0 12px 40px rgba(0, 75, 160, 0.25), 0 2px 8px rgba(0,0,0,0.12);
  color: #fff;
}
.mhome-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 60% 80% at 90% 50%, rgba(255,255,255,0.07), transparent),
    radial-gradient(ellipse 35% 55% at 5% 10%, rgba(198,0,38,0.12), transparent);
  pointer-events: none;
}
.mhome-hero-stripe {
  height: 4px;
  background: linear-gradient(90deg, #C60026, #FF1A46, #C60026);
}
.mhome-hero-body {
  position: relative; z-index: 1;
  padding: 28px 32px;
  display: flex;
  align-items: flex-start;
  gap: 24px;
}
@media (max-width: 560px) {
  .mhome-hero-body { flex-direction: column; align-items: center; padding: 20px; gap: 16px; text-align: center; }
}

/* ── Hero: avatar ────────────────────────────────────────────────────────── */
.mhome-hero-avatar-ring {
  padding: 3px;
  border-radius: 50%;
  background: rgba(255,255,255,0.22);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.12);
  flex-shrink: 0;
}
.mhome-hero-avatar {
  width: 80px; height: 80px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 26px; font-weight: 700; color: #fff;
  border: 3px solid rgba(255,255,255,0.28);
  background-size: cover; background-position: center;
}

/* ── Hero: text side ─────────────────────────────────────────────────────── */
.mhome-hero-right { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.mhome-greeting-row { display: flex; align-items: center; gap: 8px; font-size: 1rem; font-weight: 500; opacity: 0.88; }
.mhome-name { font-size: 2rem; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15; margin: 0; }
@media (max-width: 560px) { .mhome-name { font-size: 1.6rem; } }
.mhome-date-pill {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(255,255,255,0.14); backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.18);
  padding: 5px 12px; border-radius: 20px;
  font-size: 0.82rem; font-weight: 500;
  width: fit-content;
}

/* ── Hero: stats strip ───────────────────────────────────────────────────── */
.mhome-hero-stats {
  display: flex; gap: 0;
  border-top: 1px solid rgba(255,255,255,0.12);
  margin-top: 4px;
}
.mhome-stat {
  flex: 1; padding: 16px 20px;
  border-right: 1px solid rgba(255,255,255,0.1);
  display: flex; flex-direction: column; gap: 3px;
}
.mhome-stat:last-child { border-right: none; }
.mhome-stat-label { font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.5); }
.mhome-stat-value { font-size: 13.5px; font-weight: 600; color: #fff; font-family: var(--font-mono); }

/* ── Status chip ─────────────────────────────────────────────────────────── */
.mhome-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 99px;
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
}
.mhome-chip.active   { background: rgba(26,127,55,0.25); color: #4ade80; border: 1px solid rgba(74,222,128,0.3); }
.mhome-chip.visitor  { background: rgba(77,159,255,0.2); color: #93c5fd; border: 1px solid rgba(147,197,253,0.3); }
.mhome-chip.inactive { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.15); }
.mhome-chip.prospect { background: rgba(154,103,0,0.25); color: #fbbf24; border: 1px solid rgba(251,191,36,0.3); }
.mhome-chip.transfer { background: rgba(77,159,255,0.2); color: #60a5fa; border: 1px solid rgba(96,165,250,0.3); }
.mhome-chip.deceased { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.4); border: 1px solid rgba(255,255,255,0.1); }

/* ── Content grid ────────────────────────────────────────────────────────── */
.mhome-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
@media (max-width: 700px) { .mhome-grid { grid-template-columns: 1fr; } }
.mhome-full { grid-column: 1 / -1; }

/* ── Card ────────────────────────────────────────────────────────────────── */
.mhome-card {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  transition: border-color 0.2s, box-shadow 0.2s;
}
[data-theme="dark"] .mhome-card { background: linear-gradient(145deg, #1c2128, #161b22); }
.mhome-card:hover { border-color: var(--border-strong); box-shadow: 0 4px 14px rgba(0,0,0,0.07); }

.mhome-card-head {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--border-default);
  background: rgba(0,0,0,0.015);
}
[data-theme="dark"] .mhome-card-head { background: rgba(255,255,255,0.015); }
.mhome-card-head-left { display: flex; align-items: center; gap: 10px; }
.mhome-card-icon {
  width: 30px; height: 30px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 14px;
}
.mhome-card-title { font-size: 12.5px; font-weight: 600; color: var(--text-primary); margin: 0; }
.mhome-card-body  { padding: 18px 20px; }

/* ── Quick actions ───────────────────────────────────────────────────────── */
.mhome-actions-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
@media (max-width: 400px) { .mhome-actions-grid { grid-template-columns: repeat(2, 1fr); } }
.mhome-action-btn {
  display: flex; flex-direction: column; align-items: center; gap: 9px;
  padding: 16px 10px;
  background: var(--bg-page); border: 1px solid var(--border-default);
  border-radius: 12px; cursor: pointer;
  color: var(--text-secondary); font-family: var(--font-sans);
  transition: all 0.18s; text-decoration: none;
}
.mhome-action-btn:hover {
  background: var(--bg-card); border-color: var(--caci-blue);
  transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,75,160,0.1);
}
.mhome-action-icon {
  width: 44px; height: 44px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; transition: background 0.18s;
}
.mhome-action-btn:hover .mhome-action-icon { filter: brightness(1.1); }
.mhome-action-label { font-size: 11.5px; font-weight: 600; color: var(--text-primary); text-align: center; line-height: 1.3; }

/* ── List items (announcements / giving) ─────────────────────────────────── */
.mhome-list-item {
  display: flex; gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-default);
}
.mhome-list-item:last-child { border-bottom: none; padding-bottom: 0; }
.mhome-list-lead {
  flex-shrink: 0; width: 34px; height: 34px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; margin-top: 1px;
}
.mhome-list-content { flex: 1; min-width: 0; }
.mhome-list-title {
  font-size: 13.5px; font-weight: 600; color: var(--text-primary);
  margin: 0 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.mhome-list-body {
  font-size: 12.5px; color: var(--text-secondary); margin: 0 0 4px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.mhome-list-meta { font-size: 11px; color: var(--text-muted); }

/* ── Amount badge ────────────────────────────────────────────────────────── */
.mhome-amount {
  font-size: 13px; font-weight: 700; color: var(--caci-success);
  white-space: nowrap; align-self: center; flex-shrink: 0; font-family: var(--font-mono);
}

/* ── Pin badge ───────────────────────────────────────────────────────────── */
.mhome-pin { color: #ef4444; font-size: 11px; margin-left: 4px; }

/* ── Empty / view-all ────────────────────────────────────────────────────── */
.mhome-empty {
  text-align: center; padding: 24px 16px;
  color: var(--text-muted); font-size: 13px;
  background: var(--bg-page); border-radius: 10px;
  border: 1px dashed var(--border-default);
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.mhome-empty i { font-size: 24px; opacity: 0.5; }
.mhome-view-all {
  font-size: 12px; font-weight: 500; color: var(--caci-blue-light);
  cursor: pointer; background: none; border: none; padding: 0;
  display: inline-flex; align-items: center; gap: 4px;
  font-family: var(--font-sans); transition: opacity 0.15s;
}
.mhome-view-all:hover { opacity: 0.75; }
`

// ── Helpers ───────────────────────────────────────────────────────────────────

function _chipHtml(status: string): string {
  const map: Record<string, { icon: string; label: string }> = {
    active:   { icon: 'bi-check-circle-fill', label: 'Active' },
    visitor:  { icon: 'bi-person-walking',    label: 'Visitor' },
    inactive: { icon: 'bi-pause-circle-fill', label: 'Inactive' },
    prospect: { icon: 'bi-person-plus-fill',  label: 'Prospect' },
    transfer: { icon: 'bi-arrow-left-right',  label: 'Transfer' },
    deceased: { icon: 'bi-moon-fill',         label: 'Deceased' },
  }
  const s = map[status] ?? map['inactive']
  return `<span class="mhome-chip ${status}"><i class="bi ${s.icon}"></i>${s.label}</span>`
}

function _greetingIcon(hour: number): string {
  if (hour < 6)  return '<i class="bi bi-moon-stars-fill" style="color:#a78bfa;"></i>'
  if (hour < 12) return '<i class="bi bi-sun-fill" style="color:#fbbf24;"></i>'
  if (hour < 17) return '<i class="bi bi-brightness-high-fill" style="color:#f97316;"></i>'
  return '<i class="bi bi-moon-fill" style="color:#818cf8;"></i>'
}

function _greeting(hour: number): string {
  if (hour < 6)  return 'Good Night'
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

// ── Page HTML ─────────────────────────────────────────────────────────────────

interface DashboardData {
  member:        MemberView
  assemblyName:  string
  announcements: any[]
  transactions:  any[]
}

function _html(data: DashboardData): string {
  const { member: m, assemblyName, announcements, transactions } = data

  const hour        = new Date().getHours()
  const greeting    = _greeting(hour)
  const greetIcon   = _greetingIcon(hour)
  const firstName   = m.first_name ?? 'Member'
  const dateString  = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())

  const bg  = avatarColor(m.id ?? '')
  const ini = initials(m.first_name ?? '', m.last_name ?? '')
  const avatarStyle = m.profile_photo_url
    ? `background-image:url(${m.profile_photo_url});`
    : `background:linear-gradient(135deg,${bg},var(--caci-blue));`

  const memberSince = m.join_date
    ? new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(new Date(m.join_date))
    : '—'

  // ── Quick actions ──────────────────────────────────────────────────────────
  const actions = [
    { icon: 'bi-person-badge', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  label: 'My Profile',    path: '/my-profile' },
    { icon: 'bi-diagram-3-fill',color:'#8b5cf6', bg: 'rgba(139,92,246,0.1)', label: 'My Groups',     path: '/my-groups' },
    { icon: 'bi-wallet2',      color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'My Giving',     path: '/my-giving' },
    { icon: 'bi-calendar-check-fill', color:'#22c55e', bg:'rgba(34,197,94,0.1)', label:'My Attendance', path:'/my-attendance' },
    { icon: 'bi-megaphone-fill',color: '#ec4899', bg: 'rgba(236,72,153,0.1)',label: 'Announcements', path: '/announcements' },
    { icon: 'bi-calendar3',    color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',  label: 'Calendar',      path: '/calendar' },
  ]

  const actionsHtml = actions.map(a => `
    <button class="mhome-action-btn" data-nav="${a.path}">
      <div class="mhome-action-icon" style="background:${a.bg};">
        <i class="bi ${a.icon}" style="color:${a.color};"></i>
      </div>
      <span class="mhome-action-label">${a.label}</span>
    </button>
  `).join('')

  // ── Announcements ──────────────────────────────────────────────────────────
  const announcementsHtml = announcements.length > 0
    ? announcements.map(a => `
        <div class="mhome-list-item">
          <div class="mhome-list-lead" style="background:${a.is_pinned ? 'rgba(239,68,68,0.1)' : 'rgba(139,92,246,0.1)'};">
            <i class="bi ${a.is_pinned ? 'bi-pin-angle-fill' : 'bi-megaphone-fill'}" style="color:${a.is_pinned ? '#ef4444' : '#8b5cf6'};"></i>
          </div>
          <div class="mhome-list-content">
            <div class="mhome-list-title">
              ${a.title}${a.is_pinned ? '<i class="bi bi-pin-angle-fill mhome-pin"></i>' : ''}
            </div>
            <p class="mhome-list-body">${a.body ?? ''}</p>
            <span class="mhome-list-meta">${new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
    `).join('')
    : `<div class="mhome-empty"><i class="bi bi-inbox"></i>No new announcements</div>`

  // ── Giving ─────────────────────────────────────────────────────────────────
  const givingHtml = transactions.length > 0
    ? transactions.map(t => `
        <div class="mhome-list-item">
          <div class="mhome-list-lead" style="background:rgba(34,197,94,0.1);">
            <i class="bi bi-arrow-up-circle-fill" style="color:#22c55e;"></i>
          </div>
          <div class="mhome-list-content">
            <div class="mhome-list-title">${t.category?.name ?? 'General Contribution'}</div>
            <span class="mhome-list-meta">${new Date(t.transaction_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
          <div class="mhome-amount">${t.currency} ${Number(t.amount).toFixed(2)}</div>
        </div>
    `).join('')
    : `<div class="mhome-empty"><i class="bi bi-receipt"></i>No recent transactions</div>`

  return /* html */`
<div class="mhome-wrap">

  <!-- ── Hero ──────────────────────────────────────────────────────────────── -->
  <div class="mhome-hero mhome-anim">
    <div class="mhome-hero-stripe"></div>
    <div class="mhome-hero-body">
      <!-- Avatar -->
      <div class="mhome-hero-avatar-ring">
        <div class="mhome-hero-avatar" style="${avatarStyle}">${m.profile_photo_url ? '' : ini}</div>
      </div>

      <!-- Text -->
      <div class="mhome-hero-right">
        <div class="mhome-greeting-row">${greetIcon} ${greeting},</div>
        <h1 class="mhome-name">${firstName}!</h1>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <div class="mhome-date-pill"><i class="bi bi-calendar3"></i>${dateString}</div>
          ${_chipHtml(m.membership_status ?? 'inactive')}
        </div>
      </div>
    </div>

    <!-- Stats strip -->
    <div class="mhome-hero-stats">
      <div class="mhome-stat">
        <span class="mhome-stat-label">Assembly</span>
        <span class="mhome-stat-value" style="font-family:var(--font-sans);font-size:12.5px;">${assemblyName}</span>
      </div>
      <div class="mhome-stat">
        <span class="mhome-stat-label">Member Since</span>
        <span class="mhome-stat-value">${memberSince}</span>
      </div>
      ${m.membership_number ? `
      <div class="mhome-stat">
        <span class="mhome-stat-label">Member #</span>
        <span class="mhome-stat-value">${m.membership_number}</span>
      </div>` : ''}
    </div>
  </div>

  <!-- ── Quick Actions ──────────────────────────────────────────────────────── -->
  <div class="mhome-card mhome-anim" style="animation-delay:40ms;">
    <div class="mhome-card-head">
      <div class="mhome-card-head-left">
        <div class="mhome-card-icon" style="background:rgba(0,75,160,0.08);">
          <i class="bi bi-lightning-charge-fill" style="color:var(--caci-blue-light);"></i>
        </div>
        <h2 class="mhome-card-title">Quick Access</h2>
      </div>
    </div>
    <div class="mhome-card-body">
      <div class="mhome-actions-grid">${actionsHtml}</div>
    </div>
  </div>

  <!-- ── Two-column grid ────────────────────────────────────────────────────── -->
  <div class="mhome-grid">

    <!-- Announcements -->
    <div class="mhome-card mhome-anim" style="animation-delay:80ms;">
      <div class="mhome-card-head">
        <div class="mhome-card-head-left">
          <div class="mhome-card-icon" style="background:rgba(139,92,246,0.1);">
            <i class="bi bi-megaphone-fill" style="color:#8b5cf6;"></i>
          </div>
          <h2 class="mhome-card-title">Announcements</h2>
        </div>
        <button class="mhome-view-all" data-nav="/announcements">
          View all <i class="bi bi-arrow-right"></i>
        </button>
      </div>
      <div class="mhome-card-body">${announcementsHtml}</div>
    </div>

    <!-- Recent Giving -->
    <div class="mhome-card mhome-anim" style="animation-delay:110ms;">
      <div class="mhome-card-head">
        <div class="mhome-card-head-left">
          <div class="mhome-card-icon" style="background:rgba(34,197,94,0.1);">
            <i class="bi bi-heart-fill" style="color:#22c55e;"></i>
          </div>
          <h2 class="mhome-card-title">Recent Giving</h2>
        </div>
        <button class="mhome-view-all" data-nav="/my-giving">
          View all <i class="bi bi-arrow-right"></i>
        </button>
      </div>
      <div class="mhome-card-body">${givingHtml}</div>
    </div>

  </div>
</div>
`
}

// ── Module ────────────────────────────────────────────────────────────────────

export default {
  async render(container: HTMLElement): Promise<void> {
    _cleanup()

    // Inject CSS once
    if (!document.getElementById(CSS_ID)) {
      const s = document.createElement('style')
      s.id = CSS_ID
      s.textContent = CSS
      document.head.appendChild(s)
    }

    // Show skeleton immediately
    renderSkeleton(container, 'profile')

    try {
      const user = getCurrentUser()
      if (!user) return

      // Fetch member record
      const { data: memberRaw, error: memberErr } = await supabase
        .from('members_view')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (memberErr) throw memberErr

      // No linked member record
      if (!memberRaw) {
        container.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
            min-height:55vh;gap:12px;font-family:var(--font-sans);text-align:center;padding:24px;">
            <div style="width:64px;height:64px;border-radius:50%;background:var(--bg-page);border:1px solid var(--border-default);
              display:flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:8px;">
              <i class="bi bi-person-x" style="color:var(--text-muted);"></i>
            </div>
            <h2 style="margin:0;font-size:1.1rem;font-weight:600;color:var(--text-primary);">No member record linked</h2>
            <p style="margin:0;font-size:0.875rem;color:var(--text-secondary);max-width:360px;line-height:1.6;">
              Your account hasn't been linked to a member profile yet. Please contact your assembly administrator.
            </p>
          </div>
        `
        renderBreadcrumbs(container, [{ label: 'Home' }])
        return
      }

      const m = memberRaw as unknown as MemberView

      // Fetch supporting data in parallel
      const [asmResult, annResult, txResult] = await Promise.all([
        m.assembly_id
          ? supabase.from('assemblies').select('name').eq('id', m.assembly_id).maybeSingle()
          : Promise.resolve({ data: null }),

        m.assembly_id
          ? supabase.from('announcement_posts')
              .select('id, title, body, created_at, is_pinned')
              .eq('assembly_id', m.assembly_id)
              .is('deleted_at', null)
              .order('is_pinned', { ascending: false })
              .order('created_at', { ascending: false })
              .limit(3)
          : Promise.resolve({ data: [] }),

        m.id
          ? supabase.from('finance_transactions')
              .select('id, amount, currency, transaction_date, category:finance_categories(name)')
              .eq('member_id', m.id)
              .is('deleted_at', null)
              .order('transaction_date', { ascending: false })
              .limit(3)
          : Promise.resolve({ data: [] }),
      ])

      const dashData: DashboardData = {
        member:       m,
        assemblyName: (asmResult.data as any)?.name ?? 'My Assembly',
        announcements:(annResult.data ?? []) as any[],
        transactions: (txResult.data ?? []) as any[],
      }

      // Render
      container.innerHTML = _html(dashData)
      renderBreadcrumbs(container, [{ label: 'Home' }])

      // Wire up navigation buttons
      container.querySelectorAll<HTMLElement>('[data-nav]').forEach(el => {
        _on(el, 'click', () => {
          window.location.hash = `#${el.dataset.nav}`
        })
      })

    } catch (err) {
      console.error('[Home] Failed to load dashboard:', err)
      renderError(container, err, {
        retry: () => this.render(container),
      })
    }
  },

  destroy() {
    _cleanup()
  },
} satisfies PageModule
