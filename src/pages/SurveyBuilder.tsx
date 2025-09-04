import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Plus, Trash2, Edit3 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Survey = {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  education_year: number;
  education_round: number;
  education_day: number | null;
  course_id: string | null;      // 과목 (예: 300 점검방법) — 과목명은 course 테이블에서 가져옴
  course_name: string | null;    // 과정(프로그램)명: "BS Basic" | "BS Advanced"
  instructor_id: string | null;
  status: string;

  // ✅ 합반 관련(Nullable)
  is_combined: boolean | null;
  combined_round_start: number | null;
  combined_round_end: number | null;
  round_label: string | null;

  created_at: string;
  created_by: string | null;
};

type Course = { id: string; title: string };

type SurveyQuestion = {
  id: string;
  question_text: string;
  question_type: string;
  options: any;
  is_required: boolean;
  order_index: number;
  section_id?: string | null;
  session_id?: string | null;
  scope: 'session' | 'operation';
  satisfaction_type?: string | null;
};

type SurveySection = {
  id: string;
  name: string;
  description?: string;
  order_index: number;
};

export default function SurveyBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<SurveySection[]>([]);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<SurveyQuestion | null>(null);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);

  const [form, setForm] = useState<Partial<Survey>>({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    education_year: new Date().getFullYear(),
    education_round: 1,
    education_day: 1,
    course_id: "",
    course_name: "", // "BS Basic" | "BS Advanced"
    instructor_id: null,

    is_combined: false,
    combined_round_start: null,
    combined_round_end: null,
    round_label: "",
  });

  // 과목 목록
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("courses").select("id,title").order("title");
      if (error) {
        console.error(error);
        toast({ title: "오류", description: "과목 목록을 불러오지 못했습니다.", variant: "destructive" });
      } else {
        setCourses(data ?? []);
      }
    })();
  }, []);

  // 설문 로드
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        // 설문 기본 정보 로드
        const { data: surveyData, error: surveyError } = await supabase
          .from("surveys")
          .select("*")
          .eq("id", id)
          .single();
        
        if (surveyError) throw surveyError;
        
        if (surveyData) {
          setForm({
            ...surveyData,
            // datetime-local 포맷 보정
            start_date: surveyData.start_date ? new Date(surveyData.start_date).toISOString().slice(0, 16) : "",
            end_date: surveyData.end_date ? new Date(surveyData.end_date).toISOString().slice(0, 16) : "",
          });
        }

        // 섹션 로드
        const { data: sectionsData, error: sectionsError } = await supabase
          .from("survey_sections")
          .select("*")
          .eq("survey_id", id)
          .order("order_index");
        
        if (sectionsError) throw sectionsError;
        setSections(sectionsData || []);

        // 질문 로드
        const { data: questionsData, error: questionsError } = await supabase
          .from("survey_questions")
          .select("*")
          .eq("survey_id", id)
          .order("order_index");
        
        if (questionsError) throw questionsError;
        
        // Cast the questions data to match our interface
        const typedQuestions = (questionsData || []).map(q => ({
          ...q,
          scope: (q.scope as 'session' | 'operation') || 'session'
        }));
        setQuestions(typedQuestions);
        
      } catch (error: any) {
        console.error(error);
        toast({ 
          title: "오류", 
          description: error.message || "설문 정보를 불러오지 못했습니다.", 
          variant: "destructive" 
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [id, toast]);

  // 제목 자동 생성 (과정명 + 일차 + 과목명)
  const selectedCourseTitle = useMemo(
    () => courses.find((c) => c.id === form.course_id)?.title ?? "",
    [courses, form.course_id]
  );

  useEffect(() => {
    const year2 = String(form.education_year ?? "").slice(-2);
    const r = form.education_round ?? 1;
    const d = form.education_day ?? 1;
    const program = form.course_name || "";

    if (year2 && r && d && program && selectedCourseTitle) {
      const prefix = `(${year2}-${r}차 ${program} ${d}일차)`;
      const title = `${prefix} ${selectedCourseTitle}`;
      setForm((prev) => ({ ...prev, title }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.education_year, form.education_round, form.education_day, form.course_name, form.course_id, selectedCourseTitle]);

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

  const onChange = <K extends keyof Survey>(key: K, value: Survey[K] | any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // 질문 삭제
  const deleteQuestion = async (questionId: string) => {
    try {
      const { error } = await supabase
        .from('survey_questions')
        .delete()
        .eq('id', questionId);
      
      if (error) throw error;
      
      setQuestions(prev => prev.filter(q => q.id !== questionId));
      toast({ title: '성공', description: '질문이 삭제되었습니다.' });
    } catch (error: any) {
      console.error(error);
      toast({ title: '오류', description: error.message || '질문 삭제 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  // 질문 저장 후 새로고침
  const handleQuestionSave = async () => {
    try {
      const { data: questionsData, error } = await supabase
        .from("survey_questions")
        .select("*")
        .eq("survey_id", id)
        .order("order_index");
      
      if (error) throw error;
      
      // Cast the questions data to match our interface
      const typedQuestions = (questionsData || []).map(q => ({
        ...q,
        scope: (q.scope as 'session' | 'operation') || 'session'
      }));
      setQuestions(typedQuestions);
    } catch (error: any) {
      console.error(error);
    }
  };

  const saveInfo = async () => {
    if (!id) return;
    setSaving(true);
    try {
      // 유효성 (합반일 때 범위 필수)
      if (form.course_name === "BS Advanced" && form.is_combined) {
        if (!form.combined_round_start || !form.combined_round_end) {
          throw new Error("합반을 선택한 경우 시작/종료 차수를 입력하세요.");
        }
        if ((form.combined_round_start as number) > (form.combined_round_end as number)) {
          throw new Error("합반 차수의 시작은 종료보다 클 수 없습니다.");
        }
      }

      // 라벨 자동 채움
      let round_label = (form.round_label ?? "").trim();
      if (form.course_name === "BS Advanced" && form.is_combined && !round_label) {
        round_label = `${form.education_year}년 ${form.combined_round_start}∼${form.combined_round_end}차 - BS Advanced`;
      }

      const payload = {
        title: form.title,
        description: form.description ?? "",
        start_date: form.start_date ? new Date(String(form.start_date) + ":00+09:00").toISOString() : null,
        end_date: form.end_date ? new Date(String(form.end_date) + ":00+09:00").toISOString() : null,
        education_year: Number(form.education_year),
        education_round: Number(form.education_round),
        education_day: Number(form.education_day) || 1,
        course_id: form.course_id || null,
        course_name: form.course_name || null,
        // ✅ 합반 필드
        is_combined: !!form.is_combined,
        combined_round_start: form.is_combined ? Number(form.combined_round_start) : null,
        combined_round_end: form.is_combined ? Number(form.combined_round_end) : null,
        round_label: form.is_combined ? round_label : null,
      };

      const { error } = await supabase.from("surveys").update(payload).eq("id", id);
      if (error) throw error;

      toast({ title: "저장 완료", description: "설문 기본 정보가 저장되었습니다." });
    } catch (e: any) {
      toast({ title: "저장 실패", description: e.message || "정보 저장 중 오류", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6">로딩 중…</div>;
  }

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          뒤로
        </Button>
        <h1 className="text-lg font-semibold">설문 편집</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>과목</Label>
              <Select
                value={String(form.course_id || "")}
                onValueChange={(v) => onChange("course_id", v)}
              >
                <SelectTrigger><SelectValue placeholder="과목 선택" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>과정 (프로그램)</Label>
              <Select
                value={String(form.course_name || "")}
                onValueChange={(v) => onChange("course_name", v)}
              >
                <SelectTrigger><SelectValue placeholder="과정 선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BS Basic">BS Basic</SelectItem>
                  <SelectItem value="BS Advanced">BS Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>교육 연도</Label>
              <Input type="number" value={form.education_year ?? ""} onChange={(e) => onChange("education_year", Number(e.target.value))} />
            </div>
            <div>
              <Label>차수</Label>
              <Input type="number" value={form.education_round ?? 1} onChange={(e) => onChange("education_round", Number(e.target.value))} />
            </div>
            <div>
              <Label>일차</Label>
              <Input type="number" value={form.education_day ?? 1} onChange={(e) => onChange("education_day", Number(e.target.value))} />
            </div>
            <div>
              <Label>제목 (자동)</Label>
              <Input value={form.title ?? ""} readOnly />
            </div>
          </div>

          {/* ✅ 합반 입력: BS Advanced일 때만 */}
          {form.course_name === "BS Advanced" && (
            <div className="space-y-3 border rounded-md p-3">
              <div className="flex items-center gap-2">
                <input
                  id="is_combined"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={!!form.is_combined}
                  onChange={(e) => onChange("is_combined", e.target.checked)}
                />
                <Label htmlFor="is_combined">합반(여러 차수를 묶어 동일 설문으로 운영)</Label>
              </div>

              {form.is_combined && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>시작 차수</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.combined_round_start ?? ""}
                      onChange={(e) => onChange("combined_round_start", Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>종료 차수</Label>
                    <Input
                      type="number"
                      min={form.combined_round_start ?? 1}
                      value={form.combined_round_end ?? ""}
                      onChange={(e) => onChange("combined_round_end", Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>합반 라벨(선택)</Label>
                    <Input
                      placeholder="미입력 시 자동 생성"
                      value={form.round_label ?? ""}
                      onChange={(e) => onChange("round_label", e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>시작일시</Label>
              <Input
                type="datetime-local"
                value={String(form.start_date || "")}
                onChange={(e) => onChange("start_date", e.target.value)}
              />
            </div>
            <div>
              <Label>종료일시</Label>
              <Input
                type="datetime-local"
                value={String(form.end_date || "")}
                onChange={(e) => onChange("end_date", e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>설명</Label>
            <Textarea value={form.description ?? ""} onChange={(e) => onChange("description", e.target.value)} rows={3} />
          </div>

          <div className="flex justify-end">
            <Button onClick={saveInfo} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "저장 중…" : "정보 저장"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 이 아래는 문항 구성/섹션 등 기존 빌더 UI가 있었다면 그대로 유지하세요 */}
    </div>
  );
}