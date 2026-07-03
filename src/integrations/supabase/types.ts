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
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: string
          room_id: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          kind?: string
          room_id: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          room_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      friends: {
        Row: {
          first_shared_at: string
          friend_id: string
          id: string
          last_shared_at: string
          nickname: string | null
          owner_id: string
          total_shared_seconds: number
        }
        Insert: {
          first_shared_at?: string
          friend_id: string
          id?: string
          last_shared_at?: string
          nickname?: string | null
          owner_id: string
          total_shared_seconds?: number
        }
        Update: {
          first_shared_at?: string
          friend_id?: string
          id?: string
          last_shared_at?: string
          nickname?: string | null
          owner_id?: string
          total_shared_seconds?: number
        }
        Relationships: []
      }
      play_history: {
        Row: {
          channel: string | null
          id: string
          played_at: string
          room_id: string | null
          thumbnail: string | null
          title: string
          user_id: string
          video_id: string
        }
        Insert: {
          channel?: string | null
          id?: string
          played_at?: string
          room_id?: string | null
          thumbnail?: string | null
          title: string
          user_id: string
          video_id: string
        }
        Update: {
          channel?: string | null
          id?: string
          played_at?: string
          room_id?: string | null
          thumbnail?: string | null
          title?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "play_history_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_tracks: {
        Row: {
          added_at: string
          channel: string | null
          id: string
          playlist_id: string
          position: number
          thumbnail: string | null
          title: string
          video_id: string
        }
        Insert: {
          added_at?: string
          channel?: string | null
          id?: string
          playlist_id: string
          position?: number
          thumbnail?: string | null
          title: string
          video_id: string
        }
        Update: {
          added_at?: string
          channel?: string | null
          id?: string
          playlist_id?: string
          position?: number
          thumbnail?: string | null
          title?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_tracks_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      room_participants: {
        Row: {
          display_name: string | null
          id: string
          joined_at: string
          last_seen_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          display_name?: string | null
          id?: string
          joined_at?: string
          last_seen_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          display_name?: string | null
          id?: string
          joined_at?: string
          last_seen_at?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_queue: {
        Row: {
          added_at: string
          added_by: string
          channel: string | null
          id: string
          position: number
          room_id: string
          thumbnail: string | null
          title: string
          video_id: string
        }
        Insert: {
          added_at?: string
          added_by: string
          channel?: string | null
          id?: string
          position?: number
          room_id: string
          thumbnail?: string | null
          title: string
          video_id: string
        }
        Update: {
          added_at?: string
          added_by?: string
          channel?: string | null
          id?: string
          position?: number
          room_id?: string
          thumbnail?: string | null
          title?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_queue_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          current_video_channel: string | null
          current_video_id: string | null
          current_video_thumbnail: string | null
          current_video_title: string | null
          ended_at: string | null
          host_id: string
          id: string
          invite_code: string
          is_active: boolean
          is_playing: boolean
          last_state_change: string
          mode: string
          name: string
          position_seconds: number
        }
        Insert: {
          created_at?: string
          current_video_channel?: string | null
          current_video_id?: string | null
          current_video_thumbnail?: string | null
          current_video_title?: string | null
          ended_at?: string | null
          host_id: string
          id?: string
          invite_code: string
          is_active?: boolean
          is_playing?: boolean
          last_state_change?: string
          mode?: string
          name?: string
          position_seconds?: number
        }
        Update: {
          created_at?: string
          current_video_channel?: string | null
          current_video_id?: string | null
          current_video_thumbnail?: string | null
          current_video_title?: string | null
          ended_at?: string | null
          host_id?: string
          id?: string
          invite_code?: string
          is_active?: boolean
          is_playing?: boolean
          last_state_change?: string
          mode?: string
          name?: string
          position_seconds?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gen_invite_code: { Args: never; Returns: string }
      is_room_participant: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
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
    Enums: {},
  },
} as const
