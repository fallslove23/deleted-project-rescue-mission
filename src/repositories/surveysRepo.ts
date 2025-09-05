// Repository for fetching surveys list and available years from Supabase views
import { supabase } from "@/integrations/supabase/client";

export type SurveyListItem = {
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
  creator_email: string | null;
  instructor_name: string | null;
  course_title: string | null;
};

export type SurveyFilters = {
  year: number | null;
  status: 'draft' | 'active' | 'public' | 'completed' | null;
};

export type PaginatedSurveyResult = {
  data: SurveyListItem[];
  count: number;
  totalPages: number;
};

export class SurveysRepository {
  static async fetchSurveyList(
    page: number,
    pageSize: number,
    filters: SurveyFilters
  ): Promise<PaginatedSurveyResult> {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('surveys_list_v1')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filters.year !== null) {
      query = query.eq('education_year', filters.year);
    }
    if (filters.status !== null) {
      query = query.eq('status', filters.status);
    }

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    const safeData: SurveyListItem[] = (data ?? []) as unknown as SurveyListItem[];
    const totalCount = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    return {
      data: safeData,
      count: totalCount,
      totalPages,
    };
  }

  static async getAvailableYears(): Promise<number[]> {
    const { data, error } = await supabase
      .from('survey_available_years_v1')
      .select('education_year')
      .order('education_year', { ascending: false });

    if (error) {
      throw error;
    }

    const years = (data ?? []) as { education_year: number | null }[];
    return years
      .map((row) => row.education_year)
      .filter((y): y is number => typeof y === 'number');
  }
}
