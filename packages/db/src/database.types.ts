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
      cardio_logs: {
        Row: {
          distance_m: number | null;
          duration_s: number;
          elevation_m: number | null;
          modality: Database['public']['Enums']['endurance_modality'];
          session_log_id: string;
          user_id: string;
        };
        Insert: {
          distance_m?: number | null;
          duration_s: number;
          elevation_m?: number | null;
          modality: Database['public']['Enums']['endurance_modality'];
          session_log_id: string;
          user_id: string;
        };
        Update: {
          distance_m?: number | null;
          duration_s?: number;
          elevation_m?: number | null;
          modality?: Database['public']['Enums']['endurance_modality'];
          session_log_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cardio_logs_session_log_id_user_id_fkey';
            columns: ['session_log_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'session_logs';
            referencedColumns: ['id', 'user_id'];
          },
        ];
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
      exercise_logs: {
        Row: {
          exercise_id: string;
          exercise_name_de: string;
          id: string;
          is_return: boolean;
          load_type: Database['public']['Enums']['load_type'];
          order_no: number;
          planned_exercise_id: string | null;
          reps_max: number | null;
          reps_min: number | null;
          session_log_id: string;
          state_duration_s: number | null;
          state_extra_set: boolean | null;
          state_target_reps: number | null;
          state_weight_kg: number | null;
          status: Database['public']['Enums']['exercise_log_status'];
          target_duration_s: number | null;
          target_extra_set: boolean | null;
          target_reps: number | null;
          target_rpe: number | null;
          target_sets: number | null;
          target_weight_kg: number | null;
          user_id: string;
          weight_confirmed: boolean;
        };
        Insert: {
          exercise_id: string;
          exercise_name_de: string;
          id?: string;
          is_return?: boolean;
          load_type: Database['public']['Enums']['load_type'];
          order_no: number;
          planned_exercise_id?: string | null;
          reps_max?: number | null;
          reps_min?: number | null;
          session_log_id: string;
          state_duration_s?: number | null;
          state_extra_set?: boolean | null;
          state_target_reps?: number | null;
          state_weight_kg?: number | null;
          status: Database['public']['Enums']['exercise_log_status'];
          target_duration_s?: number | null;
          target_extra_set?: boolean | null;
          target_reps?: number | null;
          target_rpe?: number | null;
          target_sets?: number | null;
          target_weight_kg?: number | null;
          user_id: string;
          weight_confirmed?: boolean;
        };
        Update: {
          exercise_id?: string;
          exercise_name_de?: string;
          id?: string;
          is_return?: boolean;
          load_type?: Database['public']['Enums']['load_type'];
          order_no?: number;
          planned_exercise_id?: string | null;
          reps_max?: number | null;
          reps_min?: number | null;
          session_log_id?: string;
          state_duration_s?: number | null;
          state_extra_set?: boolean | null;
          state_target_reps?: number | null;
          state_weight_kg?: number | null;
          status?: Database['public']['Enums']['exercise_log_status'];
          target_duration_s?: number | null;
          target_extra_set?: boolean | null;
          target_reps?: number | null;
          target_rpe?: number | null;
          target_sets?: number | null;
          target_weight_kg?: number | null;
          user_id?: string;
          weight_confirmed?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'exercise_logs_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'exercise_logs_planned_exercise_id_user_id_fkey';
            columns: ['planned_exercise_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'planned_exercises';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'exercise_logs_session_log_id_user_id_fkey';
            columns: ['session_log_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'session_logs';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      exercise_start_weights: {
        Row: {
          exercise_id: string;
          updated_at: string;
          user_id: string;
          weight_kg: number;
        };
        Insert: {
          exercise_id: string;
          updated_at?: string;
          user_id?: string;
          weight_kg: number;
        };
        Update: {
          exercise_id?: string;
          updated_at?: string;
          user_id?: string;
          weight_kg?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'exercise_start_weights_exercise_id_fkey';
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
      food_dislikes: {
        Row: {
          food_id: string;
          user_id: string;
        };
        Insert: {
          food_id: string;
          user_id?: string;
        };
        Update: {
          food_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'food_dislikes_food_id_fkey';
            columns: ['food_id'];
            isOneToOne: false;
            referencedRelation: 'foods';
            referencedColumns: ['id'];
          },
        ];
      };
      food_package_sizes: {
        Row: {
          created_at: string;
          data: Json;
          food_id: string;
          id: string;
          package_size_g: number;
          status: Database['public']['Enums']['content_status'];
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          data: Json;
          food_id: string;
          id: string;
          package_size_g: number;
          status: Database['public']['Enums']['content_status'];
          updated_at?: string;
          version: number;
        };
        Update: {
          created_at?: string;
          data?: Json;
          food_id?: string;
          id?: string;
          package_size_g?: number;
          status?: Database['public']['Enums']['content_status'];
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'food_package_sizes_food_id_fkey';
            columns: ['food_id'];
            isOneToOne: true;
            referencedRelation: 'foods';
            referencedColumns: ['id'];
          },
        ];
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
      foods: {
        Row: {
          alcohol: boolean;
          animal: string[];
          created_at: string;
          data: Json;
          freezable: boolean;
          gelatin_origin: string | null;
          groups: string[];
          id: string;
          max_fridge_days: number;
          meat_kind: string[];
          name_de: string;
          pantry: boolean;
          pregnancy_caution: boolean;
          shopping_category: string;
          status: Database['public']['Enums']['content_status'];
          updated_at: string;
          version: number;
        };
        Insert: {
          alcohol: boolean;
          animal?: string[];
          created_at?: string;
          data: Json;
          freezable: boolean;
          gelatin_origin?: string | null;
          groups?: string[];
          id: string;
          max_fridge_days: number;
          meat_kind?: string[];
          name_de: string;
          pantry: boolean;
          pregnancy_caution: boolean;
          shopping_category: string;
          status: Database['public']['Enums']['content_status'];
          updated_at?: string;
          version: number;
        };
        Update: {
          alcohol?: boolean;
          animal?: string[];
          created_at?: string;
          data?: Json;
          freezable?: boolean;
          gelatin_origin?: string | null;
          groups?: string[];
          id?: string;
          max_fridge_days?: number;
          meat_kind?: string[];
          name_de?: string;
          pantry?: boolean;
          pregnancy_caution?: boolean;
          shopping_category?: string;
          status?: Database['public']['Enums']['content_status'];
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      goals: {
        Row: {
          created_at: string;
          discipline: Database['public']['Enums']['endurance_discipline'] | null;
          goal_type: Database['public']['Enums']['goal_type'];
          target_date: string | null;
          training_location: Database['public']['Enums']['training_location'] | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          discipline?: Database['public']['Enums']['endurance_discipline'] | null;
          goal_type: Database['public']['Enums']['goal_type'];
          target_date?: string | null;
          training_location?: Database['public']['Enums']['training_location'] | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          discipline?: Database['public']['Enums']['endurance_discipline'] | null;
          goal_type?: Database['public']['Enums']['goal_type'];
          target_date?: string | null;
          training_location?: Database['public']['Enums']['training_location'] | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      guides: {
        Row: {
          created_at: string;
          data: Json;
          id: string;
          status: Database['public']['Enums']['content_status'];
          title_de: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          data: Json;
          id: string;
          status: Database['public']['Enums']['content_status'];
          title_de: string;
          updated_at?: string;
          version: number;
        };
        Update: {
          created_at?: string;
          data?: Json;
          id?: string;
          status?: Database['public']['Enums']['content_status'];
          title_de?: string;
          updated_at?: string;
          version?: number;
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
      ingredient_substitutions: {
        Row: {
          created_at: string;
          data: Json;
          factor: number;
          food_id: string;
          id: string;
          role: string;
          status: Database['public']['Enums']['content_status'];
          substitute_food_id: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          data: Json;
          factor: number;
          food_id: string;
          id: string;
          role: string;
          status: Database['public']['Enums']['content_status'];
          substitute_food_id: string;
          updated_at?: string;
          version: number;
        };
        Update: {
          created_at?: string;
          data?: Json;
          factor?: number;
          food_id?: string;
          id?: string;
          role?: string;
          status?: Database['public']['Enums']['content_status'];
          substitute_food_id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'ingredient_substitutions_food_id_fkey';
            columns: ['food_id'];
            isOneToOne: false;
            referencedRelation: 'foods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ingredient_substitutions_substitute_food_id_fkey';
            columns: ['substitute_food_id'];
            isOneToOne: false;
            referencedRelation: 'foods';
            referencedColumns: ['id'];
          },
        ];
      };
      meal_plan_items: {
        Row: {
          carbs_g: number;
          cook_date: string;
          date: string;
          day_status: string;
          factor: number;
          fat_g: number;
          ingredient_swaps: Json;
          is_fill: boolean;
          kcal: number;
          meal_prep_plan_id: string | null;
          omitted_optional: Json;
          plan_id: string;
          prep_kind: string;
          protein_g: number;
          recipe_id: string;
          recipe_version: number;
          role: string | null;
          slot: string;
          storage: string | null;
          substitutions: Json;
          title_de: string;
          user_id: string;
        };
        Insert: {
          carbs_g: number;
          cook_date: string;
          date: string;
          day_status: string;
          factor: number;
          fat_g: number;
          ingredient_swaps?: Json;
          is_fill: boolean;
          kcal: number;
          meal_prep_plan_id?: string | null;
          omitted_optional?: Json;
          plan_id: string;
          prep_kind: string;
          protein_g: number;
          recipe_id: string;
          recipe_version: number;
          role?: string | null;
          slot: string;
          storage?: string | null;
          substitutions?: Json;
          title_de: string;
          user_id: string;
        };
        Update: {
          carbs_g?: number;
          cook_date?: string;
          date?: string;
          day_status?: string;
          factor?: number;
          fat_g?: number;
          ingredient_swaps?: Json;
          is_fill?: boolean;
          kcal?: number;
          meal_prep_plan_id?: string | null;
          omitted_optional?: Json;
          plan_id?: string;
          prep_kind?: string;
          protein_g?: number;
          recipe_id?: string;
          recipe_version?: number;
          role?: string | null;
          slot?: string;
          storage?: string | null;
          substitutions?: Json;
          title_de?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'meal_plan_items_meal_prep_plan_id_fkey';
            columns: ['meal_prep_plan_id'];
            isOneToOne: false;
            referencedRelation: 'meal_prep_plans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'meal_plan_items_plan_id_user_id_fkey';
            columns: ['plan_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'meal_plans';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'meal_plan_items_recipe_id_fkey';
            columns: ['recipe_id'];
            isOneToOne: false;
            referencedRelation: 'recipes';
            referencedColumns: ['id'];
          },
        ];
      };
      meal_plans: {
        Row: {
          auto_adjusted: boolean;
          cook_day_started_at: string | null;
          created_at: string;
          engine_version: number;
          id: string;
          inputs: Json;
          meal_prep_plan_id: string | null;
          recipes_changed: boolean;
          status: string;
          user_id: string;
          uses_health_data: boolean;
          variant: number;
          week_start: string;
        };
        Insert: {
          auto_adjusted?: boolean;
          cook_day_started_at?: string | null;
          created_at?: string;
          engine_version: number;
          id?: string;
          inputs: Json;
          meal_prep_plan_id?: string | null;
          recipes_changed?: boolean;
          status?: string;
          user_id?: string;
          uses_health_data: boolean;
          variant: number;
          week_start: string;
        };
        Update: {
          auto_adjusted?: boolean;
          cook_day_started_at?: string | null;
          created_at?: string;
          engine_version?: number;
          id?: string;
          inputs?: Json;
          meal_prep_plan_id?: string | null;
          recipes_changed?: boolean;
          status?: string;
          user_id?: string;
          uses_health_data?: boolean;
          variant?: number;
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'meal_plans_meal_prep_plan_id_fkey';
            columns: ['meal_prep_plan_id'];
            isOneToOne: false;
            referencedRelation: 'meal_prep_plans';
            referencedColumns: ['id'];
          },
        ];
      };
      meal_prep_plans: {
        Row: {
          created_at: string;
          data: Json;
          id: string;
          recipe_ids: string[];
          status: Database['public']['Enums']['content_status'];
          title_de: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          data: Json;
          id: string;
          recipe_ids: string[];
          status: Database['public']['Enums']['content_status'];
          title_de: string;
          updated_at?: string;
          version: number;
        };
        Update: {
          created_at?: string;
          data?: Json;
          id?: string;
          recipe_ids?: string[];
          status?: Database['public']['Enums']['content_status'];
          title_de?: string;
          updated_at?: string;
          version?: number;
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
          activity_level: Database['public']['Enums']['activity_level'] | null;
          cooking_mode: Database['public']['Enums']['cooking_mode'] | null;
          created_at: string;
          diet_type: Database['public']['Enums']['diet_type'];
          eats_pork: boolean | null;
          max_prep_minutes_weekday: number | null;
          mealprep_days: number | null;
          mealprep_slots: Database['public']['Enums']['mealprep_slot_mode'];
          meals_per_day: number | null;
          show_energy_numbers: boolean;
          training_time: Database['public']['Enums']['training_time'] | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          activity_level?: Database['public']['Enums']['activity_level'] | null;
          cooking_mode?: Database['public']['Enums']['cooking_mode'] | null;
          created_at?: string;
          diet_type: Database['public']['Enums']['diet_type'];
          eats_pork?: boolean | null;
          max_prep_minutes_weekday?: number | null;
          mealprep_days?: number | null;
          mealprep_slots?: Database['public']['Enums']['mealprep_slot_mode'];
          meals_per_day?: number | null;
          show_energy_numbers?: boolean;
          training_time?: Database['public']['Enums']['training_time'] | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          activity_level?: Database['public']['Enums']['activity_level'] | null;
          cooking_mode?: Database['public']['Enums']['cooking_mode'] | null;
          created_at?: string;
          diet_type?: Database['public']['Enums']['diet_type'];
          eats_pork?: boolean | null;
          max_prep_minutes_weekday?: number | null;
          mealprep_days?: number | null;
          mealprep_slots?: Database['public']['Enums']['mealprep_slot_mode'];
          meals_per_day?: number | null;
          show_energy_numbers?: boolean;
          training_time?: Database['public']['Enums']['training_time'] | null;
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
          effort_target: number | null;
          endurance_modality: Database['public']['Enums']['endurance_modality'] | null;
          estimated_minutes: number;
          focus: Database['public']['Enums']['session_focus'] | null;
          id: string;
          is_deload: boolean;
          is_intro_week: boolean;
          kind: Database['public']['Enums']['planned_session_kind'];
          name_de: string;
          original_date: string | null;
          plan_id: string;
          scheduled_on: string;
          status: Database['public']['Enums']['planned_session_status'];
          template_day_index: number | null;
          updated_at: string;
          user_id: string;
          warmup_de: string;
          week_no: number;
        };
        Insert: {
          block_no: number;
          cooldown_de: string;
          created_at?: string;
          effort_target?: number | null;
          endurance_modality?: Database['public']['Enums']['endurance_modality'] | null;
          estimated_minutes: number;
          focus?: Database['public']['Enums']['session_focus'] | null;
          id?: string;
          is_deload?: boolean;
          is_intro_week?: boolean;
          kind?: Database['public']['Enums']['planned_session_kind'];
          name_de: string;
          original_date?: string | null;
          plan_id: string;
          scheduled_on: string;
          status?: Database['public']['Enums']['planned_session_status'];
          template_day_index?: number | null;
          updated_at?: string;
          user_id: string;
          warmup_de: string;
          week_no: number;
        };
        Update: {
          block_no?: number;
          cooldown_de?: string;
          created_at?: string;
          effort_target?: number | null;
          endurance_modality?: Database['public']['Enums']['endurance_modality'] | null;
          estimated_minutes?: number;
          focus?: Database['public']['Enums']['session_focus'] | null;
          id?: string;
          is_deload?: boolean;
          is_intro_week?: boolean;
          kind?: Database['public']['Enums']['planned_session_kind'];
          name_de?: string;
          original_date?: string | null;
          plan_id?: string;
          scheduled_on?: string;
          status?: Database['public']['Enums']['planned_session_status'];
          template_day_index?: number | null;
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
      recipe_ingredients: {
        Row: {
          amount: number;
          food_id: string;
          optional: boolean;
          position: number;
          recipe_id: string;
          role: string | null;
          scales: boolean;
          unit: string;
        };
        Insert: {
          amount: number;
          food_id: string;
          optional: boolean;
          position: number;
          recipe_id: string;
          role?: string | null;
          scales: boolean;
          unit: string;
        };
        Update: {
          amount?: number;
          food_id?: string;
          optional?: boolean;
          position?: number;
          recipe_id?: string;
          role?: string | null;
          scales?: boolean;
          unit?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'recipe_ingredients_food_id_fkey';
            columns: ['food_id'];
            isOneToOne: false;
            referencedRelation: 'foods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recipe_ingredients_recipe_id_fkey';
            columns: ['recipe_id'];
            isOneToOne: false;
            referencedRelation: 'recipes';
            referencedColumns: ['id'];
          },
        ];
      };
      recipe_ratings: {
        Row: {
          rated_on: string;
          reason: string | null;
          recipe_id: string;
          user_id: string;
          value: string;
        };
        Insert: {
          rated_on: string;
          reason?: string | null;
          recipe_id: string;
          user_id?: string;
          value: string;
        };
        Update: {
          rated_on?: string;
          reason?: string | null;
          recipe_id?: string;
          user_id?: string;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'recipe_ratings_recipe_id_fkey';
            columns: ['recipe_id'];
            isOneToOne: false;
            referencedRelation: 'recipes';
            referencedColumns: ['id'];
          },
        ];
      };
      recipes: {
        Row: {
          allergens: string[];
          categories: string[];
          contains_pork: boolean;
          created_at: string;
          data: Json;
          diet: Database['public']['Enums']['diet_type'];
          id: string;
          meal_types: string[];
          no_cook: boolean;
          servings: number;
          status: Database['public']['Enums']['content_status'];
          title_de: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          allergens?: string[];
          categories?: string[];
          contains_pork: boolean;
          created_at?: string;
          data: Json;
          diet: Database['public']['Enums']['diet_type'];
          id: string;
          meal_types: string[];
          no_cook: boolean;
          servings: number;
          status: Database['public']['Enums']['content_status'];
          title_de: string;
          updated_at?: string;
          version: number;
        };
        Update: {
          allergens?: string[];
          categories?: string[];
          contains_pork?: boolean;
          created_at?: string;
          data?: Json;
          diet?: Database['public']['Enums']['diet_type'];
          id?: string;
          meal_types?: string[];
          no_cook?: boolean;
          servings?: number;
          status?: Database['public']['Enums']['content_status'];
          title_de?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      session_logs: {
        Row: {
          client_updated_at: string;
          created_at: string;
          finished_at: string | null;
          from_health_plan: boolean;
          id: string;
          is_deload: boolean;
          is_free: boolean;
          is_intro_week: boolean;
          kind: Database['public']['Enums']['planned_session_kind'];
          last_write_id: string;
          name_de: string;
          notes: string | null;
          performed_on: string;
          planned_session_id: string | null;
          revision: number;
          session_rpe: number | null;
          source: Database['public']['Enums']['log_source'];
          started_at: string | null;
          status: Database['public']['Enums']['session_log_status'];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          client_updated_at: string;
          created_at?: string;
          finished_at?: string | null;
          from_health_plan?: boolean;
          id?: string;
          is_deload?: boolean;
          is_free?: boolean;
          is_intro_week?: boolean;
          kind: Database['public']['Enums']['planned_session_kind'];
          last_write_id: string;
          name_de: string;
          notes?: string | null;
          performed_on: string;
          planned_session_id?: string | null;
          revision?: number;
          session_rpe?: number | null;
          source?: Database['public']['Enums']['log_source'];
          started_at?: string | null;
          status: Database['public']['Enums']['session_log_status'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          client_updated_at?: string;
          created_at?: string;
          finished_at?: string | null;
          from_health_plan?: boolean;
          id?: string;
          is_deload?: boolean;
          is_free?: boolean;
          is_intro_week?: boolean;
          kind?: Database['public']['Enums']['planned_session_kind'];
          last_write_id?: string;
          name_de?: string;
          notes?: string | null;
          performed_on?: string;
          planned_session_id?: string | null;
          revision?: number;
          session_rpe?: number | null;
          source?: Database['public']['Enums']['log_source'];
          started_at?: string | null;
          status?: Database['public']['Enums']['session_log_status'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'session_logs_planned_session_id_user_id_fkey';
            columns: ['planned_session_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'planned_sessions';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      set_logs: {
        Row: {
          done: boolean;
          duration_s: number | null;
          exercise_log_id: string;
          reps: number | null;
          rpe: number | null;
          set_no: number;
          user_id: string;
          weight_kg: number | null;
        };
        Insert: {
          done: boolean;
          duration_s?: number | null;
          exercise_log_id: string;
          reps?: number | null;
          rpe?: number | null;
          set_no: number;
          user_id: string;
          weight_kg?: number | null;
        };
        Update: {
          done?: boolean;
          duration_s?: number | null;
          exercise_log_id?: string;
          reps?: number | null;
          rpe?: number | null;
          set_no?: number;
          user_id?: string;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'set_logs_exercise_log_id_user_id_fkey';
            columns: ['exercise_log_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'exercise_logs';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      shopping_list_items: {
        Row: {
          amount: number | null;
          amount_changed: boolean;
          category: string;
          checked: boolean;
          food_id: string | null;
          is_manual: boolean;
          is_pantry: boolean;
          item_key: string;
          label_de: string;
          list_id: string;
          not_in_plan: boolean;
          substitute_for: string[];
          unit: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount?: number | null;
          amount_changed?: boolean;
          category: string;
          checked?: boolean;
          food_id?: string | null;
          is_manual: boolean;
          is_pantry: boolean;
          item_key: string;
          label_de: string;
          list_id: string;
          not_in_plan?: boolean;
          substitute_for?: string[];
          unit?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number | null;
          amount_changed?: boolean;
          category?: string;
          checked?: boolean;
          food_id?: string | null;
          is_manual?: boolean;
          is_pantry?: boolean;
          item_key?: string;
          label_de?: string;
          list_id?: string;
          not_in_plan?: boolean;
          substitute_for?: string[];
          unit?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shopping_list_items_food_id_fkey';
            columns: ['food_id'];
            isOneToOne: false;
            referencedRelation: 'foods';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'shopping_list_items_list_id_user_id_fkey';
            columns: ['list_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'shopping_lists';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      shopping_lists: {
        Row: {
          added_recipes: Json;
          created_at: string;
          from_date: string;
          id: string;
          meal_plan_id: string | null;
          plan_key: string;
          to_date: string;
          updated_at: string;
          user_id: string;
          uses_health_data: boolean;
          week_start: string;
        };
        Insert: {
          added_recipes?: Json;
          created_at?: string;
          from_date: string;
          id?: string;
          meal_plan_id?: string | null;
          plan_key: string;
          to_date: string;
          updated_at?: string;
          user_id?: string;
          uses_health_data: boolean;
          week_start: string;
        };
        Update: {
          added_recipes?: Json;
          created_at?: string;
          from_date?: string;
          id?: string;
          meal_plan_id?: string | null;
          plan_key?: string;
          to_date?: string;
          updated_at?: string;
          user_id?: string;
          uses_health_data?: boolean;
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shopping_lists_meal_plan_id_user_id_fkey';
            columns: ['meal_plan_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'meal_plans';
            referencedColumns: ['id', 'user_id'];
          },
        ];
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
      training_slots: {
        Row: {
          created_at: string;
          kind: Database['public']['Enums']['training_slot_kind'];
          minutes: number;
          slot_no: number;
          updated_at: string;
          user_id: string;
          weekday: number | null;
        };
        Insert: {
          created_at?: string;
          kind: Database['public']['Enums']['training_slot_kind'];
          minutes: number;
          slot_no: number;
          updated_at?: string;
          user_id?: string;
          weekday?: number | null;
        };
        Update: {
          created_at?: string;
          kind?: Database['public']['Enums']['training_slot_kind'];
          minutes?: number;
          slot_no?: number;
          updated_at?: string;
          user_id?: string;
          weekday?: number | null;
        };
        Relationships: [];
      };
      user_equipment: {
        Row: {
          bar_kg: number | null;
          created_at: string;
          equipment_id: string;
          location: Database['public']['Enums']['equipment_location'];
          note: string | null;
          updated_at: string;
          user_id: string;
          weights_kg: number[];
        };
        Insert: {
          bar_kg?: number | null;
          created_at?: string;
          equipment_id: string;
          location: Database['public']['Enums']['equipment_location'];
          note?: string | null;
          updated_at?: string;
          user_id?: string;
          weights_kg?: number[];
        };
        Update: {
          bar_kg?: number | null;
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
          template_id: string | null;
          template_title_de: string | null;
          template_version: number | null;
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
          template_id?: string | null;
          template_title_de?: string | null;
          template_version?: number | null;
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
          template_id?: string | null;
          template_title_de?: string | null;
          template_version?: number | null;
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
      waitlist: {
        Row: {
          confirmed_at: string | null;
          consent_given_at: string;
          consent_text_version: number;
          created_at: string;
          email: string;
          id: string;
          newsletter_confirmed_at: string | null;
          newsletter_consent_text_version: number | null;
          newsletter_opt_in: boolean;
          newsletter_token_expires_at: string | null;
          newsletter_token_hash: string | null;
          source: string;
          token_expires_at: string | null;
          token_hash: string | null;
          unsubscribe_token_hash: string;
        };
        Insert: {
          confirmed_at?: string | null;
          consent_given_at?: string;
          consent_text_version: number;
          created_at?: string;
          email: string;
          id?: string;
          newsletter_confirmed_at?: string | null;
          newsletter_consent_text_version?: number | null;
          newsletter_opt_in?: boolean;
          newsletter_token_expires_at?: string | null;
          newsletter_token_hash?: string | null;
          source?: string;
          token_expires_at?: string | null;
          token_hash?: string | null;
          unsubscribe_token_hash: string;
        };
        Update: {
          confirmed_at?: string | null;
          consent_given_at?: string;
          consent_text_version?: number;
          created_at?: string;
          email?: string;
          id?: string;
          newsletter_confirmed_at?: string | null;
          newsletter_consent_text_version?: number | null;
          newsletter_opt_in?: boolean;
          newsletter_token_expires_at?: string | null;
          newsletter_token_hash?: string | null;
          source?: string;
          token_expires_at?: string | null;
          token_hash?: string | null;
          unsubscribe_token_hash?: string;
        };
        Relationships: [];
      };
      waitlist_attempts: {
        Row: {
          created_at: string;
          id: number;
          key_hash: string;
        };
        Insert: {
          created_at?: string;
          id?: never;
          key_hash: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          key_hash?: string;
        };
        Relationships: [];
      };
      waitlist_stats: {
        Row: {
          confirmations: number;
          day: string;
          signups: number;
          source: string;
        };
        Insert: {
          confirmations?: number;
          day?: string;
          signups?: number;
          source: string;
        };
        Update: {
          confirmations?: number;
          day?: string;
          signups?: number;
          source?: string;
        };
        Relationships: [];
      };
      waitlist_unsubscribe_tokens: {
        Row: {
          created_at: string;
          token_hash: string;
          waitlist_id: string;
        };
        Insert: {
          created_at?: string;
          token_hash: string;
          waitlist_id: string;
        };
        Update: {
          created_at?: string;
          token_hash?: string;
          waitlist_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'waitlist_unsubscribe_tokens_waitlist_id_fkey';
            columns: ['waitlist_id'];
            isOneToOne: false;
            referencedRelation: 'waitlist';
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
      close_missed_sessions: { Args: never; Returns: number };
      current_consent_version: {
        Args: { p_type: Database['public']['Enums']['consent_type'] };
        Returns: number;
      };
      delete_my_account: { Args: never; Returns: undefined };
      delete_session_log: { Args: { p_base_revision: number; p_id: string }; Returns: Json };
      delete_stored_intolerances: { Args: never; Returns: undefined };
      export_my_data: { Args: never; Returns: Json };
      has_valid_consent: {
        Args: { p_type: Database['public']['Enums']['consent_type'] };
        Returns: boolean;
      };
      lead_magnet_confirm: {
        Args: { p_token_hash: string; p_unsubscribe_token_hash: string };
        Returns: Json;
      };
      recent_exercise_logs: { Args: { p_per_exercise?: number }; Returns: Json };
      replace_food_dislikes: { Args: { p_food_ids: Json }; Returns: undefined };
      replace_food_preferences: {
        Args: { p_items: Json; p_scope: string };
        Returns: undefined;
      };
      replace_shopping_list: { Args: { p_list: Json }; Returns: string };
      replace_training_slots: { Args: { p_items: Json }; Returns: undefined };
      replace_user_equipment: {
        Args: {
          p_items: Json;
          p_location: Database['public']['Enums']['equipment_location'];
        };
        Returns: undefined;
      };
      revoke_health_data: { Args: { p_delete_logs: boolean }; Returns: undefined };
      save_meal_plan: {
        Args: { p_auto_adjusted?: boolean; p_plan: Json; p_recipes_changed?: boolean };
        Returns: string;
      };
      save_session_log: { Args: { p_log: Json }; Returns: Json };
      save_training_plan: { Args: { p_plan: Json }; Returns: string };
      seed_content: { Args: { p_content: Json }; Returns: Json };
      seed_nutrition_content: { Args: { p_content: Json }; Returns: Json };
      swap_planned_sessions: {
        Args: { p_a: string; p_a_on: string; p_b: string; p_b_on: string };
        Returns: undefined;
      };
      waitlist_add_unsubscribe_token: {
        Args: { p_token_hash: string; p_waitlist_id: string };
        Returns: undefined;
      };
      waitlist_cleanup: { Args: never; Returns: number };
      waitlist_confirm: { Args: { p_token_hash: string }; Returns: string };
      waitlist_count: {
        Args: { p_confirmations: number; p_signups: number; p_source: string };
        Returns: undefined;
      };
      waitlist_signup: {
        Args: {
          p_consent_text_version: number;
          p_email: string;
          p_email_hash: string;
          p_ip_hash: string;
          p_newsletter_opt_in?: boolean;
          p_source?: string;
          p_token_expires_at: string;
          p_token_hash: string;
          p_unsubscribe_token_hash: string;
        };
        Returns: string;
      };
      waitlist_unsubscribe: { Args: { p_unsubscribe_token_hash: string }; Returns: boolean };
    };
    Enums: {
      activity_level: 'sedentary' | 'light' | 'active' | 'very_active';
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
      endurance_modality: 'run' | 'walk' | 'bike' | 'swim';
      equipment_category:
        'free_weights' | 'bench' | 'bodyweight' | 'bands' | 'cardio' | 'other' | 'machines';
      equipment_location: 'home' | 'gym';
      exercise_log_status: 'done' | 'skipped' | 'alternative';
      exercise_mechanics: 'compound' | 'isolation';
      experience_level: 'beginner' | 'advanced' | 'competitive';
      food_preference_kind: 'like' | 'dislike' | 'intolerance';
      goal_type: 'fat_loss' | 'definition' | 'muscle_gain' | 'general_fitness' | 'endurance';
      load_type: 'weight' | 'bodyweight' | 'band' | 'time';
      log_source: 'manual';
      mealprep_slot_mode: 'lunch' | 'lunch_dinner';
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
        | 'location_mismatch'
        | 'endurance_days_capped'
        | 'endurance_volume_ramped'
        | 'endurance_walk'
        | 'rest_day_added'
        | 'week_total_capped'
        | 'endurance_basic_only';
      plan_status: 'active' | 'replaced';
      planned_session_kind: 'strength' | 'endurance';
      planned_session_status: 'planned' | 'skipped' | 'completed';
      session_focus: 'full_body' | 'upper' | 'lower';
      session_log_status: 'completed' | 'partial';
      sex: 'male' | 'female' | 'diverse' | 'unspecified';
      training_location: 'gym' | 'home' | 'both';
      training_slot_kind: 'strength_gym' | 'strength_home' | 'endurance';
      training_time: 'early' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'varies';
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
      activity_level: ['sedentary', 'light', 'active', 'very_active'],
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
      endurance_modality: ['run', 'walk', 'bike', 'swim'],
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
      exercise_log_status: ['done', 'skipped', 'alternative'],
      exercise_mechanics: ['compound', 'isolation'],
      experience_level: ['beginner', 'advanced', 'competitive'],
      food_preference_kind: ['like', 'dislike', 'intolerance'],
      goal_type: ['fat_loss', 'definition', 'muscle_gain', 'general_fitness', 'endurance'],
      load_type: ['weight', 'bodyweight', 'band', 'time'],
      log_source: ['manual'],
      mealprep_slot_mode: ['lunch', 'lunch_dinner'],
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
        'endurance_days_capped',
        'endurance_volume_ramped',
        'endurance_walk',
        'rest_day_added',
        'week_total_capped',
        'endurance_basic_only',
      ],
      plan_status: ['active', 'replaced'],
      planned_session_kind: ['strength', 'endurance'],
      planned_session_status: ['planned', 'skipped', 'completed'],
      session_focus: ['full_body', 'upper', 'lower'],
      session_log_status: ['completed', 'partial'],
      sex: ['male', 'female', 'diverse', 'unspecified'],
      training_location: ['gym', 'home', 'both'],
      training_slot_kind: ['strength_gym', 'strength_home', 'endurance'],
      training_time: ['early', 'morning', 'midday', 'afternoon', 'evening', 'varies'],
    },
  },
} as const;
