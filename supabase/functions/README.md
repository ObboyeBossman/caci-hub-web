# Communication Module Edge Functions

Server-side functions for campaign orchestration, message dispatch, and storage management.

## Function Overview

### 1. comm-fanout

**Purpose:** Expand campaigns to individual messages per recipient

**Trigger:** When campaign status changes to 'sending'

**Process:**
1. Fetch campaign + template
2. Resolve audience (assembly/group/member_list/filter)
3. Check communication_preferences for opt-outs
4. Render template variables per member
5. Batch insert communication_messages (500 at a time)
6. Update campaign status to 'sending', set total_recipients

**Input:**
```json
{
  "campaign_id": "uuid"
}
```

**Output:**
```json
{
  "success": true,
  "messages_created": 1250,
  "batch_count": 3
}
```

---

### 2. comm-dispatch

**Purpose:** Send queued messages to external providers

**Trigger:** Every 1 minute via pg_cron

**Process:**
1. Fetch 50 queued messages (status='pending')
2. Route per provider (arkesel→SMS, sendgrid→email, fcm→push, internal→in-app)
3. Call provider API with formatted payload
4. Update message status, external_ref, provider_status
5. Log failures to failed_reason
6. Repeat until queue empty

**Provider-Specific:**
- **Arkesel (SMS):** POST /api/v2/sms/send with phone + body
- **SendGrid (Email):** POST /v3/mail/send with to + subject + html
- **FCM (Push):** POST /v1/projects/{project}/messages:send with device_token + title + body
- **Internal (In-App):** Mark delivered immediately

---

### 3. comm-webhook

**Purpose:** Receive and process delivery receipts from providers

**Trigger:** Provider callback (e.g., SendGrid webhooks)

**Process:**
1. Extract provider from query param
2. Validate webhook signature (provider-specific)
3. Store raw payload in webhook_events (replay safety net)
4. Map provider event_type to communication_messages status
5. Update message: delivered_at, read_at, or failed_reason
6. Mark webhook_events.processed_at

**Provider Status Mappings:**
- **SendGrid:** delivered, open→read, bounce/dropped→failed
- **Arkesel:** delivered, failed, sent
- **Twilio (v2):** delivered, failed, sent, read

**Input (SendGrid example):**
```json
{
  "event": "delivered",
  "email": "user@example.com",
  "external_id": "provider-message-id-123"
}
```

---

### 4. comm-archive

**Purpose:** Tiered storage migration (hot→warm→cold)

**Trigger:** Daily at 2 AM via pg_cron

**Process:**
1. **Hot→Warm (>60 days):**
   - Query attachments in Supabase, created_at < now()-60d
   - Download file from Supabase Storage
   - Upload to R2 warm bucket (s3-compatible)
   - Verify successful upload
   - Delete from Supabase
   - Update attachment: storage_tier='warm', storage_provider='r2'

2. **Warm→Cold (>365 days):**
   - Query attachments in R2 warm bucket, created_at < now()-365d
   - Copy from warm to cold bucket (server-side copy)
   - Verify successful copy
   - Delete from warm bucket
   - Update attachment: storage_tier='cold'

3. Batch process 100 files per tier per invocation

**Environment:**
```env
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_WARM_BUCKET=caci-warm-dev
R2_COLD_BUCKET=caci-cold-dev
```

---

### 5. comm-triggers

**Purpose:** Daily automation (birthdays, reminders)

**Trigger:** Daily at 6 AM via pg_cron

**Process:**
1. Get today's date as MM-DD format
2. Query communication_trigger_rules for active=true
3. Find members matching trigger:
   - Birthday rules: member date_of_birth MM-DD = today
   - Custom offset: before/after N days
4. Create campaign in 'sending' status
5. Invoke comm-fanout to expand to messages
6. Messages inherit trigger rule's audience + channel

**Trigger Rule Examples:**
- Birthday: MM-DD format, trigger on exact date
- Reminder: offset_direction='after', offset_days=30 (30 days after membership)
- Anniversary: offset_direction='before', offset_days=1 (1 day before anniversary)

---

### 6. storage-signed-url

**Purpose:** Generate presigned URLs for private attachment playback

