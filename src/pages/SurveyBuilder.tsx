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
import { ArrowLeft, Save, Plus, Trash2, Edit3, GripVertical, Download, FolderPlus, Copy, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import QuestionEditForm from "@/components/QuestionEditForm";
import { SessionManager } from "@/components/SessionManager";

type Survey = {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  education_year: number;
  education_round: number;
  education_day: number | null;
  course_id: string | null;
  course_name: string | null;
  instructor_id: string | null;
  status: string;
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

type SurveySession = {
  id: string;
  survey_id: string;
  course_id: string | null;
  instructor_id: string | null;
  session_name: string;
  session_order: number;
  course?: Course;
  instructor?: Instructor;
};

type Instructor = {
  id: string;
  name: string;
  email?: string;
  photo_url?: string;
  bio?: string;
};

export default function SurveyBuilder() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isValidUUID = (id: string): boolean => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  };

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [notFound, setNotFound] = useState(false);
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [sections, setSections] = useState<SurveySection[]>([]);
  const [sessions, setSessions] = useState<SurveySession[]>([]);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [customCourses, setCustomCourses] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  
  const [editingQuestion, setEditingQuestion] = useState<SurveyQuestion | null>(null);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  
  const [templates, setTemplates] = useState<any[]>([]);
  const [importTemplateOpen, setImportTemplateOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<SurveySection | null>(null);
  const [sectionForm, setSectionForm] = useState({ name: "", description: "" });
  
  const [editingSession, setEditingSession] = useState<string | null>(null);

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

      const currentSessionQuestions = editingSession 
        ? questions.filter(q => q.session_id === editingSession)
        : questions.filter(q => !q.session_id);

      const newQuestions = templateQuestions?.map((tq, index) => ({
        survey_id: surveyId!,
        question_text: tq.question_text,
        question_type: tq.question_type,
        options: tq.options,
        is_required: tq.is_required,
        satisfaction_type: tq.satisfaction_type,
        order_index: currentSessionQuestions.length + index,
        scope: 'session' as const,
        session_id: editingSession || null,
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
      await handleQuestionSave();
    }
  };

  // 세션별 질문 그룹화
  const questionsBySession = useMemo(() => {
    const grouped: { [key: string]: SurveyQuestion[] } = {
      unassigned: questions.filter(q => !q.session_id)
    };
    
    sessions.forEach(session => {
      grouped[session.id] = questions.filter(q => q.session_id === session.id);
    });
    
    return grouped;
  }, [questions, sessions]);

  // 섹션별 질문 그룹화 (기존 섹션 시스템 호환)
  const questionsBySection = useMemo(() => {
    const grouped: { [key: string]: SurveyQuestion[] } = {
      unassigned: questions.filter(q => !q.section_id && !q.session_id)
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
    course_name: "",
    instructor_id: null,
    is_combined: false,
    combined_round_start: null,
    combined_round_end: null,
    round_label: "",
  });

  // 과목과 강사 목록 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: coursesData, error: coursesError } = await supabase
          .from("courses")
          .select("id,title")
          .order("title");
        if (coursesError) throw coursesError;
        setCourses(coursesData ?? []);

        const { data: instructorsData, error: instructorsError } = await supabase
          .from("instructors")
          .select("id,name,email,photo_url,bio")
          .order("name");
        if (instructorsError) throw instructorsError;
        setInstructors(instructorsData ?? []);
      } catch (error: any) {
        console.error(error);
        toast({ title: "오류", description: "데이터를 불러오지 못했습니다.", variant: "destructive" });
      }
    };
    
    loadData();
  }, []);

  // 설문 로드
  useEffect(() => {
    if (!surveyId) {
      setErrorMsg("설문 ID가 URL에서 누락되었습니다.");
      setLoading(false);
      return;
    }

    if (!isValidUUID(surveyId)) {
      setErrorMsg(`잘못된 설문 주소입니다. 올바른 UUID 형식이 아닙니다.`);
      setLoading(false);
      return;
    }
    
    const loadSurveyData = async () => {
      setLoading(true);
      setErrorMsg("");
      setNotFound(false);
      
      try {
        // 1. 설문 기본 정보 로드
        const { data: surveyData, error: surveyError } = await supabase
          .from("surveys")
          .select('*')
          .eq("id", surveyId)
          .maybeSingle();
        
        if (surveyError) {
          throw new Error(`설문 조회 실패: ${surveyError.message}`);
        }
        
        if (!surveyData) {
          setNotFound(true);
          return;
        }

        setForm({
          ...surveyData,
          start_date: surveyData.start_date ? 
            new Date(surveyData.start_date).toISOString().slice(0, 16) : "",
          end_date: surveyData.end_date ? 
            new Date(surveyData.end_date).toISOString().slice(0, 16) : "",
        });

        // 커스텀 과정 복원
        if (surveyData.course_name && 
            surveyData.course_name !== 'BS Basic' && 
            surveyData.course_name !== 'BS Advanced' && 
            surveyData.course_name.trim() !== '') {
          const courseName = surveyData.course_name.trim();
          setCustomCourses(prev => {
            const updated = prev.includes(courseName) ? prev : [...prev, courseName];
            return updated;
          });
        }

        // 2. 섹션 로드
        try {
          const { data: sectionsData, error: sectionsError } = await supabase
            .from("survey_sections")
            .select('*')
            .eq("survey_id", surveyId)
            .order("order_index");
          
          if (sectionsError) {
            console.warn("Sections loading error (non-critical):", sectionsError);
          }
          setSections(sectionsData || []);
        } catch (sectionError) {
          console.warn("Section loading failed (non-critical):", sectionError);
          setSections([]);
        }

        // 3. 세션 로드
        try {
          const { data: sessionsData, error: sessionsError } = await supabase
            .from("survey_sessions")
            .select(`
              *,
              course:courses(id, title),
              instructor:instructors(id, name, email, photo_url, bio)
            `)
            .eq("survey_id", surveyId)
            .order("session_order");
          
          if (sessionsError) {
            console.warn("Sessions loading error (non-critical):", sessionsError);
          }
          setSessions(sessionsData || []);
        } catch (sessionError) {
          console.warn("Session loading failed (non-critical):", sessionError);
          setSessions([]);
        }

        // 4. 질문 로드
        try {
          const { data: questionsData, error: questionsError } = await supabase
            .from("survey_questions")
            .select('*')
            .eq("survey_id", surveyId)
            .order("order_index");
          
          if (questionsError) {
            console.warn("Questions loading error (non-critical):", questionsError);
          }
          
          const typedQuestions = (questionsData || []).map(q => ({
            ...q,
            scope: (q.scope as 'session' | 'operation') || 'session'
          }));
          setQuestions(typedQuestions);
        } catch (questionError) {
          console.warn("Question loading failed (non-critical):", questionError);
          setQuestions([]);
        }
        
      } catch (error: any) {
        console.error("Critical loading error:", error);
        setErrorMsg(error.message || "데이터 로딩 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    loadSurveyData();
  }, [surveyId]);

  // 제목 자동 생성 수정
  const selectedCourseTitle = useMemo(
    () => courses.find((c) => c.id === form.course_id)?.title ?? "",
    [courses, form.course_id]
  );

  useEffect(() => {
    const year = String(form.education_year ?? "");
    const r = form.education_round ?? 1;
    const d = form.education_day ?? 1;
    const program = form.course_name || "";

    if (year && r && d && program && selectedCourseTitle) {
      const title = `${year}-${program}-${r}차-${d}일차 ${selectedCourseTitle}`;
      setForm((prev) => ({ ...prev, title }));
    }
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
    if (!surveyId) return;
    
    setSaving(true);
    
    try {
      if (form.course_name === "BS Advanced" && form.is_combined) {
        if (!form.combined_round_start || !form.combined_round_end) {
          throw new Error("합반을 선택한 경우 시작/종료 차수를 입력하세요.");
        }
        if ((form.combined_round_start as number) > (form.combined_round_end as number)) {
          throw new Error("합반 차수의 시작은 종료보다 클 수 없습니다.");
        }
      }

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

  // 로딩 상태
  if (loading) {
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

  // 에러 상태
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

  // 설문 없음 상태
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

      {/* 기본 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>과목</Label>
              <Select
                value={form.course_id || undefined}
                onValueChange={(v) => onChange("course_id", v)}
              >
                <SelectTrigger><SelectValue placeholder="과목 선택" /></SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>과정 (프로그램)</Label>
              <Select
                value={form.course_name || undefined}
                onValueChange={(v) => onChange("course_name", v)}
              >
                <SelectTrigger><SelectValue placeholder="과정 선택" /></SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="BS Basic">BS Basic</SelectItem>
                  <SelectItem value="BS Advanced">BS Advanced</SelectItem>
                  {customCourses.map((course) => (
                    <SelectItem key={course} value={course}>
                      {course}
                    </SelectItem>
                  ))}
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
                          min="1"
                          value={form.combined_round_end ?? ""}
                          onChange={(e) => onChange("combined_round_end", Number(e.target.value))}
                          placeholder="종료 차수"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>합반 라벨 (자동생성됨)</Label>
                      <Input
                        value={form.round_label ?? ""}
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
                value={form.start_date ?? ""}
                onChange={(e) => onChange("start_date", e.target.value)}
              />
            </div>
            <div>
              <Label>종료일시</Label>
              <Input
                type="datetime-local"
                value={form.end_date ?? ""}
                onChange={(e) => onChange("end_date", e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>설명</Label>
            <Textarea
              placeholder="설문에 대한 설명을 입력하세요"
              value={form.description ?? ""}
              onChange={(e) => onChange("description", e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={saveInfo} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "저장 중..." : "기본 정보 저장"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 세션 관리 */}
      <Card>
        <CardHeader>
          <CardTitle>일차별 과목 및 강사 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <SessionManager 
            surveyId={surveyId!}
            sessions={sessions}
            onSessionsChange={setSessions}
            courses={courses}
            instructors={instructors}
          />
        </CardContent>
      </Card>

      {/* 섹션 관리 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>섹션 관리</CardTitle>
            <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <FolderPlus className="h-4 w-4 mr-2" />
                  섹션 추가
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingSection ? '섹션 수정' : '새 섹션 추가'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>섹션 이름</Label>
                    <Input 
                      value={sectionForm.name}
                      onChange={(e) => setSectionForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="섹션 이름을 입력하세요"
                    />
                  </div>
                  <div>
                    <Label>설명 (선택사항)</Label>
                    <Textarea 
                      value={sectionForm.description}
                      onChange={(e) => setSectionForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="섹션 설명을 입력하세요"
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => {
                      setSectionDialogOpen(false);
                      setEditingSection(null);
                      setSectionForm({ name: "", description: "" });
                    }}>
                      취소
                    </Button>
                    <Button onClick={handleSectionSave}>
                      {editingSection ? '수정' : '추가'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {sections.length > 0 ? (
            <div className="grid gap-2">
              {sections.map((section) => (
                <div key={section.id} className="flex items-center justify-between p-2 border rounded bg-background">
                  <div>
                    <span className="font-medium">{section.name}</span>
                    {section.description && (
                      <p className="text-sm text-muted-foreground">{section.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingSection(section);
                        setSectionForm({
                          name: section.name,
                          description: section.description || "",
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
          ) : (
            <p className="text-sm text-muted-foreground">등록된 섹션이 없습니다.</p>
          )}
        </CardContent>
      </Card>

      {/* 설문 질문 - 스크린샷 3 스타일로 개선 */}
      <div className="space-y-6">
        {/* 세션별 질문 목록 */}
        <div className="space-y-8">
          {sessions.map((session, sessionIndex) => {
            const sessionQuestions = questionsBySession[session.id] || [];
            let globalQuestionNumber = 1;
            
            // 이전 세션들의 질문 개수 누적
            for (let i = 0; i < sessionIndex; i++) {
              const prevSessionQuestions = questionsBySession[sessions[i].id] || [];
              globalQuestionNumber += prevSessionQuestions.length;
            }

            return (
              <div key={session.id} className="bg-white rounded-lg border shadow-sm">
                {/* 섹션 헤더 */}
                <div className="bg-primary text-primary-foreground p-4 rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {session.course?.title || '과목 미선택'}
                      </h2>
                      <p className="text-sm opacity-90">
                        강사: {session.instructor?.name || '강사 미선택'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Dialog open={importTemplateOpen && editingSession === session.id} 
                              onOpenChange={(open) => {
                                setImportTemplateOpen(open);
                                if (open) setEditingSession(session.id);
                                else setEditingSession(null);
                              }}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => setEditingSession(session.id)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            템플릿 가져오기
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>템플릿에서 질문 가져오기</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>템플릿 선택</Label>
                              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                                <SelectTrigger>
                                  <SelectValue placeholder="템플릿을 선택하세요" />
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
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => {
                                setImportTemplateOpen(false);
                                setEditingSession(null);
                              }}>
                                취소
                              </Button>
                              <Button onClick={importFromTemplate}>
                                가져오기
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <Button 
                        variant="secondary"
                        size="sm" 
                        onClick={() => {
                          setEditingSession(session.id);
                          setEditingQuestion(null);
                          setQuestionDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        질문 추가
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 질문 목록 */}
                <div className="p-6">
                  {sessionQuestions.length > 0 ? (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={sessionQuestions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-4">
                          {sessionQuestions.map((question, questionIndex) => (
                            <SectionQuestionItem
                              key={question.id}
                              question={question}
                              questionNumber={globalQuestionNumber + questionIndex}
                              onEdit={(q) => {
                                setEditingQuestion(q);
                                setQuestionDialogOpen(true);
                              }}
                              onDelete={deleteQuestion}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-muted rounded-lg">
                      <div className="space-y-2">
                        <p className="text-lg">이 섹션에는 아직 질문이 없습니다</p>
                        <p className="text-sm">위의 "질문 추가" 또는 "템플릿 가져오기" 버튼을 사용해 질문을 추가해보세요</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* 섹션별 질문 (기존 시스템) */}
          {sections.map((section, sectionIndex) => {
            const sectionQuestions = questionsBySection[section.id] || [];
            if (sectionQuestions.length === 0) return null;

            let globalQuestionNumber = 1;
            
            // 이전 세션들과 섹션들의 질문 개수 누적
            sessions.forEach(session => {
              globalQuestionNumber += (questionsBySession[session.id] || []).length;
            });
            
            for (let i = 0; i < sectionIndex; i++) {
              const prevSectionQuestions = questionsBySection[sections[i].id] || [];
              globalQuestionNumber += prevSectionQuestions.length;
            }

            return (
              <div key={section.id} className="bg-white rounded-lg border shadow-sm">
                <div className="bg-green-600 text-white p-4 rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">{section.name}</h2>
                      {section.description && (
                        <p className="text-sm opacity-90">{section.description}</p>
                      )}
                    </div>
                    <Button 
                      variant="secondary"
                      size="sm" 
                      onClick={() => {
                        setEditingSession(null);
                        setEditingQuestion(null);
                        setQuestionDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      질문 추가
                    </Button>
                  </div>
                </div>

                <div className="p-6">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={sectionQuestions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-4">
                        {sectionQuestions.map((question, questionIndex) => (
                          <SectionQuestionItem
                            key={question.id}
                            question={question}
                            questionNumber={globalQuestionNumber + questionIndex}
                            onEdit={(q) => {
                              setEditingQuestion(q);
                              setQuestionDialogOpen(true);
                            }}
                            onDelete={deleteQuestion}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              </div>
            );
          })}

          {/* 미분류 질문들 */}
          {questionsBySection.unassigned && questionsBySection.unassigned.length > 0 && (
            <div className="bg-white rounded-lg border shadow-sm">
              <div className="bg-muted text-muted-foreground p-4 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">미분류 질문</h2>
                  <Button 
                    size="sm" 
                    onClick={() => {
                      setEditingSession(null);
                      setEditingQuestion(null);
                      setQuestionDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    질문 추가
                  </Button>
                </div>
              </div>
              <div className="p-6">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={questionsBySection.unassigned.map(q => q.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4">
                      {questionsBySection.unassigned.map((question, index) => {
                        const totalPreviousQuestions = sessions.reduce((acc, session) => {
                          return acc + (questionsBySession[session.id] || []).length;
                        }, 0) + sections.reduce((acc, section) => {
                          return acc + (questionsBySection[section.id] || []).length;
                        }, 0);
                        
                        return (
                          <SectionQuestionItem
                            key={question.id}
                            question={question}
                            questionNumber={totalPreviousQuestions + index + 1}
                            onEdit={(q) => {
                              setEditingQuestion(q);
                              setQuestionDialogOpen(true);
                            }}
                            onDelete={deleteQuestion}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          )}

          {/* 전체 질문이 없을 때 */}
          {sessions.length === 0 && sections.length === 0 && questions.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-muted rounded-lg">
              <div className="space-y-4">
                <div className="text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-2" />
                  <p className="text-lg font-medium">아직 설문이 구성되지 않았습니다</p>
                  <p className="text-sm">먼저 세션을 추가하고, 질문을 만들어보세요</p>
                </div>
                <div className="flex justify-center gap-2">
                  <Button 
                    onClick={() => {
                      setEditingSession(null);
                      setEditingQuestion(null);
                      setQuestionDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    첫 질문 추가하기
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 질문 편집 다이얼로그 */}
        <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingQuestion ? '질문 수정' : '새 질문 추가'}</DialogTitle>
            </DialogHeader>
            <QuestionEditForm
              question={editingQuestion}
              surveyId={surveyId!}
              sections={sections}
              sessions={sessions}
              onSave={async () => {
                await handleQuestionSave();
                setQuestionDialogOpen(false);
                setEditingQuestion(null);
                setEditingSession(null);
                toast({ 
                  title: '성공', 
                  description: editingQuestion ? '질문이 수정되었습니다.' : '질문이 추가되었습니다.' 
                });
              }}
              onCancel={() => {
                setQuestionDialogOpen(false);
                setEditingQuestion(null);
                setEditingSession(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// 개선된 질문 아이템 컴포넌트 (스크린샷 3 스타일)
interface SectionQuestionItemProps {
  question: SurveyQuestion;
  questionNumber: number;
  onEdit: (question: SurveyQuestion) => void;
  onDelete: (questionId: string) => void;
}

function SectionQuestionItem({ question, questionNumber, onEdit, onDelete }: SectionQuestionItemProps) {
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
      className={`bg-card border rounded-lg p-4 ${isDragging ? 'z-50' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div 
          {...attributes} 
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-start gap-3">
            <span className="text-lg font-semibold text-primary min-w-[2rem]">
              {String(questionNumber).padStart(2, '0')}.
            </span>
            <div className="flex-1">
              <p className="text-base mb-3 leading-relaxed">{question.question_text}</p>
              
              <div className="flex flex-wrap gap-2 mb-2">
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                  {question.question_type === 'multiple_choice' && '☑️ 복수선택'}
                  {question.question_type === 'single_choice' && '⚪ 단일선택'}
                  {question.question_type === 'dropdown' && '📋 드롭다운'}
                  {question.question_type === 'text' && '✏️ 주관식'}
                  {question.question_type === 'textarea' && '📝 장문형'}
                  {question.question_type === 'rating' && '⭐ 평점'}
                  {question.question_type === 'scale' && '📊 척도 (1-10)'}
                </span>
                
                {question.satisfaction_type && (
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                    {question.satisfaction_type === 'instructor' && '👨‍🏫 강사'}
                    {question.satisfaction_type === 'course' && '📚 과목'}  
                    {question.satisfaction_type === 'operation' && '⚙️ 운영'}
                  </span>
                )}
                
                {question.is_required && (
                  <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                    ⚠️ 필수
                  </span>
                )}
              </div>

              {(() => {
                const list = Array.isArray(question.options)
                  ? question.options
                  : (question.options?.options ?? []);
                return list && list.length > 0 ? (
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3">
                    <strong>선택 옵션:</strong> {list.join(' • ')}
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        </div>
        
        <div className="flex gap-1">
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