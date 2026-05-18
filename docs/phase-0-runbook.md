# CAC Hub Web — Phase 0 Runbook: Project Setup

**Goal:** A running Vite + TypeScript + Supabase project that can authenticate a user and render a blank shell.  
**Duration:** 2–3 days  
**Checkpoint:** `npm run dev` starts. Browser shows blank page. No console errors.

---

## Step 1 — Scaffold the Vite project

```bash
npm create vite@latest caci-hub-web -- --template vanilla-ts
cd caci-hub-web
npm install
```

> **Use `vanilla-ts` only.** The architecture uses vanilla TypeScript page modules with an explicit `PageModule` interface — not a component framework. Do not use the react or vue template.

Git init immediately so you can diff each step:

```bash
git init && git add . && git commit -m "chore: scaffold"
```

---

## Step 2 — Install all dependencies

Install everything in one shot. The architecture assumes all libraries are present from day one.

**Production deps:**

```bash
npm install \
  @supabase/supabase-js \
  alpinejs \
  bootstrap bootstrap-icons \
  dayjs \
  ag-grid-community \
  notyf \
  quill cropperjs dompurify \
  jspdf html2canvas \
  qrcode \
  i18next \
  fuse.js \
  zod
```

**Dev deps:**

```bash
npm install --save-dev \
  typescript \
  vite-plugin-pwa workbox-window \
  eslint prettier \
  @typescript-eslint/eslint-plugin \
  vitest \
  @playwright/test
```

**Why each library:**

| Library | Purpose |
|---|---|
| `@supabase/supabase-js` | Typed client for the existing Flutter backend. Same URL + anon key. |
| `alpinejs` | Shell-level reactivity only — dropdowns, notification badges. Not used for page state. |
| `ag-grid-community` | Replaces DataTables. Used for any table with >~500 rows or column-level filtering. |
| `notyf` | Typed toast notifications. Single `Toast.ts` wrapper. Replaces raw Toastify. |
| `zod` | Runtime schema validation for all form payloads. Schemas live in each module's `schemas/` folder. |
| `dompurify` | XSS sanitisation of all Quill output before DOM insertion. Non-negotiable. |
| `vite-plugin-pwa` | PWA from day one: install prompt, offline fallback, asset caching. |

---

## Step 3 — Configure `vite.config.ts`

