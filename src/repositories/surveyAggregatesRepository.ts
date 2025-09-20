import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { normalizeUuid } from '@/utils/uuid';

export type SurveyAnalysisRow = Database['public']['Functions']['get_survey_analysis']['Returns'][number];

export interface SurveyAggregate {
  survey_id: string;
  title: string;
  description: string | null;
  education_year: number | null;
  education_round: number | null;
  course_name: string | null;
  status: string | null;
  instructor_id: string | null;
  instructor_name: string | null;
  instructor_ids: string[];
  instructor_names: string[];
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
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
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
    if (['true', 't', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['false', 'f', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return null;
};

const toStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item !== 'string') {
          return null;
        }
        const trimmed = item.trim();
        return trimmed.length > 0 ? trimmed : null;
      })
      .filter((item): item is string => item !== null);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => {
              if (typeof item !== 'string') {
                return null;
              }
              const parsedTrimmed = item.trim();
              return parsedTrimmed.length > 0 ? parsedTrimmed : null;
            })
            .filter((item): item is string => item !== null);
        }
      } catch (error) {
        console.warn('Failed to parse instructor_ids array', error, value);
      }
    }
    return trimmed.length > 0 ? [trimmed] : [];
  }
  return [];
};

const normalizeFilterString = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeSurveyAnalysisRows = (rows: SurveyAnalysisRow[] | null | undefined): SurveyAggregate[] => {
  if (!rows) return [];

  const normalized = rows.map((row) => {
    const courseName = toNullableString(row.course_name);
    const status = toNullableString(row.status);
    const instructorId = toNullableString(row.instructor_id);
    const instructorName = toNullableString(row.instructor_name);
    const instructorIds = toStringArray(row.instructor_ids);
    const instructorNames = toStringArray(row.instructor_names);
    const description = toNullableString(row.description);
    const educationYear = toNullableNumber(row.education_year);
    const educationRound = toNullableNumber(row.education_round);
    const resolvedInstructorName = instructorName
      ?? (instructorIds.length > 0 ? '강사 정보 없음' : null);

    return {
      survey_id: typeof row.survey_id === 'string' && row.survey_id.trim().length > 0 ? row.survey_id : '',
      title: typeof row.title === 'string' && row.title.trim().length > 0 ? row.title : '제목 없음',
      description,
      education_year: educationYear,
      education_round: educationRound,
      course_name: courseName,
      status,
      instructor_id: instructorId,
      instructor_name: resolvedInstructorName,
      instructor_ids: instructorIds.length > 0
        ? instructorIds
        : instructorId
          ? [instructorId]
          : [],
      instructor_names: instructorNames.length > 0
        ? instructorNames
        : instructorName
          ? [instructorName]
          : [],
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
    const aYear = a.education_year ?? -Infinity;
    const bYear = b.education_year ?? -Infinity;
    if (aYear !== bYear) {
      return bYear - aYear;
    }
    const aRound = a.education_round ?? -Infinity;
    const bRound = b.education_round ?? -Infinity;
    if (aRound !== bRound) {
      return bRound - aRound;
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
    const sanitizedCourseFilter = normalizeFilterString(courseName);
    const sanitizedInstructorFilter = normalizeUuid(instructorId ?? null);
    const sanitizedRestrictedInstructor = normalizeUuid(restrictToInstructorId ?? null);
    const instructorFilter = sanitizedRestrictedInstructor ?? sanitizedInstructorFilter;

    const payload: Database['public']['Functions']['get_survey_analysis']['Args'] = {
      p_include_test: includeTestData,
    };

    if (year !== null && year !== undefined) {
      payload.p_year = year;
    }

    if (round !== null && round !== undefined) {
      payload.p_round = round;
    }

    if (sanitizedCourseFilter) {
      payload.p_course_name = sanitizedCourseFilter;
    }

    if (instructorFilter) {
      payload.p_instructor_id = instructorFilter;
    }

    const { data, error } = await supabase.rpc('get_survey_analysis', payload);

    if (error) {
      console.error('Failed to execute get_survey_analysis RPC', error);
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

