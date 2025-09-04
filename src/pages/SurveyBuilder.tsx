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
import QuestionEditForm from "@/components/QuestionEditForm";

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
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // UUID 형식 검증
  const isValidUUID = (id: string): boolean => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  };

  // 상태 분리: loading / errorMsg / notFound
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [notFound, setNotFound] = useState(false);
  
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

  // 설문 로드 - 개선된 로직 + UUID 검증
  useEffect(() => {
    if (!surveyId) {
      console.error("SurveyBuilder - No surveyId parameter found in URL");
      setErrorMsg("설문 ID가 URL에서 누락되었습니다.");
      setLoading(false);
      return;
    }

    console.log("SurveyBuilder - Received surveyId from URL:", surveyId, "Length:", surveyId.length);

    // UUID 형식 검증
    if (!isValidUUID(surveyId)) {
      console.error("SurveyBuilder - Invalid UUID format:", surveyId, "Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx");
      setErrorMsg(`잘못된 설문 주소입니다. 받은 ID: '${surveyId}' (${surveyId.length}자). 올바른 UUID 형식이 아닙니다.`);
      setLoading(false);
      return;
    }
    
    const loadSurveyData = async () => {
      console.log("SurveyBuilder - Starting to load survey data for ID:", surveyId);
      setLoading(true);
      setErrorMsg("");
      setNotFound(false);
      
      try {
        // 1. 설문 기본 정보 로드 - 관리자는 테스트 데이터도 편집 가능
        console.log("SurveyBuilder - Loading survey basic info...");
        const { data: surveyData, error: surveyError } = await supabase
          .from("surveys")
          .select('*') // 전체 컬럼 조회로 스키마 불일치 회피
          .eq("id", surveyId)
          .maybeSingle();
        
        console.log("SurveyBuilder - Survey data result:", { surveyData, surveyError });
        
        if (surveyError) {
          console.error("SurveyBuilder - Survey loading error:", surveyError);
          throw new Error(`설문 조회 실패: ${surveyError.message}`);
        }
        
        if (!surveyData) {
          console.log("SurveyBuilder - No survey data found");
          setNotFound(true);
          return;
        }

        console.log("SurveyBuilder - Setting form data:", surveyData);
        setForm({
          ...surveyData,
          // datetime-local 포맷 보정 (YYYY-MM-DDTHH:mm)
          start_date: surveyData.start_date ? 
            new Date(surveyData.start_date).toISOString().slice(0, 16) : "",
          end_date: surveyData.end_date ? 
            new Date(surveyData.end_date).toISOString().slice(0, 16) : "",
        });

        // 2. 섹션 로드 - 실패해도 계속 진행
        console.log("SurveyBuilder - Loading sections...");
        try {
          const { data: sectionsData, error: sectionsError } = await supabase
            .from("survey_sections")
            .select('*') // 전체 컬럼 조회
            .eq("survey_id", surveyId)
            .order("order_index");
          
          console.log("SurveyBuilder - Sections result:", { sectionsData, sectionsError });
          
          if (sectionsError) {
            console.warn("SurveyBuilder - Sections loading error (non-critical):", sectionsError);
          }
          setSections(sectionsData || []);
        } catch (sectionError) {
          console.warn("SurveyBuilder - Section loading failed (non-critical):", sectionError);
          setSections([]);
        }

        // 3. 질문 로드 - 실패해도 계속 진행
        console.log("SurveyBuilder - Loading questions...");
        try {
          const { data: questionsData, error: questionsError } = await supabase
            .from("survey_questions")
            .select('*') // 전체 컬럼 조회
            .eq("survey_id", surveyId)
            .order("order_index");
          
          console.log("SurveyBuilder - Questions result:", { questionsData, questionsError });
          
          if (questionsError) {
            console.warn("SurveyBuilder - Questions loading error (non-critical):", questionsError);
          }
          
          // Cast the questions data to match our interface
          const typedQuestions = (questionsData || []).map(q => ({
            ...q,
            scope: (q.scope as 'session' | 'operation') || 'session'
          }));
          console.log("SurveyBuilder - Typed questions:", typedQuestions);
          setQuestions(typedQuestions);
        } catch (questionError) {
          console.warn("SurveyBuilder - Question loading failed (non-critical):", questionError);
          setQuestions([]);
        }
        
      } catch (error: any) {
        console.error("SurveyBuilder - Critical loading error:", error);
        setErrorMsg(error.message || "데이터 로딩 중 오류가 발생했습니다.");
      } finally {
        console.log("SurveyBuilder - Loading completed");
        setLoading(false);
      }
    };

    loadSurveyData();
  }, [surveyId]);

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
        .eq("survey_id", surveyId)
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

  const [saving, setSaving] = useState(false);

  const saveInfo = async () => {
    if (!surveyId) return;
    
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

      const { error } = await supabase.from("surveys").update(payload).eq("id", surveyId);
      if (error) throw error;

      toast({ title: "저장 완료", description: "설문 기본 정보가 저장되었습니다." });
    } catch (e: any) {
      toast({ title: "저장 실패", description: e.message || "정보 저장 중 오류", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // 로딩 상태 처리
  if (loading) {
    console.log("SurveyBuilder - Still loading...");
    return (
      <div className="container mx-auto p-4 lg:p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  // 에러 상태 처리
  if (errorMsg) {
    return (
      <div className="container mx-auto p-4 lg:p-6">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            뒤로
          </Button>
          <h1 className="text-lg font-semibold">설문 편집</h1>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="text-destructive mb-4">⚠️</div>
            <h3 className="text-lg font-medium mb-2">오류가 발생했습니다</h3>
            <p className="text-muted-foreground mb-4">{errorMsg}</p>
            <Button onClick={() => window.location.reload()}>
              다시 시도
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 설문 없음 상태 처리
  if (notFound) {
    return (
      <div className="container mx-auto p-4 lg:p-6">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            뒤로
          </Button>
          <h1 className="text-lg font-semibold">설문 편집</h1>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="text-muted-foreground mb-4">📝</div>
            <h3 className="text-lg font-medium mb-2">설문을 찾을 수 없습니다</h3>
            <p className="text-muted-foreground mb-4">요청하신 설문이 존재하지 않거나 접근 권한이 없습니다.</p>
            <Button onClick={() => navigate(-1)}>
              목록으로 돌아가기
            </Button>
          </div>
        </div>
      </div>
    );
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
                      checked={!!form.is_combined}
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
                            value={form.combined_round_start ?? ""}
                            onChange={(e) => onChange("combined_round_start", Number(e.target.value))}
                            placeholder="시작 차수"
                          />
                        </div>
                        <div>
                          <Label>종료 차수</Label>
                          <Input
                            type="number"
                            min={form.combined_round_start ?? 1}
                            value={form.combined_round_end ?? ""}
                            onChange={(e) => onChange("combined_round_end", Number(e.target.value))}
                            placeholder="종료 차수"
                          />
                        </div>
                      </div>

                      <div>
                        <Label>합반 라벨 (자동 생성됨)</Label>
                        <Input
                          value={form.round_label ?? ""}
                          onChange={(e) => onChange("round_label", e.target.value)}
                          placeholder="예: 2024년 1∼3차 - BS Advanced"
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
              {saving ? "저장 중..." : "정보 저장"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 질문 관리 섹션 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>설문 질문</CardTitle>
          <Button onClick={() => {
            setEditingQuestion(null);
            setQuestionDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            질문 추가
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {questions.map((question, index) => (
              <div key={question.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium">질문 {index + 1}</span>
                      <span className="text-xs px-2 py-1 bg-muted rounded">
                        {question.question_type}
                      </span>
                      {question.scope && (
                        <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                          {question.scope}
                        </span>
                      )}
                      {question.is_required && (
                        <span className="text-xs text-destructive">필수</span>
                      )}
                    </div>
                    <p className="text-sm mb-2">{question.question_text}</p>
                    {question.options && (
                      <div className="text-xs text-muted-foreground">
                        옵션: {JSON.stringify(question.options)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingQuestion(question);
                        setQuestionDialogOpen(true);
                      }}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteQuestion(question.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {questions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                아직 질문이 없습니다. 질문을 추가해보세요.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 질문 편집 다이얼로그 */}
      <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? "질문 편집" : "새 질문 추가"}
            </DialogTitle>
          </DialogHeader>
          <QuestionEditForm
            question={editingQuestion}
            surveyId={surveyId!}
            onSave={async () => {
              await handleQuestionSave();
              setQuestionDialogOpen(false);
              setEditingQuestion(null);
            }}
            onCancel={() => {
              setQuestionDialogOpen(false);
              setEditingQuestion(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}