# Communication Module

Multi-channel messaging system for CACI Hub with support for broadcasts, direct messages, audio broadcasts, and announcements.

## Module Structure

```
communication/
├── index.ts                 # Module exports
├── manifest.ts              # Module metadata & configuration
├── routes.ts                # Route definitions
├── schemas/                 # TypeScript type definitions
│   ├── communication.ts     # Campaign, template, thread types
│   ├── audio.ts             # Audio broadcast types & constraints
│   └── index.ts
├── services/                # Business logic & API services
│   ├── communication.service.ts  # Campaign/message operations
│   ├── audio.service.ts          # Audio attachment handling
│   └── index.ts
├── utils/                   # Utility functions
│   ├── audio/               # Audio processing utilities
│   │   ├── recorder.ts      # Browser audio recording
│   │   ├── validation.ts    # Audio file validation
│   │   ├── checksum.ts      # SHA-256 integrity checking
│   │   ├── upload.ts        # Direct upload orchestration
│   │   └── index.ts
│   └── index.ts
├── hooks/                   # Custom React hooks
│   ├── useCanBroadcastAudio.ts   # Permission gate
│   ├── useAudioAttachment.ts      # Signed URL fetching
│   └── index.ts
├── widgets/                 # Reusable UI components
│   ├── AudioPlayer.tsx      # Waveform player with controls
│   └── index.ts
└── pages/                   # Page-level components (future)
```

## Key Features

### Audio Broadcasting (Pastor-Only)

**Permission:** `communications.audio.broadcast`

Flow:
1. `useCanBroadcastAudio()` - Check if user has permission
2. `AudioRecorder.start()` - Capture mono 16kHz audio
3. `validateAudioUpload()` - Verify size (≤10MB) and duration (2-600s)
4. `sha256()` - Compute integrity checksum
5. `uploadAudio()` - Direct client upload to Supabase Storage
6. `AudioService.registerAttachment()` - Server-side permission re-check & DB registration
7. `AudioPlayer` - Waveform visualization with playback

**Security Layers:**
- RLS on database tables
- API route permission check
- Storage bucket policies
- Edge Function validation

### Campaign Management

- Create broadcast campaigns
- Target specific audiences (assembly, group, member list, filter)
- Respect communication preferences (opt-out by channel)
- Track delivery status across providers

### Direct Messaging

- Member-to-member messaging
- Pastoral/sensitive threads (restricted access)
- Support threads (moderated by admins)
- 24-hour message deletion window

### Announcements

- Assembly-wide announcements
- Visibility targeting (groups, roles)
- Pinned announcements
- Time-based visibility windows

### Multi-Channel Delivery

Supported channels:
- **In-app:** Database
- **Email:** SendGrid
- **SMS:** Arkesel
- **Push:** Firebase Cloud Messaging
- **Audio:** Direct browser playback

## Service Classes

### CommunicationService

```typescript
// Fetch campaigns
CommunicationService.getCampaigns(assemblyId)

// Get campaign messages & stats
CommunicationService.getCampaignMessages(campaignId)
CommunicationService.getCampaignStats(campaignId)

// Permission checks
CommunicationService.canBroadcastAudio()
CommunicationService.getAssemblyId()
CommunicationService.getMemberId()
```

### AudioService

```typescript
// Register uploaded audio
AudioService.registerAttachment(payload)

// Fetch attachment details
AudioService.getAttachment(attachmentId)

// Delete attachment (soft delete)
AudioService.deleteAttachment(attachmentId)
```

## Audio Specifications

- **Format:** Mono, 16kHz sample rate, 32kbps bitrate
- **Max Size:** 10 MB
- **Max Duration:** 600 seconds (10 minutes)
- **Min Duration:** 2 seconds
- **Storage:** Direct client upload to `messages-media-private` bucket
- **Lifecycle:**
  - **Hot (0-60d):** Supabase Storage (fast access)
  - **Warm (60-365d):** Cloudflare R2 (cost-optimized)
  - **Cold (365d+):** Cloudflare R2 with 3-year purge

## Edge Functions

