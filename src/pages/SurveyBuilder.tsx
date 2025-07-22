import { useState, useEffect } from 'react'; // Survey builder hooks
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, Edit, GripVertical, FileText, FolderPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options?: any;
  is_required: boolean;
  order_index: number;
  section_id?: string;
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

interface Survey {
  id: string;
  title: string;
  description: string;
  instructor_id: string;
  course_id: string;
  education_year: number;
  education_round: number;
  start_date: string;
  end_date: string;
  status: string;
}

interface Instructor {
  id: string;
  name: string;
  photo_url?: string;
}

const SurveyBuilder = () => {
  const navigate = useNavigate();
  const { surveyId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSectionDialogOpen, setIsSectionDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isSurveyInfoDialogOpen, setIsSurveyInfoDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  const [questionForm, setQuestionForm] = useState({
    question_text: '',
    question_type: 'scale' as string,
    is_required: true,
    options: null as any,
    section_id: 'none',
    scale_min: 1,
    scale_max: 10
  });

  const [sectionForm, setSectionForm] = useState({
    name: '',
    description: ''
  });

  const [surveyForm, setSurveyForm] = useState({
    title: '',
    description: '',
    education_year: new Date().getFullYear(),
    education_round: 1,
    start_date: '',
    end_date: '',
    status: 'draft'
  });

  useEffect(() => {
    if (surveyId) {
      fetchSurveyData();
      fetchTemplates();
    }
  }, [surveyId]);

  const fetchSurveyData = async () => {
    try {
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select('*, instructors(*)')
        .eq('id', surveyId)
        .single();

      if (surveyError) throw surveyError;

      setSurvey(surveyData);
      setInstructor(surveyData.instructors);
      
      // 설문 정보 폼 초기화
      setSurveyForm({
        title: surveyData.title || '',
        description: surveyData.description || '',
        education_year: surveyData.education_year || new Date().getFullYear(),
        education_round: surveyData.education_round || 1,
        start_date: surveyData.start_date ? surveyData.start_date.slice(0, 16) : '',
        end_date: surveyData.end_date ? surveyData.end_date.slice(0, 16) : '',
        status: surveyData.status || 'draft'
      });

      const { data: questionsData, error: questionsError } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', surveyId)
        .order('order_index');

      if (questionsError) throw questionsError;

      setQuestions(questionsData?.map(q => ({
        ...q,
        question_type: q.question_type as string
      })) || []);

      // Fetch survey sections
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('survey_sections')
        .select('*')
        .eq('survey_id', surveyId)
        .order('order_index');

      if (sectionsError) throw sectionsError;
      setSections(sectionsData || []);
    } catch (error) {
      console.error('Error fetching survey data:', error);
      toast({
        title: "오류",
        description: "설문조사 데이터를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('survey_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const resetQuestionForm = () => {
    setQuestionForm({
      question_text: '',
      question_type: 'scale',
      is_required: true,
      options: null,
      section_id: 'none',
      scale_min: 1,
      scale_max: 10
    });
    setEditingQuestion(null);
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const newOrderIndex = questions.length;
      const questionData = {
        survey_id: surveyId,
        question_text: questionForm.question_text,
        question_type: questionForm.question_type,
        is_required: questionForm.is_required,
        order_index: newOrderIndex,
        options: questionForm.question_type === 'scale' ? { min: questionForm.scale_min, max: questionForm.scale_max } : questionForm.options,
        section_id: questionForm.section_id === 'none' ? null : questionForm.section_id
      };

      if (editingQuestion) {
        const { error } = await supabase
          .from('survey_questions')
          .update(questionData)
          .eq('id', editingQuestion.id);

        if (error) throw error;

        toast({
          title: "성공",
          description: "질문이 수정되었습니다."
        });
      } else {
        const { error } = await supabase
          .from('survey_questions')
          .insert([questionData]);

        if (error) throw error;

        toast({
          title: "성공",
          description: "질문이 추가되었습니다."
        });
      }

      setIsDialogOpen(false);
      resetQuestionForm();
      fetchSurveyData();
    } catch (error) {
      console.error('Error saving question:', error);
      toast({
        title: "오류",
        description: "질문 저장 중 오류가 발생했습니다.",
        variant: "destructive"
      });
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
      scale_max: question.options?.max || 10
    });
    setIsDialogOpen(true);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!window.confirm('이 질문을 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('survey_questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;

      toast({
        title: "성공",
        description: "질문이 삭제되었습니다."
      });

      fetchSurveyData();
    } catch (error) {
      console.error('Error deleting question:', error);
      toast({
        title: "오류",
        description: "질문 삭제 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from('survey_sections')
        .insert([{
          survey_id: surveyId,
          name: sectionForm.name,
          description: sectionForm.description,
          order_index: sections.length
        }]);

      if (error) throw error;
      
      toast({
        title: "성공",
        description: "섹션이 추가되었습니다."
      });

      setSectionForm({ name: '', description: '' });
      setIsSectionDialogOpen(false);
      fetchSurveyData(); // 섹션 목록 새로고침
    } catch (error) {
      console.error('Error adding section:', error);
      toast({
        title: "오류",
        description: "섹션 추가 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const handleLoadTemplate = async (templateId: string) => {
    try {
      const { data: templateQuestions, error } = await supabase
        .from('template_questions')
        .select('*')
        .eq('template_id', templateId)
        .order('order_index');

      if (error) throw error;

      if (templateQuestions) {
        const newQuestions = templateQuestions.map((tq, index) => ({
          survey_id: surveyId,
          question_text: tq.question_text,
          question_type: tq.question_type,
          is_required: tq.is_required,
          order_index: questions.length + index,
          options: tq.options
        }));

        const { error: insertError } = await supabase
          .from('survey_questions')
          .insert(newQuestions);

        if (insertError) throw insertError;

        toast({
          title: "성공",
          description: "템플릿이 적용되었습니다."
        });

        setIsTemplateDialogOpen(false);
        fetchSurveyData();
      }
    } catch (error) {
      console.error('Error loading template:', error);
      toast({
        title: "오류",
        description: "템플릿 불러오기 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const handleUpdateSurveyInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const updateData = {
        title: surveyForm.title,
        description: surveyForm.description,
        education_year: surveyForm.education_year,
        education_round: surveyForm.education_round,
        start_date: surveyForm.start_date ? new Date(surveyForm.start_date).toISOString() : null,
        end_date: surveyForm.end_date ? new Date(surveyForm.end_date).toISOString() : null,
        status: surveyForm.status,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('surveys')
        .update(updateData)
        .eq('id', surveyId);

      if (error) throw error;

      toast({
        title: "성공",
        description: "설문조사 정보가 수정되었습니다."
      });

      setIsSurveyInfoDialogOpen(false);
      fetchSurveyData();
    } catch (error) {
      console.error('Error updating survey info:', error);
      toast({
        title: "오류",
        description: "설문조사 정보 수정 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const renderScaleQuestion = (question: Question, index: number) => {
    const min = question.options?.min || 1;
    const max = question.options?.max || 10;
    const range = max - min + 1;
    
    return (
      <div className="p-4 border rounded-lg bg-white">
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
            {Array.from({ length: range }, (_, i) => {
              const value = min + i;
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
    );
  };

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
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <Button
              onClick={() => navigate('/survey-management')}
              variant="ghost"
              size="sm"
              className="mr-3"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              설문조사 관리
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-primary">설문조사 편집</h1>
              <p className="text-xs text-muted-foreground">{survey.title}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="space-y-6">
          {/* Survey Header */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-center">
                    {survey.title}
                  </CardTitle>
                  <p className="text-center text-sm text-muted-foreground">
                    {survey.description}
                  </p>
                  <div className="flex justify-center gap-4 mt-4 text-sm text-muted-foreground">
                    <span>교육년도: {survey.education_year}년</span>
                    <span>차수: {survey.education_round}차</span>
                    <Badge variant={survey.status === 'active' ? 'default' : survey.status === 'completed' ? 'secondary' : 'outline'}>
                      {survey.status === 'active' ? '진행중' : survey.status === 'completed' ? '완료' : '초안'}
                    </Badge>
                  </div>
                  {(survey.start_date || survey.end_date) && (
                    <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
                      {survey.start_date && <span>시작: {new Date(survey.start_date).toLocaleString()}</span>}
                      {survey.end_date && <span>종료: {new Date(survey.end_date).toLocaleString()}</span>}
                    </div>
                  )}
                </div>
                <Dialog open={isSurveyInfoDialogOpen} onOpenChange={setIsSurveyInfoDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-2" />
                      설문정보 수정
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>설문조사 정보 수정</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleUpdateSurveyInfo} className="space-y-4">
                      <div>
                        <Label htmlFor="survey_title">설문 제목</Label>
                        <Input
                          id="survey_title"
                          value={surveyForm.title}
                          onChange={(e) => setSurveyForm(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="설문 제목을 입력하세요"
                          required
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="survey_description">설문 설명</Label>
                        <Textarea
                          id="survey_description"
                          value={surveyForm.description}
                          onChange={(e) => setSurveyForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="설문 설명을 입력하세요"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="education_year">교육년도</Label>
                          <Input
                            id="education_year"
                            type="number"
                            value={surveyForm.education_year}
                            onChange={(e) => setSurveyForm(prev => ({ ...prev, education_year: parseInt(e.target.value) }))}
                            min="2020"
                            max="2030"
                          />
                        </div>
                        <div>
                          <Label htmlFor="education_round">차수</Label>
                          <Input
                            id="education_round"
                            type="number"
                            value={surveyForm.education_round}
                            onChange={(e) => setSurveyForm(prev => ({ ...prev, education_round: parseInt(e.target.value) }))}
                            min="1"
                            max="10"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="survey_status">상태</Label>
                        <Select 
                          value={surveyForm.status} 
                          onValueChange={(value) => setSurveyForm(prev => ({ ...prev, status: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">초안</SelectItem>
                            <SelectItem value="active">진행중</SelectItem>
                            <SelectItem value="completed">완료</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <Label htmlFor="start_date">시작일시</Label>
                          <Input
                            id="start_date"
                            type="datetime-local"
                            value={surveyForm.start_date}
                            onChange={(e) => setSurveyForm(prev => ({ ...prev, start_date: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="end_date">종료일시</Label>
                          <Input
                            id="end_date"
                            type="datetime-local"
                            value={surveyForm.end_date}
                            onChange={(e) => setSurveyForm(prev => ({ ...prev, end_date: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsSurveyInfoDialogOpen(false)}>
                          취소
                        </Button>
                        <Button type="submit">
                          수정 완료
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
          </Card>

          {/* Instructor Info */}
          {instructor && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                    {instructor.photo_url ? (
                      <img 
                        src={instructor.photo_url} 
                        alt={instructor.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-xs text-muted-foreground text-center">
                        사진<br/>없음
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium">강사 정보</h3>
                    <p className="text-sm text-muted-foreground">강사: {instructor.name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Questions */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">설문 질문</h2>
              <div className="flex gap-2">
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
                    </DialogHeader>
                    <div className="space-y-2">
                      {templates.map((template) => (
                        <Card key={template.id} className="cursor-pointer hover:shadow-md" onClick={() => handleLoadTemplate(template.id)}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-medium">{template.name}</h3>
                                {template.description && (
                                  <p className="text-sm text-muted-foreground">{template.description}</p>
                                )}
                              </div>
                              {template.is_course_evaluation && (
                                <Badge>강의평가</Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
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
                    </DialogHeader>
                    <form onSubmit={handleAddSection} className="space-y-4">
                      <div>
                        <Label htmlFor="section_name">섹션 이름</Label>
                        <Input
                          id="section_name"
                          value={sectionForm.name}
                          onChange={(e) => setSectionForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="섹션 이름을 입력하세요"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="section_description">섹션 설명</Label>
                        <Textarea
                          id="section_description"
                          value={sectionForm.description}
                          onChange={(e) => setSectionForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="섹션 설명을 입력하세요 (선택사항)"
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

                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                  setIsDialogOpen(open);
                  if (!open) resetQuestionForm();
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      질문 추가
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>
                        {editingQuestion ? '질문 수정' : '새 질문 추가'}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddQuestion} className="space-y-4">
                      <div>
                        <Label htmlFor="question_text">질문 내용</Label>
                        <Textarea
                          id="question_text"
                          value={questionForm.question_text}
                          onChange={(e) => setQuestionForm(prev => ({ ...prev, question_text: e.target.value }))}
                          placeholder="질문을 입력하세요"
                          required
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="question_type">질문 유형</Label>
                          <Select 
                            value={questionForm.question_type} 
                            onValueChange={(value: any) => setQuestionForm(prev => ({ ...prev, question_type: value }))}
                          >
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
                          <Select 
                            value={questionForm.section_id} 
                            onValueChange={(value) => setQuestionForm(prev => ({ ...prev, section_id: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="섹션 선택 (선택사항)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">섹션 없음</SelectItem>
                              {sections.map((section) => (
                                <SelectItem key={section.id} value={section.id}>
                                  {section.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {questionForm.question_type === 'scale' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="scale_min">최소값</Label>
                            <Input
                              id="scale_min"
                              type="number"
                              min="1"
                              max="10"
                              value={questionForm.scale_min}
                              onChange={(e) => setQuestionForm(prev => ({ ...prev, scale_min: parseInt(e.target.value) }))}
                            />
                          </div>
                          <div>
                            <Label htmlFor="scale_max">최대값</Label>
                            <Input
                              id="scale_max"
                              type="number"
                              min="2"
                              max="10"
                              value={questionForm.scale_max}
                              onChange={(e) => setQuestionForm(prev => ({ ...prev, scale_max: parseInt(e.target.value) }))}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                          취소
                        </Button>
                        <Button type="submit">
                          {editingQuestion ? '수정' : '추가'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Sections */}
            {sections.length > 0 && (
              <div className="space-y-4">
                {sections.map((section) => (
                  <div key={section.id} className="space-y-4">
                    <div className="border-t pt-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{section.name}</Badge>
                        {section.description && (
                          <span className="text-sm text-muted-foreground">{section.description}</span>
                        )}
                      </div>
                      <Separator className="mt-2" />
                    </div>
                    
                    {/* Questions in this section */}
                    <div className="space-y-3 ml-4">
                      {questions
                        .filter((q) => q.section_id === section.id)
                        .map((question, index) => (
                          <div key={question.id} className="relative">
                            <div className="absolute top-2 right-2 flex gap-1 z-10">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditQuestion(question)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteQuestion(question.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            
                            {question.question_type === 'scale' ? (
                              renderScaleQuestion(question, index)
                            ) : (
                              <div className="p-4 border rounded-lg bg-white">
                                <h3 className="font-medium text-sm mb-2">
                                  {question.question_text}
                                  {question.is_required && <span className="text-red-500 ml-1">*</span>}
                                </h3>
                                {question.question_type === 'text' && (
                                  <Textarea placeholder="답변을 입력하세요" disabled />
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Questions without sections */}
            <div className="space-y-4">
              {questions
                .filter((q) => !q.section_id)
                .map((question, index) => (
                  <div key={question.id} className="relative">
                    <div className="absolute top-2 right-2 flex gap-1 z-10">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditQuestion(question)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteQuestion(question.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {question.question_type === 'scale' ? (
                      renderScaleQuestion(question, index)
                    ) : (
                      <div className="p-4 border rounded-lg bg-white">
                        <h3 className="font-medium text-sm mb-2">
                          {question.question_text}
                          {question.is_required && <span className="text-red-500 ml-1">*</span>}
                        </h3>
                        {question.question_type === 'text' && (
                          <Textarea placeholder="답변을 입력하세요" disabled />
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>

            {questions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                아직 질문이 없습니다. 첫 번째 질문을 추가해보세요.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SurveyBuilder;