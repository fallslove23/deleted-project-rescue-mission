-- Create RPC that exposes survey aggregate data with optional filtering
CREATE OR REPLACE FUNCTION public.get_survey_aggregates(
  p_year integer DEFAULT NULL,
  p_round integer DEFAULT NULL,
  p_course_name text DEFAULT NULL,
  p_instructor_id uuid DEFAULT NULL,
  p_include_test boolean DEFAULT false
)
RETURNS TABLE (
  survey_id uuid,
  title text,
  education_year integer,
  education_round integer,
  course_name text,
  status text,
  instructor_id uuid,
  instructor_name text,
  expected_participants integer,
  is_test boolean,
  question_count bigint,
  response_count bigint,
  last_response_at timestamptz,
  avg_overall_satisfaction numeric,
  avg_course_satisfaction numeric,
  avg_instructor_satisfaction numeric,
  avg_operation_satisfaction numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    sa.survey_id,
    sa.title,
    sa.education_year,
    sa.education_round,
    sa.course_name,
    sa.status,
    sa.instructor_id,
    sa.instructor_name,
    sa.expected_participants,
    sa.is_test,
    sa.question_count,
    sa.response_count,
    sa.last_response_at,
    sa.avg_overall_satisfaction,
    sa.avg_course_satisfaction,
    sa.avg_instructor_satisfaction,
    sa.avg_operation_satisfaction
  FROM public.survey_aggregates sa
  WHERE (p_year IS NULL OR sa.education_year = p_year)
    AND (p_round IS NULL OR sa.education_round = p_round)
    AND (p_course_name IS NULL OR sa.course_name = p_course_name)
    AND (p_instructor_id IS NULL OR sa.instructor_id = p_instructor_id)
    AND (p_include_test OR COALESCE(sa.is_test, false) = false)
  ORDER BY sa.last_response_at DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_survey_aggregates(
  integer,
  integer,
  text,
  uuid,
  boolean
) TO authenticated, anon;

COMMENT ON FUNCTION public.get_survey_aggregates(integer, integer, text, uuid, boolean)
IS 'Returns survey aggregate metrics filtered by year, round, course, instructor, and optional test data inclusion.';