**Trigger:** On-demand via client (when AudioPlayer mounts)

**Process:**
1. Validate attachment exists and not deleted
2. Verify requester is in assembly (RLS already ensures this)
3. Check pastoral permission if is_sensitive=true
4. Generate presigned URL (1 hour expiry)
5. Log access to storage_signed_url_log for audit
6. Return URL (Supabase or R2 depending on tier)

**Input:**
```json
{
  "attachment_id": "uuid",
  "requester_id": "uuid"
}
```

**Output:**
```json
{
  "url": "https://...-signed-url.../file.ogg?token=...",
  "expires_in": 3600
}
```

**URL Types:**
- **Supabase (hot):** `https://{bucket}.supabase.co/storage/v1/object/sign/...`
- **R2 (warm/cold):** `https://{bucket}.r2.cloudflare.com/...?X-Amz-Signature=...`

---

### 7. storage-cleanup

**Purpose:** Purge files marked for deletion

**Trigger:** Weekly on Sunday 3 AM via pg_cron

**Process:**
1. Query attachments with deleted_at set AND purge_after <= now()
2. Delete from storage (Supabase or R2 based on tier)
3. Hard delete from communication_attachments
4. Log count of purged files
5. Batch process 100 files per invocation

---

## Cron Schedule Configuration

Add to `supabase/functions/cron.sql`:

```sql
-- Dispatch messages every minute
SELECT cron.schedule(
  'comm-dispatch',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://{PROJECT_ID}.supabase.co/functions/v1/comm-dispatch',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )
  ) as request_id;
  $$
);

-- Trigger birthdays/reminders daily at 6 AM
SELECT cron.schedule(
  'comm-triggers',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://{PROJECT_ID}.supabase.co/functions/v1/comm-triggers',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )
  ) as request_id;
  $$
);

-- Archive files to warm/cold tiers daily at 2 AM
SELECT cron.schedule(
  'comm-archive',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://{PROJECT_ID}.supabase.co/functions/v1/comm-archive',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )
  ) as request_id;
  $$
);

-- Clean up deleted files weekly on Sunday 3 AM
SELECT cron.schedule(
  'storage-cleanup',
  '0 3 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://{PROJECT_ID}.supabase.co/functions/v1/storage-cleanup',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )
  ) as request_id;
  $$
);
```

---

## Error Handling

### Retry Strategy

**comm-dispatch:**
- Failed messages: retry up to 3 times with exponential backoff
- Provider errors logged to webhook_events for manual review

**comm-archive:**
- Failed migrations: log to error table, skip file, continue batch
- Re-attempt next cron cycle

**storage-cleanup:**
- Failed deletes: log to error table, skip file, continue batch

### Logging

All functions log to:
- Edge Function logs (Supabase dashboard)
- Database tables (webhook_events, communication_messages.failed_reason)
- Application monitoring (if configured)

---

## Provider Credentials

### Arkesel (SMS)
```env
ARKESEL_API_KEY=your_api_key
ARKESEL_SENDER_ID=CACI_HUB
```

### SendGrid (Email)
```env
SENDGRID_API_KEY=SG.xxx...
FROM_EMAIL=noreply@cacihub.com
```

### Firebase Cloud Messaging (Push)
```env
FCM_SERVER_KEY=your_server_key
```

### Cloudflare R2 (Storage Tiers)
```env
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_WARM_BUCKET=caci-warm-dev
R2_COLD_BUCKET=caci-cold-dev
```

---

## Deployment Checklist

- [ ] Create `supabase/functions/cron.sql` with pg_cron schedule
- [ ] Deploy all Edge Functions (deno deploy or supabase functions deploy)
- [ ] Verify webhook endpoints with providers
- [ ] Test campaign fanout with test audience
- [ ] Monitor first dispatch cycle
- [ ] Verify archive migration (check R2 buckets)
- [ ] Enable cron schedules after verification

---

## Testing Edge Functions Locally

```bash
# Start Supabase locally
supabase start

# Invoke a function
supabase functions invoke comm-fanout --env-file supabase/.env \
  --body '{"campaign_id": "test-id"}'

# View logs
supabase functions logs comm-fanout
```
