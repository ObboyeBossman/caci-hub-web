# CAC Hub Web — App Boot & Pre-Auth Flow

**Project:** CAC Hub Web  
**Version:** 1.0.0  
**Status:** Design — pre-implementation  
**Last Updated:** May 2026  
**Related Documents:** Architecture v2.0.0 · Shared Data Cache Design v1.0.0

---

## Overview

Every session begins at the same entry point — the Splash screen. From there, the app makes a single decision: does a valid session exist? The answer determines whether the user is sent through the pre-auth flow or directly into the boot sequence.

This document covers the full journey from app launch to dashboard, including the Splash screen, Assembly Selection, Login, and the Loading screen that initialises the app before handing control to the router.

---

## Full Flow Diagram

```
App Launch (main.ts)
        ↓
  ┌─────────────┐
  │   Splash    │  ← Check Supabase session
  └─────────────┘
        ↓
  Valid session?
  ├── YES ──────────────────────────────────────┐
  │                                             ↓
  └── NO                               ┌──────────────┐
        ↓                              │ Loading Screen│
  ┌──────────────────┐                 └──────────────┘
  │Assembly Selection│                        ↓
  └──────────────────┘               Router initialises
        ↓                                     ↓
  ┌─────────────────────┐             ┌──────────────┐
  │ Login               │             │  Dashboard   │
  │ (Assembly branded)  │             └──────────────┘
  └─────────────────────┘
        ↓
  ┌──────────────┐
  │ Loading Screen│  ← Same boot sequence as returning user
  └──────────────┘
        ↓
  Router initialises
        ↓
  ┌──────────────┐
  │  Dashboard   │
  └──────────────┘
```

> The Loading screen is shared by both paths. Whether the user had an existing session or just logged in fresh, they always pass through the same initialisation sequence before reaching the dashboard.

---

## Stage 1 — Splash Screen

**File:** `src/core/splash.ts`  
**Route:** none — rendered directly by `main.ts` before the router starts  
**Presentation:** Fullscreen — no shell, no sidebar, no navbar

### Responsibilities

- Display the CAC Hub logo and app name briefly
- Call `supabase.auth.getSession()` to check for an existing valid session
- Make one decision and route accordingly — nothing else

### Decision Logic

| Condition | Next Screen |
|---|---|
| Valid session found | Loading Screen |
| No session / expired session | Assembly Selection |
| Supabase unreachable (network error) | Error state with retry option |

### What it does NOT do

- It does not load user profiles
- It does not register modules
- It does not warm caches
- It does not initialise the router

The splash is intentionally lean. It makes one async call, makes one decision, and exits.

### Timing

The splash should resolve as fast as possible. If the session check takes longer than expected, a minimal loading indicator is shown. There is no artificial minimum display time — the app moves on as soon as the check resolves.

---

## Stage 2 — Assembly Selection

**File:** `src/modules/auth/pages/AssemblySelection.ts`  
**Route:** `/select-assembly`  
**Presentation:** Fullscreen — no shell

### Purpose

Before a user can log in, they must identify which assembly (church branch) they belong to. This drives the branded login experience and scopes credential verification to the correct assembly.

### Data Source

The assemblies list is fetched from the `assemblies` table in Supabase. This is a **public, unauthenticated query** — no session is required. Only non-sensitive fields are fetched.

| Field | Purpose |
|---|---|
| `id` | Assembly identifier passed to login |
| `name` | Display name |
| `logo_url` | Branding on login screen |
| `branch_location` | Help user distinguish between branches |
| `is_active` | Only active assemblies are shown |

No financial data, member counts, or internal configuration is exposed in this query.

### UX Behaviour

- User can search assemblies by name or location
- Results display assembly name, logo, and branch location
- User taps or clicks their assembly to proceed
- Selected assembly details are stored in `sessionStorage` for use on the login screen
- User is navigated to the Login screen

### sessionStorage Shape

```json
{
  "selectedAssembly": {
    "id": "uuid",
    "name": "CAC Victory Temple",
    "logo_url": "https://...",
    "branch_location": "Accra, Ghana"
  }
}
```

This is cleared on successful login completion and on any auth error.

---

## Stage 3 — Login Screen

**File:** `src/modules/auth/pages/Login.ts`  
**Route:** `/login`  
**Presentation:** Fullscreen — no shell

### Purpose

Authenticate the user against Supabase Auth, then verify they belong to the selected assembly before granting access.

### Branding

The login screen reads the selected assembly from `sessionStorage` and displays:

- Assembly logo
- Assembly name
- Branch location

This gives the user visual confirmation they are logging into the correct assembly before entering credentials.

### Authentication Flow

1. User enters email and password
2. App calls `supabase.auth.signInWithPassword()`
3. On Supabase auth success, the app queries the `members` or `profiles` table to verify the authenticated user exists within the selected `assembly_id`
4. **If the user belongs to the assembly** → proceed to Loading Screen
5. **If the user does not belong to the assembly** → call `supabase.auth.signOut()` silently, display error, remain on Login screen
6. **If Supabase auth fails** (wrong credentials) → display standard auth error

### Assembly Membership Verification

This is the critical security check. Supabase Auth alone does not scope users to assemblies — a user with valid credentials could theoretically belong to a different assembly. The app must verify:

