import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Pencil, Trash2, Plus, Settings, Edit, RefreshCcw } from "lucide-react";


import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import QuestionEditForm from "@/components/QuestionEditForm";
import { SessionManager, SurveySession } from "@/components/SessionManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

/* ───────────────────────────────── helpers ───────────────────────────────── */
const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInputStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
function getDefaultStartEndLocal() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const start = new Date(next); start.setHours(9, 0, 0, 0);
  const end = new Date(next); end.setHours(19, 0, 0, 0);
  return { startLocal: toLocalInputStr(start), endLocal: toLocalInputStr(end) };
}
const toLocalDateTime = (iso: string | null) => {
  if (!iso) return ""; const d = new Date(iso); return isNaN(d.getTime()) ? "" : toLocalInputStr(d);
};
const toSafeISOString = (local: string | null) => {
  if (!local) return null; const d = new Date(local); return isNaN(d.getTime()) ? null : d.toISOString();
};
const buildTitle = (year: number | null, round: number | null, day: number | null, courseName: string | null) =>
  !year || !round || !day || !courseName ? "" : `${year}-${courseName}-${round}차-${day}일차 설문`;

/* ───────────────────────────────── types ───────────────────────────────── */
type Survey = {
  id: string; title: string | null; description: string | null;
  start_date: string | null; end_date: string | null;
  education_year: number | null; education_round: number | null; education_day: number | null;
  course_name: string | null; expected_participants: number | null; is_test: boolean | null;
  status: "draft" | "active" | "public" | "completed" | null; created_at: string | null; updated_at: string | null;
};
type SurveyQuestion = {
  id: string; question_text: string; question_type: string; options: any; is_required: boolean;
  order_index: number; section_id?: string | null;
  scope: 'session' | 'operation'; satisfaction_type?: string | null;
};
type Section = { id: string; name: string; description?: string };
type Course = { id: string; title: string };
type Instructor = { id: string; name: string };