- **comm-fanout:** Expand campaigns to individual messages per recipient
- **comm-dispatch:** Send messages via providers (email, SMS, push)
- **comm-webhook:** Receive delivery receipts from providers
- **comm-archive:** Migrate audio files through storage tiers
- **comm-triggers:** Daily automation (birthdays, reminders)
- **storage-signed-url:** Generate presigned URLs for playback
- **storage-cleanup:** Purge deleted attachments

## Database Tables

- `communication_campaigns` - Campaign orchestration
- `communication_messages` - Per-recipient message records
- `communication_templates` - Reusable message templates
- `communication_threads` - Direct message threads
- `communication_thread_messages` - Thread messages (text/audio)
- `communication_attachments` - Media metadata with lifecycle tracking
- `announcement_posts` - Assembly announcements
- `communication_preferences` - Member channel opt-outs
- `push_device_tokens` - Device registration for push notifications
- `webhook_events` - Provider delivery receipts (audit trail)
- `storage_signed_url_log` - Access audit log
- `assembly_storage_usage` - Monthly storage billing

## Permissions

| Permission | Role | Purpose |
|-----------|------|---------|
| `communications.broadcast.send` | Broadcaster | Send campaigns |
| `communications.broadcast.schedule` | Broadcaster | Schedule campaigns |
| `communications.direct.send` | Member | Send direct messages |
| `communications.direct.send_pastoral` | Pastor | Create pastoral threads |
| `communications.direct.moderate` | Admin | Moderate messages |
| `communications.audio.broadcast` | Pastor | Upload/send audio |
| `communications.announcements.manage` | Announcer | Manage announcements |
| `communications.templates.manage` | Admin | Create templates |
| `communications.attachments.view_pastoral` | Pastoral | View sensitive media |
| `communications.attachments.manage` | Admin | Delete attachments |
| `communications.reports.view` | Admin | View delivery reports |

## Environment Variables

```env
# Backend
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=

# Storage (R2)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_WARM_BUCKET=caci-warm-dev
R2_COLD_BUCKET=caci-cold-dev

# Providers
ARKESEL_API_KEY=
ARKESEL_SENDER_ID=
SENDGRID_API_KEY=
FROM_EMAIL=
FCM_SERVER_KEY=
```

## Usage Examples

### Recording & Broadcasting Audio

```typescript
import { AudioRecorder, validateAudioUpload, uploadAudio } from '@/modules/communication'

// Record audio
const recorder = new AudioRecorder()
await recorder.start()
// ... user speaks ...
const { blob, durationSeconds, mimeType, waveformData } = await recorder.stop()

// Validate
const validation = validateAudioUpload(blob, durationSeconds)
if (!validation.valid) {
  console.error(validation.reason)
  return
}

// Upload
const result = await uploadAudio({
  blob,
  durationSeconds,
  mimeType,
  waveformData,
  assemblyId: 'assembly-123',
  campaignId: 'campaign-456',
  isPublicBroadcast: true
})

if (result.success) {
  console.log('Audio broadcast sent:', result.attachmentId)
}
```

### Playing Audio

```typescript
import { AudioPlayer } from '@/modules/communication'

export function MyComponent() {
  return (
    <AudioPlayer
      attachmentId="attachment-123"
      durationSeconds={45}
      waveformData={[...]}
      senderName="Pastor John"
    />
  )
}
```

### Checking Permissions

```typescript
import { useCanBroadcastAudio, CommunicationService } from '@/modules/communication'

export function BroadcastButton() {
  const { allowed, loading } = useCanBroadcastAudio()

  return (
    <button disabled={!allowed || loading}>
      {loading ? 'Checking...' : allowed ? 'Record Audio' : 'Unauthorized'}
    </button>
  )
}
```

## Testing

See `/supabase/migrations/20260610000001_create_communication_module.sql` and
`/supabase/migrations/20260610000002_communication_rls_policies.sql` for database setup.

All permissions are enforced at three levels:
1. **Database RLS** - Blocks unauthorized queries
2. **API Route** - Re-verifies before file acceptance
3. **Edge Functions** - Validates scope for service-level operations

## Related Documentation

- [Communication Architecture](../../docs/communication_edge_functions_architecture.md)
- [Migration: Schema](../../supabase/migrations/20260610000001_create_communication_module.sql)
- [Migration: RLS & Permissions](../../supabase/migrations/20260610000002_communication_rls_policies.sql)
