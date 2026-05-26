// src/core/registry.ts
// Module registry — collects ModuleManifest objects from all modules,
// aggregates routes, sidebar items, widgets and capabilities, and
// initialises all registered modules at boot time.
//
// Core never imports from modules — dependency only flows one way.
// Mirrors: module_registry.dart (Flutter)

import type {
  ModuleManifest,
  RouteDefinition,
  SidebarItem,
  WidgetDefinition,
  Capability,
  ModuleContext,
} from '../types/module.types'

const _modules: ModuleManifest[] = []

/**
 * Register a module. Disabled modules (enabled: false) are silently skipped
 * and contribute nothing — no routes, no sidebar entries, no init() call.
 * Mirrors: ModuleRegistry.register() in Flutter.
 */
export function registerModule(mod: ModuleManifest): void {
  if (!mod.enabled) return
  
  const existingIndex = _modules.findIndex(m => m.name === mod.name)
  if (existingIndex !== -1) {
    // Replace existing module (useful for HMR)
    _modules[existingIndex] = mod
  } else {
    _modules.push(mod)
  }
}

/**
 * Aggregate routes from all registered modules.
 * Called by the router at startup — never call createClient() here.
 */
export function getRoutes(): RouteDefinition[] {
  return _modules.flatMap(m => m.routes ?? [])
}

export interface ContextualSidebarItem extends SidebarItem {
  moduleName: string
}

/**
 * Aggregate sidebar items sorted by order, injecting the parent module name.
 * The shell filters these by hasPermission() and current module before rendering.
 */
export function getSidebarItems(): ContextualSidebarItem[] {
  return _modules
    .flatMap(m => (m.sidebar ?? []).map(item => ({ ...item, moduleName: m.name })))
    .sort((a, b) => a.order - b.order)
}

/**
 * Given a URL path, determine which module owns it.
 * Handles parameterized routes like `/members/:id` matching `/members/abc-123`.
 */
export function getModuleForPath(path: string): string | null {
  if (!path) return null
  for (const m of _modules) {
    if (m.routes?.some(r => matchesRoute(r.path, path))) {
      return m.name
    }
  }
  return null
}

/**
 * Returns true if a live URL path matches a route template that may contain `:param` segments.
 * e.g. `/members/abc-123` matches `/members/:id`
 */
function matchesRoute(template: string, path: string): boolean {
  if (template === path) return true
  // Convert template segments to a regex: replace :param with [^/]+
  const re = new RegExp(
    '^' + template.replace(/:[^/]+/g, '[^/]+') + '(/.*)?$'
  )
  return re.test(path)
}



/**
 * Returns the route path of the first registered module (lowest order sidebar item).
 * Used by the login flow to redirect to the first available module.
 * Falls back to '/' if no modules are registered.
 */
export function getFirstModuleRoute(): string {
  const items = getSidebarItems()
  return items.length > 0 ? items[0].path : '/'
}

/**
 * Call each registered module's init() hook in registration order.
 * Module failures are isolated — one failing module never blocks others.
 * Called once at boot after loadCurrentUser() and before startRouter().
 */
export async function initModules(context: ModuleContext): Promise<void> {
  for (const mod of _modules) {
    try {
      await mod.init?.(context)
    } catch (err) {
      console.error(`[registry] Failed to init module: ${mod.name}`, err)
    }
  }
}
