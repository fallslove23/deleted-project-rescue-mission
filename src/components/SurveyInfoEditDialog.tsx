import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import SurveyCreateForm from "./SurveyCreateForm";

type SurveyEditable = {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  education_year: number;
  education_round: number;
  education_day: number | null;
  course_id: string | null;           // 과목 id
  course_name: string | null;         // "BS Basic" | "BS Advanced"
  instructor_id: string | null;
  expected_participants: number | null;
  is_combined: boolean | null;
  combined_round_start: number | null;
  combined_round_end: number | null;
  round_label: string | null;
  is_test?: boolean | null;
};

type Course = { id: string; title: string };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  survey: SurveyEditable | null;
  courses: Course[];
  onSaved?: () => void;
}

export default function SurveyInfoEditDialog({
  open,
  onOpenChange,
  survey,
  courses,    // 현재 컴포넌트에서는 제목 자동생성용으로만 사용
  onSaved,
}: Props) {
  // 안전한 ISO 변환 함수
  const toSafeISOString = (dateTimeLocal: string): string | null => {
    if (!dateTimeLocal) return null;
    try {
      const date = new Date(dateTimeLocal + ':00+09:00');
      if (isNaN(date.getTime())) return null;
      return date.toISOString();
    } catch {
      return null;
    }
  };

  const handleSubmit = async (data: any) => {
    if (!survey) return;

    try {
      const payload = {
        title: "",
        description: data.description || survey.description || "",
        start_date: toSafeISOString(data.start_date),
        end_date: toSafeISOString(data.end_date),
        education_year: data.education_year,
        education_round: data.education_round,
        education_day: data.education_day,
        course_name: data.course_name,
        expected_participants: data.expected_participants,
        is_combined: data.is_combined || false,
        combined_round_start: data.is_combined ? data.combined_round_start : null,
        combined_round_end: data.is_combined ? data.combined_round_end : null,
        round_label: data.is_combined ? data.round_label : null,
        instructor_id: null as string | null,
        course_id: null as string | null,
        is_test: data.is_test || false,
      };

      if (data.course_selections && data.course_selections.length > 0) {
        const first = data.course_selections[0];
        payload.course_id = first.courseId;
        payload.instructor_id = first.instructorId;
      }

      // 제목 자동 생성
      const selectedCourse = courses.find(c => c.id === payload.course_id);
      if (selectedCourse && payload.education_year && payload.education_round && payload.education_day) {
        const yy = payload.education_year.toString().slice(-2);
        const program = payload.course_name?.trim() || "";
        const prefix = program
          ? `(${yy}-${payload.education_round}차 ${program} ${payload.education_day}일차)`
          : `(${yy}-${payload.education_round}차 ${payload.education_day}일차)`;
        payload.title = `${prefix} ${selectedCourse.title}`;
      } else {
        payload.title = survey.title;
      }

      const { error } = await supabase
        .from("surveys")
        .update(payload)
        .eq("id", survey.id);

      if (error) {
        console.error('Survey update error:', error);
        throw new Error(`설문 정보 수정에 실패했습니다: ${error.message}`);
      }

      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      console.error("Error updating survey:", err);
    }
  };

  // 편집 초기값 구성 (datetime-local 변환 개선)
  const toLocalInput = (iso?: string | null): string => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch (error) {
      console.error("Date conversion error:", error);
      return "";
    }
  };

  const initialValues = survey && {
    education_year: survey.education_year,
    education_round: survey.education_round,
    education_day: survey.education_day,
    course_name: survey.course_name ?? "",
    expected_participants: survey.expected_participants ?? null,
    start_date: toLocalInput(survey.start_date),
    end_date: toLocalInput(survey.end_date),
    description: survey.description ?? "",
    // 새 컬럼들
    is_combined: !!survey.is_combined,
    combined_round_start: survey.combined_round_start ?? null,
    combined_round_end: survey.combined_round_end ?? null,
    round_label: survey.round_label ?? "",
    is_test: !!survey.is_test,
    // 과목/강사: 기존 단일 저장 구조라면 첫 슬롯에 복원
    course_selections: survey.course_id ? [{
      courseId: survey.course_id,
      instructorId: survey.instructor_id
    }] : [],
  };

  console.log("SurveyInfoEditDialog - Survey data:", survey);
  console.log("SurveyInfoEditDialog - Initial values:", initialValues);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base sm:text-lg">설문 정보 수정</DialogTitle>
        </DialogHeader>

        {survey && initialValues && (
          <SurveyCreateForm
            key={survey.id} // 모달 재사용 시 상태 리셋
            initialValues={initialValues}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            isSubmitting={false}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}