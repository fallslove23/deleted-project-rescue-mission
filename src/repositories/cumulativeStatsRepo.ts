import { supabase } from '@/integrations/supabase/client';

export type SurveyCumulativeRow = any;
type SurveyCumulativeQueryBuilder = any;

export interface CumulativeStatsQuery {
  page: number;
  pageSize: number;
  searchTerm?: string | null;
  educationYear?: number | null;
  courseName?: string | null;
  includeTestData: boolean;
}

export interface CumulativeStatsResult {
  data: SurveyCumulativeRow[];
  count: number;
}

export interface CumulativeSummary {
  totalSurveys: number;
  totalResponses: number;
  averageSatisfaction: number | null;
  participatingInstructors: number;
  coursesInProgress: number;
}

export interface CumulativeFilterResult {
  years: number[];
  allCourses: string[];
  coursesByYear: Record<number, string[]>;
}

function applyFilters(
  query: any,
  {
    searchTerm,
    educationYear,
    courseName,
    includeTestData,
  }: Pick<CumulativeStatsQuery, 'searchTerm' | 'educationYear' | 'courseName' | 'includeTestData'>
) {
  let filtered = query;

  if (!includeTestData) {
    filtered = filtered.or('is_test.eq.false,is_test.is.null');
  }

  if (educationYear !== null && educationYear !== undefined) {
    filtered = filtered.eq('education_year', educationYear);
  }

  if (courseName !== null && courseName !== undefined) {
    filtered = filtered.eq('course_name', courseName);
  }

  if (searchTerm && searchTerm.trim()) {
    const like = `%${searchTerm.trim()}%`;
    filtered = filtered.or(`title.ilike.${like},course_name.ilike.${like}`);
  }

  return filtered;
}

export async function fetchCumulativeStats({
  page,
  pageSize,
  searchTerm,
  educationYear,
  courseName,
  includeTestData,
}: CumulativeStatsQuery): Promise<CumulativeStatsResult> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  let query = supabase
    .from('surveys')
    .select('id, title, education_year, education_round, course_name, created_at, updated_at', { count: 'exact' })
    .order('education_year', { ascending: false })
    .order('education_round', { ascending: false })
    .order('title', { ascending: true });

  query = applyFilters(query, {
    searchTerm,
    educationYear,
    courseName,
    includeTestData,
  });

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  return {
    data: data ?? [],
    count: count ?? 0,
  };
}

export async function fetchCumulativeSummary(): Promise<CumulativeSummary | null> {
  try {
    const { data, error } = await supabase.rpc('get_survey_cumulative_summary');

    if (error) {
      console.error('Error fetching cumulative summary:', error);
      return null;
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return {
        totalSurveys: 0,
        totalResponses: 0,
        averageSatisfaction: null,
        participatingInstructors: 0,
        coursesInProgress: 0,
      };
    }

    const summaryData = data[0] as any;
    return {
      totalSurveys: summaryData?.total_surveys || 0,
      totalResponses: summaryData?.total_responses || 0,
      averageSatisfaction: summaryData?.average_satisfaction || null,
      participatingInstructors: summaryData?.participating_instructors || 0,
      coursesInProgress: summaryData?.courses_in_progress || 0,
    };
  } catch (error) {
    console.error('Error in fetchCumulativeSummary:', error);
    return null;
  }
}

export async function fetchCumulativeFilters(includeTestData: boolean): Promise<CumulativeFilterResult> {
  try {
    let query = supabase
      .from('surveys')
      .select('education_year, course_name, is_test')
      .order('education_year', { ascending: false })
      .order('course_name', { ascending: true });

    if (!includeTestData) {
      query = query.or('is_test.eq.false,is_test.is.null');
    }

    const { data, error } = await query;
    if (error) throw error;

    const yearSet = new Set<number>();
    const courseMap = new Map<number, Set<string>>();
    const allCoursesSet = new Set<string>();

    (data ?? []).forEach((row: any) => {
      if (row.education_year !== null && row.education_year !== undefined) {
        yearSet.add(row.education_year);
        if (!courseMap.has(row.education_year)) {
          courseMap.set(row.education_year, new Set<string>());
        }

        if (row.course_name) {
          courseMap.get(row.education_year)?.add(row.course_name);
        }
      }

      if (row.course_name) {
        allCoursesSet.add(row.course_name);
      }
    });

    const coursesByYear: Record<number, string[]> = {};
    courseMap.forEach((courses, year) => {
      coursesByYear[year] = Array.from(courses).sort((a, b) => a.localeCompare(b));
    });

    return {
      years: Array.from(yearSet).sort((a, b) => b - a),
      allCourses: Array.from(allCoursesSet).sort((a, b) => a.localeCompare(b)),
      coursesByYear,
    };
  } catch (error) {
    console.error('Error in fetchCumulativeFilters:', error);
    return {
      years: [],
      allCourses: [],
      coursesByYear: {},
    };
  }
}

export async function fetchCumulativeExportData(
  params: Omit<CumulativeStatsQuery, 'page' | 'pageSize'> & { pageSize?: number }
): Promise<SurveyCumulativeRow[]> {
  const {
    searchTerm,
    educationYear,
    courseName,
    includeTestData,
    pageSize: requestedPageSize,
  } = params;

  const pageSize = Math.max(50, requestedPageSize ?? 200);
  let page = 1;
  let hasMore = true;
  const results: SurveyCumulativeRow[] = [];

  while (hasMore) {
    const { data, count } = await fetchCumulativeStats({
      page,
      pageSize,
      searchTerm,
      educationYear,
      courseName,
      includeTestData,
    });

    results.push(...data);

    const expectedTotal = count ?? results.length;
    hasMore = results.length < expectedTotal && data.length === pageSize;
    page += 1;

    if (!data.length) {
      break;
    }
  }

  return results;
}