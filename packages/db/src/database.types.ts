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
      admin_users: {
        Row: {
          created_at: string;
          role: Database['public']['Enums']['admin_role'];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          role?: Database['public']['Enums']['admin_role'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          role?: Database['public']['Enums']['admin_role'];
          user_id?: string;
        };
        Relationships: [];
      };
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
          home_selectable: boolean;
          id: string;
          name_de: string;
          sort_order: number;
        };
        Insert: {
          category: Database['public']['Enums']['equipment_category'];
          created_at?: string;
          has_weights?: boolean;
          home_selectable?: boolean;
          id: string;
          name_de: string;
          sort_order?: number;
        };
        Update: {
          category?: Database['public']['Enums']['equipment_category'];
          created_at?: string;
          has_weights?: boolean;
          home_selectable?: boolean;
          id?: string;
          name_de?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      exercise_alternatives: {
        Row: {
          alternative_id: string;
          exercise_id: string;
          priority: number;
          reason: Database['public']['Enums']['alternative_reason'];
        };
        Insert: {
          alternative_id: string;
          exercise_id: string;
          priority: number;
          reason: Database['public']['Enums']['alternative_reason'];
        };
        Update: {
          alternative_id?: string;
          exercise_id?: string;
          priority?: number;
          reason?: Database['public']['Enums']['alternative_reason'];
        };
        Relationships: [
          {
            foreignKeyName: 'exercise_alternatives_alternative_id_fkey';
            columns: ['alternative_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'exercise_alternatives_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      exercises: {
        Row: {
          aliases_de: string[];
          caution_tags: Database['public']['Enums']['caution_tag'][];
          common_mistakes_de: string[];
          created_at: string;
          description_de: string;
          difficulty: number;
          equipment_ids: string[];
          id: string;
          load_type: Database['public']['Enums']['load_type'];
          mechanics: Database['public']['Enums']['exercise_mechanics'];
          meta: Json;
          movement_pattern: Database['public']['Enums']['movement_pattern'];
          name_de: string;
          name_en: string;
          primary_muscles: Database['public']['Enums']['muscle_group'][];
          safety_note_de: string;
          secondary_muscles: Database['public']['Enums']['muscle_group'][];
          status: Database['public']['Enums']['content_status'];
          steps_de: string[];
          tips_de: string[];
          unilateral: boolean;
          updated_at: string;
          version: number;
        };
        Insert: {
          aliases_de?: string[];
          caution_tags?: Database['public']['Enums']['caution_tag'][];
          common_mistakes_de: string[];
          created_at?: string;
          description_de: string;
          difficulty: number;
          equipment_ids?: string[];
          id: string;
          load_type: Database['public']['Enums']['load_type'];
          mechanics: Database['public']['Enums']['exercise_mechanics'];
          meta?: Json;
          movement_pattern: Database['public']['Enums']['movement_pattern'];
          name_de: string;
          name_en: string;
          primary_muscles: Database['public']['Enums']['muscle_group'][];
          safety_note_de: string;
          secondary_muscles?: Database['public']['Enums']['muscle_group'][];
          status: Database['public']['Enums']['content_status'];
          steps_de: string[];
          tips_de: string[];
          unilateral?: boolean;
          updated_at?: string;
          version: number;
        };
        Update: {
          aliases_de?: string[];
          caution_tags?: Database['public']['Enums']['caution_tag'][];
          common_mistakes_de?: string[];
          created_at?: string;
          description_de?: string;
          difficulty?: number;
          equipment_ids?: string[];
          id?: string;
          load_type?: Database['public']['Enums']['load_type'];
          mechanics?: Database['public']['Enums']['exercise_mechanics'];
          meta?: Json;
          movement_pattern?: Database['public']['Enums']['movement_pattern'];
          name_de?: string;
          name_en?: string;
          primary_muscles?: Database['public']['Enums']['muscle_group'][];
          safety_note_de?: string;
          secondary_muscles?: Database['public']['Enums']['muscle_group'][];
          status?: Database['public']['Enums']['content_status'];
          steps_de?: string[];
          tips_de?: string[];
          unilateral?: boolean;
          updated_at?: string;
          version?: number;
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
      plan_templates: {
        Row: {
          created_at: string;
          description_de: string;
          experience_level: Database['public']['Enums']['experience_level'];
          goal_type: Database['public']['Enums']['goal_type'];
          id: string;
          location: Database['public']['Enums']['equipment_location'];
          meta: Json;
          minutes_max: number;
          minutes_min: number;
          optional_equipment_ids: string[];
          required_equipment_ids: string[];
          sessions_per_week: number;
          sex: Database['public']['Enums']['sex'] | null;
          status: Database['public']['Enums']['content_status'];
          title_de: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          description_de: string;
          experience_level: Database['public']['Enums']['experience_level'];
          goal_type: Database['public']['Enums']['goal_type'];
          id: string;
          location: Database['public']['Enums']['equipment_location'];
          meta?: Json;
          minutes_max: number;
          minutes_min: number;
          optional_equipment_ids?: string[];
          required_equipment_ids?: string[];
          sessions_per_week: number;
          sex?: Database['public']['Enums']['sex'] | null;
          status: Database['public']['Enums']['content_status'];
          title_de: string;
          updated_at?: string;
          version: number;
        };
        Update: {
          created_at?: string;
          description_de?: string;
          experience_level?: Database['public']['Enums']['experience_level'];
          goal_type?: Database['public']['Enums']['goal_type'];
          id?: string;
          location?: Database['public']['Enums']['equipment_location'];
          meta?: Json;
          minutes_max?: number;
          minutes_min?: number;
          optional_equipment_ids?: string[];
          required_equipment_ids?: string[];
          sessions_per_week?: number;
          sex?: Database['public']['Enums']['sex'] | null;
          status?: Database['public']['Enums']['content_status'];
          title_de?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      planned_exercises: {
        Row: {
          duration_s: number | null;
          exercise_id: string;
          exercise_name_de: string;
          id: string;
          notes_de: string | null;
          order_no: number;
          reps_max: number | null;
          reps_min: number | null;
          rest_s: number;
          rpe_target: number;
          session_id: string;
          sets: number;
          source_exercise_id: string;
          superset_group: string | null;
          target_weight_kg: number | null;
          user_id: string;
        };
        Insert: {
          duration_s?: number | null;
          exercise_id: string;
          exercise_name_de: string;
          id?: string;
          notes_de?: string | null;
          order_no: number;
          reps_max?: number | null;
          reps_min?: number | null;
          rest_s: number;
          rpe_target: number;
          session_id: string;
          sets: number;
          source_exercise_id: string;
          superset_group?: string | null;
          target_weight_kg?: number | null;
          user_id: string;
        };
        Update: {
          duration_s?: number | null;
          exercise_id?: string;
          exercise_name_de?: string;
          id?: string;
          notes_de?: string | null;
          order_no?: number;
          reps_max?: number | null;
          reps_min?: number | null;
          rest_s?: number;
          rpe_target?: number;
          session_id?: string;
          sets?: number;
          source_exercise_id?: string;
          superset_group?: string | null;
          target_weight_kg?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'planned_exercises_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'planned_exercises_session_id_user_id_fkey';
            columns: ['session_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'planned_sessions';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'planned_exercises_source_exercise_id_fkey';
            columns: ['source_exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      planned_sessions: {
        Row: {
          block_no: number;
          cooldown_de: string;
          created_at: string;
          estimated_minutes: number;
          focus: Database['public']['Enums']['session_focus'];
          id: string;
          is_deload: boolean;
          is_intro_week: boolean;
          name_de: string;
          original_date: string | null;
          plan_id: string;
          scheduled_on: string;
          status: Database['public']['Enums']['planned_session_status'];
          template_day_index: number;
          updated_at: string;
          user_id: string;
          warmup_de: string;
          week_no: number;
        };
        Insert: {
          block_no: number;
          cooldown_de: string;
          created_at?: string;
          estimated_minutes: number;
          focus: Database['public']['Enums']['session_focus'];
          id?: string;
          is_deload?: boolean;
          is_intro_week?: boolean;
          name_de: string;
          original_date?: string | null;
          plan_id: string;
          scheduled_on: string;
          status?: Database['public']['Enums']['planned_session_status'];
          template_day_index: number;
          updated_at?: string;
          user_id: string;
          warmup_de: string;
          week_no: number;
        };
        Update: {
          block_no?: number;
          cooldown_de?: string;
          created_at?: string;
          estimated_minutes?: number;
          focus?: Database['public']['Enums']['session_focus'];
          id?: string;
          is_deload?: boolean;
          is_intro_week?: boolean;
          name_de?: string;
          original_date?: string | null;
          plan_id?: string;
          scheduled_on?: string;
          status?: Database['public']['Enums']['planned_session_status'];
          template_day_index?: number;
          updated_at?: string;
          user_id?: string;
          warmup_de?: string;
          week_no?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'planned_sessions_plan_id_user_id_fkey';
            columns: ['plan_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'user_plans';
            referencedColumns: ['id', 'user_id'];
          },
        ];
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
      template_exercises: {
        Row: {
          day_index: number;
          duration_s: number | null;
          exercise_id: string;
          notes_de: string | null;
          order_no: number;
          reps_max: number | null;
          reps_min: number | null;
          rest_s: number;
          rpe_target: number;
          sets: number;
          superset_group: string | null;
          template_id: string;
        };
        Insert: {
          day_index: number;
          duration_s?: number | null;
          exercise_id: string;
          notes_de?: string | null;
          order_no: number;
          reps_max?: number | null;
          reps_min?: number | null;
          rest_s: number;
          rpe_target: number;
          sets: number;
          superset_group?: string | null;
          template_id: string;
        };
        Update: {
          day_index?: number;
          duration_s?: number | null;
          exercise_id?: string;
          notes_de?: string | null;
          order_no?: number;
          reps_max?: number | null;
          reps_min?: number | null;
          rest_s?: number;
          rpe_target?: number;
          sets?: number;
          superset_group?: string | null;
          template_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'template_exercises_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'template_exercises_template_id_day_index_fkey';
            columns: ['template_id', 'day_index'];
            isOneToOne: false;
            referencedRelation: 'template_sessions';
            referencedColumns: ['template_id', 'day_index'];
          },
        ];
      };
      template_sessions: {
        Row: {
          cooldown_de: string;
          day_index: number;
          estimated_minutes: number;
          focus: Database['public']['Enums']['session_focus'];
          name_de: string;
          template_id: string;
          warmup_de: string;
        };
        Insert: {
          cooldown_de: string;
          day_index: number;
          estimated_minutes: number;
          focus: Database['public']['Enums']['session_focus'];
          name_de: string;
          template_id: string;
          warmup_de: string;
        };
        Update: {
          cooldown_de?: string;
          day_index?: number;
          estimated_minutes?: number;
          focus?: Database['public']['Enums']['session_focus'];
          name_de?: string;
          template_id?: string;
          warmup_de?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'template_sessions_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'plan_templates';
            referencedColumns: ['id'];
          },
        ];
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
      user_plans: {
        Row: {
          created_at: string;
          engine_version: number;
          id: string;
          inputs: Json;
          match_quality: Database['public']['Enums']['plan_match_quality'];
          medical_notice: boolean;
          notes: Database['public']['Enums']['plan_note'][];
          replaced_at: string | null;
          start_date: string;
          status: Database['public']['Enums']['plan_status'];
          template_id: string;
          template_title_de: string;
          template_version: number;
          user_id: string;
          uses_health_data: boolean;
        };
        Insert: {
          created_at?: string;
          engine_version: number;
          id?: string;
          inputs: Json;
          match_quality: Database['public']['Enums']['plan_match_quality'];
          medical_notice?: boolean;
          notes?: Database['public']['Enums']['plan_note'][];
          replaced_at?: string | null;
          start_date: string;
          status?: Database['public']['Enums']['plan_status'];
          template_id: string;
          template_title_de: string;
          template_version: number;
          user_id?: string;
          uses_health_data?: boolean;
        };
        Update: {
          created_at?: string;
          engine_version?: number;
          id?: string;
          inputs?: Json;
          match_quality?: Database['public']['Enums']['plan_match_quality'];
          medical_notice?: boolean;
          notes?: Database['public']['Enums']['plan_note'][];
          replaced_at?: string | null;
          start_date?: string;
          status?: Database['public']['Enums']['plan_status'];
          template_id?: string;
          template_title_de?: string;
          template_version?: number;
          user_id?: string;
          uses_health_data?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'user_plans_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'plan_templates';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      append_plan_block: { Args: { p_plan_id: string; p_sessions: Json }; Returns: number };
      current_consent_version: {
        Args: { p_type: Database['public']['Enums']['consent_type'] };
        Returns: number;
      };
      delete_my_account: { Args: never; Returns: undefined };
      has_valid_consent: {
        Args: { p_type: Database['public']['Enums']['consent_type'] };
        Returns: boolean;
      };
      replace_food_preferences: {
        Args: { p_items: Json; p_scope: string };
        Returns: undefined;
      };
      replace_user_equipment: {
        Args: {
          p_items: Json;
          p_location: Database['public']['Enums']['equipment_location'];
        };
        Returns: undefined;
      };
      save_training_plan: { Args: { p_plan: Json }; Returns: string };
      seed_content: { Args: { p_content: Json }; Returns: Json };
    };
    Enums: {
      admin_role: 'content_admin';
      alternative_reason: 'other_equipment' | 'easier' | 'harder' | 'home';
      app_locale: 'de-DE' | 'de-AT' | 'de-CH';
      caution_tag: 'high_impact' | 'spinal_loading' | 'overhead' | 'long_supine' | 'high_skill';
      consent_platform: 'ios' | 'android' | 'web';
      consent_type: 'terms' | 'privacy' | 'health_data' | 'cycle_data';
      content_status: 'draft' | 'published' | 'archived';
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
      equipment_category:
        'free_weights' | 'bench' | 'bodyweight' | 'bands' | 'cardio' | 'other' | 'machines';
      equipment_location: 'home' | 'gym';
      exercise_mechanics: 'compound' | 'isolation';
      experience_level: 'beginner' | 'advanced' | 'competitive';
      food_preference_kind: 'like' | 'dislike' | 'intolerance';
      goal_type: 'fat_loss' | 'definition' | 'muscle_gain' | 'general_fitness' | 'endurance';
      load_type: 'weight' | 'bodyweight' | 'band' | 'time';
      movement_pattern:
        | 'squat'
        | 'hinge'
        | 'lunge'
        | 'horizontal_push'
        | 'vertical_push'
        | 'horizontal_pull'
        | 'vertical_pull'
        | 'elbow_flexion'
        | 'elbow_extension'
        | 'shoulder_isolation'
        | 'knee_flexion'
        | 'knee_extension'
        | 'hip_extension'
        | 'calf_raise'
        | 'core_anti_extension'
        | 'core_anti_rotation'
        | 'core_flexion'
        | 'carry'
        | 'conditioning'
        | 'mobility';
      muscle_group:
        | 'chest'
        | 'lats'
        | 'upper_back'
        | 'front_delts'
        | 'side_delts'
        | 'rear_delts'
        | 'biceps'
        | 'triceps'
        | 'forearms'
        | 'abs'
        | 'obliques'
        | 'lower_back'
        | 'glutes'
        | 'quadriceps'
        | 'hamstrings'
        | 'adductors'
        | 'calves';
      plan_match_quality: 'exact' | 'close' | 'fallback';
      plan_note:
        | 'goal_endurance_not_yet'
        | 'days_rotated'
        | 'days_capped'
        | 'days_added'
        | 'back_to_back_sessions'
        | 'minutes_shortened'
        | 'minutes_below_minimum'
        | 'volume_reduced'
        | 'exercises_substituted'
        | 'exercises_removed'
        | 'no_pull_exercise'
        | 'location_mismatch';
      plan_status: 'active' | 'replaced';
      planned_session_status: 'planned' | 'skipped';
      session_focus: 'full_body' | 'upper' | 'lower';
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
      admin_role: ['content_admin'],
      alternative_reason: ['other_equipment', 'easier', 'harder', 'home'],
      app_locale: ['de-DE', 'de-AT', 'de-CH'],
      caution_tag: ['high_impact', 'spinal_loading', 'overhead', 'long_supine', 'high_skill'],
      consent_platform: ['ios', 'android', 'web'],
      consent_type: ['terms', 'privacy', 'health_data', 'cycle_data'],
      content_status: ['draft', 'published', 'archived'],
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
      equipment_category: [
        'free_weights',
        'bench',
        'bodyweight',
        'bands',
        'cardio',
        'other',
        'machines',
      ],
      equipment_location: ['home', 'gym'],
      exercise_mechanics: ['compound', 'isolation'],
      experience_level: ['beginner', 'advanced', 'competitive'],
      food_preference_kind: ['like', 'dislike', 'intolerance'],
      goal_type: ['fat_loss', 'definition', 'muscle_gain', 'general_fitness', 'endurance'],
      load_type: ['weight', 'bodyweight', 'band', 'time'],
      movement_pattern: [
        'squat',
        'hinge',
        'lunge',
        'horizontal_push',
        'vertical_push',
        'horizontal_pull',
        'vertical_pull',
        'elbow_flexion',
        'elbow_extension',
        'shoulder_isolation',
        'knee_flexion',
        'knee_extension',
        'hip_extension',
        'calf_raise',
        'core_anti_extension',
        'core_anti_rotation',
        'core_flexion',
        'carry',
        'conditioning',
        'mobility',
      ],
      muscle_group: [
        'chest',
        'lats',
        'upper_back',
        'front_delts',
        'side_delts',
        'rear_delts',
        'biceps',
        'triceps',
        'forearms',
        'abs',
        'obliques',
        'lower_back',
        'glutes',
        'quadriceps',
        'hamstrings',
        'adductors',
        'calves',
      ],
      plan_match_quality: ['exact', 'close', 'fallback'],
      plan_note: [
        'goal_endurance_not_yet',
        'days_rotated',
        'days_capped',
        'days_added',
        'back_to_back_sessions',
        'minutes_shortened',
        'minutes_below_minimum',
        'volume_reduced',
        'exercises_substituted',
        'exercises_removed',
        'no_pull_exercise',
        'location_mismatch',
      ],
      plan_status: ['active', 'replaced'],
      planned_session_status: ['planned', 'skipped'],
      session_focus: ['full_body', 'upper', 'lower'],
      sex: ['male', 'female', 'diverse', 'unspecified'],
      training_location: ['gym', 'home', 'both'],
    },
  },
} as const;
