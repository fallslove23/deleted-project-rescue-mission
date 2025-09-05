// src/repositories/surveysRepo.ts
import { supabase } from "@/integrations/supabase/client";

/**
 * course_names 테이블 스키마 가정:
 * - id: uuid (PK, default gen_random_uuid())
 * - name: text (UNIQUE)
 * - created_at: timestamptz (optional)
 */
export type CourseName = {
  id: string;
  name: string;
};

/**
 * 공통 에러 핸들링: Supabase 에러를 던져 상위에서 toast 등 처리
 */
function throwIf<T>(error: any, context?: string): asserts error is null {
  if (error) {
    const msg =
      (error as { message?: string })?.message ||
      (typeof error === "string" ? error : "Unknown error");
    throw new Error(context ? `${context}: ${msg}` : msg);
  }
}

/**
 * 과정명 저장소
 * - list(): 과정명 목록 (name 오름차순)
 * - create(name): 새 과정명 추가(중복 시 에러)
 * - rename(id, oldName, newName): course_names.name 변경 + surveys.course_name 동기화
 * - remove(id): 과정명 삭제 (기존 설문에는 영향 없음)
 */
export const CourseNamesRepo = {
  /**
   * 과정명 목록 조회
   */
  async list(): Promise<CourseName[]> {
    const { data, error } = await supabase
      .from("course_names")
      .select("id, name")
      .order("name", { ascending: true });

    throwIf(error, "과정명 목록 조회 실패");
    return (data ?? []) as CourseName[];
  },

  /**
   * 과정명 생성 (중복 방지)
   */
  async create(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("과정명이 비어 있습니다.");

    // 중복 체크(낙관적) — UNIQUE 제약이 있다면 DB가 최종 보장
    const { data: dup, error: dupErr } = await supabase
      .from("course_names")
      .select("id")
      .eq("name", trimmed)
      .maybeSingle();

    throwIf(dupErr, "중복 확인 실패");
    if (dup) throw new Error(`"${trimmed}"은(는) 이미 존재합니다.`);

    const { error } = await supabase
      .from("course_names")
      .insert({ name: trimmed });

    throwIf(error, "과정명 추가 실패");
  },

  /**
   * 과정명 변경
   * - course_names.name 업데이트
   * - surveys.course_name 에서 oldName → newName 동기화
   */
  async rename(id: string, oldName: string, newName: string): Promise<void> {
    const trimmed = newName.trim();
    if (!id) throw new Error("잘못된 과정명 ID 입니다.");
    if (!trimmed) throw new Error("새 과정명이 비어 있습니다.");

    // 동일 이름이면 조용히 종료
    if (oldName === trimmed) return;

    // 목적 이름 중복 체크(낙관적)
    const { data: dup, error: dupErr } = await supabase
      .from("course_names")
      .select("id")
      .eq("name", trimmed)
      .maybeSingle();
    throwIf(dupErr, "중복 확인 실패");
    if (dup) throw new Error(`"${trimmed}"은(는) 이미 존재합니다.`);

    // 1) course_names 업데이트
    const { error: updateNameErr } = await supabase
      .from("course_names")
      .update({ name: trimmed })
      .eq("id", id);
    throwIf(updateNameErr, "과정명 변경 실패");

    // 2) surveys 동기화
    if (oldName) {
      const { error: syncErr } = await supabase
        .from("surveys")
        .update({ course_name: trimmed })
        .eq("course_name", oldName);
      throwIf(syncErr, "설문 과정명 동기화 실패");
    }
  },

  /**
   * 과정명 삭제
   * - 주의: 기존 설문은 그대로 남음(surveys.course_name 텍스트만 존재)
   */
  async remove(id: string): Promise<void> {
    if (!id) throw new Error("잘못된 과정명 ID 입니다.");

    const { error } = await supabase
      .from("course_names")
      .delete()
      .eq("id", id);

    throwIf(error, "과정명 삭제 실패");
  },
};

/* ------------------------------------------------------------------
   (선택) 확장용: 설문 관련 타입/헬퍼를 여기에 두고 재사용할 수 있습니다.
   SurveyBuilder에서 현재 사용하지 않으므로 주석으로 예시만 남깁니다.

export type Survey = {
  id: string;
  title: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  education_year: number | null;
  education_round: number | null;
  education_day: number | null;
  course_name: string | null;
  expected_participants: number | null;
  is_test: boolean | null;
  status: "draft" | "active" | "public" | "completed" | null;
  created_at: string | null;
  updated_at: string | null;
};

export const SurveysRepo = {
  async getById(id: string): Promise<Survey | null> {
    const { data, error } = await supabase
      .from("surveys")
      .select("*")
      .eq("id", id)
      .single();
    throwIf(error, "설문 조회 실패");
    return data as Survey;
  },

  async update(id: string, payload: Partial<Survey>): Promise<void> {
    const { error } = await supabase.from("surveys").update(payload).eq("id", id);
    throwIf(error, "설문 업데이트 실패");
  },
};
------------------------------------------------------------------- */
