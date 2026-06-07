export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      assemblies: {
        Row: {
          address: string | null
          assembly_code: string
          created_at: string
          default_member_password: string | null
          digital_address: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          assembly_code: string
          created_at?: string
          default_member_password?: string | null
          digital_address?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          assembly_code?: string
          created_at?: string
          default_member_password?: string | null
          digital_address?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      assembly_roles: {
        Row: {
          assembly_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          assembly_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          assembly_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assembly_roles_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          address: string | null
          assembly_id: string
          created_at: string
          family_name: string
          id: string
          primary_contact_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          assembly_id: string
          created_at?: string
          family_name: string
          id?: string
          primary_contact_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          assembly_id?: string
          created_at?: string
          family_name?: string
          id?: string
          primary_contact_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_households_primary_contact"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_households_primary_contact"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "members_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "households_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
        ]
      }
      member_audit_log: {
        Row: {
          assembly_id: string
          changed_at: string
          changed_by: string | null
          field_changed: string
          id: string
          member_id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          assembly_id: string
          changed_at?: string
          changed_by?: string | null
          field_changed: string
          id?: string
          member_id: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          assembly_id?: string
          changed_at?: string
          changed_by?: string | null
          field_changed?: string
          id?: string
          member_id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_audit_log_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_audit_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_audit_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_view"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          assembly_id: string
          auth_user_id: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          deleted_at: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          facebook_url: string | null
          first_name: string
          gender: Database["public"]["Enums"]["gender_type"]
          household_id: string | null
          id: string
          instagram_url: string | null
          is_active: boolean
          join_date: string | null
          last_name: string
          marital_status:
            | Database["public"]["Enums"]["marital_status_type"]
            | null
          membership_number: string | null
          membership_status: Database["public"]["Enums"]["membership_status"]
          occupation: string | null
          other_names: string | null
          pastoral_notes: string | null
          physical_address: string | null
          primary_phone: string | null
          profile_photo_url: string | null
          secondary_phone: string | null
          title: string | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          assembly_id: string
          auth_user_id?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          facebook_url?: string | null
          first_name: string
          gender: Database["public"]["Enums"]["gender_type"]
          household_id?: string | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean
          join_date?: string | null
          last_name: string
          marital_status?:
            | Database["public"]["Enums"]["marital_status_type"]
            | null
          membership_number?: string | null
          membership_status?: Database["public"]["Enums"]["membership_status"]
          occupation?: string | null
          other_names?: string | null
          pastoral_notes?: string | null
          physical_address?: string | null
          primary_phone?: string | null
          profile_photo_url?: string | null
          secondary_phone?: string | null
          title?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          assembly_id?: string
          auth_user_id?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          facebook_url?: string | null
          first_name?: string
          gender?: Database["public"]["Enums"]["gender_type"]
          household_id?: string | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean
          join_date?: string | null
          last_name?: string
          marital_status?:
            | Database["public"]["Enums"]["marital_status_type"]
            | null
          membership_number?: string | null
          membership_status?: Database["public"]["Enums"]["membership_status"]
          occupation?: string | null
          other_names?: string | null
          pastoral_notes?: string | null
          physical_address?: string | null
          primary_phone?: string | null
          profile_photo_url?: string | null
          secondary_phone?: string | null
          title?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          description: string | null
          id: string
        }
        Insert: {
          description?: string | null
          id: string
        }
        Update: {
          description?: string | null
          id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "assembly_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          assembly_id: string
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          must_change_password: boolean
          role: Database["public"]["Enums"]["user_role"]
          role_id: string | null
          updated_at: string
        }
        Insert: {
          assembly_id: string
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          must_change_password?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          role_id?: string | null
          updated_at?: string
        }
        Update: {
          assembly_id?: string
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          must_change_password?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          role_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "assembly_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_audit_log: {
        Row: {
          changed_at:    string
          changed_by:    string | null
          field_changed: string
          id:            string
          new_value:     string | null
          old_value:     string | null
          service_id:    string
        }
        Insert: {
          changed_at?:    string
          changed_by?:    string | null
          field_changed:  string
          id?:            string
          new_value?:     string | null
          old_value?:     string | null
          service_id:     string
        }
        Update: {
          changed_at?:    string
          changed_by?:    string | null
          field_changed?: string
          id?:            string
          new_value?:     string | null
          old_value?:     string | null
          service_id?:    string
        }
        Relationships: [
          {
            foreignKeyName: "service_audit_log_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_attendance: {
        Row: {
          deleted_at:  string | null
          deleted_by:  string | null
          id:          string
          marked_at:   string
          marked_by:   string | null
          member_id:   string
          notes:       string | null
          service_id:  string
          status:      Database['public']['Enums']['attendance_status']
        }
        Insert: {
          deleted_at?: string | null
          deleted_by?: string | null
          id?:         string
          marked_at?:  string
          marked_by?:  string | null
          member_id:   string
          notes?:      string | null
          service_id:  string
          status?:     Database['public']['Enums']['attendance_status']
        }
        Update: {
          deleted_at?: string | null
          deleted_by?: string | null
          id?:         string
          marked_at?:  string
          marked_by?:  string | null
          member_id?:  string
          notes?:      string | null
          service_id?: string
          status?:     Database['public']['Enums']['attendance_status']
        }
        Relationships: [
          {
            foreignKeyName: "service_attendance_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      service_templates: {
        Row: {
          assembly_id:          string
          created_at:           string
          created_by:           string | null
          day_of_week:          string | null
          deleted_at:           string | null
          deleted_by:           string | null
          group_id:             string | null
          id:                   string
          is_active:            boolean
          recurrence:           Database['public']['Enums']['recurrence_type']
          recurrence_end_date:  string | null
          service_type:         string
          start_time:           string | null
          title:                string
          venue:                string | null
        }
        Insert: {
          assembly_id:           string
          created_at?:           string
          created_by?:           string | null
          day_of_week?:          string | null
          deleted_at?:           string | null
          deleted_by?:           string | null
          group_id?:             string | null
          id?:                   string
          is_active?:            boolean
          recurrence?:           Database['public']['Enums']['recurrence_type']
          recurrence_end_date?:  string | null
          service_type:          string
          start_time?:           string | null
          title:                 string
          venue?:                string | null
        }
        Update: {
          assembly_id?:          string
          created_at?:           string
          created_by?:           string | null
          day_of_week?:          string | null
          deleted_at?:           string | null
          deleted_by?:           string | null
          group_id?:             string | null
          id?:                   string
          is_active?:            boolean
          recurrence?:           Database['public']['Enums']['recurrence_type']
          recurrence_end_date?:  string | null
          service_type?:         string
          start_time?:           string | null
          title?:                string
          venue?:                string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_templates_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          assembly_id:  string
          created_at:   string
          created_by:   string | null
          deleted_at:   string | null
          deleted_by:   string | null
          group_id:     string | null
          headcount:    number | null
          id:           string
          notes:        string | null
          service_date: string
          service_type: string
          start_time:   string | null
          status:       Database['public']['Enums']['service_status']
          template_id:  string | null
          title:        string
          venue:        string | null
        }
        Insert: {
          assembly_id:   string
          created_at?:   string
          created_by?:   string | null
          deleted_at?:   string | null
          deleted_by?:   string | null
          group_id?:     string | null
          headcount?:    number | null
          id?:           string
          notes?:        string | null
          service_date:  string
          service_type:  string
          start_time?:   string | null
          status?:       Database['public']['Enums']['service_status']
          template_id?:  string | null
          title:         string
          venue?:        string | null
        }
        Update: {
          assembly_id?:  string
          created_at?:   string
          created_by?:   string | null
          deleted_at?:   string | null
          deleted_by?:   string | null
          group_id?:     string | null
          headcount?:    number | null
          id?:           string
          notes?:        string | null
          service_date?: string
          service_type?: string
          start_time?:   string | null
          status?:       Database['public']['Enums']['service_status']
          template_id?:  string | null
          title?:        string
          venue?:        string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "service_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          id:          string
          group_id:    string
          member_id:   string
          role:        Database['public']['Enums']['group_member_role']
          joined_at:   string
          left_at:     string | null
          is_active:   boolean
          created_by:  string | null
          created_at:  string
          deleted_at:  string | null
          deleted_by:  string | null
        }
        Insert: {
          id?:         string
          group_id:    string
          member_id:   string
          role?:       Database['public']['Enums']['group_member_role']
          joined_at?:  string
          left_at?:    string | null
          is_active?:  boolean
          created_by?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
        }
        Update: {
          id?:         string
          group_id?:   string
          member_id?:  string
          role?:       Database['public']['Enums']['group_member_role']
          joined_at?:  string
          left_at?:    string | null
          is_active?:  boolean
          created_by?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          id:           string
          assembly_id:  string
          name:         string
          group_type:   Database['public']['Enums']['group_type']
          description:  string | null
          is_active:    boolean
          leader_id:    string | null
          created_by:   string | null
          created_at:   string
          deleted_at:   string | null
          deleted_by:   string | null
        }
        Insert: {
          id?:          string
          assembly_id:  string
          name:         string
          group_type:   Database['public']['Enums']['group_type']
          description?: string | null
          is_active?:   boolean
          leader_id?:   string | null
          created_by?:  string | null
          created_at?:  string
          deleted_at?:  string | null
          deleted_by?:  string | null
        }
        Update: {
          id?:          string
          assembly_id?: string
          name?:        string
          group_type?:  Database['public']['Enums']['group_type']
          description?: string | null
          is_active?:   boolean
          leader_id?:   string | null
          created_by?:  string | null
          created_at?:  string
          deleted_at?:  string | null
          deleted_by?:  string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      pastoral_cases: {
        Row: {
          id:           string
          assembly_id:  string
          member_id:    string
          case_type:    Database['public']['Enums']['pastoral_case_type']
          title:        string
          description:  string | null
          priority:     Database['public']['Enums']['pastoral_priority']
          status:       Database['public']['Enums']['pastoral_case_status']
          assigned_to:  string | null
          is_private:   boolean
          created_by:   string | null
          created_at:   string
          resolved_at:  string | null
          deleted_at:   string | null
          deleted_by:   string | null
        }
        Insert: {
          id?:          string
          assembly_id:  string
          member_id:    string
          case_type:    Database['public']['Enums']['pastoral_case_type']
          title:        string
          description?: string | null
          priority?:    Database['public']['Enums']['pastoral_priority']
          status?:      Database['public']['Enums']['pastoral_case_status']
          assigned_to?: string | null
          is_private?:  boolean
          created_by?:  string | null
          created_at?:  string
          resolved_at?: string | null
          deleted_at?:  string | null
          deleted_by?:  string | null
        }
        Update: {
          id?:          string
          assembly_id?: string
          member_id?:   string
          case_type?:   Database['public']['Enums']['pastoral_case_type']
          title?:       string
          description?: string | null
          priority?:    Database['public']['Enums']['pastoral_priority']
          status?:      Database['public']['Enums']['pastoral_case_status']
          assigned_to?: string | null
          is_private?:  boolean
          created_by?:  string | null
          created_at?:  string
          resolved_at?: string | null
          deleted_at?:  string | null
          deleted_by?:  string | null
        }
        Relationships: [
          {
            foreignKeyName: "pastoral_cases_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pastoral_cases_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      pastoral_visits: {
        Row: {
          id:               string
          case_id:          string
          member_id:        string
          visited_by:       string
          visit_type:       Database['public']['Enums']['visit_type']
          visit_date:       string
          notes:            string | null
          outcome:          Database['public']['Enums']['visit_outcome']
          next_visit_date:  string | null
          created_at:       string
          deleted_at:       string | null
          deleted_by:       string | null
        }
        Insert: {
          id?:              string
          case_id:          string
          member_id:        string
          visited_by:       string
          visit_type:       Database['public']['Enums']['visit_type']
          visit_date:       string
          notes?:           string | null
          outcome?:         Database['public']['Enums']['visit_outcome']
          next_visit_date?: string | null
          created_at?:      string
          deleted_at?:      string | null
          deleted_by?:      string | null
        }
        Update: {
          id?:              string
          case_id?:         string
          member_id?:       string
          visited_by?:      string
          visit_type?:      Database['public']['Enums']['visit_type']
          visit_date?:      string
          notes?:           string | null
          outcome?:         Database['public']['Enums']['visit_outcome']
          next_visit_date?: string | null
          created_at?:      string
          deleted_at?:      string | null
          deleted_by?:      string | null
        }
        Relationships: [
          {
            foreignKeyName: "pastoral_visits_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "pastoral_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pastoral_visits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_requests: {
        Row: {
          id:           string
          assembly_id:  string
          member_id:    string | null
          title:        string
          description:  string | null
          is_anonymous: boolean
          status:       Database['public']['Enums']['prayer_request_status']
          is_answered:  boolean
          answered_at:  string | null
          created_at:   string
          deleted_at:   string | null
          deleted_by:   string | null
        }
        Insert: {
          id?:          string
          assembly_id:  string
          member_id?:   string | null
          title:        string
          description?: string | null
          is_anonymous?: boolean
          status?:      Database['public']['Enums']['prayer_request_status']
          is_answered?: boolean
          answered_at?: string | null
          created_at?:  string
          deleted_at?:  string | null
          deleted_by?:  string | null
        }
        Update: {
          id?:          string
          assembly_id?: string
          member_id?:   string | null
          title?:       string
          description?: string | null
          is_anonymous?: boolean
          status?:      Database['public']['Enums']['prayer_request_status']
          is_answered?: boolean
          answered_at?: string | null
          created_at?:  string
          deleted_at?:  string | null
          deleted_by?:  string | null
        }
        Relationships: [
          {
            foreignKeyName: "prayer_requests_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayer_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_categories: {
        Row: {
          id:             string
          assembly_id:    string
          name:           string
          category_type:  Database['public']['Enums']['finance_category_type']
          description:    string | null
          is_active:      boolean
          created_by:     string | null
          created_at:     string
          deleted_at:     string | null
          deleted_by:     string | null
        }
        Insert: {
          id?:            string
          assembly_id:    string
          name:           string
          category_type:  Database['public']['Enums']['finance_category_type']
          description?:   string | null
          is_active?:     boolean
          created_by?:    string | null
          created_at?:    string
          deleted_at?:    string | null
          deleted_by?:    string | null
        }
        Update: {
          id?:            string
          assembly_id?:   string
          name?:          string
          category_type?: Database['public']['Enums']['finance_category_type']
          description?:   string | null
          is_active?:     boolean
          created_by?:    string | null
          created_at?:    string
          deleted_at?:    string | null
          deleted_by?:    string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_categories_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_transactions: {
        Row: {
          id:               string
          assembly_id:      string
          category_id:      string
          member_id:        string | null
          transaction_type: Database['public']['Enums']['finance_transaction_type']
          amount:           number
          currency:         string
          payment_method:   Database['public']['Enums']['finance_payment_method']
          reference_number: string | null
          transaction_date: string
          description:      string | null
          service_id:       string | null
          group_id:         string | null
          pledge_id:        string | null
          recorded_by:      string | null
          created_at:       string
          deleted_at:       string | null
          deleted_by:       string | null
        }
        Insert: {
          id?:              string
          assembly_id:      string
          category_id:      string
          member_id?:       string | null
          transaction_type: Database['public']['Enums']['finance_transaction_type']
          amount:           number
          currency?:        string
          payment_method:   Database['public']['Enums']['finance_payment_method']
          reference_number?: string | null
          transaction_date?: string
          description?:     string | null
          service_id?:      string | null
          group_id?:        string | null
          pledge_id?:       string | null
          recorded_by?:     string | null
          created_at?:      string
          deleted_at?:      string | null
          deleted_by?:      string | null
        }
        Update: {
          id?:              string
          assembly_id?:     string
          category_id?:     string
          member_id?:       string | null
          transaction_type?: Database['public']['Enums']['finance_transaction_type']
          amount?:          number
          currency?:        string
          payment_method?:  Database['public']['Enums']['finance_payment_method']
          reference_number?: string | null
          transaction_date?: string
          description?:     string | null
          service_id?:      string | null
          group_id?:        string | null
          pledge_id?:       string | null
          recorded_by?:     string | null
          created_at?:      string
          deleted_at?:      string | null
          deleted_by?:      string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_pledges: {
        Row: {
          id:           string
          assembly_id:  string
          member_id:    string
          pledge_name:  string
          total_amount: number
          amount_paid:  number
          currency:     string
          start_date:   string
          end_date:     string | null
          status:       Database['public']['Enums']['finance_pledge_status']
          notes:        string | null
          created_by:   string | null
          created_at:   string
          deleted_at:   string | null
          deleted_by:   string | null
        }
        Insert: {
          id?:          string
          assembly_id:  string
          member_id:    string
          pledge_name:  string
          total_amount: number
          amount_paid?: number
          currency?:    string
          start_date?:  string
          end_date?:    string | null
          status?:      Database['public']['Enums']['finance_pledge_status']
          notes?:       string | null
          created_by?:  string | null
          created_at?:  string
          deleted_at?:  string | null
          deleted_by?:  string | null
        }
        Update: {
          id?:          string
          assembly_id?: string
          member_id?:   string
          pledge_name?: string
          total_amount?: number
          amount_paid?: number
          currency?:    string
          start_date?:  string
          end_date?:    string | null
          status?:      Database['public']['Enums']['finance_pledge_status']
          notes?:       string | null
          created_by?:  string | null
          created_at?:  string
          deleted_at?:  string | null
          deleted_by?:  string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_pledges_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_budgets: {
        Row: {
          id:               string
          assembly_id:      string
          category_id:      string
          period:           Database['public']['Enums']['finance_budget_period']
          year:             number
          month:            number | null
          quarter:          number | null
          budgeted_amount:  number
          actual_amount:    number
          notes:            string | null
          created_by:       string | null
          created_at:       string
          deleted_at:       string | null
          deleted_by:       string | null
        }
        Insert: {
          id?:              string
          assembly_id:      string
          category_id:      string
          period:           Database['public']['Enums']['finance_budget_period']
          year:             number
          month?:           number | null
          quarter?:         number | null
          budgeted_amount:  number
          actual_amount?:   number
          notes?:           string | null
          created_by?:      string | null
          created_at?:      string
          deleted_at?:      string | null
          deleted_by?:      string | null
        }
        Update: {
          id?:              string
          assembly_id?:     string
          category_id?:     string
          period?:          Database['public']['Enums']['finance_budget_period']
          year?:            number
          month?:           number | null
          quarter?:         number | null
          budgeted_amount?: number
          actual_amount?:   number
          notes?:           string | null
          created_by?:      string | null
          created_at?:      string
          deleted_at?:      string | null
          deleted_by?:      string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_budgets_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      members_view: {
        Row: {
          assembly_id: string | null
          auth_user_id: string | null
          created_at: string | null
          created_by: string | null
          date_of_birth: string | null
          deleted_at: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          facebook_url: string | null
          first_name: string | null
          gender: Database["public"]["Enums"]["gender_type"] | null
          household_id: string | null
          id: string | null
          instagram_url: string | null
          is_active: boolean | null
          join_date: string | null
          last_name: string | null
          marital_status:
            | Database["public"]["Enums"]["marital_status_type"]
            | null
          membership_number: string | null
          membership_status:
            | Database["public"]["Enums"]["membership_status"]
            | null
          occupation: string | null
          other_names: string | null
          pastoral_notes: string | null
          physical_address: string | null
          primary_phone: string | null
          profile_photo_url: string | null
          secondary_phone: string | null
          title: string | null
          updated_at: string | null
          whatsapp_number: string | null
        }
        Insert: {
          assembly_id?: string | null
          auth_user_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          emergency_contact_name?: never
          emergency_contact_phone?: never
          emergency_contact_relationship?: never
          facebook_url?: string | null
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          household_id?: string | null
          id?: string | null
          instagram_url?: string | null
          is_active?: boolean | null
          join_date?: string | null
          last_name?: string | null
          marital_status?:
            | Database["public"]["Enums"]["marital_status_type"]
            | null
          membership_number?: string | null
          membership_status?:
            | Database["public"]["Enums"]["membership_status"]
            | null
          occupation?: string | null
          other_names?: string | null
          pastoral_notes?: never
          physical_address?: string | null
          primary_phone?: string | null
          profile_photo_url?: string | null
          secondary_phone?: string | null
          title?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          assembly_id?: string | null
          auth_user_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string | null
          emergency_contact_name?: never
          emergency_contact_phone?: never
          emergency_contact_relationship?: never
          facebook_url?: string | null
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          household_id?: string | null
          id?: string | null
          instagram_url?: string | null
          is_active?: boolean | null
          join_date?: string | null
          last_name?: string | null
          marital_status?:
            | Database["public"]["Enums"]["marital_status_type"]
            | null
          membership_number?: string | null
          membership_status?:
            | Database["public"]["Enums"]["membership_status"]
            | null
          occupation?: string | null
          other_names?: string | null
          pastoral_notes?: never
          physical_address?: string | null
          primary_phone?: string | null
          profile_photo_url?: string | null
          secondary_phone?: string | null
          title?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      assign_membership_number: {
        Args: { p_assembly_id: string; p_member_id: string }
        Returns: string
      }
      can_read_directory: { Args: never; Returns: boolean }
      get_available_primary_contacts: {
        Args: {
          p_assembly_id: string
          p_current_household_id?: string
          p_search: string
        }
        Returns: {
          first_name: string
          id: string
          last_name: string
          primary_phone: string
        }[]
      }
      get_next_membership_sequence: {
        Args: { p_assembly_id: string }
        Returns: number
      }
      get_user_assembly_id: { Args: never; Returns: string }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_pastor: { Args: never; Returns: boolean }
      is_admin_or_secretary: { Args: never; Returns: boolean }
    }
    Enums: {
      group_member_role: "leader" | "assistant_leader" | "member"
      group_type: "department" | "age_group"
      attendance_status: "present" | "absent" | "excused"
      finance_budget_period: "monthly" | "quarterly" | "annual"
      finance_category_type: "income" | "expense"
      finance_payment_method: "cash" | "momo" | "bank_transfer" | "cheque" | "other"
      finance_pledge_status: "active" | "completed" | "defaulted" | "cancelled"
      finance_transaction_type:
        | "tithe"
        | "offering"
        | "special_offering"
        | "pledge_payment"
        | "donation"
        | "expense"
      gender_type: "male" | "female"
      marital_status_type:
        | "single"
        | "married"
        | "widowed"
        | "divorced"
        | "separated"
      membership_status:
        | "active"
        | "inactive"
        | "visitor"
        | "prospect"
        | "transfer"
        | "deceased"
      pastoral_case_type:
        | 'follow_up'
        | 'bereavement'
        | 'illness'
        | 'counselling'
        | 'discipline'
        | 'other'
      pastoral_priority: 'low' | 'medium' | 'high' | 'urgent'
      pastoral_case_status: 'open' | 'in_progress' | 'resolved' | 'closed'
      visit_type: 'home_visit' | 'hospital_visit' | 'phone_call' | 'video_call' | 'in_person'
      visit_outcome: 'positive' | 'needs_follow_up' | 'no_response' | 'referred'
      prayer_request_status: 'active' | 'answered' | 'closed'
      recurrence_type: "none" | "daily" | "weekly" | "biweekly" | "monthly"
      service_status: "scheduled" | "completed" | "cancelled"
      user_role:
        | "admin"
        | "pastor"
        | "secretary"
        | "volunteer"
        | "member"
        | "finance_officer"
        | "welfare_officer"
        | "cell_leader"
        | "elder"
        | "children_worker"
        | "media_officer"
        | "district_overseer"
        | "national_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      group_member_role: ["leader", "assistant_leader", "member"],
      group_type: ["department", "age_group"],
      attendance_status: ["present", "absent", "excused"],
      pastoral_case_type: ["follow_up", "bereavement", "illness", "counselling", "discipline", "other"],
      pastoral_priority: ["low", "medium", "high", "urgent"],
      pastoral_case_status: ["open", "in_progress", "resolved", "closed"],
      visit_type: ["home_visit", "hospital_visit", "phone_call", "video_call", "in_person"],
      visit_outcome: ["positive", "needs_follow_up", "no_response", "referred"],
      prayer_request_status: ["active", "answered", "closed"],
      finance_budget_period: ["monthly", "quarterly", "annual"],
      finance_category_type: ["income", "expense"],
      finance_payment_method: ["cash", "momo", "bank_transfer", "cheque", "other"],
      finance_pledge_status: ["active", "completed", "defaulted", "cancelled"],
      finance_transaction_type: [
        "tithe",
        "offering",
        "special_offering",
        "pledge_payment",
        "donation",
        "expense",
      ],
      gender_type: ["male", "female"],
      marital_status_type: [
        "single",
        "married",
        "widowed",
        "divorced",
        "separated",
      ],
      membership_status: [
        "active",
        "inactive",
        "visitor",
        "prospect",
        "transfer",
        "deceased",
      ],
      recurrence_type: ["none", "daily", "weekly", "biweekly", "monthly"],
      service_status: ["scheduled", "completed", "cancelled"],
      user_role: [
        "admin",
        "pastor",
        "secretary",
        "volunteer",
        "member",
        "finance_officer",
        "welfare_officer",
        "cell_leader",
        "elder",
        "children_worker",
        "media_officer",
        "district_overseer",
        "national_admin",
      ],
    },
  },
} as const

export type UserRoleEnum = Database['public']['Enums']['user_role'];

