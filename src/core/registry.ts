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

/**
 * Aggregate sidebar items sorted by order.
 * The shell filters these by hasPermission() before rendering.
 */
export function getSidebarItems(): SidebarItem[] {
  return _modules
    .flatMap(m => m.sidebar ?? [])
    .sort((a, b) => a.order - b.order)
}

/**
 * Aggregate widgets from all modules, filtered by permission predicate,
 * sorted by order. Used by the Dashboard page.
 */
export function getWidgets(
  can: (perm: string) => boolean
): WidgetDefinition[] {
  return _modules
    .flatMap(m => m.widgets ?? [])
    .filter(w => can(w.permission))
    .sort((a, b) => a.order - b.order)
}

/**
 * Returns all modules that declare a given capability.
 * Used by cross-cutting consumers (search, notifications, quick actions).
 */
export function getCapabilities(type: Capability): ModuleManifest[] {
  return _modules.filter(m => m.capabilities?.includes(type))
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
