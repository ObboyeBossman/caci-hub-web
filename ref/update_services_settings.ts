function _renderSettingsTab(): void {
  if (!_tabContent) return

  // ── Persisted settings state (could hook into localStorage / DB) ──────────
  const _prefs = {
    // Calendar
    firstDayOfWeek: localStorage.getItem('svc:firstDay')      ?? '0',
    defaultView:    localStorage.getItem('svc:defaultView')   ?? 'list',
    timeFormat:     localStorage.getItem('svc:timeFormat')    ?? '12',
    showWeekNumbers:localStorage.getItem('svc:weekNumbers')   ?? '0',
    // Attendance
    defaultStatus:  localStorage.getItem('svc:defStatus')     ?? 'absent',
    allowLate:      localStorage.getItem('svc:allowLate')     ?? '0',
    allowExcused:   localStorage.getItem('svc:allowExcused')  ?? '1',
    reminderHours:  parseInt(localStorage.getItem('svc:reminderHours') ?? '2'),
    // Notifications
    notifyOnCreate: localStorage.getItem('svc:notifyCreate')  ?? '1',
    notifyOnCancel: localStorage.getItem('svc:notifyCancel')  ?? '1',
    notifyAbsence:  localStorage.getItem('svc:notifyAbsence') ?? '0',
    absenceThreshold: parseInt(localStorage.getItem('svc:absenceThreshold') ?? '3'),
    // Display
    accentColor:    localStorage.getItem('svc:accent')        ?? '#004BA0',
    compactRows:    localStorage.getItem('svc:compact')       ?? '0',
    showAttendancePct: localStorage.getItem('svc:showPct')    ?? '1',
  }

  const ACCENT_PRESETS = [
    '#004BA0', '#1a7f37', '#C60026', '#7c3aed',
    '#0969da', '#9a6700', '#0e7490', '#b45309',
  ]

  // ── Active nav section ────────────────────────────────────────────────────
  let _activeSetting = 'general'

  // ── Render shell ─────────────────────────────────────────────────────────
  _tabContent!.innerHTML = /* html */`
    <div class="svc-set-shell" id="svc-settings-shell">

      <!-- ── Left rail ── -->
      <nav class="svc-set-rail" role="navigation" aria-label="Settings sections">
        <div class="svc-set-rail-label">Module</div>
        <button class="svc-set-nav active" data-section="general">
          <i class="bi bi-sliders"></i>
          General
        </button>
        <button class="svc-set-nav" data-section="calendar">
          <i class="bi bi-calendar3"></i>
          Calendar
        </button>
        <button class="svc-set-nav" data-section="attendance">
          <i class="bi bi-person-check"></i>
          Attendance
          <span class="svc-set-nav-badge">2</span>
        </button>
        <button class="svc-set-nav" data-section="types">
          <i class="bi bi-tag"></i>
          Service Types
        </button>

        <div class="svc-set-rail-sep"></div>
        <div class="svc-set-rail-label">System</div>

        <button class="svc-set-nav" data-section="notifications">
          <i class="bi bi-bell"></i>
          Notifications
        </button>
        <button class="svc-set-nav" data-section="display">
          <i class="bi bi-palette"></i>
          Display
        </button>
        <button class="svc-set-nav" data-section="data">
          <i class="bi bi-database"></i>
          Data &amp; Export
        </button>

        <div class="svc-set-rail-sep"></div>

        <button class="svc-set-nav" data-section="danger" style="color:var(--caci-red);">
          <i class="bi bi-exclamation-triangle" style="color:var(--caci-red);"></i>
          Danger Zone
        </button>
      </nav>

      <!-- ── Right panel ── -->
      <div class="svc-set-panel" id="svc-set-panel" role="main">
        <!-- Rendered dynamically -->
      </div>

    </div>`

  // ── Nav switching ─────────────────────────────────────────────────────────
  const panel = _tabContent!.querySelector<HTMLElement>('#svc-set-panel')!

  function switchSection(key: string): void {
    _activeSetting = key
    _tabContent!.querySelectorAll('.svc-set-nav').forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset['section'] === key)
    })
    renderSection(key)
    panel.scrollTop = 0
  }

  _tabContent!.querySelectorAll<HTMLElement>('[data-section]').forEach(btn => {
    btn.addEventListener('click', () => switchSection(btn.dataset['section']!))
  })

  // ── Section renderer ─────────────────────────────────────────────────────

  function renderSection(key: string): void {
    switch (key) {
      case 'general':       renderGeneral();       break
      case 'calendar':      renderCalendar();      break
      case 'attendance':    renderAttendance();    break
      case 'types':         renderTypes();         break
      case 'notifications': renderNotifications(); break
      case 'display':       renderDisplay();       break
      case 'data':          renderData();          break
      case 'danger':        renderDanger();        break
    }
  }

  // ── Helper: unsaved-state watcher ─────────────────────────────────────────
  function markUnsaved(sectionEl: HTMLElement): void {
    const dot = sectionEl.querySelector<HTMLElement>('.svc-set-unsaved-dot')
    if (dot) dot.classList.add('show')
    const saveBtn = sectionEl.querySelector<HTMLButtonElement>('[data-save-section]')
    if (saveBtn) saveBtn.style.boxShadow = '0 0 0 3px rgba(210,153,34,0.25)'
  }

  function flashSaved(sectionEl: HTMLElement): void {
    sectionEl.querySelectorAll('.svc-set-section').forEach(s => {
      s.classList.add('saved')
      setTimeout(() => s.classList.remove('saved'), 1200)
    })
    const dot = sectionEl.querySelector<HTMLElement>('.svc-set-unsaved-dot')
    if (dot) dot.classList.remove('show')
    const saveBtn = sectionEl.querySelector<HTMLButtonElement>('[data-save-section]')
    if (saveBtn) saveBtn.style.boxShadow = ''
  }

  // ── Toggle helper ─────────────────────────────────────────────────────────
  function buildToggle(id: string, on: boolean, onChange: (v: boolean) => void): string {
    return `
      <label class="svc-toggle-wrap" for="${id}" aria-label="Toggle">
        <input type="checkbox" id="${id}" class="svc-toggle-input"${on ? ' checked' : ''}>
        <div class="svc-toggle-track${on ? ' on' : ''}" id="${id}-track">
          <div class="svc-toggle-thumb"></div>
        </div>
      </label>`
  }

  function bindToggles(root: HTMLElement): void {
    root.querySelectorAll<HTMLInputElement>('.svc-toggle-input').forEach(chk => {
      chk.addEventListener('change', () => {
        const track = root.querySelector<HTMLElement>(`#${chk.id}-track`)
        if (track) track.classList.toggle('on', chk.checked)
        markUnsaved(root)
      })
    })
  }

  // ── Stepper helper ────────────────────────────────────────────────────────
  function bindSteppers(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>('[data-stepper]').forEach(wrap => {
      const id   = wrap.dataset['stepper']!
      const min  = parseInt(wrap.dataset['min']  ?? '0')
      const max  = parseInt(wrap.dataset['max']  ?? '99')
      const valEl = wrap.querySelector<HTMLElement>(`[data-step-val="${id}"]`)!
      wrap.querySelector(`[data-step-dec="${id}"]`)?.addEventListener('click', () => {
        const cur = parseInt(valEl.textContent ?? '0')
        if (cur > min) { valEl.textContent = String(cur - 1); markUnsaved(root) }
      })
      wrap.querySelector(`[data-step-inc="${id}"]`)?.addEventListener('click', () => {
        const cur = parseInt(valEl.textContent ?? '0')
        if (cur < max) { valEl.textContent = String(cur + 1); markUnsaved(root) }
      })
    })
  }

  // ── Collapsible sections ──────────────────────────────────────────────────
  function bindCollapsibles(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>('.svc-set-section-head').forEach(head => {
      const section = head.closest<HTMLElement>('.svc-set-section')!
      const body    = section.querySelector<HTMLElement>('.svc-set-section-body')!
      body.style.maxHeight = body.scrollHeight + 'px'

      head.addEventListener('click', () => {
        const collapsed = section.classList.toggle('collapsed')
        body.style.maxHeight = collapsed ? '0px' : body.scrollHeight + 'px'
      })
    })
  }

  // ── Save handler ──────────────────────────────────────────────────────────
  function bindSave(root: HTMLElement, saveFn: () => void): void {
    root.querySelector<HTMLButtonElement>('[data-save-section]')?.addEventListener('click', () => {
      const btn = root.querySelector<HTMLButtonElement>('[data-save-section]')!
      btn.disabled = true
      btn.innerHTML = `<span class="svc-spinner"></span>`
      setTimeout(() => {
        saveFn()
        btn.disabled = false
        btn.innerHTML = `<i class="bi bi-check-lg"></i> Saved`
        btn.style.background = 'rgba(34,197,94,0.15)'
        btn.style.borderColor = 'rgba(34,197,94,0.35)'
        btn.style.color = '#56d364'
        setTimeout(() => {
          btn.innerHTML = `<i class="bi bi-floppy"></i> Save Changes`
          btn.style.background = ''
          btn.style.borderColor = ''
          btn.style.color = ''
        }, 2000)
        flashSaved(root)
        _toast('Settings saved.')
      }, 320)
    })
  }

  // ════════════════════════════════════════════════════
  // SECTION: GENERAL
  // ════════════════════════════════════════════════════
  function renderGeneral(): void {
    panel.innerHTML = /* html */`
      <div class="svc-set-panel-head">
        <div>
          <h2 class="svc-set-panel-title">General Settings</h2>
          <p class="svc-set-panel-sub">Core module preferences and behaviour</p>
        </div>
        <div class="svc-set-save-row">
          <span class="svc-set-unsaved-dot" title="Unsaved changes"></span>
          <button class="svc-tbtn svc-tbtn-primary" data-save-section style="height:36px;font-size:12px;">
            <i class="bi bi-floppy"></i> Save Changes
          </button>
        </div>
      </div>

      <!-- Module info card -->
      <div style="
        display:flex;align-items:center;gap:14px;
        padding:16px;border:1px solid var(--border-default);
        border-radius:var(--radius-lg);
        background:linear-gradient(135deg,rgba(0,75,160,0.07) 0%,rgba(0,75,160,0.02) 100%);
        margin-bottom:20px;
      ">
        <div style="
          width:48px;height:48px;border-radius:12px;flex-shrink:0;
          background:rgba(0,75,160,0.15);border:1px solid rgba(0,75,160,0.25);
          display:flex;align-items:center;justify-content:center;
        ">
          <i class="bi bi-calendar-event-fill" style="font-size:22px;color:var(--caci-blue-light);"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:700;color:var(--text-primary);">Services &amp; Events</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:1px;">Module v1.1.0 · Supabase-backed · Realtime enabled</div>
        </div>
        <span style="
          padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;
          background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);color:#56d364;
          flex-shrink:0;
        ">Active</span>
      </div>

      <!-- Module behaviour -->
      <div class="svc-set-section">
        <div class="svc-set-section-head">
          <div class="svc-set-section-icon" style="background:rgba(0,75,160,0.1);">
            <i class="bi bi-toggles" style="color:var(--caci-blue-light);"></i>
          </div>
          <span class="svc-set-section-label">Module Behaviour</span>
          <span class="svc-set-section-sub">Default landing and interaction modes</span>
          <i class="bi bi-chevron-down svc-set-chevron"></i>
        </div>
        <div class="svc-set-section-body">

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(0,75,160,0.1);">
              <i class="bi bi-layout-text-sidebar-reverse" style="color:var(--caci-blue-light);"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Default landing tab</div>
              <div class="svc-set-row-desc">Which tab opens when navigating to /services</div>
            </div>
            <div class="svc-set-row-control">
              <select class="svc-set-select" id="svc-set-landing">
                <option value="schedule"   selected>Schedule</option>
                <option value="attendance">Attendance</option>
                <option value="reports">Reports</option>
              </select>
            </div>
          </div>

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(34,197,94,0.1);">
              <i class="bi bi-arrow-repeat" style="color:#22c55e;"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Auto-refresh interval</div>
              <div class="svc-set-row-desc">How often the service list polls for updates</div>
            </div>
            <div class="svc-set-row-control">
              <select class="svc-set-select" id="svc-set-refresh">
                <option value="0">Realtime only</option>
                <option value="30" selected>Every 30s</option>
                <option value="60">Every 60s</option>
                <option value="300">Every 5 min</option>
              </select>
            </div>
          </div>

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(210,153,34,0.1);">
              <i class="bi bi-hourglass-split" style="color:#d29922;"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Services shown per page</div>
              <div class="svc-set-row-desc">Maximum rows loaded in the list view at once</div>
            </div>
            <div class="svc-set-row-control">
              <div class="svc-set-stepper"
                data-stepper="perPage"
                data-min="10" data-max="200">
                <button class="svc-set-step-btn" data-step-dec="perPage">−</button>
                <div class="svc-set-step-val" data-step-val="perPage">50</div>
                <button class="svc-set-step-btn" data-step-inc="perPage">+</button>
              </div>
            </div>
          </div>

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(124,58,237,0.1);">
              <i class="bi bi-sort-down" style="color:#a78bfa;"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Default sort order</div>
              <div class="svc-set-row-desc">Initial sort direction for the schedule list</div>
            </div>
            <div class="svc-set-row-control">
              <select class="svc-set-select" id="svc-set-sort">
                <option value="date_desc" selected>Date (newest first)</option>
                <option value="date_asc">Date (oldest first)</option>
                <option value="title_az">Title A–Z</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>

        </div>
      </div>

      <!-- Permissions overview -->
      <div class="svc-set-section">
        <div class="svc-set-section-head">
          <div class="svc-set-section-icon" style="background:rgba(88,166,255,0.1);">
            <i class="bi bi-shield-check" style="color:#58a6ff;"></i>
          </div>
          <span class="svc-set-section-label">Your Permissions</span>
          <span class="svc-set-section-sub">What you can do in this module</span>
          <i class="bi bi-chevron-down svc-set-chevron"></i>
        </div>
        <div class="svc-set-section-body">
          ${_buildPermissionsOverview()}
        </div>
      </div>
    `

    bindCollapsibles(panel)
    bindSteppers(panel)
    panel.querySelectorAll('select, input').forEach(el =>
      el.addEventListener('change', () => markUnsaved(panel))
    )
    bindSave(panel, () => {
      localStorage.setItem('svc:landing', (panel.querySelector<HTMLSelectElement>('#svc-set-landing')!).value)
      localStorage.setItem('svc:refresh', (panel.querySelector<HTMLSelectElement>('#svc-set-refresh')!).value)
      localStorage.setItem('svc:sort',    (panel.querySelector<HTMLSelectElement>('#svc-set-sort')!).value)
    })
  }

  function _buildPermissionsOverview(): string {
    const user = getCurrentUser()
    const permList = [
      { key: PERMISSIONS.SERVICES_VIEW,             label: 'View Services',        icon: 'bi-eye' },
      { key: PERMISSIONS.SERVICES_CREATE,           label: 'Create Services',      icon: 'bi-plus-circle' },
      { key: PERMISSIONS.SERVICES_EDIT,             label: 'Edit Services',        icon: 'bi-pencil' },
      { key: PERMISSIONS.SERVICES_DELETE,           label: 'Delete Services',      icon: 'bi-trash3' },
      { key: PERMISSIONS.SERVICES_TEMPLATES_MANAGE, label: 'Manage Templates',     icon: 'bi-arrow-repeat' },
      { key: PERMISSIONS.SERVICES_ATTENDANCE_MARK,  label: 'Mark Attendance',      icon: 'bi-person-check' },
    ]
    return permList.map(p => {
      const granted = user ? can(user, p.key) : false
      return `<div class="svc-set-row">
        <div class="svc-set-row-icon" style="background:${granted ? 'rgba(34,197,94,0.08)' : 'var(--bg-hover)'};">
          <i class="bi ${p.icon}" style="color:${granted ? '#22c55e' : 'var(--text-muted)'};"></i>
        </div>
        <div class="svc-set-row-text">
          <div class="svc-set-row-label">${p.label}</div>
          <div class="svc-set-row-desc" style="font-family:var(--font-mono,monospace);font-size:10px;">${p.key}</div>
        </div>
        <div class="svc-set-row-control">
          <span style="
            display:inline-flex;align-items:center;gap:5px;
            padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;
            background:${granted ? 'rgba(34,197,94,0.1)' : 'var(--bg-hover)'};
            border:1px solid ${granted ? 'rgba(34,197,94,0.25)' : 'var(--border-default)'};
            color:${granted ? '#56d364' : 'var(--text-muted)'};
          ">
            <span style="width:5px;height:5px;border-radius:50%;background:${granted ? '#22c55e' : 'var(--text-muted)'};"></span>
            ${granted ? 'Granted' : 'No access'}
          </span>
        </div>
      </div>`
    }).join('')
  }

  // ════════════════════════════════════════════════════
  // SECTION: CALENDAR
  // ════════════════════════════════════════════════════
  function renderCalendar(): void {
    panel.innerHTML = /* html */`
      <div class="svc-set-panel-head">
        <div>
          <h2 class="svc-set-panel-title">Calendar Settings</h2>
          <p class="svc-set-panel-sub">Control how dates, times and the calendar view behave</p>
        </div>
        <div class="svc-set-save-row">
          <span class="svc-set-unsaved-dot"></span>
          <button class="svc-tbtn svc-tbtn-primary" data-save-section style="height:36px;font-size:12px;">
            <i class="bi bi-floppy"></i> Save Changes
          </button>
        </div>
      </div>

      <!-- Preview strip -->
      <div id="svc-cal-preview" style="
        display:flex;align-items:center;gap:12px;flex-wrap:wrap;
        padding:12px 16px;border-radius:var(--radius-lg);
        background:rgba(0,75,160,0.05);border:1px solid rgba(0,75,160,0.15);
        margin-bottom:20px;font-size:12px;color:var(--text-secondary);
      ">
        <i class="bi bi-eye" style="color:var(--caci-blue-light);flex-shrink:0;"></i>
        <span>Preview:</span>
        <strong id="svc-cal-prev-date" style="color:var(--text-primary);">—</strong>
        <span style="color:var(--border-strong);">·</span>
        <strong id="svc-cal-prev-time" style="color:var(--text-primary);">—</strong>
        <span style="color:var(--border-strong);">·</span>
        <span>Week starts on <strong id="svc-cal-prev-day" style="color:var(--text-primary);">—</strong></span>
      </div>

      <div class="svc-set-section">
        <div class="svc-set-section-head">
          <div class="svc-set-section-icon" style="background:rgba(0,75,160,0.1);">
            <i class="bi bi-calendar3" style="color:var(--caci-blue-light);"></i>
          </div>
          <span class="svc-set-section-label">Date &amp; Time Format</span>
          <span class="svc-set-section-sub">Affects all dates across the module</span>
          <i class="bi bi-chevron-down svc-set-chevron"></i>
        </div>
        <div class="svc-set-section-body">

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(0,75,160,0.1);">
              <i class="bi bi-calendar-day" style="color:var(--caci-blue-light);"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Date format</div>
              <div class="svc-set-row-desc">How dates appear in list and detail views</div>
            </div>
            <div class="svc-set-row-control">
              <select class="svc-set-select" id="svc-set-datefmt">
                <option value="dmy" selected>DD MMM YYYY (3 Jun 2026)</option>
                <option value="mdy">MMM DD, YYYY (Jun 3, 2026)</option>
                <option value="iso">YYYY-MM-DD (2026-06-03)</option>
              </select>
            </div>
          </div>

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(240,165,0,0.1);">
              <i class="bi bi-clock" style="color:#f0a500;"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Time format</div>
              <div class="svc-set-row-desc">12-hour or 24-hour clock display</div>
            </div>
            <div class="svc-set-row-control">
              <select class="svc-set-select" id="svc-set-timefmt">
                <option value="12" ${_prefs.timeFormat === '12' ? 'selected' : ''}>12-hour (9:00 AM)</option>
                <option value="24" ${_prefs.timeFormat === '24' ? 'selected' : ''}>24-hour (09:00)</option>
              </select>
            </div>
          </div>

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(34,197,94,0.1);">
              <i class="bi bi-calendar-week" style="color:#22c55e;"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">First day of week</div>
              <div class="svc-set-row-desc">Sets the starting column in the calendar grid</div>
            </div>
            <div class="svc-set-row-control">
              <select class="svc-set-select" id="svc-set-firstday">
                <option value="0" ${_prefs.firstDayOfWeek === '0' ? 'selected' : ''}>Sunday</option>
                <option value="1" ${_prefs.firstDayOfWeek === '1' ? 'selected' : ''}>Monday</option>
              </select>
            </div>
          </div>

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(139,148,158,0.1);">
              <i class="bi bi-hash" style="color:var(--text-muted);"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Show week numbers</div>
              <div class="svc-set-row-desc">Display ISO week numbers in the calendar grid</div>
            </div>
            <div class="svc-set-row-control">
              ${buildToggle('svc-tog-weeknum', _prefs.showWeekNumbers === '1', () => {})}
            </div>
          </div>

        </div>
      </div>

      <div class="svc-set-section">
        <div class="svc-set-section-head">
          <div class="svc-set-section-icon" style="background:rgba(88,166,255,0.1);">
            <i class="bi bi-eye" style="color:#58a6ff;"></i>
          </div>
          <span class="svc-set-section-label">View Defaults</span>
          <span class="svc-set-section-sub">Initial state when opening the Schedule tab</span>
          <i class="bi bi-chevron-down svc-set-chevron"></i>
        </div>
        <div class="svc-set-section-body">

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(88,166,255,0.1);">
              <i class="bi bi-layout-text-window" style="color:#58a6ff;"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Default schedule view</div>
              <div class="svc-set-row-desc">List or calendar on first load</div>
            </div>
            <div class="svc-set-row-control">
              <select class="svc-set-select" id="svc-set-defview">
                <option value="list"     ${_prefs.defaultView === 'list'     ? 'selected' : ''}>List</option>
                <option value="calendar" ${_prefs.defaultView === 'calendar' ? 'selected' : ''}>Calendar</option>
              </select>
            </div>
          </div>

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(124,58,237,0.1);">
              <i class="bi bi-calendar-range" style="color:#a78bfa;"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Default calendar month</div>
              <div class="svc-set-row-desc">Start calendar at current month or last visited</div>
            </div>
            <div class="svc-set-row-control">
              <select class="svc-set-select" id="svc-set-calstart">
                <option value="current" selected>Current month</option>
                <option value="last">Last visited</option>
              </select>
            </div>
          </div>

        </div>
      </div>
    `

    // Live preview
    function updatePreview(): void {
      const fmt    = (panel.querySelector<HTMLSelectElement>('#svc-set-datefmt')!).value
      const tFmt   = (panel.querySelector<HTMLSelectElement>('#svc-set-timefmt')!).value
      const fDay   = (panel.querySelector<HTMLSelectElement>('#svc-set-firstday')!).value

      const now    = new Date()
      const dStr   = fmt === 'iso'
        ? now.toISOString().split('T')[0]
        : fmt === 'mdy'
        ? now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

      const tStr   = tFmt === '24'
        ? now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
        : now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

      const dayStr = fDay === '1' ? 'Monday' : 'Sunday'

      const dEl = panel.querySelector<HTMLElement>('#svc-cal-prev-date')
      const tEl = panel.querySelector<HTMLElement>('#svc-cal-prev-time')
      const dEl2 = panel.querySelector<HTMLElement>('#svc-cal-prev-day')
      if (dEl)  dEl.textContent  = dStr
      if (tEl)  tEl.textContent  = tStr
      if (dEl2) dEl2.textContent = dayStr
    }

    updatePreview()
    panel.querySelectorAll('select').forEach(el => {
      el.addEventListener('change', () => { updatePreview(); markUnsaved(panel) })
    })

    bindCollapsibles(panel)
    bindToggles(panel)

    bindSave(panel, () => {
      localStorage.setItem('svc:timeFormat',    (panel.querySelector<HTMLSelectElement>('#svc-set-timefmt')!).value)
      localStorage.setItem('svc:firstDay',      (panel.querySelector<HTMLSelectElement>('#svc-set-firstday')!).value)
      localStorage.setItem('svc:defaultView',   (panel.querySelector<HTMLSelectElement>('#svc-set-defview')!).value)
      localStorage.setItem('svc:weekNumbers',   (panel.querySelector<HTMLInputElement>('#svc-tog-weeknum')!).checked ? '1' : '0')
    })
  }

  // ════════════════════════════════════════════════════
  // SECTION: ATTENDANCE
  // ════════════════════════════════════════════════════
  function renderAttendance(): void {
    panel.innerHTML = /* html */`
      <div class="svc-set-panel-head">
        <div>
          <h2 class="svc-set-panel-title">Attendance Settings</h2>
          <p class="svc-set-panel-sub">Control how attendance is recorded and tracked</p>
        </div>
        <div class="svc-set-save-row">
          <span class="svc-set-unsaved-dot"></span>
          <button class="svc-tbtn svc-tbtn-primary" data-save-section style="height:36px;font-size:12px;">
            <i class="bi bi-floppy"></i> Save Changes
          </button>
        </div>
      </div>

      <div class="svc-set-section">
        <div class="svc-set-section-head">
          <div class="svc-set-section-icon" style="background:rgba(34,197,94,0.1);">
            <i class="bi bi-person-check-fill" style="color:#22c55e;"></i>
          </div>
          <span class="svc-set-section-label">Status Configuration</span>
          <span class="svc-set-section-sub">Which statuses are available and their defaults</span>
          <i class="bi bi-chevron-down svc-set-chevron"></i>
        </div>
        <div class="svc-set-section-body">

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(34,197,94,0.1);">
              <i class="bi bi-star-fill" style="color:#22c55e;"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Default status</div>
              <div class="svc-set-row-desc">Status assigned to members before attendance is marked</div>
            </div>
            <div class="svc-set-row-control">
              <select class="svc-set-select" id="svc-set-defstatus">
                <option value="absent"  ${_prefs.defaultStatus === 'absent'  ? 'selected' : ''}>Absent (mark present)</option>
                <option value="present" ${_prefs.defaultStatus === 'present' ? 'selected' : ''}>Present (mark absent)</option>
              </select>
            </div>
          </div>

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(210,153,34,0.1);">
              <i class="bi bi-hourglass-split" style="color:#d29922;"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Allow "Excused" status</div>
              <div class="svc-set-row-desc">Enables the excused button in the attendance picker</div>
            </div>
            <div class="svc-set-row-control">
              ${buildToggle('svc-tog-excused', _prefs.allowExcused === '1', () => {})}
            </div>
          </div>

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(88,166,255,0.1);">
              <i class="bi bi-clock-history" style="color:#58a6ff;"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Allow "Late" status</div>
              <div class="svc-set-row-desc">Adds a fourth status option alongside present / absent / excused</div>
            </div>
            <div class="svc-set-row-control">
              ${buildToggle('svc-tog-late', _prefs.allowLate === '1', () => {})}
            </div>
          </div>

        </div>
      </div>

      <div class="svc-set-section">
        <div class="svc-set-section-head">
          <div class="svc-set-section-icon" style="background:rgba(198,0,38,0.08);">
            <i class="bi bi-person-x-fill" style="color:var(--caci-red);"></i>
          </div>
          <span class="svc-set-section-label">Absence Tracking</span>
          <span class="svc-set-section-sub">Thresholds for automated absence alerts</span>
          <i class="bi bi-chevron-down svc-set-chevron"></i>
        </div>
        <div class="svc-set-section-body">

          <div class="svc-set-callout">
            <i class="bi bi-info-circle-fill"></i>
            When a member reaches the absence threshold, they are flagged in the Reports tab and can automatically trigger a pastoral follow-up case if the integration is enabled.
          </div>

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(198,0,38,0.08);">
              <i class="bi bi-exclamation-triangle-fill" style="color:var(--caci-red);"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Absence alert threshold</div>
              <div class="svc-set-row-desc">Consecutive or cumulative absences before flagging</div>
            </div>
            <div class="svc-set-row-control">
              <div class="svc-set-stepper"
                data-stepper="absThreshold"
                data-min="1" data-max="20">
                <button class="svc-set-step-btn" data-step-dec="absThreshold">−</button>
                <div class="svc-set-step-val" data-step-val="absThreshold">${_prefs.absenceThreshold}</div>
                <button class="svc-set-step-btn" data-step-inc="absThreshold">+</button>
              </div>
            </div>
          </div>

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(124,58,237,0.1);">
              <i class="bi bi-git" style="color:#a78bfa;"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Auto-create pastoral case</div>
              <div class="svc-set-row-desc">Automatically open a follow-up case when threshold is reached</div>
            </div>
            <div class="svc-set-row-control">
              ${buildToggle('svc-tog-pastoral', false, () => {})}
            </div>
          </div>

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(240,165,0,0.1);">
              <i class="bi bi-calendar-check" style="color:#f0a500;"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Count method</div>
              <div class="svc-set-row-desc">Whether the threshold counts consecutive or cumulative absences</div>
            </div>
            <div class="svc-set-row-control">
              <select class="svc-set-select" id="svc-set-absmethod">
                <option value="consecutive" selected>Consecutive</option>
                <option value="cumulative">Cumulative (30 days)</option>
                <option value="cumulative_90">Cumulative (90 days)</option>
              </select>
            </div>
          </div>

        </div>
      </div>

      <div class="svc-set-section">
        <div class="svc-set-section-head">
          <div class="svc-set-section-icon" style="background:rgba(0,75,160,0.1);">
            <i class="bi bi-clock-fill" style="color:var(--caci-blue-light);"></i>
          </div>
          <span class="svc-set-section-label">Recording Window</span>
          <span class="svc-set-section-sub">When attendance can be marked relative to the service time</span>
          <i class="bi bi-chevron-down svc-set-chevron"></i>
        </div>
        <div class="svc-set-section-body">

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(0,75,160,0.1);">
              <i class="bi bi-box-arrow-in-left" style="color:var(--caci-blue-light);"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Open before service</div>
              <div class="svc-set-row-desc">Hours before start time that attendance can be marked</div>
            </div>
            <div class="svc-set-row-control">
              <div class="svc-set-stepper"
                data-stepper="openBefore"
                data-min="0" data-max="48">
                <button class="svc-set-step-btn" data-step-dec="openBefore">−</button>
                <div class="svc-set-step-val" data-step-val="openBefore">${_prefs.reminderHours}</div>
                <button class="svc-set-step-btn" data-step-inc="openBefore">+</button>
              </div>
            </div>
          </div>

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(34,197,94,0.1);">
              <i class="bi bi-box-arrow-in-right" style="color:#22c55e;"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Close after service</div>
              <div class="svc-set-row-desc">Hours after start time before attendance locks</div>
            </div>
            <div class="svc-set-row-control">
              <div class="svc-set-stepper"
                data-stepper="closeAfter"
                data-min="0" data-max="168">
                <button class="svc-set-step-btn" data-step-dec="closeAfter">−</button>
                <div class="svc-set-step-val" data-step-val="closeAfter">24</div>
                <button class="svc-set-step-btn" data-step-inc="closeAfter">+</button>
              </div>
            </div>
          </div>

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(139,148,158,0.1);">
              <i class="bi bi-lock-fill" style="color:var(--text-muted);"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Allow editing past attendance</div>
              <div class="svc-set-row-desc">Whether admins can modify records after the window closes</div>
            </div>
            <div class="svc-set-row-control">
              ${buildToggle('svc-tog-pastatt', true, () => {})}
            </div>
          </div>

        </div>
      </div>
    `

    bindCollapsibles(panel)
    bindToggles(panel)
    bindSteppers(panel)
    panel.querySelectorAll('select').forEach(el =>
      el.addEventListener('change', () => markUnsaved(panel))
    )
    bindSave(panel, () => {
      localStorage.setItem('svc:defStatus',       (panel.querySelector<HTMLSelectElement>('#svc-set-defstatus')!).value)
      localStorage.setItem('svc:allowExcused',    (panel.querySelector<HTMLInputElement>('#svc-tog-excused')!).checked ? '1' : '0')
      localStorage.setItem('svc:allowLate',       (panel.querySelector<HTMLInputElement>('#svc-tog-late')!).checked ? '1' : '0')
      localStorage.setItem('svc:absenceThreshold', (panel.querySelector('[data-step-val="absThreshold"]') as HTMLElement)?.textContent ?? '3')
    })
  }

  // ════════════════════════════════════════════════════
  // SECTION: SERVICE TYPES
  // ════════════════════════════════════════════════════
  function renderTypes(): void {
    panel.innerHTML = /* html */`
      <div class="svc-set-panel-head">
        <div>
          <h2 class="svc-set-panel-title">Service Types</h2>
          <p class="svc-set-panel-sub">Defined service categories used across the module</p>
        </div>
      </div>

      <div class="svc-set-callout" style="margin:0 0 20px;">
        <i class="bi bi-info-circle-fill"></i>
        Service types are predefined constants. Custom types can be entered directly in the service form.
        Contact your administrator to add assembly-specific types to the system.
      </div>

      <div class="svc-set-section">
        <div class="svc-set-section-head">
          <div class="svc-set-section-icon" style="background:rgba(0,75,160,0.1);">
            <i class="bi bi-tag-fill" style="color:var(--caci-blue-light);"></i>
          </div>
          <span class="svc-set-section-label">Defined Types</span>
          <span class="svc-set-section-sub">${SERVICE_TYPES.length} types available</span>
          <i class="bi bi-chevron-down svc-set-chevron"></i>
        </div>
        <div class="svc-set-section-body">
          <div class="svc-set-type-grid">
            ${SERVICE_TYPES.map(t => {
              const tc = serviceTypeColor(t)
              return `<span class="svc-set-type-chip" style="background:${tc.bg};border-color:${tc.color}30;color:${tc.color};">
                <i class="bi bi-circle-fill" style="font-size:6px;"></i>${t}
              </span>`
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Per-type configuration -->
      <div class="svc-set-section">
        <div class="svc-set-section-head">
          <div class="svc-set-section-icon" style="background:rgba(124,58,237,0.1);">
            <i class="bi bi-sliders2-vertical" style="color:#a78bfa;"></i>
          </div>
          <span class="svc-set-section-label">Type Defaults</span>
          <span class="svc-set-section-sub">Per-type attendance and scheduling defaults</span>
          <i class="bi bi-chevron-down svc-set-chevron"></i>
        </div>
        <div class="svc-set-section-body">
          ${['Sunday Service','Midweek Service','Prayer Meeting','Cell Meeting'].map(t => {
            const tc = serviceTypeColor(t)
            return `<div class="svc-set-row">
              <div class="svc-set-row-icon" style="background:${tc.bg};">
                <i class="bi bi-calendar2-week" style="color:${tc.color};"></i>
              </div>
              <div class="svc-set-row-text">
                <div class="svc-set-row-label">${t}</div>
                <div class="svc-set-row-desc">Track attendance by default</div>
              </div>
              <div class="svc-set-row-control">
                ${buildToggle(`svc-tog-type-${t.replace(/\s+/g,'-').toLowerCase()}`, true, () => {})}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `
    bindCollapsibles(panel)
    bindToggles(panel)
  }

  // ════════════════════════════════════════════════════
  // SECTION: NOTIFICATIONS
  // ════════════════════════════════════════════════════
  function renderNotifications(): void {
    panel.innerHTML = /* html */`
      <div class="svc-set-panel-head">
        <div>
          <h2 class="svc-set-panel-title">Notifications</h2>
          <p class="svc-set-panel-sub">Control which events generate alerts and reminders</p>
        </div>
        <div class="svc-set-save-row">
          <span class="svc-set-unsaved-dot"></span>
          <button class="svc-tbtn svc-tbtn-primary" data-save-section style="height:36px;font-size:12px;">
            <i class="bi bi-floppy"></i> Save Changes
          </button>
        </div>
      </div>

      <div class="svc-set-section">
        <div class="svc-set-section-head">
          <div class="svc-set-section-icon" style="background:rgba(0,75,160,0.1);">
            <i class="bi bi-calendar-check" style="color:var(--caci-blue-light);"></i>
          </div>
          <span class="svc-set-section-label">Service Events</span>
          <span class="svc-set-section-sub">Alerts for service lifecycle changes</span>
          <i class="bi bi-chevron-down svc-set-chevron"></i>
        </div>
        <div class="svc-set-section-body">
          ${[
            { id:'notif-create', icon:'bi-plus-circle-fill', color:'#22c55e', bg:'rgba(34,197,94,0.1)',
              label:'New service created', desc:'Notify when a service is added to the schedule', on: _prefs.notifyOnCreate === '1' },
            { id:'notif-cancel', icon:'bi-x-circle-fill', color:'var(--caci-red)', bg:'rgba(198,0,38,0.08)',
              label:'Service cancelled', desc:'Alert all assigned staff when a service is cancelled', on: _prefs.notifyOnCancel === '1' },
            { id:'notif-edit', icon:'bi-pencil-fill', color:'#58a6ff', bg:'rgba(88,166,255,0.1)',
              label:'Service details changed', desc:'Notify when time, venue or type is edited', on: true },
            { id:'notif-remind', icon:'bi-clock-fill', color:'#f0a500', bg:'rgba(240,165,0,0.1)',
              label:'Service reminder', desc:'Reminder sent before the service starts', on: true },
          ].map(n => `
            <div class="svc-set-row">
              <div class="svc-set-row-icon" style="background:${n.bg};">
                <i class="bi ${n.icon}" style="color:${n.color};"></i>
              </div>
              <div class="svc-set-row-text">
                <div class="svc-set-row-label">${n.label}</div>
                <div class="svc-set-row-desc">${n.desc}</div>
              </div>
              <div class="svc-set-row-control">
                ${buildToggle(n.id, n.on, () => {})}
              </div>
            </div>`).join('')}
        </div>
      </div>

      <div class="svc-set-section">
        <div class="svc-set-section-head">
          <div class="svc-set-section-icon" style="background:rgba(198,0,38,0.08);">
            <i class="bi bi-person-x-fill" style="color:var(--caci-red);"></i>
          </div>
          <span class="svc-set-section-label">Attendance Alerts</span>
          <span class="svc-set-section-sub">Member absence and anomaly notifications</span>
          <i class="bi bi-chevron-down svc-set-chevron"></i>
        </div>
        <div class="svc-set-section-body">
          ${[
            { id:'notif-absence', icon:'bi-person-dash-fill', color:'var(--caci-red)', bg:'rgba(198,0,38,0.08)',
              label:'Absence threshold reached', desc:'Notify pastor when a member hits the configured absence threshold', on: _prefs.notifyAbsence === '1' },
            { id:'notif-lowatt', icon:'bi-bar-chart-fill', color:'#d29922', bg:'rgba(210,153,34,0.1)',
              label:'Low overall attendance', desc:'Alert when service attendance falls below 60%', on: false },
            { id:'notif-unsaved', icon:'bi-floppy-fill', color:'#58a6ff', bg:'rgba(88,166,255,0.1)',
              label:'Remind to save attendance', desc:'Prompt after recording attendance without saving', on: true },
          ].map(n => `
            <div class="svc-set-row">
              <div class="svc-set-row-icon" style="background:${n.bg};">
                <i class="bi ${n.icon}" style="color:${n.color};"></i>
              </div>
              <div class="svc-set-row-text">
                <div class="svc-set-row-label">${n.label}</div>
                <div class="svc-set-row-desc">${n.desc}</div>
              </div>
              <div class="svc-set-row-control">
                ${buildToggle(n.id, n.on, () => {})}
              </div>
            </div>`).join('')}
        </div>
      </div>

      <div class="svc-set-section">
        <div class="svc-set-section-head">
          <div class="svc-set-section-icon" style="background:rgba(240,165,0,0.1);">
            <i class="bi bi-bell-fill" style="color:#f0a500;"></i>
          </div>
          <span class="svc-set-section-label">Reminder Timing</span>
          <span class="svc-set-section-sub">When to send pre-service reminders</span>
          <i class="bi bi-chevron-down svc-set-chevron"></i>
        </div>
        <div class="svc-set-section-body">
          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(240,165,0,0.1);">
              <i class="bi bi-clock" style="color:#f0a500;"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">First reminder</div>
              <div class="svc-set-row-desc">Hours before the service start time</div>
            </div>
            <div class="svc-set-row-control">
              <div class="svc-set-stepper" data-stepper="remind1" data-min="1" data-max="72">
                <button class="svc-set-step-btn" data-step-dec="remind1">−</button>
                <div class="svc-set-step-val" data-step-val="remind1">24</div>
                <button class="svc-set-step-btn" data-step-inc="remind1">+</button>
              </div>
            </div>
          </div>
          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(240,165,0,0.1);">
              <i class="bi bi-alarm" style="color:#f0a500;"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Second reminder</div>
              <div class="svc-set-row-desc">Closer reminder before the service starts</div>
            </div>
            <div class="svc-set-row-control">
              <div class="svc-set-stepper" data-stepper="remind2" data-min="0" data-max="12">
                <button class="svc-set-step-btn" data-step-dec="remind2">−</button>
                <div class="svc-set-step-val" data-step-val="remind2">2</div>
                <button class="svc-set-step-btn" data-step-inc="remind2">+</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
    bindCollapsibles(panel)
    bindToggles(panel)
    bindSteppers(panel)
    panel.querySelectorAll('select, input[type="checkbox"]').forEach(el =>
      el.addEventListener('change', () => markUnsaved(panel))
    )
    bindSave(panel, () => {
      localStorage.setItem('svc:notifyCreate',  (panel.querySelector<HTMLInputElement>('#notif-create')!).checked ? '1' : '0')
      localStorage.setItem('svc:notifyCancel',  (panel.querySelector<HTMLInputElement>('#notif-cancel')!).checked ? '1' : '0')
      localStorage.setItem('svc:notifyAbsence', (panel.querySelector<HTMLInputElement>('#notif-absence')!).checked ? '1' : '0')
    })
  }

  // ════════════════════════════════════════════════════
  // SECTION: DISPLAY
  // ════════════════════════════════════════════════════
  function renderDisplay(): void {
    panel.innerHTML = /* html */`
      <div class="svc-set-panel-head">
        <div>
          <h2 class="svc-set-panel-title">Display</h2>
          <p class="svc-set-panel-sub">Visual and layout preferences for the module</p>
        </div>
        <div class="svc-set-save-row">
          <span class="svc-set-unsaved-dot"></span>
          <button class="svc-tbtn svc-tbtn-primary" data-save-section style="height:36px;font-size:12px;">
            <i class="bi bi-floppy"></i> Save Changes
          </button>
        </div>
      </div>

      <div class="svc-set-section">
        <div class="svc-set-section-head">
          <div class="svc-set-section-icon" style="background:rgba(0,75,160,0.1);">
            <i class="bi bi-palette-fill" style="color:var(--caci-blue-light);"></i>
          </div>
          <span class="svc-set-section-label">Accent Colour</span>
          <span class="svc-set-section-sub">Used for active filters, badges and highlights</span>
          <i class="bi bi-chevron-down svc-set-chevron"></i>
        </div>
        <div class="svc-set-section-body">
          <div class="svc-set-row" style="align-items:center;">
            <div class="svc-set-row-icon" style="background:rgba(0,75,160,0.1);">
              <i class="bi bi-droplet-fill" style="color:var(--caci-blue-light);"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Preset colours</div>
              <div class="svc-set-row-desc">Click a dot to apply; or use the custom picker</div>
            </div>
            <div class="svc-set-row-control">
              <div class="svc-set-color-row" id="svc-color-row">
                ${ACCENT_PRESETS.map(c => `
                  <div class="svc-set-color-dot${c === _prefs.accentColor ? ' selected' : ''}"
                    data-color="${c}" style="background:${c};"
                    title="${c}" role="button" tabindex="0" aria-label="Accent colour ${c}">
                  </div>`).join('')}
                <input type="color" id="svc-custom-color"
                  value="${_prefs.accentColor}"
                  style="width:22px;height:22px;padding:0;border:none;border-radius:50%;cursor:pointer;overflow:hidden;background:none;"
                  title="Custom colour">
              </div>
            </div>
          </div>
          <!-- Live preview -->
          <div style="padding:12px 16px 16px;border-top:1px solid var(--border-subtle);">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.06em;">Preview</div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <span id="svc-accent-preview-badge" style="
                display:inline-flex;align-items:center;gap:5px;
                padding:4px 12px;border-radius:99px;font-size:11px;font-weight:600;
                background:rgba(0,75,160,0.12);border:1px solid rgba(0,75,160,0.3);
                color:var(--caci-blue-light);
              ">Active filter</span>
              <button id="svc-accent-preview-btn" style="
                padding:6px 14px;border-radius:var(--radius-md);border:none;
                background:var(--caci-blue);color:#fff;font-size:12px;
                font-family:var(--font-sans);font-weight:600;cursor:default;
              ">Primary button</button>
              <span id="svc-accent-preview-link" style="font-size:12px;font-weight:600;color:var(--caci-blue-light);text-decoration:underline;cursor:default;">Link text</span>
            </div>
          </div>
        </div>
      </div>

      <div class="svc-set-section">
        <div class="svc-set-section-head">
          <div class="svc-set-section-icon" style="background:rgba(139,148,158,0.1);">
            <i class="bi bi-layout-three-columns" style="color:var(--text-muted);"></i>
          </div>
          <span class="svc-set-section-label">Layout &amp; Density</span>
          <span class="svc-set-section-sub">Table row size and information density</span>
          <i class="bi bi-chevron-down svc-set-chevron"></i>
        </div>
        <div class="svc-set-section-body">

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(139,148,158,0.1);">
              <i class="bi bi-distribute-vertical" style="color:var(--text-muted);"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Compact rows</div>
              <div class="svc-set-row-desc">Reduce table row height for more content on screen</div>
            </div>
            <div class="svc-set-row-control">
              ${buildToggle('svc-tog-compact', _prefs.compactRows === '1', () => {})}
            </div>
          </div>

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(34,197,94,0.1);">
              <i class="bi bi-percent" style="color:#22c55e;"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Show attendance percentage</div>
              <div class="svc-set-row-desc">Display % bar alongside the present/total count</div>
            </div>
            <div class="svc-set-row-control">
              ${buildToggle('svc-tog-attpcnt', _prefs.showAttendancePct === '1', () => {})}
            </div>
          </div>

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(240,165,0,0.1);">
              <i class="bi bi-image" style="color:#f0a500;"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Show member avatars</div>
              <div class="svc-set-row-desc">Display initials avatars in attendance rows</div>
            </div>
            <div class="svc-set-row-control">
              ${buildToggle('svc-tog-avatars', true, () => {})}
            </div>
          </div>

          <div class="svc-set-row">
            <div class="svc-set-row-icon" style="background:rgba(88,166,255,0.1);">
              <i class="bi bi-magic" style="color:#58a6ff;"></i>
            </div>
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">Entrance animations</div>
              <div class="svc-set-row-desc">Fade-up animations when lists and cards load</div>
            </div>
            <div class="svc-set-row-control">
              ${buildToggle('svc-tog-anims', true, () => {})}
            </div>
          </div>

        </div>
      </div>
    `

    // Colour picker live preview
    const updateAccentPreview = (color: string) => {
      const badge = panel.querySelector<HTMLElement>('#svc-accent-preview-badge')
      const btn   = panel.querySelector<HTMLElement>('#svc-accent-preview-btn')
      const link  = panel.querySelector<HTMLElement>('#svc-accent-preview-link')
      const r     = parseInt(color.slice(1,3),16)
      const g     = parseInt(color.slice(3,5),16)
      const b     = parseInt(color.slice(5,7),16)
      if (badge) {
        badge.style.background   = `rgba(${r},${g},${b},0.12)`
        badge.style.borderColor  = `rgba(${r},${g},${b},0.3)`
        badge.style.color        = color
      }
      if (btn)  btn.style.background  = color
      if (link) link.style.color      = color
    }
    updateAccentPreview(_prefs.accentColor)

    panel.querySelectorAll<HTMLElement>('.svc-set-color-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        panel.querySelectorAll('.svc-set-color-dot').forEach(d => d.classList.remove('selected'))
        dot.classList.add('selected')
        const c = dot.dataset['color']!
        ;(panel.querySelector<HTMLInputElement>('#svc-custom-color')!).value = c
        updateAccentPreview(c)
        markUnsaved(panel)
      })
      dot.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') dot.click()
      })
    })

    panel.querySelector<HTMLInputElement>('#svc-custom-color')?.addEventListener('input', e => {
      const c = (e.target as HTMLInputElement).value
      panel.querySelectorAll('.svc-set-color-dot').forEach(d => d.classList.remove('selected'))
      updateAccentPreview(c)
      markUnsaved(panel)
    })

    bindCollapsibles(panel)
    bindToggles(panel)
    panel.querySelectorAll('select, input').forEach(el =>
      el.addEventListener('change', () => markUnsaved(panel))
    )
    bindSave(panel, () => {
      const color = (panel.querySelector<HTMLInputElement>('#svc-custom-color')!).value
      localStorage.setItem('svc:accent',    color)
      localStorage.setItem('svc:compact',   (panel.querySelector<HTMLInputElement>('#svc-tog-compact')!).checked ? '1' : '0')
      localStorage.setItem('svc:showPct',   (panel.querySelector<HTMLInputElement>('#svc-tog-attpcnt')!).checked ? '1' : '0')
    })
  }

  // ════════════════════════════════════════════════════
  // SECTION: DATA & EXPORT
  // ════════════════════════════════════════════════════
  function renderData(): void {
    const assemblyId = getCurrentUser()?.assemblyId ?? '—'
    const stats = _state.services.length

    panel.innerHTML = /* html */`
      <div class="svc-set-panel-head">
        <div>
          <h2 class="svc-set-panel-title">Data &amp; Export</h2>
          <p class="svc-set-panel-sub">Export records, manage data visibility, and review module storage</p>
        </div>
      </div>

      <!-- Storage overview -->
      <div style="
        display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-sm);
        margin-bottom:20px;
      ">
        ${[
          { label:'Service Records', value: String(stats), icon:'bi-calendar-event',   color:'var(--caci-blue-light)', bg:'rgba(0,75,160,0.1)' },
          { label:'Attendance Rows', value:'—',             icon:'bi-person-check',     color:'#22c55e',                bg:'rgba(34,197,94,0.1)' },
          { label:'Templates',       value: String(_state.templates.length), icon:'bi-arrow-repeat', color:'#58a6ff', bg:'rgba(88,166,255,0.1)' },
        ].map(s => `<div style="
          background:var(--bg-card);border:1px solid var(--border-default);
          border-radius:var(--radius-lg);padding:14px;
          display:flex;align-items:center;gap:10px;
        ">
          <div style="width:32px;height:32px;border-radius:8px;background:${s.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <i class="bi ${s.icon}" style="font-size:14px;color:${s.color};"></i>
          </div>
          <div>
            <div style="font-size:18px;font-weight:700;color:var(--text-primary);line-height:1;">${s.value}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:1px;">${s.label}</div>
          </div>
        </div>`).join('')}
      </div>

      <div class="svc-set-section">
        <div class="svc-set-section-head">
          <div class="svc-set-section-icon" style="background:rgba(0,75,160,0.1);">
            <i class="bi bi-download" style="color:var(--caci-blue-light);"></i>
          </div>
          <span class="svc-set-section-label">Export Records</span>
          <span class="svc-set-section-sub">Download module data as CSV or JSON</span>
          <i class="bi bi-chevron-down svc-set-chevron"></i>
        </div>
        <div class="svc-set-section-body">

          ${[
            { label:'Services list',     desc:'All services with date, type, status and attendance counts', icon:'bi-calendar-event',   color:'var(--caci-blue-light)', bg:'rgba(0,75,160,0.1)' },
            { label:'Attendance records',desc:'Full attendance log with member names and statuses',         icon:'bi-person-check',     color:'#22c55e',                bg:'rgba(34,197,94,0.1)' },
            { label:'Templates',         desc:'All recurring service templates and their config',           icon:'bi-arrow-repeat',     color:'#58a6ff',                bg:'rgba(88,166,255,0.1)' },
            { label:'Absence report',    desc:'Members by absence count within the configured threshold',  icon:'bi-person-x-fill',    color:'var(--caci-red)',        bg:'rgba(198,0,38,0.08)' },
          ].map(item => `
            <div class="svc-set-row">
              <div class="svc-set-row-icon" style="background:${item.bg};">
                <i class="bi ${item.icon}" style="color:${item.color};"></i>
              </div>
              <div class="svc-set-row-text">
                <div class="svc-set-row-label">${item.label}</div>
                <div class="svc-set-row-desc">${item.desc}</div>
              </div>
              <div class="svc-set-row-control" style="display:flex;gap:6px;">
                <button class="svc-tbtn" style="height:30px;padding:0 10px;font-size:11px;" data-export="${item.label}" data-format="csv">
                  <i class="bi bi-filetype-csv" style="font-size:12px;"></i> CSV
                </button>
                <button class="svc-tbtn" style="height:30px;padding:0 10px;font-size:11px;" data-export="${item.label}" data-format="json">
                  <i class="bi bi-braces" style="font-size:12px;"></i> JSON
                </button>
              </div>
            </div>`).join('')}
        </div>
      </div>

      <div class="svc-set-section">
        <div class="svc-set-section-head">
          <div class="svc-set-section-icon" style="background:rgba(210,153,34,0.1);">
            <i class="bi bi-info-circle-fill" style="color:#d29922;"></i>
          </div>
          <span class="svc-set-section-label">Module Information</span>
          <span class="svc-set-section-sub">Assembly context and environment details</span>
          <i class="bi bi-chevron-down svc-set-chevron"></i>
        </div>
        <div class="svc-set-section-body">
          ${[
            { key:'Assembly ID',    val: assemblyId, mono: true  },
            { key:'Module version', val: '1.1.0',    mono: false },
            { key:'Realtime',       val: 'Connected (Supabase Postgres Changes)', mono: false },
            { key:'Database',       val: 'Supabase (PostgreSQL 15)', mono: false },
            { key:'RLS',            val: 'Enabled on all tables', mono: false },
          ].map(r => `<div class="svc-set-row">
            <div class="svc-set-row-text">
              <div class="svc-set-row-label">${r.key}</div>
            </div>
            <div style="font-size:${r.mono ? '10px' : '12px'};color:var(--text-secondary);font-family:${r.mono ? 'var(--font-mono,monospace)' : 'inherit'};text-align:right;flex-shrink:0;max-width:220px;word-break:break-all;">${r.val}</div>
          </div>`).join('')}
        </div>
      </div>
    `

    // Export buttons — scaffold (real CSV generation would use service data)
    panel.querySelectorAll<HTMLElement>('[data-export]').forEach(btn => {
      btn.addEventListener('click', () => {
        const label  = btn.dataset['export']!
        const format = btn.dataset['format']!
        _toast(`Exporting "${label}" as ${format.toUpperCase()}…`, 'bi-download', 'var(--caci-blue-light)')
        // Real implementation: build Blob from _state.services / attendance data and trigger download
      })
    })

    bindCollapsibles(panel)
  }

  // ════════════════════════════════════════════════════
  // SECTION: DANGER ZONE
  // ════════════════════════════════════════════════════
  function renderDanger(): void {
    panel.innerHTML = /* html */`
      <div class="svc-set-panel-head">
        <div>
          <h2 class="svc-set-panel-title" style="color:var(--caci-red);">Danger Zone</h2>
          <p class="svc-set-panel-sub">Irreversible operations — proceed with caution</p>
        </div>
      </div>

      <div class="svc-set-callout" style="margin-bottom:20px;background:rgba(198,0,38,0.05);border-color:rgba(198,0,38,0.2);">
        <i class="bi bi-exclamation-triangle-fill" style="color:var(--caci-red);"></i>
        All actions in this section are permanent and affect all assembly members. They cannot be undone from the UI. Only administrators can perform these actions.
      </div>

      <div class="svc-set-danger-section">
        <div class="svc-set-danger-head">
          <div style="width:28px;height:28px;border-radius:7px;background:rgba(198,0,38,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <i class="bi bi-trash3-fill" style="font-size:13px;color:var(--caci-red);"></i>
          </div>
          <span class="svc-set-danger-label">Delete All Cancelled Services</span>
        </div>
        <div style="padding:14px 16px;border-bottom:1px solid rgba(198,0,38,0.1);">
          <p style="font-size:12px;color:var(--text-secondary);margin:0 0 12px;line-height:1.6;">
            Permanently removes all services with <strong style="color:var(--text-primary);">cancelled</strong> status from the database.
            Attendance records linked to these services will also be removed. This cannot be reversed.
          </p>
          <button class="svc-tbtn" id="svc-danger-del-cancelled" style="
            color:var(--caci-red);border-color:rgba(198,0,38,0.25);
            background:rgba(198,0,38,0.05);
            height:34px;font-size:12px;
          ">
            <i class="bi bi-trash3"></i> Delete Cancelled Services
          </button>
        </div>
      </div>

      <div class="svc-set-danger-section">
        <div class="svc-set-danger-head">
          <div style="width:28px;height:28px;border-radius:7px;background:rgba(198,0,38,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <i class="bi bi-person-x-fill" style="font-size:13px;color:var(--caci-red);"></i>
          </div>
          <span class="svc-set-danger-label">Clear All Attendance Records</span>
        </div>
        <div style="padding:14px 16px;border-bottom:1px solid rgba(198,0,38,0.1);">
          <p style="font-size:12px;color:var(--text-secondary);margin:0 0 12px;line-height:1.6;">
            Permanently deletes every attendance record across all services. Service records themselves are preserved.
            This action resets all attendance history to zero.
          </p>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <input type="text" id="svc-danger-confirm-input" placeholder='Type "DELETE" to confirm'
              class="svc-set-input" style="max-width:240px;" autocomplete="off" spellcheck="false">
          </div>
          <button class="svc-tbtn" id="svc-danger-clear-att" disabled style="
            color:var(--caci-red);border-color:rgba(198,0,38,0.25);
            background:rgba(198,0,38,0.05);
            height:34px;font-size:12px;
            opacity:0.5;
          ">
            <i class="bi bi-person-slash"></i> Clear All Attendance
          </button>
        </div>
      </div>

      <div class="svc-set-danger-section">
        <div class="svc-set-danger-head">
          <div style="width:28px;height:28px;border-radius:7px;background:rgba(198,0,38,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <i class="bi bi-database-x" style="font-size:13px;color:var(--caci-red);"></i>
          </div>
          <span class="svc-set-danger-label">Reset Module</span>
        </div>
        <div style="padding:14px 16px;">
          <p style="font-size:12px;color:var(--text-secondary);margin:0 0 12px;line-height:1.6;">
            Deletes all services, templates, and attendance records for this assembly.
            Resets the module to a clean state. This is a full wipe and cannot be undone.
          </p>
          <button class="svc-tbtn" id="svc-danger-reset" style="
            color:var(--caci-red);border-color:rgba(198,0,38,0.25);
            background:rgba(198,0,38,0.05);
            height:34px;font-size:12px;
          ">
            <i class="bi bi-exclamation-octagon"></i> Reset Module Data
          </button>
        </div>
      </div>
    `

    // Confirm-input gate
    const confirmInput = panel.querySelector<HTMLInputElement>('#svc-danger-confirm-input')!
    const clearAttBtn  = panel.querySelector<HTMLButtonElement>('#svc-danger-clear-att')!
    confirmInput.addEventListener('input', () => {
      const match = confirmInput.value === 'DELETE'
      clearAttBtn.disabled = !match
      clearAttBtn.style.opacity = match ? '1' : '0.5'
    })

    // Danger action hooks — all go through _confirm
    panel.querySelector('#svc-danger-del-cancelled')?.addEventListener('click', () => {
      _confirm(
        'Delete all cancelled services?',
        'This permanently removes all cancelled services and their attendance records. This action cannot be undone.',
        'Yes, Delete All',
        async () => {
          // Real implementation: batch softDelete or raw delete RPC
          _toast('All cancelled services deleted.', 'bi-check-circle', '#56d364')
        }
      )
    })

    panel.querySelector('#svc-danger-clear-att')?.addEventListener('click', () => {
      if (confirmInput.value !== 'DELETE') return
      _confirm(
        'Clear ALL attendance records?',
        'Every attendance record across every service will be permanently deleted. Service records are preserved. This cannot be undone.',
        'Yes, Clear Everything',
        async () => {
          confirmInput.value = ''
          clearAttBtn.disabled = true
          clearAttBtn.style.opacity = '0.5'
          _toast('Attendance records cleared.', 'bi-check-circle', '#56d364')
        }
      )
    })

    panel.querySelector('#svc-danger-reset')?.addEventListener('click', () => {
      _confirm(
        'Reset the entire Services module?',
        'All services, templates, and attendance data for this assembly will be permanently deleted. This is a complete wipe and cannot be undone.',
        'Yes, Reset Module',
        async () => {
          _toast('Module data reset.', 'bi-check-circle', '#56d364')
        }
      )
    })
  }

  // ── Boot the first section ────────────────────────────────────────────────
  renderSection('general')
}