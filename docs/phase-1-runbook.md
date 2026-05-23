# CACI Hub Web — Phase 1 Runbook: Core Layer

**Goal:** All infrastructure that modules depend on — registry, router, auth, permissions, events, middleware, guards.  
**Duration:** 3–4 days  
**Checkpoint:** Import router in `main.ts`, call `startRouter()`. Navigate to `#/test` — console logs "no route matched". No errors.

---

## Overview

The core layer is the foundation every module sits on. Core never imports from modules — the dependency only flows one way. Build and verify each file before moving to the next; later files depend on earlier ones.

```
src/core/
├── events.ts          ← 1. build first — no dependencies
├── permissions.ts     ← 2. no dependencies
├── registry.ts        ← 3. depends on module.types
├── auth.ts            ← 4. depends on supabase, auth.types
├── guards/
│   ├── authGuard.ts       ← 5. depends on auth
│   ├── permissionGuard.ts ← 6. depends on auth, permissions
│   └── onboardingGuard.ts ← 7. depends on supabase
├── middleware.ts      ← 8. depends on guards
└── router.ts          ← 9. depends on registry, middleware
```

---

## Step 1 — `src/core/events.ts`

The event bus. Build this first — it has no dependencies and everything else will eventually import from it.

```ts
// src/core/events.ts

type Listener = (data: unknown) => void

const _listeners: Record<string, Listener[]> = {}

export function emit(event: string, data?: unknown): void {
  ;(_listeners[event] ?? []).forEach(fn => {
    try {
      fn(data)
    } catch (err) {
      console.error(`[events] Error in "${event}" listener`, err)
    }
  })
}

export function on(event: string, fn: Listener): void {
  ;(_listeners[event] ??= []).push(fn)
}

export function off(event: string, fn: Listener): void {
  _listeners[event] = (_listeners[event] ?? []).filter(f => f !== fn)
}
```

**Event naming convention — use these strings consistently across all modules:**

```
member:registered     member:updated      member:deleted
member:restored       member:flagged      member:changed
group:updated         group:created       group:deleted
household:updated     household:created   household:deleted
giving:recorded       event:created       event:cancelled
attendance:marked     communication:notify
auth:signedOut
```

**Verify:**
```ts
// quick smoke test, delete after
import { emit, on } from '@core/events'
on('test:event', (d) => console.log('received:', d))
emit('test:event', { hello: 'world' })
// → received: { hello: 'world' }
```

---

## Step 2 — `src/core/permissions.ts`

The role/permission engine. Port role definitions directly from `CACI_Hub_Phase1_Roles_Permissions_Matrix.md`.

```ts
// src/core/permissions.ts

const rolePermissions: Record<string, string[]> = {
  super_admin:  ['*'],
  admin:        ['*'],
  pastor:       [
    'membership.*', 'communication.*', 'pastoral-care.*',
    'events.*', 'groups.*', 'reports.view',
  ],
  treasurer:    ['finance.*', 'giving.*', 'reports.*', 'membership.view'],
  media:        ['media.*', 'events.view'],
  group_leader: ['groups.*', 'attendance.*', 'membership.view'],
  usher:        ['attendance.*', 'events.view'],
  member:       ['events.view', 'media.view', 'giving.view', 'profile.view'],
}

export function hasPermission(role: string, permission: string): boolean {
  if (!permission) return true
  const perms = rolePermissions[role] ?? []
  if (perms.includes('*')) return true
  if (perms.includes(permission)) return true
  const [ns] = permission.split('.')
  return perms.includes(`${ns}.*`)
}
```

**How permission strings work:**

- `membership.view` — exact permission check
- `membership.*` — wildcard: grants all `membership.*` permissions
- `'*'` — super_admin / admin: grants everything
- Permissions are in the format `module.action` — e.g. `membership.create`, `finance.view`, `admin.access`

**Protection layers — permissions are enforced at three levels:**

1. `permissionGuard` in the router — blocks navigation to the route entirely
2. `hasPermission()` inside page `render()` — shows/hides action buttons
3. Supabase RLS — enforces at the database layer regardless of UI state

