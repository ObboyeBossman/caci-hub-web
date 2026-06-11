import type {
  Campaign,
  CampaignMessage,
  Template,
  Announcement,
  MessageThread,
  ThreadMessage,
  Attachment,
} from '../schemas'
import type { AudioBroadcastPayload } from '../schemas/audio'
import {
  seedCampaigns,
  seedTemplates,
  seedAnnouncements,
  seedThreads,
  buildCampaign,
  buildCampaignMessage,
  buildTemplate,
  buildAnnouncement,
  buildAttachment,
} from './mockData'

type CampaignStats = {
  total: number
  sent: number
  delivered: number
  read: number
  failed: number
}

class MockStore {
  campaigns: Campaign[] = []
  campaignMessages: CampaignMessage[] = []
  templates: Template[] = []
  announcements: Announcement[] = []
  threads: MessageThread[] = []
  threadParticipants: { id: string; thread_id: string; member_id: string; last_read_at: string | null; joined_at: string }[] = []
  threadMessages: ThreadMessage[] = []
  attachments: Attachment[] = []
  canBroadcastAudio = true
  assemblyId: string | null = 'test-assembly-001'
  memberId: string | null = 'test-member-001'
}

const store = new MockStore()

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export class MockCommunicationService {
  static reset(): void {
    store.campaigns = []
    store.campaignMessages = []
    store.templates = []
    store.announcements = []
    store.threads = []
    store.threadParticipants = []
    store.threadMessages = []
    store.attachments = []
    store.canBroadcastAudio = true
    store.assemblyId = 'test-assembly-001'
    store.memberId = 'test-member-001'
  }

  static seedDefaults(): void {
    store.campaigns = seedCampaigns()
    store.templates = seedTemplates()
    store.announcements = seedAnnouncements()
    const { threads, participants, messages } = seedThreads()
    store.threads = threads
    store.threadParticipants = participants
    store.threadMessages = messages
  }

  static setAssemblyId(id: string | null): void {
    store.assemblyId = id
  }

  static setMemberId(id: string | null): void {
    store.memberId = id
  }

  static setCanBroadcastAudio(value: boolean): void {
    store.canBroadcastAudio = value
  }

  static getAllCampaigns(): Campaign[] {
    return clone(store.campaigns)
  }

  static getAllTemplates(): Template[] {
    return clone(store.templates)
  }

  static getAllAnnouncements(): Announcement[] {
    return clone(store.announcements)
  }

  static getAllThreadMessages(): ThreadMessage[] {
    return clone(store.threadMessages)
  }

  // ── Campaigns ───────────────────────────────────────────────────────────────

  static async getCampaigns(_assemblyId: string): Promise<Campaign[]> {
    return clone(store.campaigns.filter(c => c.assembly_id === _assemblyId))
  }

  static async getCampaign(id: string): Promise<Campaign> {
    const c = store.campaigns.find(c => c.id === id)
    if (!c) throw new Error(`Campaign not found: ${id}`)
    return clone(c)
  }

  static async createCampaign(campaign: Partial<Campaign>): Promise<Campaign> {
    const now = new Date().toISOString()
    const created = buildCampaign({
      ...campaign,
      id: campaign.id || undefined,
      created_at: now,
      updated_at: now,
    })
    store.campaigns.push(created)
    return clone(created)
  }

  static async getCampaignMessages(campaignId: string): Promise<CampaignMessage[]> {
    return clone(store.campaignMessages.filter(m => m.campaign_id === campaignId))
  }

  static async getCampaignStats(campaignId: string): Promise<CampaignStats> {
    const msgs = store.campaignMessages.filter(m => m.campaign_id === campaignId)
    return {
      total: msgs.length,
      sent: msgs.filter(m => m.status === 'sent').length,
      delivered: msgs.filter(m => m.status === 'delivered').length,
      read: msgs.filter(m => m.status === 'read').length,
      failed: msgs.filter(m => m.status === 'failed').length,
    }
  }

  // ── Templates ───────────────────────────────────────────────────────────────

  static async getTemplates(assemblyId: string): Promise<Template[]> {
    return clone(store.templates.filter(t => t.assembly_id === assemblyId && t.is_active))
  }

  static async getTemplate(id: string): Promise<Template> {
    const t = store.templates.find(t => t.id === id)
    if (!t) throw new Error(`Template not found: ${id}`)
    return clone(t)
  }

  static async createTemplate(template: Partial<Template>): Promise<Template> {
    const now = new Date().toISOString()
    const created = buildTemplate({
      ...template,
      id: template.id || undefined,
      is_active: template.is_active ?? true,
      created_at: now,
      updated_at: now,
    })
    store.templates.push(created)
    return clone(created)
  }

  static async updateTemplate(id: string, updates: Partial<Template>): Promise<Template> {
    const idx = store.templates.findIndex(t => t.id === id)
    if (idx === -1) throw new Error(`Template not found: ${id}`)
    store.templates[idx] = { ...store.templates[idx], ...updates, updated_at: new Date().toISOString() }
    return clone(store.templates[idx])
  }

  static async deleteTemplate(id: string): Promise<void> {
    const idx = store.templates.findIndex(t => t.id === id)
    if (idx === -1) throw new Error(`Template not found: ${id}`)
    store.templates[idx].is_active = false
  }

  // ── Announcements ───────────────────────────────────────────────────────────

  static async getAnnouncements(assemblyId: string): Promise<Announcement[]> {
    const now = new Date().toISOString()
    return clone(store.announcements.filter(a =>
      a.assembly_id === assemblyId &&
      !a.deleted_at &&
      a.visible_from <= now &&
      a.visible_until >= now
    ))
  }

  static async getAnnouncement(id: string): Promise<Announcement> {
    const a = store.announcements.find(a => a.id === id)
    if (!a) throw new Error(`Announcement not found: ${id}`)
    return clone(a)
  }

  static async createAnnouncement(announcement: Partial<Announcement>): Promise<Announcement> {
    const now = new Date().toISOString()
    const created = buildAnnouncement({
      ...announcement,
      id: announcement.id || undefined,
      created_at: now,
      updated_at: now,
    })
    store.announcements.push(created)
    return clone(created)
  }

  static async updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<Announcement> {
    const idx = store.announcements.findIndex(a => a.id === id)
    if (idx === -1) throw new Error(`Announcement not found: ${id}`)
    store.announcements[idx] = { ...store.announcements[idx], ...updates, updated_at: new Date().toISOString() }
    return clone(store.announcements[idx])
  }

  static async deleteAnnouncement(id: string): Promise<void> {
    const idx = store.announcements.findIndex(a => a.id === id)
    if (idx === -1) throw new Error(`Announcement not found: ${id}`)
    store.announcements[idx].deleted_at = new Date().toISOString()
  }

  // ── Message Threads ─────────────────────────────────────────────────────────

  static async getThreads(memberId: string): Promise<MessageThread[]> {
    const participantThreadIds = store.threadParticipants
      .filter(p => p.member_id === memberId)
      .map(p => p.thread_id)
    return clone(
      store.threads
        .filter(t => participantThreadIds.includes(t.id) && !t.deleted_at)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    )
  }

  static async getThreadMessages(threadId: string): Promise<ThreadMessage[]> {
    return clone(
      store.threadMessages
        .filter(m => m.thread_id === threadId && !m.deleted_at)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    )
  }

  // ── Permissions ─────────────────────────────────────────────────────────────

  static async canBroadcastAudio(): Promise<boolean> {
    return store.canBroadcastAudio
  }

  static async getAssemblyId(): Promise<string | null> {
    return store.assemblyId
  }

  static async getMemberId(): Promise<string | null> {
    return store.memberId
  }
}

