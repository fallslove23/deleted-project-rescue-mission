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
    // Temporarily return mock data until proper RPC function is implemented
    console.log('Course report filters:', filters);

    const summary = {
      educationYear: filters.year,
      courseName: filters.courseName,
      normalizedCourseName: filters.courseName,
      educationRound: filters.round,
      instructorId: filters.instructorId,
      availableRounds: [],
      totalSurveys: 0,
      totalResponses: 0,
      avgInstructorSatisfaction: null,
      avgCourseSatisfaction: null,
      avgOperationSatisfaction: null,
      instructorCount: 0,
    } satisfies CourseReportSummary;

    const trend: CourseTrendPoint[] = [];

    const instructorStats: CourseInstructorStat[] = [];

    const textualResponses: string[] = [];

    const availableCourses: CourseOption[] = [];

    const availableInstructors = [];

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
