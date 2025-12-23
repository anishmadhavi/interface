// This file will be auto-generated from Supabase
// Run: npm run db:generate-types
// For now, we'll use placeholder types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          waba_id: string | null;
          phone_number_id: string | null;
          phone_number: string | null;
          access_token_encrypted: string | null;
          quality_rating: 'GREEN' | 'YELLOW' | 'RED' | null;
          messaging_tier: 'TIER_1K' | 'TIER_10K' | 'TIER_100K' | 'TIER_UNLIMITED' | null;
          subscription_plan_id: string | null;
          subscription_status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
          wallet_balance: number;
          trial_ends_at: string | null;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          waba_id?: string | null;
          phone_number_id?: string | null;
          phone_number?: string | null;
          access_token_encrypted?: string | null;
          quality_rating?: 'GREEN' | 'YELLOW' | 'RED' | null;
          messaging_tier?: 'TIER_1K' | 'TIER_10K' | 'TIER_100K' | 'TIER_UNLIMITED' | null;
          subscription_plan_id?: string | null;
          subscription_status?: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
          wallet_balance?: number;
          trial_ends_at?: string | null;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          waba_id?: string | null;
          phone_number_id?: string | null;
          phone_number?: string | null;
          access_token_encrypted?: string | null;
          quality_rating?: 'GREEN' | 'YELLOW' | 'RED' | null;
          messaging_tier?: 'TIER_1K' | 'TIER_10K' | 'TIER_100K' | 'TIER_UNLIMITED' | null;
          subscription_plan_id?: string | null;
          subscription_status?: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
          wallet_balance?: number;
          trial_ends_at?: string | null;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          auth_id: string;
          organization_id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          role_id: string;
          is_active: boolean;
          last_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_id: string;
          organization_id: string;
          email: string;
          full_name: string;
          avatar_url?: string | null;
          role_id: string;
          is_active?: boolean;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_id?: string;
          organization_id?: string;
          email?: string;
          full_name?: string;
          avatar_url?: string | null;
          role_id?: string;
          is_active?: boolean;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      roles: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          is_admin: boolean;
          is_default: boolean;
          permissions: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          is_admin?: boolean;
          is_default?: boolean;
          permissions?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          description?: string | null;
          is_admin?: boolean;
          is_default?: boolean;
          permissions?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      subscription_plans: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          monthly_price: number;
          annual_price: number | null;
          max_contacts: number;
          max_team_members: number;
          max_templates: number;
          features: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          monthly_price: number;
          annual_price?: number | null;
          max_contacts: number;
          max_team_members: number;
          max_templates: number;
          features?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          monthly_price?: number;
          annual_price?: number | null;
          max_contacts?: number;
          max_team_members?: number;
          max_templates?: number;
          features?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      superadmins: {
        Row: {
          id: string;
          auth_id: string;
          email: string;
          full_name: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          auth_id: string;
          email: string;
          full_name: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          auth_id?: string;
          email?: string;
          full_name?: string;
          is_active?: boolean;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {
      quality_rating: 'GREEN' | 'YELLOW' | 'RED';
      messaging_tier: 'TIER_1K' | 'TIER_10K' | 'TIER_100K' | 'TIER_UNLIMITED';
      subscription_status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
    };
  };
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Insertable<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type Updatable<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

// Convenience types
export type Organization = Tables<'organizations'>;
export type User = Tables<'users'>;
export type Role = Tables<'roles'>;
export type SubscriptionPlan = Tables<'subscription_plans'>;
export type Superadmin = Tables<'superadmins'>;
