import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

// Survey Analysis Row represents the raw response from get_survey_analysis RPC
interface SurveyAnalysisRow {
  survey_info: any;
  response_count: number;
  satisfaction_scores: any;
  feedback_text: any;
}

// Survey aggregate as normalized data structure with consistent types
interface SurveyAggregate {
  survey_id: string;
  title: string;
  description: string | null;
  education_year: number;
  education_round: number;
  course_name: string | null;
  status: string | null;
  instructor_id: string | null;
  instructor_name: string | null;
  expected_participants: number | null;
  is_test: boolean | null;
  response_count: number;
  last_response_at: string | null;
  avg_overall_satisfaction: number | null;
  avg_course_satisfaction: number | null;
  avg_instructor_satisfaction: number | null;
  avg_operation_satisfaction: number | null;
  question_count: number;
}

// Survey aggregate summary contains computed totals and averages
interface SurveyAggregateSummary {
  totalSurveys: number;
  totalResponses: number;
  activeSurveys: number;
  completedSurveys: number;
  avgOverall: number | null;
  avgCourse: number | null;
  avgInstructor: number | null;
  avgOperation: number | null;
}

// Filters for fetching survey aggregates
interface SurveyAggregateFilters {
  year?: number | null;
  round?: number | null;
  courseName?: string | null;
  instructorId?: string | null;
  includeTestData: boolean;
  restrictToInstructorId?: string | null;
}

// Combined result of aggregates and summary
interface SurveyAggregateResult {
  aggregates: SurveyAggregate[];
  summary: SurveyAggregateSummary;
}

type SurveyAggregatesViewRow = Database['public']['Views']['survey_aggregates']['Row'];
type SurveyDescriptionRow = Pick<Database['public']['Tables']['surveys']['Row'], 'id' | 'description'>;

export type {
  SurveyAnalysisRow,
  SurveyAggregate,
  SurveyAggregateSummary,
  SurveyAggregateFilters,
  SurveyAggregateResult,
};

export const EMPTY_SURVEY_AGGREGATE_SUMMARY: SurveyAggregateSummary = {
  totalSurveys: 0,
  totalResponses: 0,
  activeSurveys: 0,
  completedSurveys: 0,
  avgOverall: null,
  avgCourse: null,
  avgInstructor: null,
  avgOperation: null,
};

const toNumber = (value: unknown, defaultValue: number = 0): number => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return defaultValue;
};

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
};

const toNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return value.trim() === '' ? null : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
};

const toNullableBoolean = (value: unknown): boolean | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return null;
};

const calculateSummary = (aggregates: SurveyAggregate[]): SurveyAggregateSummary => {
  if (aggregates.length === 0) {
    return { ...EMPTY_SURVEY_AGGREGATE_SUMMARY };
  }

  const totalResponses = aggregates.reduce((sum, item) => sum + item.response_count, 0);
  const activeSurveys = aggregates.filter((item) => item.status === 'active').length;
  const completedSurveys = aggregates.filter((item) => item.status === 'completed').length;

  const weightedAverage = (key: keyof Pick<
    SurveyAggregate,
    'avg_overall_satisfaction' | 'avg_course_satisfaction' | 'avg_instructor_satisfaction' | 'avg_operation_satisfaction'
  >) => {
    let numerator = 0;
    let denominator = 0;

    aggregates.forEach((item) => {
      const value = item[key];
      if (value !== null && value !== undefined && !Number.isNaN(value)) {
        const weight = item.response_count > 0 ? item.response_count : 1;
        numerator += value * weight;
        denominator += weight;
      }
    });

    if (denominator === 0) {
      return null;
    }

    return numerator / denominator;
  };

  return {
    totalSurveys: aggregates.length,
    totalResponses,
    activeSurveys,
    completedSurveys,
    avgOverall: weightedAverage('avg_overall_satisfaction'),
    avgCourse: weightedAverage('avg_course_satisfaction'),
    avgInstructor: weightedAverage('avg_instructor_satisfaction'),
    avgOperation: weightedAverage('avg_operation_satisfaction'),
  };
};

