/**
 * Datenbank-Typen für Supabase (Schema „public“), passend zu supabase/migrations.
 *
 * Derzeit VON HAND gepflegt im Format von `supabase gen types typescript`. Künftig wird die Datei generiert:
 * GitHub-App → Actions → db-types → Run workflow erzeugt sie aus einer Test-Datenbank und zeigt den Unterschied.
 * Bei jeder Migration mit neuen/geänderten Tabellen diese Datei mit anpassen.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      body_measurements: {
        Row: {
          abdomen_cm: number | null;
          calf_left_cm: number | null;
          calf_right_cm: number | null;
          chest_cm: number | null;
          created_at: string;
          hip_cm: number | null;
          id: string;
          measured_on: string;
          shoulders_cm: number | null;
          thigh_left_cm: number | null;
          thigh_right_cm: number | null;
          updated_at: string;
          upper_arm_left_cm: number | null;
          upper_arm_right_cm: number | null;
          user_id: string;
          waist_cm: number | null;
        };
        Insert: {
          abdomen_cm?: number | null;
          calf_left_cm?: number | null;
          calf_right_cm?: number | null;
          chest_cm?: number | null;
          created_at?: string;
          hip_cm?: number | null;
          id?: string;
          measured_on?: string;
          shoulders_cm?: number | null;
          thigh_left_cm?: number | null;
          thigh_right_cm?: number | null;
          updated_at?: string;
          upper_arm_left_cm?: number | null;
          upper_arm_right_cm?: number | null;
          user_id?: string;
          waist_cm?: number | null;
        };
        Update: {
          abdomen_cm?: number | null;
          calf_left_cm?: number | null;
          calf_right_cm?: number | null;
          chest_cm?: number | null;
          created_at?: string;
          hip_cm?: number | null;
          id?: string;
          measured_on?: string;
          shoulders_cm?: number | null;
          thigh_left_cm?: number | null;
          thigh_right_cm?: number | null;
          updated_at?: string;
          upper_arm_left_cm?: number | null;
          upper_arm_right_cm?: number | null;
          user_id?: string;
          waist_cm?: number | null;
        };
        Relationships: [];
      };
      body_metrics: {
        Row: {
          body_fat_pct: number | null;
          created_at: string;
          height_cm: number | null;
          id: string;
          measured_on: string;
          resting_heart_rate_bpm: number | null;
          updated_at: string;
          user_id: string;
          weight_kg: number | null;
        };
        Insert: {
          body_fat_pct?: number | null;
          created_at?: string;
          height_cm?: number | null;
          id?: string;
          measured_on?: string;
          resting_heart_rate_bpm?: number | null;
          updated_at?: string;
          user_id?: string;
          weight_kg?: number | null;
        };
        Update: {
          body_fat_pct?: number | null;
          created_at?: string;
          height_cm?: number | null;
          id?: string;
          measured_on?: string;
          resting_heart_rate_bpm?: number | null;
          updated_at?: string;
          user_id?: string;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      consent_documents: {
        Row: {
          body_de: string;
          consent_type: Database['public']['Enums']['consent_type'];
          created_at: string;
          published_at: string | null;
          title_de: string;
          version: number;
        };
        Insert: {
          body_de: string;
          consent_type: Database['public']['Enums']['consent_type'];
          created_at?: string;
          published_at?: string | null;
          title_de: string;
          version: number;
        };
        Update: {
          body_de?: string;
          consent_type?: Database['public']['Enums']['consent_type'];
          created_at?: string;
          published_at?: string | null;
          title_de?: string;
          version?: number;
        };
        Relationships: [];
      };
      consents: {
        Row: {
          consent_type: Database['public']['Enums']['consent_type'];
          granted_at: string;
          id: string;
          platform: Database['public']['Enums']['consent_platform'];
          revoked_at: string | null;
          user_id: string;
          version: number;
        };
        Insert: {
          consent_type: Database['public']['Enums']['consent_type'];
          granted_at?: string;
          id?: string;
          platform: Database['public']['Enums']['consent_platform'];
          revoked_at?: string | null;
          user_id?: string;
          version: number;
        };
        Update: {
          consent_type?: Database['public']['Enums']['consent_type'];
          granted_at?: string;
          id?: string;
          platform?: Database['public']['Enums']['consent_platform'];
          revoked_at?: string | null;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'consents_consent_type_version_fkey';
            columns: ['consent_type', 'version'];
            isOneToOne: false;
            referencedRelation: 'consent_documents';
            referencedColumns: ['consent_type', 'version'];
          },
        ];
      };
      equipment: {
        Row: {
          category: Database['public']['Enums']['equipment_category'];
          created_at: string;
          has_weights: boolean;
          id: string;
          name_de: string;
          sort_order: number;
        };
        Insert: {
          category: Database['public']['Enums']['equipment_category'];
          created_at?: string;
          has_weights?: boolean;
          id: string;
          name_de: string;
          sort_order?: number;
        };
        Update: {
          category?: Database['public']['Enums']['equipment_category'];
          created_at?: string;
          has_weights?: boolean;
          id?: string;
          name_de?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      food_preferences: {
        Row: {
          created_at: string;
          food_group: string;
          kind: Database['public']['Enums']['food_preference_kind'];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          food_group: string;
          kind: Database['public']['Enums']['food_preference_kind'];
          user_id?: string;
        };
        Update: {
          created_at?: string;
          food_group?: string;
          kind?: Database['public']['Enums']['food_preference_kind'];
          user_id?: string;
        };
        Relationships: [];
      };
      goals: {
        Row: {
          created_at: string;
          discipline: Database['public']['Enums']['endurance_discipline'] | null;
          goal_type: Database['public']['Enums']['goal_type'];
          minutes_per_session: number | null;
          preferred_days: number[];
          sessions_per_week: number | null;
          target_date: string | null;
          training_location: Database['public']['Enums']['training_location'] | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          discipline?: Database['public']['Enums']['endurance_discipline'] | null;
          goal_type: Database['public']['Enums']['goal_type'];
          minutes_per_session?: number | null;
          preferred_days?: number[];
          sessions_per_week?: number | null;
          target_date?: string | null;
          training_location?: Database['public']['Enums']['training_location'] | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          discipline?: Database['public']['Enums']['endurance_discipline'] | null;
          goal_type?: Database['public']['Enums']['goal_type'];
          minutes_per_session?: number | null;
          preferred_days?: number[];
          sessions_per_week?: number | null;
          target_date?: string | null;
          training_location?: Database['public']['Enums']['training_location'] | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      health_screening: {
        Row: {
          answers: Json;
          created_at: string;
          flags: string[];
          id: string;
          medical_notice_acknowledged_at: string | null;
          user_id: string;
        };
        Insert: {
          answers: Json;
          created_at?: string;
          flags?: string[];
          id?: string;
          medical_notice_acknowledged_at?: string | null;
          user_id?: string;
        };
        Update: {
          answers?: Json;
          created_at?: string;
          flags?: string[];
          id?: string;
          medical_notice_acknowledged_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      measurement_reminders: {
        Row: {
          created_at: string;
          enabled: boolean;
          interval_days: number;
          next_due_on: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          enabled?: boolean;
          interval_days?: number;
          next_due_on?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          interval_days?: number;
          next_due_on?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      nutrition_prefs: {
        Row: {
          cooking_mode: Database['public']['Enums']['cooking_mode'] | null;
          created_at: string;
          diet_type: Database['public']['Enums']['diet_type'];
          eats_pork: boolean | null;
          meals_per_day: number | null;
          mealprep_days: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cooking_mode?: Database['public']['Enums']['cooking_mode'] | null;
          created_at?: string;
          diet_type: Database['public']['Enums']['diet_type'];
          eats_pork?: boolean | null;
          meals_per_day?: number | null;
          mealprep_days?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          cooking_mode?: Database['public']['Enums']['cooking_mode'] | null;
          created_at?: string;
          diet_type?: Database['public']['Enums']['diet_type'];
          eats_pork?: boolean | null;
          meals_per_day?: number | null;
          mealprep_days?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          birth_date: string;
          created_at: string;
          cycle_module_interest: boolean | null;
          experience_level: Database['public']['Enums']['experience_level'] | null;
          locale: Database['public']['Enums']['app_locale'];
          onboarding_completed_at: string | null;
          onboarding_step: string | null;
          sex: Database['public']['Enums']['sex'] | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          birth_date: string;
          created_at?: string;
          cycle_module_interest?: boolean | null;
          experience_level?: Database['public']['Enums']['experience_level'] | null;
          locale?: Database['public']['Enums']['app_locale'];
          onboarding_completed_at?: string | null;
          onboarding_step?: string | null;
          sex?: Database['public']['Enums']['sex'] | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          birth_date?: string;
          created_at?: string;
          cycle_module_interest?: boolean | null;
          experience_level?: Database['public']['Enums']['experience_level'] | null;
          locale?: Database['public']['Enums']['app_locale'];
          onboarding_completed_at?: string | null;
          onboarding_step?: string | null;
          sex?: Database['public']['Enums']['sex'] | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_equipment: {
        Row: {
          created_at: string;
          equipment_id: string;
          location: Database['public']['Enums']['equipment_location'];
          note: string | null;
          updated_at: string;
          user_id: string;
          weights_kg: number[];
        };
        Insert: {
          created_at?: string;
          equipment_id: string;
          location: Database['public']['Enums']['equipment_location'];
          note?: string | null;
          updated_at?: string;
          user_id?: string;
          weights_kg?: number[];
        };
        Update: {
          created_at?: string;
          equipment_id?: string;
          location?: Database['public']['Enums']['equipment_location'];
          note?: string | null;
          updated_at?: string;
          user_id?: string;
          weights_kg?: number[];
        };
        Relationships: [
          {
            foreignKeyName: 'user_equipment_equipment_id_fkey';
            columns: ['equipment_id'];
            isOneToOne: false;
            referencedRelation: 'equipment';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_consent_version: {
        Args: { p_type: Database['public']['Enums']['consent_type'] };
        Returns: number;
      };
      delete_my_account: { Args: never; Returns: undefined };
      has_valid_consent: {
        Args: { p_type: Database['public']['Enums']['consent_type'] };
        Returns: boolean;
      };
    };
    Enums: {
      app_locale: 'de-DE' | 'de-AT' | 'de-CH';
      consent_platform: 'ios' | 'android' | 'web';
      consent_type: 'terms' | 'privacy' | 'health_data' | 'cycle_data';
      cooking_mode: 'daily' | 'meal_prep';
      diet_type: 'omnivore' | 'vegetarian' | 'vegan';
      endurance_discipline:
        | '5k'
        | '10k'
        | 'half_marathon'
        | 'marathon'
        | 'triathlon_sprint'
        | 'triathlon_olympic'
        | 'triathlon_middle'
        | 'triathlon_long'
        | 'cycling'
        | 'swimming';
      equipment_category: 'free_weights' | 'bench' | 'bodyweight' | 'bands' | 'cardio' | 'other';
      equipment_location: 'home' | 'gym';
      experience_level: 'beginner' | 'advanced' | 'competitive';
      food_preference_kind: 'like' | 'dislike' | 'intolerance';
      goal_type: 'fat_loss' | 'definition' | 'muscle_gain' | 'general_fitness' | 'endurance';
      sex: 'male' | 'female' | 'diverse' | 'unspecified';
      training_location: 'gym' | 'home' | 'both';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_locale: ['de-DE', 'de-AT', 'de-CH'],
      consent_platform: ['ios', 'android', 'web'],
      consent_type: ['terms', 'privacy', 'health_data', 'cycle_data'],
      cooking_mode: ['daily', 'meal_prep'],
      diet_type: ['omnivore', 'vegetarian', 'vegan'],
      endurance_discipline: [
        '5k',
        '10k',
        'half_marathon',
        'marathon',
        'triathlon_sprint',
        'triathlon_olympic',
        'triathlon_middle',
        'triathlon_long',
        'cycling',
        'swimming',
      ],
      equipment_category: ['free_weights', 'bench', 'bodyweight', 'bands', 'cardio', 'other'],
      equipment_location: ['home', 'gym'],
      experience_level: ['beginner', 'advanced', 'competitive'],
      food_preference_kind: ['like', 'dislike', 'intolerance'],
      goal_type: ['fat_loss', 'definition', 'muscle_gain', 'general_fitness', 'endurance'],
      sex: ['male', 'female', 'diverse', 'unspecified'],
      training_location: ['gym', 'home', 'both'],
    },
  },
} as const;
