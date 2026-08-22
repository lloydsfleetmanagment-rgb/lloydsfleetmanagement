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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json
          employee_id: string | null
          employee_name: string | null
          entity: string | null
          entity_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          employee_id?: string | null
          employee_name?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          employee_id?: string | null
          employee_name?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      crushers: {
        Row: {
          capacity_tph: number
          code: string
          created_at: string
          id: string
          name: string
          remarks: string | null
          sany_only: boolean
          status: string
          updated_at: string
        }
        Insert: {
          capacity_tph?: number
          code: string
          created_at?: string
          id?: string
          name: string
          remarks?: string | null
          sany_only?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          capacity_tph?: number
          code?: string
          created_at?: string
          id?: string
          name?: string
          remarks?: string | null
          sany_only?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      destinations: {
        Row: {
          allowed_equipment_types: string[]
          code: string
          is_crusher: boolean
          material_code: string
          name: string
          sort_order: number
        }
        Insert: {
          allowed_equipment_types?: string[]
          code: string
          is_crusher?: boolean
          material_code: string
          name: string
          sort_order?: number
        }
        Update: {
          allowed_equipment_types?: string[]
          code?: string
          is_crusher?: boolean
          material_code?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "destinations_material_code_fkey"
            columns: ["material_code"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["code"]
          },
        ]
      }
      dig_faces: {
        Row: {
          bench: string | null
          created_at: string
          created_by: string | null
          id: string
          material_code: string | null
          name: string
          remarks: string | null
          shovel: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bench?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          material_code?: string | null
          name: string
          remarks?: string | null
          shovel?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bench?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          material_code?: string | null
          name?: string
          remarks?: string | null
          shovel?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dig_faces_material_code_fkey"
            columns: ["material_code"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["code"]
          },
        ]
      }
      emergency_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          destination_code: string | null
          employee_id: string | null
          employee_name: string | null
          equipment_code: string | null
          id: string
          login_id: string | null
          material_code: string | null
          message: string | null
          resolved_at: string | null
          resolved_by: string | null
          shift: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          destination_code?: string | null
          employee_id?: string | null
          employee_name?: string | null
          equipment_code?: string | null
          id?: string
          login_id?: string | null
          material_code?: string | null
          message?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          shift?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          destination_code?: string | null
          employee_id?: string | null
          employee_name?: string | null
          equipment_code?: string | null
          id?: string
          login_id?: string | null
          material_code?: string | null
          message?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          shift?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      equipment: {
        Row: {
          assigned_user_id: string | null
          capacity_t: number
          code: string
          created_at: string
          cycle_count: number
          equipment_type: string
          id: string
          location: string
          operator_employee_id: string | null
          operator_name: string | null
          remarks: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          capacity_t?: number
          code: string
          created_at?: string
          cycle_count?: number
          equipment_type: string
          id?: string
          location?: string
          operator_employee_id?: string | null
          operator_name?: string | null
          remarks?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          capacity_t?: number
          code?: string
          created_at?: string
          cycle_count?: number
          equipment_type?: string
          id?: string
          location?: string
          operator_employee_id?: string | null
          operator_name?: string | null
          remarks?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          code: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      operator_logs: {
        Row: {
          created_at: string
          destination_code: string
          dig_face: string | null
          employee_id: string | null
          employee_name: string | null
          equipment_code: string
          equipment_id: string
          equipment_type: string
          excavator: string | null
          id: string
          loading_time_min: number
          log_date: string
          logged_at: string
          material_code: string
          quantity_t: number
          remarks: string | null
          shift: string
          trips: number
          unloading_time_min: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          destination_code: string
          dig_face?: string | null
          employee_id?: string | null
          employee_name?: string | null
          equipment_code: string
          equipment_id: string
          equipment_type: string
          excavator?: string | null
          id?: string
          loading_time_min?: number
          log_date?: string
          logged_at?: string
          material_code: string
          quantity_t?: number
          remarks?: string | null
          shift?: string
          trips: number
          unloading_time_min?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          destination_code?: string
          dig_face?: string | null
          employee_id?: string | null
          employee_name?: string | null
          equipment_code?: string
          equipment_id?: string
          equipment_type?: string
          excavator?: string | null
          id?: string
          loading_time_min?: number
          log_date?: string
          logged_at?: string
          material_code?: string
          quantity_t?: number
          remarks?: string | null
          shift?: string
          trips?: number
          unloading_time_min?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_logs_destination_code_fkey"
            columns: ["destination_code"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "operator_logs_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_logs_material_code_fkey"
            columns: ["material_code"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["code"]
          },
        ]
      }
      production_entries: {
        Row: {
          created_at: string
          created_by: string | null
          destination_code: string | null
          dig_face: string | null
          entry_date: string
          id: string
          material_code: string
          quantity_t: number
          remarks: string | null
          shift: string
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          destination_code?: string | null
          dig_face?: string | null
          entry_date?: string
          id?: string
          material_code: string
          quantity_t?: number
          remarks?: string | null
          shift?: string
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          destination_code?: string | null
          dig_face?: string | null
          entry_date?: string
          id?: string
          material_code?: string
          quantity_t?: number
          remarks?: string | null
          shift?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_entries_destination_code_fkey"
            columns: ["destination_code"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "production_entries_material_code_fkey"
            columns: ["material_code"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["code"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          employee_id: string | null
          employee_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          employee_id?: string | null
          employee_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          employee_id?: string | null
          employee_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "operator"
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
      app_role: ["admin", "supervisor", "operator"],
    },
  },
} as const
