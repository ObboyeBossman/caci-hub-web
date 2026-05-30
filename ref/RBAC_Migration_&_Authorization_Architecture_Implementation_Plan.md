# RBAC Migration & Authorization Architecture Implementation Plan

## Objective

Refactor the current church management system authorization model from static enum-based roles into a modular RBAC architecture with:

* Two system roles only:

  * `admin`
  * `member`

* Assembly-defined custom roles:

  * `Secretary`
  * `Treasurer`
  * `Pastor`
  * etc.

* Platform-defined permissions:

  * `members.view`
  * `members.edit`
  * `finance.offerings.edit`
  * etc.

* Simplified PostgreSQL RLS

* Fine-grained authorization enforced at application/service layer

This implementation MUST NOT introduce:

* dynamic runtime permission registration
* permission inference
* hardcoded role names outside system roles
* direct user permission assignment
* permission checks inside PostgreSQL RLS beyond admin/member distinction

---

# Architecture Rules (Non-Negotiable)

## 1. System Roles

System roles are platform-level authority only.

Allowed values:

```ts
type SystemRole =
  | 'admin'
  | 'member'
```

These are stored in:

```sql
user_profiles.role
```

Purpose:

* `admin` bypasses permission checks
* `member` requires permission checks

No additional system roles are allowed.

DO NOT introduce:

* pastor
* secretary
* volunteer
* treasurer
* district_admin

Those belong to assembly roles.

---

# 2. Assembly Roles

Assembly roles are organizational labels created by assemblies.

Examples:

* Secretary
* Treasurer
* Pastor
* Choir Leader

These are stored in:

```sql
assembly_roles
```

Assemblies can:

* create
* update
* deactivate

Assemblies CANNOT:

* create system roles
* bypass platform restrictions
* create permissions

---

# 3. Permissions

Permissions are platform-defined capabilities.

Assemblies assign them to roles but DO NOT create them.

Examples:

```txt
members.view
members.create
members.edit
members.deactivate

households.view
households.edit

reports.view
reports.export

finance.offerings.view
finance.offerings.edit
```

Permissions MUST:

* be versioned
* be seeded through migrations
* originate from module manifests
* never be created from frontend runtime

---

# 4. Authorization Layers

## PostgreSQL RLS

Responsible ONLY for:

* assembly isolation
* admin override
* ownership boundaries

RLS MUST NOT:

* understand custom roles
* understand permissions
* contain business authorization logic

---

## Application Layer Authorization

Responsible for:

* permission checks
* feature access
* route guards
* action authorization

Permission checks happen in:

* services
* edge functions
* backend API layer

NOT inside SQL policies.

---

# 5. No Direct User Permissions

Authorization flow MUST be:

```txt
User
 → Assembly Role
   → Permissions
```

DO NOT implement:

* user_permissions
* direct grants
* temporary manual overrides

---

# Current Database Refactor Requirements

## Existing Schema

Current relevant tables:

* user_profiles
* assembly_roles
* permissions
* role_permissions

---

# Required Database Changes

## 1. Rename permissions table

Rename:

```sql
permissions
```

to:

```sql
system_permissions
```

Reason:
Clarifies that permissions are platform-owned metadata.

---

## 2. Rename user_profiles.role_id

Rename:

```sql
role_id
```

to:

```sql
assembly_role_id
```

Reason:
Avoid ambiguity and future-proof for additional role systems.

---

## 3. Update user_profiles.role

Restrict to:

```sql
CHECK (role IN ('admin', 'member'))
```

Remove all other enum values.

---

## 4. Update system_permissions schema

Target structure:

```sql
CREATE TABLE public.system_permissions (
    key text PRIMARY KEY,

    label text NOT NULL,

    description text,

    module_name text NOT NULL,

    category text NOT NULL,

    is_assignable boolean NOT NULL DEFAULT true,

    is_active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now()
);
```

---

## 5. Update role_permissions schema

Target structure:

```sql
CREATE TABLE public.role_permissions (
    role_id uuid NOT NULL REFERENCES assembly_roles(id) ON DELETE CASCADE,

    permission_key text NOT NULL REFERENCES system_permissions(key),

    created_at timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (role_id, permission_key)
);
```

Requirements:

* prevent duplicate permission assignments
* many-to-many relationship
* multiple roles can share permissions

---

