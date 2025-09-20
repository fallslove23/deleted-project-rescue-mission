-- Create RPC to return aggregated survey summaries and question type distributions
CREATE OR REPLACE FUNCTION public.get_survey_analysis(
  p_year integer DEFAULT NULL,
  p_round integer DEFAULT NULL,
  p_course_name text DEFAULT NULL,
  p_instructor_id uuid DEFAULT NULL,
  p_include_test boolean DEFAULT false
)
RETURNS TABLE (
  survey_id uuid,
  title text,
  description text,
  education_year integer,
  education_round integer,
  course_name text,
  status text,
  instructor_id uuid,
  instructor_name text,
  instructor_ids uuid[],
  instructor_names text[],
  expected_participants integer,
  is_test boolean,
  response_count bigint,
  last_response_at timestamptz,
  avg_overall_satisfaction numeric,
  avg_course_satisfaction numeric,
  avg_instructor_satisfaction numeric,
  avg_operation_satisfaction numeric,
  question_count bigint,
  question_type_distribution jsonb
)
LANGUAGE sql
STABLE
AS $$
  WITH base AS (
    SELECT
      sa.*,
      s.description AS survey_description
    FROM public.survey_aggregates sa
    JOIN public.surveys s ON s.id = sa.survey_id
    WHERE (p_year IS NULL OR sa.education_year = p_year)
      AND (p_round IS NULL OR sa.education_round = p_round)
      AND (p_course_name IS NULL OR sa.course_name = p_course_name)
      AND (p_include_test OR COALESCE(sa.is_test, false) = false)
  ),
  instructor_links AS (
    SELECT b.survey_id, b.instructor_id
    FROM base b
    WHERE b.instructor_id IS NOT NULL
    UNION
    SELECT si.survey_id, si.instructor_id
    FROM public.survey_instructors si
    JOIN base b ON b.survey_id = si.survey_id
    WHERE si.instructor_id IS NOT NULL
    UNION
    SELECT ss.survey_id, ss.instructor_id
    FROM public.survey_sessions ss
    JOIN base b ON b.survey_id = ss.survey_id
    WHERE ss.instructor_id IS NOT NULL
  ),
  instructor_lists AS (
    SELECT
      il.survey_id,
      ARRAY_AGG(il.instructor_id ORDER BY il.instructor_id) AS instructor_ids,
      ARRAY_AGG(COALESCE(inst.name, '강사 정보 없음') ORDER BY il.instructor_id) AS instructor_names,
      MIN(il.instructor_id) AS primary_instructor_id
    FROM instructor_links il
    LEFT JOIN public.instructors inst ON inst.id = il.instructor_id
    GROUP BY il.survey_id
  ),
  primary_instructor AS (
    SELECT
      il.survey_id,
      il.primary_instructor_id,
      COALESCE(i.name, '강사 정보 없음') AS primary_instructor_name
    FROM instructor_lists il
    LEFT JOIN public.instructors i ON i.id = il.primary_instructor_id
  ),
  filtered AS (
    SELECT
      b.survey_id,
      b.title,
      b.survey_description,
      b.education_year,
      b.education_round,
      b.course_name,
      b.status,
      COALESCE(b.instructor_id, il.primary_instructor_id) AS instructor_id,
      CASE
        WHEN COALESCE(b.instructor_id, il.primary_instructor_id) IS NOT NULL
          THEN COALESCE(b.instructor_name, pi.primary_instructor_name)
        ELSE NULL
      END AS instructor_name,
      COALESCE(
        il.instructor_ids,
        CASE
          WHEN b.instructor_id IS NOT NULL THEN ARRAY[b.instructor_id]
          ELSE ARRAY[]::uuid[]
        END
      ) AS instructor_ids,
      COALESCE(
        il.instructor_names,
        CASE
          WHEN b.instructor_id IS NOT NULL THEN ARRAY[COALESCE(b.instructor_name, '강사 정보 없음')]
          ELSE ARRAY[]::text[]
        END
      ) AS instructor_names,
      b.expected_participants,
      b.is_test,
      b.response_count,
      b.last_response_at,
      b.avg_overall_satisfaction,
      b.avg_course_satisfaction,
      b.avg_instructor_satisfaction,
      b.avg_operation_satisfaction
    FROM base b
    LEFT JOIN instructor_lists il ON il.survey_id = b.survey_id
    LEFT JOIN primary_instructor pi ON pi.survey_id = b.survey_id
    WHERE
      p_instructor_id IS NULL
      OR p_instructor_id = ANY(
        COALESCE(
          il.instructor_ids,
          CASE
            WHEN b.instructor_id IS NOT NULL THEN ARRAY[b.instructor_id]
            ELSE ARRAY[]::uuid[]
          END
        )
      )
  ),
  question_counts AS (
    SELECT
      sq.survey_id,
      COUNT(DISTINCT sq.id) AS question_count
    FROM public.survey_questions sq
    JOIN filtered f ON f.survey_id = sq.survey_id
    GROUP BY sq.survey_id
  ),
  distributions AS (
    SELECT
      sq.survey_id,
      jsonb_agg(
        jsonb_build_object(
          'question_type', sq.question_type,
          'response_count', COUNT(qa.id)
        ) ORDER BY sq.question_type
      ) AS question_type_distribution
    FROM public.survey_questions sq
    LEFT JOIN public.question_answers qa ON qa.question_id = sq.id
    JOIN filtered f ON f.survey_id = sq.survey_id
    GROUP BY sq.survey_id
  )
  SELECT
    f.survey_id,
    f.title,
    f.survey_description AS description,
    f.education_year,
    f.education_round,
    f.course_name,
    f.status,
    f.instructor_id,
    f.instructor_name,
    f.instructor_ids,
    f.instructor_names,
    f.expected_participants,
    f.is_test,
    f.response_count,
    f.last_response_at,
    f.avg_overall_satisfaction,
    f.avg_course_satisfaction,
    f.avg_instructor_satisfaction,
    f.avg_operation_satisfaction,
    COALESCE(qc.question_count, 0) AS question_count,
    COALESCE(d.question_type_distribution, '[]'::jsonb) AS question_type_distribution
  FROM filtered f
  LEFT JOIN question_counts qc ON qc.survey_id = f.survey_id
  LEFT JOIN distributions d ON d.survey_id = f.survey_id
  ORDER BY f.education_year DESC, f.education_round DESC, f.course_name NULLS LAST, f.title;
$$;

COMMENT ON FUNCTION public.get_survey_analysis(integer, integer, text, uuid, boolean)
IS 'Returns aggregated survey metrics with question type distributions filtered by year, round, course, instructor, and optional test data inclusion.';
