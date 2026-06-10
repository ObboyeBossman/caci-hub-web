import { supabase } from '@/lib/supabase'
import type { Campaign, CampaignMessage } from '../schemas'

export class CommunicationService {
  /**
   * Fetch campaigns for the current user's assembly
   */
  static async getCampaigns(assemblyId: string) {
    const { data, error } = await supabase
      .from('communication_campaigns')
      .select('*')
      .eq('assembly_id', assemblyId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as Campaign[]
  }

  /**
   * Fetch campaign messages
   */
  static async getCampaignMessages(campaignId: string) {
    const { data, error } = await supabase
      .from('communication_messages')
      .select('*')
      .eq('campaign_id', campaignId)

    if (error) throw error
    return data as CampaignMessage[]
  }

  /**
   * Get campaign statistics
   */
  static async getCampaignStats(campaignId: string) {
    const { data, error } = await supabase
      .from('communication_messages')
      .select('status')
      .eq('campaign_id', campaignId)

    if (error) throw error

    const stats = {
      total: data.length,
      sent: data.filter(m => m.status === 'sent').length,
      delivered: data.filter(m => m.status === 'delivered').length,
      read: data.filter(m => m.status === 'read').length,
      failed: data.filter(m => m.status === 'failed').length
    }

    return stats
  }

  /**
   * Check if current user can broadcast audio
   */
  static async canBroadcastAudio(): Promise<boolean> {
    const { data } = await supabase.rpc('auth_has_permission', {
      perm_key: 'communications.audio.broadcast'
    })
    return !!data
  }

  /**
   * Get user's assembly ID
   */
  static async getAssemblyId(): Promise<string | null> {
    const { data } = await supabase.rpc('auth_assembly_id')
    return data
  }

  /**
   * Get user's member ID
   */
  static async getMemberId(): Promise<string | null> {
    const { data } = await supabase.rpc('auth_member_id')
    return data
  }
}
