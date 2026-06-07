# CACI Hub – Future Implementation Recommendations

## Purpose

This document consolidates all architectural, security, scalability, UX, RBAC, and technical-debt recommendations identified during the review of the CACI Hub codebase.

The items below are not necessarily defects. Many are strategic improvements intended to support future growth, maintainability, and production readiness.

---

# Priority 1 – Security & Authorization

## 1. Re-enable MFA Enforcement

### Current State

The `onboardingGuard` contains disabled MFA enforcement logic.

### Risks

* Reduced account security
* Potential unauthorized access if credentials are compromised
* Security policy inconsistency

### Recommendation

Re-enable MFA validation during onboarding and route access.

### Future Enhancements

* Optional grace period for first login
* Recovery code support
* Trusted device support

---

## 2. Fix Provisioning Path Mismatch

### Current State

Mismatch exists between:

```ts
custom_password
```

and

```ts
explicit
```

used by provisioning workflows.

### Risks

* Runtime provisioning failures
* Invalid payloads sent to Edge Functions
* Hard-to-diagnose account creation bugs

### Recommendation

Standardize all provisioning paths across:

* Zod schemas
* Repository layer
* Edge Functions
* Documentation

---

## 3. Introduce Audit Logging

### Current State

Administrative actions are not comprehensively audited.

### Recommendation

Log all privileged operations:

### User Management

* Account creation
* Account activation
* Account suspension
* Account reactivation
* Password reset
* Account unlinking

### Role Management

* Role creation
* Role deletion
* Role updates

### Permission Management

* Permission assignment
* Permission revocation

### Security

* MFA enrollment
* MFA removal
* Login failures
* Lockouts

### Audit Metadata

Capture:

* User ID
* Actor ID
* Timestamp
* IP address (if available)
* Device information
* Before/after values

---

# Priority 2 – Authorization Evolution

## 4. Replace Hardcoded Admin Bypass

### Current State

Authorization contains:

```ts
if (user.role === 'admin')
```

which bypasses all permission checks.

### Risks

* Difficult future expansion
* No distinction between assembly admin and system admin
* Hardcoded privilege logic

### Recommendation

Move to permission-based administration.

Examples:

```text
system.admin
assembly.admin
```

All access should be permission-driven.

---

## 5. Expand Admin Permission Coverage

### Current State

Admin module registers only:

```text
admin.view
admin.users.manage
```

### Recommendation

Introduce additional permissions.

### Accounts

```text
admin.accounts.view
admin.accounts.create
admin.accounts.edit
admin.accounts.disable
admin.accounts.reset_password
```

### Roles

```text
admin.roles.view
admin.roles.create
admin.roles.edit
admin.roles.delete
```

### Permissions

```text
admin.permissions.view
admin.permissions.manage
```

### Audit

```text
admin.audit.view
```

### Settings

```text
admin.settings.manage
```

### Households

```text
admin.households.view
admin.households.manage
```

---

## 6. Implement Session Permission Refresh

### Current State

Permissions are loaded once at login.

### Risks

Changes made by administrators may not immediately affect active sessions.

### Recommendation

Refresh permissions when:

* Roles change
* Permissions change
* Account status changes

Potential approaches:

* Event-driven refresh
* JWT claim refresh
* Session invalidation

---

# Priority 3 – Admin Module Completion

## 7. Complete Admin Module Pages

Implement dedicated PageModules for:

### Accounts

Features:

* Search
* Filters
* Bulk actions
* Provisioning
* Status management

### Roles

Features:

* Create role
* Edit role
* Clone role
* Delete role

### Permissions

Features:

* Permission catalogue
* Role assignment
* Permission explorer

### Audit Log

Features:

* Filtering
* Search
* Export

### Households

Features:

* Household management
* Family relationships
* Member grouping

### Settings

Features:

* Assembly configuration
* Security policies
* Feature flags

---

# Priority 4 – Shared UI Infrastructure

## 8. Build Reusable Data Table Component

### Motivation

Admin pages require dense data presentation.

### Required Features

* Pagination
* Sorting
* Column configuration
* Search
* Row selection
* Bulk actions
* Context menus
* Mobile support

### Candidate Consumers

* Accounts
* Roles
* Permissions
* Audit Logs
* Members

---

## 9. Standardize Bulk Action Framework

### Current State

Bulk actions are only partially implemented.

### Recommendation

Create reusable selection infrastructure.

Features:

* Select all
* Select visible
* Multi-page selection
* Bulk action bar
* Confirmation workflows

---

## 10. Standardize Context Menu System

### Current State

Context menus exist in prototypes but are not consistently implemented.