Path aliases are load-bearing — every cross-folder import in the codebase uses them.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { resolve } from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'CAC Hub',
        short_name: 'CACHub',
        theme_color: '#C0392B',
      },
    }),
  ],
  resolve: {
    alias: {
      '@core':    resolve(__dirname, 'src/core'),
      '@shared':  resolve(__dirname, 'src/shared'),
      '@types':   resolve(__dirname, 'src/types'),
      '@modules': resolve(__dirname, 'src/modules'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
```

**Alias reference:**

| Alias | Resolves to |
|---|---|
| `@core/*` | `src/core/*` |
| `@shared/*` | `src/shared/*` |
| `@types/*` | `src/types/*` |
| `@modules/*` | `src/modules/*` |

> **No relative imports across modules.** No `../../../` paths anywhere in `src/`. All cross-folder imports use these aliases.

---

## Step 4 — Configure `tsconfig.json`

Strict mode throughout — no exceptions. Path aliases must mirror Vite exactly.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "outDir": "./dist",
    "rootDir": "./src",
    "paths": {
      "@core/*":    ["./src/core/*"],
      "@shared/*":  ["./src/shared/*"],
      "@types/*":   ["./src/types/*"],
      "@modules/*": ["./src/modules/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

> **`moduleResolution: bundler` is required.** Using `node` or `node16` causes import resolution mismatches with the alias config. The alias entries must be identical to Vite's — any drift creates false TypeScript errors in the editor while the build succeeds, or vice versa.

---

## Step 5 — Create `.env` from the Flutter project

The backend is shared — same Supabase project, same URL, same anon key. Copy values from `dart_defines.env` in the Flutter project root.

```bash
# .env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

```bash
# .env.example — commit this, not .env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key-from-supabase-dashboard>
```

Add to `.gitignore`:

```
.env
.env.local
dist/
node_modules/
```

> **`VITE_` prefix is required.** Vite only exposes env vars to client-side code if they're prefixed `VITE_`. Without it, `import.meta.env.VITE_SUPABASE_URL` will be `undefined` at runtime.

---

## Step 6 — Generate TypeScript types from the live schema

40 migrations are already applied. The Supabase CLI generates a fully-typed `database.types.ts` directly from the live schema. Never write or edit this file by hand.

```bash
npx supabase gen types typescript \
  --project-id <your-project-ref> \
  > src/types/database.types.ts
```

Add a script to `package.json` so the team can re-run it consistently:

```json
"scripts": {
  "dev":       "vite",
  "build":     "tsc && vite build",
  "preview":   "vite preview",
  "gen:types": "supabase gen types typescript --project-id <ref> > src/types/database.types.ts",
  "test":      "vitest",
  "test:e2e":  "playwright test"
}
```

The generated file exports:

- `Database` — root namespace
- `Database['public']['Tables']['members']['Row']` — full member row
- `Database['public']['Views']['members_view']['Row']` — display-ready view (migration 16)
- `Database['public']['Tables']['households']['Row']` — household row
- All enums: `membership_status`, `gender_type`, `marital_status`, etc.

> **Re-run after every migration.** The file will be overwritten — never edit it manually.

---

## Step 7 — Write `src/types/` — the four type files

Do this after step 6 so `database.types.ts` exists to import from.

```
src/types/
├── database.types.ts   ← auto-generated (step 6)
├── member.types.ts     ← member + household shapes
├── auth.types.ts       ← AppUser, UserRole, UserProfile
├── module.types.ts     ← ModuleManifest, PageModule, RouteDefinition
└── common.types.ts     ← PaginatedResult, ApiResponse, RepositoryError, LoadState
```

### `module.types.ts` — the PageModule interface

Every page file must export a `PageModule` as default. The router calls `render()` on navigate in and `destroy()` on navigate out.

```ts
export interface PageModule {
  render(container: HTMLElement): Promise<void>
  destroy?(): void
}

export interface RouteDefinition {
  path:          string
  page:          () => Promise<{ default: PageModule }>
  middleware?:   string[]
  permission?:   string
  presentation?: 'shell' | 'fullscreen' | 'modal' | 'embedded'
}

export interface ModuleManifest {
  name:          string
  version:       string
  enabled:       boolean
  routes?:       RouteDefinition[]
  sidebar?:      SidebarItem
  widgets?:      WidgetDefinition[]
  capabilities?: Capability[]
  init?(ctx: ModuleContext): Promise<void>
  dispose?(): Promise<void>
}
```

### `common.types.ts` — LoadState and RepositoryError

```ts
export type LoadState = 'loading' | 'success' | 'empty' | 'error'

export class RepositoryError extends Error {
  constructor(
    message: string,
    public cause: unknown,
    public code?: string
  ) {
    super(message)
    this.name = 'RepositoryError'
  }
}
```

### `member.types.ts` — household types

```ts
import type { Database } from './database.types'

export type MemberRow   = Database['public']['Tables']['members']['Row']
export type MemberView  = Database['public']['Views']['members_view']['Row']
export type MemberStatus = Database['public']['Enums']['membership_status']
export type Gender       = Database['public']['Enums']['gender_type']

export type HouseholdRow = Database['public']['Tables']['households']['Row']

export interface HouseholdView extends HouseholdRow {
  member_count:         number
  primary_contact_name: string | null
}

export interface HouseholdWithMembers extends HouseholdView {
  members: MemberView[]
}

export interface CreateHouseholdPayload {
  name:               string
  address:            string | null
  assembly_id:        string
  primary_contact_id: string | null
}

export type UpdateHouseholdPayload = Partial<CreateHouseholdPayload>

export interface HouseholdFilter {
  search?:      string
  assembly_id?: string  // required for super_admin; RLS handles others
}
```

---

## Step 8 — Write `src/core/supabase.ts`

A single typed Supabase client singleton. Every module imports from here — never call `createClient` anywhere else.

```ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@types/database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    'Missing Supabase env vars. Check .env has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  )
}

export const supabase = createClient<Database>(url, key)
```

Passing `Database` to `createClient` types every `.from()` call. Querying a non-existent table or a column with the wrong name becomes a compile error rather than a silent runtime failure.

**Smoke test — add temporarily to `main.ts`, delete after:**

```ts
import { supabase } from '@core/supabase'
const { data, error } = await supabase.from('assemblies').select('id').limit(1)
console.log('Supabase connection:', error ?? 'OK', data)
```

---

## Step 9 — Write the empty boot sequence in `src/main.ts`

Minimal skeleton — comments stub out everything that will be wired in Phase 3+. Do not uncomment imports that point at files that don't exist yet; the dev server will fail.

```ts
import './styles/theme.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'

// Boot sequence — modules registered here in Phase 3+
// import { registerModule, initModules } from '@core/registry'
// import { startRouter }                 from '@core/router'
// import { loadCurrentUser }             from '@core/auth'

async function boot(): Promise<void> {
  console.log('[main] CAC Hub Web starting...')
  // 1. Register modules  — Phase 3+
  // 2. Load current user — Phase 3+
  // 3. Init modules      — Phase 3+
  // 4. Start router      — Phase 3+
  console.log('[main] Boot complete (no modules registered yet)')
}

boot().catch(console.error)
```

> **Boot order matters.** When modules are added in Phase 3, the sequence is strict: register → loadCurrentUser → initModules → startRouter. The router cannot run before auth is resolved; module routes won't exist yet.

Create the directory structure now:

```bash
mkdir -p src/styles src/types src/core src/shell \
         src/shared/utils src/shared/components src/modules
```

Stub `src/styles/theme.css` so the import resolves:

```css
/* CACI brand tokens — populated in Phase 2 from caci_design_system.dart */
:root {
  --caci-red:          #C0392B;
  --caci-gold:         #D4AC0D;
  --caci-navy:         #1B2A4A;
  --caci-green:        #1E8449;
  --sidebar-width:     240px;
  --toolbar-height:    56px;
}
```

---

## Step 10 — Write `index.html` — the SPA shell

Single page, single mount point. Everything renders into `#app`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="CAC Hub — Church Assembly Management" />
  <meta name="theme-color" content="#C0392B" />

  <link rel="icon" href="/favicon.ico" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="apple-touch-icon" href="/caci-logo.png" />

  <title>CAC Hub</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

`public/manifest.json`:

```json
{
  "name": "CAC Hub",
  "short_name": "CACHub",
  "description": "Church Assembly Management Platform",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#C0392B",
  "icons": [
    { "src": "/caci-logo.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/caci-logo.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## Checkpoint ✓

```bash
npm run dev
```

- Browser opens to a blank white page
- Console shows `[main] CAC Hub Web starting...` and `[main] Boot complete`
- Supabase smoke test (if added) logs `OK` with a row from `assemblies`
- No TypeScript compiler errors (`tsc --noEmit` passes clean)
- No red console entries

Commit everything, then proceed to Phase 1 — Core Layer.
