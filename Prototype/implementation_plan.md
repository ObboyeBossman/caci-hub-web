# Settings Module Integration

Extract and integrate the [Prototype/settings-module.html](file:///home/obboye/dev/caci-hub-web/Prototype/settings-module.html) as a proper TypeScript/CSS module inside the existing module system. The settings page will overlay the shell (no shell chrome of its own) and be reachable via the profile popup and directly via `#/settings`.

## Proposed Changes

### Settings Module — new files

#### [NEW] `src/modules/settings/styles/settings.css`
Extract all CSS from the prototype `<style>` block verbatim (1-to-1), minus only the `body` centering rule (the shell already handles layout). Imports via [main.ts](file:///home/obboye/dev/caci-hub-web/src/main.ts).

#### [NEW] `src/modules/settings/pages/Settings.ts`
[PageModule](file:///home/obboye/dev/caci-hub-web/src/types/module.types.ts#23-27) class that:
- Renders the full settings modal HTML (all 5 panels: Profile, Appearance, Language & Region, Notifications, Privacy & Security) directly into the `#page-content` container.
- Pulls live user data (display name, email, initials) from `getCurrentUser()`.
- Contains all JS logic that is currently inline in the prototype (navigation, theme, accent, font size, notifications matrix, avatar upload, password modal, toast, offline detection, etc.) — all ported to TypeScript class methods.
- Has a [destroy()](file:///home/obboye/dev/caci-hub-web/src/shell/Toolbar.ts#131-137) method to remove event listeners.
- **Shell-less**: the route will use `presentation: 'shell'` so the page renders inside the standard shell (sidebar + topnav stay visible), but the content area fills with the settings panel layout. No extra backdrop/centering needed.

#### [NEW] `src/modules/settings/routes.ts`
```ts
export const settingsRoutes: RouteDefinition[] = [
  {
    path: '/settings',
    page: () => import('./pages/Settings'),
    middleware: ['auth'],
    presentation: 'shell',
  },
]
```

#### [NEW] `src/modules/settings/index.ts`
Standard [ModuleManifest](file:///home/obboye/dev/caci-hub-web/src/types/module.types.ts#123-164) with:
- `name: 'settings'`, `enabled: true`
- `routes: settingsRoutes`
- No sidebar entry (accessed from profile popup only)

---

### Glue changes

#### [MODIFY] [src/main.ts](file:///home/obboye/dev/caci-hub-web/src/main.ts)
Add `import './modules/settings/styles/settings.css'`

#### [MODIFY] [src/core/loading.ts](file:///home/obboye/dev/caci-hub-web/src/core/loading.ts)
Add:
```ts
import SettingsModule from '../modules/settings/index'
// …
registerModule(SettingsModule)
```

#### [MODIFY] [src/shell/Toolbar.ts](file:///home/obboye/dev/caci-hub-web/src/shell/Toolbar.ts)
In [showProfilePopup()](file:///home/obboye/dev/caci-hub-web/src/shell/Toolbar.ts#174-240) — the Settings menu item (lines 210-214):
- Remove `disabled` attribute
- Remove `style="opacity:0.5;cursor:not-allowed"`
- Remove `<span class="soon-chip">SOON</span>`
- Wire `data-action="settings"` click to [navigate('/settings')](file:///home/obboye/dev/caci-hub-web/src/core/router.ts#35-42)
- Add `if (action === 'settings') navigate('/settings')` in the click handler

## Verification Plan

### Automated Tests
No existing test suite found in the project. Verification is manual + TypeScript build.

```bash
# In /home/obboye/dev/caci-hub-web
npm run build
```
Must complete with 0 TypeScript errors.

### Manual Verification (dev server already running on `npm run dev`)
1. Open the app in the browser, log in, reach the dashboard.
2. Click the profile button (bottom-left of sidebar) → profile popup appears.
3. Verify "Settings" button is **no longer disabled** and has **no SOON chip**.
4. Click "Settings" → navigates to `#/settings`.
5. Verify all 5 sidebar panels render: Profile, Appearance, Language & Region, Notifications, Privacy & Security.
6. Click each panel and confirm content loads.
7. Toggle Dark mode in Appearance → theme switches.
8. Close by navigating away (back button / sidebar nav item).
9. Navigate directly to `http://localhost:PORT/#/settings` → same page loads.