```
authenticated user id → exists in members/profiles WHERE assembly_id = selectedAssembly.id
```

If this check fails, the user is signed out immediately and shown a friendly message.

### Error Messages

| Scenario | Message Shown |
|---|---|
| Wrong email or password | "Invalid email or password" |
| User not in selected assembly | "You are not registered with this assembly. Please check your selection or contact your assembly admin." |
| Network error | "Unable to connect. Please check your connection and try again." |
| Account disabled | "Your account has been suspended. Please contact your assembly admin." |

### TOTP

If the user has TOTP MFA enrolled, the login flow redirects to the TOTP verification screen before proceeding to the Loading Screen. TOTP is handled by the existing `Totp.ts` page as documented in the architecture.

### Back Navigation

The login screen shows a "Change Assembly" link that returns the user to Assembly Selection and clears `sessionStorage`.

---

## Stage 4 — Loading Screen

**File:** `src/core/loading.ts`  
**Presentation:** Fullscreen — no shell  
**Triggered by:** Both a returning session (from Splash) and a fresh login (from Login)

### Purpose

The Loading screen is the app's full boot sequence. It runs all initialisation tasks that must complete before the router and shell can render safely. It is the single point of truth for app readiness.

### Boot Sequence (in order)

| Step | Task | Notes |
|---|---|---|
| 1 | Load full user profile | `getCurrentUser()` — fetches role, `assembly_id`, profile details |
| 2 | Load assembly details | Name, logo, branch info for shell display |
| 3 | Evaluate permissions | Build permission set for the current user's role |
| 4 | Register all module manifests | Routes, sidebar items, widgets, capabilities all declared |
| 5 | Warm member summary cache | Bulk fetch of `memberCache` for the assembly |
| 6 | Warm group summary cache | Bulk fetch of `groupCache` for the assembly |
| 7 | Initialise router | Router reads registered manifests and composes routes |
| 8 | Navigate to dashboard | Router evaluates initial URL or defaults to `/dashboard` |

### Progress Display

The Loading screen shows a branded progress indicator. It does not need to show granular step labels — a simple animated logo or progress bar is sufficient. If any step fails, the error is caught here.

### Error Handling During Boot

| Failure | Action |
|---|---|
| User profile not found | Sign out, clear session, redirect to Assembly Selection |
| Assembly details missing | Sign out, clear session, redirect to Assembly Selection |
| Network failure on cache warm | Log warning, continue — caches will populate lazily |
| Module registration error | Log error, skip that module, continue boot |
| Router initialisation failure | Show critical error screen with reload option |

Cache warm failures are non-fatal — the app boots without a warm cache and the caches populate on demand. All other failures are fatal and restart the auth flow.

### On Success

Once all steps complete, the Loading screen hands control to the router. The router evaluates the current URL or defaults to `/dashboard`. The shell renders with the correct sidebar, nav, and user context already available.

---

## Session Expiry During Active Use

If a Supabase session expires while the user is actively using the app:

- The next Supabase query that returns a 401 is caught by a global error interceptor in `core/supabase.ts`
- The app fires an `auth:sessionExpired` event on the event bus
- The shell listens for this event and redirects to the Splash screen
- The Splash screen detects no valid session and routes to Assembly Selection
- `sessionStorage` is cleared

This means the full pre-auth flow runs again on session expiry — the user re-selects their assembly and logs in again.

---

## Folder Placement

```
src/
├── core/
│   ├── splash.ts               ← Stage 1 — session check and routing decision
│   ├── loading.ts              ← Stage 4 — full boot sequence
│   └── auth.ts                 ← getCurrentUser(), onAuthStateChange()
│
└── modules/
    └── auth/
        ├── pages/
        │   ├── AssemblySelection.ts   ← Stage 2
        │   ├── Login.ts               ← Stage 3
        │   ├── Totp.ts                ← MFA verification (existing)
        │   ├── ForgotPassword.ts
        │   └── ResetPassword.ts
        └── index.ts                   ← Auth module manifest
```

---

## Event Contract

The pre-auth and boot flow fires and listens to the following events on the core event bus:

| Event | Fired by | Listened by | Purpose |
|---|---|---|---|
| `auth:signedIn` | Login.ts | loading.ts, shell | Trigger boot sequence after login |
| `auth:signedOut` | auth.ts | shell, memberCache, groupCache | Clear session and caches |
| `auth:sessionExpired` | supabase.ts interceptor | shell | Redirect to splash on 401 |
| `app:ready` | loading.ts | shell | Shell renders after boot completes |

---

## Relationship to Phase Plan

This flow maps to the existing implementation phases as follows:

| Phase | Pre-Auth / Boot work |
|---|---|
| Phase 1 — Core layer | `splash.ts`, `loading.ts`, `auth.ts`, session check logic |
| Phase 3 — Auth module | `AssemblySelection.ts`, `Login.ts`, `Totp.ts`, assembly verification logic |
| Phase 3 checkpoint | Full pre-auth flow working end to end — first live Vercel deployment |

The shared cache warm in the Loading screen (Steps 5 and 6) is added in Phase 4 after the membership module and its caches are built.

---

*Document Version: 1.0.0 · Project: CAC Hub Web · Updated May 2026*
