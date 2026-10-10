export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      batch_cycle_accounting_amendments: {
        Row: {
          correction_id: string
          created_at: string
          cycle_id: string
          departures: Json
          id: number
          org_id: string
        }
        Insert: {
          correction_id: string
          created_at?: string
          cycle_id: string
          departures: Json
          id?: never
          org_id: string
        }
        Update: {
          correction_id?: string
          created_at?: string
          cycle_id?: string
          departures?: Json
          id?: never
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_cycle_accounting_amendments_correction_id_fkey"
            columns: ["correction_id"]
            isOneToOne: true
            referencedRelation: "batch_cycle_corrections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_cycle_accounting_amendments_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "batch_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_cycle_accounting_amendments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_cycle_clearances: {
        Row: {
          before_clearance_birds: number
          closure_id: string
          created_at: string
          daily_record_id: string | null
          flock_id: string
          house_id: string
          id: string
          org_id: string
          source_snapshot: Json
        }
        Insert: {
          before_clearance_birds: number
          closure_id: string
          created_at?: string
          daily_record_id?: string | null
          flock_id: string
          house_id: string
          id?: string
          org_id: string
          source_snapshot: Json
        }
        Update: {
          before_clearance_birds?: number
          closure_id?: string
          created_at?: string
          daily_record_id?: string | null
          flock_id?: string
          house_id?: string
          id?: string
          org_id?: string
          source_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "batch_cycle_clearances_closure_id_fkey"
            columns: ["closure_id"]
            isOneToOne: false
            referencedRelation: "batch_cycle_closures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_cycle_clearances_daily_record_id_fkey"
            columns: ["daily_record_id"]
            isOneToOne: false
            referencedRelation: "daily_farm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_cycle_clearances_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: true
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_cycle_clearances_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_cycle_clearances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_cycle_closures: {
        Row: {
          applied_by: string
          completed_at: string
          created_at: string
          cycle_id: string
          id: string
          mode: string
          org_id: string
          request_id: string
          supporting_reference: string | null
        }
        Insert: {
          applied_by: string
          completed_at: string
          created_at?: string
          cycle_id: string
          id?: string
          mode: string
          org_id: string
          request_id: string
          supporting_reference?: string | null
        }
        Update: {
          applied_by?: string
          completed_at?: string
          created_at?: string
          cycle_id?: string
          id?: string
          mode?: string
          org_id?: string
          request_id?: string
          supporting_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_cycle_closures_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_cycle_closures_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: true
            referencedRelation: "batch_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_cycle_closures_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_cycle_closures_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "governance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_cycle_corrections: {
        Row: {
          after_revision: string
          applied_by: string
          before_revision: string
          closure_snapshot: Json
          created_at: string
          cycle_id: string
          id: string
          org_id: string
          request_id: string
          supporting_reference: string
        }
        Insert: {
          after_revision: string
          applied_by: string
          before_revision: string
          closure_snapshot: Json
          created_at?: string
          cycle_id: string
          id?: string
          org_id: string
          request_id: string
          supporting_reference: string
        }
        Update: {
          after_revision?: string
          applied_by?: string
          before_revision?: string
          closure_snapshot?: Json
          created_at?: string
          cycle_id?: string
          id?: string
          org_id?: string
          request_id?: string
          supporting_reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_cycle_corrections_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_cycle_corrections_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "batch_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_cycle_corrections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_cycle_corrections_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "governance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_cycle_dispositions: {
        Row: {
          clearance_id: string
          created_at: string
          id: string
          kind: string
          org_id: string
          quantity: number
          reason: string | null
          sale_id: string | null
          supporting_reference: string | null
        }
        Insert: {
          clearance_id: string
          created_at?: string
          id?: string
          kind: string
          org_id: string
          quantity: number
          reason?: string | null
          sale_id?: string | null
          supporting_reference?: string | null
        }
        Update: {
          clearance_id?: string
          created_at?: string
          id?: string
          kind?: string
          org_id?: string
          quantity?: number
          reason?: string | null
          sale_id?: string | null
          supporting_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_cycle_dispositions_clearance_id_fkey"
            columns: ["clearance_id"]
            isOneToOne: false
            referencedRelation: "batch_cycle_clearances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_cycle_dispositions_clearance_id_fkey"
            columns: ["clearance_id"]
            isOneToOne: false
            referencedRelation: "effective_cycle_clearances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_cycle_dispositions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_cycle_dispositions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "daily_sales_records"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_cycles: {
        Row: {
          completed_at: string | null
          completion_verified: boolean
          created_at: string
          created_by_request: string | null
          cycle_code: string
          farm_id: string
          id: string
          legacy_singleton: boolean
          org_id: string
          placed_at: string | null
          placement_date: string
          production_purpose: Database["public"]["Enums"]["flock_type"]
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completion_verified?: boolean
          created_at?: string
          created_by_request?: string | null
          cycle_code: string
          farm_id: string
          id?: string
          legacy_singleton?: boolean
          org_id: string
          placed_at?: string | null
          placement_date: string
          production_purpose: Database["public"]["Enums"]["flock_type"]
          status: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completion_verified?: boolean
          created_at?: string
          created_by_request?: string | null
          cycle_code?: string
          farm_id?: string
          id?: string
          legacy_singleton?: boolean
          org_id?: string
          placed_at?: string | null
          placement_date?: string
          production_purpose?: Database["public"]["Enums"]["flock_type"]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_cycles_created_by_request_fkey"
            columns: ["created_by_request"]
            isOneToOne: false
            referencedRelation: "governance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_cycles_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_cycles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
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
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
            foreignKeyName: "batch_weight_check_tasks_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      batches: {
        Row: {
          age_at_placement_days: number
          batch_code: string
          batch_cycle_id: string | null
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
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          age_at_placement_days: number
          batch_code: string
          batch_cycle_id?: string | null
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
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          age_at_placement_days?: number
          batch_code?: string
          batch_cycle_id?: string | null
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
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_batch_cycle_id_fkey"
            columns: ["batch_cycle_id"]
            isOneToOne: false
            referencedRelation: "batch_cycles"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "batches_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
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
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
          {
            foreignKeyName: "biosecurity_checks_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bird_sale_head_count_attestations: {
        Row: {
          created_at: string
          head_count: number
          org_id: string
          request_id: string
          sale_id: string
          source_revision: string
          supporting_reference: string
        }
        Insert: {
          created_at?: string
          head_count: number
          org_id: string
          request_id: string
          sale_id: string
          source_revision: string
          supporting_reference: string
        }
        Update: {
          created_at?: string
          head_count?: number
          org_id?: string
          request_id?: string
          sale_id?: string
          source_revision?: string
          supporting_reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "bird_sale_head_count_attestations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bird_sale_head_count_attestations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "governance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bird_sale_head_count_attestations_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: true
            referencedRelation: "daily_sales_records"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_intake_batches: {
        Row: {
          batch_code: string
          branch_id: string
          created_at: string
          id: string
          notes: string | null
          org_id: string
          other_cost: number | null
          placement_date: string
          purchase_cost_per_bird: number | null
          purchase_date: string | null
          source: Database["public"]["Enums"]["flock_source"]
          status: string
          supplier_name: string | null
          total_cost: number | null
          total_count: number
          transport_cost: number | null
          updated_at: string
        }
        Insert: {
          batch_code?: string
          branch_id: string
          created_at?: string
          id?: string
          notes?: string | null
          org_id: string
          other_cost?: number | null
          placement_date: string
          purchase_cost_per_bird?: number | null
          purchase_date?: string | null
          source: Database["public"]["Enums"]["flock_source"]
          status?: string
          supplier_name?: string | null
          total_cost?: number | null
          total_count: number
          transport_cost?: number | null
          updated_at?: string
        }
        Update: {
          batch_code?: string
          branch_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string
          other_cost?: number | null
          placement_date?: string
          purchase_cost_per_bird?: number | null
          purchase_date?: string | null
          source?: Database["public"]["Enums"]["flock_source"]
          status?: string
          supplier_name?: string | null
          total_cost?: number | null
          total_count?: number
          transport_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_intake_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_intake_batches_org_id_fkey"
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
      break_glass_requests: {
        Row: {
          administrator_id: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          expires_at: string | null
          id: string
          reason: string
          requested_at: string
          requested_minutes: number
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: string
          target_org_id: string
          ticket_reference: string
        }
        Insert: {
          administrator_id: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          expires_at?: string | null
          id?: string
          reason: string
          requested_at?: string
          requested_minutes: number
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          target_org_id: string
          ticket_reference: string
        }
        Update: {
          administrator_id?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          expires_at?: string | null
          id?: string
          reason?: string
          requested_at?: string
          requested_minutes?: number
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          target_org_id?: string
          ticket_reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "break_glass_requests_administrator_id_fkey"
            columns: ["administrator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "break_glass_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "break_glass_requests_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "break_glass_requests_target_org_id_fkey"
            columns: ["target_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      break_glass_sessions: {
        Row: {
          administrator_id: string
          expires_at: string
          id: string
          request_id: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          started_at: string
          target_org_id: string
        }
        Insert: {
          administrator_id: string
          expires_at: string
          id?: string
          request_id: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          started_at?: string
          target_org_id: string
        }
        Update: {
          administrator_id?: string
          expires_at?: string
          id?: string
          request_id?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          started_at?: string
          target_org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "break_glass_sessions_administrator_id_fkey"
            columns: ["administrator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "break_glass_sessions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "break_glass_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "break_glass_sessions_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "break_glass_sessions_target_org_id_fkey"
            columns: ["target_org_id"]
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
      client_operation_receipts: {
        Row: {
          actor_id: string
          command_id: string
          command_type: string
          completed_at: string | null
          created_at: string
          id: string
          org_id: string
          payload_hash: string
          result: Json | null
          schema_version: number
        }
        Insert: {
          actor_id: string
          command_id: string
          command_type: string
          completed_at?: string | null
          created_at?: string
          id?: string
          org_id: string
          payload_hash: string
          result?: Json | null
          schema_version: number
        }
        Update: {
          actor_id?: string
          command_id?: string
          command_type?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          org_id?: string
          payload_hash?: string
          result?: Json | null
          schema_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_operation_receipts_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_operation_receipts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_allocations: {
        Row: {
          allocated_amount: number
          allocation_method: Database["public"]["Enums"]["cost_allocation_method"]
          allocation_percent: number | null
          batch_id: string | null
          branch_id: string | null
          cost_entry_id: string
          created_at: string
          farm_id: string | null
          flock_id: string | null
          house_id: string | null
          id: string
          org_id: string
        }
        Insert: {
          allocated_amount: number
          allocation_method?: Database["public"]["Enums"]["cost_allocation_method"]
          allocation_percent?: number | null
          batch_id?: string | null
          branch_id?: string | null
          cost_entry_id: string
          created_at?: string
          farm_id?: string | null
          flock_id?: string | null
          house_id?: string | null
          id?: string
          org_id: string
        }
        Update: {
          allocated_amount?: number
          allocation_method?: Database["public"]["Enums"]["cost_allocation_method"]
          allocation_percent?: number | null
          batch_id?: string | null
          branch_id?: string | null
          cost_entry_id?: string
          created_at?: string
          farm_id?: string | null
          flock_id?: string | null
          house_id?: string | null
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_allocations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_allocations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_allocations_cost_entry_id_fkey"
            columns: ["cost_entry_id"]
            isOneToOne: false
            referencedRelation: "cost_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_allocations_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_allocations_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_allocations_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_allocations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_entries: {
        Row: {
          allocation_method: Database["public"]["Enums"]["cost_allocation_method"]
          amount: number
          batch_id: string | null
          branch_id: string | null
          category: Database["public"]["Enums"]["cost_entry_category"]
          confirmation_month: string | null
          created_at: string
          description: string
          entry_date: string
          entry_kind: string
          farm_id: string | null
          flock_id: string | null
          house_id: string | null
          id: string
          invoice_number: string | null
          org_id: string
          period_id: string | null
          recorded_by: string | null
          recurring_template_id: string | null
          reference_doc: string | null
          supplier_name: string | null
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          allocation_method?: Database["public"]["Enums"]["cost_allocation_method"]
          amount: number
          batch_id?: string | null
          branch_id?: string | null
          category: Database["public"]["Enums"]["cost_entry_category"]
          confirmation_month?: string | null
          created_at?: string
          description: string
          entry_date?: string
          entry_kind?: string
          farm_id?: string | null
          flock_id?: string | null
          house_id?: string | null
          id?: string
          invoice_number?: string | null
          org_id: string
          period_id?: string | null
          recorded_by?: string | null
          recurring_template_id?: string | null
          reference_doc?: string | null
          supplier_name?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          allocation_method?: Database["public"]["Enums"]["cost_allocation_method"]
          amount?: number
          batch_id?: string | null
          branch_id?: string | null
          category?: Database["public"]["Enums"]["cost_entry_category"]
          confirmation_month?: string | null
          created_at?: string
          description?: string
          entry_date?: string
          entry_kind?: string
          farm_id?: string | null
          flock_id?: string | null
          house_id?: string | null
          id?: string
          invoice_number?: string | null
          org_id?: string
          period_id?: string | null
          recorded_by?: string | null
          recurring_template_id?: string | null
          reference_doc?: string | null
          supplier_name?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_entries_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "monthly_cost_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_recurring_template_id_fkey"
            columns: ["recurring_template_id"]
            isOneToOne: false
            referencedRelation: "recurring_cost_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
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
          average_egg_weight_g: number | null
          broken_eggs: number | null
          closing_birds: number | null
          created_at: string
          culls: number | null
          deaths: number | null
          deaths_cause: string | null
          dirty_eggs: number | null
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
          opening_birds: number | null
          org_id: string
          other_removals: number | null
          production_percentage: number | null
          record_date: string
          recorded_by: string | null
          synced: boolean
          today_cull_baseline: number
          total_eggs: number | null
          transfers_in: number | null
          transfers_out: number | null
          updated_at: string
          vaccination_status: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          water_consumed_liters: number | null
        }
        Insert: {
          average_egg_weight_g?: number | null
          broken_eggs?: number | null
          closing_birds?: number | null
          created_at?: string
          culls?: number | null
          deaths?: number | null
          deaths_cause?: string | null
          dirty_eggs?: number | null
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
          opening_birds?: number | null
          org_id: string
          other_removals?: number | null
          production_percentage?: number | null
          record_date: string
          recorded_by?: string | null
          synced?: boolean
          today_cull_baseline?: number
          total_eggs?: number | null
          transfers_in?: number | null
          transfers_out?: number | null
          updated_at?: string
          vaccination_status?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          water_consumed_liters?: number | null
        }
        Update: {
          average_egg_weight_g?: number | null
          broken_eggs?: number | null
          closing_birds?: number | null
          created_at?: string
          culls?: number | null
          deaths?: number | null
          deaths_cause?: string | null
          dirty_eggs?: number | null
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
          opening_birds?: number | null
          org_id?: string
          other_removals?: number | null
          production_percentage?: number | null
          record_date?: string
          recorded_by?: string | null
          synced?: boolean
          today_cull_baseline?: number
          total_eggs?: number | null
          transfers_in?: number | null
          transfers_out?: number | null
          updated_at?: string
          vaccination_status?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          water_consumed_liters?: number | null
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
          {
            foreignKeyName: "daily_farm_records_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales_records: {
        Row: {
          balance_due: number
          batch_id: string | null
          branch_id: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          farm_id: string | null
          flock_id: string | null
          gross_amount: number
          house_id: string | null
          id: string
          notes: string | null
          org_id: string
          paid_amount: number
          payment_method: string | null
          product_category: string
          product_label: string
          quantity: number
          recorded_by: string | null
          sale_date: string
          unit: string
          unit_price: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          balance_due?: number
          batch_id?: string | null
          branch_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          farm_id?: string | null
          flock_id?: string | null
          gross_amount: number
          house_id?: string | null
          id?: string
          notes?: string | null
          org_id: string
          paid_amount?: number
          payment_method?: string | null
          product_category: string
          product_label: string
          quantity: number
          recorded_by?: string | null
          sale_date: string
          unit: string
          unit_price: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          balance_due?: number
          batch_id?: string | null
          branch_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          farm_id?: string | null
          flock_id?: string | null
          gross_amount?: number
          house_id?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          paid_amount?: number
          payment_method?: string | null
          product_category?: string
          product_label?: string
          quantity?: number
          recorded_by?: string | null
          sale_date?: string
          unit?: string
          unit_price?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_records_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_records_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_records_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_records_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_records_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_task_attestations: {
        Row: {
          confirmed_by: string
          created_at: string
          derived_from_id: string | null
          farm_id: string
          flock_id: string | null
          governance_request_id: string | null
          id: string
          org_id: string
          source_fingerprint: string
          superseded_at: string | null
          task_code: string
          updated_at: string
          work_date: string
        }
        Insert: {
          confirmed_by: string
          created_at?: string
          derived_from_id?: string | null
          farm_id: string
          flock_id?: string | null
          governance_request_id?: string | null
          id?: string
          org_id: string
          source_fingerprint: string
          superseded_at?: string | null
          task_code: string
          updated_at?: string
          work_date: string
        }
        Update: {
          confirmed_by?: string
          created_at?: string
          derived_from_id?: string | null
          farm_id?: string
          flock_id?: string | null
          governance_request_id?: string | null
          id?: string
          org_id?: string
          source_fingerprint?: string
          superseded_at?: string | null
          task_code?: string
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_task_attestations_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_task_attestations_derived_from_id_fkey"
            columns: ["derived_from_id"]
            isOneToOne: false
            referencedRelation: "daily_task_attestations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_task_attestations_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_task_attestations_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_task_attestations_governance_request_id_fkey"
            columns: ["governance_request_id"]
            isOneToOne: false
            referencedRelation: "governance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_task_attestations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      egg_custody_opening_balances: {
        Row: {
          applied_by: string
          approved_by: string
          created_at: string
          effective_date: string
          farm_id: string
          flock_id: string
          governance_request_id: string
          id: string
          org_id: string
          quantity: number
          reason: string
          requested_by: string
          source_reference: string
        }
        Insert: {
          applied_by: string
          approved_by: string
          created_at?: string
          effective_date: string
          farm_id: string
          flock_id: string
          governance_request_id: string
          id?: string
          org_id: string
          quantity: number
          reason: string
          requested_by: string
          source_reference: string
        }
        Update: {
          applied_by?: string
          approved_by?: string
          created_at?: string
          effective_date?: string
          farm_id?: string
          flock_id?: string
          governance_request_id?: string
          id?: string
          org_id?: string
          quantity?: number
          reason?: string
          requested_by?: string
          source_reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "egg_custody_opening_balances_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "egg_custody_opening_balances_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "egg_custody_opening_balances_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "egg_custody_opening_balances_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "egg_custody_opening_balances_governance_request_id_fkey"
            columns: ["governance_request_id"]
            isOneToOne: true
            referencedRelation: "governance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "egg_custody_opening_balances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "egg_custody_opening_balances_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_operating_days: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          exceptions: Json
          farm_id: string
          id: string
          locked_at: string | null
          operating_date: string
          org_id: string
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          exceptions?: Json
          farm_id: string
          id?: string
          locked_at?: string | null
          operating_date: string
          org_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          exceptions?: Json
          farm_id?: string
          id?: string
          locked_at?: string | null
          operating_date?: string
          org_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_operating_days_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_operating_days_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_operating_days_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      feed_control_settings: {
        Row: {
          created_at: string
          critical_variance_pct: number
          id: string
          org_id: string
          updated_at: string
          warning_variance_pct: number
        }
        Insert: {
          created_at?: string
          critical_variance_pct?: number
          id?: string
          org_id: string
          updated_at?: string
          warning_variance_pct?: number
        }
        Update: {
          created_at?: string
          critical_variance_pct?: number
          id?: string
          org_id?: string
          updated_at?: string
          warning_variance_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "feed_control_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_day_closures: {
        Row: {
          actual_feed_kg: number
          batch_id: string
          closed_at: string | null
          closed_by: string | null
          created_at: string
          flock_id: string
          id: string
          org_id: string
          override_reason: string | null
          planned_feed_kg: number
          record_date: string
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          status: string
          updated_at: string
          variance_kg: number
        }
        Insert: {
          actual_feed_kg: number
          batch_id: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          flock_id: string
          id?: string
          org_id: string
          override_reason?: string | null
          planned_feed_kg?: number
          record_date: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
          updated_at?: string
          variance_kg?: number
        }
        Update: {
          actual_feed_kg?: number
          batch_id?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          flock_id?: string
          id?: string
          org_id?: string
          override_reason?: string | null
          planned_feed_kg?: number
          record_date?: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          status?: string
          updated_at?: string
          variance_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "feed_day_closures_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_day_closures_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_day_closures_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_day_closures_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_day_closures_reopened_by_fkey"
            columns: ["reopened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_milestone_executions: {
        Row: {
          completed_at: string
          completed_by: string | null
          created_at: string
          flock_id: string | null
          id: string
          milestone_id: string
          notes: string | null
          org_id: string
          status: string
        }
        Insert: {
          completed_at?: string
          completed_by?: string | null
          created_at?: string
          flock_id?: string | null
          id?: string
          milestone_id: string
          notes?: string | null
          org_id: string
          status?: string
        }
        Update: {
          completed_at?: string
          completed_by?: string | null
          created_at?: string
          flock_id?: string | null
          id?: string
          milestone_id?: string
          notes?: string | null
          org_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_milestone_executions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_milestone_executions_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_milestone_executions_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "batch_feed_template_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_milestone_executions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            foreignKeyName: "feeding_schedules_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          completed_at: string | null
          completed_by: string | null
          created_at: string
          feed_item_id: string | null
          feed_type: Database["public"]["Enums"]["feed_type"] | null
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
          status: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          warehouse_id: string | null
        }
        Insert: {
          actual_feed_kg?: number | null
          batch_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          feed_item_id?: string | null
          feed_type?: Database["public"]["Enums"]["feed_type"] | null
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
          status?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          warehouse_id?: string | null
        }
        Update: {
          actual_feed_kg?: number | null
          batch_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          feed_item_id?: string | null
          feed_type?: Database["public"]["Enums"]["feed_type"] | null
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
          status?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          warehouse_id?: string | null
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
            foreignKeyName: "feeding_session_records_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_session_records_feed_item_id_fkey"
            columns: ["feed_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
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
          {
            foreignKeyName: "feeding_session_records_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feeding_session_records_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      flock_cull_events: {
        Row: {
          count: number
          created_at: string
          flock_id: string
          id: string
          observed_by: string
          org_id: string
          reason: string
          record_date: string
        }
        Insert: {
          count: number
          created_at?: string
          flock_id: string
          id?: string
          observed_by: string
          org_id: string
          reason: string
          record_date: string
        }
        Update: {
          count?: number
          created_at?: string
          flock_id?: string
          id?: string
          observed_by?: string
          org_id?: string
          reason?: string
          record_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "flock_cull_events_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flock_cull_events_observed_by_fkey"
            columns: ["observed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flock_cull_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      flock_transfers: {
        Row: {
          bird_count: number | null
          created_at: string
          flock_id: string
          from_house_id: string
          governance_request_id: string | null
          id: string
          moved_at: string | null
          org_id: string
          reason: string | null
          to_house_id: string
          transfer_date: string
          updated_at: string
        }
        Insert: {
          bird_count?: number | null
          created_at?: string
          flock_id: string
          from_house_id: string
          governance_request_id?: string | null
          id?: string
          moved_at?: string | null
          org_id: string
          reason?: string | null
          to_house_id: string
          transfer_date: string
          updated_at?: string
        }
        Update: {
          bird_count?: number | null
          created_at?: string
          flock_id?: string
          from_house_id?: string
          governance_request_id?: string | null
          id?: string
          moved_at?: string | null
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
            foreignKeyName: "flock_transfers_governance_request_id_fkey"
            columns: ["governance_request_id"]
            isOneToOne: false
            referencedRelation: "governance_requests"
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
          age_at_placement_days: number
          batch_id: string | null
          breed_id: string | null
          completed_at: string | null
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
          placed_at: string | null
          placement_date: string
          purchase_cost_per_bird: number | null
          source: Database["public"]["Enums"]["flock_source"]
          status: Database["public"]["Enums"]["flock_status"]
          updated_at: string
        }
        Insert: {
          age_at_placement_days: number
          batch_id?: string | null
          breed_id?: string | null
          completed_at?: string | null
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
          placed_at?: string | null
          placement_date: string
          purchase_cost_per_bird?: number | null
          source: Database["public"]["Enums"]["flock_source"]
          status?: Database["public"]["Enums"]["flock_status"]
          updated_at?: string
        }
        Update: {
          age_at_placement_days?: number
          batch_id?: string | null
          breed_id?: string | null
          completed_at?: string | null
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
          placed_at?: string | null
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
      governance_audit_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          after_values: Json | null
          batch_id: string | null
          before_values: Json | null
          entity_id: string | null
          entity_table: string | null
          event_hash: string
          event_type: string
          farm_id: string | null
          flock_id: string | null
          house_id: string | null
          id: number
          ledger_scope: string
          metadata: Json
          occurred_at: string
          operation: string | null
          org_id: string | null
          previous_event_hash: string | null
          reason: string | null
          sequence_number: number
          source: string
          support_session_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          after_values?: Json | null
          batch_id?: string | null
          before_values?: Json | null
          entity_id?: string | null
          entity_table?: string | null
          event_hash: string
          event_type: string
          farm_id?: string | null
          flock_id?: string | null
          house_id?: string | null
          id?: never
          ledger_scope: string
          metadata?: Json
          occurred_at?: string
          operation?: string | null
          org_id?: string | null
          previous_event_hash?: string | null
          reason?: string | null
          sequence_number: number
          source?: string
          support_session_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          after_values?: Json | null
          batch_id?: string | null
          before_values?: Json | null
          entity_id?: string | null
          entity_table?: string | null
          event_hash?: string
          event_type?: string
          farm_id?: string | null
          flock_id?: string | null
          house_id?: string | null
          id?: never
          ledger_scope?: string
          metadata?: Json
          occurred_at?: string
          operation?: string | null
          org_id?: string | null
          previous_event_hash?: string | null
          reason?: string | null
          sequence_number?: number
          source?: string
          support_session_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_audit_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_audit_events_support_session_id_fkey"
            columns: ["support_session_id"]
            isOneToOne: false
            referencedRelation: "break_glass_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_request_activity: {
        Row: {
          action: string
          actor_id: string | null
          actor_name_snapshot: string
          actor_role_snapshot: string
          created_at: string
          id: number
          note: string | null
          org_id: string
          request_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name_snapshot: string
          actor_role_snapshot: string
          created_at?: string
          id?: never
          note?: string | null
          org_id: string
          request_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name_snapshot?: string
          actor_role_snapshot?: string
          created_at?: string
          id?: never
          note?: string | null
          org_id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_request_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_request_activity_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_request_activity_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "governance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_request_evidence: {
        Row: {
          byte_size: number | null
          content_type: string | null
          file_name: string | null
          id: string
          org_id: string
          reference_label: string | null
          reference_url: string | null
          request_id: string
          storage_path: string | null
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          byte_size?: number | null
          content_type?: string | null
          file_name?: string | null
          id?: string
          org_id: string
          reference_label?: string | null
          reference_url?: string | null
          request_id: string
          storage_path?: string | null
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          byte_size?: number | null
          content_type?: string | null
          file_name?: string | null
          id?: string
          org_id?: string
          reference_label?: string | null
          reference_url?: string | null
          request_id?: string
          storage_path?: string | null
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_request_evidence_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_request_evidence_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "governance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_request_evidence_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_requests: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          approval_expires_at: string | null
          attachments: Json
          changed_fields: string[]
          conflict_reason: string | null
          context_snapshot: Json
          correction_route: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          farm_id: string | null
          finding_id: string | null
          id: string
          idempotency_key: string | null
          intent: string
          latest_submitted_at: string
          org_id: string
          proposed_values: Json
          reason: string
          request_type: string
          requested_at: string
          requested_by: string
          requester_name_snapshot: string
          requester_role_snapshot: string
          requester_scope_snapshot: Json
          returned_at: string | null
          source_id: string | null
          source_table: string | null
          source_version: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          approval_expires_at?: string | null
          attachments?: Json
          changed_fields?: string[]
          conflict_reason?: string | null
          context_snapshot?: Json
          correction_route?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          farm_id?: string | null
          finding_id?: string | null
          id?: string
          idempotency_key?: string | null
          intent: string
          latest_submitted_at: string
          org_id: string
          proposed_values?: Json
          reason: string
          request_type: string
          requested_at?: string
          requested_by: string
          requester_name_snapshot: string
          requester_role_snapshot: string
          requester_scope_snapshot?: Json
          returned_at?: string | null
          source_id?: string | null
          source_table?: string | null
          source_version?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          approval_expires_at?: string | null
          attachments?: Json
          changed_fields?: string[]
          conflict_reason?: string | null
          context_snapshot?: Json
          correction_route?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          farm_id?: string | null
          finding_id?: string | null
          id?: string
          idempotency_key?: string | null
          intent?: string
          latest_submitted_at?: string
          org_id?: string
          proposed_values?: Json
          reason?: string
          request_type?: string
          requested_at?: string
          requested_by?: string
          requester_name_snapshot?: string
          requester_role_snapshot?: string
          requester_scope_snapshot?: Json
          returned_at?: string | null
          source_id?: string | null
          source_table?: string | null
          source_version?: string | null
          status?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_requests_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_requests_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_requests_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_requests_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_scheduler_health: {
        Row: {
          last_completed_at: string | null
          last_locked_count: number | null
          last_started_at: string | null
          scheduler_key: string
          updated_at: string
        }
        Insert: {
          last_completed_at?: string | null
          last_locked_count?: number | null
          last_started_at?: string | null
          scheduler_key: string
          updated_at?: string
        }
        Update: {
          last_completed_at?: string | null
          last_locked_count?: number | null
          last_started_at?: string | null
          scheduler_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      health_events: {
        Row: {
          attachment_url: string | null
          created_at: string
          description: string | null
          diagnosis: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["health_event_type"]
          external_veterinarian_name: string | null
          flock_id: string
          id: string
          org_id: string
          recommendation_status: string | null
          treatment: string | null
          updated_at: string
          vet_id: string | null
          veterinarian_attachment: Json | null
          veterinarian_recommendation: string | null
          veterinarian_reference: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          description?: string | null
          diagnosis?: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["health_event_type"]
          external_veterinarian_name?: string | null
          flock_id: string
          id?: string
          org_id: string
          recommendation_status?: string | null
          treatment?: string | null
          updated_at?: string
          vet_id?: string | null
          veterinarian_attachment?: Json | null
          veterinarian_recommendation?: string | null
          veterinarian_reference?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          description?: string | null
          diagnosis?: string | null
          event_date?: string
          event_type?: Database["public"]["Enums"]["health_event_type"]
          external_veterinarian_name?: string | null
          flock_id?: string
          id?: string
          org_id?: string
          recommendation_status?: string | null
          treatment?: string | null
          updated_at?: string
          vet_id?: string | null
          veterinarian_attachment?: Json | null
          veterinarian_recommendation?: string | null
          veterinarian_reference?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
          {
            foreignKeyName: "health_events_voided_by_fkey"
            columns: ["voided_by"]
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
      inventory_count_sessions: {
        Row: {
          count_month: string
          counted_on: string
          created_at: string
          id: string
          idempotency_key: string
          notes: string | null
          org_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string
          warehouse_id: string
        }
        Insert: {
          count_month: string
          counted_on: string
          created_at?: string
          id?: string
          idempotency_key: string
          notes?: string | null
          org_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by: string
          warehouse_id: string
        }
        Update: {
          count_month?: string
          counted_on?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          notes?: string | null
          org_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_count_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_count_sessions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_count_sessions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_count_sessions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
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
      inventory_physical_counts: {
        Row: {
          count_date: string
          counted_by: string
          counted_quantity: number
          created_at: string
          evidence: Json
          id: string
          item_id: string
          ledger_quantity: number
          notes: string | null
          org_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          session_id: string | null
          unit_cost: number
          updated_at: string
          variance: number | null
          warehouse_id: string
        }
        Insert: {
          count_date: string
          counted_by: string
          counted_quantity: number
          created_at?: string
          evidence?: Json
          id?: string
          item_id: string
          ledger_quantity: number
          notes?: string | null
          org_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          unit_cost?: number
          updated_at?: string
          variance?: number | null
          warehouse_id: string
        }
        Update: {
          count_date?: string
          counted_by?: string
          counted_quantity?: number
          created_at?: string
          evidence?: Json
          id?: string
          item_id?: string
          ledger_quantity?: number
          notes?: string | null
          org_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          unit_cost?: number
          updated_at?: string
          variance?: number | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_physical_counts_counted_by_fkey"
            columns: ["counted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_physical_counts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_physical_counts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_physical_counts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_physical_counts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "inventory_count_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_physical_counts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
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
      lifecycle_record_changes: {
        Row: {
          after_revision: string
          after_values: Json
          approved_fields: string[]
          before_values: Json
          created_at: string
          id: number
          org_id: string
          request_id: string
          source_id: string
          source_table: string
        }
        Insert: {
          after_revision: string
          after_values: Json
          approved_fields: string[]
          before_values: Json
          created_at?: string
          id?: never
          org_id: string
          request_id: string
          source_id: string
          source_table: string
        }
        Update: {
          after_revision?: string
          after_values?: Json
          approved_fields?: string[]
          before_values?: Json
          created_at?: string
          id?: never
          org_id?: string
          request_id?: string
          source_id?: string
          source_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "lifecycle_record_changes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lifecycle_record_changes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "governance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      management_report_runs: {
        Row: {
          created_at: string
          failure_message: string | null
          generated_at: string | null
          id: string
          org_id: string
          organization_name: string
          period_from: string
          period_to: string
          recipient_ids: string[]
          report_name: string
          report_snapshot: Json | null
          report_version: string
          requested_by: string
          requested_role: string
          schedule_id: string | null
          scope: Json
          snapshot_sha256: string | null
          status: string
        }
        Insert: {
          created_at?: string
          failure_message?: string | null
          generated_at?: string | null
          id?: string
          org_id: string
          organization_name: string
          period_from: string
          period_to: string
          recipient_ids?: string[]
          report_name: string
          report_snapshot?: Json | null
          report_version?: string
          requested_by: string
          requested_role: string
          schedule_id?: string | null
          scope?: Json
          snapshot_sha256?: string | null
          status: string
        }
        Update: {
          created_at?: string
          failure_message?: string | null
          generated_at?: string | null
          id?: string
          org_id?: string
          organization_name?: string
          period_from?: string
          period_to?: string
          recipient_ids?: string[]
          report_name?: string
          report_snapshot?: Json | null
          report_version?: string
          requested_by?: string
          requested_role?: string
          schedule_id?: string | null
          scope?: Json
          snapshot_sha256?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_report_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_report_runs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_report_runs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "management_report_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      management_report_schedules: {
        Row: {
          cadence: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          last_run_at: string | null
          lookback_days: number
          name: string
          next_run_at: string
          org_id: string
          recipient_ids: string[]
          run_day: number
          run_hour: number
          scope: Json
          updated_at: string
        }
        Insert: {
          cadence: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          lookback_days?: number
          name: string
          next_run_at: string
          org_id: string
          recipient_ids?: string[]
          run_day: number
          run_hour?: number
          scope?: Json
          updated_at?: string
        }
        Update: {
          cadence?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          lookback_days?: number
          name?: string
          next_run_at?: string
          org_id?: string
          recipient_ids?: string[]
          run_day?: number
          run_hour?: number
          scope?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_report_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_report_schedules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      management_targets: {
        Row: {
          cash_collection_target_pct: number | null
          created_at: string
          created_by: string | null
          id: string
          operating_margin_target_pct: number | null
          org_id: string
          period_month: string
          revenue_target_etb: number | null
          scope_id: string | null
          scope_type: string
          updated_at: string
        }
        Insert: {
          cash_collection_target_pct?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          operating_margin_target_pct?: number | null
          org_id: string
          period_month: string
          revenue_target_etb?: number | null
          scope_id?: string | null
          scope_type: string
          updated_at?: string
        }
        Update: {
          cash_collection_target_pct?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          operating_margin_target_pct?: number | null
          org_id?: string
          period_month?: string
          revenue_target_etb?: number | null
          scope_id?: string | null
          scope_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_targets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_cost_periods: {
        Row: {
          base_cost_per_egg: number | null
          batch_id: string | null
          bird_cogs: number
          branch_id: string | null
          cash_operating_surplus: number
          created_at: string
          direct_inventory_cost: number
          excluded_duplicate_cost: number
          farm_id: string | null
          flock_id: string | null
          house_id: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          operating_profit: number
          org_id: string
          overhead_cost: number
          period_end: string
          period_start: string
          reconciliation_warnings: Json
          status: Database["public"]["Enums"]["monthly_cost_status"]
          target_margin_per_egg: number
          total_absorbed_cost: number
          total_balance_due: number
          total_broken_eggs: number
          total_normal_eggs: number
          total_paid_revenue: number
          total_revenue: number
          unallocated_cost: number
          updated_at: string
        }
        Insert: {
          base_cost_per_egg?: number | null
          batch_id?: string | null
          bird_cogs?: number
          branch_id?: string | null
          cash_operating_surplus?: number
          created_at?: string
          direct_inventory_cost?: number
          excluded_duplicate_cost?: number
          farm_id?: string | null
          flock_id?: string | null
          house_id?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          operating_profit?: number
          org_id: string
          overhead_cost?: number
          period_end: string
          period_start: string
          reconciliation_warnings?: Json
          status?: Database["public"]["Enums"]["monthly_cost_status"]
          target_margin_per_egg?: number
          total_absorbed_cost?: number
          total_balance_due?: number
          total_broken_eggs?: number
          total_normal_eggs?: number
          total_paid_revenue?: number
          total_revenue?: number
          unallocated_cost?: number
          updated_at?: string
        }
        Update: {
          base_cost_per_egg?: number | null
          batch_id?: string | null
          bird_cogs?: number
          branch_id?: string | null
          cash_operating_surplus?: number
          created_at?: string
          direct_inventory_cost?: number
          excluded_duplicate_cost?: number
          farm_id?: string | null
          flock_id?: string | null
          house_id?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          operating_profit?: number
          org_id?: string
          overhead_cost?: number
          period_end?: string
          period_start?: string
          reconciliation_warnings?: Json
          status?: Database["public"]["Enums"]["monthly_cost_status"]
          target_margin_per_egg?: number
          total_absorbed_cost?: number
          total_balance_due?: number
          total_broken_eggs?: number
          total_normal_eggs?: number
          total_paid_revenue?: number
          total_revenue?: number
          unallocated_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_cost_periods_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cost_periods_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cost_periods_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cost_periods_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cost_periods_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cost_periods_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_cost_periods_org_id_fkey"
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
      notification_delivery_attempts: {
        Row: {
          attempt_number: number
          attempted_at: string
          channel: string
          failure_code: string | null
          id: number
          notification_id: string
          org_id: string
          provider: string
          provider_message_id: string | null
          retry_after: string | null
          status: string
        }
        Insert: {
          attempt_number: number
          attempted_at?: string
          channel: string
          failure_code?: string | null
          id?: never
          notification_id: string
          org_id: string
          provider: string
          provider_message_id?: string | null
          retry_after?: string | null
          status: string
        }
        Update: {
          attempt_number?: number
          attempted_at?: string
          channel?: string
          failure_code?: string | null
          id?: never
          notification_id?: string
          org_id?: string
          provider?: string
          provider_message_id?: string | null
          retry_after?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_delivery_attempts_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_delivery_attempts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email_enabled: boolean
          email_minimum_severity: string
          in_app_minimum_severity: string
          org_id: string
          profile_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          email_enabled?: boolean
          email_minimum_severity?: string
          in_app_minimum_severity?: string
          org_id: string
          profile_id: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          email_enabled?: boolean
          email_minimum_severity?: string
          in_app_minimum_severity?: string
          org_id?: string
          profile_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_event_id: number
          action_id: string
          archived_at: string | null
          created_at: string
          event_type: string
          id: string
          message: string
          org_id: string
          read_at: string | null
          recipient_id: string
          route: string
          severity: string
          title: string
        }
        Insert: {
          action_event_id: number
          action_id: string
          archived_at?: string | null
          created_at?: string
          event_type: string
          id?: string
          message: string
          org_id: string
          read_at?: string | null
          recipient_id: string
          route: string
          severity: string
          title: string
        }
        Update: {
          action_event_id?: number
          action_id?: string
          archived_at?: string | null
          created_at?: string
          event_type?: string
          id?: string
          message?: string
          org_id?: string
          read_at?: string | null
          recipient_id?: string
          route?: string
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_action_event_id_fkey"
            columns: ["action_event_id"]
            isOneToOne: false
            referencedRelation: "operational_action_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "operational_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_action_events: {
        Row: {
          action_id: string
          actor_id: string | null
          actor_name_snapshot: string
          actor_role_snapshot: string
          after_status: string | null
          before_status: string | null
          created_at: string
          event_type: string
          evidence: string | null
          id: number
          note: string | null
          org_id: string
          support_session_id: string | null
        }
        Insert: {
          action_id: string
          actor_id?: string | null
          actor_name_snapshot: string
          actor_role_snapshot: string
          after_status?: string | null
          before_status?: string | null
          created_at?: string
          event_type: string
          evidence?: string | null
          id?: never
          note?: string | null
          org_id: string
          support_session_id?: string | null
        }
        Update: {
          action_id?: string
          actor_id?: string | null
          actor_name_snapshot?: string
          actor_role_snapshot?: string
          after_status?: string | null
          before_status?: string | null
          created_at?: string
          event_type?: string
          evidence?: string | null
          id?: never
          note?: string | null
          org_id?: string
          support_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operational_action_events_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "operational_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_action_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_action_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_action_events_support_session_id_fkey"
            columns: ["support_session_id"]
            isOneToOne: false
            referencedRelation: "break_glass_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_actions: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          assigned_at: string | null
          assigned_by: string | null
          context: string
          created_at: string
          due_at: string
          escalated_at: string | null
          escalation_reason: string | null
          farm_id: string | null
          id: string
          org_id: string
          owner_id: string | null
          resolution_evidence: string | null
          resolution_submitted_at: string | null
          resolution_submitted_by: string | null
          resolution_summary: string | null
          severity: string
          source_first_seen_at: string
          source_key: string
          source_last_seen_at: string
          source_name: string
          source_resolved_at: string | null
          source_route: string
          status: string
          title: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          context: string
          created_at?: string
          due_at: string
          escalated_at?: string | null
          escalation_reason?: string | null
          farm_id?: string | null
          id?: string
          org_id: string
          owner_id?: string | null
          resolution_evidence?: string | null
          resolution_submitted_at?: string | null
          resolution_submitted_by?: string | null
          resolution_summary?: string | null
          severity: string
          source_first_seen_at: string
          source_key: string
          source_last_seen_at: string
          source_name: string
          source_resolved_at?: string | null
          source_route: string
          status?: string
          title: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          context?: string
          created_at?: string
          due_at?: string
          escalated_at?: string | null
          escalation_reason?: string | null
          farm_id?: string | null
          id?: string
          org_id?: string
          owner_id?: string | null
          resolution_evidence?: string | null
          resolution_submitted_at?: string | null
          resolution_submitted_by?: string | null
          resolution_summary?: string | null
          severity?: string
          source_first_seen_at?: string
          source_key?: string
          source_last_seen_at?: string
          source_name?: string
          source_resolved_at?: string | null
          source_route?: string
          status?: string
          title?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operational_actions_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_actions_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_actions_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_actions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_actions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_actions_resolution_submitted_by_fkey"
            columns: ["resolution_submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_actions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
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
          operational_day_lock_grace_days: number
          operational_day_lock_time: string
          plan: string | null
          primary_location: string | null
          settings_json: Json | null
          simplified_ceo_workspace_enabled: boolean
          today_pilot_accepted_at: string | null
          today_workspace_enabled: boolean
          updated_at: string
        }
        Insert: {
          branch_count?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          operational_day_lock_grace_days?: number
          operational_day_lock_time?: string
          plan?: string | null
          primary_location?: string | null
          settings_json?: Json | null
          simplified_ceo_workspace_enabled?: boolean
          today_pilot_accepted_at?: string | null
          today_workspace_enabled?: boolean
          updated_at?: string
        }
        Update: {
          branch_count?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          operational_day_lock_grace_days?: number
          operational_day_lock_time?: string
          plan?: string | null
          primary_location?: string | null
          settings_json?: Json | null
          simplified_ceo_workspace_enabled?: boolean
          today_pilot_accepted_at?: string | null
          today_workspace_enabled?: boolean
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
      platform_operational_evidence: {
        Row: {
          checked_at: string
          details: Json
          duration_ms: number | null
          environment: string
          evidence_kind: string
          id: number
          idempotency_key: string
          inserted_at: string
          provider: string
          release: string | null
          status: string
          summary: string
        }
        Insert: {
          checked_at: string
          details?: Json
          duration_ms?: number | null
          environment: string
          evidence_kind: string
          id?: never
          idempotency_key: string
          inserted_at?: string
          provider: string
          release?: string | null
          status: string
          summary: string
        }
        Update: {
          checked_at?: string
          details?: Json
          duration_ms?: number | null
          environment?: string
          evidence_kind?: string
          id?: never
          idempotency_key?: string
          inserted_at?: string
          provider?: string
          release?: string | null
          status?: string
          summary?: string
        }
        Relationships: []
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
          preferred_locale: string
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
          preferred_locale?: string
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
          preferred_locale?: string
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
      reconciliation_ai_analyses: {
        Row: {
          analysis_output: Json | null
          created_at: string
          error_code: string | null
          evidence_hash: string
          evidence_snapshot: Json
          finding_fingerprint: string
          finding_id: string
          id: string
          input_tokens: number | null
          latency_ms: number
          model: string
          org_id: string
          output_tokens: number | null
          prompt_version: string
          provider: string
          request_key: string | null
          requested_by: string | null
          requester_role: string
          schema_version: string
          status: string
          support_session_id: string | null
          total_tokens: number | null
        }
        Insert: {
          analysis_output?: Json | null
          created_at?: string
          error_code?: string | null
          evidence_hash: string
          evidence_snapshot?: Json
          finding_fingerprint: string
          finding_id: string
          id?: string
          input_tokens?: number | null
          latency_ms: number
          model: string
          org_id: string
          output_tokens?: number | null
          prompt_version: string
          provider?: string
          request_key?: string | null
          requested_by?: string | null
          requester_role: string
          schema_version: string
          status: string
          support_session_id?: string | null
          total_tokens?: number | null
        }
        Update: {
          analysis_output?: Json | null
          created_at?: string
          error_code?: string | null
          evidence_hash?: string
          evidence_snapshot?: Json
          finding_fingerprint?: string
          finding_id?: string
          id?: string
          input_tokens?: number | null
          latency_ms?: number
          model?: string
          org_id?: string
          output_tokens?: number | null
          prompt_version?: string
          provider?: string
          request_key?: string | null
          requested_by?: string | null
          requester_role?: string
          schema_version?: string
          status?: string
          support_session_id?: string | null
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_ai_analyses_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_ai_analyses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_ai_analyses_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_ai_analyses_support_session_id_fkey"
            columns: ["support_session_id"]
            isOneToOne: false
            referencedRelation: "break_glass_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_finding_responses: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string
          evidence: Json
          finding_id: string
          id: string
          note: string
          org_id: string
          support_session_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          evidence?: Json
          finding_id: string
          id?: string
          note: string
          org_id: string
          support_session_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          evidence?: Json
          finding_id?: string
          id?: string
          note?: string
          org_id?: string
          support_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_finding_responses_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_finding_responses_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_finding_responses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_finding_responses_support_session_id_fkey"
            columns: ["support_session_id"]
            isOneToOne: false
            referencedRelation: "break_glass_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_findings: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          assigned_to: string | null
          batch_id: string | null
          branch_id: string | null
          created_at: string
          domain: string
          estimated_impact_etb: number | null
          evidence: Json
          expected_value: number | null
          explanation: string
          farm_id: string | null
          fingerprint: string
          first_seen_at: string
          flock_id: string | null
          house_id: string | null
          id: string
          last_seen_at: string
          occurrence_count: number
          org_id: string
          recommended_action: string
          record_date: string | null
          recorded_value: number | null
          reopened_count: number
          resolution_evidence: Json
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          rule_code: string
          run_id: string | null
          severity: string
          status: string
          title: string
          unit: string | null
          updated_at: string
          variance: number | null
          warehouse_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_to?: string | null
          batch_id?: string | null
          branch_id?: string | null
          created_at?: string
          domain: string
          estimated_impact_etb?: number | null
          evidence?: Json
          expected_value?: number | null
          explanation: string
          farm_id?: string | null
          fingerprint: string
          first_seen_at?: string
          flock_id?: string | null
          house_id?: string | null
          id?: string
          last_seen_at?: string
          occurrence_count?: number
          org_id: string
          recommended_action: string
          record_date?: string | null
          recorded_value?: number | null
          reopened_count?: number
          resolution_evidence?: Json
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_code: string
          run_id?: string | null
          severity: string
          status?: string
          title: string
          unit?: string | null
          updated_at?: string
          variance?: number | null
          warehouse_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          assigned_to?: string | null
          batch_id?: string | null
          branch_id?: string | null
          created_at?: string
          domain?: string
          estimated_impact_etb?: number | null
          evidence?: Json
          expected_value?: number | null
          explanation?: string
          farm_id?: string | null
          fingerprint?: string
          first_seen_at?: string
          flock_id?: string | null
          house_id?: string | null
          id?: string
          last_seen_at?: string
          occurrence_count?: number
          org_id?: string
          recommended_action?: string
          record_date?: string | null
          recorded_value?: number | null
          reopened_count?: number
          resolution_evidence?: Json
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_code?: string
          run_id?: string | null
          severity?: string
          status?: string
          title?: string
          unit?: string | null
          updated_at?: string
          variance?: number | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_findings_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_findings_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_findings_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_findings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_findings_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_findings_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: false
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_findings_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_findings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_findings_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_findings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_findings_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          critical_count: number
          date_from: string
          date_to: string
          error_message: string | null
          finding_count: number
          high_count: number
          id: string
          org_id: string
          started_at: string
          status: string
          trigger_source: string
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          critical_count?: number
          date_from: string
          date_to: string
          error_message?: string | null
          finding_count?: number
          high_count?: number
          id?: string
          org_id: string
          started_at?: string
          status?: string
          trigger_source?: string
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          critical_count?: number
          date_from?: string
          date_to?: string
          error_message?: string | null
          finding_count?: number
          high_count?: number
          id?: string
          org_id?: string
          started_at?: string
          status?: string
          trigger_source?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_runs_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_cost_templates: {
        Row: {
          category: Database["public"]["Enums"]["cost_entry_category"]
          created_at: string
          created_by: string | null
          default_amount: number
          description: string
          id: string
          is_active: boolean
          org_id: string
          supplier_name: string | null
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["cost_entry_category"]
          created_at?: string
          created_by?: string | null
          default_amount: number
          description: string
          id?: string
          is_active?: boolean
          org_id: string
          supplier_name?: string | null
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["cost_entry_category"]
          created_at?: string
          created_by?: string | null
          default_amount?: number
          description?: string
          id?: string
          is_active?: boolean
          org_id?: string
          supplier_name?: string | null
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_cost_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_cost_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_cost_templates_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
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
      sales_unit_conversions: {
        Row: {
          base_unit: string
          created_at: string
          id: string
          multiplier: number
          org_id: string
          product_category: string
          source: string
          unit: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_unit: string
          created_at?: string
          id?: string
          multiplier: number
          org_id: string
          product_category: string
          source?: string
          unit: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_unit?: string
          created_at?: string
          id?: string
          multiplier?: number
          org_id?: string
          product_category?: string
          source?: string
          unit?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_unit_conversions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_unit_conversions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          cost_method: string
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
          procurement_type:
            | Database["public"]["Enums"]["procurement_type"]
            | null
          quantity: number
          recorded_by: string | null
          reference_doc: string | null
          source_key: string | null
          source_kind: string | null
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
          cost_method?: string
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
          procurement_type?:
            | Database["public"]["Enums"]["procurement_type"]
            | null
          quantity: number
          recorded_by?: string | null
          reference_doc?: string | null
          source_key?: string | null
          source_kind?: string | null
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
          cost_method?: string
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
          procurement_type?:
            | Database["public"]["Enums"]["procurement_type"]
            | null
          quantity?: number
          recorded_by?: string | null
          reference_doc?: string | null
          source_key?: string | null
          source_kind?: string | null
          supplier_name?: string | null
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["stock_txn_type"]
          unit_cost?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_ledger_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_daily_record_id_fkey"
            columns: ["daily_record_id"]
            isOneToOne: false
            referencedRelation: "daily_farm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
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
            foreignKeyName: "stock_ledger_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
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
          profile_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          profile_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
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
          expires_at: string | null
          farm_id: string
          granted_by: string | null
          id: string
          org_id: string
          profile_id: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          starts_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          farm_id: string
          granted_by?: string | null
          id?: string
          org_id: string
          profile_id: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          starts_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          farm_id?: string
          granted_by?: string | null
          id?: string
          org_id?: string
          profile_id?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          starts_at?: string
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
            foreignKeyName: "user_farm_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          {
            foreignKeyName: "user_farm_access_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_warehouse_access: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_by: string | null
          id: string
          org_id: string
          profile_id: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          starts_at: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          org_id: string
          profile_id: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          starts_at?: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          org_id?: string
          profile_id?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          starts_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_warehouse_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_warehouse_access_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_warehouse_access_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_warehouse_access_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_warehouse_access_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
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
          external_veterinarian_name: string | null
          flock_id: string
          id: string
          org_id: string
          recommendation_status: string | null
          route: Database["public"]["Enums"]["vaccination_route"]
          updated_at: string
          vaccine_name: string
          vet_id: string | null
          veterinarian_attachment: Json | null
          veterinarian_recommendation: string | null
          veterinarian_reference: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          batch_number?: string | null
          birds_vaccinated?: number | null
          created_at?: string
          dosage?: string | null
          event_date: string
          expiry_date?: string | null
          external_veterinarian_name?: string | null
          flock_id: string
          id?: string
          org_id: string
          recommendation_status?: string | null
          route: Database["public"]["Enums"]["vaccination_route"]
          updated_at?: string
          vaccine_name: string
          vet_id?: string | null
          veterinarian_attachment?: Json | null
          veterinarian_recommendation?: string | null
          veterinarian_reference?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          batch_number?: string | null
          birds_vaccinated?: number | null
          created_at?: string
          dosage?: string | null
          event_date?: string
          expiry_date?: string | null
          external_veterinarian_name?: string | null
          flock_id?: string
          id?: string
          org_id?: string
          recommendation_status?: string | null
          route?: Database["public"]["Enums"]["vaccination_route"]
          updated_at?: string
          vaccine_name?: string
          vet_id?: string | null
          veterinarian_attachment?: Json | null
          veterinarian_recommendation?: string | null
          veterinarian_reference?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
          {
            foreignKeyName: "vaccination_events_voided_by_fkey"
            columns: ["voided_by"]
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
      warehouse_inventory_initializations: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          opened_by: string
          opened_on: string
          org_id: string
          row_count: number
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          opened_by: string
          opened_on: string
          org_id: string
          row_count: number
          warehouse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          opened_by?: string
          opened_on?: string
          org_id?: string
          row_count?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_inventory_initializations_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_inventory_initializations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_inventory_initializations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: true
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          branch_id: string
          created_at: string
          farm_id: string | null
          id: string
          name: string
          org_id: string
          status: string
          type: Database["public"]["Enums"]["warehouse_type"]
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          farm_id?: string | null
          id?: string
          name: string
          org_id: string
          status?: string
          type: Database["public"]["Enums"]["warehouse_type"]
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          farm_id?: string | null
          id?: string
          name?: string
          org_id?: string
          status?: string
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
            foreignKeyName: "warehouses_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
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
      effective_cycle_clearances: {
        Row: {
          before_clearance_birds: number | null
          closure_id: string | null
          created_at: string | null
          daily_record_id: string | null
          flock_id: string | null
          house_id: string | null
          id: string | null
          org_id: string | null
          source_snapshot: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_cycle_clearances_closure_id_fkey"
            columns: ["closure_id"]
            isOneToOne: false
            referencedRelation: "batch_cycle_closures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_cycle_clearances_daily_record_id_fkey"
            columns: ["daily_record_id"]
            isOneToOne: false
            referencedRelation: "daily_farm_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_cycle_clearances_flock_id_fkey"
            columns: ["flock_id"]
            isOneToOne: true
            referencedRelation: "flocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_cycle_clearances_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_cycle_clearances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      effective_cycle_dispositions: {
        Row: {
          cycle_id: string | null
          flock_id: string | null
          kind: string | null
          org_id: string | null
          quantity: number | null
          reason: string | null
          sale_id: string | null
          supporting_reference: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_reconciliation_exception: {
        Args: { p_evidence: Json; p_finding_id: string; p_note: string }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          assigned_to: string | null
          batch_id: string | null
          branch_id: string | null
          created_at: string
          domain: string
          estimated_impact_etb: number | null
          evidence: Json
          expected_value: number | null
          explanation: string
          farm_id: string | null
          fingerprint: string
          first_seen_at: string
          flock_id: string | null
          house_id: string | null
          id: string
          last_seen_at: string
          occurrence_count: number
          org_id: string
          recommended_action: string
          record_date: string | null
          recorded_value: number | null
          reopened_count: number
          resolution_evidence: Json
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          rule_code: string
          run_id: string | null
          severity: string
          status: string
          title: string
          unit: string | null
          updated_at: string
          variance: number | null
          warehouse_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "reconciliation_findings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      append_archived_accounting: {
        Args: { r: Database["public"]["Tables"]["governance_requests"]["Row"] }
        Returns: undefined
      }
      append_lifecycle_change: {
        Args: {
          p_after: Json
          p_before: Json
          p_fields: string[]
          p_id: string
          p_request: Database["public"]["Tables"]["governance_requests"]["Row"]
          p_table: string
        }
        Returns: undefined
      }
      apply_archived_loss_events: {
        Args: { r: Database["public"]["Tables"]["governance_requests"]["Row"] }
        Returns: undefined
      }
      apply_batch_cycle_close_v1: {
        Args: {
          p_request: Database["public"]["Tables"]["governance_requests"]["Row"]
        }
        Returns: string
      }
      apply_batch_cycle_create_v1: {
        Args: {
          p_request: Database["public"]["Tables"]["governance_requests"]["Row"]
        }
        Returns: string
      }
      apply_daily_task_attestation_v1: {
        Args: {
          p_actor_id: string
          p_command_id: string
          p_command_type: string
          p_expected_source_fingerprint: string
          p_farm_id: string
          p_flock_id: string
          p_payload: Json
          p_schema_version: number
          p_task_code: string
          p_work_date: string
        }
        Returns: Json
      }
      apply_egg_opening_balance_request: {
        Args: { p_request_id: string }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          approval_expires_at: string | null
          attachments: Json
          changed_fields: string[]
          conflict_reason: string | null
          context_snapshot: Json
          correction_route: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          farm_id: string | null
          finding_id: string | null
          id: string
          idempotency_key: string | null
          intent: string
          latest_submitted_at: string
          org_id: string
          proposed_values: Json
          reason: string
          request_type: string
          requested_at: string
          requested_by: string
          requester_name_snapshot: string
          requester_role_snapshot: string
          requester_scope_snapshot: Json
          returned_at: string | null
          source_id: string | null
          source_table: string | null
          source_version: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "governance_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_governance_request: {
        Args: { p_request_id: string }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          approval_expires_at: string | null
          attachments: Json
          changed_fields: string[]
          conflict_reason: string | null
          context_snapshot: Json
          correction_route: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          farm_id: string | null
          finding_id: string | null
          id: string
          idempotency_key: string | null
          intent: string
          latest_submitted_at: string
          org_id: string
          proposed_values: Json
          reason: string
          request_type: string
          requested_at: string
          requested_by: string
          requester_name_snapshot: string
          requester_role_snapshot: string
          requester_scope_snapshot: Json
          returned_at: string | null
          source_id: string | null
          source_table: string | null
          source_version: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "governance_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_governance_request_pre_archived_correction: {
        Args: { p_request_id: string }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          approval_expires_at: string | null
          attachments: Json
          changed_fields: string[]
          conflict_reason: string | null
          context_snapshot: Json
          correction_route: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          farm_id: string | null
          finding_id: string | null
          id: string
          idempotency_key: string | null
          intent: string
          latest_submitted_at: string
          org_id: string
          proposed_values: Json
          reason: string
          request_type: string
          requested_at: string
          requested_by: string
          requester_name_snapshot: string
          requester_role_snapshot: string
          requester_scope_snapshot: Json
          returned_at: string | null
          source_id: string | null
          source_table: string | null
          source_version: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "governance_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_governance_request_pre_cycles: {
        Args: { p_request_id: string }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          approval_expires_at: string | null
          attachments: Json
          changed_fields: string[]
          conflict_reason: string | null
          context_snapshot: Json
          correction_route: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          farm_id: string | null
          finding_id: string | null
          id: string
          idempotency_key: string | null
          intent: string
          latest_submitted_at: string
          org_id: string
          proposed_values: Json
          reason: string
          request_type: string
          requested_at: string
          requested_by: string
          requester_name_snapshot: string
          requester_role_snapshot: string
          requester_scope_snapshot: Json
          returned_at: string | null
          source_id: string | null
          source_table: string | null
          source_version: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "governance_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_governance_request_pre_moves: {
        Args: { p_request_id: string }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          approval_expires_at: string | null
          attachments: Json
          changed_fields: string[]
          conflict_reason: string | null
          context_snapshot: Json
          correction_route: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          farm_id: string | null
          finding_id: string | null
          id: string
          idempotency_key: string | null
          intent: string
          latest_submitted_at: string
          org_id: string
          proposed_values: Json
          reason: string
          request_type: string
          requested_at: string
          requested_by: string
          requester_name_snapshot: string
          requester_role_snapshot: string
          requester_scope_snapshot: Json
          returned_at: string | null
          source_id: string | null
          source_table: string | null
          source_version: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "governance_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_sales_unit_conversion_request: {
        Args: { p_request_id: string }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          approval_expires_at: string | null
          attachments: Json
          changed_fields: string[]
          conflict_reason: string | null
          context_snapshot: Json
          correction_route: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          farm_id: string | null
          finding_id: string | null
          id: string
          idempotency_key: string | null
          intent: string
          latest_submitted_at: string
          org_id: string
          proposed_values: Json
          reason: string
          request_type: string
          requested_at: string
          requested_by: string
          requester_name_snapshot: string
          requester_role_snapshot: string
          requester_scope_snapshot: Json
          returned_at: string | null
          source_id: string | null
          source_table: string | null
          source_version: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "governance_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_today_workspace_rollout: {
        Args: {
          p_actor_id: string
          p_enabled: boolean
          p_org_id: string
          p_reason: string
          p_release_reference: string
        }
        Returns: Json
      }
      archived_cycle_revision: {
        Args: { p_cycle: string; p_org: string }
        Returns: string
      }
      archived_cycle_sale_choices: {
        Args: { p_cycle: string; p_org: string }
        Returns: {
          head_count: number
          id: string
          label: string
          revision: string
          unit: string
        }[]
      }
      assert_lifecycle_house_available: {
        Args: {
          p_arrival: string
          p_exclude?: string
          p_farm: string
          p_house: string
          p_org: string
        }
        Returns: undefined
      }
      audit_event_digest: {
        Args: {
          event: Database["public"]["Tables"]["governance_audit_events"]["Row"]
        }
        Returns: string
      }
      auth_org_id: { Args: never; Returns: string }
      canonical_today_payload_hash: {
        Args: { p_payload: Json }
        Returns: string
      }
      ceo_initialize_branch_hierarchy: {
        Args: {
          p_branch: Json
          p_farms: Json
          p_intake_batch: Json
          p_manager: Json
          p_org_id: string
        }
        Returns: Json
      }
      ceo_toggle_today_workspace: {
        Args: { p_actor_id: string; p_enabled: boolean; p_reason: string }
        Returns: Json
      }
      change_farm_manager_assignment: {
        Args: {
          p_actor_id: string
          p_assignment_id: string
          p_expected_revision: string
          p_expires_at: string
          p_farm_id: string
          p_manager_id: string
          p_operation: string
          p_reason: string
          p_starts_at: string
        }
        Returns: Json
      }
      close_farm_operating_day: {
        Args: {
          p_exceptions?: Json
          p_farm_id: string
          p_operating_date: string
        }
        Returns: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          exceptions: Json
          farm_id: string
          id: string
          locked_at: string | null
          operating_date: string
          org_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "farm_operating_days"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_feed_day: {
        Args: {
          p_actor_id: string
          p_flock_id: string
          p_override_reason?: string
          p_record_date: string
        }
        Returns: Json
      }
      complete_vaccination_with_inventory:
        | {
            Args: {
              p_actor_id: string
              p_item_id: string
              p_quantity: number
              p_schedule_id: string
              p_warehouse_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_actor_id: string
              p_administered_on: string
              p_item_id: string
              p_quantity: number
              p_schedule_id: string
              p_warehouse_id: string
            }
            Returns: Json
          }
      create_branch_batch_cycle: {
        Args: {
          p_batch: Json
          p_branch_id: string
          p_flock_slots: Json
          p_org_id: string
        }
        Returns: Json
      }
      current_active_role: { Args: never; Returns: string }
      current_org_id: { Args: never; Returns: string }
      decide_break_glass_request: {
        Args: { p_decision: string; p_note: string; p_request_id: string }
        Returns: {
          administrator_id: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          expires_at: string | null
          id: string
          reason: string
          requested_at: string
          requested_minutes: number
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: string
          target_org_id: string
          ticket_reference: string
        }
        SetofOptions: {
          from: "*"
          to: "break_glass_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_governance_request: {
        Args: { p_decision: string; p_note: string; p_request_id: string }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          approval_expires_at: string | null
          attachments: Json
          changed_fields: string[]
          conflict_reason: string | null
          context_snapshot: Json
          correction_route: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          farm_id: string | null
          finding_id: string | null
          id: string
          idempotency_key: string | null
          intent: string
          latest_submitted_at: string
          org_id: string
          proposed_values: Json
          reason: string
          request_type: string
          requested_at: string
          requested_by: string
          requester_name_snapshot: string
          requester_role_snapshot: string
          requester_scope_snapshot: Json
          returned_at: string | null
          source_id: string | null
          source_table: string | null
          source_version: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "governance_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_governance_request_pre_archived_correction: {
        Args: { p_decision: string; p_note: string; p_request_id: string }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          approval_expires_at: string | null
          attachments: Json
          changed_fields: string[]
          conflict_reason: string | null
          context_snapshot: Json
          correction_route: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          farm_id: string | null
          finding_id: string | null
          id: string
          idempotency_key: string | null
          intent: string
          latest_submitted_at: string
          org_id: string
          proposed_values: Json
          reason: string
          request_type: string
          requested_at: string
          requested_by: string
          requester_name_snapshot: string
          requester_role_snapshot: string
          requester_scope_snapshot: Json
          returned_at: string | null
          source_id: string | null
          source_table: string | null
          source_version: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "governance_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_governance_request_pre_cycles: {
        Args: { p_decision: string; p_note: string; p_request_id: string }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          approval_expires_at: string | null
          attachments: Json
          changed_fields: string[]
          conflict_reason: string | null
          context_snapshot: Json
          correction_route: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          farm_id: string | null
          finding_id: string | null
          id: string
          idempotency_key: string | null
          intent: string
          latest_submitted_at: string
          org_id: string
          proposed_values: Json
          reason: string
          request_type: string
          requested_at: string
          requested_by: string
          requester_name_snapshot: string
          requester_role_snapshot: string
          requester_scope_snapshot: Json
          returned_at: string | null
          source_id: string | null
          source_table: string | null
          source_version: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "governance_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_governance_request_pre_moves: {
        Args: { p_decision: string; p_note: string; p_request_id: string }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          approval_expires_at: string | null
          attachments: Json
          changed_fields: string[]
          conflict_reason: string | null
          context_snapshot: Json
          correction_route: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          farm_id: string | null
          finding_id: string | null
          id: string
          idempotency_key: string | null
          intent: string
          latest_submitted_at: string
          org_id: string
          proposed_values: Json
          reason: string
          request_type: string
          requested_at: string
          requested_by: string
          requester_name_snapshot: string
          requester_role_snapshot: string
          requester_scope_snapshot: Json
          returned_at: string | null
          source_id: string | null
          source_table: string | null
          source_version: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "governance_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dispatch_today_command_v1: {
        Args: { p_actor_id: string; p_command: Json }
        Returns: Json
      }
      dispatch_today_command_v1_pre_stock_count_v1: {
        Args: { p_actor_id: string; p_command: Json }
        Returns: Json
      }
      exact_lifecycle_corrections: {
        Args: { p_org: string }
        Returns: {
          source_id: string
        }[]
      }
      execute_today_command_v1: {
        Args: { p_actor_id: string; p_command: Json }
        Returns: Json
      }
      execute_today_stock_count_v1: {
        Args: { p_actor_id: string; p_command: Json }
        Returns: Json
      }
      expire_governance_authorizations: { Args: never; Returns: number }
      farm_manager_handover_preview: {
        Args: {
          p_actor_id: string
          p_farm_id: string
          p_replacement_id: string
        }
        Returns: Json
      }
      finish_farm_operating_day_v1: {
        Args: {
          p_actor_id: string
          p_command_id: string
          p_expected_revision: string
          p_farm_id: string
          p_operating_date: string
          p_payload: Json
          p_schema_version: number
        }
        Returns: Json
      }
      flock_operates_on: {
        Args: {
          p_day: string
          p_flock: Database["public"]["Tables"]["flocks"]["Row"]
        }
        Returns: boolean
      }
      generate_batch_code: { Args: never; Returns: string }
      governance_source_version: {
        Args: { p_id: string; p_org: string; p_table: string }
        Returns: string
      }
      governance_source_version_pre_cycles: {
        Args: { p_id: string; p_org_id: string; p_table: string }
        Returns: string
      }
      has_active_break_glass: { Args: { p_org_id: string }; Returns: boolean }
      has_active_farm_access: { Args: { p_farm_id: string }; Returns: boolean }
      has_active_warehouse_access: {
        Args: { p_warehouse_id: string }
        Returns: boolean
      }
      initialize_warehouse_inventory: {
        Args: {
          p_actor_id: string
          p_idempotency_key: string
          p_opened_on: string
          p_rows: Json
          p_warehouse_id: string
        }
        Returns: Json
      }
      lifecycle_cycle_revision: {
        Args: { p_cycle: string; p_day: string; p_org: string }
        Returns: string
      }
      lifecycle_farm_revision: {
        Args: { p_day: string; p_farm: string; p_org: string }
        Returns: string
      }
      lifecycle_flock_revision: {
        Args: { p_flock: string; p_org: string }
        Returns: string
      }
      lifecycle_house_revision: {
        Args: { p_house: string; p_org: string }
        Returns: string
      }
      lifecycle_sale_revision: {
        Args: { p_org: string; p_sale: string }
        Returns: string
      }
      lock_overdue_operating_days: { Args: never; Returns: number }
      manager_has_effective_warehouse_access: {
        Args: { p_actor_id: string; p_warehouse_id: string }
        Returns: boolean
      }
      manager_warehouse_access_scope: {
        Args: { p_actor_id: string; p_org_id: string }
        Returns: {
          access_source: string
          branch_id: string
          farm_id: string
          id: string
          name: string
        }[]
      }
      normalize_user_role: {
        Args: { input_role: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      receive_inventory_stock: {
        Args: {
          p_actor_id: string
          p_idempotency_key: string
          p_invoice_number: string
          p_item_id: string
          p_new_item: Json
          p_notes: string
          p_procurement_type: Database["public"]["Enums"]["procurement_type"]
          p_quantity: number
          p_supplier_name: string
          p_transaction_date: string
          p_unit_cost: number
          p_warehouse_id: string
        }
        Returns: Json
      }
      reconciliation_farm_scope_allowed: {
        Args: { p_farm_id: string; p_org_id: string }
        Returns: boolean
      }
      reconciliation_warehouse_scope_allowed: {
        Args: { p_org_id: string; p_warehouse_id: string }
        Returns: boolean
      }
      record_assigned_inventory_movement: {
        Args: {
          p_actor_id: string
          p_destination_warehouse_id: string
          p_idempotency_key: string
          p_item_id: string
          p_notes: string
          p_quantity: number
          p_transaction_date: string
          p_transaction_type: string
          p_unit_cost: number
          p_warehouse_id: string
        }
        Returns: Json
      }
      record_feed_milestone: {
        Args: {
          p_actor_id: string
          p_flock_id: string
          p_milestone_id: string
          p_notes?: string
          p_status: string
        }
        Returns: Json
      }
      record_feed_weight: {
        Args: {
          p_actor_id: string
          p_average_weight_g: number
          p_max_weight_g: number
          p_min_weight_g: number
          p_record_date: string
          p_sample_count: number
          p_task_id: string
          p_uniformity_pct: number
        }
        Returns: Json
      }
      record_health_event_with_inventory: {
        Args: {
          p_actor_id: string
          p_event: Json
          p_event_date: string
          p_event_type: Database["public"]["Enums"]["health_event_type"]
          p_flock_id: string
          p_item_id?: string
          p_quantity?: number
          p_warehouse_id?: string
        }
        Returns: Json
      }
      record_inventory_count_session: {
        Args: {
          p_actor_id: string
          p_counted_on: string
          p_idempotency_key: string
          p_notes: string
          p_rows: Json
          p_warehouse_id: string
        }
        Returns: Json
      }
      record_inventory_movement: {
        Args: {
          p_actor_id: string
          p_batch_id?: string
          p_branch_id?: string
          p_destination_warehouse_id?: string
          p_farm_id?: string
          p_flock_id?: string
          p_house_id?: string
          p_invoice_number?: string
          p_item_id: string
          p_notes?: string
          p_procurement_type?: Database["public"]["Enums"]["procurement_type"]
          p_quantity: number
          p_reference_doc?: string
          p_supplier_name?: string
          p_transaction_date?: string
          p_transaction_type: string
          p_unit_cost?: number
          p_warehouse_id: string
        }
        Returns: Json
      }
      record_support_access: {
        Args: { p_method: string; p_path: string }
        Returns: undefined
      }
      release_toggle_today_workspace: {
        Args: {
          p_enabled: boolean
          p_org_id: string
          p_reason: string
          p_release_reference: string
        }
        Returns: Json
      }
      reopen_feed_day: {
        Args: {
          p_actor_id: string
          p_flock_id: string
          p_reason: string
          p_record_date: string
        }
        Returns: Json
      }
      resubmit_governance_request: {
        Args: {
          p_changed_fields: string[]
          p_proposed_values: Json
          p_reason: string
          p_request_id: string
        }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          approval_expires_at: string | null
          attachments: Json
          changed_fields: string[]
          conflict_reason: string | null
          context_snapshot: Json
          correction_route: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          farm_id: string | null
          finding_id: string | null
          id: string
          idempotency_key: string | null
          intent: string
          latest_submitted_at: string
          org_id: string
          proposed_values: Json
          reason: string
          request_type: string
          requested_at: string
          requested_by: string
          requester_name_snapshot: string
          requester_role_snapshot: string
          requester_scope_snapshot: Json
          returned_at: string | null
          source_id: string | null
          source_table: string | null
          source_version: string | null
          status: string
          updated_at: string
          warehouse_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "governance_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_break_glass_session: {
        Args: { p_reason: string; p_session_id: string }
        Returns: {
          administrator_id: string
          expires_at: string
          id: string
          request_id: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          started_at: string
          target_org_id: string
        }
        SetofOptions: {
          from: "*"
          to: "break_glass_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_daily_record_with_usage: {
        Args: {
          p_actor_id: string
          p_daily_record_id: string
          p_flock_id: string
          p_record: Json
          p_usages?: Json
        }
        Returns: Json
      }
      save_daily_record_with_usage_full_v1: {
        Args: {
          p_actor_id: string
          p_daily_record_id: string
          p_flock_id: string
          p_record: Json
          p_usages?: Json
        }
        Returns: Json
      }
      save_daily_record_with_usage_partial_v1: {
        Args: {
          p_actor_id: string
          p_daily_record_id: string
          p_flock_id: string
          p_record: Json
          p_usages?: Json
        }
        Returns: Json
      }
      save_feed_template: {
        Args: {
          p_actor_id: string
          p_batch_id: string
          p_name: string
          p_rows: Json
          p_source_type: string
        }
        Returns: Json
      }
      stock_movement_delta: {
        Args: {
          p_quantity: number
          p_transaction_type: Database["public"]["Enums"]["stock_txn_type"]
        }
        Returns: number
      }
      today_resource_revision: {
        Args: {
          p_resource_id: string
          p_resource_type: string
          p_work_date?: string
        }
        Returns: string
      }
      today_source_fingerprint: {
        Args: {
          p_farm_id: string
          p_flock_id: string
          p_task_code: string
          p_work_date: string
        }
        Returns: string
      }
      valid_flock_movement_chain: {
        Args: { p_flock: string; p_org: string }
        Returns: boolean
      }
      validate_archived_accounting: {
        Args: { r: Database["public"]["Tables"]["governance_requests"]["Row"] }
        Returns: undefined
      }
      validate_archived_cycle_correction: {
        Args: { r: Database["public"]["Tables"]["governance_requests"]["Row"] }
        Returns: undefined
      }
      validate_whole_flock_move: {
        Args: {
          p_lock: boolean
          p_request: Database["public"]["Tables"]["governance_requests"]["Row"]
        }
        Returns: {
          age_at_placement_days: number
          batch_id: string | null
          breed_id: string | null
          completed_at: string | null
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
          placed_at: string | null
          placement_date: string
          purchase_cost_per_bird: number | null
          source: Database["public"]["Enums"]["flock_source"]
          status: Database["public"]["Enums"]["flock_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "flocks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verified_flock_movements: {
        Args: { p_org: string }
        Returns: {
          flock_id: string
        }[]
      }
      verify_governance_audit_chain: {
        Args: { p_org_id: string }
        Returns: Json
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
      cost_allocation_method:
        | "direct"
        | "bird_count"
        | "egg_count"
        | "feed_consumption"
        | "manual_percent"
      cost_entry_category:
        | "feed"
        | "medicine"
        | "vaccine"
        | "vitamin"
        | "supplement"
        | "payroll"
        | "utility"
        | "biosecurity"
        | "transport"
        | "maintenance"
        | "labor"
        | "rent"
        | "packaging"
        | "miscellaneous"
      feed_type:
        | "starter_feed"
        | "grower_pullet_feed"
        | "layer_feed"
        | "broiler_feed"
        | "medicated_feed"
      flock_source: "internal_transfer" | "external_purchase"
      flock_status:
        | "active"
        | "transferred"
        | "sold"
        | "culled"
        | "quarantined"
        | "archived"
      flock_type: "layer" | "rearing" | "parent_stock" | "broiler"
      health_event_type: "disease" | "treatment" | "observation"
      house_type: "layer" | "rearing" | "parent_stock" | "broiler"
      inventory_category:
        | "feed"
        | "medicine"
        | "vaccine"
        | "vitamin"
        | "equipment"
        | "spare_parts"
        | "packaging"
        | "supplement"
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
      monthly_cost_status: "draft" | "locked"
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
        | "opening_balance"
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
      cost_allocation_method: [
        "direct",
        "bird_count",
        "egg_count",
        "feed_consumption",
        "manual_percent",
      ],
      cost_entry_category: [
        "feed",
        "medicine",
        "vaccine",
        "vitamin",
        "supplement",
        "payroll",
        "utility",
        "biosecurity",
        "transport",
        "maintenance",
        "labor",
        "rent",
        "packaging",
        "miscellaneous",
      ],
      feed_type: [
        "starter_feed",
        "grower_pullet_feed",
        "layer_feed",
        "broiler_feed",
        "medicated_feed",
      ],
      flock_source: ["internal_transfer", "external_purchase"],
      flock_status: [
        "active",
        "transferred",
        "sold",
        "culled",
        "quarantined",
        "archived",
      ],
      flock_type: ["layer", "rearing", "parent_stock", "broiler"],
      health_event_type: ["disease", "treatment", "observation"],
      house_type: ["layer", "rearing", "parent_stock", "broiler"],
      inventory_category: [
        "feed",
        "medicine",
        "vaccine",
        "vitamin",
        "equipment",
        "spare_parts",
        "packaging",
        "supplement",
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
      monthly_cost_status: ["draft", "locked"],
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
        "opening_balance",
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
