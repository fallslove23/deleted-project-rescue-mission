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

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const getFromRecord = (record: Record<string, unknown> | null, key: string): unknown => {
  if (!record) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(record, key)) {
    return record[key];
  }

  return undefined;
};

const normalizeSurveyAnalysisRows = (rows: SurveyAnalysisRow[] | null | undefined): SurveyAggregate[] => {
  if (!rows) return [];

  const normalized = rows.map((row) => {
    const rowRecord = isRecord(row) ? row : {};
    const surveyInfoRaw = getFromRecord(rowRecord, 'survey_info');
    const surveyInfo = isRecord(surveyInfoRaw) ? surveyInfoRaw : null;
    const satisfactionScoresRaw = getFromRecord(rowRecord, 'satisfaction_scores');
    const satisfactionScores = isRecord(satisfactionScoresRaw) ? satisfactionScoresRaw : null;

    const getFromRowOrInfo = (primaryKey: string, alternateKeys: string[] = []): unknown => {
      const keys = [primaryKey, ...alternateKeys];
      for (const key of keys) {
        const rowValue = getFromRecord(rowRecord, key);
        if (rowValue !== undefined && rowValue !== null) {
          return rowValue;
        }
        const infoValue = getFromRecord(surveyInfo, key);
        if (infoValue !== undefined && infoValue !== null) {
          return infoValue;
        }
      }
      return undefined;
    };

    const getSatisfactionValue = (modernKey: string, legacyKey: string): unknown => {
      const direct = getFromRowOrInfo(modernKey);
      if (direct !== undefined && direct !== null) {
        return direct;
      }
      const legacy = getFromRecord(satisfactionScores, legacyKey);
      return legacy !== undefined && legacy !== null ? legacy : undefined;
    };

    const surveyIdRaw = getFromRowOrInfo('survey_id', ['id']);
    const titleRaw = getFromRowOrInfo('title');
    const descriptionRaw = getFromRowOrInfo('description');
    const educationYearRaw = getFromRowOrInfo('education_year');
    const educationRoundRaw = getFromRowOrInfo('education_round');
    const courseNameRaw = getFromRowOrInfo('course_name');
    const statusRaw = getFromRowOrInfo('status');
    const instructorIdRaw = getFromRowOrInfo('instructor_id');
    const instructorNameRaw = getFromRowOrInfo('instructor_name');
    const expectedParticipantsRaw = getFromRowOrInfo('expected_participants');
    const isTestRaw = getFromRowOrInfo('is_test');
    const lastResponseRaw = getFromRowOrInfo('last_response_at');
    const responseCountRaw = getFromRowOrInfo('response_count');
    const questionCountRaw = getFromRowOrInfo('question_count');

    const courseName = typeof courseNameRaw === 'string' && courseNameRaw.trim().length > 0
      ? courseNameRaw
      : null;
    const status = typeof statusRaw === 'string' && statusRaw.trim().length > 0 ? statusRaw : null;
    const instructorId = typeof instructorIdRaw === 'string' && instructorIdRaw.trim().length > 0
      ? instructorIdRaw
      : null;
    const resolvedInstructorName = typeof instructorNameRaw === 'string' && instructorNameRaw.trim().length > 0
      ? instructorNameRaw
      : null;
    const description = typeof descriptionRaw === 'string' && descriptionRaw.trim().length > 0
      ? descriptionRaw
      : null;

    const avgCourseRaw = getSatisfactionValue('avg_course_satisfaction', 'course_satisfaction');
    const avgInstructorRaw = getSatisfactionValue('avg_instructor_satisfaction', 'instructor_satisfaction');
    const avgOperationRaw = getSatisfactionValue('avg_operation_satisfaction', 'operation_satisfaction');

    const avgCourse = toNullableNumber(avgCourseRaw);
    const avgInstructor = toNullableNumber(avgInstructorRaw);
    const avgOperation = toNullableNumber(avgOperationRaw);

    const avgOverallCandidate = getFromRowOrInfo('avg_overall_satisfaction');
    const avgOverallLegacy = getFromRecord(satisfactionScores, 'overall_satisfaction');
    let avgOverall = toNullableNumber(avgOverallCandidate ?? avgOverallLegacy ?? null);
    if (avgOverall === null) {
      const components = [avgCourse, avgInstructor, avgOperation].filter((value): value is number => value !== null);
      if (components.length > 0) {
        avgOverall = components.reduce((sum, value) => sum + value, 0) / components.length;
      }
    }

    return {
      survey_id: typeof surveyIdRaw === 'string' && surveyIdRaw.trim().length > 0 ? surveyIdRaw : '',
      title: typeof titleRaw === 'string' && titleRaw.trim().length > 0 ? titleRaw : '제목 없음',
      description,
      education_year: toNumber(educationYearRaw),
      education_round: toNumber(educationRoundRaw),
      course_name: courseName,
      status,
      instructor_id: instructorId,
      instructor_name: resolvedInstructorName ?? (instructorId ? '강사 정보 없음' : null),
      expected_participants: toNullableNumber(expectedParticipantsRaw),
      is_test: toNullableBoolean(isTestRaw),
      response_count: toNumber(responseCountRaw),
      last_response_at: toNullableString(lastResponseRaw),
      avg_overall_satisfaction: avgOverall,
      avg_course_satisfaction: avgCourse,
      avg_instructor_satisfaction: avgInstructor,
      avg_operation_satisfaction: avgOperation,
      question_count: toNumber(questionCountRaw, 0),
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

    const rawCourseFilter = typeof courseName === 'string' ? courseName.trim() : courseName;
    const normalizedCourseFilter =
      typeof rawCourseFilter === 'string' && rawCourseFilter.length > 0 ? rawCourseFilter : null;

    const rawInstructorFilter = typeof instructorFilter === 'string' ? instructorFilter.trim() : instructorFilter;
    const normalizedInstructorFilter =
      typeof rawInstructorFilter === 'string' && rawInstructorFilter.length > 0 ? rawInstructorFilter : null;

    const { data, error } = await supabase.rpc('get_survey_analysis', {
      p_year: year,
      p_round: round,
      p_course_name: normalizedCourseFilter,
      p_instructor_id: normalizedInstructorFilter,
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
      if (normalizedCourseFilter && aggregate.course_name !== normalizedCourseFilter) {
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

