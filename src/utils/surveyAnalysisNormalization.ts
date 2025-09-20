import type { Database } from '@/integrations/supabase/types';

export type SurveyAnalysisRow = Database['public']['Functions']['get_survey_analysis']['Returns'][number];

export interface QuestionTypeDistributionItem {
  question_type: string;
  response_count: number;
}

export interface NormalizedSurveyAnalysisRow {
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
  question_type_distribution: QuestionTypeDistributionItem[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getFromRecord = (record: Record<string, unknown> | null | undefined, key: string): unknown =>
  record && Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;

const parseJsonObject = (value: unknown): Record<string, unknown> | null => {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    return isRecord(parsed) ? parsed : null;
  } catch (error) {
    console.warn('Failed to parse JSON object field', error, value);
    return null;
  }
};

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number') {
    return Number.isNaN(value) ? fallback : value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
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
          const nameOrId = toNullableString(item.id) ?? toNullableString(item.name);
          return nameOrId;
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
          return toStringArray(parsed);
        }
      } catch (error) {
        console.warn('Failed to parse stringified array field', error, value);
      }
    }
    return trimmed.length > 0 ? [trimmed] : [];
  }
  return [];
};

const parseQuestionTypeDistribution = (value: unknown): QuestionTypeDistributionItem[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (isRecord(item)) {
          const type = toNullableString(item.question_type) ?? toNullableString(item.type);
          const count = toNumber(item.response_count ?? item.count ?? item.total ?? 0, 0);
          return {
            question_type: type ?? 'unknown',
            response_count: count,
          } satisfies QuestionTypeDistributionItem;
        }
        if (typeof item === 'string') {
          const trimmed = item.trim();
          return trimmed.length > 0
            ? ({ question_type: trimmed, response_count: 0 } satisfies QuestionTypeDistributionItem)
            : null;
        }
        return null;
      })
      .filter((item): item is QuestionTypeDistributionItem => item !== null);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parseQuestionTypeDistribution(parsed);
    } catch (error) {
      console.warn('Failed to parse question type distribution string', error, value);
      return [];
    }
  }
  if (isRecord(value)) {
    return Object.entries(value).map(([key, count]) => ({
      question_type: key,
      response_count: toNumber(count, 0),
    }));
  }
  return [];
};

const buildInstructorLists = (
  rowRecord: Record<string, unknown>,
  surveyInfo: Record<string, unknown> | null,
): {
  instructorId: string | null;
  instructorName: string | null;
  instructorIds: string[];
  instructorNames: string[];
} => {
  const instructorIds = new Set<string>();
  const instructorNames = new Map<string, string>();
  const fallbackNames = new Set<string>();

  const pickValue = (key: string): unknown => {
    const direct = getFromRecord(rowRecord, key);
    if (direct !== undefined && direct !== null) {
      return direct;
    }
    return getFromRecord(surveyInfo, key);
  };

  const addInstructor = (id: string | null, name: string | null) => {
    const trimmedId = id?.trim();
    const trimmedName = name?.trim() ?? null;

    if (trimmedId) {
      instructorIds.add(trimmedId);
      if (trimmedName) {
        instructorNames.set(trimmedId, trimmedName);
      }
      return;
    }

    if (trimmedName) {
      fallbackNames.add(trimmedName);
    }
  };

  const directInstructorId = toNullableString(pickValue('instructor_id'));
  const directInstructorName = toNullableString(pickValue('instructor_name'));
  addInstructor(directInstructorId, directInstructorName);

  const rawInstructorIds = [
    getFromRecord(rowRecord, 'instructor_ids'),
    getFromRecord(surveyInfo, 'instructor_ids'),
  ];
  rawInstructorIds.forEach((value) => {
    toStringArray(value).forEach((id) => addInstructor(id, null));
  });

  const rawInstructorNames = [
    getFromRecord(rowRecord, 'instructor_names'),
    getFromRecord(surveyInfo, 'instructor_names'),
  ];

  rawInstructorNames.forEach((value) => {
    const names = toStringArray(value);
    if (names.length === 0) {
      return;
    }
    const idsArray = Array.from(instructorIds);
    names.forEach((name, index) => {
      const relatedId = idsArray[index] ?? null;
      addInstructor(relatedId, name);
    });
  });

  const rawInstructorObjects = [
    getFromRecord(rowRecord, 'instructors'),
    getFromRecord(surveyInfo, 'instructors'),
    getFromRecord(rowRecord, 'instructor_info'),
    getFromRecord(surveyInfo, 'instructor_info'),
  ];

  rawInstructorObjects.forEach((value) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (isRecord(item)) {
          addInstructor(toNullableString(item.id), toNullableString(item.name));
        }
      });
    } else if (isRecord(value)) {
      addInstructor(toNullableString(value.id), toNullableString(value.name));
      const ids = toStringArray(value.instructor_ids);
      const names = toStringArray(value.instructor_names);
      ids.forEach((id, index) => {
        addInstructor(id, names[index] ?? null);
      });
    }
  });

  const instructorIdsList = Array.from(instructorIds);
  const instructorNamesList = instructorIdsList.map(
    (id) => instructorNames.get(id) ?? '강사 정보 없음',
  );

  if (instructorIdsList.length === 0 && fallbackNames.size > 0) {
    instructorNamesList.push(...Array.from(fallbackNames));
  }

  const resolvedName =
    instructorNames.get(directInstructorId ?? '')
    ?? directInstructorName
    ?? instructorNamesList[0]
    ?? (instructorIdsList.length > 0 ? '강사 정보 없음' : null);

  return {
    instructorId: instructorIdsList[0] ?? directInstructorId ?? null,
    instructorName: resolvedName,
    instructorIds: instructorIdsList.length > 0
      ? instructorIdsList
      : directInstructorId
        ? [directInstructorId]
        : [],
    instructorNames: instructorIdsList.length > 0
      ? instructorNamesList
      : resolvedName
        ? [resolvedName]
        : [],
  };
};

