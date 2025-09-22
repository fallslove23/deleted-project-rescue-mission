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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          content: string
          course_id: string | null
          created_at: string | null
          id: string
          log_date: string
          trainee_id: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          course_id?: string | null
          created_at?: string | null
          id?: string
          log_date: string
          trainee_id?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          course_id?: string | null
          created_at?: string | null
          id?: string
          log_date?: string
          trainee_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
        ]
      }
      anon_sessions: {
        Row: {
          anon_id: string
          created_at: string
          id: string
          last_seen_at: string | null
          user_agent_hash: string | null
        }
        Insert: {
          anon_id?: string
          created_at?: string
          id?: string
          last_seen_at?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          anon_id?: string
          created_at?: string
          id?: string
          last_seen_at?: string | null
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          attendance_date: string
          course_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          status: string | null
          trainee_id: string | null
        }
        Insert: {
          attendance_date: string
          course_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          trainee_id?: string | null
        }
        Update: {
          attendance_date?: string
          course_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          trainee_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      course_enrollments: {
        Row: {
          course_id: string | null
          created_at: string | null
          enrollment_date: string | null
          id: string
          status: string | null
          trainee_id: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          enrollment_date?: string | null
          id?: string
          status?: string | null
          trainee_id?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          enrollment_date?: string | null
          id?: string
          status?: string | null
          trainee_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_trainee_id_fkey"
            columns: ["trainee_id"]
            isOneToOne: false
            referencedRelation: "trainees"
            referencedColumns: ["id"]
          },
        ]
      }
      course_name_to_session_map: {
        Row: {
          legacy_course_name: string
          session_id: string | null
        }
        Insert: {
          legacy_course_name: string
          session_id?: string | null
        }
        Update: {
          legacy_course_name?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_name_to_session_map_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "survey_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      course_names: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      course_reports: {
        Row: {
          avg_course_satisfaction: number | null
          avg_instructor_satisfaction: number | null
          course_id: string | null
          course_title: string
          created_at: string
          created_by: string | null
          education_round: number
          education_year: number
          id: string
          report_data: Json | null
          total_responses: number | null
          total_surveys: number | null
          updated_at: string
        }
        Insert: {
          avg_course_satisfaction?: number | null
          avg_instructor_satisfaction?: number | null
          course_id?: string | null
          course_title: string
          created_at?: string
          created_by?: string | null
          education_round: number
          education_year: number
          id?: string
          report_data?: Json | null
          total_responses?: number | null
          total_surveys?: number | null
          updated_at?: string
        }
        Update: {
          avg_course_satisfaction?: number | null
          avg_instructor_satisfaction?: number | null
          course_id?: string | null
          course_title?: string
          created_at?: string
          created_by?: string | null
          education_round?: number
          education_year?: number
          id?: string
          report_data?: Json | null
          total_responses?: number | null
          total_surveys?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_reports_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_statistics: {
        Row: {
          course_days: number
          course_end_date: string
          course_name: string | null
          course_satisfaction: number | null
          course_start_date: string
          created_at: string
          created_by: string | null
          cumulative_count: number
          education_days: number | null
          education_hours: number | null
          enrolled_count: number
          id: string
          instructor_satisfaction: number | null
          operation_satisfaction: number | null
          round: number
          status: string
          total_satisfaction: number | null
          updated_at: string
          year: number
        }
        Insert: {
          course_days: number
          course_end_date: string
          course_name?: string | null
          course_satisfaction?: number | null
          course_start_date: string
          created_at?: string
          created_by?: string | null
          cumulative_count?: number
          education_days?: number | null
          education_hours?: number | null
          enrolled_count?: number
          id?: string
          instructor_satisfaction?: number | null
          operation_satisfaction?: number | null
          round: number
          status?: string
          total_satisfaction?: number | null
          updated_at?: string
          year: number
        }
        Update: {
          course_days?: number
          course_end_date?: string
          course_name?: string | null
          course_satisfaction?: number | null
          course_start_date?: string
          created_at?: string
          created_by?: string | null
          cumulative_count?: number
          education_days?: number | null
          education_hours?: number | null
          enrolled_count?: number
          id?: string
          instructor_satisfaction?: number | null
          operation_satisfaction?: number | null
          round?: number
          status?: string
          total_satisfaction?: number | null
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      courses: {
        Row: {
          created_at: string
          description: string | null
          id: string
          program_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          program_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          program_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string
          error: string | null
          failed_count: number
          id: string
          recipients: string[]
          results: Json | null
          sent_count: number
          status: string
          survey_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          failed_count?: number
          id?: string
          recipients?: string[]
          results?: Json | null
          sent_count?: number
          status: string
          survey_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          failed_count?: number
          id?: string
          recipients?: string[]
          results?: Json | null
          sent_count?: number
          status?: string
          survey_id?: string | null
        }
        Relationships: []
      }
      email_recipient_presets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          preset_name: string
          recipients: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          preset_name: string
          recipients?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          preset_name?: string
          recipients?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      instructor_courses: {
        Row: {
          course_id: string
          created_at: string
          id: string
          instructor_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          instructor_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          instructor_id?: string
        }
        Relationships: []
      }
      instructors: {
        Row: {
          active: boolean | null
          bio: string | null
          created_at: string
          department: string | null
          email: string | null
          expertise: string[] | null
          id: string
          name: string
          phone: string | null
          photo_url: string | null
          position: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          bio?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          expertise?: string[] | null
          id?: string
          name: string
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          bio?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          expertise?: string[] | null
          id?: string
          name?: string
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          first_login: boolean | null
          id: string
          instructor_id: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_login?: boolean | null
          id: string
          instructor_id?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_login?: boolean | null
          id?: string
          instructor_id?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      program_sessions: {
        Row: {
          is_active: boolean
          program_id: string
          session_id: string
          sort_order: number
        }
        Insert: {
          is_active?: boolean
          program_id: string
          session_id: string
          sort_order?: number
        }
        Update: {
          is_active?: boolean
          program_id?: string
          session_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_sessions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "survey_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_answers: {
        Row: {
          answer_text: string | null
          answer_value: Json | null
          created_at: string
          id: string
          question_id: string
          response_id: string
        }
        Insert: {
          answer_text?: string | null
          answer_value?: Json | null
          created_at?: string
          id?: string
          question_id: string
          response_id: string
        }
        Update: {
          answer_text?: string | null
          answer_value?: Json | null
          created_at?: string
          id?: string
          question_id?: string
          response_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "analytics_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      short_urls: {
        Row: {
          click_count: number
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          original_url: string
          short_code: string
          survey_id: string | null
        }
        Insert: {
          click_count?: number
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          original_url: string
          short_code: string
          survey_id?: string | null
        }
        Update: {
          click_count?: number
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          original_url?: string
          short_code?: string
          survey_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "short_urls_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "active_surveys_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "short_urls_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "analytics_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "short_urls_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "mv_survey_stats"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "short_urls_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "survey_aggregates"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "short_urls_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "survey_cumulative_stats"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "short_urls_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "short_urls_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys_list_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "short_urls_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys_list_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_analysis_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          survey_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          survey_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          survey_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_analysis_comments_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "active_surveys_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_analysis_comments_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "analytics_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_analysis_comments_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "mv_survey_stats"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "survey_analysis_comments_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "survey_aggregates"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "survey_analysis_comments_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "survey_cumulative_stats"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "survey_analysis_comments_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_analysis_comments_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys_list_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_analysis_comments_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys_list_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_completions: {
        Row: {
          anon_id: string
          completed_at: string
          id: string
          ip_address: unknown | null
          survey_id: string
        }
        Insert: {
          anon_id: string
          completed_at?: string
          id?: string
          ip_address?: unknown | null
          survey_id: string
        }
        Update: {
          anon_id?: string
          completed_at?: string
          id?: string
          ip_address?: unknown | null
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_survey_completions_anon_id"
            columns: ["anon_id"]
            isOneToOne: false
            referencedRelation: "anon_sessions"
            referencedColumns: ["anon_id"]
          },
          {
            foreignKeyName: "fk_survey_completions_survey_id"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "active_surveys_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_survey_completions_survey_id"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "analytics_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_survey_completions_survey_id"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "mv_survey_stats"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "fk_survey_completions_survey_id"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "survey_aggregates"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "fk_survey_completions_survey_id"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "survey_cumulative_stats"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "fk_survey_completions_survey_id"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_survey_completions_survey_id"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys_list_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_survey_completions_survey_id"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys_list_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_instructors: {
        Row: {
          created_at: string
          id: string
          instructor_id: string
          survey_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instructor_id: string
          survey_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instructor_id?: string
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_instructors_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_instructors_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "active_surveys_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_instructors_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "analytics_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_instructors_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "mv_survey_stats"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "survey_instructors_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "survey_aggregates"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "survey_instructors_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "survey_cumulative_stats"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "survey_instructors_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_instructors_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys_list_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_instructors_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys_list_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_questions: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          options: Json | null
          order_index: number
          question_text: string
          question_type: string
          satisfaction_type: string | null
          scope: string | null
          section_id: string | null
          session_id: string | null
          survey_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          options?: Json | null
          order_index?: number
          question_text: string
          question_type?: string
          satisfaction_type?: string | null
          scope?: string | null
          section_id?: string | null
          session_id?: string | null
          survey_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          options?: Json | null
          order_index?: number
          question_text?: string
          question_type?: string
          satisfaction_type?: string | null
          scope?: string | null
          section_id?: string | null
          session_id?: string | null
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "survey_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "survey_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "active_surveys_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "analytics_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "mv_survey_stats"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "survey_aggregates"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "survey_cumulative_stats"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys_list_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys_list_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          attended: boolean | null
          id: string
          is_test: boolean | null
          respondent_email: string | null
          session_id: string | null
          submitted_at: string
          survey_id: string
        }
        Insert: {
          attended?: boolean | null
          id?: string
          is_test?: boolean | null
          respondent_email?: string | null
          session_id?: string | null
          submitted_at?: string
          survey_id: string
        }
        Update: {
          attended?: boolean | null
          id?: string
          is_test?: boolean | null
          respondent_email?: string | null
          session_id?: string | null
          submitted_at?: string
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "survey_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "active_surveys_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "analytics_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "mv_survey_stats"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "survey_aggregates"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "survey_cumulative_stats"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys_list_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys_list_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_sections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number
          survey_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_index?: number
          survey_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          survey_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_sections_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "active_surveys_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_sections_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "analytics_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_sections_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "mv_survey_stats"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "survey_sections_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "survey_aggregates"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "survey_sections_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "survey_cumulative_stats"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "survey_sections_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_sections_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys_list_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_sections_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys_list_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_sessions: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          instructor_id: string | null
          session_name: string | null
          session_order: number
          survey_id: string
          updated_at: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          instructor_id?: string | null
          session_name?: string | null
          session_order?: number
          survey_id: string
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          instructor_id?: string | null
          session_name?: string | null
          session_order?: number
          survey_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_sessions_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_sessions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "active_surveys_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_sessions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "analytics_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_sessions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "mv_survey_stats"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "survey_sessions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "survey_aggregates"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "survey_sessions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "survey_cumulative_stats"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "survey_sessions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_sessions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys_list_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_sessions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys_list_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_course_evaluation: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_course_evaluation?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_course_evaluation?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      survey_tokens: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          survey_id: string
          used_at: string | null
          used_by_anon_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          survey_id: string
          used_at?: string | null
          used_by_anon_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          survey_id?: string
          used_at?: string | null
          used_by_anon_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_survey_tokens_anon_id"
            columns: ["used_by_anon_id"]
            isOneToOne: false
            referencedRelation: "anon_sessions"
            referencedColumns: ["anon_id"]
          },
          {
            foreignKeyName: "fk_survey_tokens_survey_id"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "active_surveys_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_survey_tokens_survey_id"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "analytics_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_survey_tokens_survey_id"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "mv_survey_stats"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "fk_survey_tokens_survey_id"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "survey_aggregates"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "fk_survey_tokens_survey_id"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "survey_cumulative_stats"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "fk_survey_tokens_survey_id"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_survey_tokens_survey_id"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys_list_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_survey_tokens_survey_id"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys_list_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          combined_round_end: number | null
          combined_round_start: number | null
          course_id: string | null
          course_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          education_day: number | null
          education_round: number | null
          education_year: number | null
          end_date: string | null
          expected_participants: number | null
          group_number: number | null
          group_type: string | null
          id: string
          instructor_id: string | null
          is_combined: boolean | null
          is_final_survey: boolean
          is_grouped: boolean
          is_test: boolean | null
          operator_contact: string | null
          operator_name: string | null
          program_id: string | null
          round_label: string | null
          session_id: string | null
          start_date: string | null
          status: string
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          combined_round_end?: number | null
          combined_round_start?: number | null
          course_id?: string | null
          course_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          education_day?: number | null
          education_round?: number | null
          education_year?: number | null
          end_date?: string | null
          expected_participants?: number | null
          group_number?: number | null
          group_type?: string | null
          id?: string
          instructor_id?: string | null
          is_combined?: boolean | null
          is_final_survey?: boolean
          is_grouped?: boolean
          is_test?: boolean | null
          operator_contact?: string | null
          operator_name?: string | null
          program_id?: string | null
          round_label?: string | null
          session_id?: string | null
          start_date?: string | null
          status?: string
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          combined_round_end?: number | null
          combined_round_start?: number | null
          course_id?: string | null
          course_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          education_day?: number | null
          education_round?: number | null
          education_year?: number | null
          end_date?: string | null
          expected_participants?: number | null
          group_number?: number | null
          group_type?: string | null
          id?: string
          instructor_id?: string | null
          is_combined?: boolean | null
          is_final_survey?: boolean
          is_grouped?: boolean
          is_test?: boolean | null
          operator_contact?: string | null
          operator_name?: string | null
          program_id?: string | null
          round_label?: string | null
          session_id?: string | null
          start_date?: string | null
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "surveys_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "survey_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_questions: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          options: Json | null
          order_index: number
          question_text: string
          question_type: string
          satisfaction_type: string | null
          section_id: string | null
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          options?: Json | null
          order_index?: number
          question_text: string
          question_type?: string
          satisfaction_type?: string | null
          section_id?: string | null
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          options?: Json | null
          order_index?: number
          question_text?: string
          question_type?: string
          satisfaction_type?: string | null
          section_id?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_questions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_sections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number
          template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_index?: number
          template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      trainees: {
        Row: {
          company_id: string
          created_at: string | null
          department: string | null
          email: string | null
          hq: string | null
          id: string
          name: string
          phone: string | null
          position: string | null
          remark: string | null
          resign: boolean | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          department?: string | null
          email?: string | null
          hq?: string | null
          id?: string
          name: string
          phone?: string | null
          position?: string | null
          remark?: string | null
          resign?: boolean | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          department?: string | null
          email?: string | null
          hq?: string | null
          id?: string
          name?: string
          phone?: string | null
          position?: string | null
          remark?: string | null
          resign?: boolean | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_filter_presets: {
        Row: {
          created_at: string
          filter_data: Json
          filter_type: string
          id: string
          is_default: boolean
          preset_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filter_data?: Json
          filter_type: string
          id?: string
          is_default?: boolean
          preset_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filter_data?: Json
          filter_type?: string
          id?: string
          is_default?: boolean
          preset_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      active_surveys_v: {
        Row: {
          course_id: string | null
          course_name: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          education_day: number | null
          education_round: number | null
          education_year: number | null
          end_date: string | null
          expected_participants: number | null
          id: string | null
          instructor_id: string | null
          start_date: string | null
          status: string | null
          template_id: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          course_id?: string | null
          course_name?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          education_day?: number | null
          education_round?: number | null
          education_year?: number | null
          end_date?: string | null
          expected_participants?: number | null
          id?: string | null
          instructor_id?: string | null
          start_date?: string | null
          status?: string | null
          template_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          course_id?: string | null
          course_name?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          education_day?: number | null
          education_round?: number | null
          education_year?: number | null
          end_date?: string | null
          expected_participants?: number | null
          id?: string | null
          instructor_id?: string | null
          start_date?: string | null
          status?: string | null
          template_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surveys_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_question_answers: {
        Row: {
          answer_text: string | null
          answer_value: Json | null
          created_at: string | null
          id: string | null
          question_id: string | null
          response_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "analytics_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_responses: {
        Row: {
          attended: boolean | null
          id: string | null
          is_test: boolean | null
          respondent_email: string | null
          session_id: string | null
          submitted_at: string | null
          survey_id: string | null
        }
        Insert: {
          attended?: boolean | null
          id?: string | null
          is_test?: boolean | null
          respondent_email?: string | null
          session_id?: string | null
          submitted_at?: string | null
          survey_id?: string | null
        }
        Update: {
          attended?: boolean | null
          id?: string | null
          is_test?: boolean | null
          respondent_email?: string | null
          session_id?: string | null
          submitted_at?: string | null
          survey_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "survey_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "active_surveys_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "analytics_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "mv_survey_stats"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "survey_aggregates"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "survey_cumulative_stats"
            referencedColumns: ["survey_id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys_list_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys_list_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_surveys: {
        Row: {
          combined_round_end: number | null
          combined_round_start: number | null
          course_id: string | null
          course_name: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          education_day: number | null
          education_round: number | null
          education_year: number | null
          end_date: string | null
          expected_participants: number | null
          id: string | null
          instructor_id: string | null
          is_combined: boolean | null
          is_test: boolean | null
          round_label: string | null
          start_date: string | null
          status: string | null
          template_id: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          combined_round_end?: number | null
          combined_round_start?: number | null
          course_id?: string | null
          course_name?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          education_day?: number | null
          education_round?: number | null
          education_year?: number | null
          end_date?: string | null
          expected_participants?: number | null
          id?: string | null
          instructor_id?: string | null
          is_combined?: boolean | null
          is_test?: boolean | null
          round_label?: string | null
          start_date?: string | null
          status?: string | null
          template_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          combined_round_end?: number | null
          combined_round_start?: number | null
          course_id?: string | null
          course_name?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          education_day?: number | null
          education_round?: number | null
          education_year?: number | null
          end_date?: string | null
          expected_participants?: number | null
          id?: string | null
          instructor_id?: string | null
          is_combined?: boolean | null
          is_test?: boolean | null
          round_label?: string | null
          start_date?: string | null
          status?: string | null
          template_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surveys_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_survey_stats: {
        Row: {
          active_survey_count: number | null
          all_test_data: boolean | null
          avg_course_satisfaction: number | null
          avg_instructor_satisfaction: number | null
          avg_operation_satisfaction: number | null
          avg_overall_satisfaction: number | null
          course_name: string | null
          education_round: number | null
          education_year: number | null
          has_test_data: boolean | null
          instructor_id: string | null
          instructor_name: string | null
          last_response_at: string | null
          question_stats: Json | null
          rating_distribution: Json | null
          response_count: number | null
          survey_count: number | null
          survey_ids: string[] | null
          test_active_survey_count: number | null
          test_avg_course_satisfaction: number | null
          test_avg_instructor_satisfaction: number | null
          test_avg_operation_satisfaction: number | null
          test_avg_overall_satisfaction: number | null
          test_question_stats: Json | null
          test_rating_distribution: Json | null
          test_response_count: number | null
          test_survey_count: number | null
          test_text_response_count: number | null
          test_text_responses: Json | null
          text_response_count: number | null
          text_responses: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "surveys_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_course_satisfaction: {
        Row: {
          avg_course_satisfaction: number | null
          course_id: string | null
          education_round: number | null
          education_year: number | null
          survey_count: number | null
          total_responses: number | null
        }
        Relationships: [
          {
            foreignKeyName: "surveys_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_instructor_satisfaction: {
        Row: {
          avg_instructor_satisfaction: number | null
          education_round: number | null
          education_year: number | null
          instructor_id: string | null
          survey_count: number | null
          total_responses: number | null
        }
        Relationships: [
          {
            foreignKeyName: "surveys_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_recent_activity: {
        Row: {
          activity_date: string | null
          activity_type: string | null
          description: string | null
          record_id: string | null
          user_id: string | null
        }
        Relationships: []
      }
      mv_survey_stats: {
        Row: {
          education_round: number | null
          education_year: number | null
          end_date: string | null
          expected_participants: number | null
          instructor_id: string | null
          response_count: number | null
          response_rate: number | null
          start_date: string | null
          status: string | null
          survey_id: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surveys_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      program_sessions_v1: {
        Row: {
          is_active: boolean | null
          program_id: string | null
          program_title: string | null
          session_id: string | null
          session_title: string | null
          sort_order: number | null
        }
        Relationships: [
          {
            foreignKeyName: "program_sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_sessions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "survey_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_aggregates: {
        Row: {
          avg_course_satisfaction: number | null
          avg_instructor_satisfaction: number | null
          avg_operation_satisfaction: number | null
          avg_overall_satisfaction: number | null
          course_name: string | null
          education_round: number | null
          education_year: number | null
          expected_participants: number | null
          instructor_id: string | null
          instructor_name: string | null
          is_test: boolean | null
          last_response_at: string | null
          question_count: number | null
          response_count: number | null
          status: string | null
          survey_id: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surveys_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_available_years_v1: {
        Row: {
          education_year: number | null
        }
        Relationships: []
      }
      survey_cumulative_stats: {
        Row: {
          avg_course_satisfaction_real: number | null
          avg_course_satisfaction_test: number | null
          avg_course_satisfaction_total: number | null
          avg_instructor_satisfaction_real: number | null
          avg_instructor_satisfaction_test: number | null
          avg_instructor_satisfaction_total: number | null
          avg_operation_satisfaction_real: number | null
          avg_operation_satisfaction_test: number | null
          avg_operation_satisfaction_total: number | null
          avg_satisfaction_real: number | null
          avg_satisfaction_test: number | null
          avg_satisfaction_total: number | null
          course_name: string | null
          created_at: string | null
          education_round: number | null
          education_year: number | null
          expected_participants: number | null
          instructor_count: number | null
          instructor_names: string[] | null
          instructor_names_text: string | null
          last_response_at: string | null
          real_response_count: number | null
          status: string | null
          survey_id: string | null
          survey_is_test: boolean | null
          test_response_count: number | null
          title: string | null
          total_response_count: number | null
          weighted_satisfaction_real: number | null
          weighted_satisfaction_test: number | null
          weighted_satisfaction_total: number | null
        }
        Relationships: []
      }
      surveys_list_v1: {
        Row: {
          combined_round_end: number | null
          combined_round_start: number | null
          course_id: string | null
          course_name: string | null
          course_title: string | null
          created_at: string | null
          created_by: string | null
          creator_email: string | null
          description: string | null
          education_day: number | null
          education_round: number | null
          education_year: number | null
          end_date: string | null
          expected_participants: number | null
          id: string | null
          instructor_id: string | null
          instructor_name: string | null
          is_combined: boolean | null
          is_test: boolean | null
          round_label: string | null
          start_date: string | null
          status: string | null
          template_id: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surveys_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys_list_v2: {
        Row: {
          combined_round_end: number | null
          combined_round_start: number | null
          course_id: string | null
          course_name: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          education_day: number | null
          education_round: number | null
          education_year: number | null
          end_date: string | null
          expected_participants: number | null
          id: string | null
          instructor_id: string | null
          is_combined: boolean | null
          is_test: boolean | null
          program_id: string | null
          program_title: string | null
          round_label: string | null
          session_id: string | null
          session_title: string | null
          start_date: string | null
          status: string | null
          template_id: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surveys_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "survey_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_link_profile_to_instructor: {
        Args: { instructor_id_param: string; target_profile_id: string }
        Returns: undefined
      }
      admin_set_user_roles: {
        Args: {
          roles: Database["public"]["Enums"]["user_role"][]
          target_user_id: string
        }
        Returns: undefined
      }
      admin_set_user_roles_safe: {
        Args: {
          roles: Database["public"]["Enums"]["user_role"][]
          target_user_id: string
        }
        Returns: undefined
      }
      check_role_change_allowed: {
        Args: { new_role: string; old_role: string; user_id: string }
        Returns: boolean
      }
      course_report_statistics: {
        Args: {
          p_course_name?: string
          p_include_test?: boolean
          p_instructor_id?: string
          p_round?: number
          p_year: number
        }
        Returns: {
          available_courses: Json
          available_instructors: Json
          instructor_stats: Json
          summary: Json
          textual_responses: Json
          trend: Json
        }[]
      }
      create_admin_user: {
        Args: { admin_email: string; admin_password: string }
        Returns: undefined
      }
      create_instructor_account: {
        Args: {
          instructor_email: string
          instructor_id_param: string
          instructor_password: string
        }
        Returns: string
      }
      generate_short_code: {
        Args: { length?: number }
        Returns: string
      }
      generate_survey_code: {
        Args: { length?: number }
        Returns: string
      }
      get_all_profiles_for_admin: {
        Args: { requesting_user_id: string }
        Returns: {
          created_at: string
          email: string
          first_login: boolean
          id: string
          instructor_id: string
          role: string
          updated_at: string
        }[]
      }
      get_course_reports_working: {
        Args: {
          p_course_name?: string
          p_include_test?: boolean
          p_instructor_id?: string
          p_round?: number
          p_year: number
        }
        Returns: Json
      }
      get_course_statistics: {
        Args: {
          p_course_name?: string
          p_include_test?: boolean
          p_instructor_id?: string
          p_round?: number
          p_year: number
        }
        Returns: {
          available_courses: Json
          available_instructors: Json
          instructor_stats: Json
          summary: Json
          textual_responses: Json
          trend: Json
        }[]
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_email_logs: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          error: string
          failed_count: number
          id: string
          recipients: string[]
          results: Json
          sent_count: number
          status: string
          survey_id: string
        }[]
      }
      get_instructor_stats_optimized: {
        Args: { education_year_param?: number; instructor_id_param?: string }
        Returns: {
          avg_satisfaction: number
          education_round: number
          education_year: number
          instructor_id: string
          survey_count: number
          total_responses: number
        }[]
      }
      get_rls_policies: {
        Args: Record<PropertyKey, never>
        Returns: {
          command: string
          is_enabled: boolean
          policy_name: string
          roles: string
          table_name: string
          using_expression: string
          with_check: string
        }[]
      }
      get_session_statistics: {
        Args: { session_id_param?: string; survey_id_param?: string }
        Returns: {
          attended_responses: number
          avg_satisfaction: number
          course_title: string
          instructor_name: string
          response_rate: number
          session_id: string
          session_name: string
          total_responses: number
        }[]
      }
      get_survey_analysis: {
        Args: { survey_id_param: string }
        Returns: {
          feedback_text: Json
          response_count: number
          satisfaction_scores: Json
          survey_info: Json
        }[]
      }
      get_survey_cumulative_summary: {
        Args:
          | Record<PropertyKey, never>
          | {
              course_name?: string
              education_year?: number
              include_test_data?: boolean
              search_term?: string
            }
        Returns: {
          average_satisfaction: number
          courses_in_progress: number
          participating_instructors: number
          total_responses: number
          total_surveys: number
        }[]
      }
      get_survey_detail_stats: {
        Args: {
          p_distribution_cursor?: number
          p_distribution_limit?: number
          p_include_test?: boolean
          p_response_cursor?: number
          p_response_limit?: number
          p_survey_id: string
          p_text_cursor?: number
          p_text_limit?: number
        }
        Returns: {
          distribution_next_cursor: number
          distribution_total_count: number
          question_distributions: Json
          response_next_cursor: number
          response_total_count: number
          responses: Json
          summary: Json
          text_answers: Json
          text_next_cursor: number
          text_total_count: number
        }[]
      }
      get_survey_responses_by_date_range: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          respondent_email: string
          response_id: string
          submitted_at: string
          survey_id: string
        }[]
      }
      get_user_profile: {
        Args: { user_id: string }
        Returns: {
          created_at: string
          email: string
          first_login: boolean
          id: string
          instructor_id: string
          role: string
          updated_at: string
        }[]
      }
      get_user_roles: {
        Args: { target_user_id?: string }
        Returns: {
          role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      has_role: {
        Args: { check_role: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_director: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_instructor: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_operator: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_user_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      refresh_dashboard_materialized_views: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      safe_numeric_convert: {
        Args: { input_text: string }
        Returns: number
      }
      save_answers_bulk: {
        Args: { p_answers: Json }
        Returns: undefined
      }
      update_course_statistics: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_survey_statuses: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      user_role: "instructor" | "operator" | "admin" | "director"
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
      user_role: ["instructor", "operator", "admin", "director"],
    },
  },
} as const
