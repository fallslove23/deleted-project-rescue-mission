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
  if (typeof value === 'number') return Number.isNaN(value) ? fallback : value;
  if (typeof value === 'bigint') return Number(value);
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
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const toNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
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
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 't'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n', 'f'].includes(normalized)) {
      return false;
    }
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return null;
};

const normalizeSurveyAnalysisRows = (rows: SurveyAnalysisRow[] | null | undefined): SurveyAggregate[] => {
  if (!rows) return [];

  const normalized = rows.map((row) => {
    const courseName = typeof row.course_name === 'string' && row.course_name.trim().length > 0
      ? row.course_name
      : null;
    const status = typeof row.status === 'string' && row.status.trim().length > 0 ? row.status : null;
    const instructorId = typeof row.instructor_id === 'string' && row.instructor_id.trim().length > 0
      ? row.instructor_id
      : null;
    const instructorName = typeof row.instructor_name === 'string' && row.instructor_name.trim().length > 0
      ? row.instructor_name
      : null;
    const description = typeof row.description === 'string' && row.description.trim().length > 0
      ? row.description
      : null;

    return {
      survey_id: typeof row.survey_id === 'string' ? row.survey_id : '',
      title: typeof row.title === 'string' && row.title.trim().length > 0 ? row.title : '제목 없음',
      description,
      education_year: toNumber(row.education_year),
      education_round: toNumber(row.education_round),
      course_name: courseName,
      status,
      instructor_id: instructorId,
      instructor_name: instructorName,
      expected_participants: toNullableNumber(row.expected_participants),
      is_test: toNullableBoolean(row.is_test),
      response_count: toNumber(row.response_count),
      last_response_at: toNullableString(row.last_response_at),
      avg_overall_satisfaction: toNullableNumber(row.avg_overall_satisfaction),
      avg_course_satisfaction: toNullableNumber(row.avg_course_satisfaction),
      avg_instructor_satisfaction: toNullableNumber(row.avg_instructor_satisfaction),
      avg_operation_satisfaction: toNullableNumber(row.avg_operation_satisfaction),
      question_count: toNumber(row.question_count, 0),
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
    const normalizedCourseFilter = typeof courseName === 'string' ? courseName.trim() : courseName;
    const normalizedInstructorFilter = typeof instructorFilter === 'string'
      ? instructorFilter.trim()
      : instructorFilter;

    const { data, error } = await supabase.rpc('get_survey_analysis', {
      p_year: year,
      p_round: round,
      p_course_name: typeof normalizedCourseFilter === 'string' && normalizedCourseFilter.length > 0
        ? normalizedCourseFilter
        : null,
      p_instructor_id: typeof normalizedInstructorFilter === 'string' && normalizedInstructorFilter.length > 0
        ? normalizedInstructorFilter
        : null,
      p_include_test: includeTestData,
    });

    if (error) {
      console.error('Failed to execute get_survey_analysis RPC', error);
      throw error;
    }

    const aggregates = normalizeSurveyAnalysisRows(data);

    const filteredAggregates = aggregates.filter((aggregate) => {
      if (year !== null && year !== undefined && aggregate.education_year !== year) {
        return false;
      }
      if (round !== null && round !== undefined && aggregate.education_round !== round) {
        return false;
      }
      if (
        normalizedCourseFilter !== null &&
        normalizedCourseFilter !== undefined &&
        aggregate.course_name !== normalizedCourseFilter
      ) {
        return false;
      }
      if (normalizedInstructorFilter && aggregate.instructor_id !== normalizedInstructorFilter) {
        return false;
      }
      if (!includeTestData && aggregate.is_test === true) {
        return false;
      }
      return true;
    });

    const summary = calculateSummary(filteredAggregates);

    return {
      aggregates: filteredAggregates,
      summary,
    };
  },
};

