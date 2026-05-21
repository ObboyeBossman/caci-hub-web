// module.types.ts
// Mirrors Flutter source files:
//   module_manifest.dart, app_module.dart, module_capability.dart,
//   module_registry.dart, nav_contribution.dart, shell_contribution.dart
// The web version collapses some Flutter abstractions (GoRouter routes → plain objects,
// Riverpod providers → vanilla TS, widgets → lazy imports).

import type { AppUser } from './auth.types'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// ── PageModule — the single rendering contract ────────────────────────────────
// Every page file must export a PageModule as default.
// The router calls render() on navigate-in and destroy() on navigate-out.
//
// Mirrors the Flutter screen lifecycle:
//   render()  → initState() + build()
//   destroy() → dispose()
//
// Route params are passed via container.dataset before render() is called:
//   container.dataset.memberId = params.id
//   const memberId = container.dataset.memberId!  // inside render()
export interface PageModule {
  render(container: HTMLElement): Promise<void>
  destroy?(): void
}

// ── GuardResult — returned by every guard function ────────────────────────────
export interface GuardResult {
  allowed:   boolean
  redirect?: string
}

// ── GuardFn — the type signature every guard must satisfy ─────────────────────
export type GuardFn = (
  route: RouteDefinition,
  path:  string
) => Promise<GuardResult>

// ── Capability — mirrors module_capability.dart ModuleCapability ──────────────
// Declared capabilities tell the registry/shell what a module contributes.
// The registry aggregates capabilities; consumers query by type.
export type Capability =
  | 'dashboard-widgets'  // module contributes cards to the dashboard
  | 'search'             // module contributes searchable content
  | 'quick-actions'      // module contributes items to a command palette
  | 'calendar'           // module contributes events to a shared calendar
  | 'reports'            // module contributes report types to the report centre
  | 'notifications'      // module contributes notification types

// ── SidebarItem — mirrors nav_contribution.dart NavContribution ───────────────
// One entry per module (if the module has a sidebar presence).
// The shell reads all registered SidebarItems, filters by permission,
// sorts by order, and renders the sidebar. No module knows about others.
export interface SidebarItem {
  label:      string
  icon:       string        // Bootstrap Icons name e.g. 'people-fill', 'house-fill'
  path:       string        // hash route e.g. '/members', '/dashboard'
  permission: string        // e.g. 'membership.view', 'finance.view'
  order:      number        // lower = higher in sidebar; 1 = top, 99 = bottom
  badge?:     string | null // optional badge text e.g. unread count
}

// ── WidgetDefinition — mirrors module_manifest.dart widgets list ──────────────
// Modules contribute widgets to the dashboard via the 'dashboard-widgets' capability.
// The dashboard page calls getWidgets(), filters by permission, and mounts each one.
export interface WidgetDefinition {
  id:         string
  component:  () => Promise<{ default: PageModule }>
  permission: string
  size:       'small' | 'medium' | 'large'
  order:      number
}

// ── RouteDefinition — mirrors module_manifest.dart routes list ────────────────
// Each module declares its own routes. The router never imports modules directly —
// it reads these definitions from the registry.
export interface RouteDefinition {
  path:          string
  page?:         () => Promise<{ default: PageModule }>
  redirect?:     string             // if set, router immediately navigates here instead
  middleware?:   string[]           // guard keys e.g. ['auth', 'permissions']
  permission?:   string             // evaluated by permissionGuard
  presentation?: PresentationMode
}

// ── PresentationMode — mirrors presentation_mode.dart PresentationMode ────────
// Controls what shell chrome is rendered around the page.
export type PresentationMode =
  | 'shell'        // full layout — sidebar + toolbar (default for all feature pages)
  | 'fullscreen'   // no sidebar, no toolbar — login, onboarding, TOTP enroll/verify
  | 'modal'        // overlay above current content
  | 'embedded'     // inside a parent page component

// ── ModuleContext — passed to each module's init() hook ───────────────────────
// Mirrors: AppModule.initialize(Ref ref) in Flutter
// The Ref gives access to supabase, events, permissions.
// Web equivalent: a plain object passed from main.ts at boot time.
export interface ModuleContext {
  supabase:    SupabaseClient<Database>
  eventBus:    {
    emit: (event: string, data?: unknown) => void
    on:   (event: string, fn: (data: unknown) => void) => void
  }
  permissions: {
    hasPermission: (role: string, permission: string) => boolean
  }
  currentUser: () => AppUser | null
}

// ── ModuleManifest — the single contract between a module and the app ─────────
// Mirrors: module_manifest.dart ModuleManifest class
//
// This is the ONLY public API of a module.
// Nothing else inside a module is imported from outside.
// The module is registered in main.ts with one registerModule() call.
//
// Disabled modules (enabled: false) are entirely invisible:
//   - No routes registered
//   - No sidebar entry
//   - init() never called
//   - Zero impact on the running app
export interface ModuleManifest {
  // ── Identity ──────────────────────────────────────────────────────────────
  name:         string    // unique id e.g. 'membership', 'finance', 'admin'
  version:      string    // semver e.g. '1.0.0'
  description?: string
  icon?:        string    // Bootstrap Icons name for module switcher

  // ── Feature flag — mirrors: ModuleManifest.enabled ────────────────────────
  // false = module contributes nothing; not registered, not initialized.
  // Used for Phase 2+ modules: finance, events, comms, admin.
  enabled:      boolean

  // ── Routes — mirrors: ModuleManifest.routes ────────────────────────────────
  routes?:      RouteDefinition[]

  // ── Navigation contribution ───────────────────────────────────────────────
  // One sidebar item per module (optional — auth module has no sidebar entry).
  sidebar?:     SidebarItem

  // ── Capability & widget contributions ────────────────────────────────────
  capabilities?: Capability[]
  widgets?:      WidgetDefinition[]

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  // init(): called ONCE at app boot, not per page navigation.
  // Use for: Supabase Realtime subscriptions, event listeners, cache warming.
  // Mirrors: AppModule.initialize(Ref ref) in Flutter.
  //
  // CRITICAL: Realtime subscriptions belong here, not in page render() methods.
  // A subscription per page would create N subscriptions for N navigations.
  init?(ctx: ModuleContext): Promise<void>

  // dispose(): called when module is disabled at runtime (future lazy unloading).
  // Use for: removing Realtime channels, clearing event listeners, emptying caches.
  // Mirrors: AppModule.dispose(Ref ref) in Flutter.
  dispose?(): Promise<void>

  // Internal — Realtime channel reference stored by the module itself.
  // Not part of the contract; modules manage their own channel lifecycle.
  _channel?: unknown
}
