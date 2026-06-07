# CACI Hub Admin Module Refactor & Shared Widget Extraction

## Context

You are working inside the CACI Hub codebase.

Before making changes, understand the architecture and follow it strictly.

---

# Existing Architecture

* CACI Hub uses a ModuleManifest registry pattern.
* Routing is hash-based (`#/path`) and managed by `router.ts`.
* Pages implement the PageModule lifecycle:

  * `render(container)`
  * `destroy()`
* Permissions are registered through `permission-registry.ts`.
* Authorization is enforced through `authorization-service.ts`.
* Styling is module-scoped using `injectCSS()`.
* Design tokens already exist (`--bg-card`, `--bg-surface`, `--caci-blue`, etc.).
* Do not introduce React, Vue, or any external UI framework.
* Follow the coding style used by `Groups.ts`.

---

# Objective

Before implementing the remaining Admin functionality, refactor the Admin module into a reusable workspace architecture.

The Admin module should remain a **single routed page**.

The following sections should become tabbed subsections inside that page:

* Accounts
* Roles
* Permissions
* Households
* Audit Log
* Settings

These are **not separate routes** and **not separate PageModules**.

They are subsections managed within one Admin workspace.

---

# Required Refactor

Create reusable Admin workspace widgets that can be shared by all subsections.

Extract common patterns instead of duplicating UI.

---

## 1. Admin Workspace Shell

Create a reusable shell component.

### Responsibilities

* Header
* Tab navigation
* Active tab state
* Tab switching
* Tab content rendering

### Suggested Structure

```ts
AdminWorkspaceShell
```

### Requirements

* Remembers active tab during session
* Supports permission-gated tabs
* Responsive
* Destroyable
* Handles lifecycle cleanup correctly

---

## 2. Reusable Tab System

Create a generic tab widget.

### Suggested Interface

```ts
interface WorkspaceTab {
  id: string;
  label: string;
  icon?: string;
  permission?: string;
  render(container: HTMLElement): void;
  destroy?(): void;
}
```

### Requirements

* Keyboard accessible
* Responsive
* Active state styling
* Lazy render content
* Destroy previous tab when switching

No duplicated tab code inside subsections.

---

## 3. Statistics Card Widget

Extract the stat-card pattern already used in:

* Groups
* Accounts prototype

Create reusable component:

```ts
StatsCardGroup
```

### Support

* Icon
* Label
* Value
* Active state
* Click filter callback

Used by:

* Accounts
* Roles
* Audit Log
* Households

---

## 4. Toolbar Widget

Extract common toolbar patterns.

### Support

* Search
* Filter dropdowns
* Action buttons
* Responsive collapse behavior

Should match existing prototype behavior.

---

## 5. Empty State Widget

Create reusable empty-state component.

### Support

* Icon
* Title
* Description
* Primary action

Used across all admin tabs.

---

## 6. Context Menu Widget

Extract reusable menu component.

### Support

* Anchor positioning
* Keyboard dismissal
* Click outside close
* Dynamic menu items

Will later be used by:

* Accounts
* Roles
* Permissions
* Households

---

## 7. Bulk Action Bar Widget

Create reusable selection action bar.

### Support

* Selected count
* Action buttons
* Sticky positioning
* Show/hide animations

Will be reused by Accounts and future data-heavy tabs.

---

## 8. Responsive Data Workspace Pattern

The Accounts prototype establishes two display modes.

### Desktop

```text
Table
```

### Mobile

```text
Card List
```

Create shared infrastructure for this pattern.

Do not hardcode it into Accounts.

### Goal

```ts
ResponsiveDataView<T>
```

Reusable by:

* Accounts
* Roles
* Households
* Audit Log

---

# Admin Page Structure

Refactor the Admin page into:

```text
AdminPage
 ├── AdminWorkspaceShell
 │
 ├── AccountsTab
 ├── RolesTab
 ├── PermissionsTab
 ├── HouseholdsTab
 ├── AuditLogTab
 └── SettingsTab
```

Each tab should be its own file.

Each tab should expose:

```ts
render(container)
destroy()
```

but should **NOT** be registered as a PageModule.

---

# Initial Implementation Scope

## Fully Implement

### Accounts Tab

Use:

* Existing Accounts prototype
* Existing Admin repository layer
* Existing permissions system
* Existing design tokens

Accounts should be the only fully functional tab.

---

## Scaffold Only

Create skeleton implementations for:

### Roles

### Permissions

### Households

### Audit Log

### Settings

Requirements:

* Render correctly
* Integrate with tab system
* Respect permissions
* Display reusable empty-state placeholders

No business functionality yet.

---

# Permissions

Introduce admin-scoped permissions for tab visibility.

Suggested permissions:

```ts
admin.accounts.view
admin.roles.view
admin.permissions.view
admin.households.view
admin.audit.view
admin.settings.view
```

Requirements:

* Register through permission registry
* Follow existing naming conventions
* Do not bypass authorization logic

---

# Styling Requirements

Use existing design tokens.

Follow the visual language established by:

* Groups.ts
* caci-hub-accounts.html

Maintain:

* Dark-first appearance
* Stat cards
* Responsive layouts
* Consistent spacing
* Token-based colors

Do not introduce new color systems.

Do not introduce Tailwind.

Do not introduce external component libraries.

---

# Non-Negotiable Rules

1. Admin remains a single routed page.
2. Tabs are subsections, not routes.
3. Shared widgets must be extracted before building additional functionality.
4. No duplicated tab, toolbar, stat-card, context-menu, or bulk-action code.
5. Existing architectural boundaries must remain intact.
6. Repository access must remain in repository layers.
7. Authorization must continue to flow through authorization-service.
8. Styling must remain token-based and module-scoped.
9. New widgets must be reusable by future modules.
10. Future tabs should be implementable without modifying the workspace shell.

---

# Acceptance Criteria

Success means:

1. Admin remains a single routed page.
2. All admin areas exist as tabs.
3. Shared widgets are extracted and reusable.
4. Accounts is the only fully functional tab.
5. Other tabs are scaffolded placeholders.
6. No duplicated tab, toolbar, stat-card, context-menu, or bulk-action code.
7. Existing architecture boundaries remain intact.
8. Future tabs can be implemented without modifying the workspace shell.

---

# Deliverables

Provide:

## New Files Created

List all newly created files and their purpose.

## Existing Files Modified

List all modified files and explain why they were changed.

## Architectural Decisions

Explain major design decisions and trade-offs.

## Reusability Opportunities

Identify components and patterns that can later be reused by:

* Membership
* Finance
* Services
* Pastoral
* Future administrative modules

## Follow-Up Recommendations

Suggest the next implementation phase after this refactor is completed.

