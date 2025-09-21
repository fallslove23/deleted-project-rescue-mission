import { supabase } from '@/integrations/supabase/client';

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

    // Use surveys table directly since get_survey_analysis is for single surveys
    let query = supabase
      .from('surveys')
      .select(`
        *,
        instructors(name)
      `);
    
    if (year) query = query.eq('education_year', year);
    if (round) query = query.eq('education_round', round);
    if (courseName) query = query.eq('course_name', courseName);
    if (instructorFilter) query = query.eq('instructor_id', instructorFilter);
    if (!includeTestData) query = query.neq('is_test', true);
    
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching survey aggregates:', error);
      throw error;
    }

    // Convert surveys to aggregate format
    const aggregates = data?.map(survey => ({
      survey_id: survey.id,
      title: survey.title || '제목 없음',
      description: survey.description,
      education_year: survey.education_year || 0,
      education_round: survey.education_round || 0,
      course_name: survey.course_name,
      status: survey.status,
      instructor_id: survey.instructor_id,
      instructor_name: survey.instructors?.name || null,
      expected_participants: survey.expected_participants,
      is_test: survey.is_test,
      response_count: 0,
      last_response_at: null,
      avg_overall_satisfaction: null,
      avg_course_satisfaction: null,
      avg_instructor_satisfaction: null,
      avg_operation_satisfaction: null,
      question_count: 0,
    })) || [];

    const summary = calculateSummary(aggregates);

    return {
      aggregates,
      summary,
    };
  },
};

export default SurveyAggregatesRepository;