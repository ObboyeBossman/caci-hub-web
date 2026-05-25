# Architectural Boundaries Refactoring Plan

The `caci-hub-web` architecture relies on strict module boundaries. During analysis, we identified several files that violate separation of concerns and are placed in the wrong module or layer. 

## Violations Identified

1. **Domain Logic in Shared Utilities:**
   [memberCache.ts](file:///home/obboye/dev/caci-hub-web/src/shared/utils/memberCache.ts) and [groupCache.ts](file:///home/obboye/dev/caci-hub-web/src/shared/utils/groupCache.ts) reside in `src/shared/utils/`. These contain logic deeply coupled with the `membership` module (fetching member/group summaries, listening for specific `member:updated` events). Generic `shared/` folders should not depend on domain-specific events or types.
2. **Misplaced Page in Auth Module:**
   `Dashboard.ts` is sitting in `src/modules/auth/pages/`. The Application Dashboard has nothing to do with authenticating users, and its placement inside the auth module is an architectural violation.
3. **Module Root Clutter:**
   `member-helpers.ts` is sitting in the root of the `membership` module (`src/modules/membership/`) instead of inside a dedicated folder group like the rest of the module's files.

## Proposed Changes

### Membership Module
We will create a specific `utils/` directory inside the membership module to contain domain-specific helpers, freeing up the global `shared/utils` folder for purely generic utilities.

#### [NEW] [src/modules/membership/utils/memberCache.ts](file:///home/obboye/dev/caci-hub-web/src/modules/membership/utils/memberCache.ts)
Move the cache file here from `src/shared/utils/memberCache.ts`.

#### [NEW] [src/modules/membership/utils/groupCache.ts](file:///home/obboye/dev/caci-hub-web/src/modules/membership/utils/groupCache.ts)
Move the cache file here from `src/shared/utils/groupCache.ts`.

#### [NEW] [src/modules/membership/utils/member-helpers.ts](file:///home/obboye/dev/caci-hub-web/src/modules/membership/utils/member-helpers.ts)
Move the helper file here from `src/modules/membership/member-helpers.ts`.

#### [DELETE] [src/shared/utils/memberCache.ts](file:///home/obboye/dev/caci-hub-web/src/shared/utils/memberCache.ts)
#### [DELETE] [src/shared/utils/groupCache.ts](file:///home/obboye/dev/caci-hub-web/src/shared/utils/groupCache.ts)
#### [DELETE] [src/modules/membership/member-helpers.ts](file:///home/obboye/dev/caci-hub-web/src/modules/membership/member-helpers.ts)

*Note: Moving these files will require updating all corresponding import paths across the `membership` module, `shell`, and `core`.*

### Dashboard Module Extraction
Instead of keeping `Dashboard.ts` incorrectly coupled to authentication (or deleting it outright, as it may be needed later), we will extract it to its own stub module or simply move it to `src/modules/dashboard/pages/Dashboard.ts` where it conceptually belongs.

#### [NEW] [src/modules/dashboard/pages/Dashboard.ts](file:///home/obboye/dev/caci-hub-web/src/modules/dashboard/pages/Dashboard.ts)
Move from `auth/pages/`.

#### [DELETE] [src/modules/auth/pages/Dashboard.ts](file:///home/obboye/dev/caci-hub-web/src/modules/auth/pages/Dashboard.ts)

---

## User Review Required
> [!IMPORTANT]
> - Do you want `Dashboard.ts` to be deleted instead of moved? It is currently an orphaned placeholder file that is not imported anywhere in the core router or auth module. If it's pure placeholder code, we can just delete it contextually. Otherwise I will move it to `src/modules/dashboard/`.
> - Do you approve of establishing `src/modules/membership/utils/` for domain-level utility caching?
