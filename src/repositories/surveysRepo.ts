import { supabase } from "@/integrations/supabase/client";

export interface SurveyListItem {
  id: string;
  title: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  education_year: number | null;
  education_round: number | null;
  education_day: number | null;
  status: string | null;
  course_name: string | null;
  is_combined: boolean | null;
  combined_round_start: number | null;
  combined_round_end: number | null;
  round_label: string | null;
  template_id: string | null;
  expected_participants: number | null;
  is_test: boolean | null;
  created_by: string | null;
  instructor_id: string | null;
  course_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  creator_email: string | null;
  instructor_name: string | null;
  course_title: string | null;
}

export interface SurveyFilters {
  year: number | null;
  status: 'draft' | 'active' | 'public' | 'completed' | null;
}

export interface PaginatedSurveyResult {
  data: SurveyListItem[];
  count: number;       // total rows
  totalPages: number;  // ceil(count / pageSize)
}

export class SurveysRepository {
  static async fetchSurveyList(
    page: number, 
    pageSize: number, 
    filters: SurveyFilters
  ): Promise<PaginatedSurveyResult> {
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      let query = supabase
        .from('surveys_list_v1')
        .select('*', { count: 'exact' });

      // 연도 필터 적용
      if (filters.year && filters.year > 0) {
        query = query.eq('education_year', filters.year);
      }

      // 상태 필터 적용
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      // 정렬 및 페이지네이션
      query = query
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('Survey fetch error:', error);
        throw new Error(`설문 목록을 가져오는데 실패했습니다: ${error.message}`);
      }

      const totalPages = count ? Math.ceil(count / pageSize) : 0;

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
        .from('survey_available_years_v1')
        .select('education_year')
        .order('education_year', { ascending: false });

      if (error) {
        console.error('Years fetch error:', error);
        return [];
      }

      return data?.map(item => item.education_year).filter(year => year !== null) || [];
    } catch (error) {
      console.error('Years fetch error:', error);
      return [];
    }
  }
}