**Verify:**
```ts
import { hasPermission } from '@core/permissions'
console.log(hasPermission('pastor', 'membership.view'))   // true
console.log(hasPermission('pastor', 'finance.view'))      // false
console.log(hasPermission('admin', 'anything.at.all'))    // true
console.log(hasPermission('treasurer', 'membership.view'))// true
```

---

## Step 3 — `src/core/registry.ts`

The module registry. Collects manifests from all modules and exposes aggregated routes, sidebar items, widgets, and capabilities to the rest of the app. The app core never knows which modules exist — it only reads from the registry.

```ts
// src/core/registry.ts

import type {
  ModuleManifest,
  RouteDefinition,
  SidebarItem,
  WidgetDefinition,
  Capability,
  ModuleContext,
} from '@types/module.types'

const _modules: ModuleManifest[] = []

export function registerModule(mod: ModuleManifest): void {
  if (!mod.enabled) return  // disabled modules are silently skipped
  _modules.push(mod)
}

export function getRoutes(): RouteDefinition[] {
  return _modules.flatMap(m => m.routes ?? [])
}

export function getSidebarItems(): SidebarItem[] {
  return _modules
    .map(m => m.sidebar)
    .filter((s): s is SidebarItem => Boolean(s))
    .sort((a, b) => a.order - b.order)
}

export function getWidgets(
  can: (perm: string) => boolean
): WidgetDefinition[] {
  return _modules
    .flatMap(m => m.widgets ?? [])
    .filter(w => can(w.permission))
    .sort((a, b) => a.order - b.order)
}

export function getCapabilities(type: Capability): ModuleManifest[] {
  return _modules.filter(m => m.capabilities?.includes(type))
}

export async function initModules(context: ModuleContext): Promise<void> {
  for (const mod of _modules) {
    try {
      await mod.init?.(context)
    } catch (err) {
      // module failure is isolated — app continues booting
      console.error(`[registry] Failed to init module: ${mod.name}`, err)
    }
  }
}
```

> **Disabled modules have zero footprint.** When `enabled: false`, `registerModule` returns immediately. The module contributes no routes, no sidebar entries, no widgets, and is never initialised. Flip `enabled: true` to activate — nothing else needs to change.

---

## Step 4 — `src/core/auth.ts`

Loads the current user from Supabase Auth + the `user_profiles` table. Manages the active assembly context, which is critical for `super_admin` who can switch between assemblies.

```ts
// src/core/auth.ts

import { supabase } from './supabase'
import type { AppUser } from '@types/auth.types'

let _currentUser: AppUser | null = null
let _activeAssemblyId: string | null = null

export async function loadCurrentUser(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    _currentUser = null
    return
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  _currentUser = { ...user, ...profile }

  // super_admin starts with no active assembly — must select one via toolbar
  _activeAssemblyId = profile?.role === 'super_admin'
    ? null
    : profile?.assembly_id ?? null
}

export const getCurrentUser      = (): AppUser | null => _currentUser
export const isAuthenticated     = (): boolean        => !!_currentUser
export const getActiveAssemblyId = (): string | null  => _activeAssemblyId
export const setActiveAssemblyId = (id: string): void => { _activeAssemblyId = id }

export function onAuthStateChange(
  callback: (user: AppUser | null) => void
): void {
  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session) {
      _currentUser = null
      callback(null)
      return
    }
    await loadCurrentUser()
    callback(_currentUser)
  })
}
```

**`AppUser` shape — add to `src/types/auth.types.ts`:**

```ts
import type { User } from '@supabase/supabase-js'

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'pastor'
  | 'treasurer'
  | 'media'
  | 'group_leader'
  | 'usher'
  | 'member'

export interface UserProfile {
  id:          string
  role:        UserRole
  assembly_id: string | null
  full_name:   string | null
  avatar_url:  string | null
}

export type AppUser = User & UserProfile
```

**The `assembly_id` enforcement strategy:**

- Regular users: RLS automatically scopes all queries to their `assembly_id`. No extra filtering needed in repository methods.
- `super_admin`: has no RLS restriction. Must pass `assembly_id` explicitly from `getActiveAssemblyId()` in every repository query. The toolbar forces them to select an assembly before accessing data.
- This pattern is repeated in every repository `getAll()` method in Phase 4.

---

## Step 5 — `src/core/guards/authGuard.ts`

