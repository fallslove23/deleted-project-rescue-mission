// src/repositories/surveysRepo.ts
import { supabase } from "@/integrations/supabase/client";

/* ===== 공통 타입 ===== */
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
  course_name: string | null; // 레거시
  program_id: string | null;
  subject_id: string | null;
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

  /* v2 조인 결과 필드 (뷰에서만 나올 수 있음) */
  program_title?: string | null;
  subject_title?: string | null;
}

export interface SurveyFilters {
  year: number | null;
  status: "draft" | "active" | "public" | "completed" | null;
  q?: string | null;
  courseName?: string | null; // 레거시 필터
}

export interface PaginatedSurveyResult {
  data: SurveyListItem[];
  count: number;
  totalPages: number;
}

export interface TemplateLite {
  id: string;
  name: string;
}

/* ===== 프로그램/과목 타입 ===== */
export interface Program {
  id: string;
  title: string;
  is_active: boolean;
}

export interface Subject {
  id: string;
  title: string;
  is_active: boolean;
}

export interface ProgramSubjectRow {
  program_id: string;
  program_title: string;
  subject_id: string;
  subject_title: string;
  sort_order: number;
  is_active: boolean;
}

/* ===== 유틸 ===== */
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

function throwIf(error: any, context?: string): asserts error is null {
  if (error) {
    const msg =
      (error && typeof error === "object" && "message" in error
        ? (error as any).message
        : String(error)) || "Unknown error";
    throw new Error(context ? `${context}: ${msg}` : msg);
  }
}

/* =========================================
 * ProgramsRepo / SubjectsRepo
 * ========================================= */
export const ProgramsRepo = {
  async listActive(): Promise<Program[]> {
    const { data, error } = await supabase
      .from("programs")
      .select("id, title, is_active")
      .eq("is_active", true)
      .order("title", { ascending: true });
    throwIf(error, "프로그램 목록 조회 실패");
    return (data ?? []) as Program[];
  },
};

export const SubjectsRepo = {
  async listActiveByProgram(programId: string): Promise<Subject[]> {
    if (!programId) return [];
    const { data, error } = await supabase
      .from("program_subjects_v1")
      .select("subject_id, subject_title, sort_order")
      .eq("program_id", programId)
      .order("sort_order", { ascending: true });
    throwIf(error, "과목 목록 조회 실패");
    return (data ?? []).map((r: any) => ({
      id: r.subject_id,
      title: r.subject_title,
      is_active: true,
    })) as Subject[];
  },

  async listProgramSubjects(): Promise<ProgramSubjectRow[]> {
    const { data, error } = await supabase
      .from("program_subjects_v1")
      .select("*")
      .order("program_title", { ascending: true })
      .order("sort_order", { ascending: true });
    throwIf(error, "프로그램-과목 편성 조회 실패");
    return (data ?? []) as ProgramSubjectRow[];
  },
};

/* =========================================
 * SurveysRepository (레거시 + v2 공존)
 * ========================================= */
export const SurveysRepository = {
  /* === 목록: 기존 v1 뷰 대신 v2 사용 권장 === */
  async fetchSurveyList(
    page: number,
    pageSize: number,
    filters: SurveyFilters,
    sortBy: SortBy = "created_at",
    sortDir: SortDir = "desc"
  ): Promise<PaginatedSurveyResult> {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from("surveys_list_v2").select("*", { count: "exact" });

    if (filters.year) query = query.eq("education_year", filters.year);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.courseName) query = query.eq("course_name", filters.courseName); // 레거시 필터 유지

    if (filters.q && filters.q.trim()) {
      const like = `%${filters.q.trim()}%`;
      query = query.or(
        [
          `title.ilike.${like}`,
          `program_title.ilike.${like}`,
          `subject_title.ilike.${like}`,
          `course_name.ilike.${like}`,
          `instructor_name.ilike.${like}`,
          `creator_email.ilike.${like}`,
        ].join(",")
      );
    }

    query = query.order(sortBy, { ascending: sortDir === "asc", nullsFirst: false });

    const { data, error, count } = await query.range(from, to);
    throwIf(error, "설문 목록 조회 실패");

    return {
      data: (data || []) as SurveyListItem[],
      count: count || 0,
      totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
    };
  },

  async fetchByIds(ids: string[]): Promise<SurveyListItem[]> {
    if (ids.length === 0) return [];
    const { data, error } = await supabase.from("surveys_list_v2").select("*").in("id", ids);
    throwIf(error, "ID로 설문 조회 실패");
    return (data || []) as SurveyListItem[];
  },

  async listTemplates(): Promise<TemplateLite[]> {
    const { data, error } = await supabase
      .from("survey_templates")
      .select("id,name")
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data || []) as TemplateLite[];
  },

  /* === 빠른생성: v2 (program_id + subject_id 기반) === */
  async quickCreateSurveyV2(params: {
    program_id: string;
    subject_id: string;
    education_year: number;
    education_round: number;
    education_day: number;
    template_id?: string | null;
  }): Promise<SurveyListItem> {
    // 이름 조합을 위해 program/subject 이름 조회
    const [{ data: pRow, error: pErr }] = await Promise.all([
      supabase.from("programs").select("title").eq("id", params.program_id).single(),
    ]);
    throwIf(pErr, "프로그램명 조회 실패");

    const { data: sRow, error: sErr } = await supabase
      .from("subjects")
      .select("title")
      .eq("id", params.subject_id)
      .single();
    throwIf(sErr, "과목명 조회 실패");

    const programTitle = (pRow as any)?.title ?? "";
    const subjectTitle = (sRow as any)?.title ?? "";

    const title = `${params.education_year}-${programTitle}-${params.education_round}차-${params.education_day}일차 ${subjectTitle} 설문`;

    const startISO = nextDayBase(9, 0);
    const endISO = nextDayBase(19, 0);

    const insertPayload: any = {
      title,
      description:
        "본 설문은 과목과 강사 만족도를 평가하기 위한 것입니다. 교육 품질 향상을 위해 모든 교육생께서 반드시 참여해 주시길 부탁드립니다.",
      start_date: startISO,
      end_date: endISO,
      education_year: params.education_year,
      education_round: params.education_round,
      education_day: params.education_day,
      program_id: params.program_id,
      subject_id: params.subject_id,
      status: "draft",
      template_id: params.template_id ?? null,
      -- course_name: NULL  -- 레거시 미사용
    };

    const { data, error } = await supabase
      .from("surveys")
      .insert([insertPayload])
      .select()
      .single();
    throwIf(error, "설문 빠른생성 실패");

    return data as SurveyListItem;
  },

  /* === 레거시 빠른생성(문자열 course_name)도 유지 === */
  async quickCreateSurveyLegacy(payload: {
    education_year: number;
    education_round: number;
    education_day: number;
    course_name: string;
    template_id?: string | null;
  }): Promise<SurveyListItem> {
    const title = `${payload.education_year}-${payload.course_name}-${payload.education_round}차-${payload.education_day}일차 설문`;
    const startISO = nextDayBase(9, 0);
    const endISO = nextDayBase(19, 0);

    const { data, error } = await supabase
      .from("surveys")
      .insert([
        {
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
        },
      ])
      .select()
      .single();
    throwIf(error, "레거시 설문 빠른생성 실패");
    return data as SurveyListItem;
  },
};
