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
  course_id: string | null;
  course_name: string | null; // "BS Basic" | "BS Advanced"
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
  courses,
  onSaved,
}: Props) {
  const handleSubmit = async (data: any) => {
    if (!survey) return;

    try {
      const payload = {
        title: "", // 자동 생성
        description: data.description || "",
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
        payload.instructor_id = first.instructorId;
        payload.course_id = first.courseId;
      }

      // 제목 자동 생성
      const selectedCourse = courses.find((c) => c.id === payload.course_id);
      if (selectedCourse && payload.education_year && payload.education_round && payload.education_day) {
        const yy = payload.education_year.toString().slice(-2);
        const courseName = payload.course_name?.includes("-")
          ? payload.course_name.split("-")[1]?.trim()
          : payload.course_name?.trim() || "";
        const prefix = courseName
          ? `(${yy}-${payload.education_round}차 ${courseName} ${payload.education_day}일차)`
          : `(${yy}-${payload.education_round}차 ${payload.education_day}일차)`;
        payload.title = `${prefix} ${selectedCourse.title}`;
      }

      const { error } = await supabase.from("surveys").update(payload).eq("id", survey.id);
      if (error) throw error;

      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      console.error("Error updating survey:", e);
    }
  };

  // Dialog 여백을 줄여 더 컴팩트하게
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base sm:text-lg">설문 정보 수정</DialogTitle>
        </DialogHeader>

        {survey && (
          <SurveyCreateForm
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            isSubmitting={false}
            initialValues={{
              education_year: survey.education_year,
              education_round: survey.education_round,
              education_day: survey.education_day ?? 1,
              course_name: survey.course_name ?? "BS Basic",
              // datetime-local 형식으로 변환
              start_date: survey.start_date ? new Date(survey.start_date).toISOString().slice(0, 16) : "",
              end_date: survey.end_date ? new Date(survey.end_date).toISOString().slice(0, 16) : "",
              expected_participants: survey.expected_participants ?? null,
              is_combined: !!survey.is_combined,
              combined_round_start: survey.combined_round_start,
              combined_round_end: survey.combined_round_end,
              courseId: survey.course_id ?? "",
              instructorId: survey.instructor_id ?? "",
              description: survey.description ?? "",
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}