```ts
// src/core/guards/authGuard.ts

import { isAuthenticated } from '@core/auth'
import type { RouteDefinition, GuardResult } from '@types/module.types'

export async function authGuard(
  _route: RouteDefinition,
  _path: string
): Promise<GuardResult> {
  return isAuthenticated()
    ? { allowed: true }
    : { allowed: false, redirect: '/login' }
}
```

---

## Step 6 — `src/core/guards/permissionGuard.ts`

```ts
// src/core/guards/permissionGuard.ts

import { getCurrentUser } from '@core/auth'
import { hasPermission }  from '@core/permissions'
import type { RouteDefinition, GuardResult } from '@types/module.types'

export async function permissionGuard(
  route: RouteDefinition,
  _path: string
): Promise<GuardResult> {
  if (!route.permission) return { allowed: true }

  const user = getCurrentUser()
  if (!user) return { allowed: false, redirect: '/login' }

  return hasPermission(user.role, route.permission)
    ? { allowed: true }
    : { allowed: false, redirect: '/unauthorized' }
}
```

---

## Step 7 — `src/core/guards/onboardingGuard.ts`

Redirects to TOTP enrol if the authenticated user has not set up MFA. Runs after `authGuard` in the middleware pipeline.

```ts
// src/core/guards/onboardingGuard.ts

import { supabase } from '@core/supabase'
import type { RouteDefinition, GuardResult } from '@types/module.types'

export async function onboardingGuard(
  _route: RouteDefinition,
  _path: string
): Promise<GuardResult> {
  const { data, error } = await supabase.auth.mfa.listFactors()

  if (error) {
    console.error('[onboardingGuard] MFA check failed', error)
    return { allowed: true } // fail open — don't block on MFA API errors
  }

  const enrolled = (data?.totp?.length ?? 0) > 0
  return enrolled
    ? { allowed: true }
    : { allowed: false, redirect: '/totp-enroll' }
}
```

**Add `GuardResult` to `module.types.ts`:**

```ts
export interface GuardResult {
  allowed:   boolean
  redirect?: string
}

export type GuardFn = (
  route: RouteDefinition,
  path:  string
) => Promise<GuardResult>
```

---

## Step 8 — `src/core/middleware.ts`

Composes guards into a pipeline. Each route declares which guards to run via its `middleware` array. Guards run in order — the first one to deny stops the pipeline.

```ts
// src/core/middleware.ts

import { authGuard }        from './guards/authGuard'
import { permissionGuard }  from './guards/permissionGuard'
import { onboardingGuard }  from './guards/onboardingGuard'
import type { RouteDefinition, GuardResult, GuardFn } from '@types/module.types'

const guardMap: Record<string, GuardFn> = {
  auth:        authGuard,
  permissions: permissionGuard,
  onboarding:  onboardingGuard,
}

export async function runMiddleware(
  route: RouteDefinition,
  path:  string
): Promise<GuardResult> {
  for (const key of route.middleware ?? []) {
    const guard = guardMap[key]
    if (!guard) {
      console.warn(`[middleware] Unknown guard: "${key}"`)
      continue
    }
    const result = await guard(route, path)
    if (!result.allowed) return result
  }
  return { allowed: true }
}
```

**Adding a new guard in future:**
1. Create one file in `src/core/guards/`
2. Add one entry to `guardMap`
3. Reference the key in any route's `middleware` array

No other files need to change.

---

## Step 9 — `src/core/router.ts`

Hash-based SPA router. Reads routes from the registry, runs the middleware pipeline, and hands the matched page the content area to render into.

