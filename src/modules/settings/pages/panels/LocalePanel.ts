// src/modules/settings/pages/panels/LocalePanel.ts

import type { SettingsContext } from '../utils/settingsTypes';

const LANGUAGES = [
  { flag: '🇬🇧', label: 'English (UK)', code: 'en_GB', active: true  },
  { flag: '🇺🇸', label: 'English (US)', code: 'en_US', active: false },
  { flag: '🇫🇷', label: 'Français',     code: 'fr_FR', active: false },
  { flag: '🇪🇸', label: 'Español',      code: 'es_ES', active: false },
  { flag: '🇵🇹', label: 'Português (BR)',code: 'pt_BR', active: false },
] as const;

export function localePanelHTML(): string {
  return `
    <section class="settings-panel" id="s-panel-locale">
      <p class="settings-sec">Language</p>
      <div class="settings-lang-list">
        ${LANGUAGES.map(l => `
          <div class="settings-lang-option ${l.active ? 'active' : ''}" data-lang="${l.code}">
            <span style="display:flex;align-items:center;gap:10px;font-size: var(--text-base)">
              <span style="font-size: var(--text-xl)">${l.flag}</span> ${l.label}
            </span>
            ${l.active ? '<i class="bi bi-check2" style="color:var(--accent)"></i>' : ''}
          </div>`).join('')}
      </div>

      <p class="settings-sec">Date &amp; time</p>
      <div class="settings-row">
        <span class="settings-lbl">Date format</span>
        <div class="settings-field-r">
          <select id="s-date-fmt" class="settings-select">
            <option value="dd/MM/yyyy">DD/MM/YYYY</option>
            <option value="MM/dd/yyyy">MM/DD/YYYY</option>
            <option value="iso">ISO 8601</option>
            <option value="d MMM yyyy">D MMM YYYY</option>
            <option value="d MMMM yyyy">D MMMM YYYY</option>
          </select>
        </div>
      </div>
      <div class="settings-row">
        <span class="settings-lbl">Time format</span>
        <div class="settings-field-r">
          <div class="settings-seg" id="s-time-seg">
            <button class="settings-seg-btn active" data-time="12">12-hour</button>
            <button class="settings-seg-btn" data-time="24">24-hour</button>
          </div>
        </div>
      </div>
      <div class="settings-row">
        <span class="settings-lbl">Currency</span>
        <div class="settings-field-r">
          <select id="s-currency" class="settings-select">
            <option value="GHS">GHS — Ghanaian Cedi</option>
            <option value="USD">USD — US Dollar</option>
            <option value="GBP">GBP — British Pound</option>
            <option value="EUR">EUR — Euro</option>
            <option value="NGN">NGN — Nigerian Naira</option>
          </select>
        </div>
      </div>
      <div class="settings-row">
        <span class="settings-lbl">First day of week</span>
        <div class="settings-field-r">
          <select id="s-week-start" class="settings-select">
            <option value="Sunday">Sunday</option>
            <option value="Monday">Monday</option>
            <option value="Saturday">Saturday</option>
          </select>
        </div>
      </div>
      <div class="settings-row">
        <span class="settings-lbl">Number format</span>
        <div class="settings-field-r">
          <select id="s-num-fmt" class="settings-select">
            <option value="en_US">1,500.00 (English)</option>
            <option value="de_DE">1.500,00 (German)</option>
            <option value="fr_FR">1 500,00 (French)</option>
          </select>
        </div>
      </div>

      <div class="settings-preview-box" style="margin-top:var(--sp-lg)">
        <div class="p-title">Live preview</div>
        <div class="settings-preview-grid">
          <div class="settings-preview-item"><span>Date</span><strong id="s-prev-date">22/05/2026</strong></div>
          <div class="settings-preview-item"><span>Time</span><strong id="s-prev-time">3:45 PM</strong></div>
          <div class="settings-preview-item"><span>Currency</span><strong id="s-prev-currency">GHS 1,500.00</strong></div>
          <div class="settings-preview-item"><span>Week starts</span><strong id="s-prev-week">Sunday</strong></div>
        </div>
      </div>
    </section>
  `;
}

export function bindLocalePanel(ctx: SettingsContext): void {
  const { el, toast } = ctx;

  // Language picker
  el.querySelectorAll<HTMLElement>('.settings-lang-option').forEach(opt => {
    opt.addEventListener('click', () => {
      el.querySelectorAll('.settings-lang-option').forEach(o => {
        o.classList.remove('active');
        o.querySelector('.bi-check2')?.remove();
      });
      opt.classList.add('active');
      const chk = document.createElement('i');
      chk.className = 'bi bi-check2';
      chk.style.color = 'var(--accent)';
      opt.appendChild(chk);
      toast('Language updated — applying…');
    });
  });

  // Selects + time seg → re-run preview
  ['#s-date-fmt', '#s-currency', '#s-week-start', '#s-num-fmt'].forEach(id => {
    el.querySelector(id)?.addEventListener('change', () => updateLocalePreview(el));
  });
  el.querySelectorAll<HTMLElement>('[data-time]').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-time]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateLocalePreview(el);
    });
  });

  updateLocalePreview(el);
}

function updateLocalePreview(el: HTMLElement): void {
  const months3    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthsFull = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const fmt    = el.querySelector<HTMLSelectElement>('#s-date-fmt')!.value;
  const h24    = el.querySelector<HTMLElement>('.settings-seg-btn.active[data-time]')?.dataset['time'] === '24';
  const curr   = el.querySelector<HTMLSelectElement>('#s-currency')!.value;
  const week   = el.querySelector<HTMLSelectElement>('#s-week-start')!.value;
  const numFmt = el.querySelector<HTMLSelectElement>('#s-num-fmt')!.value;

  const dateStr =
    fmt === 'dd/MM/yyyy'  ? '22/05/2026' :
    fmt === 'MM/dd/yyyy'  ? '05/22/2026' :
    fmt === 'iso'         ? '2026-05-22' :
    fmt === 'd MMM yyyy'  ? `22 ${months3[4]} 2026` :
                            `22 ${monthsFull[4]} 2026`;
  const amt = numFmt === 'de_DE' ? '1.500,00' : numFmt === 'fr_FR' ? '1\u202f500,00' : '1,500.00';

  const q = (id: string) => el.querySelector(id);
  (q('#s-prev-date') as HTMLElement).textContent = dateStr;
  (q('#s-prev-time') as HTMLElement).textContent = h24 ? '15:45' : '3:45 PM';
  (q('#s-prev-currency') as HTMLElement).textContent = `${curr} ${amt}`;
  (q('#s-prev-week') as HTMLElement).textContent = week;
}