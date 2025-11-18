-- Phase 2: Security Improvements

-- 1. Enable RLS on tables that don't have it enabled
ALTER TABLE public.backup_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_instructor_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_course_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_canonical_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_instructors ENABLE ROW LEVEL SECURITY;

-- 2. Add RLS policies for the newly secured tables

-- Backup tables: Admin only access
CREATE POLICY "rls_backup_courses_admin" ON public.backup_courses FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "rls_backup_instructor_courses_admin" ON public.backup_instructor_courses FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "rls_backup_lectures_admin" ON public.backup_lectures FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Instructor lectures: View all, manage with admin
CREATE POLICY "rls_instructor_lectures_view" ON public.instructor_lectures FOR SELECT USING (true);
CREATE POLICY "rls_instructor_lectures_admin" ON public.instructor_lectures FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Lectures: View all, manage with admin
CREATE POLICY "rls_lectures_view" ON public.lectures FOR SELECT USING (true);
CREATE POLICY "rls_lectures_admin" ON public.lectures FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Session course map: View all, manage with admin
CREATE POLICY "rls_session_course_map_view" ON public.session_course_map FOR SELECT USING (true);
CREATE POLICY "rls_session_course_map_admin" ON public.session_course_map FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Session subjects: View all, manage with admin  
CREATE POLICY "rls_session_subjects_view" ON public.session_subjects FOR SELECT USING (true);
CREATE POLICY "rls_session_subjects_admin" ON public.session_subjects FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Sessions: View all, manage with admin
CREATE POLICY "rls_sessions_view" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "rls_sessions_admin" ON public.sessions FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Subject canonical map: View all, manage with admin
CREATE POLICY "rls_subject_canonical_map_view" ON public.subject_canonical_map FOR SELECT USING (true);
CREATE POLICY "rls_subject_canonical_map_admin" ON public.subject_canonical_map FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Survey instructors: View all, manage with admin
CREATE POLICY "rls_survey_instructors_view" ON public.survey_instructors FOR SELECT USING (true);
CREATE POLICY "rls_survey_instructors_admin" ON public.survey_instructors FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 3. Fix search_path for functions that are missing it
-- Update existing functions to set proper search_path