export class MockAudioService {
  static reset(): void {
    store.attachments = []
  }

  static getAllAttachments(): Attachment[] {
    return clone(store.attachments)
  }

  static async registerAttachment(payload: AudioBroadcastPayload): Promise<string> {
    const now = new Date().toISOString()
    const attachment = buildAttachment({
      id: undefined,
      assembly_id: payload.assembly_id,
      campaign_id: payload.campaign_id ?? null,
      thread_message_id: payload.thread_message_id ?? null,
      storage_bucket: payload.storage_bucket,
      storage_path: payload.storage_path,
      mime_type: payload.mime_type,
      file_size_bytes: payload.file_size_bytes,
      checksum: payload.checksum,
      duration_seconds: payload.duration_seconds,
      waveform_data: payload.waveform_data,
      is_sensitive: payload.is_sensitive,
      created_at: now,
    })
    store.attachments.push(attachment)
    return attachment.id
  }

  static async getAttachment(attachmentId: string): Promise<Attachment> {
    const a = store.attachments.find(a => a.id === attachmentId)
    if (!a) throw new Error(`Attachment not found: ${attachmentId}`)
    return clone(a)
  }

  static async deleteAttachment(attachmentId: string): Promise<void> {
    const idx = store.attachments.findIndex(a => a.id === attachmentId)
    if (idx === -1) throw new Error(`Attachment not found: ${attachmentId}`)
    store.attachments[idx].deleted_at = new Date().toISOString()
  }
}
