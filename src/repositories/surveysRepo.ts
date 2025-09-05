import { supabase } from "@/integrations/supabase/client";

export interface SurveyListItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  education_year: number | null;
  education_round: number | null;
  course_name: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  expected_participants: number | null;
  education_day: number | null;
  is_test: boolean | null;
  instructor_id: string | null;
  course_id: string | null;
  created_by: string | null;
  creator_email: string;
  instructor_name: string;
  instructor_email: string;
  course_title: string;
}

export interface SurveyFilters {
  year?: number | null;
  status?: string | null;
}

export interface PaginatedSurveyResult {
  data: SurveyListItem[];
  count: number;
  totalPages: number;
}

export class SurveysRepository {
  static async fetchSurveyList(
    page: number = 1, 
    limit: number = 10, 
    filters: SurveyFilters = {}
  ): Promise<PaginatedSurveyResult> {
    try {
      let query = supabase
        .from('surveys_list_v1')
        .select('*', { count: 'exact' });

      // 연도 필터 적용
      if (filters.year && filters.year > 0) {
        query = query.eq('education_year', filters.year);
      }

      // 상태 필터 적용
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // 정렬 및 페이지네이션
      query = query
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Survey fetch error:', error);
        throw new Error(`설문 목록을 가져오는데 실패했습니다: ${error.message}`);
      }

      const totalPages = count ? Math.ceil(count / limit) : 0;

      return {
        data: data || [],
        count: count || 0,
        totalPages
      };
    } catch (error) {
      console.error('Repository error:', error);
      throw error;
    }
  }

  static async getAvailableYears(): Promise<number[]> {
    try {
      const { data, error } = await supabase
        .from('surveys_list_v1')
        .select('education_year')
        .not('education_year', 'is', null)
        .order('education_year', { ascending: false });

      if (error) {
        console.error('Years fetch error:', error);
        return [];
      }

      // 중복 제거
      const uniqueYears = [...new Set(data?.map(item => item.education_year) || [])];
      return uniqueYears.filter(year => year !== null) as number[];
    } catch (error) {
      console.error('Years fetch error:', error);
      return [];
    }
  }
}