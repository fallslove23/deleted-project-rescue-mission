import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import SimplifiedSurveyForm from "./SimplifiedSurveyForm";

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
  const handleSubmit = async (data: any) => {
    if (!survey) return;

    try {
      const payload = {
        // 제목은 서버로 넘길 때 다시 계산: (yy-n차 과정명 n일차) 과목명
        title: "",
        description: data.description || survey.description || "",
        start_date: data.start_date ? new Date(data.start_date + "+09:00").toISOString() : null,
        end_date: data.end_date ? new Date(data.end_date + "+09:00").toISOString() : null,
        education_year: data.education_year,
        education_round: data.education_round,
        education_day: data.education_day,
        course_name: data.course_name,
        expected_participants: data.expected_participants,
        is_combined: data.is_combined || false,
        combined_round_start: data.is_combined ? data.combined_round_start : null,
        combined_round_end: data.is_combined ? data.combined_round_end : null,
        instructor_id: null as string | null,
        course_id: null as string | null,
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
        const program = payload.course_name?.includes("-")
          ? payload.course_name.split("-")[1]?.trim()
          : payload.course_name?.trim() || "";
        const prefix = program
          ? `(${yy}-${payload.education_round}차 ${program} ${payload.education_day}일차)`
          : `(${yy}-${payload.education_round}차 ${payload.education_day}일차)`;
        payload.title = `${prefix} ${selectedCourse.title}`;
      } else {
        payload.title = survey.title; // 실패 시 기존 제목 유지
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

  // 편집 초기값 구성 (datetime-local 변환)
  const toLocal = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60 * 1000).toISOString().slice(0, 16);
    // ↑ input[type=datetime-local] 포맷
  };

  const initial = survey
    ? {
        education_year: survey.education_year,
        education_round: survey.education_round,
        education_day: survey.education_day ?? 1,
        course_name: survey.course_name ?? "",
        expected_participants: survey.expected_participants ?? 0,
        start_date: toLocal(survey.start_date),
        end_date: toLocal(survey.end_date),
        description: survey.description ?? "",
        is_combined: !!survey.is_combined,
        combined_round_start: survey.combined_round_start,
        combined_round_end: survey.combined_round_end,
        course_id: survey.course_id,
        instructor_id: survey.instructor_id,
      }
    : undefined;

  console.log("SurveyInfoEditDialog - Survey data:", survey);
  console.log("SurveyInfoEditDialog - Initial values:", initial);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base sm:text-lg">설문 정보 수정</DialogTitle>
        </DialogHeader>

        {survey && (
          <SimplifiedSurveyForm
            initial={initial}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            isSubmitting={false}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}