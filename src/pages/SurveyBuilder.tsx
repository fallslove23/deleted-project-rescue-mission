import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, Edit, GripVertical, FileText, FolderPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { InstructorInfoSection } from '@/components/InstructorInfoSection';
import { SurveyInfoEditDialog } from '@/components/SurveyInfoEditDialog';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// -----------------------
// 타입 정의(새 필드 포함)
// -----------------------
interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options?: any;
  is_required: boolean;
  order_index: number;
  section_id?: string | null;
  satisfaction_type?: string | null;
}

interface Section {
  id: string;
  name: string;
  description?: string;
  order_index: number;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  is_course_evaluation: boolean;
}

// ⬇️ surveys 테이블에 새 컬럼(합반/라벨) 반영
interface Survey {
  id: string;
  title: string;
  description: string;
  instructor_id: string | null;
  course_id: string | null;
  education_year: number;
  education_round: number;
  start_date: string | null;
  end_date: string | null;
  status: 'draft' | 'active' | 'completed' | string;

  // 새 필드
  course_name?: string | null;
  is_combined?: boolean | null;
  combined_round_start?: number | null;
  combined_round_end?: number | null;
  round_label?: string | null;
}

interface Instructor {
  id: string;
  name: string;
  email?: string;
  photo_url?: string;
  bio?: string;
}

interface Course {
  id: string;
  title: string;
  description?: string;
}

