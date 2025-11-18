-- Phase 1: Data Integrity Fixes

-- 1. Function to recover NULL session_ids in survey_responses
-- This function will attempt to match responses to sessions based on survey structure
CREATE OR REPLACE FUNCTION public.recover_null_session_ids()
RETURNS TABLE(recovered_count INTEGER, total_null_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_recovered INTEGER := 0;
  v_total_null INTEGER := 0;
BEGIN
  -- Count total NULL session_ids
  SELECT COUNT(*) INTO v_total_null
  FROM public.survey_responses
  WHERE session_id IS NULL;

  -- Update responses with NULL session_id where survey has only one session
  WITH single_session_surveys AS (
    SELECT 
      ss.survey_id,
      ss.id as session_id
    FROM public.survey_sessions ss
    WHERE (
      SELECT COUNT(*) 
      FROM public.survey_sessions ss2 
      WHERE ss2.survey_id = ss.survey_id
    ) = 1
  )
  UPDATE public.survey_responses sr
  SET session_id = sss.session_id
  FROM single_session_surveys sss
  WHERE sr.survey_id = sss.survey_id
    AND sr.session_id IS NULL;

  GET DIAGNOSTICS v_recovered = ROW_COUNT;

  RETURN QUERY SELECT v_recovered, v_total_null;
END;
$$;

-- 2. Rebuild get_survey_detail_stats function with better data handling
CREATE OR REPLACE FUNCTION public.get_survey_detail_stats(
  p_survey_id uuid,
  p_include_test boolean DEFAULT false,
  p_response_cursor integer DEFAULT 0,
  p_response_limit integer DEFAULT 50,
  p_distribution_cursor integer DEFAULT 0,
  p_distribution_limit integer DEFAULT 20,
  p_text_cursor integer DEFAULT 0,
  p_text_limit integer DEFAULT 50
)
RETURNS TABLE(
  summary jsonb,
  responses jsonb,
  response_total_count integer,
  response_next_cursor integer,
  question_distributions jsonb,
  distribution_total_count integer,
  distribution_next_cursor integer,
  text_answers jsonb,
  text_total_count integer,
  text_next_cursor integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_response_count INTEGER;
  v_rating_response_count INTEGER;
  v_question_count INTEGER;
  v_text_count INTEGER;
  v_avg_overall NUMERIC;
  v_avg_course NUMERIC;
  v_avg_instructor NUMERIC;
  v_avg_operation NUMERIC;
BEGIN
  -- Calculate summary statistics with proper NULL handling
  SELECT 
    COUNT(DISTINCT sr.id),
    COUNT(DISTINCT CASE 
      WHEN sq.question_type IN ('rating', 'scale') 
        AND qa.answer_value IS NOT NULL 
      THEN sr.id 
    END),
    COUNT(DISTINCT sq.id),
    COUNT(DISTINCT CASE 
      WHEN sq.question_type IN ('text', 'textarea', 'long_text', 'paragraph') 
        AND qa.answer_text IS NOT NULL 
        AND qa.answer_text != '' 
      THEN qa.id 
    END)
  INTO v_response_count, v_rating_response_count, v_question_count, v_text_count
  FROM survey_responses sr
  LEFT JOIN question_answers qa ON qa.response_id = sr.id
  LEFT JOIN survey_questions sq ON sq.id = qa.question_id
  WHERE sr.survey_id = p_survey_id
    AND (p_include_test OR COALESCE(sr.is_test, false) = false);

  -- Calculate average ratings by satisfaction type with improved NULL handling
  WITH rating_answers AS (
    SELECT 
      sq.satisfaction_type,
      CASE 
        WHEN qa.answer_value IS NULL THEN NULL
        WHEN jsonb_typeof(qa.answer_value) = 'number' THEN (qa.answer_value #>> '{}')::NUMERIC
        WHEN jsonb_typeof(qa.answer_value) = 'string' 
          AND (qa.answer_value #>> '{}') ~ '^[0-9]+(\.[0-9]+)?$' 
        THEN (qa.answer_value #>> '{}')::NUMERIC
        ELSE NULL
      END AS rating_value
    FROM survey_responses sr
    JOIN question_answers qa ON qa.response_id = sr.id
    JOIN survey_questions sq ON sq.id = qa.question_id
    WHERE sr.survey_id = p_survey_id
      AND sq.question_type IN ('rating', 'scale')
      AND qa.answer_value IS NOT NULL
      AND (p_include_test OR COALESCE(sr.is_test, false) = false)
  )
  SELECT 
    ROUND(AVG(rating_value), 2),
    ROUND(AVG(CASE WHEN satisfaction_type = 'course' THEN rating_value END), 2),
    ROUND(AVG(CASE WHEN satisfaction_type = 'instructor' THEN rating_value END), 2),
    ROUND(AVG(CASE WHEN satisfaction_type = 'operation' THEN rating_value END), 2)
  INTO v_avg_overall, v_avg_course, v_avg_instructor, v_avg_operation
  FROM rating_answers
  WHERE rating_value IS NOT NULL;

  RETURN QUERY
  WITH response_data AS (
    SELECT 
      sr.id,
      sr.submitted_at,
      sr.respondent_email,
      sr.session_id,
      COALESCE(sr.is_test, false) as is_test,
      ROW_NUMBER() OVER (ORDER BY sr.submitted_at DESC) - 1 AS row_num
    FROM survey_responses sr
    WHERE sr.survey_id = p_survey_id
      AND (p_include_test OR COALESCE(sr.is_test, false) = false)
  ),
  distribution_data AS (
    SELECT 
      sq.id AS question_id,
      sq.question_text,
      sq.question_type,
      sq.satisfaction_type,
      sq.order_index,
      sq.session_id,
      sq.section_id,
      COUNT(CASE WHEN qa.id IS NOT NULL THEN 1 END) AS total_answers,
      ROUND(AVG(CASE 
        WHEN sq.question_type IN ('rating', 'scale') AND qa.answer_value IS NOT NULL THEN
          CASE 
            WHEN jsonb_typeof(qa.answer_value) = 'number' THEN (qa.answer_value #>> '{}')::NUMERIC
            WHEN jsonb_typeof(qa.answer_value) = 'string' 
              AND (qa.answer_value #>> '{}') ~ '^[0-9]+(\.[0-9]+)?$' 
            THEN (qa.answer_value #>> '{}')::NUMERIC
            ELSE NULL
          END
      END), 2) AS average,
      COALESCE(
        jsonb_object_agg(
          CASE 
            WHEN sq.question_type IN ('rating', 'scale') AND qa.answer_value IS NOT NULL THEN
              CASE 
                WHEN jsonb_typeof(qa.answer_value) = 'number' THEN (qa.answer_value #>> '{}')
                WHEN jsonb_typeof(qa.answer_value) = 'string' 
                  AND (qa.answer_value #>> '{}') ~ '^[0-9]+(\.[0-9]+)?$' 
                THEN (qa.answer_value #>> '{}')
                ELSE 'invalid'
              END
          END,
          1
        ) FILTER (WHERE sq.question_type IN ('rating', 'scale') AND qa.answer_value IS NOT NULL),
        '{}'::jsonb
      ) AS rating_dist,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'option', COALESCE(qa.answer_text, qa.answer_value::TEXT),
            'count', 1
          )
        ) FILTER (
          WHERE sq.question_type NOT IN ('rating', 'scale', 'text', 'textarea', 'long_text', 'paragraph')
            AND qa.id IS NOT NULL
        ),
        '[]'::jsonb
      ) AS option_counts,
      ROW_NUMBER() OVER (ORDER BY sq.order_index NULLS LAST, sq.id) - 1 AS row_num
    FROM survey_questions sq
    LEFT JOIN question_answers qa ON qa.question_id = sq.id
    LEFT JOIN survey_responses sr ON sr.id = qa.response_id 
      AND (p_include_test OR COALESCE(sr.is_test, false) = false)
    WHERE sq.survey_id = p_survey_id
    GROUP BY sq.id, sq.question_text, sq.question_type, sq.satisfaction_type, 
             sq.order_index, sq.session_id, sq.section_id
  ),
  text_data AS (
    SELECT 
      qa.id AS answer_id,
      sq.id AS question_id,
      sq.question_text,
      sq.satisfaction_type,
      sq.order_index,
      sq.session_id,
      sq.section_id,
      qa.answer_text,
      qa.created_at,
      ROW_NUMBER() OVER (ORDER BY qa.created_at DESC) - 1 AS row_num
    FROM survey_questions sq
    JOIN question_answers qa ON qa.question_id = sq.id
    JOIN survey_responses sr ON sr.id = qa.response_id
    WHERE sq.survey_id = p_survey_id
      AND sq.question_type IN ('text', 'textarea', 'long_text', 'paragraph')
      AND qa.answer_text IS NOT NULL
      AND qa.answer_text != ''
      AND (p_include_test OR COALESCE(sr.is_test, false) = false)
  )
  SELECT 
    jsonb_build_object(
      'responseCount', v_response_count,
      'ratingResponseCount', v_rating_response_count,
      'avgOverall', v_avg_overall,
      'avgCourse', v_avg_course,
      'avgInstructor', v_avg_instructor,
      'avgOperation', v_avg_operation,
      'questionCount', v_question_count,
      'textAnswerCount', v_text_count
    ) AS summary,
    -- Responses with proper NULL handling
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'submitted_at', submitted_at,
          'respondent_email', respondent_email,
          'session_id', session_id,
          'is_test', is_test
        ) ORDER BY submitted_at DESC
      ) FROM response_data 
      WHERE row_num >= p_response_cursor AND row_num < p_response_cursor + p_response_limit),
      '[]'::jsonb
    ) AS responses,
    (SELECT COUNT(*)::INTEGER FROM response_data) AS response_total_count,
    CASE 
      WHEN (SELECT COUNT(*) FROM response_data WHERE row_num >= p_response_cursor + p_response_limit) > 0 
      THEN (p_response_cursor + p_response_limit)::INTEGER
      ELSE NULL 
    END AS response_next_cursor,
    -- Distributions with proper NULL handling
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'questionId', question_id,
          'questionText', question_text,
          'questionType', question_type,
          'satisfactionType', satisfaction_type,
          'orderIndex', order_index,
          'sessionId', session_id,
          'sectionId', section_id,
          'totalAnswers', total_answers,
          'average', average,
          'ratingDistribution', rating_dist,
          'optionCounts', option_counts
        ) ORDER BY order_index NULLS LAST, question_id
      ) FROM distribution_data 
      WHERE row_num >= p_distribution_cursor AND row_num < p_distribution_cursor + p_distribution_limit),
      '[]'::jsonb
    ) AS question_distributions,
    (SELECT COUNT(*)::INTEGER FROM distribution_data) AS distribution_total_count,
    CASE 
      WHEN (SELECT COUNT(*) FROM distribution_data WHERE row_num >= p_distribution_cursor + p_distribution_limit) > 0 
      THEN (p_distribution_cursor + p_distribution_limit)::INTEGER
      ELSE NULL 
    END AS distribution_next_cursor,
    -- Text answers with proper NULL handling
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'answerId', answer_id,
          'questionId', question_id,
          'questionText', question_text,
          'satisfactionType', satisfaction_type,
          'orderIndex', order_index,
          'sessionId', session_id,
          'sectionId', section_id,
          'answerText', answer_text,
          'createdAt', created_at
        ) ORDER BY created_at DESC
      ) FROM text_data 
      WHERE row_num >= p_text_cursor AND row_num < p_text_cursor + p_text_limit),
      '[]'::jsonb
    ) AS text_answers,
    (SELECT COUNT(*)::INTEGER FROM text_data) AS text_total_count,
    CASE 
      WHEN (SELECT COUNT(*) FROM text_data WHERE row_num >= p_text_cursor + p_text_limit) > 0 
      THEN (p_text_cursor + p_text_limit)::INTEGER
      ELSE NULL 
    END AS text_next_cursor;
END;
$$;

-- 3. Add helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_session 
  ON public.survey_responses(survey_id, session_id) 
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_survey_responses_is_test 
  ON public.survey_responses(survey_id, is_test) 
  WHERE is_test IS NOT TRUE;

CREATE INDEX IF NOT EXISTS idx_question_answers_response_question 
  ON public.question_answers(response_id, question_id);

CREATE INDEX IF NOT EXISTS idx_survey_questions_survey_type 
  ON public.survey_questions(survey_id, question_type);

CREATE INDEX IF NOT EXISTS idx_survey_questions_satisfaction 
  ON public.survey_questions(survey_id, satisfaction_type) 
  WHERE satisfaction_type IS NOT NULL;

COMMENT ON FUNCTION public.recover_null_session_ids() IS 
  'Recovers NULL session_ids in survey_responses by matching with single-session surveys';

COMMENT ON FUNCTION public.get_survey_detail_stats IS 
  'Improved version with better NULL handling and performance optimization for survey detail statistics';