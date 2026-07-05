// Shoreline — Supabase database types
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      residents: {
        Row: {
          id: string; created_at: string; updated_at: string
          name: string; room: string; status: string
          diet_type: string | null; texture: string | null
          allergies: string[] | null; serving_location: string | null
          ensure_per_day: number | null; birthday_month: string | null
          birthday_day: number | null; notes: string | null
          portion_size: string | null; beverages: string[] | null
          table_assignment: string | null; likes: string | null
          dislikes: string | null; special_instructions: string | null
        }
        Insert: {
          id?: string; name: string; room: string; status?: string
          diet_type?: string | null; texture?: string | null
          allergies?: string[] | null; serving_location?: string | null
          ensure_per_day?: number | null; birthday_month?: string | null
          birthday_day?: number | null; notes?: string | null
          portion_size?: string | null; beverages?: string[] | null
          table_assignment?: string | null; likes?: string | null
          dislikes?: string | null; special_instructions?: string | null
        }
        Update: Partial<Database['public']['Tables']['residents']['Insert']>
      }
      inventory: {
        Row: {
          id: string; created_at: string; updated_at: string
          item: string; category: string | null; quantity: number
          unit: string | null; par_level: number | null; notes: string | null
        }
        Insert: {
          id?: string; item: string; category?: string | null
          quantity?: number; unit?: string | null
          par_level?: number | null; notes?: string | null
        }
        Update: Partial<Database['public']['Tables']['inventory']['Insert']>
      }
      menu_weeks: {
        Row: {
          id: string; created_at: string; updated_at: string
          label: string; active: boolean; days: Json
        }
        Insert: { id?: string; label: string; active?: boolean; days?: Json }
        Update: Partial<Database['public']['Tables']['menu_weeks']['Insert']>
      }
      menu_items: {
        Row: { id: string; created_at: string; name: string; category: string | null }
        Insert: { id?: string; name: string; category?: string | null }
        Update: Partial<Database['public']['Tables']['menu_items']['Insert']>
      }
      budget_periods: {
        Row: {
          id: string; created_at: string; updated_at: string
          label: string; month: number; year: number
          total_budget: number; resident_count: number
          budget_per_resident_per_day: number
        }
        Insert: {
          id?: string; label: string; month: number; year: number
          total_budget?: number; resident_count?: number
          budget_per_resident_per_day?: number
        }
        Update: Partial<Database['public']['Tables']['budget_periods']['Insert']>
      }
      budget_entries: {
        Row: {
          id: string; created_at: string
          period_id: string; date: string; vendor: string | null
          description: string; amount: number; category: string | null
        }
        Insert: {
          id?: string; period_id: string; date: string
          vendor?: string | null; description: string
          amount: number; category?: string | null
        }
        Update: Partial<Database['public']['Tables']['budget_entries']['Insert']>
      }
      time_punches: {
        Row: {
          id: string; created_at: string; badge_id: string
          operation: string; kiosk_id: string
          punched_at: string; notes: string | null
        }
        Insert: {
          id?: string; badge_id: string; operation: string
          kiosk_id?: string; punched_at?: string; notes?: string | null
        }
        Update: Partial<Database['public']['Tables']['time_punches']['Insert']>
      }
      production_sheets: {
        Row: {
          id: string; created_at: string; updated_at: string
          label: string; meal: string; date: string
          items: Json; signed_off_at: string | null; signed_off_by: string | null
        }
        Insert: {
          id?: string; label: string; meal: string; date: string
          items?: Json; signed_off_at?: string | null; signed_off_by?: string | null
        }
        Update: Partial<Database['public']['Tables']['production_sheets']['Insert']>
      }
      communications: {
        Row: {
          id: string; created_at: string; updated_at: string
          subject: string; body: string; status: string
          author: string | null; recipients: string[] | null; attachments: Json | null
        }
        Insert: {
          id?: string; subject: string; body?: string; status?: string
          author?: string | null; recipients?: string[] | null; attachments?: Json | null
        }
        Update: Partial<Database['public']['Tables']['communications']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
