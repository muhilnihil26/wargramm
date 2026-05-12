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
      admin_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      app_notices: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          id: string
          level: string
          message: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          id?: string
          level?: string
          message: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          id?: string
          level?: string
          message?: string
        }
        Relationships: []
      }
      coin_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          metadata: Json | null
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          metadata?: Json | null
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user1_id: string
          user1_typing_at: string | null
          user2_id: string
          user2_typing_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user1_id: string
          user1_typing_at?: string | null
          user2_id: string
          user2_typing_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user1_id?: string
          user1_typing_at?: string | null
          user2_id?: string
          user2_typing_at?: string | null
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          code_snapshot: string
          cost_coins: number
          coupon_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          code_snapshot: string
          cost_coins: number
          coupon_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          code_snapshot?: string
          cost_coins?: number
          coupon_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          brand: string | null
          claim_instructions: string | null
          claim_url: string | null
          code: string
          cost_coins: number
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          is_affiliate: boolean
          stock: number
          title: string
        }
        Insert: {
          brand?: string | null
          claim_instructions?: string | null
          claim_url?: string | null
          code: string
          cost_coins?: number
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_affiliate?: boolean
          stock?: number
          title: string
        }
        Update: {
          brand?: string | null
          claim_instructions?: string | null
          claim_url?: string | null
          code?: string
          cost_coins?: number
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_affiliate?: boolean
          stock?: number
          title?: string
        }
        Relationships: []
      }
      follow_requests: {
        Row: {
          created_at: string
          id: string
          requester_id: string
          status: string
          target_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          target_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          target_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          audio_url: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          image_url: string | null
          read: boolean
          reply_to: string | null
          sender_id: string
        }
        Insert: {
          audio_url?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          read?: boolean
          reply_to?: string | null
          sender_id: string
        }
        Update: {
          audio_url?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          read?: boolean
          reply_to?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      music: {
        Row: {
          added_by: string
          artist: string | null
          created_at: string
          duration: number | null
          id: string
          lyrics: Json | null
          title: string
          youtube_url: string
        }
        Insert: {
          added_by: string
          artist?: string | null
          created_at?: string
          duration?: number | null
          id?: string
          lyrics?: Json | null
          title?: string
          youtube_url: string
        }
        Update: {
          added_by?: string
          artist?: string | null
          created_at?: string
          duration?: number | null
          id?: string
          lyrics?: Json | null
          title?: string
          youtube_url?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          post_id: string | null
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          post_id?: string | null
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          post_id?: string | null
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          caption: string | null
          clip_end: number | null
          clip_start: number | null
          created_at: string
          id: string
          image_url: string
          is_video: boolean
          lyrics: Json | null
          music_end: number | null
          music_start: number | null
          music_title: string | null
          music_url: string | null
          user_id: string
          visibility: string
        }
        Insert: {
          caption?: string | null
          clip_end?: number | null
          clip_start?: number | null
          created_at?: string
          id?: string
          image_url: string
          is_video?: boolean
          lyrics?: Json | null
          music_end?: number | null
          music_start?: number | null
          music_title?: string | null
          music_url?: string | null
          user_id: string
          visibility?: string
        }
        Update: {
          caption?: string | null
          clip_end?: number | null
          clip_start?: number | null
          created_at?: string
          id?: string
          image_url?: string
          is_video?: boolean
          lyrics?: Json | null
          music_end?: number | null
          music_start?: number | null
          music_title?: string | null
          music_url?: string | null
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          instagram_username: string | null
          is_celebrity: boolean
          is_private: boolean
          is_verified: boolean
          celebrity_score: number
          last_seen: string | null
          onboarded_at: string | null
          phone: string | null
          referred_by: string | null
          show_activity: boolean
          updated_at: string
          user_id: string
          username: string | null
          verification_status: string
          website: string | null
        }
        Insert: {
          account_type?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          instagram_username?: string | null
          is_celebrity?: boolean
          is_private?: boolean
          is_verified?: boolean
          celebrity_score?: number
          last_seen?: string | null
          onboarded_at?: string | null
          phone?: string | null
          referred_by?: string | null
          show_activity?: boolean
          updated_at?: string
          user_id: string
          username?: string | null
          verification_status?: string
          website?: string | null
        }
        Update: {
          account_type?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          instagram_username?: string | null
          is_celebrity?: boolean
          is_private?: boolean
          is_verified?: boolean
          celebrity_score?: number
          last_seen?: string | null
          onboarded_at?: string | null
          phone?: string | null
          referred_by?: string | null
          show_activity?: boolean
          updated_at?: string
          user_id?: string
          username?: string | null
          verification_status?: string
          website?: string | null
        }
        Relationships: []
      }
      reel_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          reel_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          reel_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          reel_id?: string
          user_id?: string
        }
        Relationships: []
      }
      reel_likes: {
        Row: {
          created_at: string
          id: string
          reel_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reel_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reel_id?: string
          user_id?: string
        }
        Relationships: []
      }
      reels: {
        Row: {
          caption: string | null
          clip_end: number | null
          clip_start: number | null
          created_at: string
          id: string
          lyrics: Json | null
          music_end: number | null
          music_start: number | null
          music_title: string | null
          music_url: string | null
          user_id: string
          video_url: string
          visibility: string
        }
        Insert: {
          caption?: string | null
          clip_end?: number | null
          clip_start?: number | null
          created_at?: string
          id?: string
          lyrics?: Json | null
          music_end?: number | null
          music_start?: number | null
          music_title?: string | null
          music_url?: string | null
          user_id: string
          video_url: string
          visibility?: string
        }
        Update: {
          caption?: string | null
          clip_end?: number | null
          clip_start?: number | null
          created_at?: string
          id?: string
          lyrics?: Json | null
          music_end?: number | null
          music_start?: number | null
          music_title?: string | null
          music_url?: string | null
          user_id?: string
          video_url?: string
          visibility?: string
        }
        Relationships: []
      }
      saved_posts: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          image_url: string
          music_title: string | null
          music_url: string | null
          user_id: string
          visibility: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          image_url: string
          music_title?: string | null
          music_url?: string | null
          user_id: string
          visibility?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          image_url?: string
          music_title?: string | null
          music_url?: string | null
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_by: string
          created_at: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          blocked_by: string
          created_at?: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          blocked_by?: string
          created_at?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_coins: {
        Row: {
          balance: number
          created_at: string
          last_login_bonus_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          last_login_bonus_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          last_login_bonus_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_requests: {
        Row: {
          admin_note: string | null
          category: string
          created_at: string
          document_url: string
          full_legal_name: string
          id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          category: string
          created_at?: string
          document_url: string
          full_legal_name: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          category?: string
          created_at?: string
          document_url?: string
          full_legal_name?: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      youtube_library: {
        Row: {
          created_at: string
          id: string
          is_playlist: boolean
          playlist_id: string | null
          thumbnail_url: string | null
          title: string
          trim_end: number
          trim_start: number
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_playlist?: boolean
          playlist_id?: string | null
          thumbnail_url?: string | null
          title?: string
          trim_end?: number
          trim_start?: number
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_playlist?: boolean
          playlist_id?: string | null
          thumbnail_url?: string | null
          title?: string
          trim_end?: number
          trim_start?: number
          url?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_grant_coins: {
        Args: { _amount: number; _reason: string; _target_user?: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_following: {
        Args: { _follower: string; _target: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