## 6. Update assembly_roles schema

Add:

```sql
is_active boolean NOT NULL DEFAULT true
```

Optional future-proofing:

```sql
is_system boolean NOT NULL DEFAULT false
```

---

# Permission Registry Architecture

## Goal

Permissions are declared in module manifests and seeded via migrations.

NOT synchronized from frontend runtime.

---

# Required Structure

```txt
src/
  core/
    authorization/
      permission-registry.ts
      authorization-service.ts
      permissions.ts

  modules/
    membership/
      manifest.ts

    finance/
      manifest.ts
```

---

# Module Manifest Example

```ts
export const MembershipModule = {
  name: 'membership',

  permissions: [
    {
      key: 'members.view',
      label: 'View Members',
      category: 'Members',
      description: 'Allows viewing member records',
      isAssignable: true,
    },

    {
      key: 'members.edit',
      label: 'Edit Members',
      category: 'Members',
      description: 'Allows editing member records',
      isAssignable: true,
    },
  ],
}
```

---

# Permission Registry Requirements

Create:

```txt
core/authorization/permission-registry.ts
```

Responsibilities:

* register permissions
* validate duplicate keys
* expose permission catalogue
* export build artifacts

Required methods:

```ts
register()
getAll()
getByModule()
validate()
```

---

# Permission Naming Rules

Permissions MUST follow:

```txt
<module>.<resource>.<action>
```

Examples:

```txt
members.view
members.edit
reports.export
finance.offerings.edit
```

DO NOT allow:

* camelCase
* spaces
* underscores
* inconsistent naming

Invalid examples:

```txt
editMembers
view_reports
membersEdit
```

---

# Build-Time Permission Seeding

## Required Process

1. Modules register permissions
2. Build script collects permissions
3. Build script validates:

   * duplicates
   * invalid names
4. Migration generated
5. Migration upserts into `system_permissions`

---

# Migration Requirements

Use:

```sql
INSERT ...
ON CONFLICT (key)
DO UPDATE ...
```

Never delete permissions automatically.

Use:

* `is_active`
* deprecation

instead of hard deletion.

---

# RLS Refactor Requirements

## Remove All Hardcoded Role Logic

Remove checks like:

```sql
role = 'pastor'
role = 'secretary'
role IN (...)
```

RLS must only know:

* admin
* member
* assembly ownership

---

# Allowed RLS Concepts

Allowed:

* assembly isolation
* ownership checks
* admin override

Forbidden:

* permission checks
* business logic
* custom role names

---

# Authorization Service Requirements

Create:

```txt
core/authorization/authorization-service.ts
```

Responsibilities:

* permission resolution
* admin bypass
* permission checks

Required API:

```ts
can(user, permission)
requirePermission(user, permission)
hasPermission(user, permission)
```

---

# Admin Bypass Rules

If:

```ts
user.role === 'admin'
```

Authorization immediately succeeds.

No additional permission lookup required.

---

# UI Requirements

## Role Builder

UI must:

* read permissions from database
* group by category/module
* only show assignable permissions

Example query:

```sql
SELECT *
FROM system_permissions
WHERE is_assignable = true
AND is_active = true
ORDER BY module_name, category;
```

---

# Backend Validation Requirements

Even if hidden from UI:

Backend MUST reject assignment of:

```txt
is_assignable = false
```

Never trust frontend filtering.

---

# Migration Order

Implement in this exact order:

1. Create new permission registry architecture
2. Create new `system_permissions`
3. Seed permissions
4. Rename `role_id`
5. Restrict `user_profiles.role`
6. Refactor authorization service
7. Refactor RLS policies
8. Remove legacy role references
9. Update frontend guards
10. Update edge functions

Do NOT refactor frontend authorization before backend architecture exists.

---

# Forbidden Implementation Decisions

DO NOT:

* register permissions at frontend boot
* put permission logic inside RLS
* hardcode assembly role names
* allow assemblies to create permissions
* assign permissions directly to users
* perform permission inference
* dynamically invent permissions
* bypass authorization service

---

# Final Goal State

Authorization model:

```txt
User
 → System Role (admin/member)

User
 → Assembly Role
   → Permissions
```

Database responsibilities:

* isolation
* tenancy
* integrity

Application responsibilities:

* authorization
* permission evaluation
* business rules

This separation MUST remain strict.
