// src/modules/settings/pages/panels/NotificationsPanel.ts

import type { SettingsContext } from '../utils/settingsTypes';

const EVENTS = [
  { key: 'event_published',       label: 'Event published' },
  { key: 'announcement',          label: 'Announcement' },
  { key: 'group_message',         label: 'Group message' },
  { key: 'giving_receipt',        label: 'Giving receipt' },
  { key: 'prayer_request_update', label: 'Prayer request' },
  { key: 'member_updated',        label: 'Member updated' },
  { key: 'finance_report_ready',  label: 'Finance report' },
  { key: 'system_alert',          label: 'System alert', lockedInapp: true },
] as const;

const DEFAULTS: Record<string, Record<string, number>> = {
  event_published:       { inapp:1, email:1, sms:0, push:1 },
  announcement:          { inapp:1, email:1, sms:1, push:1 },
  group_message:         { inapp:1, email:0, sms:0, push:1 },
  giving_receipt:        { inapp:1, email:1, sms:0, push:0 },
  prayer_request_update: { inapp:1, email:0, sms:0, push:1 },
  member_updated:        { inapp:1, email:0, sms:0, push:0 },
  finance_report_ready:  { inapp:1, email:1, sms:0, push:0 },
  system_alert:          { inapp:1, email:1, sms:0, push:1 },
};

const CH_ICONS: Record<string, string> = {
  inapp: 'app-indicator', email: 'envelope', sms: 'chat-dots', push: 'bell',
};

export function notificationsPanelHTML(phoneVerified: boolean): string {
  return `
    <section class="settings-panel" id="s-panel-notifications">
      <p class="settings-sec">Notification channels</p>
      <div class="settings-matrix-wrap">
        <table class="settings-matrix">
          <thead>
            <tr>
              <th>Event</th>
              <th><div class="settings-ch-head"><i class="bi bi-app-indicator"></i>In-app</div></th>
              <th><div class="settings-ch-head"><i class="bi bi-envelope"></i>Email</div></th>
              <th>
                <div class="settings-ch-head">
                  <i class="bi bi-chat-dots"></i>SMS
                  ${!phoneVerified ? '<span class="settings-partial-badge">needs phone</span>' : ''}
                </div>
              </th>
              <th><div class="settings-ch-head"><i class="bi bi-bell"></i>Push</div></th>
              <th class="settings-soon-col">
                <div class="settings-ch-head"><i class="bi bi-whatsapp"></i>WhatsApp<br/><small>Soon</small></div>
              </th>
            </tr>
          </thead>
          <tbody id="s-notif-matrix"></tbody>
        </table>
      </div>
      <div class="settings-notif-cards" id="s-notif-cards"></div>
      <div style="display:flex;gap:var(--sp-sm);margin-top:var(--sp-md)">
        <button class="btn btn-ghost btn-sm" id="s-notif-reset">
          <i class="bi bi-arrow-counterclockwise"></i> Reset to defaults
        </button>
      </div>

      <p class="settings-sec">Quiet hours</p>
      <div class="settings-row">
        <span class="settings-lbl">Enable quiet hours<small>Pause non-critical notifications during set times.</small></span>
        <div class="settings-field-r">
          <label class="settings-toggle">
            <input type="checkbox" id="s-quiet-toggle"/>
            <div class="settings-t-track"></div><div class="settings-t-thumb"></div>
          </label>
        </div>
      </div>
      <div id="s-quiet-options" style="display:none;padding:var(--sp-md) 0">
        <div class="settings-time-row">
          <label>From</label>
          <input type="time" id="s-quiet-from" value="22:00" style="width:110px"/>
          <label>To</label>
          <input type="time" id="s-quiet-to" value="07:00" style="width:110px"/>
        </div>
      </div>
    </section>
  `;
}

export function bindNotificationsPanel(ctx: SettingsContext, phoneVerified: boolean): void {
  const { el, toast } = ctx;
  let matrix = JSON.parse(JSON.stringify(DEFAULTS));

  function renderMatrix(): void {
    const tbody = el.querySelector('#s-notif-matrix')!;
    const cards = el.querySelector('#s-notif-cards')!;
    const smsAttr = !phoneVerified ? 'disabled title="Add a phone number to enable SMS"' : '';
    tbody.innerHTML = '';
    cards.innerHTML = '';

    EVENTS.forEach(ev => {
      const d      = matrix[ev.key];
      const locked = (ev as any).lockedInapp ? 'disabled' : '';

      tbody.innerHTML += `<tr>
        <td>${ev.label}</td>
        ${(['inapp','email','sms','push'] as const).map(ch => `
          <td><label class="settings-toggle">
            <input type="checkbox" ${d[ch] ? 'checked' : ''}
              ${ch === 'inapp' ? locked : ch === 'sms' ? smsAttr : ''}
              data-key="${ev.key}" data-ch="${ch}"/>
            <div class="settings-t-track"></div><div class="settings-t-thumb"></div>
          </label></td>`).join('')}
        <td class="settings-soon-col"><label class="settings-toggle"><input type="checkbox" disabled/><div class="settings-t-track"></div><div class="settings-t-thumb"></div></label></td>
      </tr>`;

      cards.innerHTML += `<div class="settings-notif-card">
        <div class="settings-notif-card-title">${ev.label}</div>
        <div class="settings-notif-channels">
          ${(['inapp','email','sms','push'] as const).map(ch => `
            <div class="settings-notif-ch">
              <label class="settings-toggle" style="width:32px;height:18px">
                <input type="checkbox" ${d[ch] ? 'checked' : ''}
                  ${ch === 'sms' && !phoneVerified ? 'disabled' : ''}
                  ${ch === 'inapp' && (ev as any).lockedInapp ? 'disabled' : ''}
                  data-key="${ev.key}" data-ch="${ch}"/>
                <div class="settings-t-track"></div>
                <div class="settings-t-thumb" style="width:12px;height:12px;top:3px;left:3px"></div>
              </label>
              <span class="ch-name"><i class="bi bi-${CH_ICONS[ch]}"></i> ${ch.charAt(0).toUpperCase() + ch.slice(1)}</span>
            </div>`).join('')}
        </div>
      </div>`;
    });

    el.querySelectorAll<HTMLInputElement>('input[data-key][data-ch]').forEach(input => {
      input.addEventListener('change', () => {
        matrix[input.dataset['key']!][input.dataset['ch']!] = input.checked ? 1 : 0;
        toast('Preference saved');
      });
    });
  }

  renderMatrix();

  el.querySelector('#s-notif-reset')?.addEventListener('click', () => {
    matrix = JSON.parse(JSON.stringify(DEFAULTS));
    renderMatrix();
    toast('Reset to defaults');
  });

  el.querySelector('#s-quiet-toggle')?.addEventListener('change', (e) => {
    el.querySelector<HTMLElement>('#s-quiet-options')!.style.display =
      (e.target as HTMLInputElement).checked ? 'block' : 'none';
  });
}