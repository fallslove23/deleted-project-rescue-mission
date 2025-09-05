// src/repositories/surveysRepo.ts
import { supabase } from "@/integrations/supabase/client";

export type SortBy = "created_at" | "start_date" | "end_date";
export type SortDir = "asc" | "desc";

export interface SurveyListItem {
  id: string;
  title: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  education_year: number | null;
  education_round: number | null;
  education_day: number | null;
  status: "draft" | "active" | "public" | "completed" | null;
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
  status: "draft" | "active" | "public" | "completed" | null;
  q?: string | null;
  courseName?: string | null;
}

export interface PaginatedSurveyResult {
  data: SurveyListItem[];
  count: number;
  totalPages: number;
}

export interface QuickCreatePayload {
  education_year: number;
  education_round: number;
  education_day: number;
  course_name: string;
  template_id?: string | null;
}

export interface TemplateLite {
  id: string;
  name: string;
}

function nextDayBase(hour: number, minute = 0) {
  const now = new Date();
  const d = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    hour,
    minute,
    0,
    0
  );
  return d.toISOString();
}

export const SurveysRepository = {
  async fetchSurveyList(
    page: number,
    pageSize: number,
    filters: SurveyFilters,
    sortBy: SortBy = "created_at",
    sortDir: SortDir = "desc"
  ): Promise<PaginatedSurveyResult> {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from("surveys_list_v1").select("*", { count: "exact" });

    if (filters.year) query = query.eq("education_year", filters.year);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.courseName) query = query.eq("course_name", filters.courseName);

    if (filters.q && filters.q.trim()) {
      const like = `%${filters.q.trim()}%`;
      query = query.or(
        [
          `title.ilike.${like}`,
          `course_title.ilike.${like}`,
          `course_name.ilike.${like}`,
          `instructor_name.ilike.${like}`,
          `creator_email.ilike.${like}`,
        ].join(",")
      );
    }

    query = query.order(sortBy, { ascending: sortDir === "asc", nullsFirst: false });

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    return {
      data: (data || []) as SurveyListItem[],
      count: count || 0,
      totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
    };
  },

  async fetchByIds(ids: string[]): Promise<SurveyListItem[]> {
    if (ids.length === 0) return [];
    const { data, error } = await supabase.from("surveys_list_v1").select("*").in("id", ids);
    if (error) throw error;
    return (data || []) as SurveyListItem[];
  },

  async getAvailableYears(): Promise<number[]> {
    const { data, error } = await supabase
      .from("survey_available_years_v1")
      .select("education_year");
    if (error) throw error;
    return (data || []).map((d: any) => d.education_year);
  },

  async getAvailableCourseNames(year: number | null): Promise<string[]> {
    let q = supabase.from("surveys").select("course_name").not("course_name", "is", null);
    if (year) q = q.eq("education_year", year);
    const { data, error } = await q;
    if (error) throw error;
    const set = new Set<string>();
    (data || []).forEach((r: any) => r.course_name && set.add(r.course_name));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  },

  async listTemplates(): Promise<TemplateLite[]> {
    const { data, error } = await supabase
      .from("survey_templates")
      .select("id,name")
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data || []) as TemplateLite[];
  },

  async quickCreateSurvey(payload: QuickCreatePayload) {
    const title = `${payload.education_year}-${payload.course_name}-${payload.education_round}차-${payload.education_day}일차 설문`;

    const startISO = nextDayBase(9, 0);
    const endISO = nextDayBase(19, 0);

    const insertPayload: any = {
      title,
      description:
        "본 설문은 과목과 강사 만족도를 평가하기 위한 것입니다. 교육 품질 향상을 위해 모든 교육생께서 반드시 참여해 주시길 부탁드립니다.",
      start_date: startISO,
      end_date: endISO,
      education_year: payload.education_year,
      education_round: payload.education_round,
      education_day: payload.education_day,
      course_name: payload.course_name,
      status: "draft",
      template_id: payload.template_id ?? null,
    };

    const { data, error } = await supabase
      .from("surveys")
      .insert([insertPayload])
      .select()
      .single();
    if (error) throw error;
    return data as SurveyListItem;
  },

  async updateStatus(id: string, status: "draft" | "active" | "public" | "completed") {
    const { error } = await supabase.from("surveys").update({ status }).eq("id", id);
    if (error) throw error;
  },

  async updateStatusMany(ids: string[], status: "draft" | "active" | "public" | "completed") {
    const { error } = await supabase.from("surveys").update({ status }).in("id", ids);
    if (error) throw error;
  },

  async duplicateSurvey(id: string) {
    const { data: src, error: e1 } = await supabase.from("surveys").select("*").eq("id", id).single();
    if (e1) throw e1;

    const { data: created, error: e2 } = await supabase
      .from("surveys")
      .insert([
        {
          ...src,
          id: undefined,
          title: `${src.title || "무제"} (복사본)`,
          status: "draft",
          created_at: undefined,
          updated_at: undefined,
        },
      ])
      .select()
      .single();
    if (e2) throw e2;

    return created as SurveyListItem;
  },

  async duplicateMany(ids: string[]) {
    for (const id of ids) {
      try {
        await this.duplicateSurvey(id);
      } catch {}
    }
  },

  async deleteSurvey(id: string) {
    const { error } = await supabase.from("surveys").delete().eq("id", id);
    if (error) throw error;
  },

  async deleteMany(ids: string[]) {
    const { error } = await supabase.from("surveys").delete().in("id", ids);
    if (error) throw error;
  },
};
