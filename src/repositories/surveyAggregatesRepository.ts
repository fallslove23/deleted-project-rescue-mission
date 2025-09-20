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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getFromRecord = (record: Record<string, unknown> | null | undefined, key: string): unknown =>
  record && Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;

const pickValue = (
  keys: string[],
  records: Array<Record<string, unknown> | null | undefined>,
): unknown => {
  for (const record of records) {
    if (!record) continue;
    for (const key of keys) {
      const value = getFromRecord(record, key);
      if (value !== undefined && value !== null) {
        return value;
      }
    }
  }
  return undefined;
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
        if (typeof item === 'string') {
          const trimmed = item.trim();
          return trimmed.length > 0 ? trimmed : null;
        }
        if (isRecord(item)) {
          const id = toNullableString(item.id);
          return id;
        }
        return null;
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
              if (typeof item === 'string') {
                const parsedTrimmed = item.trim();
                return parsedTrimmed.length > 0 ? parsedTrimmed : null;
              }
              if (isRecord(item)) {
                const id = toNullableString(item.id);
                return id;
              }
              return null;
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
    const rowRecord = isRecord(row) ? row : {};
    const surveyInfoRaw = getFromRecord(rowRecord, 'survey_info');
    const surveyInfo = isRecord(surveyInfoRaw) ? surveyInfoRaw : null;
    const satisfactionScoresRaw = getFromRecord(rowRecord, 'satisfaction_scores');
    const satisfactionScores = isRecord(satisfactionScoresRaw) ? satisfactionScoresRaw : null;
    const metricsRaw = getFromRecord(rowRecord, 'metrics');
    const metrics = isRecord(metricsRaw) ? metricsRaw : null;
    const responseStatsRaw = getFromRecord(rowRecord, 'response_statistics');
    const responseStats = isRecord(responseStatsRaw) ? responseStatsRaw : null;
    const questionStatsRaw = getFromRecord(rowRecord, 'question_stats');
    const questionStats = isRecord(questionStatsRaw) ? questionStatsRaw : null;
    const instructorInfoRaw = getFromRecord(rowRecord, 'instructor_info');
    const instructorInfo = isRecord(instructorInfoRaw) ? instructorInfoRaw : null;
    const instructorsRaw = getFromRecord(rowRecord, 'instructors');

    const pick = (keys: string[], extraRecords: Array<Record<string, unknown> | null | undefined> = []) =>
      pickValue(keys, [rowRecord, surveyInfo, metrics, ...extraRecords]);

    const surveyIdRaw = pick(['survey_id', 'id']);
    const titleRaw = pick(['title', 'survey_title']);
    const descriptionRaw = pick(['description']);
    const educationYearRaw = pick(['education_year', 'year']);
    const educationRoundRaw = pick(['education_round', 'round']);
    const courseNameRaw = pick(['course_name', 'course']);
    const statusRaw = pick(['status']);
    const instructorIdRaw = pick(['instructor_id', 'primary_instructor_id'], [instructorInfo]);
    const instructorNameRaw = pick(['instructor_name', 'primary_instructor_name'], [instructorInfo]);
    const expectedParticipantsRaw = pick(['expected_participants']);
    const isTestRaw = pick(['is_test', 'test']);
    const lastResponseRaw = pick(['last_response_at', 'last_response'], [responseStats]);
    const questionCountCandidate = pick(
      ['question_count', 'questions_count', 'total_questions'],
      [questionStats],
    );

    const responseCountCandidate = pick(
      ['response_count', 'responses_count', 'total_responses'],
      [responseStats],
    );

    const getSatisfactionValue = (modernKey: string, legacyKey: string) => {
      const direct = pick([modernKey], [metrics]);
      if (direct !== undefined && direct !== null) {
        return direct;
      }
      const legacy = getFromRecord(satisfactionScores, legacyKey);
      return legacy !== undefined && legacy !== null ? legacy : undefined;
    };

    const avgCourseRaw = getSatisfactionValue('avg_course_satisfaction', 'course_satisfaction');
    const avgInstructorRaw = getSatisfactionValue('avg_instructor_satisfaction', 'instructor_satisfaction');
    const avgOperationRaw = getSatisfactionValue('avg_operation_satisfaction', 'operation_satisfaction');

    const avgOverallCandidate = pick(['avg_overall_satisfaction'], [metrics]);
    const avgOverallLegacy = getFromRecord(satisfactionScores, 'overall_satisfaction');

    const baseInstructorIds = toStringArray(pick(['instructor_ids'], [instructorInfo]));
    const baseInstructorNames = toStringArray(pick(['instructor_names'], [instructorInfo]));

    const instructorIds = new Set<string>();
    const instructorNamesMap = new Map<string, string>();
    const fallbackNames: string[] = [];

    const addInstructor = (id: string | null, name: string | null) => {
      const trimmedId = id?.trim();
      const trimmedName = name?.trim() ?? null;
      if (trimmedId) {
        if (!instructorIds.has(trimmedId)) {
          instructorIds.add(trimmedId);
        }
        if (trimmedName) {
          instructorNamesMap.set(trimmedId, trimmedName);
        }
      } else if (trimmedName) {
        fallbackNames.push(trimmedName);
      }
    };

    const appendIdList = (values: string[]) => {
      values.forEach((value) => {
        if (value.trim().length > 0) {
          instructorIds.add(value.trim());
        }
      });
    };

    appendIdList(toStringArray(rowRecord.instructor_ids));
    appendIdList(baseInstructorIds);

    const instructorNameList = toStringArray(rowRecord.instructor_names);
    const combinedNameList = instructorNameList.length > 0 ? instructorNameList : baseInstructorNames;

    combinedNameList.forEach((name, index) => {
      const relatedId = Array.from(instructorIds)[index] ?? null;
      addInstructor(relatedId, name);
    });

    if (Array.isArray(instructorsRaw)) {
      instructorsRaw.forEach((item) => {
        if (isRecord(item)) {
          const id = toNullableString(item.id);
          const name = toNullableString(item.name);
          addInstructor(id, name);
        }
      });
    }

    const instructorId = toNullableString(instructorIdRaw) ?? Array.from(instructorIds)[0] ?? null;
    const primaryInstructorName = toNullableString(instructorNameRaw);

    if (primaryInstructorName && instructorId) {
      instructorNamesMap.set(instructorId, primaryInstructorName);
    }

    const sortedInstructorIds = Array.from(instructorIds);
    const instructorNames = sortedInstructorIds.map(
      (id) => instructorNamesMap.get(id) ?? primaryInstructorName ?? '강사 정보 없음',
    );

    if (sortedInstructorIds.length === 0 && combinedNameList.length > 0) {
      fallbackNames.push(...combinedNameList);
    }

    const resolvedInstructorName = primaryInstructorName
      ?? (sortedInstructorIds.length > 0
        ? instructorNamesMap.get(sortedInstructorIds[0]) ?? '강사 정보 없음'
        : fallbackNames[0] ?? null);

    const instructorNamesFinal = sortedInstructorIds.length > 0
      ? instructorNames
      : fallbackNames;

    let avgOverall = toNullableNumber(avgOverallCandidate ?? avgOverallLegacy ?? null);
    const avgCourse = toNullableNumber(avgCourseRaw);
    const avgInstructor = toNullableNumber(avgInstructorRaw);
    const avgOperation = toNullableNumber(avgOperationRaw);
    if (avgOverall === null) {
      const components = [avgCourse, avgInstructor, avgOperation].filter(
        (value): value is number => value !== null,
      );
      if (components.length > 0) {
        avgOverall = components.reduce((sum, value) => sum + value, 0) / components.length;
      }
    }

    const responseCount = toNumber(responseCountCandidate, 0);
    const questionCount = toNumber(questionCountCandidate, 0);

    return {
      survey_id: typeof surveyIdRaw === 'string' && surveyIdRaw.trim().length > 0 ? surveyIdRaw : '',
      title: typeof titleRaw === 'string' && titleRaw.trim().length > 0 ? titleRaw : '제목 없음',
      description: toNullableString(descriptionRaw),
      education_year: toNullableNumber(educationYearRaw),
      education_round: toNullableNumber(educationRoundRaw),
      course_name: toNullableString(courseNameRaw),
      status: toNullableString(statusRaw),
      instructor_id: instructorId,
      instructor_name: resolvedInstructorName,
      instructor_ids: sortedInstructorIds.length > 0
        ? sortedInstructorIds
        : instructorId
          ? [instructorId]
          : [],
      instructor_names: instructorNamesFinal.length > 0
        ? instructorNamesFinal
        : resolvedInstructorName
          ? [resolvedInstructorName]
          : [],
      expected_participants: toNullableNumber(expectedParticipantsRaw),
      is_test: toNullableBoolean(isTestRaw),
      response_count: responseCount,
      last_response_at: toNullableString(lastResponseRaw),
      avg_overall_satisfaction: avgOverall,
      avg_course_satisfaction: avgCourse,
      avg_instructor_satisfaction: avgInstructor,
      avg_operation_satisfaction: avgOperation,
      question_count: questionCount,
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

    if (courseName) {
      const normalizedCourse = aggregate.course_name?.trim();
      if (!normalizedCourse || normalizedCourse !== courseName) {
        return false;
      }
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

  if (courseName) {
    query = query.eq('course_name', courseName);
  }

  if (!includeTestData) {
    query = query.or('is_test.eq.false,is_test.is.null');
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return normalizeSurveyAnalysisRows(data as SurveyAnalysisRow[]);
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
    const sanitizedInstructorFilter = normalizeUuid(instructorId ?? null);
    const sanitizedRestrictedInstructor = normalizeUuid(restrictToInstructorId ?? null);
    const instructorFilter = sanitizedRestrictedInstructor ?? sanitizedInstructorFilter;

    const filters: NormalizedFilters = {
      year: normalizedYear,
      round: normalizedRound,
      courseName: sanitizedCourseFilter,
      instructorId: instructorFilter,
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

    if (instructorFilter) {
      payload.p_instructor_id = instructorFilter;
    }

    let aggregates: SurveyAggregate[] = [];

    try {
      const { data, error } = await supabase.rpc('get_survey_analysis', payload);

      if (error) {
        throw error;
      }

      aggregates = normalizeSurveyAnalysisRows(data);
    } catch (rpcError) {
      console.error('Failed to execute get_survey_analysis RPC, falling back to survey_aggregates view', rpcError);
      aggregates = await fetchAggregatesFromLegacyView(filters);
    }

    const filteredAggregates = filterAggregatesList(aggregates, filters);
    const summary = calculateSummary(filteredAggregates);

    return {
      aggregates: filteredAggregates,
      summary,
    };
  },
};

