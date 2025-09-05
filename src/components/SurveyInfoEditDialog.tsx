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
  const [initialValues, setInitialValues] = React.useState<any>(null);
  
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
  
  // 세션 기반 초기값 가져오기
  React.useEffect(() => {
    if (survey?.id && open) {
      const fetchSessionsAndSetInitialValues = async () => {
        try {
          const { data: sessions } = await supabase
            .from("survey_sessions")
            .select("*")
            .eq("survey_id", survey.id)
            .order("session_order");
          
          let courseSelections: any[] = [];
          if (sessions && sessions.length > 0) {
            courseSelections = sessions.map(session => ({
              courseId: session.course_id || "",
              instructorId: session.instructor_id || ""
            }));
          } else if (survey.course_id) {
            // 기존 단일 저장 구조 호환성
            courseSelections = [{
              courseId: survey.course_id,
              instructorId: survey.instructor_id || ""
            }];
          }
          
          // 기본값이 빈 배열이면 기본 항목 하나 추가
          if (courseSelections.length === 0) {
            courseSelections = [{ courseId: '', instructorId: '' }];
          }

          const values = {
            education_year: survey.education_year,
            education_round: survey.education_round,
            education_day: survey.education_day,
            course_name: survey.course_name ?? "",
            expected_participants: survey.expected_participants ?? null,
            start_date: toLocalInput(survey.start_date),
            end_date: toLocalInput(survey.end_date),
            description: survey.description ?? "",
            is_combined: !!survey.is_combined,
            combined_round_start: survey.combined_round_start ?? null,
            combined_round_end: survey.combined_round_end ?? null,
            round_label: survey.round_label ?? "",
            is_test: !!survey.is_test,
            course_selections: courseSelections,
          };

          console.log('SurveyInfoEditDialog - Setting initial values:', values);
          setInitialValues(values);
        } catch (error) {
          console.error('Error fetching sessions:', error);
          // 오류 시 기본값 사용
          setInitialValues({
            education_year: survey.education_year,
            education_round: survey.education_round,
            education_day: survey.education_day,
            course_name: survey.course_name ?? "",
            expected_participants: survey.expected_participants ?? null,
            start_date: toLocalInput(survey.start_date),
            end_date: toLocalInput(survey.end_date),
            description: survey.description ?? "",
            is_combined: !!survey.is_combined,
            combined_round_start: survey.combined_round_start ?? null,
            combined_round_end: survey.combined_round_end ?? null,
            round_label: survey.round_label ?? "",
            is_test: !!survey.is_test,
            course_selections: [{ courseId: '', instructorId: '' }],
          });
        }
      };

      fetchSessionsAndSetInitialValues();
    }
  }, [survey?.id, open]);

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

      // 제목 자동 생성 (과목 선택과 무관하게)
      if (payload.education_year && payload.education_round && payload.education_day) {
        const yy = payload.education_year.toString().slice(-2);
        const program = payload.course_name?.trim() || "";
        const prefix = program
          ? `${yy}-${payload.education_round}차 ${program} ${payload.education_day}일차`
          : `${yy}-${payload.education_round}차 ${payload.education_day}일차`;
        payload.title = prefix;
      } else {
        payload.title = survey.title;
      }

      // 설문 기본 정보 수정
      const { error: surveyError } = await supabase
        .from("surveys")
        .update(payload)
        .eq("id", survey.id);

      if (surveyError) {
        console.error('Survey update error:', surveyError);
        throw new Error(`설문 정보 수정에 실패했습니다: ${surveyError.message}`);
      }

      // 기존 세션 삭제
      const { error: deleteError } = await supabase
        .from("survey_sessions")
        .delete()
        .eq("survey_id", survey.id);

      if (deleteError) {
        console.error('Session delete error:', deleteError);
        throw new Error(`기존 세션 삭제에 실패했습니다: ${deleteError.message}`);
      }

      // 새로운 세션들 추가
      if (data.course_selections && data.course_selections.length > 0) {
        const validSelections = data.course_selections.filter(
          (selection: any) => selection.courseId && selection.instructorId
        );
        
        if (validSelections.length > 0) {
          const sessionsToInsert = validSelections.map((selection: any, index: number) => ({
            survey_id: survey.id,
            course_id: selection.courseId,
            instructor_id: selection.instructorId,
            session_name: `과목 ${index + 1}`,
            session_order: index,
          }));

          const { error: sessionError } = await supabase
            .from("survey_sessions")
            .insert(sessionsToInsert);

          if (sessionError) {
            console.error('Session insert error:', sessionError);
            throw new Error(`세션 추가에 실패했습니다: ${sessionError.message}`);
          }
        }
      }

      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      console.error("Error updating survey:", err);
    }
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
            key={`${survey.id}-${JSON.stringify(initialValues)}`} // 모달 재사용 시 상태 리셋
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