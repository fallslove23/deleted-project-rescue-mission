import { supabase } from '@/integrations/supabase/client';

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
    const { data, error } = await supabase.rpc('course_report_statistics', {
      p_year: filters.year,
      p_course_name: filters.courseName ?? null,
      p_round: filters.round ?? null,
      p_instructor_id: filters.instructorId ?? null,
      p_include_test: filters.includeTestData ?? false,
    });

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const summary = {
      educationYear: data.summary?.educationYear ?? filters.year,
      courseName: data.summary?.courseName ?? null,
      normalizedCourseName: data.summary?.normalizedCourseName ?? null,
      educationRound: data.summary?.educationRound ?? null,
      instructorId: data.summary?.instructorId ?? null,
      availableRounds: Array.isArray(data.summary?.availableRounds)
        ? data.summary.availableRounds.filter((value: unknown): value is number => typeof value === 'number')
        : [],
      totalSurveys: Number(data.summary?.totalSurveys ?? 0),
      totalResponses: Number(data.summary?.totalResponses ?? 0),
      avgInstructorSatisfaction: data.summary?.avgInstructorSatisfaction ?? null,
      avgCourseSatisfaction: data.summary?.avgCourseSatisfaction ?? null,
      avgOperationSatisfaction: data.summary?.avgOperationSatisfaction ?? null,
      instructorCount: Number(data.summary?.instructorCount ?? 0),
    } satisfies CourseReportSummary;

    const trend: CourseTrendPoint[] = Array.isArray(data.trend)
      ? data.trend.map((item: any) => ({
          educationRound: typeof item.educationRound === 'number' ? item.educationRound : null,
          avgInstructorSatisfaction: typeof item.avgInstructorSatisfaction === 'number' ? item.avgInstructorSatisfaction : null,
          avgCourseSatisfaction: typeof item.avgCourseSatisfaction === 'number' ? item.avgCourseSatisfaction : null,
          avgOperationSatisfaction: typeof item.avgOperationSatisfaction === 'number' ? item.avgOperationSatisfaction : null,
          responseCount: Number(item.responseCount ?? 0),
        }))
      : [];

    const instructorStats: CourseInstructorStat[] = Array.isArray(data.instructorStats)
      ? data.instructorStats.map((item: any) => ({
          instructorId: typeof item.instructorId === 'string' || item.instructorId === null ? item.instructorId : String(item.instructorId ?? ''),
          instructorName: typeof item.instructorName === 'string' ? item.instructorName : '강사 정보 없음',
          surveyCount: Number(item.surveyCount ?? 0),
          responseCount: Number(item.responseCount ?? 0),
          avgSatisfaction: typeof item.avgSatisfaction === 'number' ? item.avgSatisfaction : null,
        }))
      : [];

    const textualResponses: string[] = Array.isArray(data.textualResponses)
      ? data.textualResponses.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];

    const availableCourses: CourseOption[] = Array.isArray(data.availableCourses)
      ? data.availableCourses
          .map((item: any) => ({
            normalizedName: typeof item.normalizedName === 'string' ? item.normalizedName : '',
            displayName: typeof item.displayName === 'string' ? item.displayName : '',
            rounds: Array.isArray(item.rounds)
              ? item.rounds.filter((value: unknown): value is number => typeof value === 'number')
              : [],
          }))
          .filter((item) => item.normalizedName.length > 0 || item.displayName.length > 0)
      : [];

    const availableInstructors = Array.isArray(data.availableInstructors)
      ? data.availableInstructors
          .map((item: any) => ({
            id: typeof item.id === 'string' ? item.id : String(item.id ?? ''),
            name: typeof item.name === 'string' ? item.name : '강사 정보 없음',
          }))
          .filter((item) => item.id && item.id !== 'null')
      : [];

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