```ts
// src/core/router.ts

import { getRoutes }     from './registry'
import { runMiddleware } from './middleware'
import type { PageModule } from '@types/module.types'

let _activePage: PageModule | null = null

export function startRouter(): void {
  window.addEventListener('hashchange', resolve)
  document.addEventListener('click', handleLinkClick)
  resolve()
}

export function navigate(path: string): void {
  location.hash = path
}

async function resolve(): Promise<void> {
  const path   = location.hash.slice(1) || '/'
  const routes = getRoutes()
  const matched = routes.find(r => matchPath(r.path, path))

  if (!matched) {
    console.log(`[router] No route matched: ${path}`)
    render404()
    return
  }

  const result = await runMiddleware(matched, path)
  if (!result.allowed) {
    navigate(result.redirect ?? '/login')
    return
  }

  // destroy current page before loading next
  try {
    _activePage?.destroy?.()
  } catch (err) {
    console.error('[router] Error in page destroy()', err)
  }

  const { default: page } = await matched.page()
  _activePage = page

  // pass route params via dataset
  const params    = extractParams(matched.path, path)
  const container = document.getElementById('page-content')!
  Object.assign(container.dataset, params)

  await page.render(container)
}

function matchPath(pattern: string, path: string): boolean {
  const regex = new RegExp(
    '^' + pattern.replace(/:[^/]+/g, '([^/]+)') + '$'
  )
  return regex.test(path)
}

function extractParams(
  pattern: string,
  path:    string
): Record<string, string> {
  const keys   = [...pattern.matchAll(/:([^/]+)/g)].map(m => m[1])
  const values = path.match(
    new RegExp('^' + pattern.replace(/:[^/]+/g, '([^/]+)') + '$')
  )?.slice(1) ?? []
  return Object.fromEntries(keys.map((k, i) => [k, values[i]]))
}

function handleLinkClick(e: MouseEvent): void {
  const anchor = (e.target as Element).closest('a[href]')
  if (!anchor) return
  const href = anchor.getAttribute('href')!
  if (href.startsWith('/') || href.startsWith('#/')) {
    e.preventDefault()
    navigate(href.startsWith('#') ? href.slice(1) : href)
  }
}

function render404(): void {
  const container = document.getElementById('page-content')
  if (container) {
    container.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: #666;">
        <h2>404 — Page not found</h2>
        <p>No route matched <code>${location.hash}</code></p>
        <a href="#/">Go home</a>
      </div>
    `
  }
}
```

**How route params are passed to pages:**

The router sets params on `container.dataset` before calling `render()`. Pages read them inside `render()`:

```ts
// router sets this before render():
container.dataset.memberId = params.id

// MemberProfile.ts reads it:
async render(container: HTMLElement) {
  const memberId = container.dataset.memberId!
  // ...
}
```

**Route pattern matching examples:**

| Pattern | Path | Matches | Params |
|---|---|---|---|
| `/members` | `/members` | ✓ | `{}` |
| `/members/:id` | `/members/abc-123` | ✓ | `{ id: 'abc-123' }` |
| `/members/:id/edit` | `/members/abc-123/edit` | ✓ | `{ id: 'abc-123' }` |
| `/members/:id` | `/members/abc-123/edit` | ✗ | — |

---

## Wire it up in `main.ts`

Update `main.ts` to use the core layer. Still no modules registered — just verify the router runs.

```ts
// src/main.ts

import './styles/theme.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'

import { initModules }   from '@core/registry'
import { startRouter }   from '@core/router'
import { loadCurrentUser } from '@core/auth'
import { supabase }      from '@core/supabase'
import { emit, on }      from '@core/events'
import { hasPermission } from '@core/permissions'

// Modules registered here in Phase 3+

async function boot(): Promise<void> {
  console.log('[main] CACI Hub Web starting...')

  // 1. Load authenticated user (required before routing)
  await loadCurrentUser()

  // 2. Initialise all registered + enabled modules
  await initModules({ supabase, eventBus: { emit, on }, permissions: { hasPermission } })

  // 3. Start the router
  startRouter()

  console.log('[main] Boot complete')
}

boot().catch(console.error)
```

Add a minimal `#page-content` div to `index.html` so the router has somewhere to render:

```html
<body>
  <div id="app">
    <div id="page-content"></div>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
```

Add `ModuleContext` to `module.types.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database }       from './database.types'

export interface ModuleContext {
  supabase:    SupabaseClient<Database>
  eventBus:    { emit: typeof emit; on: typeof on }
  permissions: { hasPermission: typeof hasPermission }
}
```

---

## Checkpoint ✓

```bash
npm run dev
```

- Browser opens. Console shows `[main] Boot complete`.
- Navigate to `http://localhost:5173/#/test` — console logs `[router] No route matched: /test`.
- Navigate to `http://localhost:5173/#/` — same message (no routes registered yet).
- `tsc --noEmit` passes with no errors.
- No red console entries.

Commit, then proceed to Phase 2 — Shell & Shared Layer.
