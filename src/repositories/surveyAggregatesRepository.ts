import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
  normalizeSurveyAnalysisRows,
  type NormalizedSurveyAnalysisRow,
  type SurveyAnalysisRow,
} from '@/utils/surveyAnalysisNormalization';
import { normalizeUuid } from '@/utils/uuid';

export type SurveyAggregate = Omit<NormalizedSurveyAnalysisRow, 'question_type_distribution'>;

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

const normalizeFilterString = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toSurveyAggregate = (row: NormalizedSurveyAnalysisRow): SurveyAggregate => {
  const { question_type_distribution: _distribution, ...aggregate } = row;
  return aggregate;
};

interface NormalizedFilters {
  year: number | null;
  round: number | null;
  courseName: string | null;
  instructorId: string | null;
  includeTestData: boolean;
}

const matchesInstructor = (aggregate: SurveyAggregate, instructorId: string | null): boolean => {
  if (!instructorId) {
    return true;
  }

  const normalizedInstructor = instructorId.trim();
  if (normalizedInstructor.length === 0) {
    return true;
  }

  if (aggregate.instructor_id && aggregate.instructor_id.trim() === normalizedInstructor) {
    return true;
  }

  return aggregate.instructor_ids.some((id) => id.trim() === normalizedInstructor);
};

const courseNamesMatch = (left: string | null | undefined, right: string | null | undefined): boolean => {
  if (!left || !right) {
    return !left && !right;
  }

  const normalizedLeft = left.trim();
  const normalizedRight = right.trim();

  if (!normalizedLeft || !normalizedRight) {
    return normalizedLeft === normalizedRight;
  }

  return normalizedLeft.localeCompare(normalizedRight, 'ko', { sensitivity: 'base' }) === 0;
};

const filterAggregatesList = (
  aggregates: SurveyAggregate[],
  { year, round, courseName, instructorId, includeTestData }: NormalizedFilters,
): SurveyAggregate[] =>
  aggregates.filter((aggregate) => {
    if (year !== null && aggregate.education_year !== year) {
      return false;
    }

    if (round !== null && aggregate.education_round !== round) {
      return false;
    }

    if (courseName && !courseNamesMatch(aggregate.course_name, courseName)) {
      return false;
    }

    if (!matchesInstructor(aggregate, instructorId)) {
      return false;
    }

    if (!includeTestData && aggregate.is_test === true) {
      return false;
    }

    return true;
  });

const fetchAggregatesFromLegacyView = async ({
  year,
  round,
  courseName,
  instructorId,
  includeTestData,
}: NormalizedFilters): Promise<SurveyAggregate[]> => {
  let query = supabase
    .from('survey_aggregates')
    .select(
      `survey_id, title, education_year, education_round, course_name, status, instructor_id, instructor_name, expected_participants, is_test, response_count, last_response_at, avg_overall_satisfaction, avg_course_satisfaction, avg_instructor_satisfaction, avg_operation_satisfaction`,
    )
    .order('education_year', { ascending: false })
    .order('education_round', { ascending: false })
    .order('title', { ascending: true });

  if (year !== null) {
    query = query.eq('education_year', year);
  }

  if (round !== null) {
    query = query.eq('education_round', round);
  }

  if (!includeTestData) {
    query = query.or('is_test.eq.false,is_test.is.null');
  }

  if (courseName) {
    query = query.eq('course_name', courseName);
  }

  if (instructorId) {
    query = query.eq('instructor_id', instructorId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const normalized = normalizeSurveyAnalysisRows(data as SurveyAnalysisRow[]);
  return normalized.map(toSurveyAggregate);
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
    const normalizedYear = typeof year === 'number' && !Number.isNaN(year) ? year : null;
    const normalizedRound = typeof round === 'number' && !Number.isNaN(round) ? round : null;
    const sanitizedCourseFilter = normalizeFilterString(courseName);

    const rawInstructorFilter = normalizeFilterString(instructorId);
    const rawRestrictedInstructor = normalizeFilterString(restrictToInstructorId);
    const filterInstructorId = rawRestrictedInstructor ?? rawInstructorFilter;
    const rpcInstructorId = normalizeUuid(filterInstructorId ?? null) ?? normalizeUuid(rawInstructorFilter ?? null);

    const filters: NormalizedFilters = {
      year: normalizedYear,
      round: normalizedRound,
      courseName: sanitizedCourseFilter,
      instructorId: filterInstructorId,
      includeTestData,
    };

    const payload: Database['public']['Functions']['get_survey_analysis']['Args'] = {
      p_include_test: includeTestData,
    };

    if (normalizedYear !== null) {
      payload.p_year = normalizedYear;
    }

    if (normalizedRound !== null) {
      payload.p_round = normalizedRound;
    }

    if (sanitizedCourseFilter) {
      payload.p_course_name = sanitizedCourseFilter;
    }

    if (rpcInstructorId) {
      payload.p_instructor_id = rpcInstructorId;
    }

    const loadAggregatesFromRpc = async (): Promise<SurveyAggregate[]> => {
      const { data, error } = await supabase.rpc('get_survey_analysis', payload);

      if (error) {
        throw error;
      }

      const normalized = normalizeSurveyAnalysisRows(data);
      return normalized.map(toSurveyAggregate);
    };

    let aggregates: SurveyAggregate[] = [];
    let usedLegacyFallback = false;

    try {
      aggregates = await loadAggregatesFromRpc();
    } catch (rpcError) {
      console.error('Failed to execute get_survey_analysis RPC, falling back to survey_aggregates view', rpcError);
      aggregates = await fetchAggregatesFromLegacyView(filters);
      usedLegacyFallback = true;
    }

    if (!usedLegacyFallback && aggregates.length === 0) {
      console.warn('get_survey_analysis RPC returned no aggregates, verifying via survey_aggregates view');
      aggregates = await fetchAggregatesFromLegacyView(filters);
      usedLegacyFallback = true;
    }

    const hasMeaningfulFilter =
      filters.year !== null
      || filters.round !== null
      || Boolean(filters.courseName)
      || Boolean(filters.instructorId);

    let filteredAggregates = filterAggregatesList(aggregates, filters);

    if (!usedLegacyFallback && filteredAggregates.length === 0 && hasMeaningfulFilter) {
      console.warn('Filtered aggregates empty after RPC call, retrying via survey_aggregates view');
      const legacyAggregates = await fetchAggregatesFromLegacyView(filters);
      filteredAggregates = filterAggregatesList(legacyAggregates, filters);
      usedLegacyFallback = true;
    }

    const summary = calculateSummary(filteredAggregates);

    return {
      aggregates: filteredAggregates,
      summary,
    };
  },
};

