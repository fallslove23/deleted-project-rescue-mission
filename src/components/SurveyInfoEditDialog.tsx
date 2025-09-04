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

export default function SurveyInfoEditDialog({ open, onOpenChange, survey, courses, onSaved }: Props) {
  const handleSubmit = async (data: any) => {
    if (!survey) return;

    try {
      const payload = {
        title: '', // Will be auto-generated based on data
        description: data.description || '',
        start_date: data.start_date ? new Date(data.start_date + '+09:00').toISOString() : null,
        end_date: data.end_date ? new Date(data.end_date + '+09:00').toISOString() : null,
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

      // Handle course selections - for now, use the first one
      if (data.course_selections && data.course_selections.length > 0) {
        const firstSelection = data.course_selections[0];
        payload.instructor_id = firstSelection.instructorId;
        payload.course_id = firstSelection.courseId;
      }

      // Auto-generate title
      const selectedCourse = courses.find(c => c.id === payload.course_id);
      if (selectedCourse && payload.education_year && payload.education_round && payload.education_day) {
        const yy = payload.education_year.toString().slice(-2);
        const courseName = payload.course_name?.includes('-')
          ? payload.course_name.split('-')[1]?.trim()
          : payload.course_name?.trim() || '';
        const titlePrefix = courseName
          ? `(${yy}-${payload.education_round}차 ${courseName} ${payload.education_day}일차)`
          : `(${yy}-${payload.education_round}차 ${payload.education_day}일차)`;
        payload.title = `${titlePrefix} ${selectedCourse.title}`;
      }

      const { data: updateResult, error } = await supabase
        .from('surveys')
        .update(payload)
        .eq('id', survey.id);

      if (error) throw error;

      onOpenChange(false);
      if (onSaved) onSaved();
    } catch (error: any) {
      console.error('Error updating survey:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>설문 정보 수정</DialogTitle>
        </DialogHeader>

        {survey && (
          <SurveyCreateForm 
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            isSubmitting={false}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}