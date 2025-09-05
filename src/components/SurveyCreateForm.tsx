import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import CourseNameManager from "@/components/CourseNameManager";

interface SurveyCreateFormProps {
  onSuccess: (surveyId: string) => void;
  templates: Array<{ id: string; name: string; description?: string }>;
  initialTemplate?: string;
}

export default function SurveyCreateForm({ onSuccess, templates, initialTemplate }: SurveyCreateFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    education_year: new Date().getFullYear(),
    education_round: 1,
    education_day: 1,
    status: "draft",
    template_id: initialTemplate || "none",
    expected_participants: 0,
    
    // 합반 관련 필드
    course_name: "",
    is_combined: false,
    combined_round_start: null as number | null,
    combined_round_end: null as number | null,
    round_label: "",
  });

  // 제목 자동 생성
  useEffect(() => {
    const year = String(form.education_year);
    const r = form.education_round;
    const d = form.education_day;
    const program = form.course_name;

    if (year && r && d && program) {
      const title = `${year}-${program}-${r}차-${d}일차 설문`;
      setForm((prev) => ({ ...prev, title }));
    }
  }, [form.education_year, form.education_round, form.education_day, form.course_name]);

  // 합반 라벨 자동 생성
  useEffect(() => {
    if (form.course_name !== "BS Advanced") return;
    if (!form.is_combined) return;

    const year = form.education_year;
    const s = form.combined_round_start;
    const e = form.combined_round_end;

    if (year && s && e && s > 0 && e >= s) {
      const auto = `${year}년 ${s}∼${e}차 - BS Advanced`;
      setForm((prev) => ({ ...prev, round_label: prev.round_label?.trim() ? prev.round_label : auto }));
    }
  }, [form.course_name, form.is_combined, form.education_year, form.combined_round_start, form.combined_round_end]);

  const onChange = <K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.title.trim()) {
      toast({ title: "오류", description: "제목을 입력해주세요.", variant: "destructive" });
      return;
    }

    // 합반 유효성 검사
    if (form.course_name === "BS Advanced" && form.is_combined) {
      if (!form.combined_round_start || !form.combined_round_end) {
        toast({ title: "오류", description: "합반을 선택한 경우 시작/종료 차수를 입력하세요.", variant: "destructive" });
        return;
      }
      if (form.combined_round_start > form.combined_round_end) {
        toast({ title: "오류", description: "합반 차수의 시작은 종료보다 클 수 없습니다.", variant: "destructive" });
        return;
      }
    }

    setLoading(true);

    try {
      // 라벨 자동 채움
      let round_label = form.round_label.trim();
      if (form.course_name === "BS Advanced" && form.is_combined && !round_label) {
        round_label = `${form.education_year}년 ${form.combined_round_start}∼${form.combined_round_end}차 - BS Advanced`;
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        start_date: form.start_date ? new Date(form.start_date + ":00+09:00").toISOString() : null,
        end_date: form.end_date ? new Date(form.end_date + ":00+09:00").toISOString() : null,
        education_year: Number(form.education_year),
        education_round: Number(form.education_round),
        education_day: Number(form.education_day),
        status: form.status,
        template_id: form.template_id === "none" ? null : form.template_id,
        expected_participants: Number(form.expected_participants) || 0,
        
        // 과정 정보
        course_name: form.course_name,
        is_combined: form.course_name === "BS Advanced" ? form.is_combined : false,
        combined_round_start: (form.course_name === "BS Advanced" && form.is_combined) ? Number(form.combined_round_start) : null,
        combined_round_end: (form.course_name === "BS Advanced" && form.is_combined) ? Number(form.combined_round_end) : null,
        round_label: (form.course_name === "BS Advanced" && form.is_combined) ? round_label : null,
      };

      const { data: survey, error: surveyError } = await supabase
        .from("surveys")
        .insert(payload)
        .select()
        .single();

      if (surveyError) throw surveyError;

      // 템플릿에서 질문 가져오기 (선택한 경우)
      if (form.template_id) {
        const { data: templateQuestions, error: templateError } = await supabase
          .from('template_questions')
          .select('*')
          .eq('template_id', form.template_id)
          .order('order_index');

        if (templateError) {
          console.warn('Template questions loading failed:', templateError);
        } else if (templateQuestions && templateQuestions.length > 0) {
          // 템플릿 섹션 복사
          const { data: templateSections } = await supabase
            .from('template_sections')
            .select('*')
            .eq('template_id', form.template_id)
            .order('order_index');

          if (templateSections && templateSections.length > 0) {
            // 섹션 생성
            const sectionsToInsert = templateSections.map(section => ({
              survey_id: survey.id,
              name: section.name,
              description: section.description,
              order_index: section.order_index,
            }));

            const { data: newSections } = await supabase
              .from('survey_sections')
              .insert(sectionsToInsert)
              .select();

            // 섹션 ID 매핑 생성
            const sectionMapping: { [key: string]: string } = {};
            templateSections.forEach((templateSection, index) => {
              if (newSections && newSections[index]) {
                sectionMapping[templateSection.id] = newSections[index].id;
              }
            });

            // 질문 생성 (섹션 ID 매핑 적용)
            const questionsToInsert = templateQuestions.map(tq => ({
              survey_id: survey.id,
              question_text: tq.question_text,
              question_type: tq.question_type,
              options: tq.options,
              is_required: tq.is_required,
              satisfaction_type: tq.satisfaction_type,
              order_index: tq.order_index,
              scope: 'session' as const,
              section_id: tq.section_id ? sectionMapping[tq.section_id] || null : null,
            }));

            await supabase
              .from('survey_questions')
              .insert(questionsToInsert);
          } else {
            // 섹션이 없는 경우 질문만 복사
            const questionsToInsert = templateQuestions.map(tq => ({
              survey_id: survey.id,
              question_text: tq.question_text,
              question_type: tq.question_type,
              options: tq.options,
              is_required: tq.is_required,
              satisfaction_type: tq.satisfaction_type,
              order_index: tq.order_index,
              scope: 'session' as const,
            }));

            await supabase
              .from('survey_questions')
              .insert(questionsToInsert);
          }
        }
      }

      toast({ title: "성공", description: "설문이 생성되었습니다." });
      onSuccess(survey.id);
    } catch (error: any) {
      console.error("Survey creation error:", error);
      toast({ 
        title: "설문 생성 실패", 
        description: error.message || "설문 생성 중 오류가 발생했습니다.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>새 설문 생성</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 과정명 관리 - 템플릿 대신 과정명 관리 기능 */}
          <CourseNameManager
            selectedCourse={form.course_name}
            onCourseSelect={(courseName) => onChange("course_name", courseName)}
          />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>교육 연도</Label>
              <Input 
                type="number" 
                value={form.education_year} 
                onChange={(e) => onChange("education_year", Number(e.target.value))} 
              />
            </div>
            <div>
              <Label>차수</Label>
              <Input 
                type="number" 
                min="1"
                value={form.education_round} 
                onChange={(e) => onChange("education_round", Number(e.target.value))} 
              />
            </div>
            <div>
              <Label>일차</Label>
              <Input 
                type="number" 
                min="1"
                value={form.education_day} 
                onChange={(e) => onChange("education_day", Number(e.target.value))} 
              />
            </div>
            <div>
              <Label>예상 참가자 수</Label>
              <Input 
                type="number" 
                min="0"
                value={form.expected_participants} 
                onChange={(e) => onChange("expected_participants", Number(e.target.value))} 
              />
            </div>
          </div>

          <div>
            <Label>제목 (자동 생성)</Label>
            <Input 
              value={form.title} 
              onChange={(e) => onChange("title", e.target.value)}
              placeholder="자동으로 생성됩니다"
            />
          </div>

          {/* 합반 설정 (BS Advanced일 때만) */}
          {form.course_name === "BS Advanced" && (
            <Card className="border-orange-200 bg-orange-50/50">
              <CardHeader>
                <CardTitle className="text-sm text-orange-800">합반 설정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    id="is_combined"
                    type="checkbox"
                    className="h-4 w-4 text-orange-600"
                    checked={form.is_combined}
                    onChange={(e) => onChange("is_combined", e.target.checked)}
                  />
                  <Label htmlFor="is_combined" className="text-sm font-medium">
                    합반으로 운영
                  </Label>
                </div>

                {form.is_combined && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>시작 차수</Label>
                        <Input
                          type="number"
                          min="1"
                          value={form.combined_round_start || ""}
                          onChange={(e) => onChange("combined_round_start", Number(e.target.value))}
                          placeholder="시작 차수"
                        />
                      </div>
                      <div>
                        <Label>종료 차수</Label>
                        <Input
                          type="number"
                          min="1"
                          value={form.combined_round_end || ""}
                          onChange={(e) => onChange("combined_round_end", Number(e.target.value))}
                          placeholder="종료 차수"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>합반 라벨 (자동생성됨)</Label>
                      <Input
                        value={form.round_label}
                        onChange={(e) => onChange("round_label", e.target.value)}
                        placeholder="예: 2025년 1∼3차 - BS Advanced"
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>시작일시</Label>
              <Input
                type="datetime-local"
                value={form.start_date}
                onChange={(e) => onChange("start_date", e.target.value)}
              />
            </div>
            <div>
              <Label>종료일시</Label>
              <Input
                type="datetime-local"
                value={form.end_date}
                onChange={(e) => onChange("end_date", e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>설명</Label>
            <Textarea
              placeholder="설문에 대한 설명을 입력하세요"
              value={form.description}
              onChange={(e) => onChange("description", e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "생성 중..." : "설문 생성"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}