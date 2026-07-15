// src/members_portal/store.ts
import { supabase } from '../core/supabase';
import { Tables } from '../types/database.types';

export let MEMBER: Tables<'members'> = {
  full_name: 'Unknown Member',
  membership_number: 'PENDING'
} as any;

export let MEMBER_PERMISSIONS: Tables<'member_permissions'>[] = [];
export let GROUPS: (Tables<'groups'> & { role?: string })[] = [];
export let BROADCASTS: Tables<'broadcasts'>[] = [];
export let notifications: Tables<'notifications'>[] = [];

export const GROUP_DIRECTORY: Record<string, any> = {
  "g1": {
    leadership: [
      { name: "Elder James Owusu", title: "Youth President", role: "Leader", photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=100" },
      { name: "Deaconess Grace Appiah", title: "Patroness", role: "Leader", photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=100" }
    ],
    members: [
      { name: "Brother Emmanuel Boateng", title: "Member" },
      { name: "Sister Abigail Darko", title: "Youth Executive Secretary" },
      { name: "Brother Kojo Sarpong", title: "Member" }
    ]
  },
  "g2": {
    leadership: [
      { name: "Deaconess Grace Appiah", title: "Choir Director", role: "Leader", photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=100" }
    ],
    members: [
      { name: "Sister Comfort Osei", title: "Alto Lead" }
    ]
  },
  "g3": {
    leadership: [
      { name: "Elder Ebenezer Lartey", title: "Men's President", role: "Leader", photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=100" }
    ],
    members: [
      { name: "Brother Kwabena Asante", title: "Member" }
    ]
  }
};



export let mockChatMessages: Record<string, any[]> = {
  "g1": [
    { sender: "Elder James Owusu", sender_role: "Leader", body: "Shalom Youth! Remember we have our local district retreat this Friday.", time: "10:15 AM", is_self: false }
  ]
};

export let mockForumMessages = [
  { sender: "Elder James Owusu", title: "Assembly Secretary", body: "Blessings and shalom to the entire Adabraka Assembly body!", time: "08:30 AM", initials: "JO" }
];

export const FORUM_ACTIVE_USERS = [
  { name: "Elder James Owusu", title: "Assembly Secretary" }
];

export const BIBLE_VERSES = [
  { text: "The Lord will restore to you the years that the swarming locust has eaten.", ref: "Joel 2:25" }
];

export let globalState = {
  activeTab: 'inbox',
  searchQuery: '',
  statusFilter: 'all', // all, read, unread
  broadcastFilter: 'all', // all, assembly, group
  currentSelectedBroadcast: null as any,
  activeChatGroupId: null as string | null
};

// State observer
type Listener = () => void;
const listeners: Listener[] = [];

export function subscribe(listener: Listener) {
  listeners.push(listener);
}

export function notifyStateChange() {
  listeners.forEach(l => l());
}

export async function syncMemberData(authUserId: string) {
  console.log('[store] Syncing member data for:', authUserId);
  try {
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (memberError) {
      console.error('[store] Error fetching member record:', memberError);
      throw new Error(`Sync Error: ${memberError.message} (Code: ${memberError.code})`);
    }

    if (!memberData) {
      console.warn('[store] No member record linked to auth user:', authUserId);
      throw new Error('Member record not found: Your account exists but is not yet linked to a member profile. Please contact your Assembly Admin.');
    }

    MEMBER = memberData;
    console.log('[store] Member found:', memberData.full_name);

    const { data: perms } = await supabase.from('member_permissions').select('*').eq('member_id', memberData.id);
    MEMBER_PERMISSIONS = perms || [];

    const { data: gm } = await supabase.from('group_members').select('group_id').eq('member_id', memberData.id);
    if (gm && gm.length > 0) {
      const groupIds = gm.map((g: any) => g.group_id);
      const { data: groups } = await supabase.from('groups').select('*').in('id', groupIds);
      GROUPS = groups || [];
    } else {
      GROUPS = [];
    }

    const { data: broadcasts } = await supabase.from('broadcasts').select('*').order('sent_at', { ascending: false });
    if (broadcasts) {
      const groupIds = GROUPS.map(g => g.id);
      BROADCASTS = broadcasts.filter((b: any) => 
        b.targeting_mode === 'assembly' || 
        (b.targeting_mode === 'group' && groupIds.includes(b.target_group_id as string)) ||
        b.targeting_mode === 'members'
      );
    } else {
      BROADCASTS = [];
    }

    const { data: notifs } = await supabase.from('notifications').select('*').eq('member_id', memberData.id).order('created_at', { ascending: false });
    notifications = notifs || [];

    
    const { data: sermons } = await supabase.from('sermons').select('*').order('date', { ascending: false });
    SERMONS = sermons || [];

    notifyStateChange();
  } catch (error) {
    console.error("[store] syncMemberData failed:", error);
    throw error; // Re-throw so the UI can handle it
  }
}

export let SERMONS: any[] = [];
export { SERMONS as sermons };
