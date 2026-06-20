// Communication campaign types
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'
export type CampaignAudienceType = 'assembly' | 'group' | 'member_list' | 'filter'

export interface Campaign {
  id: string
  assembly_id: string
  template_id: string | null
  attachment_id: string | null
  title: string
  body: string | null
  status: CampaignStatus
  channel: 'in_app' | 'email' | 'sms' | 'push' | 'audio' | 'video' | 'document' | 'image'
  audience_type: CampaignAudienceType
  audience_ids: string[] | null
  scheduled_for: string | null
  total_recipients: number
  created_by: string
  created_at: string
  updated_at: string
  deleted_at?: string
  deleted_by?: string
  attachment?: {
    media_category?: string;
  } | null;
}

export interface CampaignMessage {
  id: string
  campaign_id: string
  recipient_id: string
  status: 'pending' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
  rendered_body: string
  provider: string
  external_ref: string | null
  delivered_at: string | null
  read_at: string | null
  failed_reason: string | null
  created_at: string
}

// Communication template types
export interface Template {
  id: string
  assembly_id: string
  title: string
  body: string
  variables: Record<string, any>
  channel: 'in_app' | 'email' | 'sms' | 'push'
  category: string
  whatsapp_template_name?: string
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
  deleted_at?: string
}

// Direct message thread types
export interface MessageThread {
  id: string
  assembly_id: string
  thread_type: 'direct' | 'pastoral' | 'support'
  title: string
  is_sensitive: boolean
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ThreadParticipant {
  id: string
  thread_id: string
  member_id: string
  last_read_at: string | null
  joined_at: string
}

export interface ThreadMessage {
  id: string
  thread_id: string
  sender_id: string
  body: string | null
  attachment_id: string | null
  message_type: 'text' | 'audio' | 'image' | 'video' | 'document'
  created_at: string
  deleted_at: string | null
  deleted_by: string | null
}

// Attachment types
export type AttachmentMediaCategory = 'audio' | 'video' | 'image' | 'document' | 'other'

export interface Attachment {
  id: string
  assembly_id: string
  campaign_id: string | null
  thread_message_id: string | null
  media_category: AttachmentMediaCategory
  storage_tier: 'hot' | 'warm' | 'cold'
  storage_provider: 'supabase' | 'r2'
  storage_bucket: string
  storage_path: string
  public_url: string | null
  mime_type: string
  file_size_bytes: number
  original_filename: string | null
  checksum: string | null
  duration_seconds: number | null
  waveform_data: number[] | null
  transcription_text: string | null
  is_sensitive: boolean
  virus_scan_status: 'pending' | 'clean' | 'infected' | 'skipped'
  transcription_status: 'pending' | 'processing' | 'done' | 'failed' | 'skipped'
  uploaded_by: string
  archive_after: string | null
  purge_after: string | null
  archived_at: string | null
  created_at: string
  deleted_at: string | null
  deleted_by: string | null
}

// Announcement types
export interface Announcement {
  id: string
  assembly_id: string
  title: string
  body: string
  target_group_ids: string[]
  is_pinned: boolean
  visible_from: string
  visible_until?: string
  posted_by?: string
  created_at: string
  updated_at: string
  deleted_at?: string
  deleted_by?: string
}

// Communication preference types
export interface CommunicationPreference {
  id: string
  member_id: string
  channel: 'email' | 'sms' | 'push' | 'in_app'
  opt_out: boolean
  category: string | null
  updated_at: string
}

// Preference category types
export const PREFERENCE_CATEGORIES = {
  ANNOUNCEMENTS: 'announcements',
  CAMPAIGNS: 'campaigns',
  REMINDERS: 'reminders',
  PASTORAL: 'pastoral',
  EVENTS: 'events',
  FINANCE: 'finance'
} as const

export type PreferenceCategory = (typeof PREFERENCE_CATEGORIES)[keyof typeof PREFERENCE_CATEGORIES]