/* ─────────────────────────────── component ─────────────────────────────── */
export default function SurveyBuilder() {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [survey, setSurvey] = useState<Survey | null>(null);

  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [sessions, setSessions] = useState<SurveySession[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);

  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<SurveyQuestion | null>(null);

  const [educationYear, setEducationYear] = useState<number>(new Date().getFullYear());
  const [educationRound, setEducationRound] = useState<number>(1);
  const [educationDay, setEducationDay] = useState<number>(1);
  const [courseName, setCourseName] = useState<string>("");

  const [startAt, setStartAt] = useState<string>("");
  const [endAt, setEndAt] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  const [courseNames, setCourseNames] = useState<{id: string; name: string}[]>([]);
  const [courseMgrOpen, setCourseMgrOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [editRow, setEditRow] = useState<{ id: string; name: string } | null>(null);

  const [templates, setTemplates] = useState<{id: string; name: string}[]>([]);
  const [templateSelectOpen, setTemplateSelectOpen] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [sectionForm, setSectionForm] = useState({ name: "", description: "" });

  const title = useMemo(
    () => buildTitle(educationYear, educationRound, educationDay, courseName),
    [educationYear, educationRound, educationDay, courseName]
  );

  /* ───────────────────────────── data loaders ───────────────────────────── */
  const loadSurvey = useCallback(async () => {
    if (!surveyId) return;
    try {
      setLoading(true);
      console.log('Loading survey with ID:', surveyId);
      const { data, error } = await supabase.from("surveys").select("*").eq("id", surveyId).single();
      console.log('Survey data loaded:', data);
      console.log('Survey error:', error);
      if (error) throw error;
      const s = data as Survey;
      setSurvey(s);
      setEducationYear(s.education_year ?? new Date().getFullYear());
      setEducationRound(s.education_round ?? 1);
      setEducationDay(s.education_day ?? 1);
      setCourseName(s.course_name ?? "");
      const { startLocal, endLocal } = getDefaultStartEndLocal();
      setStartAt(toLocalDateTime(s.start_date) || startLocal);
      setEndAt(toLocalDateTime(s.end_date) || endLocal);
      setDescription(
        s.description ??
          "본 설문은 과목과 강사 만족도를 평가하기 위한 것입니다. 교육 품질 향상을 위해 모든 교육생께서 반드시 참여해 주시길 부탁드립니다."
      );
      console.log('Survey state updated with:', {
        educationYear: s.education_year,
        educationRound: s.education_round,
        educationDay: s.education_day,
        courseName: s.course_name,
        title: s.title,
        description: s.description
      });
    } catch (e: any) {
      console.error('Survey load error:', e);
      toast({ title: "설문 로드 실패", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [surveyId, toast]);

  const loadQuestions = useCallback(async () => {
    if (!surveyId) return;
    const { data, error } = await supabase
      .from('survey_questions').select('*').eq('survey_id', surveyId).order('order_index');
    if (error) { toast({ title: "질문 로드 실패", description: error.message, variant: "destructive" }); return; }
    setQuestions((data || []) as any[]);
  }, [surveyId, toast]);

  const loadSections = useCallback(async () => {
    if (!surveyId) return;
    const { data, error } = await supabase
      .from('survey_sections').select('*').eq('survey_id', surveyId).order('order_index');
    if (error) { toast({ title: "섹션 로드 실패", description: error.message, variant: "destructive" }); return; }
    setSections((data || []) as any[]);
  }, [surveyId, toast]);

  const loadSessions = useCallback(async () => {
    if (!surveyId) return;
    const { data, error } = await supabase
      .from('survey_sessions')
      .select(`
        *,
        course:courses(id,title),
        instructor:instructors(id,name)
      `)
      .eq('survey_id', surveyId)
      .order('session_order');
    if (error) { toast({ title: "세션 로드 실패", description: error.message, variant: "destructive" }); return; }
    setSessions((data || []) as any[]);
  }, [surveyId, toast]);

  const loadCourses = useCallback(async () => {
    const { data, error } = await supabase.from('courses').select('id,title').order('title');
    if (!error && data) setCourses(data as any[]);
  }, []);

  const loadInstructors = useCallback(async () => {
    const { data, error } = await supabase.from('instructors').select('id,name').order('name');
    if (!error && data) setInstructors(data as any[]);
  }, []);

  const loadTemplates = useCallback(async () => {
    const { data, error } = await supabase.from('survey_templates').select('id,name').order('name');
    if (error) { toast({ title: "템플릿 로드 실패", description: error.message, variant: "destructive" }); return; }
    setTemplates((data || []) as any[]);
  }, [toast]);

  const loadCourseNames = useCallback(async () => {
    const { data, error } = await supabase.from("course_names").select("*").order("name");
    if (error) { toast({ title: "과정명 목록 로드 실패", description: error.message, variant: "destructive" }); return; }
    setCourseNames((data || []) as any[]);
  }, [toast]);

  const reloadAll = useCallback(async () => {
    await Promise.all([
      loadSurvey(),
      loadCourseNames(),
      loadQuestions(),
      loadSections(),
      loadSessions(),
      loadCourses(),
      loadInstructors(),
      loadTemplates(),
    ]);
  }, [loadSurvey, loadCourseNames, loadQuestions, loadSections, loadSessions, loadCourses, loadInstructors, loadTemplates]);

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  /* ─────────────────────────────── save/basic ────────────────────────────── */
  const saveBasic = async () => {
    if (!surveyId) return;
    if (!educationYear || !educationRound || !educationDay || !courseName) {
      toast({ title: "필수값 누락", description: "교육연도, 차수, 일차, 과정명은 필수입니다.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { startLocal, endLocal } = getDefaultStartEndLocal();
      const payload = {
        education_year: educationYear, education_round: educationRound, education_day: educationDay,
        course_name: courseName, title,
        start_date: toSafeISOString(startAt || startLocal),
        end_date: toSafeISOString(endAt || endLocal),
        description,
      };
      const { error } = await supabase.from("surveys").update(payload).eq("id", surveyId);
      if (error) throw error;
      toast({ title: "기본 정보 저장", description: "저장되었습니다." });
      await loadSurvey();
    } catch (e: any) {
      toast({ title: "저장 실패", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /* ───────────────────────────── questions CRUD ──────────────────────────── */
  const handleAddQuestion = () => { setEditingQuestion(null); setQuestionDialogOpen(true); };
  const handleEditQuestion = (q: SurveyQuestion) => { setEditingQuestion(q); setQuestionDialogOpen(true); };
  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('이 질문을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('survey_questions').delete().eq('id', id);
    if (error) { toast({ title: "삭제 실패", description: error.message, variant: "destructive" }); return; }
    toast({ title: "성공", description: "질문이 삭제되었습니다." });
    loadQuestions();
  };
  const handleQuestionSave = () => { setQuestionDialogOpen(false); loadQuestions(); };

  /* ───────────────────────────── sections CRUD ───────────────────────────── */
  const handleAddSection = () => { setSectionForm({ name: "", description: "" }); setEditingSection(null); setSectionDialogOpen(true); };
  const handleEditSection = (section: Section) => { setEditingSection(section); setSectionForm({ name: section.name, description: section.description || "" }); setSectionDialogOpen(true); };
  const handleSaveSection = async () => {
    if (!surveyId || !sectionForm.name.trim()) return;
    if (editingSection) {
      const { error } = await supabase.from('survey_sections').update({
        name: sectionForm.name, description: sectionForm.description || null
      }).eq('id', editingSection.id);
      if (error) { toast({ title: "수정 실패", description: error.message, variant: "destructive" }); return; }
      toast({ title: "성공", description: "섹션이 수정되었습니다." });
    } else {
      const { error } = await supabase.from('survey_sections').insert({
        survey_id: surveyId, name: sectionForm.name, description: sectionForm.description || null, order_index: sections.length
      });
      if (error) { toast({ title: "추가 실패", description: error.message, variant: "destructive" }); return; }
      toast({ title: "성공", description: "섹션이 추가되었습니다." });
    }
    setSectionDialogOpen(false);
    loadSections();
  };
  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('이 섹션을 삭제하시겠습니까? 섹션에 속한 질문들의 섹션 정보가 제거됩니다.')) return;
    await supabase.from('survey_questions').update({ section_id: null }).eq('section_id', sectionId);
    const { error } = await supabase.from('survey_sections').delete().eq('id', sectionId);
    if (error) { toast({ title: "삭제 실패", description: error.message, variant: "destructive" }); return; }
    toast({ title: "성공", description: "섹션이 삭제되었습니다." });
    loadSections(); loadQuestions();
  };

  /* ───────────────────────────── course names CRUD ───────────────────────── */
  const handleCreateCourseName = async () => {
    const name = newCourseName.trim(); if (!name) return;
    const { error } = await supabase.from("course_names").insert([{ name }]);
    if (error) { toast({ title: "추가 실패", description: error.message, variant: "destructive" }); return; }
    setNewCourseName(""); await loadCourseNames(); toast({ title: "과정명 추가", description: `"${name}" 추가됨` });
  };
  const handleRenameCourseName = async () => {
    if (!editRow) return; const newName = editRow.name.trim(); if (!newName) return;
    const old = courseNames.find(c => c.id === editRow.id)?.name || "";
    const { error: e1 } = await supabase.from("course_names").update({ name: newName }).eq("id", editRow.id);
    if (e1) { toast({ title: "변경 실패", description: e1.message, variant: "destructive" }); return; }
    const { error: e2 } = await supabase.from("surveys").update({ course_name: newName }).eq("course_name", old);
    if (e2) { toast({ title: "변경 실패", description: e2.message, variant: "destructive" }); return; }
    setEditRow(null); await loadCourseNames(); if (courseName === old) setCourseName(newName);
    toast({ title: "과정명 변경", description: `"${old}" → "${newName}"` });
  };
  const handleDeleteCourseName = async (id: string) => {
    const target = courseNames.find(c => c.id === id); if (!target) return;
    if (!confirm(`"${target.name}" 과정을 목록에서 삭제할까요? (기존 설문에는 영향 없습니다)`)) return;
    const { error } = await supabase.from("course_names").delete().eq("id", id);
    if (error) { toast({ title: "삭제 실패", description: error.message, variant: "destructive" }); return; }
    await loadCourseNames(); toast({ title: "삭제 완료", description: `"${target.name}" 삭제됨` });
  };

  /* ───────────────────────────── actions (header) ────────────────────────── */
  const desktopActions = [
    <Button key="back" variant="outline" size="sm" className="rounded-full px-3" onClick={() => navigate(-1)}>
      <ArrowLeft className="w-4 h-4 mr-1.5" /> 뒤로
    </Button>,
    <Button key="save" size="sm" className="rounded-full px-3" onClick={saveBasic} disabled={saving || loading || !survey}>
      <Save className={`w-4 h-4 mr-1.5 ${saving ? "animate-pulse" : ""}`} /> 기본 정보 저장
    </Button>,
    <Button
      key="tpl"
      variant="outline"
      size="sm"
      className="rounded-full px-3"
      onClick={() => setTemplateSelectOpen(true)}
      disabled={loading || !survey}
    >
      <Plus className="w-4 h-4 mr-1.5" /> 템플릿 불러오기
    </Button>,
    <Button
      key="sec"
      variant="outline"
      size="sm"
      className="rounded-full px-3"
      onClick={handleAddSection}
      disabled={loading || !survey}
    >
      <Plus className="w-4 h-4 mr-1.5" /> 섹션 추가
    </Button>,
    <Button
      key="q"
      size="sm"
      className="rounded-full px-3"
      onClick={handleAddQuestion}
      disabled={loading || !survey}
    >
      <Plus className="w-4 h-4 mr-1.5" /> 질문 추가
    </Button>,
  ];

  const mobileActions = [
    <Button key="back-m" variant="outline" size="sm" className="rounded-full" onClick={() => navigate(-1)}>
      <ArrowLeft className="w-4 h-4" />
    </Button>,
    <Button key="save-m" size="sm" className="rounded-full" onClick={saveBasic} disabled={saving || loading || !survey}>
      <Save className="w-4 h-4" />
    </Button>,
    <Button key="tpl-m" variant="outline" size="sm" className="rounded-full" onClick={() => setTemplateSelectOpen(true)} disabled={loading || !survey}>
      <Plus className="w-4 h-4" />
    </Button>,
    <Button key="sec-m" variant="outline" size="sm" className="rounded-full" onClick={handleAddSection} disabled={loading || !survey}>
      <Plus className="w-4 h-4" />
    </Button>,
    <Button key="q-m" size="sm" className="rounded-full" onClick={handleAddQuestion} disabled={loading || !survey}>
      <Plus className="w-4 h-4" />
    </Button>,
  ];

  /* ─────────────────────────────── render ──────────────────────────────── */
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + 1 - i);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">설문 편집</h1>
        <div className="flex gap-2">
          {desktopActions.map((action, index) => (
            <div key={index}>{action}</div>
          ))}
        </div>
      </div>
      {/* ✅ AdminLayout이 padding/컨테이너를 제공하므로 내부는 바로 내용 */}
      {!survey && !loading ? (
        <div className="py-10 text-sm text-muted-foreground">해당 설문을 찾을 수 없습니다.</div>
      ) : (
        <div className="space-y-6">
          {/* 기본 정보 */}
          <Card>
            <CardHeader><CardTitle className="text-2xl">기본 정보</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>과정명</Label>
                  <div className="flex gap-2">
                    <Select value={courseName || ""} onValueChange={setCourseName}>
                      <SelectTrigger><SelectValue placeholder="과정명을 선택하세요" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {courseNames.map((c) => (<SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => setCourseMgrOpen(true)}>
                      <Settings className="w-4 h-4 mr-1" />관리
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>교육 연도</Label>
                  <Select value={String(educationYear)} onValueChange={(v) => setEducationYear(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{years.map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}</SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>차수</Label>
                  <Input type="number" min={1} value={educationRound} onChange={(e) => setEducationRound(parseInt(e.target.value || "1"))} />
                </div>

                <div className="space-y-2">
                  <Label>일차</Label>
                  <Input type="number" min={1} value={educationDay} onChange={(e) => setEducationDay(parseInt(e.target.value || "1"))} />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>제목 (자동)</Label>
                  <Input value={title} readOnly />
                </div>

                <div className="space-y-2">
                  <Label>시작일시</Label>
                  <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>종료일시</Label>
                  <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>설명</Label>
                  <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveBasic} disabled={saving || loading || !survey}>
                  <Save className="w-4 h-4 mr-2" />기본 정보 저장
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 🔷 세션(과목/강사) 관리 */}
          {survey && (
            <SessionManager
              surveyId={survey.id}
              sessions={sessions}
              courses={courses}
              instructors={instructors}
              onSessionsChange={(next) => setSessions(next)}
            />
          )}

          {/* 질문 관리 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">질문 관리</CardTitle>
                <div className="hidden md:flex gap-2">
                  <Button variant="outline" onClick={() => setTemplateSelectOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />템플릿 불러오기
                  </Button>
                  <Button variant="outline" onClick={handleAddSection}>
                    <Plus className="w-4 h-4 mr-2" />섹션 추가
                  </Button>
                  <Button onClick={handleAddQuestion}>
                    <Plus className="w-4 h-4 mr-2" />질문 추가
                  </Button>
                </div>
                <div className="md:hidden">
                  <Button variant="outline" size="icon" onClick={() => setTemplateSelectOpen(true)} className="mr-2">
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleAddSection} className="mr-2">
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button size="icon" onClick={handleAddQuestion}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {sections.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">질문 섹션</h3>
                  <div className="space-y-2">
                    {sections.map((section) => (
                      <div key={section.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <h4 className="font-medium">{section.name}</h4>
                          {section.description && <p className="text-sm text-muted-foreground">{section.description}</p>}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditSection(section)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDeleteSection(section.id)}>
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
                  {questions.map((q, idx) => (
                    <div key={q.id} className="border rounded-lg p-4 relative">
                      <div className="absolute left-4 top-4 flex items-center justify-center w-6 h-6 bg-primary text-white text-sm font-bold rounded-full">
                        {idx + 1}
                      </div>
                      <div className="absolute top-4 right-4 flex gap-2">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEditQuestion(q)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700" onClick={() => handleDeleteQuestion(q.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="ml-8 mr-16">
                        <h3 className="font-medium mb-1">
                          {q.question_text}{q.is_required && <span className="text-red-500 ml-1">*</span>}
                        </h3>
                        <div className="text-xs text-muted-foreground">
                          유형: {q.question_type} • 적용: {q.scope === "session" ? "세션별" : "하루공통"}
                          {q.satisfaction_type ? ` • 만족도: ${q.satisfaction_type}` : ""}
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
              <DialogHeader><DialogTitle>{editingQuestion ? "질문 수정" : "질문 추가"}</DialogTitle></DialogHeader>
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
                <DialogDescription>기존 템플릿을 불러와서 질문을 자동으로 추가합니다. 기존 질문과 섹션은 모두 삭제됩니다.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {templates.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">사용 가능한 템플릿이 없습니다.</div>
                ) : (
                  <div className="space-y-2">
                    {templates.map((t) => (
                      <Button key={t.id} variant="outline" className="w-full justify-start"
                              onClick={async () => {
                                setLoading(true);
                                setLoadingTemplate(true);
                                try {
                                  // 섹션/질문 초기화 후 템플릿 반영 (scope 유지)
                                  const { data: tq } = await supabase
                                    .from('template_questions').select('*').eq('template_id', t.id).order('order_index');
                                  const { data: ts } = await supabase
                                    .from('template_sections').select('*').eq('template_id', t.id).order('order_index');

                                  await supabase.from('survey_questions').delete().eq('survey_id', surveyId);
                                  await supabase.from('survey_sections').delete().eq('survey_id', surveyId);

                                  const mapping: Record<string,string> = {};
                                  if (ts?.length) {
                                    for (const s of ts) {
                                      const { data: created } = await supabase
                                        .from('survey_sections')
                                        .insert({ survey_id: surveyId, name: s.name, description: s.description, order_index: s.order_index })
                                        .select('*').single();
                                      mapping[s.id] = (created as any).id;
                                    }
                                  }
                                  if (tq?.length) {
                                    await supabase.from('survey_questions').insert(
                                      tq.map((q: any) => ({
                                        survey_id: surveyId,
                                        question_text: q.question_text,
                                        question_type: q.question_type,
                                        options: q.options,
                                        is_required: q.is_required,
                                        order_index: q.order_index,
                                        section_id: q.section_id ? mapping[q.section_id] ?? null : null,
                                        satisfaction_type: q.satisfaction_type ?? null,
                                        scope: (q.scope as 'session'|'operation') ?? 'session',
                                      }))
                                    );
                                  }
                                  toast({ title: "성공", description: "템플릿이 적용되었습니다." });
                                  setTemplateSelectOpen(false);
                                  loadQuestions(); loadSections();
                                } catch (e: any) {
                                  toast({ title: "템플릿 적용 실패", description: e.message, variant: "destructive" });
                                } finally {
                                  setLoadingTemplate(false);
                                  setLoading(false);
                                }
                              }}
                              disabled={loadingTemplate}
                    >
                      {t.name}
                    </Button>))}
                  </div>
                )}
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setTemplateSelectOpen(false)}>취소</Button></DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 섹션 추가/편집 다이얼로그 */}
          <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{editingSection ? "섹션 수정" : "섹션 추가"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="section-name">섹션 이름</Label>
                  <Input id="section-name" value={sectionForm.name}
                        onChange={(e) => setSectionForm(prev => ({ ...prev, name: e.target.value }))} placeholder="섹션 이름을 입력하세요" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="section-description">설명 (선택사항)</Label>
                  <Textarea id="section-description" rows={3} value={sectionForm.description}
                            onChange={(e) => setSectionForm(prev => ({ ...prev, description: e.target.value }))} placeholder="섹션 설명을 입력하세요" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSectionDialogOpen(false)}>취소</Button>
                <Button onClick={handleSaveSection} disabled={!sectionForm.name.trim()}>{editingSection ? "수정" : "추가"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 과정명 관리 다이얼로그 */}
          <Dialog open={courseMgrOpen} onOpenChange={setCourseMgrOpen}>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>과정명 관리</DialogTitle>
                <DialogDescription>과정명은 설문 제목 자동생성과 목록 필터에 사용됩니다. 이름 변경 시 기존 설문들의 과정명도 함께 업데이트됩니다.</DialogDescription>
              </DialogHeader>

              <div className="flex gap-2">
                <Input placeholder="새 과정명 입력" value={newCourseName}
                      onChange={(e) => setNewCourseName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateCourseName()} />
                <Button onClick={handleCreateCourseName}><Plus className="w-4 h-4 mr-1" />추가</Button>
              </div>

              <Separator className="my-3" />

              <div className="space-y-2 max-h-80 overflow-auto">
                {courseNames.length === 0 ? (
                  <div className="text-sm text-muted-foreground">등록된 과정명이 없습니다.</div>
                ) : (
                  courseNames.map((c) => {
                    const isEditing = editRow?.id === c.id;
                    return (
                      <div key={c.id} className="flex items-center justify-between gap-3 border rounded-md p-2">
                        {isEditing ? (
                          <Input value={editRow!.name}
                                onChange={(e) => setEditRow({ ...editRow!, name: e.target.value })}
                                onKeyDown={(e) => { if (e.key === "Enter") handleRenameCourseName(); if (e.key === "Escape") setEditRow(null); }} />
                        ) : (<div className="font-medium">{c.name}</div>)}
                        <div className="flex gap-2">
                          {isEditing ? (
                            <>
                              <Button size="sm" onClick={handleRenameCourseName}>변경</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditRow(null)}>취소</Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => setEditRow({ id: c.id, name: c.name })}>
                                <Pencil className="w-4 h-4 mr-1" />이름변경
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleDeleteCourseName(c.id)}>
                                <Trash2 className="w-4 h-4 mr-1" />삭제
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <DialogFooter><Button variant="outline" onClick={() => setCourseMgrOpen(false)}>닫기</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