export const SurveyAggregatesRepository = {
  async fetchAggregates({
    year = null,
    round = null,
    courseName = null,
    instructorId = null,
    includeTestData,
    restrictToInstructorId = null,
  }: SurveyAggregateFilters): Promise<SurveyAggregateResult> {
    const instructorFilter = restrictToInstructorId ?? instructorId ?? null;

    let query = supabase
      .from('survey_aggregates')
      .select(
        `
        survey_id,
        title,
        education_year,
        education_round,
        course_name,
        status,
        instructor_id,
        instructor_name,
        expected_participants,
        is_test,
        question_count,
        response_count,
        last_response_at,
        avg_overall_satisfaction,
        avg_course_satisfaction,
        avg_instructor_satisfaction,
        avg_operation_satisfaction
      `
      );

    if (year) query = query.eq('education_year', year);
    if (round) query = query.eq('education_round', round);
    if (courseName) query = query.eq('course_name', courseName);
    if (instructorFilter) query = query.eq('instructor_id', instructorFilter);
    if (!includeTestData) query = query.neq('is_test', true);

    const orderColumn = 'last_response_at';

    const { data, error } = await query.order(orderColumn, {
      ascending: false,
      nullsFirst: false,
    });

    if (error) {
      console.error('Error fetching survey aggregates:', error);
      throw error;
    }

    const aggregatesData = data ?? [];

    const surveyIds = aggregatesData
      .map((item) => item?.survey_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const uniqueSurveyIds = Array.from(new Set(surveyIds));

    const descriptionMap = new Map<string, string | null>();

    if (uniqueSurveyIds.length > 0) {
      const { data: surveyDetails, error: surveyError } = await supabase
        .from('surveys')
        .select('id, description')
        .in('id', uniqueSurveyIds)
        .returns<SurveyDescriptionRow[]>();

      if (surveyError) {
        console.error('Error fetching survey descriptions:', surveyError);
      } else {
        surveyDetails?.forEach((survey) => {
          if (survey.id) {
            descriptionMap.set(survey.id, toNullableString(survey.description));
          }
        });
      }
    }

    const aggregates = aggregatesData
      .map((survey) => {
        const surveyId = typeof survey.survey_id === 'string' ? survey.survey_id : null;

        if (!surveyId) {
          return null;
        }

        return {
          survey_id: surveyId,
          title: toNullableString(survey.title) ?? '제목 없음',
          description: descriptionMap.get(surveyId) ?? null,
          education_year: toNumber(survey.education_year, 0),
          education_round: toNumber(survey.education_round, 0),
          course_name: toNullableString(survey.course_name),
          status: toNullableString(survey.status),
          instructor_id: toNullableString(survey.instructor_id),
          instructor_name: toNullableString(survey.instructor_name),
          expected_participants: toNullableNumber(survey.expected_participants),
          is_test: toNullableBoolean(survey.is_test),
          question_count: toNumber(survey.question_count, 0),
          response_count: toNumber(
            includeTestData ? survey.response_count : survey.response_count_real,
            0,
          ),
          last_response_at: toNullableString(
            includeTestData ? survey.last_response_at : survey.last_response_at_real,
          ),
          avg_overall_satisfaction: toNullableNumber(
            includeTestData
              ? survey.avg_overall_satisfaction
              : survey.avg_overall_satisfaction_real,
          ),
          avg_course_satisfaction: toNullableNumber(
            includeTestData
              ? survey.avg_course_satisfaction
              : survey.avg_course_satisfaction_real,
          ),
          avg_instructor_satisfaction: toNullableNumber(
            includeTestData
              ? survey.avg_instructor_satisfaction
              : survey.avg_instructor_satisfaction_real,
          ),
          avg_operation_satisfaction: toNullableNumber(
            includeTestData
              ? survey.avg_operation_satisfaction
              : survey.avg_operation_satisfaction_real,
          ),
        };
      })
      .filter((aggregate): aggregate is SurveyAggregate => aggregate !== null);

    const summary = calculateSummary(aggregates);

    return {
      aggregates,
      summary,
    };
  },
};

export default SurveyAggregatesRepository;