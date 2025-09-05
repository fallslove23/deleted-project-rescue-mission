// src/repositories/surveysRepo.ts
import { supabase } from "@/integrations/supabase/client";

/* util */
const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInputStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
const getDefaultStartEndLocal = () => {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const start = new Date(next);
  start.setHours(9, 0, 0, 0);
  const end = new Date(next);
  end.setHours(19, 0, 0, 0);
  return { startLocal: toLocalInputStr(start), endLocal: toLocalInputStr(end) };
};
const toISO = (local: string | null) =>
  local ? new Date(local).toISOString() : null;

/* ----------------------------- Types ------------------------------ */
export type SurveyListItem = {
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
};

export type SurveyFilters = {
  year: number | null;
  status: "draft" | "active" | "public" | "completed" | null;
  q?: string | null; // 🔍 추가
};

export type PaginatedSurveyResult = {
  data: SurveyListItem[];
  count: number;
  totalPages: number;
};

// Supabase .or 조건에 안전하게 쓰기 위한 이스케이프
function escapeOrValue(v: string) {
  // 쉼표, 괄호는 .or 문법과 충돌하므로 따옴표로 감싸는 대신 와일드카드에만 사용
  return v.replace(/[%_]/g, "\\$&");
}

/* ------------------------- SurveysRepository ---------------------- */
export const SurveysRepository = {
  async fetchSurveyList(
    page: number,
    pageSize: number,
    filters: SurveyFilters
  ): Promise<PaginatedSurveyResult> {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("surveys_list_v1")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filters.year !== null) query = query.eq("education_year", filters.year);
    if (filters.status !== null) query = query.eq("status", filters.status);

    // 🔍 통합 검색: 제목/과정명/강사명/과목명/작성자 이메일
    const q = (filters.q ?? "").trim();
    if (q.length > 0) {
      const kw = escapeOrValue(q);
      query = query.or(
        [
          `title.ilike.%${kw}%`,
          `course_name.ilike.%${kw}%`,
          `instructor_name.ilike.%${kw}%`,
          `course_title.ilike.%${kw}%`,
          `creator_email.ilike.%${kw}%`,
        ].join(",")
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const safeData = (data ?? []) as SurveyListItem[];
    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return { data: safeData, count: total, totalPages };
  },

  async getAvailableYears(): Promise<number[]> {
    const { data, error } = await supabase
      .from("survey_available_years_v1")
      .select("education_year");
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
      .from("surveys")
      .select("education_year, education_round, course_name")
      .not("course_name", "is", null);

    if (year) q = q.eq("education_year", year);

    const { data, error } = await q;
    if (error) throw error;

    const uniq = new Map<
      string,
      { year: number; round: number; course_name: string }
    >();
    (data ?? []).forEach((r: any) => {
      const key = `${r.education_year}-${r.education_round}-${r.course_name}`;
      if (!uniq.has(key)) {
        uniq.set(key, {
          year: r.education_year,
          round: r.education_round,
          course_name: r.course_name,
        });
      }
    });

    return Array.from(uniq.values()).sort((a, b) =>
      a.year !== b.year
        ? b.year - a.year
        : a.round !== b.round
        ? a.round - b.round
        : a.course_name.localeCompare(b.course_name)
    );
  },

  async updateStatus(
    id: string,
    status: "draft" | "active" | "public" | "completed"
  ) {
    const { error } = await supabase
      .from("surveys")
      .update({ status })
      .eq("id", id);
    if (error) throw error;
  },

  async duplicateSurvey(id: string, titleSuffix = " (복사본)") {
    const { data: src, error: e1 } = await supabase
      .from("surveys")
      .select("*")
      .eq("id", id)
      .single();
    if (e1) throw e1;

    const payload: any = { ...src };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    payload.title = (src.title ?? "무제") + titleSuffix;
    payload.status = "draft";

    const { data: created, error: e2 } = await supabase
      .from("surveys")
      .insert([payload])
      .select()
      .single();
    if (e2) throw e2;
    return created;
  },

  async deleteSurvey(id: string) {
    const { error } = await supabase.from("surveys").delete().eq("id", id);
    if (error) throw error;
  },

  // 기본 start/end 자동 채움
  async quickCreateSurvey(payload: {
    education_year: number;
    education_round: number;
    education_day: number;
    course_name: string;
    title?: string;
    template_id?: string | null;
  }) {
    const baseTitle =
      payload.title ??
      `${payload.education_year}-${payload.course_name}-${payload.education_round}차-${payload.education_day}일차 설문`;

    const { startLocal, endLocal } = getDefaultStartEndLocal();

    const { data, error } = await supabase
      .from("surveys")
      .insert([
        {
          title: baseTitle,
          description: "",
          start_date: toISO(startLocal),
          end_date: toISO(endLocal),
          education_year: payload.education_year,
          education_round: payload.education_round,
          education_day: payload.education_day,
          course_name: payload.course_name,
          expected_participants: 0,
          status: "draft",
          template_id: payload.template_id ?? null,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

/* ------------------------- CourseNamesRepo ------------------------ */
export type CourseName = { id: string; name: string; created_at: string | null };

export const CourseNamesRepo = {
  async list(): Promise<CourseName[]> {
    const { data, error } = await supabase
      .from("course_names")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as CourseName[];
  },
  async create(name: string) {
    const { data, error } = await supabase
      .from("course_names")
      .insert([{ name }])
      .select()
      .single();
    if (error) throw error;
    return data as CourseName;
  },
  async rename(id: string, oldName: string, newName: string) {
    const { error: e1 } = await supabase
      .from("course_names")
      .update({ name: newName })
      .eq("id", id);
    if (e1) throw e1;
    const { error: e2 } = await supabase
      .from("surveys")
      .update({ course_name: newName })
      .eq("course_name", oldName);
    if (e2) throw e2;
  },
  async remove(id: string) {
    const { error } = await supabase.from("course_names").delete().eq("id", id);
    if (error) throw error;
  },
};