// -----------------------
// 컴포넌트 시작
// -----------------------
const SurveyBuilder = () => {
  const navigate = useNavigate();
  const { surveyId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [allInstructors, setAllInstructors] = useState<Instructor[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  // 다이얼로그 상태
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSectionDialogOpen, setIsSectionDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isSurveyInfoDialogOpen, setIsSurveyInfoDialogOpen] = useState(false);
  const [isInstructorDialogOpen, setIsInstructorDialogOpen] = useState(false);
  const [isCourseDialogOpen, setIsCourseDialogOpen] = useState(false);

  // DnD 센서
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 폼 상태
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionForm, setQuestionForm] = useState({
    question_text: '',
    question_type: 'scale' as string,
    is_required: true,
    options: null as any,
    section_id: 'none',
    scale_min: 1,
    scale_max: 10,
    satisfaction_type: 'none' as string
  });

  const [sectionForm, setSectionForm] = useState({ name: '', description: '' });

  const [isSectionEditDialogOpen, setIsSectionEditDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [sectionEditForm, setSectionEditForm] = useState({ name: '', description: '' });

  // ⬇️ 설문 기본/확장 정보 폼(새 필드 포함)
  const [surveyForm, setSurveyForm] = useState({
    title: '',
    description: '',
    education_year: new Date().getFullYear(),
    education_round: 1,
    course_name: '',
    // 새 필드
    is_combined: false,
    combined_round_start: null as number | null,
    combined_round_end: null as number | null,
    round_label: '',
    start_date: '',
    end_date: '',
    status: 'draft' as Survey['status']
  });

  const [instructorForm, setInstructorForm] = useState({ selectedInstructorId: '' });
  const [courseForm, setCourseForm] = useState({ selectedCourseId: '' });

  // -----------------------
  // 데이터 로드
  // -----------------------
  useEffect(() => {
    if (surveyId) {
      fetchSurveyData();
      fetchTemplates();
      fetchAllInstructors();
      fetchAllCourses();
    }
  }, [surveyId]);

  const fetchSurveyData = async () => {
    try {
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select('*, instructors(*), courses(*)')
        .eq('id', surveyId)
        .single();

      if (surveyError) throw surveyError;

      // 타입 안전 캐스팅
      const s = surveyData as unknown as Survey;

      setSurvey(s);
      setInstructor((surveyData as any).instructors || null);
      setCourse((surveyData as any).courses || null);

      // datetime-local 포맷 헬퍼
      const toLocalInput = (iso?: string | null) => {
        if (!iso) return '';
        const d = new Date(iso);
        const off = d.getTimezoneOffset();
        const local = new Date(d.getTime() - off * 60 * 1000);
        return local.toISOString().slice(0, 16);
      };

      // ⬇️ 새 필드 포함하여 폼 초기화
      setSurveyForm({
        title: s.title || '',
        description: s.description || '',
        education_year: s.education_year ?? new Date().getFullYear(),
        education_round: s.education_round ?? 1,
        course_name: s.course_name ?? '',
        is_combined: !!s.is_combined,
        combined_round_start: s.combined_round_start ?? null,
        combined_round_end: s.combined_round_end ?? null,
        round_label: s.round_label ?? '',
        start_date: toLocalInput(s.start_date ?? undefined),
        end_date: toLocalInput(s.end_date ?? undefined),
        status: (s.status as Survey['status']) ?? 'draft'
      });

      setInstructorForm({ selectedInstructorId: s.instructor_id || '' });
      setCourseForm({ selectedCourseId: s.course_id || '' });

      const { data: questionsData, error: questionsError } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', surveyId)
        .order('order_index');

      if (questionsError) throw questionsError;

      setQuestions(
        (questionsData || []).map((q) => ({
          ...q,
          question_type: q.question_type as string,
        }))
      );

      const { data: sectionsData, error: sectionsError } = await supabase
        .from('survey_sections')
        .select('*')
        .eq('survey_id', surveyId)
        .order('order_index');

      if (sectionsError) throw sectionsError;
      setSections(sectionsData || []);
    } catch (error) {
      console.error('Error fetching survey data:', error);
      toast({ title: '오류', description: '설문조사 데이터를 불러오는 중 오류가 발생했습니다.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllInstructors = async () => {
    try {
      const { data, error } = await supabase.from('instructors').select('*').order('name');
      if (error) throw error;
      setAllInstructors(data || []);
    } catch (error) {
      console.error('Error fetching instructors:', error);
    }
  };

  const fetchAllCourses = async () => {
    try {
      const { data, error } = await supabase.from('courses').select('*').order('title');
      if (error) throw error;
      setAllCourses(data || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase.from('survey_templates').select('*').order('name');
      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({ title: '오류', description: '템플릿 목록을 불러오는 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  // -----------------------
  // 유틸/핸들러
  // -----------------------
  const resetQuestionForm = () => {
    setQuestionForm({
      question_text: '',
      question_type: 'scale',
      is_required: true,
      options: null,
      section_id: 'none',
      scale_min: 1,
      scale_max: 10,
      satisfaction_type: 'none',
    });
    setEditingQuestion(null);
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let newOrderIndex = 0;
      if (questionForm.section_id && questionForm.section_id !== 'none') {
        const sectionQuestions = questions.filter((q) => q.section_id === questionForm.section_id);
        newOrderIndex = sectionQuestions.length > 0 ? Math.max(...sectionQuestions.map((q) => q.order_index)) + 1 : 0;
      } else {
        const noSectionQuestions = questions.filter((q) => !q.section_id);
        newOrderIndex =
          noSectionQuestions.length > 0 ? Math.max(...noSectionQuestions.map((q) => q.order_index)) + 1 : 0;
      }

      const questionData = {
        survey_id: surveyId,
        question_text: questionForm.question_text,
        question_type: questionForm.question_type,
        is_required: questionForm.is_required,
        order_index: editingQuestion ? editingQuestion.order_index : newOrderIndex,
        options:
          questionForm.question_type === 'scale'
            ? { min: questionForm.scale_min, max: questionForm.scale_max }
            : questionForm.options,
        section_id: questionForm.section_id === 'none' ? null : questionForm.section_id,
        satisfaction_type: questionForm.satisfaction_type === 'none' ? null : questionForm.satisfaction_type,
      };

      if (editingQuestion) {
        const { error } = await supabase.from('survey_questions').update(questionData).eq('id', editingQuestion.id);
        if (error) throw error;
        toast({ title: '성공', description: '질문이 수정되었습니다.' });
      } else {
        const { error } = await supabase.from('survey_questions').insert([questionData]);
        if (error) throw error;
        toast({ title: '성공', description: '질문이 추가되었습니다.' });
      }

      setIsDialogOpen(false);
      resetQuestionForm();
      fetchSurveyData();
    } catch (error) {
      console.error('Error saving question:', error);
      toast({ title: '오류', description: '질문 저장 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setQuestionForm({
      question_text: question.question_text,
      question_type: question.question_type,
      is_required: question.is_required,
      options: question.options,
      section_id: question.section_id || 'none',
      scale_min: question.options?.min || 1,
      scale_max: question.options?.max || 10,
      satisfaction_type: (question as any).satisfaction_type || 'none',
    });
    setIsDialogOpen(true);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!window.confirm('이 질문을 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('survey_questions').delete().eq('id', questionId);
      if (error) throw error;
      toast({ title: '성공', description: '질문이 삭제되었습니다.' });
      fetchSurveyData();
    } catch (error) {
      console.error('Error deleting question:', error);
      toast({ title: '오류', description: '질문 삭제 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeQuestion = questions.find((q) => q.id === active.id);
    const overQuestion = questions.find((q) => q.id === over.id);
    if (!activeQuestion || !overQuestion) return;
    if (activeQuestion.section_id !== overQuestion.section_id) return;

    const questionsInSame = questions
      .filter((q) => q.section_id === activeQuestion.section_id)
      .sort((a, b) => a.order_index - b.order_index);

    const oldIndex = questionsInSame.findIndex((q) => q.id === active.id);
    const newIndex = questionsInSame.findIndex((q) => q.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(questionsInSame, oldIndex, newIndex);

    try {
      await Promise.all(
        reordered.map((q, idx) => supabase.from('survey_questions').update({ order_index: idx }).eq('id', q.id))
      );
      toast({ title: '성공', description: '질문 순서가 변경되었습니다.' });
      fetchSurveyData();
    } catch (error) {
      console.error('Error updating question order:', error);
      toast({ title: '오류', description: '질문 순서 변경 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  // 제목 자동 생성 (라벨 우선)
  const generateSurveyTitle = () => {
    const courseObj = allCourses.find((c) => c.id === courseForm.selectedCourseId);
    const courseTitle = courseObj?.title || '';
    const label =
      surveyForm.round_label?.trim() ||
      `${surveyForm.education_year}년 ${
        surveyForm.is_combined && surveyForm.combined_round_start && surveyForm.combined_round_end
          ? `${surveyForm.combined_round_start}∼${surveyForm.combined_round_end}`
          : surveyForm.education_round
      }차 - ${surveyForm.course_name || '과정'}`;

    if (label && courseTitle) return `[${label}] ${courseTitle}`;
    if (courseTitle) return courseTitle;
    return label || '';
  };

  const handleUpdateSurveyInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const toUTC = (local: string) => (!local ? null : new Date(local).toISOString());

      // 라벨 자동 생성(수정 폼에서 비워져 있으면 갱신)
      const autoLabel =
        surveyForm.round_label?.trim() ||
        `${surveyForm.education_year}년 ${
          surveyForm.is_combined && surveyForm.combined_round_start && surveyForm.combined_round_end
            ? `${surveyForm.combined_round_start}∼${surveyForm.combined_round_end}`
            : surveyForm.education_round
        }차 - ${surveyForm.course_name || '과정'}`;

      const finalTitle = generateSurveyTitle() || surveyForm.title;

      const { error } = await supabase
        .from('surveys')
        .update({
          title: finalTitle,
          description: surveyForm.description,
          education_year: surveyForm.education_year,
          education_round: surveyForm.education_round,
          course_name: surveyForm.course_name,
          is_combined: surveyForm.is_combined,
          combined_round_start: surveyForm.is_combined ? surveyForm.combined_round_start : null,
          combined_round_end: surveyForm.is_combined ? surveyForm.combined_round_end : null,
          round_label: autoLabel,
          start_date: toUTC(surveyForm.start_date),
          end_date: toUTC(surveyForm.end_date),
          status: surveyForm.status,
        })
        .eq('id', surveyId);

      if (error) throw error;

      toast({ title: '성공', description: '설문조사 정보가 수정되었습니다.' });
      setIsSurveyInfoDialogOpen(false);
      fetchSurveyData();
    } catch (error) {
      console.error('Error updating survey:', error);
      toast({ title: '오류', description: '설문조사 정보 수정 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  const handleUpdateInstructor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('surveys')
        .update({ instructor_id: instructorForm.selectedInstructorId })
        .eq('id', surveyId);
      if (error) throw error;

      toast({ title: '성공', description: '강사가 변경되었습니다.' });
      setIsInstructorDialogOpen(false);
      fetchSurveyData();
    } catch (error) {
      console.error('Error updating instructor:', error);
      toast({ title: '오류', description: '강사 변경 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const autoTitle = generateSurveyTitle();
      const { error } = await supabase
        .from('surveys')
        .update({
          course_id: courseForm.selectedCourseId,
          title: autoTitle || survey?.title,
        })
        .eq('id', surveyId);
      if (error) throw error;

      toast({ title: '성공', description: '과목이 변경되었습니다.' });
      setIsCourseDialogOpen(false);
      fetchSurveyData();
    } catch (error) {
      console.error('Error updating course:', error);
      toast({ title: '오류', description: '과목 변경 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  // 섹션 CRUD
  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!surveyId) {
      toast({ title: '오류', description: '설문 ID가 없습니다.', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.from('survey_sections').insert([
        {
          survey_id: surveyId,
          name: sectionForm.name,
          description: sectionForm.description,
          order_index: sections.length,
        },
      ]);
      if (error) throw error;
      toast({ title: '성공', description: '섹션이 추가되었습니다.' });
      setSectionForm({ name: '', description: '' });
      setIsSectionDialogOpen(false);
      fetchSurveyData();
    } catch (error: any) {
      console.error('Error adding section:', error);
      toast({ title: '오류', description: error?.message || '섹션 추가 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  const handleEditSectionOpen = (section: Section) => {
    setEditingSection(section);
    setSectionEditForm({ name: section.name, description: section.description || '' });
    setIsSectionEditDialogOpen(true);
  };

  const handleUpdateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSection) return;
    try {
      const { error } = await supabase
        .from('survey_sections')
        .update({ name: sectionEditForm.name, description: sectionEditForm.description })
        .eq('id', editingSection.id);
      if (error) throw error;
      toast({ title: '성공', description: '섹션이 수정되었습니다.' });
      setIsSectionEditDialogOpen(false);
      setEditingSection(null);
      fetchSurveyData();
    } catch (error: any) {
      console.error('Error updating section:', error);
      toast({ title: '오류', description: error?.message || '섹션 수정 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!window.confirm('해당 섹션을 삭제하시겠습니까? 섹션 내 질문은 섹션 없음으로 이동됩니다.')) return;
    try {
      const { error: qErr } = await supabase.from('survey_questions').update({ section_id: null }).eq('section_id', sectionId);
      if (qErr) throw qErr;

      const { error: delErr } = await supabase.from('survey_sections').delete().eq('id', sectionId);
      if (delErr) throw delErr;

      toast({ title: '성공', description: '섹션이 삭제되었습니다.' });
      fetchSurveyData();
    } catch (error: any) {
      console.error('Error deleting section:', error);
      toast({ title: '오류', description: error?.message || '섹션 삭제 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  // Sortable 아이템
  const SortableQuestionItem = ({ question, index }: { question: Question; index: number }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      cursor: 'grab',
    };
    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative group border rounded-lg bg-white">
        {/* Drag handle */}
        <div className="absolute left-2 top-2 flex items-center justify-center w-6 h-6 bg-primary/10 text-primary text-xs font-medium rounded-full cursor-grab">
          <GripVertical className="h-4 w-4" />
        </div>
        {/* 번호 */}
        <div className="absolute left-10 top-2 flex items-center justify-center w-6 h-6 text-primary text-xs font-medium rounded-full">
          {index + 1}
        </div>
        {/* 우측 버튼 */}
        <div className="absolute top-2 right-2 flex gap-1 z-10">
          <Button variant="ghost" size="sm" className="bg-white/90 hover:bg-white border shadow-sm" onClick={() => handleEditQuestion(question)}>
            <Edit className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="bg-white/90 hover:bg-white border shadow-sm" onClick={() => handleDeleteQuestion(question.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        {/* 본문 */}
        <div className="pl-16 pr-20 py-4">
          {question.question_type === 'scale' ? (
            <div>
              <div className="mb-4">
                <h3 className="font-medium text-sm">
                  {question.question_text}
                  {question.is_required && <span className="text-red-500 ml-1">*</span>}
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>전혀 그렇지 않다</span>
                  <span>매우 그렇다</span>
                </div>
                <RadioGroup className="flex items-center justify-between">
                  {Array.from({ length: (question.options?.max || 10) - (question.options?.min || 1) + 1 }, (_, i) => {
                    const value = (question.options?.min || 1) + i;
                    return (
                      <div key={value} className="flex flex-col items-center space-y-1">
                        <span className="text-xs font-medium">{value}</span>
                        <RadioGroupItem value={String(value)} disabled />
                      </div>
                    );
                  })}
                </RadioGroup>
              </div>
            </div>
          ) : (
            <div>
              <h3 className="font-medium text-sm mb-2">
                {question.question_text}
                {question.is_required && <span className="text-red-500 ml-1">*</span>}
              </h3>
              {question.question_type === 'text' && <Textarea placeholder="답변을 입력하세요" disabled />}
            </div>
          )}
        </div>
      </div>
    );
  };

  // -----------------------
  // 렌더
  // -----------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div>로딩중...</div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="flex items-center justify-center py-8">
        <div>설문조사를 찾을 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center relative">
          <Button onClick={() => navigate('/survey-management')} variant="ghost" size="sm" className="touch-friendly">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">설문조사 관리</span>
          </Button>
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <h1 className="text-sm sm:text-lg font-semibold text-primary text-center break-words">설문조사 편집</h1>
            <p className="text-xs text-muted-foreground text-center break-words line-clamp-2">{survey.title}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="space-y-6">
          {/* Survey Header */}
          <Card>
            <CardHeader>
              <div className="space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-left break-words hyphens-auto">{survey.title}</CardTitle>
                    <p className="text-left text-sm text-muted-foreground break-words hyphens-auto mt-2">{survey.description}</p>
                  </div>
                  <SurveyInfoEditDialog
                    isOpen={isSurveyInfoDialogOpen}
                    onOpenChange={setIsSurveyInfoDialogOpen}
                    surveyForm={surveyForm}
                    setSurveyForm={setSurveyForm}
                    onSubmit={handleUpdateSurveyInfo}
                  />
                </div>
                <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                  <span>교육년도: {survey.education_year}년</span>
                  <span>차수: {survey.education_round}차</span>
                  {survey.round_label && <Badge variant="outline">라벨: {survey.round_label}</Badge>}
                  <Badge variant={survey.status === 'active' ? 'default' : survey.status === 'completed' ? 'secondary' : 'outline'}>
                    {survey.status === 'active' ? '진행중' : survey.status === 'completed' ? '완료' : '초안'}
                  </Badge>
                </div>
                {(survey.start_date || survey.end_date) && (
                  <div className="flex justify-start gap-4 mt-2 text-xs text-muted-foreground">
                    {survey.start_date && <span>시작: {new Date(survey.start_date).toLocaleString()}</span>}
                    {survey.end_date && <span>종료: {new Date(survey.end_date).toLocaleString()}</span>}
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Instructor Info */}
          <InstructorInfoSection instructor={instructor} />

          {/* Instructor & Course */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Instructor */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">강사 정보</h3>
                  <Dialog open={isInstructorDialogOpen} onOpenChange={setIsInstructorDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-2" />
                        변경
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>강사 변경</DialogTitle>
                        <DialogDescription>설문조사를 담당할 강사를 변경할 수 있습니다.</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleUpdateInstructor} className="space-y-4">
                        <div>
                          <Label htmlFor="instructor_select">강사 선택</Label>
                          <Select
                            value={instructorForm.selectedInstructorId}
                            onValueChange={(value) => setInstructorForm((prev) => ({ ...prev, selectedInstructorId: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="강사를 선택하세요" />
                            </SelectTrigger>
                            <SelectContent className="bg-background z-50">
                              {allInstructors.map((inst) => (
                                <SelectItem key={inst.id} value={inst.id}>
                                  {inst.name} {inst.email && `(${inst.email})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setIsInstructorDialogOpen(false)}>
                            취소
                          </Button>
                          <Button type="submit">변경</Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                {instructor ? (
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                      {instructor.photo_url ? (
                        <img src={instructor.photo_url} alt={instructor.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-xs text-muted-foreground text-center">
                          사진
                          <br />
                          없음
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{instructor.name}</p>
                      {instructor.email && <p className="text-sm text-muted-foreground">{instructor.email}</p>}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">강사 정보 없음</p>
                )}
              </CardContent>
            </Card>

            {/* Course */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">과목 정보</h3>
                  <Dialog open={isCourseDialogOpen} onOpenChange={setIsCourseDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-2" />
                        변경
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>과목 변경</DialogTitle>
                        <DialogDescription>설문조사에 연결된 과목을 변경할 수 있습니다.</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleUpdateCourse} className="space-y-4">
                        <div>
                          <Label htmlFor="course_select">과목 선택</Label>
                          <Select
                            value={courseForm.selectedCourseId}
                            onValueChange={(value) => setCourseForm((prev) => ({ ...prev, selectedCourseId: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="과목을 선택하세요" />
                            </SelectTrigger>
                            <SelectContent className="bg-background z-50">
                              {allCourses.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setIsCourseDialogOpen(false)}>
                            취소
                          </Button>
                          <Button type="submit">변경</Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                {course ? (
                  <div>
                    <p className="font-medium">{course.title}</p>
                    {course.description && <p className="text-sm text-muted-foreground mt-1">{course.description}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">과목 정보 없음</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 가이드 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                설문 유형 가이드
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded-lg p-4 bg-muted/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <h3 className="font-medium text-sm">이론 과목</h3>
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium">구성:</span> 이론만
                    </p>
                    <p>
                      <span className="font-medium">강사:</span> 단일 강사
                    </p>
                    <p>
                      <span className="font-medium">설문:</span> 이론용 설문만
                    </p>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-muted/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <h3 className="font-medium text-sm">이론+실습 (동일강사)</h3>
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium">구성:</span> 이론+실습
                    </p>
                    <p>
                      <span className="font-medium">강사:</span> 동일 강사
                    </p>
                    <p>
                      <span className="font-medium">설문:</span> 실습용 설문만
                    </p>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-muted/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <h3 className="font-medium text-sm">이론+실습 (다른강사)</h3>
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium">구성:</span> 이론+실습
                    </p>
                    <p>
                      <span className="font-medium">강사:</span> 서로 다름
                    </p>
                    <p>
                      <span className="font-medium">설문:</span> 각각 별도 설문
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 질문 영역 */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">설문 질문</h2>
              <div className="flex gap-2">
                <SurveyInfoEditDialog
                  isOpen={isSurveyInfoDialogOpen}
                  onOpenChange={setIsSurveyInfoDialogOpen}
                  surveyForm={surveyForm}
                  setSurveyForm={setSurveyForm}
                  onSubmit={handleUpdateSurveyInfo}
                />
                <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <FileText className="h-4 w-4 mr-2" />
                      템플릿 불러오기
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>템플릿 선택</DialogTitle>
                      <DialogDescription>선택한 템플릿의 질문으로 대체됩니다.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      {templates.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">사용 가능한 템플릿이 없습니다.</div>
                      ) : (
                        templates.map((t) => (
                          <Card
                            key={t.id}
                            className="cursor-pointer hover:shadow-md"
                            onClick={async () => {
                              if (!window.confirm('기존 질문이 삭제됩니다. 계속할까요?')) return;
                              try {
                                await supabase.from('survey_questions').delete().eq('survey_id', surveyId);
                                await supabase.from('survey_sections').delete().eq('survey_id', surveyId);

                                const { data: templateSections } = await supabase
                                  .from('template_sections')
                                  .select('*')
                                  .eq('template_id', t.id)
                                  .order('order_index');

                                let idMap: Record<string, string> = {};
                                if (templateSections && templateSections.length) {
                                  const { data: createdSections, error: createErr } = await supabase
                                    .from('survey_sections')
                                    .insert(
                                      templateSections.map((ts) => ({
                                        survey_id: surveyId,
                                        name: ts.name,
                                        description: ts.description,
                                        order_index: ts.order_index,
                                      }))
                                    )
                                    .select();

                                  if (createErr) throw createErr;
                                  templateSections.forEach((ts, i) => (idMap[ts.id] = (createdSections as any)[i].id));
                                }

                                const { data: templateQuestions, error: qErr } = await supabase
                                  .from('template_questions')
                                  .select('*')
                                  .eq('template_id', t.id)
                                  .order('order_index');
                                if (qErr) throw qErr;

                                if (templateQuestions && templateQuestions.length) {
                                  const payload = templateQuestions.map((q) => ({
                                    survey_id: surveyId,
                                    question_text: q.question_text,
                                    question_type: q.question_type,
                                    options: q.options,
                                    is_required: q.is_required,
                                    order_index: q.order_index,
                                    section_id: q.section_id ? idMap[q.section_id] : null,
                                    satisfaction_type: q.satisfaction_type,
                                  }));
                                  const { error: insErr } = await supabase.from('survey_questions').insert(payload);
                                  if (insErr) throw insErr;
                                }

                                toast({ title: '성공', description: '템플릿을 적용했습니다.' });
                                setIsTemplateDialogOpen(false);
                                fetchSurveyData();
                              } catch (e: any) {
                                console.error(e);
                                toast({ title: '오류', description: e?.message || '템플릿 적용 오류', variant: 'destructive' });
                              }
                            }}
                          >
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="font-medium">{t.name}</h3>
                                  {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                                </div>
                                {t.is_course_evaluation && <Badge>강의평가</Badge>}
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={isSectionDialogOpen} onOpenChange={setIsSectionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <FolderPlus className="h-4 w-4 mr-2" />
                      섹션 추가
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>새 섹션 추가</DialogTitle>
                      <DialogDescription>설문조사에 새로운 섹션을 추가합니다.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddSection} className="space-y-4">
                      <div>
                        <Label htmlFor="section_name">섹션 이름</Label>
                        <Input
                          id="section_name"
                          value={sectionForm.name}
                          onChange={(e) => setSectionForm((p) => ({ ...p, name: e.target.value }))}
                          placeholder="섹션 이름"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="section_description">섹션 설명</Label>
                        <Textarea
                          id="section_description"
                          value={sectionForm.description}
                          onChange={(e) => setSectionForm((p) => ({ ...p, description: e.target.value }))}
                          placeholder="섹션 설명(선택)"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsSectionDialogOpen(false)}>
                          취소
                        </Button>
                        <Button type="submit">추가</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>

                <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetQuestionForm(); }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      질문 추가
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>{editingQuestion ? '질문 수정' : '새 질문 추가'}</DialogTitle>
                      <DialogDescription>{editingQuestion ? '선택한 질문을 수정합니다.' : '새 질문을 추가합니다.'}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddQuestion} className="space-y-4">
                      <div>
                        <Label htmlFor="question_text">질문 내용</Label>
                        <Textarea
                          id="question_text"
                          value={questionForm.question_text}
                          onChange={(e) => setQuestionForm((p) => ({ ...p, question_text: e.target.value }))}
                          placeholder="질문을 입력하세요"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="question_type">질문 유형</Label>
                          <Select value={questionForm.question_type} onValueChange={(v: any) => setQuestionForm((p) => ({ ...p, question_type: v }))}>
                            <SelectTrigger>
                              <SelectValue placeholder="질문 유형 선택" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="scale">척도</SelectItem>
                              <SelectItem value="text">주관식</SelectItem>
                              <SelectItem value="multiple_choice">객관식</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="section">섹션</Label>
                          <Select value={questionForm.section_id} onValueChange={(v) => setQuestionForm((p) => ({ ...p, section_id: v }))}>
                            <SelectTrigger>
                              <SelectValue placeholder="섹션 선택(선택)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">섹션 없음</SelectItem>
                              {sections.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="satisfaction_type">만족도 태그</Label>
                        <Select
                          value={questionForm.satisfaction_type}
                          onValueChange={(v) => setQuestionForm((p) => ({ ...p, satisfaction_type: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="만족도 태그(선택)" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="none">태그 없음</SelectItem>
                            <SelectItem value="subject">과목 만족도</SelectItem>
                            <SelectItem value="instructor">강사 만족도</SelectItem>
                            <SelectItem value="operation">운영 만족도</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {questionForm.question_type === 'scale' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="scale_min">최소값</Label>
                            <Input
                              id="scale_min"
                              type="number"
                              min={1}
                              max={10}
                              value={questionForm.scale_min}
                              onChange={(e) => setQuestionForm((p) => ({ ...p, scale_min: parseInt(e.target.value || '1') }))}
                            />
                          </div>
                          <div>
                            <Label htmlFor="scale_max">최대값</Label>
                            <Input
                              id="scale_max"
                              type="number"
                              min={2}
                              max={10}
                              value={questionForm.scale_max}
                              onChange={(e) => setQuestionForm((p) => ({ ...p, scale_max: parseInt(e.target.value || '10') }))}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                          취소
                        </Button>
                        <Button type="submit">{editingQuestion ? '수정' : '추가'}</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* 섹션별 질문 */}
            {sections.length > 0 && (
              <div className="space-y-4">
                {sections.map((sec) => {
                  const sectionQuestions = questions.filter((q) => q.section_id === sec.id).sort((a, b) => a.order_index - b.order_index);
                  return (
                    <div key={sec.id} className="space-y-4">
                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant="outline">{sec.name}</Badge>
                            {sec.description && <span className="text-sm text-muted-foreground truncate">{sec.description}</span>}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" aria-label="섹션 수정" onClick={() => handleEditSectionOpen(sec)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" aria-label="섹션 삭제" onClick={() => handleDeleteSection(sec.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <Separator className="mt-2" />
                      </div>

                      <div className="space-y-3 ml-4">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                          <SortableContext items={sectionQuestions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                            {sectionQuestions.map((q, idx) => (
                              <SortableQuestionItem key={q.id} question={q} index={idx} />
                            ))}
                          </SortableContext>
                        </DndContext>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 섹션 없는 질문 */}
            <div className="space-y-4">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={questions.filter((q) => !q.section_id).map((q) => q.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {questions
                    .filter((q) => !q.section_id)
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((q, idx) => (
                      <SortableQuestionItem key={q.id} question={q} index={idx} />
                    ))}
                </SortableContext>
              </DndContext>
            </div>

            {questions.length === 0 && <div className="text-center py-8 text-muted-foreground">아직 질문이 없습니다. 첫 질문을 추가해보세요.</div>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SurveyBuilder;