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
  session_id: string | null;  // NEW
  template_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  expected_participants?: number | null;
  is_test?: boolean | null;
  created_by?: string | null;

  // 뷰 조인 필드
  program_title?: string | null;
  session_title?: string | null;
  instructor_name?: string | null;
  course_title?: string | null;
  creator_email?: string | null;
}

export interface SurveyFilters {
  year: number | null;
  status: "draft" | "active" | "public" | "completed" | null;
  q?: string | null;
  courseName?: string | null; // 레거시 필터 유지
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

/* ===== 프로그램/세션 타입 ===== */
export interface Program {
  id: string;
  name: string;
}

export interface Session {
  id: string;
  session_name: string;
}

export interface ProgramSessionRow {
  program_id: string;
  program_title: string;
  session_id: string;
  session_title: string;
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
 * Programs / Sessions Repos
 * ========================================= */
export const ProgramsRepo = {
  async list(): Promise<Program[]> {
    // Use course_names table as a fallback for programs
    const { data, error } = await supabase
      .from("course_names")
      .select("id, name")
      .order("name", { ascending: true });
    throwIf(error, "프로그램 목록 조회 실패");
    return (data ?? []) as Program[];
  },
};

export const SessionsRepo = {
  /** 프로그램별 세션(과목) 목록 */
  async listByProgram(programId: string): Promise<Session[]> {
    if (!programId) return [];
    // Return empty for now since program_sessions_v1 is not available in types
    return [];
  },

  /** 전체 편성 보기(관리 화면 등에서 사용) */
  async listProgramSessions(): Promise<ProgramSessionRow[]> {
    // Return empty for now since program_sessions_v1 is not available in types
    return [];
  },
};

/* =========================================
 * SurveysRepository: v2(프로그램/세션) + 레거시 공존
 * ========================================= */
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

    // Use surveys_list_v1 instead of surveys_list_v2
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
          `instructor_name.ilike.${like}`,
        ].join(",")
      );
    }

    query = query.order(sortBy, { ascending: sortDir === "asc", nullsFirst: false });

    const { data, error, count } = await query.range(from, to);
    throwIf(error, "설문 목록 조회 실패");

    return {
      data: (data || []).map((item: any) => ({
        ...item,
        program_id: item.course_id, // Map for compatibility
        session_id: null,
        program_title: item.course_title,
        session_title: null,
      })) as SurveyListItem[],
      count: count || 0,
      totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
    };
  },

  async getAvailableYears(): Promise<number[]> {
    const { data, error } = await supabase
      .from("survey_available_years_v1")
      .select("education_year")
      .order("education_year", { ascending: false });
    if (error) return [];
    return (data || []).map((item: any) => item.education_year).filter(Boolean);
  },

  async getAvailableCourseNames(): Promise<string[]> {
    const { data, error } = await supabase
      .from("surveys")
      .select("course_name")
      .not("course_name", "is", null)
      .order("course_name");
    if (error) return [];
    return Array.from(new Set((data || []).map((item: any) => item.course_name).filter(Boolean)));
  },

  async fetchByIds(ids: string[]): Promise<SurveyListItem[]> {
    if (ids.length === 0) return [];
    const { data, error } = await supabase
      .from("surveys_list_v1")
      .select("*")
      .in("id", ids);
    if (error) return [];
    return (data || []).map((item: any) => ({
      ...item,
      program_id: item.course_id,
      session_id: null,
      program_title: item.course_title,
      session_title: null,
    })) as SurveyListItem[];
  },

  async updateStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase
      .from("surveys")
      .update({ status })
      .eq("id", id);
    throwIf(error, "설문 상태 업데이트 실패");
  },

  async updateStatusMany(ids: string[], status: string): Promise<void> {
    const { error } = await supabase
      .from("surveys")
      .update({ status })
      .in("id", ids);
    throwIf(error, "설문 상태 일괄 업데이트 실패");
  },

  async deleteMany(ids: string[]): Promise<void> {
    const { error } = await supabase
      .from("surveys")
      .delete()
      .in("id", ids);
    throwIf(error, "설문 일괄 삭제 실패");
  },

  async quickCreateSurvey(payload: {
    education_year: number;
    education_round: number;
    education_day: number;
    course_name: string;
    template_id?: string | null;
  }): Promise<SurveyListItem> {
    return this.quickCreateSurveyLegacy(payload);
  },

  async listTemplates(): Promise<TemplateLite[]> {
    const { data, error } = await supabase
      .from("survey_templates")
      .select("id,name")
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data || []) as TemplateLite[];
  },

  /** 빠른 생성 V2: program_id + session_id 기반 */
  async quickCreateSurveyV2(params: {
    program_id: string;
    session_id: string;
    education_year: number;
    education_round: number;
    education_day: number;
    template_id?: string | null;
  }): Promise<SurveyListItem> {
    // Use course_names as fallback for program name
    const { data: pRow, error: pErr } = await supabase
      .from("course_names")
      .select("name")
      .eq("id", params.program_id)
      .single();

    const programName = pRow?.name ?? "Unknown Program";
    const sessionName = "Session"; // Placeholder

    const title = `${params.education_year}-${programName}-${params.education_round}차-${params.education_day}일차 ${sessionName} 설문`;

    const startISO = nextDayBase(9, 0);
    const endISO   = nextDayBase(19, 0);

    const insertPayload: any = {
      title,
      description:
        "본 설문은 과목과 강사 만족도를 평가하기 위한 것입니다. 교육 품질 향상을 위해 모든 교육생께서 반드시 참여해 주시길 부탁드립니다.",
      start_date: startISO,
      end_date: endISO,
      education_year: params.education_year,
      education_round: params.education_round,
      education_day: params.education_day,
      course_name: programName, // Use program name as course name for compatibility
      status: "draft",
      template_id: params.template_id ?? null,
    };

    const { data, error } = await supabase
      .from("surveys")
      .insert([insertPayload])
      .select()
      .single();
    throwIf(error, "설문 빠른생성 실패");

    return {
      ...data,
      program_id: params.program_id,
      session_id: params.session_id,
      program_title: programName,
      session_title: sessionName,
    } as SurveyListItem;
  },

  /** 레거시 빠른 생성 (course_name 문자열 기반) */
  async quickCreateSurveyLegacy(payload: {
    education_year: number;
    education_round: number;
    education_day: number;
    course_name: string;
    template_id?: string | null;
  }): Promise<SurveyListItem> {
    const title = `${payload.education_year}-${payload.course_name}-${payload.education_round}차-${payload.education_day}일차 설문`;
    const startISO = nextDayBase(9, 0);
    const endISO   = nextDayBase(19, 0);

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
    return {
      ...data,
      program_id: null,
      session_id: null,
      program_title: null,
      session_title: null,
    } as SurveyListItem;
  },
};
