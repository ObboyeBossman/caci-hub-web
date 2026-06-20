# CACI Hub — Tech Constraint Prompt for AI Assistant

You are working on **CACI Hub**, a modular monolith web app (Vertical Slice ·
Manifest-Driven · Capability-Based architecture). You must operate strictly
within the technology boundaries below. **Do not introduce, suggest, install,
or silently substitute any tool, library, framework, or pattern that is not
explicitly listed.** If a task seems to require something outside this list,
STOP and ask the user before proceeding — do not improvise a workaround using
an unlisted package.

## ✅ Approved Stack (use ONLY these)

**Language & Build**
- TypeScript (strict mode) — all files `.ts`, no plain `.js` in `src/`
- Vite — bundler, dev server, code splitting, lazy loading (no extra Vite plugins beyond `vite-plugin-pwa`)

**UI / Styling**
- Bootstrap 5 — layout, components, grid, admin UI
- Bootstrap Icons — SVG icon set
- Alpine.js — **shell-level only** (dropdowns, modals, notification badges). Never use Alpine for page-level state.
- Vanilla TS state objects — for all page-level/complex state (no Alpine, no framework state for this)

**Libraries (one job each — do not duplicate functionality with another package)**
- Day.js — dates / relative time
- AG Grid Community — sortable/filterable/paginated tables (use once dataset > ~500 rows or column filtering needed)
- Notyf — toast notifications
- Chart.js — financial/attendance/giving charts
- Zod — all runtime schema validation (form payloads), schemas live in each module's `schemas/` folder
- Quill.js — rich text editor (pastoral notes, announcements, group descriptions)
- Cropper.js — avatar cropping pre-upload
- DOMPurify — mandatory sanitization of all Quill output before DOM insertion (non-negotiable)
- jsPDF + html2canvas — client-side PDF generation
- QRCode.js — QR generation for check-in / digital membership cards
- i18next — i18n (target: English, Twi, Ga, Ewe, French, German)
- Fuse.js — client-side fuzzy search on already-loaded data only
- vite-plugin-pwa + Workbox — PWA, offline fallback, asset caching

**Backend — Supabase (already complete, untouched, do not modify schema/migrations/Edge Functions unless explicitly asked)**
- PostgreSQL (Supabase managed) — all persistent data
- Supabase Auth — JWT, email/password, TOTP MFA
- Supabase Storage — photos, documents, media
- Supabase Realtime — live notifications/attendance
- Supabase Edge Functions (Deno/TS) — existing only: `create-member-user`, `send-welcome-email`, `send-welcome-sms`, `generate-membership-number`, `export-members-csv`
- PostgreSQL RLS — all data access enforced at DB layer

**Tooling**
- ESLint + Prettier, Vitest (unit), Playwright (E2E), Git + GitHub, Vercel (hosting), Supabase CLI + Docker (local dev)

## 🚫 Explicitly Banned / Out of Bounds

- No other frontend framework (React, Vue, Svelte, Angular) — this is vanilla TS + Alpine only
- No other CSS framework or utility-CSS system (Tailwind, MUI, Chakra, etc.) — Bootstrap 5 only
- No other state management library (Redux, Zustand, Pinia, Riverpod-equivalent, etc.) — vanilla TS state only
- No other date library (Moment.js, date-fns, Luxon) — Day.js only
- No other table library (DataTables.js, TanStack Table) — AG Grid Community only
- No other toast/notification library (Toastify.js, SweetAlert) — Notyf only
- No other validation library (Yup, Joi, hand-written validators) — Zod only
- No other rich text editor (TinyMCE, Draft.js, Slate) — Quill.js only
- No other charting library (D3, ApexCharts, Recharts) — Chart.js only
- No other backend/BaaS (Firebase, AWS Amplify, custom Express/Node API server) — Supabase only
- No ORM (Prisma, Drizzle, TypeORM) — direct Supabase JS client queries through each module's `repository.ts`
- No new Edge Functions, migrations, or RLS policy changes unless the user explicitly requests a backend change
- No new third-party SMS/email providers beyond what's already wired (Edge Functions handle welcome SMS/email; Phase 2 will add Africa's Talking for bulk SMS and Resend for email — do not add others, do not implement early unless asked)
- No payment library beyond Paystack/Flutterwave when Giving module work is explicitly requested (Phase 2 scope — do not add Stripe, etc.)

## Architectural Rules (never violate)

- Modules depend on core. Core never depends on modules.
- Modules never import each other directly — communicate only via the event bus (`core/events.ts`).
- Shared UI/utilities live in `shared/` only — no module-specific logic there.
- `memberCache` and `groupCache` (in `shared/utils/`) are read-only for all consumers except the membership module, which alone writes to the DB; cache invalidation happens via events.
- Core never imports from `shell/`; shell imports from core.
- All DB queries go through the owning module's own `repository.ts`. Never query another module's tables directly.
- Circular dependencies must never occur.

## When in doubt

If a requested feature seems to need a tool not on the approved list, do **not**
substitute one silently. Instead, respond with: "This isn't covered by the
approved CACI Hub stack — the closest fit would be [X], or this may need an
addition to the architecture doc. Which do you want?"