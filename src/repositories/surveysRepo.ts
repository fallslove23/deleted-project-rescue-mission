// src/repositories/surveysRepo.ts
import { supabase } from '@/integrations/supabase/client';

export type SurveyListItem = {
  id: string;
  title: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  education_year: number | null;
  education_round: number | null;
  education_day: number | null;
  status: 'draft' | 'active' | 'public' | 'completed' | null;
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

// ✅ named export: 객체 리터럴로 고정
export const SurveysRepository = {
  async fetchSurveyList(
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

    if (filters.year !== null) query = query.eq('education_year', filters.year);
    if (filters.status !== null) query = query.eq('status', filters.status);

    const { data, error, count } = await query;
    if (error) throw error;

    const safeData = (data ?? []) as SurveyListItem[];
    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return { data: safeData, count: total, totalPages };
  },

  async getAvailableYears(): Promise<number[]> {
    const { data, error } = await supabase
      .from('survey_available_years_v1')
      .select('education_year');
    if (error) throw error;

    return (data ?? [])
      .map((r: any) => Number(r.education_year))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => b - a);
  },

  async getAvailableCourseKeys(year?: number): Promise<
    { year: number; round: number; course_name: string }[]
  > {
    let q = supabase
      .from('surveys')
      .select('education_year, education_round, course_name')
      .not('course_name', 'is', null);

    if (year) q = q.eq('education_year', year);

    const { data, error } = await q;
    if (error) throw error;

    const uniq = new Map<string, { year: number; round: number; course_name: string }>();
    (data ?? []).forEach((r: any) => {
      const key = `${r.education_year}-${r.education_round}-${r.course_name}`;
      if (!uniq.has(key)) {
        uniq.set(key, { year: r.education_year, round: r.education_round, course_name: r.course_name });
      }
    });

    return Array.from(uniq.values()).sort((a, b) =>
      a.year !== b.year ? b.year - a.year :
      a.round !== b.round ? a.round - b.round :
      a.course_name.localeCompare(b.course_name)
    );
  },

  async updateStatus(id: string, status: 'draft'|'active'|'public'|'completed') {
    const { error } = await supabase.from('surveys').update({ status }).eq('id', id);
    if (error) throw error;
  },

  async duplicateSurvey(id: string, titleSuffix = ' (복사본)') {
    const { data: src, error: e1 } = await supabase.from('surveys').select('*').eq('id', id).single();
    if (e1) throw e1;

    const payload: any = { ...src };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    payload.title = (src.title ?? '무제') + titleSuffix;
    payload.status = 'draft';

    const { data: created, error: e2 } = await supabase.from('surveys').insert([payload]).select().single();
    if (e2) throw e2;
    return created;
  },

  async deleteSurvey(id: string) {
    const { error } = await supabase.from('surveys').delete().eq('id', id);
    if (error) throw error;
  },
};
