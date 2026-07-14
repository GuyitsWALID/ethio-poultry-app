export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alert_rules: {
        Row: {
          created_at: string
          farm_id: string | null
          id: string
          is_active: boolean
          metric: string
          operator: string
          org_id: string
          severity: Database["public"]["Enums"]["alert_priority"]
          target_id: string | null
          target_type: string
          threshold: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          farm_id?: string | null
          id?: string
          is_active?: boolean
          metric: string
          operator: string
          org_id: string
          severity?: Database["public"]["Enums"]["alert_priority"]
          target_id?: string | null
          target_type: string
          threshold: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          farm_id?: string | null
          id?: string
          is_active?: boolean
          metric?: string
          operator?: string
          org_id?: string
          severity?: Database["public"]["Enums"]["alert_priority"]
          target_id?: string | null
          target_type?: string
          threshold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["alert_category"]
          created_at: string
          id: string
          message: string
          org_id: string
          priority: Database["public"]["Enums"]["alert_priority"]
          resolved_at: string | null
          rule_id: string | null
          status: Database["public"]["Enums"]["alert_status"]
          triggered_at: string
          triggered_value: number | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category: Database["public"]["Enums"]["alert_category"]
          created_at?: string
          id?: string
          message: string
          org_id: string
          priority?: Database["public"]["Enums"]["alert_priority"]
          resolved_at?: string | null
          rule_id?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          triggered_at?: string
          triggered_value?: number | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["alert_category"]
          created_at?: string
          id?: string
          message?: string
          org_id?: string
          priority?: Database["public"]["Enums"]["alert_priority"]
          resolved_at?: string | null
          rule_id?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          triggered_at?: string
          triggered_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          age_at_placement_days: number | null
          batch_code: string
          branch_id: string
          created_at: string
          farm_id: string
          female_count: number | null
          house_id: string
          id: string
          male_count: number | null
          notes: string | null
          org_id: string
          other_cost: number | null
          placement_date: string
          purchase_cost_per_bird: number | null
          purchase_date: string | null
          source: Database["public"]["Enums"]["flock_source"]
          status: string
          supplier_name: string | null
          total_batch_cost: number | null
          total_count: number
          transport_cost: number | null
          updated_at: string
        }
        Insert: {
          age_at_placement_days?: number | null
          batch_code: string
          branch_id: string
          created_at?: string
          farm_id: string
          female_count?: number | null
          house_id: string
          id?: string
          male_count?: number | null
          notes?: string | null
          org_id: string
          other_cost?: number | null
          placement_date: string
          purchase_cost_per_bird?: number | null
          purchase_date?: string | null
          source: Database["public"]["Enums"]["flock_source"]
          status?: string
          supplier_name?: string | null
          total_batch_cost?: number | null
          total_count: number
          transport_cost?: number | null
          updated_at?: string
        }
        Update: {
          age_at_placement_days?: number | null
          batch_code?: string
          branch_id?: string
          created_at?: string
          farm_id?: string
          female_count?: number | null
          house_id?: string
          id?: string
          male_count?: number | null
          notes?: string | null
          org_id?: string
          other_cost?: number | null
          placement_date?: string
          purchase_cost_per_bird?: number | null
          purchase_date?: string | null
          source?: Database["public"]["Enums"]["flock_source"]
          status?: string
          supplier_name?: string | null
          total_batch_cost?: number | null
          total_count?: number
          transport_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_feed_templates: {
        Row: {
          batch_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          source_type: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          source_type?: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_feed_templates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_feed_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_feed_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_feed_template_rows: {
        Row: {
          age_day_end: number
          age_day_start: number
          created_at: string
          feed_intake_recommended_g_per_head: number | null
          feed_intake_std_g_per_head: number | null
          feed_type_plan: string | null
          id: string
          light_off_time: string | null
          light_on_time: string | null
          row_order: number
          target_weight_max_g: number | null
          target_weight_min_g: number | null
          template_id: string
          updated_at: string
          week_number: number
        }
        Insert: {
          age_day_end: number
          age_day_start: number
          created_at?: string
          feed_intake_recommended_g_per_head?: number | null
          feed_intake_std_g_per_head?: number | null
          feed_type_plan?: string | null
          id?: string
          light_off_time?: string | null
          light_on_time?: string | null
          row_order?: number
          target_weight_max_g?: number | null
          target_weight_min_g?: number | null
          template_id: string
          updated_at?: string
          week_number: number
        }
        Update: {
          age_day_end?: number
          age_day_start?: number
          created_at?: string
          feed_intake_recommended_g_per_head?: number | null
          feed_intake_std_g_per_head?: number | null
          feed_type_plan?: string | null
          id?: string
          light_off_time?: string | null
          light_on_time?: string | null
          row_order?: number
          target_weight_max_g?: number | null
          target_weight_min_g?: number | null
          template_id?: string
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "batch_feed_template_rows_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "batch_feed_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_feed_template_milestones: {
        Row: {
          category: string
          created_at: string
          id: string
          is_required: boolean
          notes: string | null
          template_id: string
          title: string
          trigger_day: number
          updated_at: string
          week_number: number | null
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_required?: boolean
          notes?: string | null
          template_id: string
          title: string
          trigger_day: number
          updated_at?: string
          week_number?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_required?: boolean
          notes?: string | null
          template_id?: string
          title?: string
          trigger_day?: number
          updated_at?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_feed_template_milestones_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "batch_feed_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_weight_check_tasks: {
        Row: {
          batch_id: string
          created_at: string
          created_by: string | null
          due_date: string
          due_week_number: number
          flock_id: string
          id: string
          org_id: string
          status: string
          template_row_id: string | null
          updated_at: string
          weight_record_id: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_by?: string | null
          due_date: string
          due_week_number: number
          flock_id: string
          id?: string
          org_id: string
          status?: string
          template_row_id?: string | null
          updated_at?: string
          weight_record_id?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string
          due_week_number?: number
          flock_id?: string
          id?: string
          org_id?: string
          status?: string
          template_row_id?: string | null
          updated_at?: string
          weight_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_weight_check_tasks_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_weight_check_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_weight_check_tasks_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_weight_check_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_weight_check_tasks_template_row_id_fkey"
            columns: ["template_row_id"]
            isOneToOne: false
            referencedRelation: "batch_feed_template_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_weight_check_tasks_weight_record_id_fkey"
            columns: ["weight_record_id"]
            isOneToOne: false
            referencedRelation: "weight_records"
            referencedColumns: ["id"]
          },
        ]
      }
      biosecurity_checks: {
        Row: {
          checklist_date: string
          completed_by: string | null
          created_at: string
          farm_id: string
          id: string
          notes: string | null
          org_id: string
          updated_at: string
        }
        Insert: {
          checklist_date: string
          completed_by?: string | null
          created_at?: string
          farm_id: string
          id?: string
          notes?: string | null
          org_id: string
          updated_at?: string
        }
        Update: {
          checklist_date?: string
          completed_by?: string | null
          created_at?: string
          farm_id?: string
          id?: string
          notes?: string | null
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biosecurity_checks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biosecurity_checks_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biosecurity_checks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          created_at: string
          id: string
          location: string | null
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      breed_standards: {
        Row: {
          breed_id: string
          created_at: string
          id: string
          org_id: string
          target_feed_g: number | null
          target_hdep_pct: number | null
          target_mortality_pct: number | null
          target_weight_g: number | null
          updated_at: string
          week_number: number
        }
        Insert: {
          breed_id: string
          created_at?: string
          id?: string
          org_id: string
          target_feed_g?: number | null
          target_hdep_pct?: number | null
          target_mortality_pct?: number | null
          target_weight_g?: number | null
          updated_at?: string
          week_number: number
        }
        Update: {
          breed_id?: string
          created_at?: string
          id?: string
          org_id?: string
          target_feed_g?: number | null
          target_hdep_pct?: number | null
          target_mortality_pct?: number | null
          target_weight_g?: number | null
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "breed_standards_breed_id_fkey"
            columns: ["breed_id"]
            isOneToOne: false
            referencedRelation: "breeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breed_standards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      breeds: {
        Row: {
          breeder: string | null
          created_at: string
          id: string
          name: string
          org_id: string
          type: Database["public"]["Enums"]["flock_type"]
          updated_at: string
        }
        Insert: {
          breeder?: string | null
          created_at?: string
          id?: string
          name: string
          org_id: string
          type: Database["public"]["Enums"]["flock_type"]
          updated_at?: string
        }
        Update: {
          breeder?: string | null
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          type?: Database["public"]["Enums"]["flock_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "breeds_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          certificate_url: string | null
          created_at: string
          enrollment_id: string
          id: string
          issued_at: string | null
          updated_at: string
        }
        Insert: {
          certificate_url?: string | null
          created_at?: string
          enrollment_id: string
          id?: string
          issued_at?: string | null
          updated_at?: string
        }
        Update: {
          certificate_url?: string | null
          created_at?: string
          enrollment_id?: string
          id?: string
          issued_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "training_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          code: string
          created_at: string
          id: string
          name: string
          org_id: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"]
          code: string
          created_at?: string
          id?: string
          name: string
          org_id: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          code?: string
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          location: string | null
          org_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          location?: string | null
          org_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          location?: string | null
          org_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_egg_records: {
        Row: {
          broken_eggs: number | null
          created_at: string
          dirty_eggs: number | null
          flock_id: string
          floor_eggs: number | null
          good_eggs: number | null
          hdep: number | null
          id: string
          org_id: string
          record_date: string
          total_eggs: number | null
          updated_at: string
        }
        Insert: {
          broken_eggs?: number | null
          created_at?: string
          dirty_eggs?: number | null
          flock_id: string
          floor_eggs?: number | null
          good_eggs?: number | null
          hdep?: number | null
          id?: string
          org_id: string
          record_date: string
          total_eggs?: number | null
          updated_at?: string
        }
        Update: {
          broken_eggs?: number | null
          created_at?: string
          dirty_eggs?: number | null
          flock_id?: string
          floor_eggs?: number | null
          good_eggs?: number | null
          hdep?: number | null
          id?: string
          org_id?: string
          record_date?: string
          total_eggs?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_egg_records_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_egg_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_farm_records: {
        Row: {
          broken_eggs: number | null
          created_at: string
          deaths: number | null
          deaths_cause: string | null
          feed_intake_grams: number | null
          feed_intake_quantity: number | null
          feed_leftover_grams: number | null
          feed_type: Database["public"]["Enums"]["feed_type"] | null
          flock_age_days: number | null
          flock_age_weeks: number | null
          flock_id: string
          id: string
          medication_vitamins: string | null
          mortality_percentage: number | null
          normal_eggs: number | null
          org_id: string
          production_percentage: number | null
          record_date: string
          recorded_by: string | null
          synced: boolean
          total_eggs: number | null
          updated_at: string
          vaccination_status: string | null
        }
        Insert: {
          broken_eggs?: number | null
          created_at?: string
          deaths?: number | null
          deaths_cause?: string | null
          feed_intake_grams?: number | null
          feed_intake_quantity?: number | null
          feed_leftover_grams?: number | null
          feed_type?: Database["public"]["Enums"]["feed_type"] | null
          flock_age_days?: number | null
          flock_age_weeks?: number | null
          flock_id: string
          id?: string
          medication_vitamins?: string | null
          mortality_percentage?: number | null
          normal_eggs?: number | null
          org_id: string
          production_percentage?: number | null
          record_date: string
          recorded_by?: string | null
          synced?: boolean
          total_eggs?: number | null
          updated_at?: string
          vaccination_status?: string | null
        }
        Update: {
          broken_eggs?: number | null
          created_at?: string
          deaths?: number | null
          deaths_cause?: string | null
          feed_intake_grams?: number | null
          feed_intake_quantity?: number | null
          feed_leftover_grams?: number | null
          feed_type?: Database["public"]["Enums"]["feed_type"] | null
          flock_age_days?: number | null
          flock_age_weeks?: number | null
          flock_id?: string
          id?: string
          medication_vitamins?: string | null
          mortality_percentage?: number | null
          normal_eggs?: number | null
          org_id?: string
          production_percentage?: number | null
          record_date?: string
          recorded_by?: string | null
          synced?: boolean
          total_eggs?: number | null
          updated_at?: string
          vaccination_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_farm_records_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_farm_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_farm_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feeding_schedules: {
        Row: {
          batch_id: string
          created_at: string
          created_by: string | null
          feed_type: string
          id: string
          notes: string | null
          org_id: string
          planned_feed_kg: number
          schedule_date: string
          target_grams_per_bird: number | null
          updated_at: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_by?: string | null
          feed_type: string
          id?: string
          notes?: string | null
          org_id: string
          planned_feed_kg: number
          schedule_date: string
          target_grams_per_bird?: number | null
          updated_at?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_by?: string | null
          feed_type?: string
          id?: string
          notes?: string | null
          org_id?: string
          planned_feed_kg?: number
          schedule_date?: string
          target_grams_per_bird?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feeding_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_schedules_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_schedules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      feeding_session_records: {
        Row: {
          actual_feed_kg: number | null
          batch_id: string
          created_at: string
          feeders_count: number
          flock_id: string
          id: string
          notes: string | null
          org_id: string
          planned_feed_kg: number
          record_date: string
          recorded_by: string | null
          session_name: string
          session_time: string | null
          updated_at: string
        }
        Insert: {
          actual_feed_kg?: number | null
          batch_id: string
          created_at?: string
          feeders_count: number
          flock_id: string
          id?: string
          notes?: string | null
          org_id: string
          planned_feed_kg: number
          record_date: string
          recorded_by?: string | null
          session_name: string
          session_time?: string | null
          updated_at?: string
        }
        Update: {
          actual_feed_kg?: number | null
          batch_id?: string
          created_at?: string
          feeders_count?: number
          flock_id?: string
          id?: string
          notes?: string | null
          org_id?: string
          planned_feed_kg?: number
          record_date?: string
          recorded_by?: string | null
          session_name?: string
          session_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feeding_session_records_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_session_records_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_session_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_session_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      farms: {
        Row: {
          branch_id: string
          capacity_birds: number | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          capacity_birds?: number | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          capacity_birds?: number | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farms_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      flock_transfers: {
        Row: {
          created_at: string
          flock_id: string
          from_house_id: string
          id: string
          org_id: string
          reason: string | null
          to_house_id: string
          transfer_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          flock_id: string
          from_house_id: string
          id?: string
          org_id: string
          reason?: string | null
          to_house_id: string
          transfer_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          flock_id?: string
          from_house_id?: string
          id?: string
          org_id?: string
          reason?: string | null
          to_house_id?: string
          transfer_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flock_transfers_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flock_transfers_from_house_id_fkey"
            columns: ["from_house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flock_transfers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flock_transfers_to_house_id_fkey"
            columns: ["to_house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      flocks: {
        Row: {
          age_at_placement_days: number | null
          batch_id: string | null
          breed_id: string | null
          created_at: string
          current_count: number
          farm_id: string
          flock_code: string
          flock_type: Database["public"]["Enums"]["flock_type"]
          house_id: string
          id: string
          initial_count: number
          intake_batch_id: string | null
          notes: string | null
          org_id: string
          placement_date: string
          purchase_cost_per_bird: number | null
          source: Database["public"]["Enums"]["flock_source"]
          status: Database["public"]["Enums"]["flock_status"]
          updated_at: string
        }
        Insert: {
          age_at_placement_days?: number | null
          batch_id?: string | null
          breed_id?: string | null
          created_at?: string
          current_count: number
          farm_id: string
          flock_code: string
          flock_type: Database["public"]["Enums"]["flock_type"]
          house_id: string
          id?: string
          initial_count: number
          intake_batch_id?: string | null
          notes?: string | null
          org_id: string
          placement_date: string
          purchase_cost_per_bird?: number | null
          source: Database["public"]["Enums"]["flock_source"]
          status?: Database["public"]["Enums"]["flock_status"]
          updated_at?: string
        }
        Update: {
          age_at_placement_days?: number | null
          batch_id?: string | null
          breed_id?: string | null
          created_at?: string
          current_count?: number
          farm_id?: string
          flock_code?: string
          flock_type?: Database["public"]["Enums"]["flock_type"]
          house_id?: string
          id?: string
          initial_count?: number
          intake_batch_id?: string | null
          notes?: string | null
          org_id?: string
          placement_date?: string
          purchase_cost_per_bird?: number | null
          source?: Database["public"]["Enums"]["flock_source"]
          status?: Database["public"]["Enums"]["flock_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flocks_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flocks_breed_id_fkey"
            columns: ["breed_id"]
            isOneToOne: false
            referencedRelation: "breeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flocks_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flocks_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flocks_intake_batch_id_fkey"
            columns: ["intake_batch_id"]
            isOneToOne: false
            referencedRelation: "branch_intake_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flocks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      health_events: {
        Row: {
          attachment_url: string | null
          created_at: string
          description: string | null
          diagnosis: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["health_event_type"]
          flock_id: string
          id: string
          org_id: string
          treatment: string | null
          updated_at: string
          vet_id: string | null
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          description?: string | null
          diagnosis?: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["health_event_type"]
          flock_id: string
          id?: string
          org_id: string
          treatment?: string | null
          updated_at?: string
          vet_id?: string | null
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          description?: string | null
          diagnosis?: string | null
          event_date?: string
          event_type?: Database["public"]["Enums"]["health_event_type"]
          flock_id?: string
          id?: string
          org_id?: string
          treatment?: string | null
          updated_at?: string
          vet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_events_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_events_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      houses: {
        Row: {
          branch_id: string
          capacity: number | null
          created_at: string
          farm_id: string
          house_type: Database["public"]["Enums"]["house_type"]
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          capacity?: number | null
          created_at?: string
          farm_id: string
          house_type: Database["public"]["Enums"]["house_type"]
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          capacity?: number | null
          created_at?: string
          farm_id?: string
          house_type?: Database["public"]["Enums"]["house_type"]
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "houses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "houses_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "houses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: Database["public"]["Enums"]["inventory_category"]
          created_at: string
          id: string
          name: string
          org_id: string
          reorder_level: number | null
          unit: string
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["inventory_category"]
          created_at?: string
          id?: string
          name: string
          org_id: string
          reorder_level?: number | null
          unit: string
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["inventory_category"]
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          reorder_level?: number | null
          unit?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          description: string | null
          entry_date: string
          id: string
          org_id: string
          posted: boolean
          source: string | null
          source_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          entry_date?: string
          id?: string
          org_id: string
          posted?: boolean
          source?: string | null
          source_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          entry_date?: string
          id?: string
          org_id?: string
          posted?: boolean
          source?: string | null
          source_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          branch_id: string | null
          created_at: string
          credit: number
          debit: number
          farm_id: string | null
          flock_id: string | null
          id: string
          journal_entry_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          branch_id?: string | null
          created_at?: string
          credit?: number
          debit?: number
          farm_id?: string | null
          flock_id?: string | null
          id?: string
          journal_entry_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          branch_id?: string | null
          created_at?: string
          credit?: number
          debit?: number
          farm_id?: string | null
          flock_id?: string | null
          id?: string
          journal_entry_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["lead_activity_type"]
          created_at: string
          description: string | null
          id: string
          lead_id: string
          next_action: string | null
          next_action_date: string | null
          outcome: string | null
          recorded_by: string | null
          updated_at: string
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["lead_activity_type"]
          created_at?: string
          description?: string | null
          id?: string
          lead_id: string
          next_action?: string | null
          next_action_date?: string | null
          outcome?: string | null
          recorded_by?: string | null
          updated_at?: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["lead_activity_type"]
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string
          next_action?: string | null
          next_action_date?: string | null
          outcome?: string | null
          recorded_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          created_at: string
          email: string | null
          farm_size_interest: number | null
          full_name: string
          id: string
          last_activity: string | null
          lead_source: Database["public"]["Enums"]["lead_source"]
          location: string | null
          org_id: string
          phone: string | null
          pipeline_stage: Database["public"]["Enums"]["lead_stage"]
          source_detail: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          email?: string | null
          farm_size_interest?: number | null
          full_name: string
          id?: string
          last_activity?: string | null
          lead_source?: Database["public"]["Enums"]["lead_source"]
          location?: string | null
          org_id: string
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["lead_stage"]
          source_detail?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          email?: string | null
          farm_size_interest?: number | null
          full_name?: string
          id?: string
          last_activity?: string | null
          lead_source?: Database["public"]["Enums"]["lead_source"]
          location?: string | null
          org_id?: string
          phone?: string | null
          pipeline_stage?: Database["public"]["Enums"]["lead_stage"]
          source_detail?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mortality_events: {
        Row: {
          cause: string
          count: number
          created_at: string
          diagnosis: string | null
          flock_id: string
          id: string
          notes: string | null
          observed_by: string | null
          org_id: string
          record_date: string
          recorded_time: string | null
          updated_at: string
        }
        Insert: {
          cause: string
          count: number
          created_at?: string
          diagnosis?: string | null
          flock_id: string
          id?: string
          notes?: string | null
          observed_by?: string | null
          org_id: string
          record_date: string
          recorded_time?: string | null
          updated_at?: string
        }
        Update: {
          cause?: string
          count?: number
          created_at?: string
          diagnosis?: string | null
          flock_id?: string
          id?: string
          notes?: string | null
          observed_by?: string | null
          org_id?: string
          record_date?: string
          recorded_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mortality_events_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mortality_events_observed_by_fkey"
            columns: ["observed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mortality_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          branch_count: number | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          plan: string | null
          primary_location: string | null
          settings_json: Json | null
          updated_at: string
        }
        Insert: {
          branch_count?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          plan?: string | null
          primary_location?: string | null
          settings_json?: Json | null
          updated_at?: string
        }
        Update: {
          branch_count?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          plan?: string | null
          primary_location?: string | null
          settings_json?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      package_template_items: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string | null
          is_free: boolean
          item_name: string
          item_type: Database["public"]["Enums"]["package_item_type"]
          quantity: number | null
          template_id: string
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          is_free?: boolean
          item_name: string
          item_type: Database["public"]["Enums"]["package_item_type"]
          quantity?: number | null
          template_id: string
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          is_free?: boolean
          item_name?: string
          item_type?: Database["public"]["Enums"]["package_item_type"]
          quantity?: number | null
          template_id?: string
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_template_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "package_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      package_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          payment_date: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          received_by: string | null
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          payment_date?: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          received_by?: string | null
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          order_id?: string
          payment_date?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          received_by?: string | null
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_items: {
        Row: {
          created_at: string
          expiry_date: string | null
          id: string
          inventory_item_id: string | null
          quantity: number | null
          transaction_id: string
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          inventory_item_id?: string | null
          quantity?: number | null
          transaction_id: string
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          inventory_item_id?: string | null
          quantity?: number | null
          transaction_id?: string
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "pos_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_transactions: {
        Row: {
          branch_id: string
          cashier_id: string | null
          created_at: string
          id: string
          org_id: string
          payment_method: Database["public"]["Enums"]["pos_payment_method"]
          subtotal: number | null
          total: number | null
          transaction_date: string
          transaction_number: string
          updated_at: string
          vat_amount: number | null
        }
        Insert: {
          branch_id: string
          cashier_id?: string | null
          created_at?: string
          id?: string
          org_id: string
          payment_method: Database["public"]["Enums"]["pos_payment_method"]
          subtotal?: number | null
          total?: number | null
          transaction_date?: string
          transaction_number: string
          updated_at?: string
          vat_amount?: number | null
        }
        Update: {
          branch_id?: string
          cashier_id?: string | null
          created_at?: string
          id?: string
          org_id?: string
          payment_method?: Database["public"]["Enums"]["pos_payment_method"]
          subtotal?: number | null
          total?: number | null
          transaction_date?: string
          transaction_number?: string
          updated_at?: string
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean
          org_id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          org_id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          org_id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_aliases: {
        Row: {
          alias: string
          created_at: string
          id: string
          role_code: string
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          role_code: string
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          role_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_aliases_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["code"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          default_route: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_route: string
          display_name: string
          id?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_route?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_order_items: {
        Row: {
          created_at: string
          flock_id: string | null
          id: string
          inventory_item_id: string | null
          is_free: boolean
          item_name: string
          item_type: Database["public"]["Enums"]["package_item_type"]
          line_total: number | null
          order_id: string
          quantity: number | null
          unit_price: number | null
          updated_at: string
          vat_rate: number | null
        }
        Insert: {
          created_at?: string
          flock_id?: string | null
          id?: string
          inventory_item_id?: string | null
          is_free?: boolean
          item_name: string
          item_type: Database["public"]["Enums"]["package_item_type"]
          line_total?: number | null
          order_id: string
          quantity?: number | null
          unit_price?: number | null
          updated_at?: string
          vat_rate?: number | null
        }
        Update: {
          created_at?: string
          flock_id?: string | null
          id?: string
          inventory_item_id?: string | null
          is_free?: boolean
          item_name?: string
          item_type?: Database["public"]["Enums"]["package_item_type"]
          line_total?: number | null
          order_id?: string
          quantity?: number | null
          unit_price?: number | null
          updated_at?: string
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          assigned_to: string | null
          balance_due: number | null
          created_at: string
          customer_address: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_date: string | null
          deposit_amount: number | null
          id: string
          lead_id: string | null
          notes: string | null
          order_date: string | null
          order_number: string
          org_id: string
          status: Database["public"]["Enums"]["sales_order_status"]
          subtotal: number | null
          total: number | null
          updated_at: string
          vat_amount: number | null
        }
        Insert: {
          assigned_to?: string | null
          balance_due?: number | null
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_date?: string | null
          deposit_amount?: number | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          order_date?: string | null
          order_number: string
          org_id: string
          status?: Database["public"]["Enums"]["sales_order_status"]
          subtotal?: number | null
          total?: number | null
          updated_at?: string
          vat_amount?: number | null
        }
        Update: {
          assigned_to?: string | null
          balance_due?: number | null
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_date?: string | null
          deposit_amount?: number | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          order_date?: string | null
          order_number?: string
          org_id?: string
          status?: Database["public"]["Enums"]["sales_order_status"]
          subtotal?: number | null
          total?: number | null
          updated_at?: string
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sensor_readings: {
        Row: {
          captured_at: string
          id: number
          reading_value: number
          sensor_id: string
        }
        Insert: {
          captured_at?: string
          id?: number
          reading_value: number
          sensor_id: string
        }
        Update: {
          captured_at?: string
          id?: number
          reading_value?: number
          sensor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sensor_readings_sensor_id_fkey"
            columns: ["sensor_id"]
            isOneToOne: false
            referencedRelation: "sensors"
            referencedColumns: ["id"]
          },
        ]
      }
      sensors: {
        Row: {
          created_at: string
          external_id: string | null
          house_id: string
          id: string
          last_seen: string | null
          org_id: string
          sensor_type: Database["public"]["Enums"]["sensor_type"]
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          house_id: string
          id?: string
          last_seen?: string | null
          org_id: string
          sensor_type: Database["public"]["Enums"]["sensor_type"]
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          house_id?: string
          id?: string
          last_seen?: string | null
          org_id?: string
          sensor_type?: Database["public"]["Enums"]["sensor_type"]
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sensors_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_ledger: {
        Row: {
          batch_id: string | null
          batch_number: string | null
          branch_id: string | null
          created_at: string
          daily_record_id: string | null
          expiry_date: string | null
          farm_id: string | null
          flock_id: string | null
          house_id: string | null
          id: string
          invoice_number: string | null
          item_id: string
          notes: string | null
          org_id: string
          procurement_type: Database["public"]["Enums"]["procurement_type"] | null
          quantity: number
          recorded_by: string | null
          reference_doc: string | null
          supplier_name: string | null
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["stock_txn_type"]
          unit_cost: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          batch_id?: string | null
          batch_number?: string | null
          branch_id?: string | null
          created_at?: string
          daily_record_id?: string | null
          expiry_date?: string | null
          farm_id?: string | null
          flock_id?: string | null
          house_id?: string | null
          id?: string
          invoice_number?: string | null
          item_id: string
          notes?: string | null
          org_id: string
          procurement_type?: Database["public"]["Enums"]["procurement_type"] | null
          quantity: number
          recorded_by?: string | null
          reference_doc?: string | null
          supplier_name?: string | null
          transaction_date?: string
          transaction_type: Database["public"]["Enums"]["stock_txn_type"]
          unit_cost: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          batch_id?: string | null
          batch_number?: string | null
          branch_id?: string | null
          created_at?: string
          daily_record_id?: string | null
          expiry_date?: string | null
          farm_id?: string | null
          flock_id?: string | null
          house_id?: string | null
          id?: string
          invoice_number?: string | null
          item_id?: string
          notes?: string | null
          org_id?: string
          procurement_type?: Database["public"]["Enums"]["procurement_type"] | null
          quantity?: number
          recorded_by?: string | null
          reference_doc?: string | null
          supplier_name?: string | null
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["stock_txn_type"]
          unit_cost?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_ledger_daily_record_id_fkey"
            columns: ["daily_record_id"]
            isOneToOne: false
            referencedRelation: "daily_farm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      training_enrollments: {
        Row: {
          assessment_score: number | null
          attendance: Json | null
          created_at: string
          customer_id: string | null
          id: string
          passed: boolean | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          program_id: string
          updated_at: string
        }
        Insert: {
          assessment_score?: number | null
          attendance?: Json | null
          created_at?: string
          customer_id?: string | null
          id?: string
          passed?: boolean | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          program_id: string
          updated_at?: string
        }
        Update: {
          assessment_score?: number | null
          attendance?: Json | null
          created_at?: string
          customer_id?: string | null
          id?: string
          passed?: boolean | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          program_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_enrollments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      training_programs: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          facilitator_id: string | null
          fee_etb: number | null
          id: string
          max_capacity: number | null
          name: string
          org_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["training_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          facilitator_id?: string | null
          fee_etb?: number | null
          id?: string
          max_capacity?: number | null
          name: string
          org_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["training_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          facilitator_id?: string | null
          fee_etb?: number | null
          id?: string
          max_capacity?: number | null
          name?: string
          org_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["training_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_programs_facilitator_id_fkey"
            columns: ["facilitator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_programs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_branch_access: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          org_id: string
          profile_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          org_id: string
          profile_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          org_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_branch_access_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_branch_access_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_branch_access_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_farm_access: {
        Row: {
          created_at: string
          farm_id: string
          id: string
          org_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          farm_id: string
          id?: string
          org_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          farm_id?: string
          id?: string
          org_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_farm_access_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_farm_access_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_farm_access_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccination_events: {
        Row: {
          batch_number: string | null
          birds_vaccinated: number | null
          created_at: string
          dosage: string | null
          event_date: string
          expiry_date: string | null
          flock_id: string
          id: string
          org_id: string
          route: Database["public"]["Enums"]["vaccination_route"]
          updated_at: string
          vaccine_name: string
          vet_id: string | null
        }
        Insert: {
          batch_number?: string | null
          birds_vaccinated?: number | null
          created_at?: string
          dosage?: string | null
          event_date: string
          expiry_date?: string | null
          flock_id: string
          id?: string
          org_id: string
          route: Database["public"]["Enums"]["vaccination_route"]
          updated_at?: string
          vaccine_name: string
          vet_id?: string | null
        }
        Update: {
          batch_number?: string | null
          birds_vaccinated?: number | null
          created_at?: string
          dosage?: string | null
          event_date?: string
          expiry_date?: string | null
          flock_id?: string
          id?: string
          org_id?: string
          route?: Database["public"]["Enums"]["vaccination_route"]
          updated_at?: string
          vaccine_name?: string
          vet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vaccination_events_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_events_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visitor_logs: {
        Row: {
          created_at: string
          farm_id: string
          id: string
          org_id: string
          purpose: string | null
          updated_at: string
          visit_date: string
          visitor_name: string
        }
        Insert: {
          created_at?: string
          farm_id: string
          id?: string
          org_id: string
          purpose?: string | null
          updated_at?: string
          visit_date: string
          visitor_name: string
        }
        Update: {
          created_at?: string
          farm_id?: string
          id?: string
          org_id?: string
          purpose?: string | null
          updated_at?: string
          visit_date?: string
          visitor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_logs_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          name: string
          org_id: string
          type: Database["public"]["Enums"]["warehouse_type"]
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          name: string
          org_id: string
          type: Database["public"]["Enums"]["warehouse_type"]
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          type?: Database["public"]["Enums"]["warehouse_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      weight_records: {
        Row: {
          average_weight_g: number | null
          created_at: string
          flock_id: string
          id: string
          max_weight_g: number | null
          min_weight_g: number | null
          org_id: string
          record_date: string
          sample_count: number | null
          uniformity_pct: number | null
          updated_at: string
        }
        Insert: {
          average_weight_g?: number | null
          created_at?: string
          flock_id: string
          id?: string
          max_weight_g?: number | null
          min_weight_g?: number | null
          org_id: string
          record_date: string
          sample_count?: number | null
          uniformity_pct?: number | null
          updated_at?: string
        }
        Update: {
          average_weight_g?: number | null
          created_at?: string
          flock_id?: string
          id?: string
          max_weight_g?: number | null
          min_weight_g?: number | null
          org_id?: string
          record_date?: string
          sample_count?: number | null
          uniformity_pct?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "weight_records_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weight_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_org_id: { Args: never; Returns: string }
      create_branch_batch_cycle: {
        Args: {
          p_org_id: string
          p_branch_id: string
          p_batch: Json
          p_flock_slots: Json
        }
        Returns: Json
      }
      normalize_user_role: {
        Args: { input_role: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      record_inventory_movement: {
        Args: {
          p_actor_id: string
          p_item_id: string
          p_warehouse_id: string
          p_transaction_type: string
          p_quantity: number
          p_unit_cost?: number
          p_transaction_date?: string
          p_destination_warehouse_id?: string | null
          p_branch_id?: string | null
          p_farm_id?: string | null
          p_house_id?: string | null
          p_flock_id?: string | null
          p_batch_id?: string | null
          p_procurement_type?: Database["public"]["Enums"]["procurement_type"] | null
          p_supplier_name?: string | null
          p_invoice_number?: string | null
          p_reference_doc?: string | null
          p_notes?: string | null
        }
        Returns: Json
      }
      save_daily_record_with_usage: {
        Args: {
          p_actor_id: string
          p_daily_record_id: string | null
          p_flock_id: string
          p_record: Json
          p_usages?: Json
        }
        Returns: Json
      }
      stock_movement_delta: {
        Args: {
          p_transaction_type: Database["public"]["Enums"]["stock_txn_type"]
          p_quantity: number
        }
        Returns: number
      }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
      alert_category:
        | "mortality"
        | "inventory"
        | "financial"
        | "environmental"
        | "health"
      alert_priority: "info" | "low" | "medium" | "high" | "emergency"
      alert_status: "open" | "acknowledged" | "resolved"
      feed_type:
        | "starter_feed"
        | "grower_pullet_feed"
        | "layer_feed"
        | "broiler_feed"
        | "medicated_feed"
      flock_source: "internal_transfer" | "external_purchase"
      flock_status: "active" | "transferred" | "sold" | "culled" | "quarantined" | "archived"
      flock_type: "layer" | "rearing" | "parent_stock" | "broiler"
      health_event_type: "disease" | "treatment" | "observation"
      house_type: "layer" | "rearing" | "parent_stock" | "broiler"
      inventory_category:
        | "feed"
        | "medicine"
        | "vaccine"
        | "vitamin"
        | "supplement"
        | "equipment"
        | "spare_parts"
        | "packaging"
        | "miscellaneous"
      lead_activity_type: "call" | "visit" | "message" | "email" | "note"
      lead_source:
        | "telegram"
        | "facebook"
        | "walk_in"
        | "training"
        | "referral"
        | "other"
      lead_stage:
        | "new"
        | "contacted"
        | "training_registered"
        | "training_completed"
        | "proposal_sent"
        | "proforma_issued"
        | "deposit_received"
        | "prep"
        | "final_payment"
        | "delivery_scheduled"
        | "delivered"
        | "follow_up"
        | "closed"
        | "lost"
      package_item_type: "chick" | "feed" | "medicine" | "equipment" | "service"
      payment_method: "cash" | "bank_transfer" | "cheque" | "mobile_money"
      payment_status: "pending" | "partial" | "paid"
      payment_type: "deposit_50" | "final_50" | "full" | "partial"
      pos_payment_method: "cash" | "bank_transfer" | "mobile_money"
      procurement_type: "monthly" | "emergency" | "miscellaneous"
      sales_order_status:
        | "draft"
        | "proforma_sent"
        | "deposit_paid"
        | "in_preparation"
        | "ready"
        | "delivered"
        | "completed"
        | "cancelled"
      sensor_type: "temperature" | "humidity" | "ammonia" | "water_flow"
      stock_txn_type:
        | "receipt"
        | "issue"
        | "transfer_out"
        | "transfer_in"
        | "adjustment"
        | "return"
      training_status: "planned" | "open" | "in_progress" | "completed"
      user_role:
        | "super_admin"
        | "system_admin"
        | "ceo"
        | "farm_manager"
        | "veterinarian"
        | "store_keeper"
      vaccination_route: "water" | "injection" | "spray" | "eye_drop"
      warehouse_type:
        | "farm_store"
        | "pharmacy"
        | "equipment_store"
        | "central_warehouse"
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
  public: {
    Enums: {
      account_type: ["asset", "liability", "equity", "revenue", "expense"],
      alert_category: [
        "mortality",
        "inventory",
        "financial",
        "environmental",
        "health",
      ],
      alert_priority: ["info", "low", "medium", "high", "emergency"],
      alert_status: ["open", "acknowledged", "resolved"],
      flock_source: ["internal_transfer", "external_purchase"],
      flock_status: ["active", "transferred", "sold", "culled", "quarantined", "archived"],
      flock_type: ["layer", "rearing", "parent_stock", "broiler"],
      health_event_type: ["disease", "treatment", "observation"],
      house_type: ["layer", "rearing", "parent_stock", "broiler"],
      inventory_category: [
        "feed",
        "medicine",
        "vaccine",
        "vitamin",
        "supplement",
        "equipment",
        "spare_parts",
        "packaging",
        "miscellaneous",
      ],
      lead_activity_type: ["call", "visit", "message", "email", "note"],
      lead_source: [
        "telegram",
        "facebook",
        "walk_in",
        "training",
        "referral",
        "other",
      ],
      lead_stage: [
        "new",
        "contacted",
        "training_registered",
        "training_completed",
        "proposal_sent",
        "proforma_issued",
        "deposit_received",
        "prep",
        "final_payment",
        "delivery_scheduled",
        "delivered",
        "follow_up",
        "closed",
        "lost",
      ],
      package_item_type: ["chick", "feed", "medicine", "equipment", "service"],
      payment_method: ["cash", "bank_transfer", "cheque", "mobile_money"],
      payment_status: ["pending", "partial", "paid"],
      payment_type: ["deposit_50", "final_50", "full", "partial"],
      pos_payment_method: ["cash", "bank_transfer", "mobile_money"],
      procurement_type: ["monthly", "emergency", "miscellaneous"],
      sales_order_status: [
        "draft",
        "proforma_sent",
        "deposit_paid",
        "in_preparation",
        "ready",
        "delivered",
        "completed",
        "cancelled",
      ],
      sensor_type: ["temperature", "humidity", "ammonia", "water_flow"],
      stock_txn_type: [
        "receipt",
        "issue",
        "transfer_out",
        "transfer_in",
        "adjustment",
        "return",
      ],
      training_status: ["planned", "open", "in_progress", "completed"],
      user_role: [
        "super_admin",
        "system_admin",
        "ceo",
        "farm_manager",
        "veterinarian",
        "store_keeper",
      ],
      vaccination_route: ["water", "injection", "spray", "eye_drop"],
      warehouse_type: [
        "farm_store",
        "pharmacy",
        "equipment_store",
        "central_warehouse",
      ],
    },
  },
} as const
