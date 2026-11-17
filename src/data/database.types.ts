
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            installment_plans: {
              Row: { id: string; owner_id: string; name: string; total_minor: number; schedule: Json; version: number; archived_at: string | null }
              Insert: { id: string; owner_id: string; name: string; total_minor: number; schedule: Json; version?: number; archived_at?: string | null }
              Update: Partial<Database['public']['Tables']['installment_plans']['Insert']>
              Relationships: []
            }
            installment_dues: {
              Row: { id: string; plan_id: string; due_on: string; amount_minor: number; paid_minor: number }
              Insert: { id?: string; plan_id: string; due_on: string; amount_minor: number; paid_minor?: number }
              Update: Partial<Database['public']['Tables']['installment_dues']['Insert']>
              Relationships: [{ foreignKeyName: "installment_dues_plan_id_fkey"; columns: ["plan_id"]; isOneToOne: false; referencedRelation: "installment_plans"; referencedColumns: ["id"] }]
            }
            installment_payments: {
              Row: { id: string; due_id: string; amount_minor: number; paid_on: string }
              Insert: Database['public']['Tables']['installment_payments']['Row']
              Update: Partial<Database['public']['Tables']['installment_payments']['Insert']>
              Relationships: [{ foreignKeyName: "installment_payments_due_id_fkey"; columns: ["due_id"]; isOneToOne: false; referencedRelation: "installment_dues"; referencedColumns: ["id"] }]
            }
            savings_goals: {
              Row: { id: string; owner_id: string; name: string; target_minor: number; saved_minor: number; target_on: string | null; version: number; archived_at: string | null }
              Insert: { id: string; owner_id: string; name: string; target_minor: number; saved_minor?: number; target_on?: string | null; version?: number; archived_at?: string | null }
              Update: Partial<Database['public']['Tables']['savings_goals']['Insert']>
              Relationships: []
            }
            savings_movements: {
              Row: { id: string; goal_id: string; direction: 'deposit' | 'withdraw'; amount_minor: number; moved_on: string }
              Insert: Database['public']['Tables']['savings_movements']['Row']
              Update: Partial<Database['public']['Tables']['savings_movements']['Insert']>
              Relationships: []
            }
            private_debts: {
              Row: {
                id: string; owner_id: string; contact: string; direction: 'owed' | 'owe';
                amount_minor: number; paid_minor: number; due_on: string | null; version: number; archived_at: string | null
              }
              Insert: {
                id: string; owner_id: string; contact: string; direction: 'owed' | 'owe'; amount_minor: number;
                paid_minor?: number; due_on?: string | null; version?: number; archived_at?: string | null
              }
              Update: Partial<Database['public']['Tables']['private_debts']['Insert']>
              Relationships: []
            }
            private_debt_payments: {
              Row: { id: string; debt_id: string; amount_minor: number; paid_on: string; created_at: string }
              Insert: { id: string; debt_id: string; amount_minor: number; paid_on: string; created_at?: string }
              Update: Partial<Database['public']['Tables']['private_debt_payments']['Insert']>
              Relationships: [{
                foreignKeyName: "private_debt_payments_debt_id_fkey"
                columns: ["debt_id"]
                isOneToOne: false
                referencedRelation: "private_debts"
                referencedColumns: ["id"]
              }]
            }
            expense_categories: {
              Row: { code: string }
              Insert: { code: string }
              Update: { code?: string }
              Relationships: []
            }
            expenses: {
              Row: {
                id: string; owner_id: string; item: string; amount_minor: number; category: string;
                spent_on: string; note: string | null; version: number; archived_at: string | null
              }
              Insert: {
                id: string; owner_id: string; item: string; amount_minor: number; category: string;
                spent_on: string; note?: string | null; version?: number; archived_at?: string | null
              }
              Update: Partial<Database['public']['Tables']['expenses']['Insert']>
              Relationships: [{
                foreignKeyName: "expenses_category_fkey"
                columns: ["category"]
                isOneToOne: false
                referencedRelation: "expense_categories"
                referencedColumns: ["code"]
              }]
            }
            personal_activity: {
              Row: {
                id: number; owner_id: string; entity_type: string; entity_id: string; action: string;
                before_data: Json | null; after_data: Json; created_at: string
              }
              Insert: {
                owner_id: string; entity_type: string; entity_id: string; action: string;
                before_data?: Json | null; after_data: Json; created_at?: string
              }
              Update: Partial<Database['public']['Tables']['personal_activity']['Insert']>
              Relationships: []
            }
            "friendships": {
                  Row: {
                    "id": string,"recipient": string,"sender": string,"state": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"recipient": string,"sender": string,"state"?: string
                  }
                  Update: {
                    "id"?: string,"recipient"?: string,"sender"?: string,"state"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "friendships_recipient_fkey"
      columns: ["recipient"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "friendships_sender_fkey"
      columns: ["sender"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"money_requests": {
                  Row: {
                    "amount_minor": number,"created_at": string,"currency": string,"due_date": string | null,"id": string,"reason": string,"recipient": string,"sender": string,"state": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"created_at"?: string,"currency"?: string,"due_date"?: string | null,"id"?: string,"reason": string,"recipient": string,"sender": string,"state"?: string,"version"?: number
                  }
                  Update: {
                    "amount_minor"?: number,"created_at"?: string,"currency"?: string,"due_date"?: string | null,"id"?: string,"reason"?: string,"recipient"?: string,"sender"?: string,"state"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "money_requests_recipient_fkey"
      columns: ["recipient"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "money_requests_sender_fkey"
      columns: ["sender"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "display_name": string,"id": string,"language": string,"name_ar": string | null,"name_en": string | null,"username": string
                  }
                  ComputedFields: never
                  Insert: {
                    "display_name": string,"id"?: string,"language": string,"name_ar"?: string | null,"name_en"?: string | null,"username": string
                  }
                  Update: {
                    "display_name"?: string,"id"?: string,"language"?: string,"name_ar"?: string | null,"name_en"?: string | null,"username"?: string
                  }
                  Relationships: [
                    
                  ]
                },"request_corrections": {
                  Row: {
                    "amount_minor": number | null,"base_version": number,"created_at": string,"explanation": string,"id": string,"kind": string,"new_reason": string | null,"payment_id": string | null,"proposer": string,"request_id": string,"state": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor"?: number | null,"base_version": number,"created_at"?: string,"explanation": string,"id"?: string,"kind": string,"new_reason"?: string | null,"payment_id"?: string | null,"proposer": string,"request_id": string,"state"?: string
                  }
                  Update: {
                    "amount_minor"?: number | null,"base_version"?: number,"created_at"?: string,"explanation"?: string,"id"?: string,"kind"?: string,"new_reason"?: string | null,"payment_id"?: string | null,"proposer"?: string,"request_id"?: string,"state"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "request_corrections_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "request_payments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_corrections_proposer_fkey"
      columns: ["proposer"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_corrections_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "money_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"request_events": {
                  Row: {
                    "actor": string,"created_at": string,"details": NonNullable<Json>,"event": string,"id": number,"request_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor": string,"created_at"?: string,"details"?: NonNullable<Json>,"event": string,"id"?: never,"request_id": string
                  }
                  Update: {
                    "actor"?: string,"created_at"?: string,"details"?: NonNullable<Json>,"event"?: string,"id"?: never,"request_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "request_events_actor_fkey"
      columns: ["actor"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_events_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "money_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"request_operations": {
                  Row: {
                    "actor": string,"kind": string,"operation_key": string,"payload": NonNullable<Json>,"request_id": string,"result": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor": string,"kind": string,"operation_key": string,"payload": NonNullable<Json>,"request_id": string,"result": string
                  }
                  Update: {
                    "actor"?: string,"kind"?: string,"operation_key"?: string,"payload"?: NonNullable<Json>,"request_id"?: string,"result"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "request_operations_actor_fkey"
      columns: ["actor"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_operations_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "money_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"request_payments": {
                  Row: {
                    "amount_minor": number,"created_at": string,"id": string,"request_id": string,"state": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"created_at"?: string,"id"?: string,"request_id": string,"state"?: string
                  }
                  Update: {
                    "amount_minor"?: number,"created_at"?: string,"id"?: string,"request_id"?: string,"state"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "request_payments_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "money_requests"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            archive_installment_plan: { Args: { p_id: string; p_version: number }; Returns: undefined }
            signup_username_available: { Args: { requested_username: string }; Returns: boolean }
            spend_is_admin: { Args: never; Returns: boolean }
            spend_save_budget: { Args: { p_amount: number; p_end: string }; Returns: undefined }
            spend_budget_overview: { Args: never; Returns: {
              amount_minor: number; starts_on: string; ends_on: string; today: string; spent_minor: number; today_minor: number
            }[] }
            spend_request_recovery: { Args: { requested_email: string }; Returns: undefined }
            spend_recovery_queue: { Args: never; Returns: string[] }
            spend_finish_recovery: { Args: { target_id: string }; Returns: undefined }
            spend_admin_users: { Args: never; Returns: {
              id: string; username: string | null; email: string | null; display_name: string | null;
              created_at: string; status: string; reviewed_at: string | null
            }[] }
            spend_review_account: { Args: { target_id: string; decision: string }; Returns: undefined }
            save_installment_plan: { Args: { p_id: string; p_name: string; p_total: number; p_schedule: Json; p_version?: number }; Returns: undefined }
            record_installment_payment: { Args: { p_id: string; p_due: string; p_amount: number; p_paid_on: string }; Returns: undefined }
            installment_overview: { Args: { p_month: string }; Returns: {
              paid_minor: number; remaining_minor: number; overdue_minor: number; next_plan_id: string | null;
              next_name: string | null; next_due_on: string | null; next_minor: number | null
            }[] }
            archive_savings_goal: { Args: { p_id: string; p_version: number }; Returns: undefined }
            save_savings_goal: { Args: { p_id: string; p_name: string; p_target: number; p_target_on?: string; p_version?: number }; Returns: undefined }
            record_savings_movement: { Args: { p_id: string; p_goal: string; p_direction: string; p_amount: number; p_moved_on: string }; Returns: undefined }
            savings_overview: { Args: { p_month: string }; Returns: { saved_minor: number; deposited_minor: number; withdrawn_minor: number }[] }
            archive_private_debt: { Args: { p_id: string; p_version: number }; Returns: undefined }
            save_private_debt: {
              Args: { p_id: string; p_contact: string; p_direction: string; p_amount: number; p_due_on?: string; p_version?: number }
              Returns: undefined
            }
            record_private_debt_payment: {
              Args: { p_id: string; p_debt: string; p_amount: number; p_paid_on: string }
              Returns: undefined
            }
            debt_overview: {
              Args: Record<PropertyKey, never>
              Returns: {
                owed_minor: number; owe_minor: number; pending_count: number; due_id: string | null;
                due_source: string | null; due_label: string | null; due_on: string | null; due_minor: number | null
              }[]
            }
            archive_expense: { Args: { p_id: string; p_version: number }; Returns: undefined }
            expense_month_summary: { Args: { p_month: string }; Returns: { category: string; total_minor: number }[] }
            save_expense: {
              Args: {
                p_id: string; p_item: string; p_amount: number; p_category: string;
                p_spent_on: string; p_note?: string; p_version?: number
              }
              Returns: undefined
            }
            "connection_names":
{ Args: Record<PropertyKey, never>; Returns: {
              "display_name": string,"id": string,"username": string
            }[]
                           },
"find_profile":
{ Args: { "requested_username": string }; Returns: {
              "display_name": string,"username": string
            }[]
                           },
"propose_request_correction":
{ Args: { "p_amount"?: number,"p_explanation": string,"p_key": string,"p_kind": string,"p_payment"?: string,"p_reason"?: string,"p_request": string }; Returns: string
                           },
"record_request_payment":
{ Args: { "p_amount": number,"p_key": string,"p_request": string }; Returns: string
                           },
"respond_friendship":
{ Args: { "decision": string,"friendship_id": string }; Returns: undefined
                           },
"respond_money_request":
{ Args: { "decision": string,"request_id": string }; Returns: undefined
                           },
"respond_request_correction":
{ Args: { "p_correction": string,"p_decision": string }; Returns: undefined
                           },
"respond_request_payment":
{ Args: { "p_decision": string,"p_payment": string }; Returns: undefined
                           },
"send_friend_request":
{ Args: { "target_username": string }; Returns: string
                           },
"send_money_request":
{ Args: { "deadline"?: string,"minor_units": number,"request_reason": string,"target_id": string }; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
