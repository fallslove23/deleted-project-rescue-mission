// src/pages/SurveyBuilder.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Pencil, Trash2, Plus, Settings, Edit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import QuestionEditForm from "@/components/QuestionEditForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
// Course names will be managed directly in this component

// ---------- helpers ----------
const pad = (n: number) => String(n).padStart(2, "0");

/** 'YYYY-MM-DDTHH:mm' (브라우저 로컬 기준) */
function toLocalInputStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** 기본값: 작성 시점 기준 다음날 09:00/19:00 (로컬) */
function getDefaultStartEndLocal() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const start = new Date(next);
  start.setHours(9, 0, 0, 0);
  const end = new Date(next);
  end.setHours(19, 0, 0, 0);
  return { startLocal: toLocalInputStr(start), endLocal: toLocalInputStr(end) };
}

function toLocalDateTime(iso: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return toLocalInputStr(d);
  } catch {
    return "";
  }
}
function toSafeISOString(local: string | null) {
  if (!local) return null;
  try {
    const d = new Date(local);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}
function buildTitle(
  year: number | null,
  round: number | null,
  day: number | null,
  courseName: string | null
) {
  if (!year || !round || !day || !courseName) return "";
  return `${year}-${courseName}-${round}차-${day}일차 설문`;
}

// ---------- types ----------
type Survey = {
  id: string;
  title: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  education_year: number | null;
  education_round: number | null;
  education_day: number | null;
  course_name: string | null;
  expected_participants: number | null;
  is_test: boolean | null;
  status: "draft" | "active" | "public" | "completed" | null;
  created_at: string | null;
  updated_at: string | null;
};

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

type Section = {
  id: string;
  name: string;
  description?: string;
};

type Session = {
  id: string;
  session_name: string;
  course?: { title: string };
  instructor?: { name: string };
};

export default function SurveyBuilder() {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [survey, setSurvey] = useState<Survey | null>(null);
  
  // 질문 관리 상태
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<SurveyQuestion | null>(null);

  // ⬇️ 과목 필드 삭제, 4가지만 유지
  const [educationYear, setEducationYear] = useState<number>(
    new Date().getFullYear()
  );
  const [educationRound, setEducationRound] = useState<number>(1);
  const [educationDay, setEducationDay] = useState<number>(1);
  const [courseName, setCourseName] = useState<string>("");

  // 날짜/설명은 상태값과 바인딩
  const [startAt, setStartAt] = useState<string>("");
  const [endAt, setEndAt] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  // 과정명 관리
  const [courseNames, setCourseNames] = useState<{id: string; name: string}[]>([]);
  const [courseMgrOpen, setCourseMgrOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [editRow, setEditRow] = useState<{ id: string; name: string } | null>(
    null
  );

  // 템플릿 관리
  const [templates, setTemplates] = useState<{id: string; name: string}[]>([]);
  const [templateSelectOpen, setTemplateSelectOpen] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // 섹션 관리
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [sectionForm, setSectionForm] = useState({
    name: "",
    description: ""
  });

  const title = useMemo(
    () => buildTitle(educationYear, educationRound, educationDay, courseName),
    [educationYear, educationRound, educationDay, courseName]
  );

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('survey_templates')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setTemplates(data || []);
    } catch (e: any) {
      toast({
        title: "템플릿 로드 실패",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  const loadFromTemplate = async (templateId: string) => {
    if (!surveyId) return;
    
    setLoadingTemplate(true);
    try {
      // 템플릿 질문들 가져오기
      const { data: templateQuestions, error: questionsError } = await supabase
        .from('template_questions')
        .select('*')
        .eq('template_id', templateId)
        .order('order_index');
      
      if (questionsError) throw questionsError;

      // 템플릿 섹션들 가져오기
      const { data: templateSections, error: sectionsError } = await supabase
        .from('template_sections')
        .select('*')
        .eq('template_id', templateId)
        .order('order_index');
      
      if (sectionsError) throw sectionsError;

      // 기존 질문과 섹션 삭제
      await supabase.from('survey_questions').delete().eq('survey_id', surveyId);
      await supabase.from('survey_sections').delete().eq('survey_id', surveyId);

      // 섹션들을 먼저 생성
      const sectionMapping: Record<string, string> = {};
      if (templateSections && templateSections.length > 0) {
        for (const section of templateSections) {
          const { data: newSection, error: sectionError } = await supabase
            .from('survey_sections')
            .insert({
              survey_id: surveyId,
              name: section.name,
              description: section.description,
              order_index: section.order_index
            })
            .select('*')
            .single();
          
          if (sectionError) throw sectionError;
          sectionMapping[section.id] = newSection.id;
        }
      }

      // 질문들 생성
      if (templateQuestions && templateQuestions.length > 0) {
        const questionsToInsert = templateQuestions.map(q => ({
          survey_id: surveyId,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options,
          is_required: q.is_required,
          order_index: q.order_index,
          section_id: q.section_id ? sectionMapping[q.section_id] || null : null,
          satisfaction_type: q.satisfaction_type,
          scope: 'session'
        }));

        const { error: insertError } = await supabase
          .from('survey_questions')
          .insert(questionsToInsert);
        
        if (insertError) throw insertError;
      }

      toast({ title: "성공", description: "템플릿이 적용되었습니다." });
      setTemplateSelectOpen(false);
      loadQuestions();
      loadSectionsAndSessions();
    } catch (e: any) {
      toast({
        title: "템플릿 적용 실패",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLoadingTemplate(false);
    }
  };

  const loadCourseNames = async () => {
    try {
      const { data, error } = await supabase.from("course_names").select("*").order("name");
      if (error) throw error;
      setCourseNames((data || []) as {id: string; name: string}[]);
    } catch (e: any) {
      toast({
        title: "과정명 목록 로드 실패",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  const loadQuestions = async () => {
    if (!surveyId) return;
    try {
      const { data, error } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', surveyId)
        .order('order_index');
      
      if (error) throw error;
      setQuestions((data || []) as SurveyQuestion[]);
    } catch (e: any) {
      toast({
        title: "질문 로드 실패",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  const loadSectionsAndSessions = async () => {
    if (!surveyId) return;
    try {
      // Load sections
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('survey_sections')
        .select('*')
        .eq('survey_id', surveyId)
        .order('order_index');
      
      if (sectionsError) throw sectionsError;
      setSections(sectionsData || []);

      // Load sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('survey_sessions')
        .select(`
          *,
          course:courses(title),
          instructor:instructors(name)
        `)
        .eq('survey_id', surveyId)
        .order('session_order');
      
      if (sessionsError) throw sessionsError;
      setSessions(sessionsData || []);
    } catch (e: any) {
      toast({
        title: "섹션/세션 로드 실패", 
        description: e.message,
        variant: "destructive",
      });
    }
  };

  const loadSurvey = async () => {
    if (!surveyId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("surveys")
        .select("*")
        .eq("id", surveyId)
        .single();
      if (error) throw error;

      const s = data as Survey;
      setSurvey(s);

      // 기본정보
      setEducationYear(s.education_year ?? new Date().getFullYear());
      setEducationRound(s.education_round ?? 1);
      setEducationDay(s.education_day ?? 1);
      setCourseName(s.course_name ?? "");

      // 시작/종료: 없으면 다음날 09:00/19:00 기본값
      const { startLocal, endLocal } = getDefaultStartEndLocal();
      const start = toLocalDateTime(s.start_date) || startLocal;
      const end = toLocalDateTime(s.end_date) || endLocal;
      setStartAt(start);
      setEndAt(end);

      setDescription(
        s.description ??
          "본 설문은 과목과 강사 만족도를 평가하기 위한 것입니다. 교육 품질 향상을 위해 모든 교육생께서 반드시 참여해 주시길 부탁드립니다."
      );
    } catch (e: any) {
      toast({
        title: "설문 로드 실패",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveBasic = async () => {
    if (!surveyId) return;
    try {
      if (!educationYear || !educationRound || !educationDay || !courseName) {
        toast({
          title: "필수값 누락",
          description: "교육연도, 차수, 일차, 과정명은 필수입니다.",
          variant: "destructive",
        });
        return;
      }
      setSaving(true);

      // 저장 시 비어있으면 기본값을 적용해 저장 (실수 방지)
      const { startLocal, endLocal } = getDefaultStartEndLocal();
      const startISO = toSafeISOString(startAt || startLocal);
      const endISO = toSafeISOString(endAt || endLocal);

      const payload = {
        education_year: educationYear,
        education_round: educationRound,
        education_day: educationDay,
        course_name: courseName,
        title,
        start_date: startISO,
        end_date: endISO,
        description,
      };

      const { error } = await supabase
        .from("surveys")
        .update(payload)
        .eq("id", surveyId);

      if (error) throw error;

      toast({ title: "기본 정보 저장", description: "저장되었습니다." });
      await loadSurvey();
    } catch (e: any) {
      toast({
        title: "저장 실패",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // 과정명 관리 액션
  const handleCreateCourseName = async () => {
    const name = newCourseName.trim();
    if (!name) return;
    try {
      const { error } = await supabase.from("course_names").insert([{ name }]);
      if (error) throw error;
      setNewCourseName("");
      await loadCourseNames();
      toast({ title: "과정명 추가", description: `"${name}" 추가됨` });
    } catch (e: any) {
      toast({ title: "추가 실패", description: e.message, variant: "destructive" });
    }
  };
  const handleRenameCourseName = async () => {
    if (!editRow) return;
    const newName = editRow.name.trim();
    if (!newName) return;
    try {
      const old = courseNames.find((c) => c.id === editRow.id)?.name || "";
      
      // Update course_names table
      const { error: courseError } = await supabase
        .from("course_names")
        .update({ name: newName })
        .eq("id", editRow.id);
      if (courseError) throw courseError;

      // Update surveys that use this course name
      const { error: surveyError } = await supabase
        .from("surveys")
        .update({ course_name: newName })
        .eq("course_name", old);
      if (surveyError) throw surveyError;
      
      setEditRow(null);
      await loadCourseNames();
      if (courseName === old) setCourseName(newName); // 폼 동기화
      toast({ title: "과정명 변경", description: `"${old}" → "${newName}"` });
    } catch (e: any) {
      toast({ title: "변경 실패", description: e.message, variant: "destructive" });
    }
  };
  const handleDeleteCourseName = async (id: string) => {
    const target = courseNames.find((c) => c.id === id);
    if (!target) return;
    if (!confirm(`"${target.name}" 과정을 목록에서 삭제할까요? (기존 설문에는 영향 없습니다)`)) return;
    try {
      const { error } = await supabase.from("course_names").delete().eq("id", id);
      if (error) throw error;
      await loadCourseNames();
      toast({ title: "삭제 완료", description: `"${target.name}" 삭제됨` });
    } catch (e: any) {
      toast({ title: "삭제 실패", description: e.message, variant: "destructive" });
    }
  };

  const handleAddQuestion = () => {
    setEditingQuestion(null);
    setQuestionDialogOpen(true);
  };

  const handleEditQuestion = (question: SurveyQuestion) => {
    setEditingQuestion(question);
    setQuestionDialogOpen(true);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('이 질문을 삭제하시겠습니까?')) return;
    
    try {
      const { error } = await supabase
        .from('survey_questions')
        .delete()
        .eq('id', questionId);
      
      if (error) throw error;
      
      toast({ title: "성공", description: "질문이 삭제되었습니다." });
      loadQuestions();
    } catch (e: any) {
      toast({
        title: "삭제 실패",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  const handleQuestionSave = () => {
    setQuestionDialogOpen(false);
    loadQuestions();
  };

  const handleAddSection = async () => {
    setSectionForm({ name: "", description: "" });
    setEditingSection(null);
    setSectionDialogOpen(true);
  };

  const handleEditSection = (section: Section) => {
    setEditingSection(section);
    setSectionForm({
      name: section.name,
      description: section.description || ""
    });
    setSectionDialogOpen(true);
  };

  const handleSaveSection = async () => {
    if (!surveyId || !sectionForm.name.trim()) return;
    
    try {
      if (editingSection) {
        // 수정
        const { error } = await supabase
          .from('survey_sections')
          .update({
            name: sectionForm.name,
            description: sectionForm.description || null
          })
          .eq('id', editingSection.id);
        
        if (error) throw error;
        toast({ title: "성공", description: "섹션이 수정되었습니다." });
      } else {
        // 추가
        const { error } = await supabase
          .from('survey_sections')
          .insert({
            survey_id: surveyId,
            name: sectionForm.name,
            description: sectionForm.description || null,
            order_index: sections.length
          });
        
        if (error) throw error;
        toast({ title: "성공", description: "섹션이 추가되었습니다." });
      }

      setSectionDialogOpen(false);
      loadSectionsAndSessions();
    } catch (e: any) {
      toast({
        title: editingSection ? "수정 실패" : "추가 실패",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('이 섹션을 삭제하시겠습니까? 섹션에 속한 질문들의 섹션 정보가 제거됩니다.')) return;
    
    try {
      // 섹션에 속한 질문들의 section_id를 null로 설정
      await supabase
        .from('survey_questions')
        .update({ section_id: null })
        .eq('section_id', sectionId);

      // 섹션 삭제
      const { error } = await supabase
        .from('survey_sections')
        .delete()
        .eq('id', sectionId);
      
      if (error) throw error;
      
      toast({ title: "성공", description: "섹션이 삭제되었습니다." });
      loadSectionsAndSessions();
      loadQuestions();
    } catch (e: any) {
      toast({
        title: "삭제 실패",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadSurvey();
    loadCourseNames();
    loadQuestions();
    loadSectionsAndSessions();
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  if (loading || !survey) {
    return (
      <div className="container mx-auto p-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          뒤로
        </Button>
        <div className="mt-6">로딩 중...</div>
      </div>
    );
  }

  const years = Array.from(
    { length: 6 },
    (_, i) => new Date().getFullYear() + 1 - i
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          뒤로
        </Button>
        <div className="text-xl font-semibold">설문 편집</div>
        <div />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 과정명 + 관리 */}
            <div className="space-y-2">
              <Label>과정명</Label>
              <div className="flex gap-2">
                <Select
                  value={courseName || ""}
                  onValueChange={(v) => setCourseName(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="과정명을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {courseNames.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => setCourseMgrOpen(true)}>
                  <Settings className="w-4 h-4 mr-1" />
                  관리
                </Button>
              </div>
            </div>

            {/* 교육 연도 */}
            <div className="space-y-2">
              <Label>교육 연도</Label>
              <Select
                value={String(educationYear)}
                onValueChange={(v) => setEducationYear(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 차수 */}
            <div className="space-y-2">
              <Label>차수</Label>
              <Input
                type="number"
                min={1}
                value={educationRound}
                onChange={(e) =>
                  setEducationRound(parseInt(e.target.value || "1"))
                }
              />
            </div>

            {/* 일차 */}
            <div className="space-y-2">
              <Label>일차</Label>
              <Input
                type="number"
                min={1}
                value={educationDay}
                onChange={(e) => setEducationDay(parseInt(e.target.value || "1"))}
              />
            </div>

            {/* 자동 제목 */}
            <div className="space-y-2 md:col-span-2">
              <Label>제목 (자동)</Label>
              <Input value={title} readOnly />
            </div>

            {/* 시작/종료일시 (상태값과 바인딩) */}
            <div className="space-y-2">
              <Label>시작일시</Label>
              <Input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>종료일시</Label>
              <Input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>

            {/* 설명 */}
            <div className="space-y-2 md:col-span-2">
              <Label>설명</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveBasic} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              기본 정보 저장
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 질문 관리 섹션 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">질문 관리</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTemplateSelectOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                템플릿 불러오기
              </Button>
              <Button variant="outline" onClick={handleAddSection}>
                <Plus className="w-4 h-4 mr-2" />
                섹션 추가
              </Button>
              <Button onClick={handleAddQuestion}>
                <Plus className="w-4 h-4 mr-2" />
                질문 추가
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 섹션 관리 */}
          {sections.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">질문 섹션</h3>
              <div className="space-y-2">
                {sections.map((section) => (
                  <div key={section.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <h4 className="font-medium">{section.name}</h4>
                      {section.description && (
                        <p className="text-sm text-muted-foreground">{section.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditSection(section)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleDeleteSection(section.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {questions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-4xl mb-2">📝</div>
              <p>아직 질문이 없습니다</p>
              <p className="text-sm mt-1">첫 번째 질문을 추가해보세요</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((question, index) => (
                <div key={question.id} className="border rounded-lg p-4 relative">
                  <div className="absolute left-4 top-4 flex items-center justify-center w-6 h-6 bg-primary text-white text-sm font-bold rounded-full">
                    {index + 1}
                  </div>
                  
                  <div className="absolute top-4 right-4 flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleEditQuestion(question)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      onClick={() => handleDeleteQuestion(question.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="ml-8 mr-16">
                    <h3 className="font-medium mb-2">
                      {question.question_text}
                      {question.is_required && <span className="text-red-500 ml-1">*</span>}
                    </h3>
                    <div className="text-sm text-muted-foreground">
                      유형: {question.question_type} 
                      {question.satisfaction_type && ` • 만족도: ${question.satisfaction_type}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 질문 추가/편집 다이얼로그 */}
      <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? "질문 수정" : "질문 추가"}
            </DialogTitle>
          </DialogHeader>
          <QuestionEditForm
            question={editingQuestion}
            surveyId={surveyId!}
            onSave={handleQuestionSave}
            onCancel={() => setQuestionDialogOpen(false)}
            sections={sections}
            sessions={sessions}
          />
        </DialogContent>
      </Dialog>

      {/* 템플릿 선택 다이얼로그 */}
      <Dialog open={templateSelectOpen} onOpenChange={setTemplateSelectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>템플릿 선택</DialogTitle>
            <DialogDescription>
              기존 템플릿을 불러와서 질문을 자동으로 추가합니다. 기존 질문과 섹션은 모두 삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {templates.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                사용 가능한 템플릿이 없습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((template) => (
                  <Button
                    key={template.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => loadFromTemplate(template.id)}
                    disabled={loadingTemplate}
                  >
                    {template.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateSelectOpen(false)}>
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 섹션 추가/편집 다이얼로그 */}
      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSection ? "섹션 수정" : "섹션 추가"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="section-name">섹션 이름</Label>
              <Input
                id="section-name"
                value={sectionForm.name}
                onChange={(e) => setSectionForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="섹션 이름을 입력하세요"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="section-description">설명 (선택사항)</Label>
              <Textarea
                id="section-description"
                value={sectionForm.description}
                onChange={(e) => setSectionForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="섹션 설명을 입력하세요"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSaveSection} disabled={!sectionForm.name.trim()}>
              {editingSection ? "수정" : "추가"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 과정명 관리 다이얼로그 */}
      <Dialog open={courseMgrOpen} onOpenChange={setCourseMgrOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>과정명 관리</DialogTitle>
            <DialogDescription>
              과정명은 설문 제목 자동생성과 목록 필터에 사용됩니다. 이름 변경 시 기존 설문들의 과정명도 함께 업데이트됩니다.
            </DialogDescription>
          </DialogHeader>

          {/* 추가 */}
          <div className="flex gap-2">
            <Input
              placeholder="새 과정명 입력"
              value={newCourseName}
              onChange={(e) => setNewCourseName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateCourseName()}
            />
            <Button onClick={handleCreateCourseName}>
              <Plus className="w-4 h-4 mr-1" />
              추가
            </Button>
          </div>

          <Separator className="my-3" />

          {/* 목록 */}
          <div className="space-y-2 max-h-80 overflow-auto">
            {courseNames.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                등록된 과정명이 없습니다.
              </div>
            ) : (
              courseNames.map((c) => {
                const isEditing = editRow?.id === c.id;
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 border rounded-md p-2"
                  >
                    {isEditing ? (
                      <Input
                        value={editRow!.name}
                        onChange={(e) =>
                          setEditRow({ ...editRow!, name: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameCourseName();
                          if (e.key === "Escape") setEditRow(null);
                        }}
                      />
                    ) : (
                      <div className="font-medium">{c.name}</div>
                    )}

                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <Button size="sm" onClick={handleRenameCourseName}>
                            변경
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditRow(null)}
                          >
                            취소
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setEditRow({ id: c.id, name: c.name })
                            }
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            이름변경
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteCourseName(c.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            삭제
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCourseMgrOpen(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
