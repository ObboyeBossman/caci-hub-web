# Communication Module — RLS Policies, Edge Functions & Audio Upload Flow

## Overview

This document covers the complete communication module implementation:
- Row-Level Security (RLS) policies enforcing assembly-scoped access
- Helper functions (`auth_assembly_id()`, `auth_has_permission()`, `auth_member_id()`)
- Permission model with 11 assignable keys
- Pastor audio broadcast workflow (end-to-end)
- Edge Functions for campaign fanout, dispatch, webhooks, archival, and automation

---

## Part 1 — RLS Architecture

### Three Core Helper Functions

All RLS policies rely on these trusted server-side functions:

```sql
-- Get the assembly_id for the current auth user
auth_assembly_id() → uuid

-- Check if current user has a specific permission
auth_has_permission(perm_key text) → boolean

-- Get the member_id for the current auth user (if they are a member)
auth_member_id() → uuid
```

These are `SECURITY DEFINER` functions that run with elevated privileges and cannot be spoofed by clients.

### Permission Keys

Eleven assignable permissions govern all communication operations:

| Key | Role | Purpose |
|-----|------|---------|
| `communications.broadcast.send` | Broadcaster | Create and send broadcast campaigns |
| `communications.broadcast.schedule` | Broadcaster | Schedule campaigns for future delivery |
| `communications.direct.send` | Member | Send direct messages to other members |
| `communications.direct.send_pastoral` | Pastor | Create pastoral/sensitive threads |
| `communications.direct.moderate` | Admin | Delete any message in any thread |
| `communications.audio.broadcast` | Pastor | Upload audio, send to assemblies |
| `communications.announcements.manage` | Announcer | Post and pin assembly announcements |
| `communications.templates.manage` | Admin | Create templates and trigger rules |
| `communications.attachments.view_pastoral` | Pastoral | Access sensitive/pastoral media |
| `communications.attachments.manage` | Admin | Delete any attachment |
| `communications.reports.view` | Admin | View delivery stats, audit logs |

### RLS Policy Coverage

- **Templates**: read (active only) → members; insert/update/soft-delete → managers
- **Campaigns**: read (assembly-scoped) → all members; insert → senders; update → creator or scheduler
- **Messages**: read own → members; read all + reporters → permission-gated; insert → service role only
- **Threads**: read (with participant check) → participants; pastoral restricted; insert → non-pastoral (members) or pastoral (permission-gated)
- **Thread participants**: read own → participants; insert → creator; update own → members
- **Thread messages**: read → participants; insert text/audio (with permission gate); delete own (24h window) or admin
- **Attachments**: read → assembly-scoped (+ pastoral gate); insert audio → pastor only; insert non-audio → members; delete → uploader or admin
- **Announcements**: read active (group-targeted) → members; insert/update → managers
- **Preferences**: read/insert/update own → members
- **Push tokens**: read/insert/update/delete own → members
- **Signed URL log**: read → admins + self; read own requests → members
- **Storage usage**: read → admins only
- **Trigger rules**: read/insert/update → admins only

---

## Part 2 — Pastor Audio Broadcast Workflow

### End-to-End Flow

```
1. Permission gate                    useCanBroadcastAudio() checks auth_has_permission
2. Browser recording                  AudioRecorder captures mono 16kHz 32kbps + waveform
3. Client validation                  validateAudioUpload checks size + duration
4. Checksum                           sha256(blob) for deduplication
5. Direct upload to storage           supabase.storage.upload() → messages-media-private
6. Register in DB                     POST /api/.../attachments/register
7. Server-side permission check       re-verify audio.broadcast + confirm file exists
8. Insert attachment row              communication_attachments with lifecycle dates
9. Update storage usage               increment_storage_usage() function
10. Fanout to recipients (if campaign) comm-fanout Edge Function
11. Playback (signed URL)             storage-signed-url Edge Function
12. Archive (background)              comm-archive cron: hot → warm → cold
```

### Implementation Files

**Client-side TypeScript:**
- `src/hooks/useCanBroadcastAudio.ts` — Permission gate
- `src/lib/audioRecorder.ts` — Browser recording with waveform sampling
- `src/lib/audioValidation.ts` — Size + duration validation (10MB, 10min max)
- `src/lib/checksum.ts` — SHA-256 computation
- `src/lib/audioUpload.ts` — Direct storage upload + API registration
- `src/hooks/useAudioAttachment.ts` — Signed URL fetching for playback
- `src/components/AudioPlayer.tsx` — Waveform player with playback progress

**Server-side:**
- `src/app/api/communications/attachments/register/route.ts` — Attachment registration with server-side permission check
- `supabase/migrations/20260610000002_communication_rls_policies.sql` — Helper functions, RLS policies, permission seeds

**Edge Functions:**
- `supabase/functions/comm-fanout/` — Expand campaign to individual messages
- `supabase/functions/comm-dispatch/` — Send messages via providers
- `supabase/functions/comm-webhook/` — Receive delivery receipts
- `supabase/functions/comm-archive/` — Tiered storage migration (hot→warm→cold)
- `supabase/functions/comm-triggers/` — Daily automation (birthdays, reminders)
- `supabase/functions/storage-signed-url/` — Generate presigned URLs (Supabase or R2)
- `supabase/functions/storage-cleanup/` — Purge expired attachments

---

## Part 3 — Key Security Principles

### Permission Enforcement Layers

1. **RLS (Database)** — Blocks unauthorized SELECT/INSERT/UPDATE/DELETE
2. **API Route** — Re-checks permission before accepting file + registering record
3. **Storage Bucket Policy** — Enforces mime-type + path constraints
4. **Edge Functions** — Service role validates scope + member eligibility

Pastor audio requires **all four layers** to pass.

### No Client-Side Trust

- Storage path generated server-side (no client UUID injection)
- Archive dates computed server-side (no client timestamp override)
- Permission checks always re-verified server-side
- Checksums validated before attachment deletion

### Soft Deletes Only

- `deleted_at` and `deleted_by` for audit trail
- Hard deletes only by background cleanup jobs
- Archive job confirms deletion before removing from storage

---

## Part 4 — Cron Schedules

Recommended pg_cron configuration:

```sql
SELECT cron.schedule('comm-dispatch',  '* * * * *',   'SELECT net.http_post(...)');
SELECT cron.schedule('comm-triggers',  '0 6 * * *',   'SELECT net.http_post(...)');
SELECT cron.schedule('comm-archive',   '0 2 * * *',   'SELECT net.http_post(...)');
SELECT cron.schedule('storage-cleanup','0 3 * * 0',   'SELECT net.http_post(...)');
```

---

## Deployment Checklist

- [x] Migration 1: Schema + indexes (`20260610000001_create_communication_module.sql`)
- [x] Migration 2: RLS + helpers + permissions (`20260610000002_communication_rls_policies.sql`)
- [x] Create `messages-media-public` and `messages-media-private` Storage buckets
- [x] Add Storage bucket RLS policies (see migration)
- [x] Deploy Edge Functions (comm-fanout, comm-dispatch, comm-webhook, comm-archive, comm-triggers, storage-signed-url, storage-cleanup)
- [x] Populate environment variables (.env files)
- [x] Configure pg_cron schedule (or use a separate worker service)
- [x] Client-side code (hooks, components, API route)

---

## Integration with Existing Modules

The communication module integrates seamlessly:
- Uses existing `assemblies`, `user_profiles`, `assembly_roles`, `role_permissions`, `members`, `groups`, `group_members`
- Emits events via the core event system for other modules to react
- Storage uses Supabase + Cloudflare R2 (same as other modules)
- RLS respects existing permission architecture