export const normalizeSurveyAnalysisRows = (
  rows: SurveyAnalysisRow[] | null | undefined,
): NormalizedSurveyAnalysisRow[] => {
  if (!rows) return [];

  const normalized = rows.map((row) => {
    const rowRecord = isRecord(row) ? row : {};
    const surveyInfo = parseJsonObject(getFromRecord(rowRecord, 'survey_info'));
    const satisfactionScores = parseJsonObject(getFromRecord(rowRecord, 'satisfaction_scores'));

    const pickValue = (key: string): unknown => {
      const direct = getFromRecord(rowRecord, key);
      if (direct !== undefined && direct !== null) {
        return direct;
      }
      return getFromRecord(surveyInfo, key);
    };

    const description = toNullableString(pickValue('description'));
    const educationYear = toNullableNumber(pickValue('education_year'));
    const educationRound = toNullableNumber(pickValue('education_round'));
    const courseName = toNullableString(pickValue('course_name'));
    const status = toNullableString(pickValue('status'));

    const {
      instructorId,
      instructorName,
      instructorIds,
      instructorNames,
    } = buildInstructorLists(rowRecord, surveyInfo);

    const expectedParticipants = toNullableNumber(pickValue('expected_participants'));
    const isTest = toNullableBoolean(pickValue('is_test'));
    const responseCount = toNumber(pickValue('response_count'), 0);
    const lastResponseAt = toNullableString(pickValue('last_response_at'));

    const avgCourse = toNullableNumber(pickValue('avg_course_satisfaction'));
    const avgInstructor = toNullableNumber(pickValue('avg_instructor_satisfaction'));
    const avgOperation = toNullableNumber(pickValue('avg_operation_satisfaction'));

    let avgOverall = toNullableNumber(pickValue('avg_overall_satisfaction'));
    if (avgOverall === null) {
      const legacyOverall = toNullableNumber(
        getFromRecord(satisfactionScores, 'overall_satisfaction'),
      );
      if (legacyOverall !== null) {
        avgOverall = legacyOverall;
      }
    }

    if (avgOverall === null) {
      const components = [avgCourse, avgInstructor, avgOperation].filter(
        (value): value is number => value !== null,
      );
      if (components.length > 0) {
        avgOverall = components.reduce((sum, value) => sum + value, 0) / components.length;
      }
    }

    const questionCountRaw = pickValue('question_count');
    const questionTypeDistribution = parseQuestionTypeDistribution(
      pickValue('question_type_distribution'),
    );
    const questionCount = toNumber(questionCountRaw, questionTypeDistribution.length);

    const surveyId = toNullableString(pickValue('survey_id')) ?? '';
    const title = toNullableString(pickValue('title')) ?? '제목 없음';

    return {
      survey_id: surveyId,
      title,
      description,
      education_year: educationYear,
      education_round: educationRound,
      course_name: courseName,
      status,
      instructor_id: instructorId,
      instructor_name: instructorName,
      instructor_ids: instructorIds,
      instructor_names: instructorNames,
      expected_participants: expectedParticipants,
      is_test: isTest,
      response_count: responseCount,
      last_response_at: lastResponseAt,
      avg_overall_satisfaction: avgOverall,
      avg_course_satisfaction: avgCourse,
      avg_instructor_satisfaction: avgInstructor,
      avg_operation_satisfaction: avgOperation,
      question_count: questionCount,
      question_type_distribution: questionTypeDistribution,
    } satisfies NormalizedSurveyAnalysisRow;
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
