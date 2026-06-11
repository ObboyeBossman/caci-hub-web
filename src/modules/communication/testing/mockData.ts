import type {
  Campaign,
  CampaignMessage,
  Template,
  Announcement,
  MessageThread,
  ThreadParticipant,
  ThreadMessage,
  Attachment,
  CommunicationPreference,
} from '../schemas'
import type { AudioBroadcastPayload } from '../schemas/audio'

const ASSEMBLY_ID = 'test-assembly-001'
const MEMBER_ID = 'test-member-001'
const MEMBER_ID_2 = 'test-member-002'
const USER_ID = 'test-user-001'

let _idCounter = 0
function nextId(prefix = 'mock'): string {
  _idCounter++
  return `${prefix}-${_idCounter}`
}

function pastDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86400000).toISOString()
}
function futureDate(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86400000).toISOString()
}

export function buildCampaign(overrides?: Partial<Campaign>): Campaign {
  return {
    id: nextId('campaign'),
    assembly_id: ASSEMBLY_ID,
    template_id: null,
    title: 'Test Campaign',
    body: 'This is a test campaign body.',
    status: 'draft',
    channel: 'in_app',
    audience_type: 'assembly',
    audience_ids: null,
    scheduled_for: null,
    total_recipients: 0,
    created_by: USER_ID,
    created_at: pastDate(1),
    updated_at: pastDate(1),
    ...overrides,
  }
}

export function buildCampaignMessage(overrides?: Partial<CampaignMessage>): CampaignMessage {
  return {
    id: nextId('msg'),
    campaign_id: 'campaign-mock-1',
    recipient_id: MEMBER_ID,
    status: 'pending',
    rendered_body: 'Test message body',
    provider: 'mock',
    external_ref: null,
    delivered_at: null,
    read_at: null,
    failed_reason: null,
    created_at: pastDate(0),
    ...overrides,
  }
}

export function buildTemplate(overrides?: Partial<Template>): Template {
  return {
    id: nextId('tpl'),
    assembly_id: ASSEMBLY_ID,
    name: 'Test Template',
    body: 'Hello {{name}}, welcome!',
    variables: { name: 'string' },
    channel: 'in_app',
    is_active: true,
    created_by: USER_ID,
    created_at: pastDate(5),
    updated_at: pastDate(5),
    ...overrides,
  }
}

export function buildAnnouncement(overrides?: Partial<Announcement>): Announcement {
  return {
    id: nextId('ann'),
    assembly_id: ASSEMBLY_ID,
    title: 'Test Announcement',
    body: 'This is an important announcement.',
    visibility_type: 'all',
    visible_to_ids: null,
    is_pinned: false,
    visible_from: pastDate(1),
    visible_until: futureDate(7),
    created_by: USER_ID,
    created_at: pastDate(1),
    updated_at: pastDate(1),
    deleted_at: null,
    ...overrides,
  }
}

export function buildMessageThread(overrides?: Partial<MessageThread>): MessageThread {
  return {
    id: nextId('thread'),
    assembly_id: ASSEMBLY_ID,
    thread_type: 'direct',
    title: 'Test Thread',
    is_sensitive: false,
    created_by: USER_ID,
    created_at: pastDate(3),
    updated_at: pastDate(0),
    deleted_at: null,
    ...overrides,
  }
}

export function buildThreadParticipant(overrides?: Partial<ThreadParticipant>): ThreadParticipant {
  return {
    id: nextId('tpart'),
    thread_id: 'thread-mock-1',
    member_id: MEMBER_ID,
    last_read_at: pastDate(0),
    joined_at: pastDate(3),
    ...overrides,
  }
}

export function buildThreadMessage(overrides?: Partial<ThreadMessage>): ThreadMessage {
  return {
    id: nextId('tmsg'),
    thread_id: 'thread-mock-1',
    sender_id: MEMBER_ID,
    body: 'Hello, this is a test message.',
    attachment_id: null,
    message_type: 'text',
    created_at: pastDate(0),
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  }
}

export function buildAttachment(overrides?: Partial<Attachment>): Attachment {
  return {
    id: nextId('att'),
    assembly_id: ASSEMBLY_ID,
    campaign_id: null,
    thread_message_id: null,
    storage_tier: 'hot',
    storage_provider: 'supabase',
    storage_bucket: 'messages-media-private',
    storage_path: `${ASSEMBLY_ID}/audio/2026/01/test.webm`,
    mime_type: 'audio/webm;codecs=opus',
    file_size_bytes: 256000,
    checksum: 'abc123def456',
    duration_seconds: 30,
    waveform_data: Array.from({ length: 100 }, () => Math.round(Math.random() * 255)),
    is_sensitive: false,
    virus_scan_status: 'clean',
    transcription_status: 'pending',
    uploaded_by: USER_ID,
    archive_after: futureDate(90),
    purge_after: futureDate(365),
    created_at: pastDate(0),
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  }
}

export function buildAudioBroadcastPayload(overrides?: Partial<AudioBroadcastPayload>): AudioBroadcastPayload {
  return {
    assembly_id: ASSEMBLY_ID,
    campaign_id: null,
    thread_message_id: null,
    storage_bucket: 'messages-media-private',
    storage_path: `${ASSEMBLY_ID}/audio/2026/01/test.webm`,
    mime_type: 'audio/webm;codecs=opus',
    file_size_bytes: 256000,
    checksum: 'abc123def456',
    duration_seconds: 30,
    waveform_data: Array.from({ length: 100 }, () => Math.round(Math.random() * 255)),
    is_sensitive: false,
    is_public_broadcast: true,
    ...overrides,
  }
}

