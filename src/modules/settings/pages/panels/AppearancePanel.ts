// src/modules/settings/pages/panels/AppearancePanel.ts

import type { SettingsContext } from '../utils/settingsTypes';

export function appearancePanelHTML(): string {
  return `
    <section class="settings-panel" id="s-panel-appearance">
      <p class="settings-sec">Theme</p>
      <div class="settings-row">
        <span class="settings-lbl">Colour scheme<small>System follows your OS preference.</small></span>
        <div class="settings-field-r">
          <div class="settings-seg" id="s-theme-seg">
            <button class="settings-seg-btn" data-theme-val="light"><i class="bi bi-sun"></i> Light</button>
            <button class="settings-seg-btn active" data-theme-val="system"><i class="bi bi-circle-half"></i> System</button>
            <button class="settings-seg-btn" data-theme-val="dark"><i class="bi bi-moon-stars"></i> Dark</button>
          </div>
        </div>
      </div>

      <p class="settings-sec">Accent colour</p>
      <div class="settings-row">
        <span class="settings-lbl">Brand colour<small>Used for buttons, links, and highlights.</small></span>
        <div class="settings-field-r" style="flex-direction:column;align-items:flex-start;gap:8px">
          <div class="settings-swatches" id="s-swatches">
            <div class="settings-swatch active" style="background:#004BA0" data-color="#004BA0" title="CACI Blue"></div>
            <div class="settings-swatch" style="background:#0969DA" data-color="#0969DA" title="Ocean"></div>
            <div class="settings-swatch" style="background:#1A7F37" data-color="#1A7F37" title="Forest"></div>
            <div class="settings-swatch" style="background:#9A6700" data-color="#9A6700" title="Amber"></div>
            <div class="settings-swatch" style="background:#C60026" data-color="#C60026" title="Red"></div>
            <div class="settings-swatch" style="background:#6E40C9" data-color="#6E40C9" title="Violet"></div>
            <div class="settings-swatch" style="background:#BF4B8A" data-color="#BF4B8A" title="Rose"></div>
            <input type="color" id="s-color-custom" title="Custom colour"
              style="width:26px;height:26px;border-radius:50%;border:2px solid var(--border-default);cursor:pointer;padding:0;background:none"/>
          </div>
          <div class="settings-contrast-warn" id="s-contrast-warn">
            <i class="bi bi-exclamation-triangle"></i> Low contrast — some text may be hard to read.
          </div>
        </div>
      </div>

      <p class="settings-sec">Accessibility</p>
      <div class="settings-row">
        <span class="settings-lbl">Reduce motion<small>Disables animations and transitions.</small></span>
        <div class="settings-field-r">
          <label class="settings-toggle">
            <input type="checkbox" id="s-reduce-motion"/>
            <div class="settings-t-track"></div><div class="settings-t-thumb"></div>
          </label>
        </div>
      </div>
      <div class="settings-row">
        <span class="settings-lbl">High contrast<small>Increases border and text contrast.</small></span>
        <div class="settings-field-r">
          <label class="settings-toggle">
            <input type="checkbox" id="s-high-contrast"/>
            <div class="settings-t-track"></div><div class="settings-t-thumb"></div>
          </label>
        </div>
      </div>

      <p class="settings-sec">Font size</p>
      <div class="settings-row">
        <span class="settings-lbl">Interface text size</span>
        <div class="settings-field-r">
          <div class="settings-seg" id="s-font-seg">
            <button class="settings-seg-btn" data-font="13">Small</button>
            <button class="settings-seg-btn active" data-font="14">Default</button>
            <button class="settings-seg-btn" data-font="16">Large</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function bindAppearancePanel(ctx: SettingsContext): void {
  const { el, toast } = ctx;

  // Theme
  el.querySelectorAll<HTMLElement>('[data-theme-val]').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-theme-val]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.dataset['themeVal']!;
      if (val === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.dataset['theme'] = prefersDark ? 'dark' : 'light';
        localStorage.removeItem('caci-theme');
      } else {
        document.documentElement.dataset['theme'] = val;
        localStorage.setItem('caci-theme', val);
      }
      toast('Theme updated');
    });
  });

  // Font size
  el.querySelectorAll<HTMLElement>('[data-font]').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-font]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.documentElement.style.fontSize = btn.dataset['font'] + 'px';
      toast('Font size updated');
    });
  });

  // Accent swatches
  el.querySelectorAll<HTMLElement>('.settings-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      el.querySelectorAll('.settings-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      _applyAccent(sw.dataset['color']!, el);
      toast('Accent colour updated');
    });
  });
  el.querySelector<HTMLInputElement>('#s-color-custom')?.addEventListener('input', (e) => {
    el.querySelectorAll('.settings-swatch').forEach(s => s.classList.remove('active'));
    _applyAccent((e.target as HTMLInputElement).value, el);
  });

  // Accessibility toggles
  el.querySelector('#s-reduce-motion')?.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    document.documentElement.dataset['reducedMotion'] = checked ? '1' : '0';
    toast(checked ? 'Motion reduced' : 'Motion restored');
  });
}

export function syncThemeSeg(el: HTMLElement): void {
  const val = localStorage.getItem('caci-theme') ?? 'system';
  el.querySelectorAll<HTMLElement>('[data-theme-val]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset['themeVal'] === val);
  });
}

function _applyAccent(hex: string, el: HTMLElement): void {
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--caci-blue', hex);
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
  el.querySelector<HTMLElement>('#s-contrast-warn')?.classList.toggle('show', lum > 0.6);
}