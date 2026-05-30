# 🗂️ CACI Hub — Environment Runbook

## Overview

| Tier | Database | App runs on | Purpose |
|------|----------|-------------|---------|
| **Local** | Docker (`localhost:54321`) | `npm run dev:local` | Risky experiments, schema work |
| **Dev** | Remote dev Supabase | `npm run dev` | Integration testing, team sharing |
| **Prod** | Remote prod Supabase | `npm run build` | Live data only |

---

## 📁 Env Files Reference

| File | Used by | Contains |
|------|---------|---------|
| `.env` | Fallback only | Do not rely on this — use specific env files |
| `.env.local` | `dev:local` | Docker local credentials |
| `.env.development` | `dev` | Remote dev credentials |
| `.env.production` | `build` | Remote prod credentials |
| `.env.example` | Reference | Template — safe to commit, no real secrets |

### `.env.local` (Docker)
```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<anon key printed by supabase start>
```

### `.env.development` (Remote Dev)
```env
VITE_SUPABASE_URL=https://ladwecxjhyvyzcrngneh.supabase.co
VITE_SUPABASE_ANON_KEY=<dev anon key from Supabase dashboard>
```

### `.env.production` (Remote Prod)
```env
VITE_SUPABASE_URL=https://<prod-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<prod anon key from Supabase dashboard>
```

### `.env.example` (Committed to Git)
```env
# Copy this file to .env.local / .env.development / .env.production
# and fill in the real values. Never commit files with real credentials.
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

> **Rule:** Only `.env.example` is committed to Git. All others are in `.gitignore`.

---

## 📦 `package.json` Scripts Setup

Add these to your `scripts` block:

```json
"scripts": {
  "dev": "vite --mode development",
  "dev:local": "vite --mode local",
  "build": "vite build --mode production",

  "db:local:start":  "npx supabase start",
  "db:local:stop":   "npx supabase stop",
  "db:local:reset":  "npx supabase db reset",
  "db:local:push":   "npx supabase db push",
  "db:local:studio": "npx supabase studio",

  "db:dev:push":     "npx supabase db push --project-ref ladwecxjhyvyzcrngneh",
  "db:dev:diff":     "npx supabase db diff --project-ref ladwecxjhyvyzcrngneh",

  "db:prod:push":    "npx supabase db push --project-ref <your-prod-project-ref>",

  "gen:types:local": "npx supabase gen types typescript --local > src/types/supabase.ts",
  "gen:types:dev":   "npx supabase gen types typescript --project-ref ladwecxjhyvyzcrngneh > src/types/supabase.ts",
  "gen:types:prod":  "npx supabase gen types typescript --project-ref <your-prod-project-ref> > src/types/supabase.ts"
}
```

> Replace `<your-prod-project-ref>` with the ref from your prod Supabase dashboard URL.

---

## 🐳 Local (Docker)

> Use for heavy schema changes, risky migrations, new feature experiments.

### First Time Setup

```bash
# 1. Initialize Supabase in the project (run once)
npx supabase init

# 2. Start local stack
npm run db:local:start
```

Docker pulls Supabase images on first run — takes a few minutes.  
On success you'll see:

```
API URL:    http://localhost:54321
Studio:     http://localhost:54323
Anon key:   eyJhbGc...   ← copy this into .env.local
```

### Daily Workflow

```bash
# 1. Start local DB
npm run db:local:start

# 2. Run app pointing to local DB
npm run dev:local

# 3. Create a new migration file
npx supabase migration new <descriptive_name>
# e.g. npx supabase migration new add_baptism_date_to_members

# 4. Write your SQL in the generated file under supabase/migrations/

# 5. Apply migrations to local only
npm run db:local:push

# 6. View DB visually in browser
npm run db:local:studio

# 7. Generate updated TypeScript types
npm run gen:types:local

# 8. Wipe and start fresh if needed
npm run db:local:reset

# 9. Shut down when done
npm run db:local:stop
```

### Migration File Naming

Supabase prefixes migration files with a timestamp automatically:

```
supabase/migrations/
  20260528120000_create_members_table.sql
  20260529083000_add_baptism_date_to_members.sql
  20260530101500_add_assembly_zones_table.sql