export function buildCommunicationPreference(overrides?: Partial<CommunicationPreference>): CommunicationPreference {
  return {
    id: nextId('pref'),
    member_id: MEMBER_ID,
    channel: 'email',
    opt_out: false,
    category: null,
    updated_at: pastDate(30),
    ...overrides,
  }
}

export function seedCampaigns(): Campaign[] {
  return [
    buildCampaign({ id: 'campaign-1', title: 'Sunday Service Reminder', status: 'sent', channel: 'in_app', total_recipients: 120, created_at: pastDate(2) }),
    buildCampaign({ id: 'campaign-2', title: 'Youth Camp Registration', status: 'draft', channel: 'email', audience_type: 'group', audience_ids: ['group-1'], created_at: pastDate(1) }),
    buildCampaign({ id: 'campaign-3', title: 'Midweek Prayer Meeting', status: 'scheduled', channel: 'push', scheduled_for: futureDate(1), total_recipients: 85, created_at: pastDate(0) }),
    buildCampaign({ id: 'campaign-4', title: 'Easter Celebration Invite', status: 'sent', channel: 'sms', total_recipients: 200, created_at: pastDate(10) }),
    buildCampaign({ id: 'campaign-5', title: 'Leadership Training', status: 'cancelled', channel: 'email', audience_type: 'member_list', audience_ids: [MEMBER_ID, MEMBER_ID_2], created_at: pastDate(5) }),
  ]
}

export function seedTemplates(): Template[] {
  return [
    buildTemplate({ id: 'tpl-1', name: 'Event Reminder', body: 'Dear {{name}}, this is a reminder for {{event}} on {{date}}.', channel: 'email', variables: { name: 'string', event: 'string', date: 'string' } }),
    buildTemplate({ id: 'tpl-2', name: 'Welcome Message', body: 'Welcome to {{assembly}}, {{name}}! We are glad to have you.', channel: 'in_app', variables: { name: 'string', assembly: 'string' } }),
    buildTemplate({ id: 'tpl-3', name: 'Prayer Request', body: 'Please pray for {{name}} who is going through {{situation}}.', channel: 'in_app', variables: { name: 'string', situation: 'string' } }),
  ]
}

export function seedAnnouncements(): Announcement[] {
  return [
    buildAnnouncement({ id: 'ann-1', title: 'Church Cleaning Roster', body: 'Please check the cleaning roster for this month.', is_pinned: false }),
    buildAnnouncement({ id: 'ann-2', title: 'Important: Parking Lot Closure', body: 'The parking lot will be closed this Sunday for resurfacing.', is_pinned: true }),
    buildAnnouncement({ id: 'ann-3', title: 'Harvest Thanksgiving', body: 'Harvest thanksgiving service is on October 5th.', is_pinned: false }),
  ]
}

export function seedThreads(): { threads: MessageThread[]; participants: ThreadParticipant[]; messages: ThreadMessage[] } {
  const threads = [
    buildMessageThread({ id: 'thread-1', title: 'Pastoral Care: John Doe', thread_type: 'pastoral', is_sensitive: true, updated_at: pastDate(0) }),
    buildMessageThread({ id: 'thread-2', title: 'Music Team Discussion', thread_type: 'direct', updated_at: pastDate(1) }),
    buildMessageThread({ id: 'thread-3', title: 'Support Request: Baptism', thread_type: 'support', updated_at: pastDate(2) }),
  ]
  const participants = [
    buildThreadParticipant({ id: 'tpart-1', thread_id: 'thread-1', member_id: MEMBER_ID, last_read_at: pastDate(0) }),
    buildThreadParticipant({ id: 'tpart-2', thread_id: 'thread-2', member_id: MEMBER_ID, last_read_at: pastDate(1) }),
    buildThreadParticipant({ id: 'tpart-3', thread_id: 'thread-3', member_id: MEMBER_ID, last_read_at: pastDate(2) }),
  ]
  const messages = [
    buildThreadMessage({ id: 'tmsg-1', thread_id: 'thread-1', sender_id: MEMBER_ID, body: 'Hello pastor, I would like to request prayer.', created_at: pastDate(1) }),
    buildThreadMessage({ id: 'tmsg-2', thread_id: 'thread-1', sender_id: MEMBER_ID_2, body: 'Of course, I am praying for you. Let us meet this week.', created_at: pastDate(0) }),
    buildThreadMessage({ id: 'tmsg-3', thread_id: 'thread-2', sender_id: MEMBER_ID, body: 'Practice scheduled for Saturday at 4pm.', created_at: pastDate(2) }),
    buildThreadMessage({ id: 'tmsg-4', thread_id: 'thread-2', sender_id: MEMBER_ID_2, body: 'Confirmed, see you there.', created_at: pastDate(1) }),
    buildThreadMessage({ id: 'tmsg-5', thread_id: 'thread-3', sender_id: MEMBER_ID, body: 'I want to get baptized next month.', created_at: pastDate(2) }),
    buildThreadMessage({ id: 'tmsg-6', thread_id: 'thread-3', sender_id: MEMBER_ID_2, body: 'Great! Let me connect you with the baptism team.', created_at: pastDate(2) }),
  ]
  return { threads, participants, messages }
}

export {
  ASSEMBLY_ID,
  MEMBER_ID,
  MEMBER_ID_2,
  USER_ID,
}
