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
import { ArrowLeft, Save, Plus, Trash2, Edit3, GripVertical, Download, FolderPlus, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  
  // 기본 상태 변수들
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<SurveySection[]>([]);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  
  // 질문 편집 관련 상태
  const [editingQuestion, setEditingQuestion] = useState<SurveyQuestion | null>(null);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  
  // 템플릿 관련 상태
  const [templates, setTemplates] = useState<any[]>([]);
  const [importTemplateOpen, setImportTemplateOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  
  // 섹션 관리 관련 상태
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<SurveySection | null>(null);
  const [sectionForm, setSectionForm] = useState({ name: "", description: "" });

  // 드래그 앤 드롭 센서
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 템플릿 목록 로드
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const { data, error } = await supabase
          .from('survey_templates')
          .select('*')
          .order('name');
        
        if (error) throw error;
        setTemplates(data || []);
      } catch (error) {
        console.error('Templates loading error:', error);
      }
    };
    
    loadTemplates();
  }, []);

  // 섹션 추가/수정
  const handleSectionSave = async () => {
    if (!sectionForm.name.trim()) {
      toast({ title: "오류", description: "섹션 이름을 입력해주세요.", variant: "destructive" });
      return;
    }

    try {
      if (editingSection) {
        // 수정
        const { error } = await supabase
          .from('survey_sections')
          .update({
            name: sectionForm.name,
            description: sectionForm.description || null,
          })
          .eq('id', editingSection.id);
        
        if (error) throw error;
        
        setSections(prev => prev.map(s => 
          s.id === editingSection.id 
            ? { ...s, name: sectionForm.name, description: sectionForm.description }
            : s
        ));
        
        toast({ title: "성공", description: "섹션이 수정되었습니다." });
      } else {
        // 추가
        const { data, error } = await supabase
          .from('survey_sections')
          .insert({
            survey_id: surveyId,
            name: sectionForm.name,
            description: sectionForm.description || null,
            order_index: sections.length,
          })
          .select()
          .single();
        
        if (error) throw error;
        
        setSections(prev => [...prev, data]);
        toast({ title: "성공", description: "섹션이 추가되었습니다." });
      }
      
      setSectionDialogOpen(false);
      setEditingSection(null);
      setSectionForm({ name: "", description: "" });
    } catch (error: any) {
      console.error(error);
      toast({ title: "오류", description: error.message || "섹션 저장 중 오류가 발생했습니다.", variant: "destructive" });
    }
  };

  // 섹션 삭제
  const deleteSection = async (sectionId: string) => {
    try {
      const { error } = await supabase
        .from('survey_sections')
        .delete()
        .eq('id', sectionId);
      
      if (error) throw error;
      
      setSections(prev => prev.filter(s => s.id !== sectionId));
      
      // 해당 섹션의 질문들의 section_id를 null로 업데이트
      setQuestions(prev => prev.map(q => 
        q.section_id === sectionId ? { ...q, section_id: null } : q
      ));
      
      toast({ title: "성공", description: "섹션이 삭제되었습니다." });
    } catch (error: any) {
      console.error(error);
      toast({ title: "오류", description: error.message || "섹션 삭제 중 오류가 발생했습니다.", variant: "destructive" });
    }
  };

  // 템플릿에서 질문 가져오기
  const importFromTemplate = async () => {
    if (!selectedTemplateId) {
      toast({ title: "오류", description: "템플릿을 선택해주세요.", variant: "destructive" });
      return;
    }

    try {
      const { data: templateQuestions, error } = await supabase
        .from('template_questions')
        .select('*')
        .eq('template_id', selectedTemplateId)
        .order('order_index');
      
      if (error) throw error;

      const newQuestions = templateQuestions?.map(tq => ({
        survey_id: surveyId!,
        question_text: tq.question_text,
        question_type: tq.question_type,
        options: tq.options,
        is_required: tq.is_required,
        satisfaction_type: tq.satisfaction_type,
        order_index: questions.length + tq.order_index,
        scope: 'session' as const,
      })) || [];

      if (newQuestions.length === 0) {
        toast({ title: "알림", description: "선택한 템플릿에 질문이 없습니다." });
        return;
      }

      const { error: insertError } = await supabase
        .from('survey_questions')
        .insert(newQuestions);
      
      if (insertError) throw insertError;

      await handleQuestionSave();
      
      toast({ 
        title: "성공", 
        description: `${newQuestions.length}개의 질문을 가져왔습니다.` 
      });
      
      setImportTemplateOpen(false);
      setSelectedTemplateId("");
    } catch (error: any) {
      console.error(error);
      toast({ title: "오류", description: error.message || "템플릿 가져오기 중 오류가 발생했습니다.", variant: "destructive" });
    }
  };

  // 질문 순서 변경 (드래그 앤 드롭)
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    const oldIndex = questions.findIndex(q => q.id === active.id);
    const newIndex = questions.findIndex(q => q.id === over.id);
    
    const reorderedQuestions = arrayMove(questions, oldIndex, newIndex);
    setQuestions(reorderedQuestions);
    
    // 서버에 순서 업데이트
    try {
      const updatePromises = reorderedQuestions.map((question, index) =>
        supabase
          .from('survey_questions')
          .update({ order_index: index })
          .eq('id', question.id)
      );
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error updating question order:', error);
      // 실패시 원래 순서로 되돌림
      await handleQuestionSave();
    }
  };

  // 섹션별 질문 그룹화
  const questionsBySection = useMemo(() => {
    const grouped: { [key: string]: SurveyQuestion[] } = {
      unassigned: questions.filter(q => !q.section_id)
    };
    
    sections.forEach(section => {
      grouped[section.id] = questions.filter(q => q.section_id === section.id);
    });
    
    return grouped;
  }, [questions, sections]);

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

      {/* 질문 관리 섹션 - 개선된 버전 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>설문 질문</CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setEditingSection(null);
                setSectionForm({ name: "", description: "" });
                setSectionDialogOpen(true);
              }}
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              섹션 추가
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setImportTemplateOpen(true)}
              disabled={templates.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              템플릿에서 가져오기
            </Button>
            <Button onClick={() => {
              console.log('SurveyBuilder - 질문 추가 button clicked');
              setEditingQuestion(null);
              setQuestionDialogOpen(true);
              console.log('SurveyBuilder - Dialog should open now, questionDialogOpen:', true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              질문 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* 섹션 목록 표시 */}
          {sections.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">섹션 목록</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {sections.map((section) => (
                  <div key={section.id} className="flex items-center justify-between p-2 border rounded text-sm">
                    <span>{section.name}</span>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setEditingSection(section);
                          setSectionForm({ 
                            name: section.name, 
                            description: section.description || "" 
                          });
                          setSectionDialogOpen(true);
                        }}
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>섹션 삭제</AlertDialogTitle>
                            <AlertDialogDescription>
                              이 섹션을 삭제하시겠습니까? 섹션에 속한 질문들은 미분류로 이동됩니다.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>취소</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteSection(section.id)}>
                              삭제
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
            </div>
          )}

          {/* 질문 목록 */}
          {questions.length > 0 ? (
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <div className="space-y-6">
                {/* 미분류 질문들 */}
                {questionsBySection.unassigned.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-3 text-muted-foreground">미분류 질문</h3>
                    <SortableContext 
                      items={questionsBySection.unassigned.map(q => q.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {questionsBySection.unassigned.map((question) => (
                          <SortableQuestion 
                            key={question.id}
                            question={question}
                            onEdit={(q) => {
                              setEditingQuestion(q);
                              setQuestionDialogOpen(true);
                            }}
                            onDelete={deleteQuestion}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </div>
                )}

                {/* 섹션별 질문들 */}
                {sections.map((section) => (
                  questionsBySection[section.id]?.length > 0 && (
                    <div key={section.id}>
                      <h3 className="text-sm font-medium mb-3">{section.name}</h3>
                      <SortableContext 
                        items={questionsBySection[section.id].map(q => q.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {questionsBySection[section.id].map((question) => (
                            <SortableQuestion 
                              key={question.id}
                              question={question}
                              onEdit={(q) => {
                                setEditingQuestion(q);
                                setQuestionDialogOpen(true);
                              }}
                              onDelete={deleteQuestion}
                            />
                          ))}
                        </div>
                      </SortableContext>
                      <Separator className="mt-4" />
                    </div>
                  )
                ))}
              </div>
            </DndContext>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              아직 질문이 없습니다. 질문을 추가하거나 템플릿에서 가져와보세요.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 섹션 추가/수정 다이얼로그 */}
      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSection ? "섹션 수정" : "새 섹션 추가"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="section-name">섹션 이름</Label>
              <Input
                id="section-name"
                value={sectionForm.name}
                onChange={(e) => setSectionForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="섹션 이름을 입력하세요"
              />
            </div>
            <div>
              <Label htmlFor="section-description">섹션 설명 (선택사항)</Label>
              <Textarea
                id="section-description"
                value={sectionForm.description}
                onChange={(e) => setSectionForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="섹션에 대한 설명을 입력하세요"
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setSectionDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSectionSave}>
              {editingSection ? "수정" : "추가"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 템플릿 가져오기 다이얼로그 */}
      <Dialog open={importTemplateOpen} onOpenChange={setImportTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>템플릿에서 질문 가져오기</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="template-select">템플릿 선택</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="가져올 템플릿을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedTemplateId && (
              <div className="text-sm text-muted-foreground">
                선택한 템플릿의 모든 질문이 현재 설문에 추가됩니다.
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setImportTemplateOpen(false)}>
              취소
            </Button>
            <Button onClick={importFromTemplate} disabled={!selectedTemplateId}>
              <Copy className="h-4 w-4 mr-2" />
              가져오기
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
            sections={sections}
            onSave={async () => {
              console.log('SurveyBuilder - QuestionEditForm onSave called');
              await handleQuestionSave();
              console.log('SurveyBuilder - Closing dialog after save');
              setQuestionDialogOpen(false);
              setEditingQuestion(null);
            }}
            onCancel={() => {
              console.log('SurveyBuilder - QuestionEditForm onCancel called');
              setQuestionDialogOpen(false);
              setEditingQuestion(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sortable Question 컴포넌트 - 드래그 앤 드롭 지원
interface SortableQuestionProps {
  question: SurveyQuestion;
  onEdit: (question: SurveyQuestion) => void;
  onDelete: (questionId: string) => void;
}

function SortableQuestion({ question, onEdit, onDelete }: SortableQuestionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`border rounded-lg p-4 ${isDragging ? 'z-50' : ''}`}
    >
      <div className="flex items-start gap-2">
        <div 
          {...attributes} 
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-1 bg-muted rounded">
              {question.question_type}
            </span>
            {question.scope && (
              <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                {question.scope}
              </span>
            )}
            {question.satisfaction_type && (
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                {question.satisfaction_type}
              </span>
            )}
            {question.is_required && (
              <span className="text-xs text-destructive">필수</span>
            )}
          </div>
          <p className="text-sm mb-2">{question.question_text}</p>
          {question.options && (
            <div className="text-xs text-muted-foreground">
              옵션: {Array.isArray(question.options) 
                ? question.options.join(', ') 
                : question.options?.options?.join(', ') || 'N/A'
              }
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(question)}
          >
            <Edit3 className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>질문 삭제</AlertDialogTitle>
                <AlertDialogDescription>
                  이 질문을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(question.id)}>
                  삭제
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}