CREATE OR REPLACE FUNCTION public.canonicalize_course_name(name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF name IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN lower(btrim(regexp_replace(name, '\s+', ' ', 'g')));
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_session_from_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session uuid;
BEGIN
  SELECT m.session_id INTO v_session
  FROM public.course_name_to_session_map m
  WHERE public.canonicalize_course_name(m.legacy_course_name) = public.canonicalize_course_name(NEW.course_name)
  LIMIT 1;

  IF v_session IS NOT NULL AND EXISTS (SELECT 1 FROM public.sessions WHERE id = v_session) THEN
    IF NEW.session_id IS NULL OR NEW.session_id IS DISTINCT FROM v_session THEN
      NEW.session_id = v_session;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_session_id_dual_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.course_id IS NOT NULL AND (OLD.course_id IS DISTINCT FROM NEW.course_id) THEN
    NEW.session_id := NEW.course_id::uuid;
  END IF;

  IF NEW.session_id IS NOT NULL AND (OLD.session_id IS DISTINCT FROM NEW.session_id) THEN
    NEW.course_id := NEW.session_id::text;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_sync_session_subject()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.session_id IS NOT NULL AND NEW.subject_id IS NOT NULL THEN
    INSERT INTO public.session_subjects(session_id, subject_id)
    VALUES (NEW.session_id, NEW.subject_id)
    ON CONFLICT (session_id, subject_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.map_session_to_course(p_survey_id uuid, p_course_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.session_course_map (survey_id, course_id)
  VALUES (p_survey_id, p_course_id)
  ON CONFLICT (survey_id) DO UPDATE
    SET course_id = EXCLUDED.course_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_survey_responses_by_date_range(
  start_date date DEFAULT NULL::date, 
  end_date date DEFAULT NULL::date
)
RETURNS TABLE(
  response_id uuid, 
  survey_id uuid, 
  submitted_at timestamp with time zone, 
  respondent_email text
)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sr.id,
    sr.survey_id,
    sr.submitted_at,
    sr.respondent_email
  FROM public.survey_responses sr
  WHERE 
    CASE 
      WHEN start_date IS NOT NULL AND end_date IS NOT NULL THEN
        sr.submitted_at >= start_date::timestamp AND sr.submitted_at <= end_date::timestamp
      WHEN start_date IS NOT NULL THEN
        sr.submitted_at >= start_date::timestamp
      WHEN end_date IS NOT NULL THEN
        sr.submitted_at <= end_date::timestamp
      ELSE TRUE
    END
  ORDER BY sr.submitted_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_set_survey_session_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.education_year IS NOT NULL 
     AND NEW.education_round IS NOT NULL 
     AND NEW.course_name IS NOT NULL THEN
    
    SELECT psv.session_id INTO NEW.session_id
    FROM program_sessions_v1 psv
    WHERE psv.year = NEW.education_year
      AND psv.turn = NEW.education_round
      AND psv.program = NEW.course_name
    LIMIT 1;
    
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_create_session_for_survey()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_program_id UUID;
  v_session_id UUID;
  v_session_title TEXT;
BEGIN
  SELECT id INTO v_program_id
  FROM programs
  WHERE name = NEW.course_name
  LIMIT 1;

  IF v_program_id IS NULL AND NEW.course_name IS NOT NULL THEN
    INSERT INTO programs (name, description)
    VALUES (NEW.course_name, '자동 생성된 프로그램')
    RETURNING id INTO v_program_id;
  END IF;

  IF v_program_id IS NOT NULL AND NEW.education_year IS NOT NULL AND NEW.education_round IS NOT NULL THEN
    SELECT id INTO v_session_id
    FROM sessions
    WHERE program_id = v_program_id
      AND year = NEW.education_year
      AND turn = NEW.education_round
    LIMIT 1;

    IF v_session_id IS NULL THEN
      v_session_title := NEW.education_year || '년 ' || NEW.education_round || '차 ' || NEW.course_name;
      
      INSERT INTO sessions (program_id, year, turn, title)
      VALUES (v_program_id, NEW.education_year, NEW.education_round, v_session_title)
      RETURNING id INTO v_session_id;
    END IF;

    IF TG_OP = 'INSERT' AND NEW.session_id IS NULL THEN
      NEW.session_id := v_session_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_survey_instructor_map()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.instructor_id IS NOT NULL AND OLD.instructor_id IS DISTINCT FROM NEW.instructor_id THEN
    DELETE FROM public.survey_instructors
    WHERE survey_id = NEW.id AND instructor_id = OLD.instructor_id;
  END IF;

  IF NEW.instructor_id IS NOT NULL THEN
    INSERT INTO public.survey_instructors (survey_id, instructor_id)
    VALUES (NEW.id, NEW.instructor_id)
    ON CONFLICT (survey_id, instructor_id) DO NOTHING;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.instructor_id IS NULL THEN
    DELETE FROM public.survey_instructors
    WHERE survey_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.propagate_is_test_to_response()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF new.is_test IS NULL THEN
    SELECT is_test INTO new.is_test
    FROM public.surveys
    WHERE id = new.survey_id;
  END IF;
  RETURN new;
END;
$$;

-- 4. Add more indexes for performance
CREATE INDEX IF NOT EXISTS idx_survey_sessions_survey 
  ON public.survey_sessions(survey_id);

CREATE INDEX IF NOT EXISTS idx_survey_sessions_instructor 
  ON public.survey_sessions(instructor_id) 
  WHERE instructor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_survey_sections_survey 
  ON public.survey_sections(survey_id);

CREATE INDEX IF NOT EXISTS idx_surveys_year_round 
  ON public.surveys(education_year, education_round) 
  WHERE education_year IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_surveys_status 
  ON public.surveys(status);

COMMENT ON TABLE public.backup_courses IS 'Backup table for courses data - admin access only';
COMMENT ON TABLE public.backup_instructor_courses IS 'Backup table for instructor course relationships - admin access only';
COMMENT ON TABLE public.backup_lectures IS 'Backup table for lecture data - admin access only';