```

Keep names descriptive — they are your permanent schema changelog.

---

## 🔧 Remote Dev

> Use when testing with real remote data or sharing with teammates.  
> Only push migrations that have already passed local testing.

### Workflow

```bash
# 1. Run the app pointing to remote dev DB
npm run dev
#    ^ picks up .env.development automatically

# 2. Push tested migrations from local → dev
npm run db:dev:push

# 3. See what migrations are pending vs dev
npm run db:dev:diff

# 4. Generate TS types from dev schema
npm run gen:types:dev
```

### Linking the CLI to Dev (one-time)

```bash
npx supabase link --project-ref ladwecxjhyvyzcrngneh
```

You'll be prompted for your database password (the one you set when creating the project).

---

## 🚀 Remote Prod

> Only push when migrations are proven on Local **AND** Dev.  
> There is no undo for destructive migrations on prod.

```bash
# 1. Push finalized migrations to prod
npm run db:prod:push

# 2. Build the app (auto-targets prod via .env.production)
npm run build
```

### Before every prod push — checklist

- [ ] Migration ran successfully on local with `db:local:push`
- [ ] Migration ran successfully on dev with `db:dev:push`
- [ ] App tested end-to-end on dev environment
- [ ] Migration is non-destructive OR you have a backup
- [ ] TypeScript types regenerated and app still builds

---

## ✅ Safe Migration Flow

```
Write migration
      ↓
npm run db:local:push   ← test locally, break freely
      ↓
npm run db:dev:push     ← team QA, integration test
      ↓
npm run db:prod:push    ← go live (no skipping steps)
```

> **Never skip steps.** If a migration fails locally, it will fail on prod too.

---

## 🔄 TypeScript Types Workflow

Every time you change the schema, regenerate types to keep TypeScript in sync:

```bash
# After local schema change
npm run gen:types:local

# After pushing to dev
npm run gen:types:dev
```

Types are written to `src/types/supabase.ts`. Commit this file — it reflects your current schema and keeps the whole team in sync.

---

## 🛠️ Troubleshooting

### `supabase start` fails
```bash
# Make sure Docker is running
docker ps

# If port conflict, check what's using 54321
lsof -i :54321

# Force restart
npm run db:local:stop
npm run db:local:start
```

### Migration already applied error
```bash
# Check migration history on local
npx supabase migration list

# Reset local DB entirely and re-apply all migrations fresh
npm run db:local:reset
```

### Wrong database being hit
```bash
# Confirm which env file Vite is loading
# Check the terminal output when you run dev — it shows the mode

npm run dev        # should say "development" → hits remote dev
npm run dev:local  # should say "local" → hits Docker
```

### Anon key after `supabase start`
If you forgot to copy the anon key from first start:
```bash
npx supabase status
# Prints all local credentials again
```

---

## ⚠️ Key Rules

- **Never edit prod DB directly** — the Supabase dashboard SQL editor on prod is dangerous for schema changes
- **Never commit `.env.*` files** — only `.env.example` is safe to commit
- **Always run `gen:types` after a schema change** to keep TypeScript in sync
- **`db:prod:push` is irreversible** for destructive migrations — always have a backup
- **`service_role` key never goes in frontend env files** — it bypasses RLS entirely

---

## 📌 Quick Reference Card

| Task | Command |
|---|---|
| Start local stack | `npm run db:local:start` |
| Stop local stack | `npm run db:local:stop` |
| Reset local DB | `npm run db:local:reset` |
| New migration file | `npx supabase migration new <name>` |
| Apply to local | `npm run db:local:push` |
| Open local Studio | `npm run db:local:studio` |
| Push to dev | `npm run db:dev:push` |
| Diff vs dev | `npm run db:dev:diff` |
| Push to prod | `npm run db:prod:push` |
| Types from local | `npm run gen:types:local` |
| Types from dev | `npm run gen:types:dev` |
| Check local status | `npx supabase status` |
| List migrations | `npx supabase migration list` |
| Run app on local DB | `npm run dev:local` |
| Run app on dev DB | `npm run dev` |
| Build for prod | `npm run build` |
