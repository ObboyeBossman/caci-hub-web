import { supabase } from '@core/supabase'
import type { Campaign, CampaignMessage, Template, Announcement, MessageThread, ThreadMessage } from '../schemas'

const db = supabase as any

export class CommunicationService {
  // ── Campaigns ───────────────────────────────────────────────────────────────

  static async getCampaigns(assemblyId: string) {
    const { data, error } = await db
      .from('communication_campaigns')
      .select('*')
      .eq('assembly_id', assemblyId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as Campaign[]
  }

  static async getCampaign(id: string) {
    const { data, error } = await db
      .from('communication_campaigns')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data as Campaign
  }

  static async createCampaign(campaign: Partial<Campaign>) {
    const { data, error } = await db
      .from('communication_campaigns')
      .insert(campaign)
      .select()
      .single()

    if (error) throw error
    return data as Campaign
  }

  static async getCampaignMessages(campaignId: string) {
    const { data, error } = await db
      .from('communication_messages')
      .select('*')
      .eq('campaign_id', campaignId)

    if (error) throw error
    return data as CampaignMessage[]
  }

  static async getCampaignStats(campaignId: string) {
    const { data, error } = await db
      .from('communication_messages')
      .select('status')
      .eq('campaign_id', campaignId)

    if (error) throw error

    const stats = {
      total: data.length,
      sent: data.filter((m: any) => m.status === 'sent').length,
      delivered: data.filter((m: any) => m.status === 'delivered').length,
      read: data.filter((m: any) => m.status === 'read').length,
      failed: data.filter((m: any) => m.status === 'failed').length,
    }

    return stats
  }

  // ── Templates ───────────────────────────────────────────────────────────────

  static async getTemplates(assemblyId: string) {
    const { data, error } = await db
      .from('communication_templates')
      .select('*')
      .eq('assembly_id', assemblyId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('title', { ascending: true })

    if (error) throw error
    return data as Template[]
  }

  static async getTemplate(id: string) {
    const { data, error } = await db
      .from('communication_templates')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data as Template
  }

  static async createTemplate(template: Partial<Template>) {
    const { data, error } = await db
      .from('communication_templates')
      .insert(template)
      .select()
      .single()

    if (error) throw error
    return data as Template
  }

  static async updateTemplate(id: string, updates: Partial<Template>) {
    const { data, error } = await db
      .from('communication_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as Template
  }

  static async deleteTemplate(id: string) {
    const { error } = await db
      .from('communication_templates')
      .update({ is_active: false })
      .eq('id', id)

    if (error) throw error
  }

  // ── Announcements ───────────────────────────────────────────────────────────

  static async getAnnouncements(assemblyId: string) {
    const now = new Date().toISOString()
    const { data, error } = await db
      .from('announcement_posts')
      .select('*')
      .eq('assembly_id', assemblyId)
      .is('deleted_at', null)
      .lte('visible_from', now)
      .or(`visible_until.is.null,visible_until.gte.${now}`)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as Announcement[]
  }

  static async getAnnouncement(id: string) {
    const { data, error } = await db
      .from('announcement_posts')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data as Announcement
  }

  static async createAnnouncement(announcement: Partial<Announcement>) {
    const { data, error } = await db
      .from('announcement_posts')
      .insert(announcement)
      .select()
      .single()

    if (error) throw error
    return data as Announcement
  }

  static async updateAnnouncement(id: string, updates: Partial<Announcement>) {
    const { data, error } = await db
      .from('announcement_posts')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as Announcement
  }

  static async deleteAnnouncement(id: string) {
    const { error } = await db
      .from('announcement_posts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
  }

  // ── Message Threads ─────────────────────────────────────────────────────────

  static async getThreads(memberId: string) {
    const { data, error } = await db
      .from('communication_thread_participants')
      .select('thread:thread_id(*)')
      .eq('member_id', memberId)
      .is('thread.deleted_at', null)
      .order('thread.updated_at', { ascending: false })

    if (error) throw error
    return data.map((d: any) => d.thread) as MessageThread[]
  }

  static async getThreadMessages(threadId: string) {
    const { data, error } = await db
      .from('communication_thread_messages')
      .select('*')
      .eq('thread_id', threadId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data as ThreadMessage[]
  }

  // ── Permissions ─────────────────────────────────────────────────────────────

  static async canBroadcastAudio(): Promise<boolean> {
    const { data } = await db.rpc('auth_has_permission', {
      perm_key: 'communications.audio.broadcast'
    })
    return !!data
  }

  static async getAssemblyId(): Promise<string | null> {
    const { data } = await db.rpc('auth_assembly_id')
    return data as string | null
  }

  static async getMemberId(): Promise<string | null> {
    const { data } = await db.rpc('auth_member_id')
    return data as string | null
  }
}
