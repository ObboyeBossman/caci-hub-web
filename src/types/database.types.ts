// AUTO-GENERATED — DO NOT EDIT MANUALLY
// Regenerate after every migration:
//   npm run gen:types
//
// This file is hand-scaffolded from the 40 Flutter migrations.
// Run `npm run gen:types` to replace it with the full Supabase-generated version.
// Until then, this scaffold provides the minimal shape needed for Phase 0–1.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ── Enums — from migration 20260427000001_create_enums.sql ──────────────────
// user_role: Phase 1 active + future placeholders
// membership_status, gender_type, marital_status_type

export type UserRoleEnum =
  | 'admin'
  | 'pastor'
  | 'secretary'
  | 'volunteer'
  | 'member'
  | 'finance_officer'
  | 'welfare_officer'
  | 'cell_leader'
  | 'elder'
  | 'children_worker'
  | 'media_officer'
  | 'district_overseer'
  | 'national_admin'

export type MembershipStatusEnum =
  | 'active'
  | 'inactive'
  | 'visitor'
  | 'prospect'
  | 'transfer'
  | 'deceased'

export type GenderTypeEnum = 'male' | 'female'

export type MaritalStatusTypeEnum =
  | 'single'
  | 'married'
  | 'widowed'
  | 'divorced'
  | 'separated'

