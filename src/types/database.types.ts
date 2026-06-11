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
      announcement_posts: {
        Row: {
          assembly_id: string
          body: string
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_pinned: boolean | null
          posted_by: string | null
          target_group_ids: string[] | null
          title: string
          visible_from: string | null
          visible_until: string | null
        }
        Insert: {
          assembly_id: string
          body: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_pinned?: boolean | null
          posted_by?: string | null
          target_group_ids?: string[] | null
          title: string
          visible_from?: string | null
          visible_until?: string | null
        }
        Update: {
          assembly_id?: string
          body?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_pinned?: boolean | null
          posted_by?: string | null
          target_group_ids?: string[] | null
          title?: string
          visible_from?: string | null
          visible_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_posts_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_posts_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_posts_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
          is_active: boolean
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          assembly_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          assembly_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
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
      assembly_storage_usage: {
        Row: {
          assembly_id: string
          created_at: string | null
          id: string
          r2_cold_bytes: number | null
          r2_warm_bytes: number | null
          sms_segments_sent: number | null
          snapshot_month: string
          supabase_bytes: number | null
          total_bytes: number | null
          whatsapp_msgs_sent: number | null
        }
        Insert: {
          assembly_id: string
          created_at?: string | null
          id?: string
          r2_cold_bytes?: number | null
          r2_warm_bytes?: number | null
          sms_segments_sent?: number | null
          snapshot_month: string
          supabase_bytes?: number | null
          total_bytes?: number | null
          whatsapp_msgs_sent?: number | null
        }
        Update: {
          assembly_id?: string
          created_at?: string | null
          id?: string
          r2_cold_bytes?: number | null
          r2_warm_bytes?: number | null
          sms_segments_sent?: number | null
          snapshot_month?: string
          supabase_bytes?: number | null
          total_bytes?: number | null
          whatsapp_msgs_sent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assembly_storage_usage_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_attachments: {
        Row: {
          archive_after: string | null
          archived_at: string | null
          assembly_id: string
          campaign_id: string | null
          checksum: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          duration_seconds: number | null
          file_size_bytes: number
          id: string
          is_sensitive: boolean | null
          mime_type: string
          normalised_path: string | null
          original_filename: string | null
          public_url: string | null
          purge_after: string | null
          storage_bucket: string
          storage_path: string
          storage_provider: string
          storage_tier: string
          thread_message_id: string | null
          transcription_status: string | null
          transcription_text: string | null
          uploaded_by: string | null
          virus_scan_status: string | null
          waveform_data: Json | null
        }
        Insert: {
          archive_after?: string | null
          archived_at?: string | null
          assembly_id: string
          campaign_id?: string | null
          checksum?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          duration_seconds?: number | null
          file_size_bytes: number
          id?: string
          is_sensitive?: boolean | null
          mime_type: string
          normalised_path?: string | null
          original_filename?: string | null
          public_url?: string | null
          purge_after?: string | null
          storage_bucket: string
          storage_path: string
          storage_provider?: string
          storage_tier?: string
          thread_message_id?: string | null
          transcription_status?: string | null
          transcription_text?: string | null
          uploaded_by?: string | null
          virus_scan_status?: string | null
          waveform_data?: Json | null
        }
        Update: {
          archive_after?: string | null
          archived_at?: string | null
          assembly_id?: string
          campaign_id?: string | null
          checksum?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number
          id?: string
          is_sensitive?: boolean | null
          mime_type?: string
          normalised_path?: string | null
          original_filename?: string | null
          public_url?: string | null
          purge_after?: string | null
          storage_bucket?: string
          storage_path?: string
          storage_provider?: string
          storage_tier?: string
          thread_message_id?: string | null
          transcription_status?: string | null
          transcription_text?: string | null
          uploaded_by?: string | null
          virus_scan_status?: string | null
          waveform_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_attachments_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_attachments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "communication_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_attachments_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_attachments_thread_message_id_fkey"
            columns: ["thread_message_id"]
            isOneToOne: false
            referencedRelation: "communication_thread_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_campaigns: {
        Row: {
          assembly_id: string
          audience_ids: string[] | null
          audience_type: string
          channel: string
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          scheduled_at: string | null
          sent_at: string | null
          status: string
          template_id: string | null
          title: string
          total_recipients: number | null
          trigger_type: string
        }
        Insert: {
          assembly_id: string
          audience_ids?: string[] | null
          audience_type: string
          channel: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          title: string
          total_recipients?: number | null
          trigger_type?: string
        }
        Update: {
          assembly_id?: string
          audience_ids?: string[] | null
          audience_type?: string
          channel?: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          title?: string
          total_recipients?: number | null
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_campaigns_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_campaigns_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "communication_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_messages: {
        Row: {
          assembly_id: string
          body_resolved: string
          campaign_id: string | null
          channel: string
          cost_units: number | null
          created_at: string | null
          deleted_at: string | null
          delivered_at: string | null
          external_ref: string | null
          failed_reason: string | null
          id: string
          member_id: string
          provider: string | null
          provider_status: string | null
          read_at: string | null
          status: string
        }
        Insert: {
          assembly_id: string
          body_resolved: string
          campaign_id?: string | null
          channel: string
          cost_units?: number | null
          created_at?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          external_ref?: string | null
          failed_reason?: string | null
          id?: string
          member_id: string
          provider?: string | null
          provider_status?: string | null
          read_at?: string | null
          status?: string
        }
        Update: {
          assembly_id?: string
          body_resolved?: string
          campaign_id?: string | null
          channel?: string
          cost_units?: number | null
          created_at?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          external_ref?: string | null
          failed_reason?: string | null
          id?: string
          member_id?: string
          provider?: string | null
          provider_status?: string | null
          read_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_messages_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "communication_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_view"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_preferences: {
        Row: {
          assembly_id: string
          category: string
          channel: string
          id: string
          member_id: string
          opted_in: boolean | null
          updated_at: string | null
        }
        Insert: {
          assembly_id: string
          category: string
          channel: string
          id?: string
          member_id: string
          opted_in?: boolean | null
          updated_at?: string | null
        }
        Update: {
          assembly_id?: string
          category?: string
          channel?: string
          id?: string
          member_id?: string
          opted_in?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_preferences_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_preferences_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_preferences_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_view"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_templates: {
        Row: {
          assembly_id: string
          body: string
          category: string
          channel: string
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_active: boolean | null
          title: string
          updated_at: string | null
          variables: Json | null
          whatsapp_template_name: string | null
        }
        Insert: {
          assembly_id: string
          body: string
          category: string
          channel: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean | null
          title: string
          updated_at?: string | null
          variables?: Json | null
          whatsapp_template_name?: string | null
        }
        Update: {
          assembly_id?: string
          body?: string
          category?: string
          channel?: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean | null
          title?: string
          updated_at?: string | null
          variables?: Json | null
          whatsapp_template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_templates_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_templates_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_thread_messages: {
        Row: {
          body: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          edited_at: string | null
          id: string
          message_type: string
          sender_id: string
          storage_tier: string | null
          thread_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string | null
          id?: string
          message_type?: string
          sender_id: string
          storage_tier?: string | null
          thread_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string | null
          id?: string
          message_type?: string
          sender_id?: string
          storage_tier?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_thread_messages_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_thread_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_thread_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "members_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "communication_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_thread_participants: {
        Row: {
          id: string
          joined_at: string | null
          last_read_at: string | null
          left_at: string | null
          member_id: string
          role: string | null
          thread_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          left_at?: string | null
          member_id: string
          role?: string | null
          thread_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          left_at?: string | null
          member_id?: string
          role?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_thread_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_thread_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_thread_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "communication_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_threads: {
        Row: {
          assembly_id: string
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_pastoral: boolean | null
          is_sensitive: boolean | null
          subject: string | null
        }
        Insert: {
          assembly_id: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_pastoral?: boolean | null
          is_sensitive?: boolean | null
          subject?: string | null
        }
        Update: {
          assembly_id?: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_pastoral?: boolean | null
          is_sensitive?: boolean | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_threads_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_threads_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_trigger_rules: {
        Row: {
          assembly_id: string
          channels: string[]
          created_at: string | null
          created_by: string | null
          days_offset: number | null
          id: string
          is_active: boolean | null
          offset_direction: string | null
          template_id: string
          trigger_event: string
        }
        Insert: {
          assembly_id: string
          channels: string[]
          created_at?: string | null
          created_by?: string | null
          days_offset?: number | null
          id?: string
          is_active?: boolean | null
          offset_direction?: string | null
          template_id: string
          trigger_event: string
        }
        Update: {
          assembly_id?: string
          channels?: string[]
          created_at?: string | null
          created_by?: string | null
          days_offset?: number | null
          id?: string
          is_active?: boolean | null
          offset_direction?: string | null
          template_id?: string
          trigger_event?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_trigger_rules_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_trigger_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_trigger_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "communication_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_budgets: {
        Row: {
          actual_amount: number
          assembly_id: string
          budgeted_amount: number
          category_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          month: number | null
          notes: string | null
          period: Database["public"]["Enums"]["finance_budget_period"]
          quarter: number | null
          year: number
        }
        Insert: {
          actual_amount?: number
          assembly_id: string
          budgeted_amount: number
          category_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          month?: number | null
          notes?: string | null
          period: Database["public"]["Enums"]["finance_budget_period"]
          quarter?: number | null
          year: number
        }
        Update: {
          actual_amount?: number
          assembly_id?: string
          budgeted_amount?: number
          category_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          month?: number | null
          notes?: string | null
          period?: Database["public"]["Enums"]["finance_budget_period"]
          quarter?: number | null
          year?: number
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
      finance_categories: {
        Row: {
          assembly_id: string
          category_type: Database["public"]["Enums"]["finance_category_type"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          assembly_id: string
          category_type: Database["public"]["Enums"]["finance_category_type"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          assembly_id?: string
          category_type?: Database["public"]["Enums"]["finance_category_type"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
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
      finance_pledges: {
        Row: {
          amount_paid: number
          assembly_id: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          end_date: string | null
          id: string
          member_id: string
          notes: string | null
          pledge_name: string
          start_date: string
          status: Database["public"]["Enums"]["finance_pledge_status"]
          total_amount: number
        }
        Insert: {
          amount_paid?: number
          assembly_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          end_date?: string | null
          id?: string
          member_id: string
          notes?: string | null
          pledge_name: string
          start_date?: string
          status?: Database["public"]["Enums"]["finance_pledge_status"]
          total_amount: number
        }
        Update: {
          amount_paid?: number
          assembly_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          end_date?: string | null
          id?: string
          member_id?: string
          notes?: string | null
          pledge_name?: string
          start_date?: string
          status?: Database["public"]["Enums"]["finance_pledge_status"]
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_pledges_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_pledges_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_pledges_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_view"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_transactions: {
        Row: {
          amount: number
          assembly_id: string
          category_id: string
          created_at: string
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          group_id: string | null
          id: string
          member_id: string | null
          payment_method: Database["public"]["Enums"]["finance_payment_method"]
          pledge_id: string | null
          recorded_by: string | null
          reference_number: string | null
          service_id: string | null
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["finance_transaction_type"]
        }
        Insert: {
          amount: number
          assembly_id: string
          category_id: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          group_id?: string | null
          id?: string
          member_id?: string | null
          payment_method: Database["public"]["Enums"]["finance_payment_method"]
          pledge_id?: string | null
          recorded_by?: string | null
          reference_number?: string | null
          service_id?: string | null
          transaction_date?: string
          transaction_type: Database["public"]["Enums"]["finance_transaction_type"]
        }
        Update: {
          amount?: number
          assembly_id?: string
          category_id?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          group_id?: string | null
          id?: string
          member_id?: string | null
          payment_method?: Database["public"]["Enums"]["finance_payment_method"]
          pledge_id?: string | null
          recorded_by?: string | null
          reference_number?: string | null
          service_id?: string | null
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["finance_transaction_type"]
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
          {
            foreignKeyName: "finance_transactions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_pledge_id_fkey"
            columns: ["pledge_id"]
            isOneToOne: false
            referencedRelation: "finance_pledges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          group_id: string
          id: string
          is_active: boolean
          joined_at: string
          left_at: string | null
          member_id: string
          role: Database["public"]["Enums"]["group_member_role"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          group_id: string
          id?: string
          is_active?: boolean
          joined_at?: string
          left_at?: string | null
          member_id: string
          role?: Database["public"]["Enums"]["group_member_role"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          group_id?: string
          id?: string
          is_active?: boolean
          joined_at?: string
          left_at?: string | null
          member_id?: string
          role?: Database["public"]["Enums"]["group_member_role"]
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
          {
            foreignKeyName: "group_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_view"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          assembly_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          group_type: Database["public"]["Enums"]["group_type"]
          id: string
          is_active: boolean
          leader_id: string | null
          name: string
        }
        Insert: {
          assembly_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          group_type: Database["public"]["Enums"]["group_type"]
          id?: string
          is_active?: boolean
          leader_id?: string | null
          name: string
        }
        Update: {
          assembly_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          group_type?: Database["public"]["Enums"]["group_type"]
          id?: string
          is_active?: boolean
          leader_id?: string | null
          name?: string
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
          {
            foreignKeyName: "groups_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "members_view"
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
      pastoral_cases: {
        Row: {
          assembly_id: string
          assigned_to: string | null
          case_type: Database["public"]["Enums"]["pastoral_case_type"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: string
          is_private: boolean
          member_id: string
          priority: Database["public"]["Enums"]["pastoral_priority"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["pastoral_case_status"]
          title: string
        }
        Insert: {
          assembly_id: string
          assigned_to?: string | null
          case_type: Database["public"]["Enums"]["pastoral_case_type"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          is_private?: boolean
          member_id: string
          priority?: Database["public"]["Enums"]["pastoral_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["pastoral_case_status"]
          title: string
        }
        Update: {
          assembly_id?: string
          assigned_to?: string | null
          case_type?: Database["public"]["Enums"]["pastoral_case_type"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          is_private?: boolean
          member_id?: string
          priority?: Database["public"]["Enums"]["pastoral_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["pastoral_case_status"]
          title?: string
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
          {
            foreignKeyName: "pastoral_cases_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_view"
            referencedColumns: ["id"]
          },
        ]
      }
      pastoral_visits: {
        Row: {
          case_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          member_id: string
          next_visit_date: string | null
          notes: string | null
          outcome: Database["public"]["Enums"]["visit_outcome"]
          visit_date: string
          visit_type: Database["public"]["Enums"]["visit_type"]
          visited_by: string
        }
        Insert: {
          case_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          member_id: string
          next_visit_date?: string | null
          notes?: string | null
          outcome?: Database["public"]["Enums"]["visit_outcome"]
          visit_date: string
          visit_type: Database["public"]["Enums"]["visit_type"]
          visited_by: string
        }
        Update: {
          case_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          member_id?: string
          next_visit_date?: string | null
          notes?: string | null
          outcome?: Database["public"]["Enums"]["visit_outcome"]
          visit_date?: string
          visit_type?: Database["public"]["Enums"]["visit_type"]
          visited_by?: string
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
          {
            foreignKeyName: "pastoral_visits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_view"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_requests: {
        Row: {
          answered_at: string | null
          assembly_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: string
          is_anonymous: boolean
          is_answered: boolean
          member_id: string | null
          status: Database["public"]["Enums"]["prayer_request_status"]
          title: string
        }
        Insert: {
          answered_at?: string | null
          assembly_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          is_anonymous?: boolean
          is_answered?: boolean
          member_id?: string | null
          status?: Database["public"]["Enums"]["prayer_request_status"]
          title: string
        }
        Update: {
          answered_at?: string | null
          assembly_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          is_anonymous?: boolean
          is_answered?: boolean
          member_id?: string | null
          status?: Database["public"]["Enums"]["prayer_request_status"]
          title?: string
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
          {
            foreignKeyName: "prayer_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_view"
            referencedColumns: ["id"]
          },
        ]
      }
      push_device_tokens: {
        Row: {
          assembly_id: string
          created_at: string | null
          device_token: string
          id: string
          is_active: boolean | null
          last_used_at: string | null
          member_id: string
          platform: string
        }
        Insert: {
          assembly_id: string
          created_at?: string | null
          device_token: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          member_id: string
          platform: string
        }
        Update: {
          assembly_id?: string
          created_at?: string | null
          device_token?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          member_id?: string
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_device_tokens_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_device_tokens_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_device_tokens_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_view"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_key: string
          role_id: string
        }
        Insert: {
          permission_key: string
          role_id: string
        }
        Update: {
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "system_permissions"
            referencedColumns: ["key"]
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
      service_attendance: {
        Row: {
          deleted_at: string | null
          deleted_by: string | null
          id: string
          marked_at: string
          marked_by: string | null
          member_id: string
          notes: string | null
          service_id: string
          status: Database["public"]["Enums"]["attendance_status"]
        }
        Insert: {
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          marked_at?: string
          marked_by?: string | null
          member_id: string
          notes?: string | null
          service_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
        }
        Update: {
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          marked_at?: string
          marked_by?: string | null
          member_id?: string
          notes?: string | null
          service_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
        }
        Relationships: [
          {
            foreignKeyName: "service_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_attendance_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_audit_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          field_changed: string
          id: string
          new_value: string | null
          old_value: string | null
          service_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          field_changed: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          service_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          field_changed?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          service_id?: string
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
      service_templates: {
        Row: {
          assembly_id: string
          created_at: string
          created_by: string | null
          day_of_week: string | null
          deleted_at: string | null
          deleted_by: string | null
          group_id: string | null
          id: string
          is_active: boolean
          recurrence: Database["public"]["Enums"]["recurrence_type"]
          recurrence_end_date: string | null
          service_type: string
          start_time: string | null
          title: string
          venue: string | null
        }
        Insert: {
          assembly_id: string
          created_at?: string
          created_by?: string | null
          day_of_week?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          recurrence?: Database["public"]["Enums"]["recurrence_type"]
          recurrence_end_date?: string | null
          service_type: string
          start_time?: string | null
          title: string
          venue?: string | null
        }
        Update: {
          assembly_id?: string
          created_at?: string
          created_by?: string | null
          day_of_week?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          recurrence?: Database["public"]["Enums"]["recurrence_type"]
          recurrence_end_date?: string | null
          service_type?: string
          start_time?: string | null
          title?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_templates_assembly_id_fkey"
            columns: ["assembly_id"]
            isOneToOne: false
            referencedRelation: "assemblies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_templates_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          assembly_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          group_id: string | null
          headcount: number | null
          id: string
          notes: string | null
          service_date: string
          service_type: string
          start_time: string | null
          status: Database["public"]["Enums"]["service_status"]
          template_id: string | null
          title: string
          venue: string | null
        }
        Insert: {
          assembly_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          group_id?: string | null
          headcount?: number | null
          id?: string
          notes?: string | null
          service_date: string
          service_type: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["service_status"]
          template_id?: string | null
          title: string
          venue?: string | null
        }
        Update: {
          assembly_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          group_id?: string | null
          headcount?: number | null
          id?: string
          notes?: string | null
          service_date?: string
          service_type?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["service_status"]
          template_id?: string | null
          title?: string
          venue?: string | null
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
            foreignKeyName: "services_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
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
      storage_signed_url_log: {
        Row: {
          attachment_id: string
          created_at: string | null
          expires_at: string
          id: string
          ip_address: string | null
          requested_by: string
        }
        Insert: {
          attachment_id: string
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          requested_by: string
        }
        Update: {
          attachment_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          requested_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "storage_signed_url_log_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "communication_attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storage_signed_url_log_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_permissions: {
        Row: {
          category: string
          description: string | null
          id: string
          is_active: boolean
          is_assignable: boolean
          key: string
          label: string
          module_name: string
        }
        Insert: {
          category?: string
          description?: string | null
          id: string
          is_active?: boolean
          is_assignable?: boolean
          key: string
          label: string
          module_name?: string
        }
        Update: {
          category?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_assignable?: boolean
          key?: string
          label?: string
          module_name?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          assembly_id: string
          assembly_role_id: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          must_change_password: boolean
          role: string
          updated_at: string
        }
        Insert: {
          assembly_id: string
          assembly_role_id?: string | null
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          must_change_password?: boolean
          role?: string
          updated_at?: string
        }
        Update: {
          assembly_id?: string
          assembly_role_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          must_change_password?: boolean
          role?: string
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
            columns: ["assembly_role_id"]
            isOneToOne: false
            referencedRelation: "assembly_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          message_id: string | null
          payload: Json
          processed_at: string | null
          provider: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          message_id?: string | null
          payload: Json
          processed_at?: string | null
          provider: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          message_id?: string | null
          payload?: Json
          processed_at?: string | null
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "communication_messages"
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
      auth_assembly_id: { Args: never; Returns: string }
      auth_has_permission: { Args: { perm_key: string }; Returns: boolean }
      auth_member_id: { Args: never; Returns: string }
      clear_must_change_password: { Args: never; Returns: undefined }
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
      get_user_role: { Args: never; Returns: string }
      has_finance_permission: { Args: { perm: string }; Returns: boolean }
      has_pastoral_permission: { Args: { perm: string }; Returns: boolean }
      increment_storage_usage: {
        Args: { p_assembly_id: string; p_bytes: number }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_member: { Args: never; Returns: boolean }
    }
    Enums: {
      attendance_status: "present" | "absent" | "excused"
      finance_budget_period: "monthly" | "quarterly" | "annual"
      finance_category_type: "income" | "expense"
      finance_payment_method:
        | "cash"
        | "momo"
        | "bank_transfer"
        | "cheque"
        | "other"
      finance_pledge_status: "active" | "completed" | "defaulted" | "cancelled"
      finance_transaction_type:
        | "tithe"
        | "offering"
        | "special_offering"
        | "pledge_payment"
        | "donation"
        | "expense"
      gender_type: "male" | "female"
      group_member_role: "leader" | "assistant_leader" | "member"
      group_type: "department" | "age_group"
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
      pastoral_case_status: "open" | "in_progress" | "resolved" | "closed"
      pastoral_case_type:
        | "follow_up"
        | "bereavement"
        | "illness"
        | "counselling"
        | "discipline"
        | "other"
      pastoral_priority: "low" | "medium" | "high" | "urgent"
      prayer_request_status: "active" | "answered" | "closed"
      recurrence_type: "none" | "daily" | "weekly" | "biweekly" | "monthly"
      service_status: "scheduled" | "completed" | "cancelled"
      visit_outcome: "positive" | "needs_follow_up" | "no_response" | "referred"
      visit_type:
        | "home_visit"
        | "hospital_visit"
        | "phone_call"
        | "video_call"
        | "in_person"
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
      attendance_status: ["present", "absent", "excused"],
      finance_budget_period: ["monthly", "quarterly", "annual"],
      finance_category_type: ["income", "expense"],
      finance_payment_method: [
        "cash",
        "momo",
        "bank_transfer",
        "cheque",
        "other",
      ],
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
      group_member_role: ["leader", "assistant_leader", "member"],
      group_type: ["department", "age_group"],
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
      pastoral_case_status: ["open", "in_progress", "resolved", "closed"],
      pastoral_case_type: [
        "follow_up",
        "bereavement",
        "illness",
        "counselling",
        "discipline",
        "other",
      ],
      pastoral_priority: ["low", "medium", "high", "urgent"],
      prayer_request_status: ["active", "answered", "closed"],
      recurrence_type: ["none", "daily", "weekly", "biweekly", "monthly"],
      service_status: ["scheduled", "completed", "cancelled"],
      visit_outcome: ["positive", "needs_follow_up", "no_response", "referred"],
      visit_type: [
        "home_visit",
        "hospital_visit",
        "phone_call",
        "video_call",
        "in_person",
      ],
    },
  },
} as const

