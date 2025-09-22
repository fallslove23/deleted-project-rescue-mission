import { supabase } from '@/integrations/supabase/client';
import { normalizeCourseName } from '@/utils/surveyStats';

export interface CourseReportFilters {
  year: number;
  courseName?: string | null;
  round?: number | null;
  instructorId?: string | null;
  includeTestData?: boolean;
}

export interface CourseReportSummary {
  educationYear: number;
  courseName: string | null;
  normalizedCourseName: string | null;
  educationRound: number | null;
  instructorId: string | null;
  availableRounds: number[];
  totalSurveys: number;
  totalResponses: number;
  avgInstructorSatisfaction: number | null;
  avgCourseSatisfaction: number | null;
  avgOperationSatisfaction: number | null;
  instructorCount: number;
}

export interface CourseTrendPoint {
  educationRound: number | null;
  avgInstructorSatisfaction: number | null;
  avgCourseSatisfaction: number | null;
  avgOperationSatisfaction: number | null;
  responseCount: number;
}

export interface CourseInstructorStat {
  instructorId: string | null;
  instructorName: string;
  surveyCount: number;
  responseCount: number;
  avgSatisfaction: number | null;
}

export interface CourseOption {
  normalizedName: string;
  displayName: string;
  rounds: number[];
}

export interface CourseReportStatisticsResponse {
  summary: CourseReportSummary;
  trend: CourseTrendPoint[];
  instructorStats: CourseInstructorStat[];
  textualResponses: string[];
  availableCourses: CourseOption[];
  availableInstructors: { id: string; name: string }[];
}

export const CourseReportsRepository = {
  async fetchStatistics(filters: CourseReportFilters): Promise<CourseReportStatisticsResponse | null> {
    const normalizedCourseName = normalizeCourseName(filters.courseName ?? null);

    const { data, error } = await supabase.rpc('course_report_statistics', {
      p_year: filters.year,
      p_course_name: normalizedCourseName,
      p_round: filters.round ?? null,
      p_instructor_id: filters.instructorId ?? null,
      p_include_test: filters.includeTestData ?? false,
    });

    if (error) {
      console.error('Failed to execute course_report_statistics RPC', error);
      throw error;
    }

    if (!data) {
      return null;
    }

    const toNumberOrNull = (value: unknown): number | null => {
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
      }
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      if (typeof value === 'bigint') {
        return Number(value);
      }
      return null;
    };

    const toNumberWithDefault = (value: unknown, defaultValue: number): number => {
      const parsed = toNumberOrNull(value);
      return parsed ?? defaultValue;
    };

    const toNumberArray = (value: unknown): number[] => {
      if (!Array.isArray(value)) {
        return [];
      }
      return value
        .map((item) => toNumberOrNull(item))
        .filter((item): item is number => item !== null);
    };

    const toStringOrNull = (value: unknown): string | null => {
      if (value === null || value === undefined) {
        return null;
      }
      if (typeof value === 'string') {
        return value;
      }
      return String(value);
    };

    const ensureObject = (value: unknown): Record<string, unknown> => {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          return {};
        }
        return ensureObject(value[0]);
      }
      if (value && typeof value === 'object') {
        return value as Record<string, unknown>;
      }
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
          }
        } catch (parseError) {
          console.warn('Failed to parse JSON object field from course report statistics', parseError, value);
        }
      }
      return {};
    };

    const ensureArray = (value: unknown): unknown[] => {
      if (Array.isArray(value)) {
        return value;
      }
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch (parseError) {
          console.warn('Failed to parse JSON array field from course report statistics', parseError, value);
        }
      }
      return [];
    };

    const rawData = ensureObject(data ?? {});
    const rawSummary = ensureObject(rawData.summary);

    const summary: CourseReportSummary = {
      educationYear: toNumberWithDefault(rawSummary.educationYear, filters.year),
      courseName: toStringOrNull(rawSummary.courseName),
      normalizedCourseName:
        toStringOrNull(rawSummary.normalizedCourseName) ?? normalizedCourseName,
      educationRound: toNumberOrNull(rawSummary.educationRound),
      instructorId: toStringOrNull(rawSummary.instructorId),
      availableRounds: toNumberArray(ensureArray(rawSummary.availableRounds)),
      totalSurveys: toNumberWithDefault(rawSummary.totalSurveys, 0),
      totalResponses: toNumberWithDefault(rawSummary.totalResponses, 0),
      avgInstructorSatisfaction: toNumberOrNull(rawSummary.avgInstructorSatisfaction),
      avgCourseSatisfaction: toNumberOrNull(rawSummary.avgCourseSatisfaction),
      avgOperationSatisfaction: toNumberOrNull(rawSummary.avgOperationSatisfaction),
      instructorCount: toNumberWithDefault(rawSummary.instructorCount, 0),
    };

    const rawTrend = ensureArray(rawData.trend);
    const trend: CourseTrendPoint[] = rawTrend.map((item) => {
      const point = (item as Record<string, unknown>) ?? {};
      return {
        educationRound: toNumberOrNull(point.educationRound),
        avgInstructorSatisfaction: toNumberOrNull(point.avgInstructorSatisfaction),
        avgCourseSatisfaction: toNumberOrNull(point.avgCourseSatisfaction),
        avgOperationSatisfaction: toNumberOrNull(point.avgOperationSatisfaction),
        responseCount: toNumberWithDefault(point.responseCount, 0),
      };
    });

    const rawInstructorStats = ensureArray(rawData.instructorStats);
    const instructorStats: CourseInstructorStat[] = rawInstructorStats.map((item) => {
      const stat = (item as Record<string, unknown>) ?? {};
      return {
        instructorId: toStringOrNull(stat.instructorId),
        instructorName: toStringOrNull(stat.instructorName) ?? '강사 정보 없음',
        surveyCount: toNumberWithDefault(stat.surveyCount, 0),
        responseCount: toNumberWithDefault(stat.responseCount, 0),
        avgSatisfaction: toNumberOrNull(stat.avgSatisfaction),
      };
    });

    const rawTextualResponses = ensureArray(rawData.textualResponses);
    const textualResponses: string[] = rawTextualResponses
      .map((item) => toStringOrNull(item))
      .filter((item): item is string => item !== null);

    const rawAvailableCourses = ensureArray(rawData.availableCourses);
    const availableCourses: CourseOption[] = rawAvailableCourses
      .map((item) => {
        const course = (item as Record<string, unknown>) ?? {};
        const normalizedName = toStringOrNull(course.normalizedName) ?? '';
        return {
          normalizedName,
          displayName: toStringOrNull(course.displayName) ?? normalizedName,
          rounds: toNumberArray(ensureArray(course.rounds)),
        };
      })
      .filter((course) => course.normalizedName.length > 0 || course.displayName.length > 0);

    const rawAvailableInstructors = ensureArray(rawData.availableInstructors);
    const availableInstructors = rawAvailableInstructors
      .map((item) => {
        const instructor = (item as Record<string, unknown>) ?? {};
        return {
          id: toStringOrNull(instructor.id) ?? '',
          name: toStringOrNull(instructor.name) ?? '',
        };
      })
      .filter((instructor) => instructor.id.length > 0);

    return {
      summary,
      trend,
      instructorStats,
      textualResponses,
      availableCourses,
      availableInstructors,
    };
  },
};