### Recommendation

Create reusable context-menu component.

Features:

* Keyboard navigation
* Accessibility support
* Permission-aware actions

---

# Priority 5 – Scalability

## 11. Implement Pagination

### Current State

All records are rendered simultaneously.

### Risks

Performance degradation as assemblies grow.

### Recommendation

Introduce:

* Server-side pagination
* Cursor pagination where appropriate
* Infinite scrolling where appropriate

### Candidate Modules

* Members
* Groups
* Accounts
* Audit Logs

---

## 12. Introduce Virtualized Rendering

For large datasets:

* Virtual scrolling
* Windowed rendering

Recommended for:

* Audit logs
* Member directories
* Account lists

---

## 13. Optimize Realtime Event Handling

### Current State

Modules subscribe directly to events.

### Recommendation

Introduce:

* Event batching
* Deduplication
* Smart cache invalidation

---

# Priority 6 – Type Safety

## 14. Strengthen Group Type Definitions

### Current State

```ts
GroupType
```

is strongly typed but related structures use plain strings.

### Recommendation

Convert supporting structures to:

```ts
Record<GroupType, ...>
```

to enforce compile-time safety.

---

## 15. Eliminate Remaining `any` Usage

### Focus Areas

* Supabase query responses
* Edge Function payloads
* Event bus payloads

### Recommendation

Introduce:

* Zod validation
* Shared DTOs
* Strict typing

---

## 16. Shared API Contracts

Create centralized schemas for:

* Repository layer
* Edge Functions
* Supabase responses

Use:

* Zod
* Shared type exports

---

# Priority 7 – UX Improvements

## 17. Implement Left Navigation Shell Enhancements

### Recommendation

Enhance shell with:

* Collapsible navigation
* Assembly switcher
* User menu
* Notification center

---

## 18. Complete Member Context Menus

Implement actions:

* View member
* Edit member
* Assign group
* Archive member

---

## 19. Complete Bulk Selection in Members Module

Features:

* Select all
* Bulk edit
* Bulk archive
* Bulk group assignment

---

## 20. Standardize Responsive Patterns

Formalize:

### Desktop

Card grids and tables

### Tablet

Compressed layouts

### Mobile

List rows and stacked actions

---

## 21. Introduce Empty State System

Standardize:

* No results
* No permissions
* No data
* Offline state

---

## 22. Introduce Loading Skeleton System

Replace spinners with:

* Table skeletons
* Card skeletons
* Detail page skeletons

---

# Priority 8 – Performance

## 23. Module-Level CSS Strategy

### Current State

CSS injected through runtime utilities.

### Recommendation

Evaluate:

* Code-split CSS
* Extracted module bundles

As application size increases.

---

## 24. Route-Level Prefetching

Prefetch:

* Frequently visited modules
* Adjacent routes

to improve perceived performance.

---

## 25. Query Caching Strategy

Standardize:

* Cache duration
* Cache invalidation
* Realtime reconciliation

across all repositories.

---

# Priority 9 – Data & Domain Evolution

## 26. Multi-Assembly Readiness

Future-proof architecture for:

* Multiple assemblies
* Cross-assembly administration
* Regional oversight

Introduce:

```text
assembly.admin
district.admin
national.admin
```

if required.

---

## 27. Household Domain Expansion

Support:

* Family relationships
* Guardianship
* Household attendance
* Household reporting

---

## 28. Role Templates

Allow predefined templates:

* Pastor
* Secretary
* Treasurer
* Finance Officer
* Department Leader

to accelerate setup.

---

# Priority 10 – Developer Experience

## 29. Architecture Documentation

Create documentation for:

* Boot process
* Module lifecycle
* Routing
* Authorization
* Event system

---

## 30. Permission Documentation

Generate a permission catalogue.

Include:

* Permission key
* Description
* Owning module

---

## 31. Testing Strategy

Introduce:

### Unit Tests

* Authorization
* Guards
* Repositories

### Integration Tests

* Authentication flows
* Provisioning

### End-to-End Tests

* Login
* Account management
* Role assignment

---

## 32. Developer Tooling

Add:

* ESLint strict rules
* Type coverage reporting
* Dependency analysis
* Bundle size monitoring

---

# Long-Term Vision

The current architecture is already strong and modular.

Future investment should focus on:

1. Security hardening
2. Completing administrative capabilities
3. Scaling data handling
4. Improving RBAC flexibility
5. Formalizing shared UI patterns
6. Strengthening typing and testing
7. Preparing for multi-assembly deployments

No major architectural rewrite is recommended. The system's foundation is sound and should be evolved rather than replaced.