export interface Database {
  public: {
    Tables: {
      // ── assemblies — migration 20260427000002 ────────────────────────────
      assemblies: {
        Row: {
          id:              string
          name:            string
          assembly_code:   string   // format: [A-Z]{2}-[A-Z]{3,6} e.g. GH-ASSAK
          address:         string | null
          default_member_password: string | null
          is_active:       boolean
          created_at:      string
          updated_at:      string
        }
        Insert: {
          id?:             string
          name:            string
          assembly_code:   string
          address?:        string | null
          digital_address?: string | null
          default_member_password?: string | null
          is_active?:      boolean
          created_at?:     string
          updated_at?:     string
        }
        Update: Partial<Database['public']['Tables']['assemblies']['Insert']>
      }

      // ── user_profiles — migration 20260427000003 + 20260526000004 ──────────
      user_profiles: {
        Row: {
          id:          string   // mirrors auth.users.id — not standalone UUID
          assembly_id: string
          role:        UserRoleEnum
          role_id:     string | null  // FK → assembly_roles.id (custom role)
          full_name:   string
          is_active:   boolean
          must_change_password: boolean
          created_at:  string
          updated_at:  string
        }
        Insert: {
          id:          string
          assembly_id: string
          role?:       UserRoleEnum  // default: 'member'
          role_id?:    string | null
          full_name:   string
          is_active?:  boolean
          must_change_password?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>
      }

      // ── permissions — migration 20260526000004 ────────────────────────────
      permissions: {
        Row: {
          id:          string   // e.g. 'member:invite'
          description: string | null
        }
        Insert: {
          id:          string
          description?: string | null
        }
        Update: Partial<Database['public']['Tables']['permissions']['Insert']>
      }

      // ── assembly_roles — migration 20260526000004 ─────────────────────────
      assembly_roles: {
        Row: {
          id:          string
          assembly_id: string
          name:        string
          description: string | null
          created_at:  string
          updated_at:  string
        }
        Insert: {
          id?:         string
          assembly_id: string
          name:        string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['assembly_roles']['Insert']>
      }

      // ── role_permissions — migration 20260526000004 ───────────────────────
      role_permissions: {
        Row: {
          role_id:       string
          permission_id: string
        }
        Insert: {
          role_id:       string
          permission_id: string
        }
        Update: Partial<Database['public']['Tables']['role_permissions']['Insert']>
      }

      // ── households — migration 20260427000004 ────────────────────────────
      // Note: family_name is the column name (not 'name') — per migration SQL
      households: {
        Row: {
          id:                 string
          assembly_id:        string
          family_name:        string   // display name e.g. "Asante Family"
          address:            string | null
          primary_contact_id: string | null  // FK to members.id (deferrable, added migration 7)
          created_at:         string
          updated_at:         string
        }
        Insert: {
          id?:                string
          assembly_id:        string
          family_name:        string
          address?:           string | null
          primary_contact_id?: string | null
          created_at?:        string
          updated_at?:        string
        }
        Update: Partial<Database['public']['Tables']['households']['Insert']>
      }

      // ── members — migration 20260427000005 ───────────────────────────────
      members: {
        Row: {
          id:                             string
          assembly_id:                    string
          membership_number:              string | null  // NULL at insert; set by EF
          first_name:                     string
          last_name:                      string
          date_of_birth:                  string | null
          gender:                         GenderTypeEnum
          marital_status:                 MaritalStatusTypeEnum | null
          phone_number:                   string | null
          email:                          string | null
          physical_address:               string | null
          occupation:                     string | null
          facebook_url:                   string | null
          whatsapp_number:                string | null
          instagram_url:                  string | null
          emergency_contact_name:         string | null
          emergency_contact_phone:        string | null
          emergency_contact_relationship: string | null
          membership_status:              MembershipStatusEnum  // default: 'visitor'
          join_date:                      string | null
          household_id:                   string | null
          profile_photo_url:              string | null
          pastoral_notes:                 string | null
          is_active:                      boolean
          deleted_at:                     string | null
          created_by:                     string | null
          created_at:                     string
          updated_at:                     string
          auth_user_id:                   string | null  // migration 20260502100000
        }
        Insert: {
          id?:                            string
          assembly_id:                    string
          membership_number?:             string | null
          first_name:                     string
          last_name:                      string
          date_of_birth?:                 string | null
          gender:                         GenderTypeEnum
          marital_status?:                MaritalStatusTypeEnum | null
          phone_number?:                  string | null
          email?:                         string | null
          physical_address?:              string | null
          occupation?:                    string | null
          facebook_url?:                  string | null
          whatsapp_number?:               string | null
          instagram_url?:                 string | null
          emergency_contact_name?:        string | null
          emergency_contact_phone?:       string | null
          emergency_contact_relationship?: string | null
          membership_status?:             MembershipStatusEnum
          join_date?:                     string | null
          household_id?:                  string | null
          profile_photo_url?:             string | null
          pastoral_notes?:                string | null
          is_active?:                     boolean
          deleted_at?:                    string | null
          created_by?:                    string | null
          created_at?:                    string
          updated_at?:                    string
          auth_user_id?:                  string | null
        }
        Update: Partial<Database['public']['Tables']['members']['Insert']>
      }

      // ── member_audit_log — migration 20260427000006 ──────────────────────
      member_audit_log: {
        Row: {
          id:            string
          member_id:     string
          assembly_id:   string
          changed_by:    string | null
          field_changed: string
          old_value:     string | null
          new_value:     string | null
          changed_at:    string
        }
        Insert: {
          id?:           string
          member_id:     string
          assembly_id:   string
          changed_by?:   string | null
          field_changed: string
          old_value?:    string | null
          new_value?:    string | null
          changed_at?:   string
        }
        Update: Partial<Database['public']['Tables']['member_audit_log']['Insert']>
      }
    }

    Views: {
      // ── members_view — migration 20260427000016 + 20260502100000 ─────────
      // security_barrier view with column-level masking:
      //   emergency_contact_* → NULL for 'volunteer'
      //   pastoral_notes      → NULL for 'secretary', 'volunteer', 'member'
      // Row-level filtering is handled by RLS on the members table.
      // ALL application reads must use this view, never the raw table.
      members_view: {
        Row: {
          id:                             string
          assembly_id:                    string
          membership_number:              string | null
          first_name:                     string
          last_name:                      string
          date_of_birth:                  string | null
          gender:                         GenderTypeEnum
          marital_status:                 MaritalStatusTypeEnum | null
          phone_number:                   string | null
          email:                          string | null
          physical_address:               string | null
          occupation:                     string | null
          facebook_url:                   string | null
          whatsapp_number:                string | null
          instagram_url:                  string | null
          // NULL for 'volunteer' role (column-level masking)
          emergency_contact_name:         string | null
          emergency_contact_phone:        string | null
          emergency_contact_relationship: string | null
          membership_status:              MembershipStatusEnum
          join_date:                      string | null
          household_id:                   string | null
          profile_photo_url:              string | null
          // NULL for 'secretary', 'volunteer', 'member' (IMR-03)
          pastoral_notes:                 string | null
          is_active:                      boolean
          deleted_at:                     string | null
          created_by:                     string | null
          created_at:                     string
          updated_at:                     string
          auth_user_id:                   string | null
        }
      }
    }

    Functions: {
      // ── RLS Helper Functions — migration 20260427000003 ──────────────────
      // SECURITY DEFINER functions — bypass user_profiles RLS during lookup
      get_user_role:         { Args: Record<never, never>; Returns: UserRoleEnum | null }
      get_user_assembly_id:  { Args: Record<never, never>; Returns: string | null }
      is_admin:              { Args: Record<never, never>; Returns: boolean }
      is_admin_or_pastor:    { Args: Record<never, never>; Returns: boolean }
      is_admin_or_secretary: { Args: Record<never, never>; Returns: boolean }
      can_read_directory:    { Args: Record<never, never>; Returns: boolean }
    }

    Enums: {
      user_role:           UserRoleEnum
      membership_status:   MembershipStatusEnum
      gender_type:         GenderTypeEnum
      marital_status_type: MaritalStatusTypeEnum
    }

    CompositeTypes: {
      [_ in never]: never
    }
  }
}
