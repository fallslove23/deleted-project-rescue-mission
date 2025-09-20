import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type SurveyAnalysisRow = Database['public']['Functions']['get_survey_analysis']['Returns'][number];

export interface SurveyAggregate {
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

export interface SurveyAggregateSummary {
  totalSurveys: number;
  totalResponses: number;
  activeSurveys: number;
  completedSurveys: number;
  avgOverall: number | null;
  avgCourse: number | null;
  avgInstructor: number | null;
  avgOperation: number | null;
}

export interface SurveyAggregateFilters {
  year?: number | null;
  round?: number | null;
  courseName?: string | null;
  instructorId?: string | null;
  includeTestData: boolean;
  restrictToInstructorId?: string | null;
}

export interface SurveyAggregateResult {
  aggregates: SurveyAggregate[];
  summary: SurveyAggregateSummary;
}

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

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const normalizeSurveyAnalysisRows = (rows: SurveyAnalysisRow[] | null | undefined): SurveyAggregate[] => {
  if (!rows) return [];

  // Since get_survey_analysis returns a different format, we need to extract from survey_info
  const normalized = rows.map((row) => {
    const surveyInfo = (row.survey_info && typeof row.survey_info === 'object' && !Array.isArray(row.survey_info)) 
      ? row.survey_info as Record<string, any> 
      : {};
    
    return {
      survey_id: (typeof surveyInfo.id === 'string') ? surveyInfo.id : '',
      title: (typeof surveyInfo.title === 'string') ? surveyInfo.title : '제목 없음',
      description: (typeof surveyInfo.description === 'string') ? surveyInfo.description : null,
      education_year: toNumber(surveyInfo.education_year),
      education_round: toNumber(surveyInfo.education_round),
      course_name: (typeof surveyInfo.course_name === 'string') ? surveyInfo.course_name : null,
      status: (typeof surveyInfo.status === 'string') ? surveyInfo.status : null,
      instructor_id: (typeof surveyInfo.instructor_id === 'string') ? surveyInfo.instructor_id : null,
      instructor_name: (typeof surveyInfo.instructor_name === 'string') ? surveyInfo.instructor_name : null,
      expected_participants: null,
      is_test: null,
      response_count: toNumber(row.response_count),
      last_response_at: null,
      avg_overall_satisfaction: null,
      avg_course_satisfaction: null,
      avg_instructor_satisfaction: null,
      avg_operation_satisfaction: null,
      question_count: 0,
    } satisfies SurveyAggregate;
  });

  return normalized.sort((a, b) => {
    if (a.education_year !== b.education_year) {
      return b.education_year - a.education_year;
    }
    if (a.education_round !== b.education_round) {
      return b.education_round - a.education_round;
    }
    const aCourse = a.course_name ?? '';
    const bCourse = b.course_name ?? '';
    if (aCourse !== bCourse) {
      return aCourse.localeCompare(bCourse, 'ko');
    }
    return a.title.localeCompare(b.title, 'ko');
  });
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

    const { data, error } = await supabase.rpc('get_survey_analysis', {
      survey_id_param: '00000000-0000-0000-0000-000000000000' // Placeholder for aggregates
    });

    if (error) {
      throw error;
    }

    const aggregates = normalizeSurveyAnalysisRows(data);
    const summary = calculateSummary(aggregates);

    return {
      aggregates,
      summary,
    };
  },
};

