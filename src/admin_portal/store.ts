// src/admin_portal/store.ts
import { supabase } from '../core/supabase';
import { Tables } from '../types/database.types';
import { Session } from '@supabase/supabase-js';

// State definition
export let adminState = {
  activeTab: 'dashboard',
  searchQuery: '',
  memberStatusFilter: 'all', // all, active, inactive, visitor
  memberGenderFilter: 'all', // all, male, female
  enrollmentGroupId: null as string | null,
  enrollmentSearchQuery: ''
};

// Data stores (retaining MOCK_* naming to avoid breaking existing imports)
export let MOCK_MEMBERS: Tables<'members'>[] = [];
export let MOCK_GROUPS: Tables<'groups'>[] = [];
export let MOCK_GROUP_MEMBERS: Tables<'group_members'>[] = [];
export let MOCK_BROADCASTS: Tables<'broadcasts'>[] = [];
export let MOCK_USER_PROFILES: Tables<'user_profiles'>[] = [];
export let MOCK_MEMBER_PERMISSIONS: Tables<'member_permissions'>[] = [];
export let MOCK_AUDIT_LOGS: Tables<'member_audit_log'>[] = [];

// Compatibility exports for admin portal tabs that expect plain names.
// Use live binding aliases so tab imports stay in sync after data sync.
export { MOCK_MEMBERS as members };
export { MOCK_GROUPS as groups };
export { MOCK_GROUP_MEMBERS as groupMembers };
export { MOCK_BROADCASTS as broadcasts };
export { MOCK_USER_PROFILES as userProfiles };
export { MOCK_MEMBER_PERMISSIONS as memberPermissions };
export { MOCK_AUDIT_LOGS as auditLogs };

// Session reference
let currentSession: Session | null = null;

export function setSession(session: Session) {
  currentSession = session;
}

export function getSession() {
  return currentSession;
}

// State listeners
type Listener = () => void;
const listeners: Listener[] = [];

export function subscribeAdmin(listener: Listener) {
  listeners.push(listener);
}

export function notifyAdminStateChange() {
  listeners.forEach(l => l());
}

// Sync function to pull data from real db
export async function syncAdminData() {
  try {
    // 1. Fetch active members (where deleted_at is null)
    const { data: members, error: membersErr } = await supabase
      .from('members')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (membersErr) throw membersErr;
    MOCK_MEMBERS = members || [];

    // 2. Fetch groups
    const { data: groups, error: groupsErr } = await supabase
      .from('groups')
      .select('*')
      .order('name', { ascending: true });

    if (groupsErr) throw groupsErr;
    MOCK_GROUPS = groups || [];

    // 3. Fetch group members
    const { data: groupMembers, error: gmErr } = await supabase
      .from('group_members')
      .select('*');

    if (gmErr) throw gmErr;
    MOCK_GROUP_MEMBERS = groupMembers || [];

    // 4. Fetch broadcasts
    const { data: broadcasts, error: broadcastsErr } = await supabase
      .from('broadcasts')
      .select('*')
      .order('sent_at', { ascending: false });

    if (broadcastsErr) throw broadcastsErr;
    MOCK_BROADCASTS = broadcasts || [];

    // 5. Fetch user profiles
    const { data: userProfiles, error: upErr } = await supabase
      .from('user_profiles')
      .select('*')
      .order('full_name', { ascending: true });

    if (upErr) throw upErr;
    MOCK_USER_PROFILES = userProfiles || [];

    // 6. Fetch member permissions
    const { data: memberPerms, error: mpErr } = await supabase
      .from('member_permissions')
      .select('*');

    if (mpErr) throw mpErr;
    MOCK_MEMBER_PERMISSIONS = memberPerms || [];

    // 7. Fetch audit logs
    const { data: auditLogs, error: alErr } = await supabase
      .from('member_audit_log')
      .select('*')
      .order('changed_at', { ascending: false });

    if (alErr) throw alErr;
    MOCK_AUDIT_LOGS = auditLogs || [];

    // Notify listeners that data has updated
    notifyAdminStateChange();
  } catch (error) {
    console.error('Failed to sync admin portal data from database:', error);
  }
}
