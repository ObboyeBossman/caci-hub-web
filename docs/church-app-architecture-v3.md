# CAC Hub Web — Architecture & Implementation Document

**Version:** 3.0.0
**Architecture Pattern:** Modular Monolith · Vertical Slice · Manifest-Driven · Capability-Based
**Last Updated:** May 2026
**Status:** Active — web-first MVP targeting Auth + Membership modules

### Changes from v2.0.0
- Households feature added to Membership module (4 pages, 1 schema, expanded repository)
- `HouseholdRow`, `HouseholdView`, `CreateHouseholdPayload`, `UpdateHouseholdPayload`, `HouseholdFilter`, `HouseholdWithMembers` added to `member.types.ts`
- `household.schema.ts` added to `membership/schemas/`
- `HouseholdFilterSchema` added to `filter.schema.ts`
- `repository.ts` household methods documented: `getHouseholds`, `getHouseholdById`, `getHouseholdMembers`, `createHousehold`, `updateHousehold`, `deleteHousehold`, `setPrimaryContact`
- Admin module stub added (`enabled: false`) — 3 pages matching Flutter `lib/features/admin/`
- Admin module registered in `main.ts` boot sequence
- `memberCache.ts` and `groupCache.ts` added to `shared/utils/` (from shared-data-cache-design.md)
- Phase 2 shell setup step updated to include cache file creation
- Skeleton variant table updated with household pages
- Migration plan Phase 4 updated with household steps and admin stub step
- Flutter carry-over table updated with household and admin entries

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architectural Goals](#3-architectural-goals)
4. [Core Principles](#4-core-principles)
5. [Folder Structure](#5-folder-structure)
6. [Module System](#6-module-system)
7. [Page Rendering Pattern](#7-page-rendering-pattern)
8. [Loading & Error State Pattern](#8-loading--error-state-pattern)
9. [Core Layer](#9-core-layer)
10. [Shell System](#10-shell-system)
11. [Routing](#11-routing)
12. [Middleware & Guards](#12-middleware--guards)
13. [Permission System](#13-permission-system)
14. [Event Bus](#14-event-bus)
15. [Capability System](#15-capability-system)
16. [Module Registry](#16-module-registry)
17. [Module Lifecycle](#17-module-lifecycle)
18. [Feature Flags](#18-feature-flags)
19. [TypeScript & Type System](#19-typescript--type-system)
20. [Database & Backend](#20-database--backend)
21. [Modules Breakdown](#21-modules-breakdown)
22. [App Boot Sequence](#22-app-boot-sequence)
23. [Scalability & Extension](#23-scalability--extension)
24. [Architectural Boundaries](#24-architectural-boundaries)
25. [Future Phases](#25-future-phases)
26. [Flutter → Web Migration Plan](#26-flutter--web-migration-plan)

---

## 1. Project Overview

CAC Hub is an enterprise-grade, modular web platform for managing all aspects of a church assembly — membership, finance, events, media, communication, giving, groups, attendance, volunteers, and pastoral care — through a unified, permission-aware, role-driven interface.

The platform is built around a **plug-in module architecture**. Adding a new feature module requires no edits to existing modules, the shell, or the router. The app discovers and composes itself from registered modules at boot time.

### Background

The platform was originally developed as a Flutter mobile app with a Supabase backend. The client requires a web-first deployment. The Supabase backend — 40 migrations, 5 Edge Functions, full RLS, Auth, Realtime, and Storage — is **complete and untouched**. The web app is a pure frontend built on top of the same Supabase project.

The Flutter app remains in place as the future mobile client. Both apps share the same Supabase project URL and anon key.

The most recent migration is `20260516000000_grant_anon_user_profile_select.sql`. No further backend changes are required for the web MVP.

### Design Philosophy

- The app core has no knowledge of individual feature implementations
- Every feature is an independent vertical slice with full ownership of its domain
- The shell, router, and sidebar adapt automatically as modules are added or removed
- Modules communicate via events, never through direct imports of each other
- Permissions are declared in manifests, not scattered across UI components

---

## 2. Tech Stack

### Frontend Core

| Layer | Technology | Notes |
|---|---|---|
| Language | TypeScript | Strict mode; all `.ts` files; no plain `.js` in `src/` |
| Bundler | Vite | Native TS support; no extra plugins; code splitting; lazy loading |
| CSS Framework | Bootstrap 5 | Layout, components, responsive grid, admin UI |
| Icons | Bootstrap Icons | SVG icon set, native Bootstrap fit |
| UI Reactivity | Alpine.js | Shell-level only — dropdowns, modals, notification badges. **Not used for page state.** Complex page state is managed via vanilla TS state objects inside each page module. |

### JavaScript / TypeScript Libraries

| Library | Replaces | Purpose |
|---|---|---|
| Day.js | — | Date formatting, relative time, event display |
| AG Grid Community | DataTables.js | Sortable, filterable, paginated tables. TypeScript-native, virtual scrolling, built-in export. Use when the member dataset exceeds ~500 rows or column-level filtering is needed. |
| Notyf | Toastify.js | Typed toast notifications — `toast.success()`, `toast.error()`, `toast.warning()`. Accessible (ARIA roles), Bootstrap-compatible. |
| Chart.js | — | Financial reports, attendance trends, giving dashboards |
| Zod | validate.js | Runtime schema validation on all form payloads. Replaces hand-written validators. Schemas live in each module's `schemas/` folder. |
| Quill.js | — | Rich text editor for pastoral notes, announcements, group descriptions |
| Cropper.js | — | In-browser avatar cropping before upload to Supabase Storage |
| DOMPurify | — | XSS sanitization of all Quill output before DOM insertion. Non-negotiable security requirement. |
| jsPDF + html2canvas | — | Client-side PDF generation for membership cards, receipts, report exports |
| QRCode.js | — | QR code generation for member check-in and digital membership cards |
| i18next | — | Internationalisation. Infrastructure set up from day one. Translations added per language. Target: English, Twi, Ga, Ewe, French, German. |
| Fuse.js | — | Client-side fuzzy search for in-page filtering on already-loaded data |
| vite-plugin-pwa + Workbox | — | PWA support from day one. Install prompt, offline fallback, asset caching. |

### Backend — Supabase (unchanged from Flutter project)

| Layer | Technology | Purpose |
|---|---|---|
| Database | PostgreSQL (Supabase managed) | All persistent data |
| Auth | Supabase Auth | JWT auth, email/password, TOTP MFA |
| Storage | Supabase Storage | Member photos, documents, media uploads |
| Realtime | Supabase Realtime | Live notifications, live attendance |
| Edge Functions | Deno (TypeScript) | Atomic operations, secure business rules |
| RLS | PostgreSQL RLS | Data access enforced at database layer per role |

**Existing Edge Functions (deployed, untouched):**
- `create-member-user` — creates auth user + member record atomically
- `send-welcome-email` — triggered after member registration
- `send-welcome-sms` — triggered after member registration
- `generate-membership-number` — sequential number generation
- `export-members-csv` — server-side CSV export with RLS scoping

### Infrastructure & Tooling

| Tool | Purpose |
|---|---|
| Vite | Build tool, hot reload, TS compilation |
| TypeScript | Language — strict mode throughout |
| ESLint + Prettier | Code quality and consistent formatting |
| Vitest | Unit tests — repository methods, Zod schemas, format utilities, permission engine |
| Playwright | E2E tests — login flow, add member flow, TOTP flow |
| Git + GitHub | Version control, branch-per-module development |
| Vercel | Frontend hosting, auto-deploy on push, CDN |
| Supabase Cloud | Managed backend |
| Supabase CLI | Local development — full Postgres + Auth + Storage locally |
| Docker | Required by Supabase CLI |

---

## 3. Architectural Goals

### The App Router is a Pure Composer

The global router contains no feature business logic, no hardcoded routes, no feature-specific redirects, and no switch statements. Its only job is to collect manifests from the registry, compose routes, run middleware, and render matched pages.

### Every Module is Self-Contained

Each module owns its routes, guards, middleware declarations, permissions, sidebar contribution, shell contributions, capabilities, schemas, repositories, services, and domain logic. No module reaches into another module's internals.

### No Centralized Feature Knowledge

The shell, router, and app core never know which screens exist, what a module's internal structure looks like, or what permissions a feature requires. All of this is declared inside each module manifest.

### Manifest-Driven Everything

Routes, sidebar items, permissions, middleware, capabilities, and lifecycle hooks are all declared in each module's manifest file. The app reads manifests and composes itself.

### Vertical Slice Organization

Features are organized by domain, not by technical layer. The codebase grows horizontally (new module folders) rather than vertically (bloated global folders).

---

## 4. Core Principles

| Principle | Implementation |
|---|---|
| Low coupling | Modules never import each other; events bridge communication |
| High cohesion | All logic for a feature lives inside its module |
| Feature isolation | A module failure does not break other modules |
| Declarative composition | The app assembles from manifests without hardcoded knowledge |
| Strong ownership | Each module owns its domain end-to-end |
| Scalable routing | Routes come from manifests, never hardcoded in the router |
| Scalable permissions | Permissions declared in manifests, evaluated centrally |
| Scalable navigation | Sidebar built from registered contributions, filtered by permissions |
| Type safety | TypeScript strict mode throughout; Supabase-generated types for all DB shapes |
| Runtime safety | Zod validates all form payloads and API responses at the boundary |

---

## 5. Folder Structure

See `folder_structure_v3.md` for the complete annotated file tree. Summary of top-level structure:

```
caci-hub-web/
├── index.html
├── vite.config.ts          ← aliases: @core, @shared, @types, @modules
├── tsconfig.json           ← strict: true, moduleResolution: bundler
├── package.json
├── .env
└── src/
    ├── main.ts
    ├── types/              ← database.types.ts, member.types.ts, auth.types.ts,
    │                          module.types.ts, common.types.ts
    ├── styles/             ← theme.css, shell.css, auth.css, membership.css,
    │                          dashboard.css, components.css, utilities.css
    ├── core/               ← supabase.ts, registry.ts, router.ts, auth.ts,
    │                          permissions.ts, events.ts, middleware.ts, guards/
    ├── shell/              ← Shell.ts, Sidebar.ts, Toolbar.ts,
    │                          Breadcrumbs.ts, NotificationBell.ts
    ├── shared/
    │   ├── utils/          ← pageHelpers.ts, memberCache.ts, groupCache.ts,
    │   │                      format.ts, storage.ts
    │   └── components/     ← Modal.ts, ConfirmDialog.ts, Avatar.ts, StatusBadge.ts,
    │                          Grid.ts, Toast.ts, Form.ts, EmptyState.ts
    └── modules/
        ├── auth/
        ├── dashboard/
        ├── membership/     ← includes households pages (MVP)
        ├── finance/        ← enabled: false
        ├── events/         ← enabled: false
        ├── comms/          ← enabled: false
        ├── admin/          ← enabled: false (stub)
        └── settings/
```

---

## 6. Module System

Every module exposes a single manifest object. This is its only public API. Nothing else in the module is imported from outside.

### Module Manifest Contract

```ts
// modules/[name]/index.ts
import type { ModuleManifest } from '@types/module.types';

const MembershipModule: ModuleManifest = {
  name:        'membership',
  version:     '1.0.0',
  description: 'Full member lifecycle management',
  icon:        'people-fill',
  category:    'ministry',
  enabled:     true,

  routes: [
    {
      path:       '/members',
      page:       () => import('./pages/MemberList'),
      middleware: ['auth', 'permissions'],
      permission: 'membership.view',
    },
    {
      path:       '/members/:id',
      page:       () => import('./pages/MemberProfile'),
      middleware: ['auth', 'permissions'],
      permission: 'membership.view',
    },
    {
      path:       '/members/add',
      page:       () => import('./pages/AddMember'),
      middleware: ['auth', 'permissions'],
      permission: 'membership.create',
    },
    // ... households routes, groups, attendance, reports, etc.
  ],

  sidebar: {
    label:      'Members',
    icon:       'people-fill',
    path:       '/members',
    permission: 'membership.view',
    order:      2,
    badge:      null,
  },

  capabilities: ['dashboard-widgets', 'search', 'reports'],

  widgets: [
    {
      id:         'new-members-widget',
      component:  () => import('./widgets/NewMembersWidget'),
      permission: 'membership.view',
      size:       'medium',
      order:      1,
    },
    {
      id:         'member-stats-widget',
      component:  () => import('./widgets/MemberStatsWidget'),
      permission: 'membership.view',
      size:       'small',
      order:      2,
    },
  ],

  async init({ supabase, eventBus }) {
    // Subscribe to Realtime once at boot — not per page render
    const channel = supabase
      .channel('members-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'members' },
        (payload) => eventBus.emit('member:changed', payload)
      )
      .subscribe();

    this._channel = channel;
  },

  async dispose() {
    supabase.removeChannel(this._channel);
  },
};

export default MembershipModule;
```

---

## 7. Page Rendering Pattern

Every page in the application exports a single default object conforming to the `PageModule` interface. This is the **only** rendering pattern used across all modules — no exceptions.

### The Contract

```ts
// src/types/module.types.ts

interface PageModule {
  render(container: HTMLElement): Promise<void>
  destroy?(): void
}
```

### How the Router Uses It

On every navigation:

```
navigate away from current page  →  currentPage.destroy?.()
navigate into new page           →  await newPage.render(contentArea)
```

`contentArea` is the single `<div id="page-content">` rendered by `Shell.ts`. The router hands it to the page. The page owns it completely for as long as it is active.

Route params are passed via `container.dataset` before `render()` is called:

```ts
// router.ts sets params before calling render
container.dataset.memberId = params.id;

// MemberProfile.ts reads them inside render()
async render(container: HTMLElement) {
  const memberId = container.dataset.memberId!;
  // ...
}
```

### Page File Shape — Use This as a Template

```ts
// modules/membership/pages/MemberList.ts
import { renderSkeleton, renderEmpty, renderError } from '@shared/utils/pageHelpers';
import { Toast }    from '@shared/components/Toast';
import { Grid }     from '@shared/components/Grid';
import * as repo    from '../repository';
import type { PageModule }   from '@types/module.types';
import type { MemberView }   from '@types/member.types';

let grid: Grid<MemberView> | null = null;

const MemberList: PageModule = {

  async render(container: HTMLElement) {

    // ── 1. Skeleton — first line, before any await ──────────────────────
    renderSkeleton(container, 'table');

    try {
      // ── 2. Fetch ────────────────────────────────────────────────────────
      const members = await repo.getAll();

      // ── 3a. Empty state ─────────────────────────────────────────────────
      if (!members.length) {
        renderEmpty(container, {
          icon:    'people',
          title:   'No members found',
          message: 'Try adjusting your filters or add a new member',
          action:  { label: 'Add member', onClick: () => navigate('/members/add') },
        });
        return;
      }

      // ── 3b. Content ─────────────────────────────────────────────────────
      container.innerHTML = buildLayout();
      grid = new Grid<MemberView>(container.querySelector('#members-grid')!, {
        data: members,
        columns: memberColumns,
      });
      bindEvents(container);

    } catch (err) {
      // ── 3c. Error state ─────────────────────────────────────────────────
      renderError(container, err, {
        retry: () => MemberList.render(container),
      });
    }
  },

  destroy() {
    grid?.destroy();
    grid = null;
  },

};

export default MemberList;
```

### Auth Pages — Exception

Auth pages (Login, ForgotPassword, ResetPassword, Totp) do not use `renderSkeleton` or `renderError`. They render empty forms with no prior data fetch. Their loading state is a spinner on the submit button. Their error state is an inline alert above the form.

### What Goes in `destroy()`

Only resources that actively leak or conflict if not torn down:

| Resource | Reason |
|---|---|
| AG Grid instance | Holds DOM refs and internal timers |
| Quill editor | Registers global keyboard listeners |
| Chart.js instance | Holds canvas context — must be released before canvas reuse |
| Custom event listeners | Prevent duplicate handlers on re-render |
| setInterval / setTimeout | Continue firing after the page is gone |

Supabase Realtime subscriptions are **not** destroyed per-page. They live in the module's `init()` hook for the lifetime of the module.

---

## 8. Loading & Error State Pattern

### The Three Helpers

All three live in `src/shared/utils/pageHelpers.ts`. No page may inline its own skeleton, empty state, or error HTML.

```ts
// src/shared/utils/pageHelpers.ts

export type SkeletonVariant = 'table' | 'card' | 'form' | 'profile';

export interface EmptyStateOptions {
  icon:    string;       // Bootstrap Icons name e.g. 'people', 'calendar'
  title:   string;
  message: string;
  action?: { label: string; onClick: () => void };
}

export interface ErrorStateOptions {
  retry?: () => void;
}

// renderSkeleton — call as the first line of every data-page render()
// variant  'table'   → 5 shimmer rows
//          'card'    → 3 shimmer cards in a grid
//          'form'    → label + input pairs
//          'profile' → avatar circle + detail rows
export function renderSkeleton(
  container: HTMLElement,
  variant: SkeletonVariant = 'table'
): void;

// renderEmpty — call when a successful fetch returns zero results
export function renderEmpty(
  container: HTMLElement,
  options: EmptyStateOptions
): void;

// renderError — call in the catch block of every render()
// Error code mapping:
//   42501    → 'You don't have permission to view this'
//   PGRST116 → 'The record was not found'
//   PGRST301 → 'Session expired — please log in again'
//   default  → 'Something went wrong. Please try again.'
export function renderError(
  container: HTMLElement,
  error: unknown,
  options?: ErrorStateOptions
): void;
```

### The Four States — Every Data Page

```
render() called
      │
      ▼
┌─────────────┐
│   LOADING   │  renderSkeleton(container, variant)
│  (skeleton) │  shown immediately, before any await
└──────┬──────┘
       │  await repo.getXxx()
   ┌───┴─────────────┐
   │                 │
throws          resolves
   │            ┌────┴────┐
   │         empty?      data?
   ▼            │          │
┌───────┐  ┌───────┐  ┌─────────┐
│ ERROR │  │ EMPTY │  │ CONTENT │
└───┬───┘  └───────┘  └─────────┘
    │
 retry?
    └─ yes → render() again → back to LOADING
```

### Skeleton Variant by Page

| Page | Variant | Notes |
|---|---|---|
| MemberList | `table` | AG Grid table |
| MemberProfile | `profile` | Avatar + detail rows |
| AddMember | none | Empty form — no fetch before render |
| EditMember | `form` | Fetch member first, then show form |
| AuditLog | `table` | Timestamped row list |
| Reports | `card` | Report type cards |
| ReportDetail | `card` | Chart cards |
| Dashboard | `card` | Widget placeholders |
| Groups | `table` | Group list |
| Attendance | `table` | History rows |
| EditPastoralNotes | `form` | Fetch notes first, then show Quill editor |
| MyProfile | `profile` | Same shape as MemberProfile |
| PastoralCare | `table` | Care request list |
| HouseholdList | `table` | AG Grid; name, address, member count |
| HouseholdDetail | `profile` | Household card + member list grid |
| HouseholdCreate | none | Empty form — no fetch before render |
| HouseholdEdit | `form` | Fetch household first, then show form |

### Form Submit State

Form pages have a fifth state not handled by `pageHelpers` — the submit spinner. When a form is submitted:

1. Disable the submit button
2. Replace its label with a Bootstrap spinner
3. Await the service call
4. On success — navigate away (page is destroyed naturally by the router)
5. On failure — re-enable the button; call `Toast.error(message)`

This is inline to each form page because the button state is local to the form.

---

## 9. Core Layer

The core layer provides foundational services all modules depend on. Core never imports from modules.

### Registry — `core/registry.ts`

```ts
const _modules: ModuleManifest[] = [];

export function registerModule(mod: ModuleManifest): void {
  if (!mod.enabled) return;
  _modules.push(mod);
}

export function getRoutes(): RouteDefinition[] {
  return _modules.flatMap(m => m.routes ?? []);
}

export function getSidebarItems(): SidebarItem[] {
  return _modules
    .map(m => m.sidebar)
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);
}

export function getWidgets(
  can: (perm: string) => boolean
): WidgetDefinition[] {
  return _modules
    .flatMap(m => m.widgets ?? [])
    .filter(w => can(w.permission))
    .sort((a, b) => a.order - b.order);
}

export function getCapabilities(type: Capability): ModuleManifest[] {
  return _modules.filter(m => m.capabilities?.includes(type));
}

export async function initModules(context: ModuleContext): Promise<void> {
  for (const mod of _modules) {
    try {
      await mod.init?.(context);
    } catch (err) {
      console.error(`[registry] Failed to init module: ${mod.name}`, err);
      // module failure is isolated — app continues booting
    }
  }
}
```

### Auth — `core/auth.ts`

```ts
import { supabase } from './supabase';
import type { AppUser } from '@types/auth.types';

let _currentUser: AppUser | null = null;
let _activeAssemblyId: string | null = null;

export async function loadCurrentUser(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { _currentUser = null; return; }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  _currentUser = { ...user, ...profile };

  // super_admin starts with no active assembly — must select one in toolbar
  _activeAssemblyId = profile?.role === 'super_admin'
    ? null
    : profile?.assembly_id ?? null;
}

export const getCurrentUser      = (): AppUser | null => _currentUser;
export const isAuthenticated     = (): boolean => !!_currentUser;
export const getActiveAssemblyId = (): string | null => _activeAssemblyId;
export const setActiveAssemblyId = (id: string): void => { _activeAssemblyId = id; };
```

---

## 10. Shell System

The shell is a **rendering container only**. It has no knowledge of which modules exist. It reads from the registry and renders whatever is registered.

```
┌─────────────────────────────────────────────┐
│  Toolbar (built from registry + auth state) │
├──────────────┬──────────────────────────────┤
│              │                              │
│  Sidebar     │   #page-content              │
│  (registry)  │   (router renders here)      │
│              │                              │
└──────────────┴──────────────────────────────┘
```

The shell renders the sidebar from `getSidebarItems()`, filtered through the permission engine. The main content area is controlled entirely by the router.

### Toolbar — Assembly Context

The Toolbar shows the active assembly name. Super admin sees a dropdown to switch assemblies — selecting one calls `setActiveAssemblyId()` in `core/auth.ts` and clears both shared caches. Other roles see their own assembly name as static text.

### Presentation Modes

| Mode | Description |
|---|---|
| `shell` | Full layout — sidebar + toolbar |
| `fullscreen` | No sidebar, no toolbar — login, onboarding, TOTP enroll |
| `modal` | Overlay above current content |
| `embedded` | Inside a parent page component |

```ts
// In a module's route definition
{
  path:         '/login',
  page:         () => import('./pages/Login'),
  presentation: 'fullscreen',
  middleware:   [],
}
```

---

## 11. Routing

The router reads routes from the registry. It never imports a module directly.

```ts
// core/router.ts

let _activePage: PageModule | null = null;

export function startRouter(): void {
  window.addEventListener('hashchange', resolve);
  document.addEventListener('click', handleLinkClick);
  resolve();
}

export function navigate(path: string): void {
  location.hash = path;
}

async function resolve(): Promise<void> {
  const path    = location.hash.slice(1) || '/';
  const routes  = getRoutes();
  const matched = routes.find(r => matchPath(r.path, path));

  if (!matched) { render404(); return; }

  const result = await runMiddleware(matched, path);
  if (!result.allowed) { navigate(result.redirect); return; }

  // Destroy current page before loading next
  _activePage?.destroy?.();

  const { default: page } = await matched.page();
  _activePage = page;

  // Pass route params via dataset
  const params = extractParams(matched.path, path);
  const container = document.getElementById('page-content')!;
  Object.assign(container.dataset, params);

  await page.render(container);
}

function matchPath(pattern: string, path: string): boolean {
  const regex = new RegExp(
    '^' + pattern.replace(/:[^/]+/g, '([^/]+)') + '$'
  );
  return regex.test(path);
}

function extractParams(
  pattern: string,
  path: string
): Record<string, string> {
  const keys   = [...pattern.matchAll(/:([^/]+)/g)].map(m => m[1]);
  const values = path.match(
    pattern.replace(/:[^/]+/g, '([^/]+)')
  )?.slice(1) ?? [];
  return Object.fromEntries(keys.map((k, i) => [k, values[i]]));
}

function handleLinkClick(e: MouseEvent): void {
  const anchor = (e.target as Element).closest('a[href]');
  if (!anchor) return;
  const href = anchor.getAttribute('href')!;
  if (href.startsWith('/') || href.startsWith('#/')) {
    e.preventDefault();
    navigate(href.startsWith('#') ? href.slice(1) : href);
  }
}
```

---

## 12. Middleware & Guards

### Middleware Pipeline — `core/middleware.ts`

```ts
import { authGuard }       from './guards/authGuard';
import { permissionGuard } from './guards/permissionGuard';
import { onboardingGuard } from './guards/onboardingGuard';

const guardMap: Record<string, GuardFn> = {
  auth:        authGuard,
  permissions: permissionGuard,
  onboarding:  onboardingGuard,
};

export async function runMiddleware(
  route: RouteDefinition,
  path: string
): Promise<{ allowed: boolean; redirect?: string }> {
  for (const key of route.middleware ?? []) {
    const guard  = guardMap[key];
    const result = await guard(route, path);
    if (!result.allowed) return result;
  }
  return { allowed: true };
}
```

### Guards

```ts
// authGuard.ts
export async function authGuard() {
  return isAuthenticated()
    ? { allowed: true }
    : { allowed: false, redirect: '/login' };
}

// permissionGuard.ts
export async function permissionGuard(route: RouteDefinition) {
  if (!route.permission) return { allowed: true };
  const user    = getCurrentUser()!;
  const allowed = hasPermission(user.role, route.permission);
  return allowed
    ? { allowed: true }
    : { allowed: false, redirect: '/unauthorized' };
}

// onboardingGuard.ts — redirects to TOTP enroll if MFA not set up
export async function onboardingGuard() {
  const factors = await supabase.auth.mfa.listFactors();
  const enrolled = factors.data?.totp?.length > 0;
  return enrolled
    ? { allowed: true }
    : { allowed: false, redirect: '/totp-enroll' };
}
```

Adding a new guard: create one file in `guards/`, add one entry to `guardMap`. No module changes required.

---

## 13. Permission System

Permissions are strings in the format `module.action`. Modules declare which permission a route or sidebar item requires. The permission engine evaluates whether the current user's role satisfies that requirement.

```ts
// core/permissions.ts

const rolePermissions: Record<string, string[]> = {
  super_admin:  ['*'],
  admin:        ['*'],
  pastor:       ['membership.*', 'communication.*', 'pastoral-care.*',
                  'events.*', 'groups.*', 'reports.view'],
  treasurer:    ['finance.*', 'giving.*', 'reports.*', 'membership.view'],
  media:        ['media.*', 'events.view'],
  group_leader: ['groups.*', 'attendance.*', 'membership.view'],
  usher:        ['attendance.*', 'events.view'],
  member:       ['events.view', 'media.view', 'giving.view', 'profile.view'],
};

export function hasPermission(role: string, permission: string): boolean {
  if (!permission) return true;
  const perms = rolePermissions[role] ?? [];
  if (perms.includes('*')) return true;
  if (perms.includes(permission)) return true;
  const [ns] = permission.split('.');
  return perms.includes(`${ns}.*`);
}
```

### Protection Layers

```
User navigates to a route
        ↓
authGuard        → authenticated?        → no → /login
permissionGuard  → role has permission?  → no → /unauthorized
        ↓
Page renders
        ↓
In-page hasPermission() checks (e.g. show/hide Edit button)
        ↓
Supabase RLS — enforces at database level regardless of UI state
```

---

## 14. Event Bus

Modules communicate via events. No module imports another.

```ts
// core/events.ts
const _listeners: Record<string, Array<(data: unknown) => void>> = {};

export function emit(event: string, data?: unknown): void {
  (_listeners[event] ?? []).forEach(fn => {
    try { fn(data); }
    catch (err) { console.error(`[events] Error in "${event}" listener`, err); }
  });
}

export function on(event: string, fn: (data: unknown) => void): void {
  (_listeners[event] ??= []).push(fn);
}

export function off(event: string, fn: (data: unknown) => void): void {
  _listeners[event] = (_listeners[event] ?? []).filter(f => f !== fn);
}
```

### Event Naming Convention

```
domain:action

member:registered     member:updated       member:deactivated
member:restored       member:flagged       member:changed
group:updated         group:created        group:deleted
household:updated     household:created    household:deleted
giving:recorded       event:created        event:cancelled
attendance:marked     communication:notify finance:expense-added
auth:signedOut
```

### Cross-Module Communication Example

```ts
// membership/index.ts — init()
on('member:registered', async ({ memberId }) => {
  emit('communication:notify', {
    channel: 'pastors',
    message: 'New member registered',
  });
});
```

---

## 15. Capability System

Modules declare capabilities. Other parts of the app aggregate them without knowing which module provides them.

| Capability | Description |
|---|---|
| `dashboard-widgets` | Module contributes cards to the dashboard |
| `search` | Module contributes searchable content |
| `quick-actions` | Module contributes items to a command palette |
| `calendar` | Module contributes events to a shared calendar |
| `reports` | Module contributes report types to the report center |
| `notifications` | Module contributes notification types |

```ts
// dashboard/pages/Dashboard.ts
const user    = getCurrentUser()!;
const widgets = getWidgets(perm => hasPermission(user.role, perm));

widgets.forEach(async w => {
  const { default: Widget } = await w.component();
  mountWidget(Widget, w.id);
});
```

The dashboard is never edited when a new module adds a widget.

---

## 16. Module Registry

### Registry Responsibilities

- Accept module registrations
- Skip disabled modules silently
- Aggregate routes, sidebar items, widgets, capabilities from all modules
- Initialize all enabled modules in order
- Isolate module initialization failures (one module failing does not prevent others from booting)

---

## 17. Module Lifecycle

```ts
async init({ supabase, eventBus, permissions }: ModuleContext) {
  // Called once at app boot — not per page navigation
  // Use for: Realtime subscriptions, event listeners, preloading
}

async dispose() {
  // Called when module is disabled at runtime (future lazy unloading)
  // Use for: unsubscribing Realtime, clearing event listeners, caches
}
```

**Key rule:** Supabase Realtime subscriptions belong in `init()`, not in page `render()` functions. They persist for the lifetime of the module, not the lifetime of a single page.

---

## 18. Feature Flags

Each module has an `enabled` boolean in its manifest. Disabled modules are never registered, never contribute routes, never appear in the sidebar, and are never initialized.

```ts
// modules/admin/index.ts
const AdminModule: ModuleManifest = {
  name:    'admin',
  enabled: false,   // Phase 2 — zero impact on the running app
  // ...
};
```

### Disabled modules in MVP

| Module | Status | Reason |
|---|---|---|
| `finance` | `enabled: false` | Phase 2 |
| `events` | `enabled: false` | Phase 2 |
| `comms` | `enabled: false` | Phase 2 |
| `admin` | `enabled: false` | Phase 2 — stub pages present, routes inactive |

### Future: Remote Feature Flags

```ts
export async function resolveEnabled(
  mod: ModuleManifest,
  tenantConfig: TenantConfig
): Promise<boolean> {
  if (typeof mod.enabled === 'function') {
    return await mod.enabled(tenantConfig);
  }
  return mod.enabled ?? true;
}
```

One codebase, multiple tenant configurations, no rebuilds.

---

## 19. TypeScript & Type System

### Why TypeScript

The member entity has 20+ fields, nested household, assembly, and enum types. Without types, field name bugs (`member.full_name` vs `member.fullName`) surface as silent runtime failures — often an empty RLS-denied response indistinguishable from a legitimate empty result. TypeScript catches these at compile time.

### Supabase Type Generation

Because 40 migrations already exist, Supabase generates a `database.types.ts` file directly from the live schema. Every table, view, column, enum, and Edge Function — fully typed automatically.

```bash
# Run after every migration
npx supabase gen types typescript \
  --project-id your-project-id \
  > src/types/database.types.ts
```

### Key Types

```ts
// member.types.ts
import type { Database } from './database.types';

export type MemberRow    = Database['public']['Tables']['members']['Row'];
export type MemberView   = Database['public']['Views']['members_view']['Row'];
export type MemberStatus = Database['public']['Enums']['membership_status'];
export type Gender       = Database['public']['Enums']['gender_type'];

export interface CreateMemberPayload {
  full_name:         string;
  date_of_birth:     string | null;
  gender:            Gender;
  marital_status:    MaritalStatus;
  phone:             string | null;
  email:             string | null;
  assembly_id:       string;
  household_id:      string | null;
  membership_status: MemberStatus;
  // ... full shape mirrors create_member_request.dart
}

export type UpdateMemberPayload = Partial<CreateMemberPayload>;

export interface MemberFilter {
  search?:          string;
  status?:          MemberStatus;
  gender?:          Gender;
  assembly_id?:     string;    // required for super_admin; RLS handles others
  include_deleted?: boolean;
}

export interface MemberStats {
  total: number; active: number; inactive: number;
  visitors: number; flagged: number; new_this_month: number;
}

// Household types — mirrors household.dart + households_repository.dart
export type HouseholdRow  = Database['public']['Tables']['households']['Row'];

export interface HouseholdView extends HouseholdRow {
  member_count:         number;
  primary_contact_name: string | null;
}

export interface HouseholdWithMembers extends HouseholdView {
  members: MemberView[];
}

export interface CreateHouseholdPayload {
  name:               string;
  address:            string | null;
  assembly_id:        string;
  primary_contact_id: string | null;
}

export type UpdateHouseholdPayload = Partial<CreateHouseholdPayload>;

export interface HouseholdFilter {
  search?:      string;
  assembly_id?: string;   // required for super_admin
}
```

### Zod Schemas

```ts
// membership/schemas/member.schema.ts
import { z } from 'zod';

export const CreateMemberSchema = z.object({
  full_name:     z.string().min(2, 'Name is required'),
  phone:         z.string().regex(/^\+?[\d\s-]{10,}$/, 'Invalid phone number').nullable(),
  gender:        z.enum(['male', 'female']),
  date_of_birth: z.string().date().nullable(),
  assembly_id:   z.string().uuid(),
  // ...
});

export type CreateMemberPayload = z.infer<typeof CreateMemberSchema>;

// membership/schemas/household.schema.ts
export const CreateHouseholdSchema = z.object({
  name:               z.string().min(2, 'Household name is required'),
  address:            z.string().nullable(),
  assembly_id:        z.string().uuid(),
  primary_contact_id: z.string().uuid().nullable(),
});

export type CreateHouseholdPayload = z.infer<typeof CreateHouseholdSchema>;
export const UpdateHouseholdSchema = CreateHouseholdSchema.partial();
export type UpdateHouseholdPayload = z.infer<typeof UpdateHouseholdSchema>;
```

### Path Aliases

```ts
// vite.config.ts + tsconfig.json
'@core/*'    → './src/core/*'
'@shared/*'  → './src/shared/*'
'@types/*'   → './src/types/*'
'@modules/*' → './src/modules/*'
```

No `../../../` relative paths anywhere in the codebase.

---

## 20. Database & Backend

### Flutter Supabase Backend — Untouched

The entire backend was built for the Flutter app and requires no changes. The web app connects using the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

```
Flutter App  ──┐
               ├──→  Supabase Project  (same URL, same anon key)
Web App      ──┘
```

### Database Table Ownership

| Module | Tables |
|---|---|
| auth | `user_profiles`, `assemblies` |
| membership | `members`, `members_view` (view), `member_audit_log`, `households` |
| finance | `transactions`, `budgets`, `expense_categories` |
| giving | `tithes`, `offerings`, `giving_receipts` |
| events | `events`, `event_registrations`, `event_attendance` |
| media | `sermons`, `media_files`, `playlists` |
| communication | `announcements`, `messages`, `notification_log` |
| groups | `groups`, `group_members`, `group_meetings` |
| attendance | `attendance_records`, `attendance_summary` |
| volunteers | `volunteers`, `volunteer_roles`, `volunteer_schedules` |
| pastoral-care | `care_requests`, `care_visits`, `prayer_requests` |

### `assembly_id` — Enforcement Strategy

`assembly_id` is already present on all tables from the Flutter migrations. No new migrations are required for the web app.

Enforcement is layered:

**Layer 1 — RLS (database):** RLS policies scope every query to the authenticated user's `assembly_id` from `user_profiles`. A user from Assembly A can never read Assembly B's data regardless of what the client sends.

**Layer 2 — Repository (application):** Regular users rely on RLS entirely. Super admin has no RLS restriction and must receive `assembly_id` explicitly from the filter:

```ts
// repository.ts — getAll()
const user = getCurrentUser()!;
let query = supabase.from('members_view').select('*');

if (user.role === 'super_admin') {
  const assemblyId = getActiveAssemblyId();
  if (!assemblyId) throw new Error('No assembly selected');
  query = query.eq('assembly_id', assemblyId);
}

if (!filter.include_deleted) {
  query = query.is('deleted_at', null);
}
```

**Layer 3 — UI (toolbar):** Super admin must select an assembly via the Toolbar dropdown before viewing data. Other roles see their own assembly name as static text.

### Repository Pattern

```ts
// READ  → members_view (joined, display-ready)
// WRITE → members table (raw, via RLS + triggers)
// Never mix: don't write to the view, don't read the raw table for display

// Error handling — every method wraps raw Supabase errors:
export class RepositoryError extends Error {
  constructor(message: string, public cause: unknown, public code?: string) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export async function getById(id: string): Promise<MemberView> {
  const { data, error } = await supabase
    .from('members_view')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new RepositoryError('Member not found', error, error.code);
  return data;
}
```

### Hard Deletes — Blocked at Database Level

```sql
CREATE POLICY "no_hard_delete_members" ON members
FOR DELETE USING (false);
```

Only soft deletes (`deleted_at = now()`) are permitted. This is enforced in both the RLS policy and the repository layer.

### Row Level Security

All policies scope by **both** `assembly_id` and role — never one without the other.

```sql
-- Finance role: read all giving records, own assembly only
CREATE POLICY "finance_all_giving" ON tithes
FOR SELECT USING (
  assembly_id = (
    SELECT assembly_id FROM user_profiles WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM role_permissions
    WHERE user_id = auth.uid() AND permission = 'giving.view'
  )
);
```

### Edge Functions

| Function | Purpose |
|---|---|
| `create-member-user` | Creates auth user + member record atomically |
| `send-welcome-email` | Triggered after registration |
| `send-welcome-sms` | Triggered after registration |
| `generate-membership-number` | Sequential number generation |
| `export-members-csv` | Server-side CSV with RLS scoping |

---

## 21. Modules Breakdown

### Auth Module
Login, TOTP enroll + verify, password reset, session management, post-login role-based redirect. Fully standalone. No sidebar entry.

### Dashboard Module
Aggregates permitted widgets from all modules via the capability system. Each user sees a personalized view based on their role. The dashboard is never edited when a new module adds a widget.

### Membership Module
Full member lifecycle — registration, profiles, households, groups, attendance, pastoral notes, audit log, reports, deactivation, restoration. Emits events for other modules to react to. The most complete module — fully ported from Flutter.

**Includes in MVP:**
- Member CRUD (15 pages) — mirrors all Flutter membership screens
- Household management (4 pages) — mirrors Flutter `lib/features/households/`
- Groups, Attendance, Pastoral Care, Reports — scoped under membership routes

### Finance Module (Phase 2)
Budget management, expense tracking, income records, financial reports. Treasurer-level permissions.

### Giving Module (Phase 2)
Tithe and offering recording, giving history, receipt generation. Members see their own records only.

### Events Module (Phase 2)
Event creation, scheduling, registration, attendance. Contributes to the shared calendar capability.

### Media Module (Phase 2)
Sermon archive, media library, playlists, uploads.

### Communication Module (Phase 2)
Announcements, bulk messaging, notification delivery. Listens to events from other modules.

### Settings Module
Account settings, password change, TOTP management, theme toggle. Available from day one.

### Admin Module (Phase 2 — stubbed)
User management, role assignment, user provisioning for existing members. Stub pages are present in `modules/admin/pages/` but the module is `enabled: false`. Routes are declared but inactive. Flip `enabled: true` in Phase 2 to activate.

**Stub pages (matching Flutter `lib/features/admin/`):**
- `UserManagement.ts` — mirrors `user_management_screen.dart`
- `ProvisionUser.ts` — mirrors `add_user_for_member_screen.dart`; calls `create-member-user` Edge Function
- `GlobalAuditLog.ts` — mirrors `global_audit_log_screen.dart`

---

## 22. App Boot Sequence

```ts
// main.ts

import { registerModule, initModules } from '@core/registry';
import { startRouter }                 from '@core/router';
import { loadCurrentUser }             from '@core/auth';
import { supabase }                    from '@core/supabase';
import { emit, on }                    from '@core/events';

import AuthModule       from '@modules/auth/index';
import DashboardModule  from '@modules/dashboard/index';
import MembershipModule from '@modules/membership/index';
import FinanceModule    from '@modules/finance/index';
import EventsModule     from '@modules/events/index';
import CommsModule      from '@modules/comms/index';
import AdminModule      from '@modules/admin/index';
import SettingsModule   from '@modules/settings/index';

// 1. Register modules (disabled modules are silently skipped)
registerModule(AuthModule);
registerModule(DashboardModule);
registerModule(MembershipModule);
registerModule(FinanceModule);    // enabled: false — no effect
registerModule(EventsModule);     // enabled: false — no effect
registerModule(CommsModule);      // enabled: false — no effect
registerModule(AdminModule);      // enabled: false — no effect
registerModule(SettingsModule);

// 2. Load authenticated user (required before routing)
await loadCurrentUser();

// 3. Initialize all registered + enabled modules
await initModules({ supabase, eventBus: { emit, on }, permissions: { hasPermission } });

// 4. Start the router
startRouter();
```

Adding a future module = one import + one `registerModule()` call. Nothing else changes.

---

## 23. Scalability & Extension

### Adding a New Module

1. Create `modules/new-feature/` folder
2. Write `index.ts` with the manifest
3. Build routes, pages, schemas, services, repository inside the folder
4. Add two lines to `main.ts`

Nothing else changes. Shell, sidebar, router, and registry all adapt automatically.

### Adding a New Role

Add one entry to `rolePermissions` in `core/permissions.ts`. Sidebar filters, route guards, and UI checks all adapt automatically.

### Adding a New Guard

1. Create one file in `core/guards/`
2. Add one entry to `guardMap` in `core/middleware.ts`
3. Reference the guard key in any route's `middleware` array

### Multi-Assembly / White-Label

Different assemblies can have different enabled modules. Toggle `enabled` via remote config at boot time. One codebase, multiple configurations.

---

## 24. Architectural Boundaries

```
┌──────────────────────────────────────────┐
│                MODULES                   │
│  auth · membership · finance · events    │
│  admin · comms · settings                │
│  Each owns: routes · pages · schemas ·   │
│  services · repository · widgets         │
└────────────────┬─────────────────────────┘
                 │ depends on
                 ▼
┌──────────────────────────────────────────┐
│            SHARED LAYER                  │
│  memberCache · groupCache · pageHelpers  │
│  format · storage · components           │
└────────────────┬─────────────────────────┘
                 │ depends on
                 ▼
┌──────────────────────────────────────────┐
│                 CORE                     │
│  registry · router · permissions ·       │
│  events · middleware · auth · shell      │
└────────────────┬─────────────────────────┘
                 │ depends on
                 ▼
┌──────────────────────────────────────────┐
│               SUPABASE                   │
│  PostgreSQL · Auth · Storage ·           │
│  Realtime · Edge Functions               │
└──────────────────────────────────────────┘
```

**Rules (never violated):**
- Modules depend on core. Core never depends on modules.
- Modules never import each other. Events bridge communication.
- Shared UI components live in `shared/`. No module logic there.
- `memberCache` and `groupCache` in `shared/utils/` are read-only for all consumers. Only the membership module writes to the database; the cache is invalidated via events.
- Core never imports from `shell/`. Shell imports from core.
- Circular dependencies are architecturally impossible by design.
- All DB queries go through the module's own repository. Never query another module's tables directly.

---

## 25. Future Phases

### Phase 2 — Finance, Events, Communication, Admin

- Finance module — budget, expenses, transactions
- Giving module — tithe/offering with Paystack / Flutterwave integration
- Events module — scheduling, registration, live attendance via Supabase Realtime
- Communication module — bulk SMS via Africa's Talking, email via Resend
- Admin module — flip `enabled: true`; implement `UserManagement`, `ProvisionUser`, `GlobalAuditLog` pages fully
- PWA install prompt + offline attendance fallback (infrastructure already in place)

### Phase 3 — Scale & Intelligence

- Flutter mobile app pointing at same Supabase backend
- Advanced cross-module reporting with chart exports
- Multi-campus support — tenant-scoped data, shared member registry
- Plugin system — third-party modules loaded at runtime
- AI-powered insights — giving trends, attendance patterns, engagement scores
- Next.js public site — sermon pages, online giving portal (SEO-critical, separate deployment)

---

## 26. Flutter → Web Migration Plan

### Context

The Supabase backend is complete and shared. The Flutter app continues to exist and will become the mobile client in Phase 3. The web app is a new frontend pointing at the same backend. No backend changes are needed at any point during this migration.

```
Flutter App  ─────────────────────────────────────┐
                                                   ├──→  Supabase (unchanged)
Web App (new)  ───────────────────────────────────┘
```

---

### Phase 0 — Project Setup (2–3 days)

**Goal:** A running Vite + TypeScript + Supabase project that can authenticate a user and render a blank shell.

**Steps:**

1. Scaffold the Vite project
```bash
npm create vite@latest caci-hub-web -- --template vanilla-ts
cd caci-hub-web
```

2. Install all dependencies
```bash
npm install @supabase/supabase-js alpinejs bootstrap bootstrap-icons \
  dayjs ag-grid-community notyf quill cropperjs dompurify jspdf \
  html2canvas qrcode i18next fuse.js zod

npm install --save-dev typescript vite-plugin-pwa workbox-window \
  eslint prettier @typescript-eslint/eslint-plugin vitest playwright
```

3. Configure `vite.config.ts` — path aliases (`@core`, `@shared`, `@types`, `@modules`), PWA plugin
4. Configure `tsconfig.json` — strict mode, bundler resolution, path aliases matching Vite
5. Create `.env` from Flutter project (same `SUPABASE_URL` and `SUPABASE_ANON_KEY`)
6. Generate TypeScript types from existing schema
```bash
npx supabase gen types typescript \
  --project-id your-project-id \
  > src/types/database.types.ts
```
7. Write `src/types/` — `member.types.ts` (includes household types), `auth.types.ts`, `module.types.ts`, `common.types.ts`
8. Write `src/core/supabase.ts` — typed singleton client
9. Write `src/main.ts` — empty boot sequence, no modules yet
10. Write `index.html` — single `<div id="app">`

**Checkpoint:** `npm run dev` starts. Browser shows blank page. No console errors.

---

### Phase 1 — Core Layer (3–4 days)

**Goal:** All infrastructure that modules depend on — registry, router, auth, permissions, events, middleware, guards.

**Steps:**

1. `src/core/events.ts` — event bus (`emit`, `on`, `off`)
2. `src/core/permissions.ts` — `rolePermissions` map, `hasPermission()`
   - Port the roles from `CACI_Hub_Phase1_Roles_Permissions_Matrix.md`
3. `src/core/registry.ts` — `registerModule`, `getRoutes`, `getSidebarItems`, `getWidgets`, `initModules`
4. `src/core/auth.ts` — `loadCurrentUser` (queries `user_profiles`), `getCurrentUser`, `isAuthenticated`, `getActiveAssemblyId`, `setActiveAssemblyId`
5. `src/core/guards/authGuard.ts`
6. `src/core/guards/permissionGuard.ts`
7. `src/core/guards/onboardingGuard.ts`
8. `src/core/middleware.ts` — `runMiddleware`, `guardMap`
9. `src/core/router.ts` — hash router; `startRouter`, `navigate`; calls `page.render()` / `page.destroy()`

**Checkpoint:** Import router in `main.ts`, call `startRouter()`. Navigate to `#/test` — console logs "no route matched". No errors.

---

### Phase 2 — Shell & Shared Layer (2–3 days)

**Goal:** The visible layout container and all shared utilities pages will use.

**Steps:**

1. `src/styles/` — copy and adapt all CSS files from Flutter prototype HTML files
   - `theme.css` — CACI brand tokens from `caci_design_system.dart` + `caci_ghana_brand_palette.html`
   - `shell.css` — from `caci_appshell.html`
   - `auth.css` — from `caci_hub_auth_module.html`, `caci_auth_redesigned.html`, `caci_totp_merged.html`
   - `membership.css` — from `caci_members_module.html`; include household card styles
   - `dashboard.css` — from `caci_dashboard_module.html`
   - `components.css`, `utilities.css`
2. `src/shell/Shell.ts` — toolbar + sidebar + `#page-content` layout
3. `src/shell/Sidebar.ts` — reads `getSidebarItems()`, filters by `hasPermission()`
4. `src/shell/Toolbar.ts` — assembly name display, user avatar dropdown, logout, notification bell
   - Super admin: assembly switcher dropdown calling `setActiveAssemblyId()`; also clears both shared caches on switch
5. `src/shell/Breadcrumbs.ts`
6. `src/shell/NotificationBell.ts`
7. `src/shared/utils/pageHelpers.ts` — `renderSkeleton()`, `renderEmpty()`, `renderError()` with all four variants
8. `src/shared/utils/format.ts` — port from `format.js` in Flutter web prototypes
9. `src/shared/utils/storage.ts`
10. `src/shared/utils/memberCache.ts` — in-memory member summary cache; listens to event bus for invalidation
    - `getMemberSummary(id)`, `getMemberSummaries(ids[])`, `invalidateMember(id)`, `clearMemberCache()`
    - Subscribes to: `member:updated`, `member:deleted`, `member:restored`, `auth:signedOut`
11. `src/shared/utils/groupCache.ts` — in-memory group summary cache; listens to event bus for invalidation
    - `getGroupSummary(id)`, `getGroupSummaries(ids[])`, `invalidateGroup(id)`, `clearGroupCache()`
    - Subscribes to: `group:updated`, `group:created`, `group:deleted`, `auth:signedOut`
12. `src/shared/components/Modal.ts`
13. `src/shared/components/ConfirmDialog.ts`
14. `src/shared/components/Avatar.ts`
15. `src/shared/components/StatusBadge.ts`
16. `src/shared/components/Grid.ts` — AG Grid wrapper
17. `src/shared/components/Toast.ts` — Notyf wrapper
18. `src/shared/components/Form.ts` — Zod error display helpers
19. `src/shared/components/EmptyState.ts`

**Checkpoint:** Boot the app. Shell renders — sidebar visible, toolbar visible, `#page-content` empty. No module routes registered yet.

---

### Phase 3 — Auth Module (2–3 days)

**Goal:** A working login → TOTP → shell flow. The first deployable state.

**Steps:**

1. `src/modules/auth/services/authService.ts`
   - Port from `supabase_auth_data_source.dart` and `auth_data_providers.dart`
   - `signIn()`, `signOut()`, `resetPassword()`, `verifyTotp()`, `enrollTotp()`, `getSession()`
   - `signOut()` must emit `auth:signedOut` to clear both shared caches
2. `src/modules/auth/pages/Login.ts`
   - Port UI from `caci_auth_redesigned.html`
   - No `renderSkeleton()` — auth exception rule
   - Submit → spinner on button → `authService.signIn()` → on success check TOTP enrollment
3. `src/modules/auth/pages/ForgotPassword.ts`
4. `src/modules/auth/pages/ResetPassword.ts` — handles magic link token from URL hash
5. `src/modules/auth/pages/Totp.ts`
   - Port digit-box UI from `caci_totp_merged.html`
   - Enroll mode: show QR code (`enrollTotp()` returns URI), then verify
   - Verify mode: enter code → `verifyTotp()`
6. `src/modules/auth/routes.ts`
7. `src/modules/auth/index.ts` — manifest; `presentation: 'fullscreen'` on all auth routes
8. Register in `main.ts`; update boot sequence to call `loadCurrentUser()` before `startRouter()`

**Checkpoint:** Deploy to Vercel. Log in with a real Supabase user. TOTP enroll and verify work. Shell renders after authentication. Logout returns to login. **This is the first live deployment.**

---

### Phase 4 — Membership Module (6–8 days)

**Goal:** Full membership module including households. This is the client's required MVP.

**Steps, in order:**

**4a — Types and Schemas (0.5 day)**
1. `src/modules/membership/schemas/member.schema.ts` — `CreateMemberSchema`, `UpdateMemberSchema`
   - Port validation rules from `create_member_request.dart`
2. `src/modules/membership/schemas/filter.schema.ts` — `MemberFilterSchema`, `HouseholdFilterSchema`
   - Port from `member_filter.dart`, `household_filter.dart`
3. `src/modules/membership/schemas/household.schema.ts` — `CreateHouseholdSchema`, `UpdateHouseholdSchema`
   - Port validation from `create_household_screen.dart`

**4b — Repository (1.5 days)**
4. `src/modules/membership/repository.ts`
   - Port member query logic from `supabase_member_data_source.dart`
   - Port household query logic from `households_repository.dart`
   - All member reads query `members_view` (migration 16); all writes target `members` table
   - Household reads/writes target `households` table directly
   - `assembly_id` handling per Section 20
   - After any write that changes member or group data, emit the appropriate event so caches invalidate

**4c — Service (0.5 day)**
5. `src/modules/membership/services/memberService.ts`
   - `registerMember()` → `create-member-user` EF → `send-welcome-email` EF → `send-welcome-sms` EF
   - `exportCsv()` → `export-members-csv` EF

**4d — Member list and profile pages (1.5 days)**
6. `src/modules/membership/pages/MemberList.ts`
   - Port from `member_list_screen.dart` + `caci_members_module.html`
   - AG Grid table; search bar; status/gender/household filters; CSV export
   - `renderSkeleton(container, 'table')` as first line
   - `destroy()` → `grid.destroy()`
7. `src/modules/membership/pages/MemberProfile.ts`
   - Port from `member_detail_screen.dart`
   - Tabbed: Details | Pastoral Notes | Audit Log
   - Action buttons gated by `hasPermission()`
   - `renderSkeleton(container, 'profile')` as first line

**4e — Member add/edit forms (1 day)**
8. `src/modules/membership/pages/AddMember.ts`
   - Multi-section form: Personal Info, Contact, Household, Spiritual Info, Photo
   - Household dropdown populated via `repo.getHouseholds()`
   - Zod validation; photo → `Cropper.js` → `repo.uploadPhoto()`
   - Submit → `memberService.registerMember()` → navigate to `AddMemberSuccess`
9. `src/modules/membership/pages/AddMemberSuccess.ts`
10. `src/modules/membership/pages/EditMember.ts`
    - `renderSkeleton(container, 'form')` → fetch → populate form → Zod on submit

**4f — Household pages (1 day)**
11. `src/modules/membership/pages/HouseholdList.ts`
    - Port from `households_screen.dart`
    - `renderSkeleton(container, 'table')` — AG Grid; name, address, member count, primary contact
    - Search + filter; "Create household" action button
    - `destroy()` → `grid.destroy()`
12. `src/modules/membership/pages/HouseholdDetail.ts`
    - Port from `household_screen.dart`
    - `renderSkeleton(container, 'profile')` — household info card + member list grid
    - Set Primary Contact action (admin/pastor only via `hasPermission()`)
    - Edit and Delete actions (admin only)
    - `destroy()` → `grid.destroy()`
13. `src/modules/membership/pages/HouseholdCreate.ts`
    - Port from `create_household_screen.dart`
    - No skeleton (empty form); primary_contact_id → member search dropdown
    - Zod schema validation on submit → navigate to `HouseholdDetail`
14. `src/modules/membership/pages/HouseholdEdit.ts`
    - Port from `edit_household_screen.dart`
    - `renderSkeleton(container, 'form')` → `repo.getHouseholdById()` → populate → Zod on submit

**4g — Supporting member pages (1 day)**
15. `src/modules/membership/pages/FlagMember.ts`
16. `src/modules/membership/pages/EditPastoralNotes.ts` — Quill editor; `destroy()` required
17. `src/modules/membership/pages/AuditLog.ts`
18. `src/modules/membership/pages/MyProfile.ts`
19. `src/modules/membership/pages/Groups.ts` + `GroupCreate.ts`
20. `src/modules/membership/pages/Attendance.ts` + `RecordAttendance.ts`
21. `src/modules/membership/pages/PastoralCare.ts`
22. `src/modules/membership/pages/Reports.ts` + `ReportDetail.ts`

**4h — Admin stub (0.5 day)**
23. `src/modules/admin/pages/UserManagement.ts` — stub; `render()` shows "coming in Phase 2"
24. `src/modules/admin/pages/ProvisionUser.ts` — stub
25. `src/modules/admin/pages/GlobalAuditLog.ts` — stub
26. `src/modules/admin/routes.ts` — routes declared, guarded with `permission: 'admin.access'`
27. `src/modules/admin/index.ts` — manifest; `enabled: false`
28. Register `AdminModule` in `main.ts`

**4i — Widgets and Manifest (0.5 day)**
29. `src/modules/membership/widgets/NewMembersWidget.ts`
30. `src/modules/membership/widgets/MemberStatsWidget.ts`
31. `src/modules/membership/routes.ts` — all member + household routes
32. `src/modules/membership/index.ts` — manifest with Realtime subscription in `init()`
    - Emit `member:updated`, `member:deleted`, `member:restored` on relevant Realtime changes
    - Emit `group:updated`, `group:created`, `group:deleted` on group changes
    - These events drive cache invalidation in `memberCache.ts` and `groupCache.ts`
33. Register `MembershipModule` in `main.ts`

**Checkpoint:** Full membership + households CRUD working. Member list → profile → edit → back. Add member → success screen. Household list → detail → create → edit. CSV export working. Audit log populated. Filter drawer works. Admin stub registered but invisible (disabled). Deploy to Vercel. **This is the client-facing MVP.**

---

### Phase 5 — Dashboard Module (1 day)

**Goal:** Dashboard page that aggregates widgets from the membership module.

**Steps:**

1. `src/modules/dashboard/pages/Dashboard.ts` — `getWidgets()` → render each widget
2. `src/modules/dashboard/routes.ts`
3. `src/modules/dashboard/index.ts`
4. Register in `main.ts`
5. After login, redirect to `/dashboard` instead of `/members`

**Checkpoint:** Dashboard shows `NewMembersWidget` and `MemberStatsWidget` with live data.

---

### Phase 6 — Settings Module (0.5 day)

1. `src/modules/settings/pages/Settings.ts` — account settings, password change, TOTP management
2. `src/modules/settings/routes.ts` + `index.ts`
3. Register in `main.ts`

---

### Phase 7 — Quality & Hardening (2–3 days)

**Goal:** Production-ready — tests, i18n scaffolding, offline support, PWA.

**Steps:**

1. Vitest unit tests
   - `permissions.ts` — `hasPermission()` for all roles and edge cases
   - `repository.ts` — mock Supabase client, test member + household filter logic
   - `member.schema.ts` + `household.schema.ts` — Zod validation pass/fail cases
   - `format.ts` — date, phone, membership number formatters
   - `memberCache.ts` + `groupCache.ts` — lazy load, bulk load, invalidation, clear on logout
2. Playwright E2E tests
   - Login flow → TOTP → shell
   - Add member → success screen
   - Edit member → save → profile updated
   - Create household → detail page → add member to household
3. i18next setup — English strings extracted from all pages into `en.json`; Twi translation file scaffolded
4. DOMPurify — audit all `innerHTML` assignments; wrap every Quill output in `DOMPurify.sanitize()`
5. PWA — `vite-plugin-pwa` config; offline fallback page; `NetworkFirst` strategy for Supabase queries
6. ESLint + Prettier final pass across all files

**Checkpoint:** Lighthouse PWA score ≥ 90. All Vitest tests passing. Playwright login + add member + household flows passing. App installable on mobile.

---

### Migration Timeline Summary

| Phase | Content | Days |
|---|---|---|
| 0 | Project setup + types + Supabase connection | 2–3 |
| 1 | Core layer — registry, router, auth, permissions, guards | 3–4 |
| 2 | Shell + shared layer — layout, pageHelpers, caches, components | 2–3 |
| 3 | Auth module — login, TOTP, session | 2–3 |
| 4 | Membership module — full CRUD (19 pages), households (4 pages), admin stub | 6–8 |
| 5 | Dashboard module | 1 |
| 6 | Settings module | 0.5 |
| 7 | Tests, i18n, PWA, hardening | 2–3 |
| **Total** | | **18–25 days** |

---

### What Carries Over From Flutter Directly

| Flutter artifact | Web equivalent | Notes |
|---|---|---|
| `member.dart` entity | `member.types.ts` | Direct type translation |
| `member_audit_entry.dart` | `member.types.ts` | Included in same file |
| `create_member_request.dart` | `member.schema.ts` (Zod) | Same fields, Zod validation |
| `update_member_request.dart` | `UpdateMemberSchema` in same file | Partial of create schema |
| `member_filter.dart` | `filter.schema.ts` | Same filter shape |
| `household_filter.dart` | `filter.schema.ts` | `HouseholdFilterSchema` in same file |
| `household.dart` | `member.types.ts` (household types) | `HouseholdRow`, `HouseholdView`, etc. |
| `households_repository.dart` | `repository.ts` household methods | Direct port — same Supabase queries |
| `create_household_screen.dart` | `HouseholdCreate.ts` | Same form fields, Zod replaces manual validation |
| `edit_household_screen.dart` | `HouseholdEdit.ts` | Same pattern as `EditMember.ts` |
| `household_screen.dart` | `HouseholdDetail.ts` | Profile skeleton + AG Grid member list |
| `households_screen.dart` | `HouseholdList.ts` | AG Grid; same columns |
| `supabase_member_data_source.dart` | `repository.ts` member methods | Same Supabase queries, JS client |
| `member_repository.dart` + `i_member_repository.dart` | `repository.ts` | Collapsed into one file |
| `member_list_notifier.dart` etc. | Vanilla TS state inside each page | No Riverpod — state is local to page |
| `gender_type.dart` / `marital_status.dart` / `membership_status.dart` | Enums in `member.types.ts` | Same values |
| `user_management_screen.dart` | `admin/pages/UserManagement.ts` (stub) | Phase 2 — file present, not active |
| `add_user_for_member_screen.dart` | `admin/pages/ProvisionUser.ts` (stub) | Phase 2 — calls same Edge Function |
| `global_audit_log_screen.dart` | `admin/pages/GlobalAuditLog.ts` (stub) | Phase 2 |
| `core_event_bus.dart` | `core/events.ts` | Same pattern — emit/on/off |
| `module_manifest.dart` + `module_registry.dart` | `types/module.types.ts` + `core/registry.ts` | Direct port of manifest pattern |
| `supabase_member_data_source.dart` | `repository.ts` | Same Supabase queries, JS client |
| `members_view` (migration 16) | repository reads this directly | Untouched |
| Edge Functions (all 5) | Called via `supabase.functions.invoke()` | Identical, untouched |
| RLS policies (all 40 migrations) | Enforced automatically | Web client respects them |
| TOTP (`totp_screen.dart`) | `Totp.ts` | `supabase.auth.mfa.verify()` — same API |
| Auth flow (`auth_router.dart`) | `router.ts` + guards | Same redirect logic |
| `app_toast.dart` + `app_snack_bar.dart` | `Toast.ts` (Notyf wrapper) | Single unified toast system |
| `time_utils.dart` | `format.ts` (Day.js) | `formatDate()` etc. |
| `member_list_shimmer.dart` | `renderSkeleton(container, 'table')` | Shimmer via CSS animation |
| `caci_members_module.html` | `membership.css` + page HTML | Port styles directly |
| `caci_auth_redesigned.html` | `auth.css` + Login page | Port styles directly |

---

*Document Version: 3.0.0 · Architecture: Modular Monolith · Stack: TypeScript + Vite + Supabase · Updated May 2026*
