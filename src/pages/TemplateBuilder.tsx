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
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, Edit, FolderPlus, ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TemplateQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options?: any;
  is_required: boolean;
  order_index: number;
  section_id?: string;
  satisfaction_type?: string;
}

interface TemplateSection {
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

const TemplateBuilder = () => {
  const navigate = useNavigate();
  const { templateId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [template, setTemplate] = useState<Template | null>(null);
  const [questions, setQuestions] = useState<TemplateQuestion[]>([]);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSectionDialogOpen, setIsSectionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<TemplateQuestion | null>(null);
  const [editingSection, setEditingSection] = useState<TemplateSection | null>(null);

  // DnD sensors for mouse and touch
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const [sectionForm, setSectionForm] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    if (templateId) {
      fetchTemplateData();
    }
  }, [templateId]);

  const fetchTemplateData = async () => {
    try {
      const { data: templateData, error: templateError } = await supabase
        .from('survey_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (templateError) throw templateError;
      setTemplate(templateData);

      const { data: questionsData, error: questionsError } = await supabase
        .from('template_questions')
        .select('*')
        .eq('template_id', templateId)
        .order('order_index');

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

      const { data: sectionsData, error: sectionsError } = await supabase
        .from('template_sections')
        .select('*')
        .eq('template_id', templateId)
        .order('order_index');

      if (sectionsError) throw sectionsError;
      setSections(sectionsData || []);
    } catch (error) {
      console.error('Error fetching template data:', error);
      toast({
        title: "오류",
        description: "템플릿 데이터를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetQuestionForm = () => {
    const currentSectionId = questionForm.section_id; // 현재 선택된 섹션 유지
    setQuestionForm({
      question_text: '',
      question_type: 'scale',
      is_required: true,
      options: null,
      section_id: editingQuestion ? 'none' : currentSectionId, // 편집 중이 아닐 때만 섹션 유지
      scale_min: 1,
      scale_max: 10,
      satisfaction_type: 'none'
    });
    setEditingQuestion(null);
  };

  const handleMoveQuestion = async (questionId: string, direction: 'up' | 'down') => {
    try {
      const currentQuestion = questions.find(q => q.id === questionId);
      if (!currentQuestion) return;

      const questionsInSameContext = questions.filter(q => q.section_id === currentQuestion.section_id);
      const currentIndex = questionsInSameContext.findIndex(q => q.id === questionId);
      
      if (direction === 'up' && currentIndex === 0) return;
      if (direction === 'down' && currentIndex === questionsInSameContext.length - 1) return;

      const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      const swapQuestion = questionsInSameContext[swapIndex];

      // Swap order_index
      const { error: error1 } = await supabase
        .from('template_questions')
        .update({ order_index: swapQuestion.order_index })
        .eq('id', currentQuestion.id);

      const { error: error2 } = await supabase
        .from('template_questions')
        .update({ order_index: currentQuestion.order_index })
        .eq('id', swapQuestion.id);

      if (error1 || error2) throw error1 || error2;

      toast({
        title: "성공",
        description: "질문 순서가 변경되었습니다."
      });

      fetchTemplateData();
    } catch (error) {
      console.error('Error moving question:', error);
      toast({
        title: "오류",
        description: "질문 순서 변경 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const newOrderIndex = questions.length;
      const questionData = {
        template_id: templateId,
        question_text: questionForm.question_text,
        question_type: questionForm.question_type,
        is_required: questionForm.is_required,
        order_index: newOrderIndex,
        options: questionForm.question_type === 'scale' ? { min: questionForm.scale_min, max: questionForm.scale_max } : questionForm.options,
        section_id: questionForm.section_id === 'none' ? null : questionForm.section_id,
        satisfaction_type: questionForm.satisfaction_type === 'none' ? null : questionForm.satisfaction_type
      };

      if (editingQuestion) {
        const { error } = await supabase
          .from('template_questions')
          .update(questionData)
          .eq('id', editingQuestion.id);

        if (error) throw error;

        toast({
          title: "성공",
          description: "질문이 수정되었습니다."
        });
      } else {
        const { error } = await supabase
          .from('template_questions')
          .insert([questionData]);

        if (error) throw error;

        toast({
          title: "성공",
          description: "질문이 추가되었습니다."
        });
      }

      setIsDialogOpen(false);
      resetQuestionForm();
      fetchTemplateData();
    } catch (error) {
      console.error('Error saving question:', error);
      toast({
        title: "오류",
        description: "질문 저장 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const handleEditQuestion = (question: TemplateQuestion) => {
    setEditingQuestion(question);
    setQuestionForm({
      question_text: question.question_text,
      question_type: question.question_type,
      is_required: question.is_required,
      options: question.options,
      section_id: question.section_id || 'none',
      scale_min: question.options?.min || 1,
      scale_max: question.options?.max || 10,
      satisfaction_type: question.satisfaction_type || 'none'
    });
    setIsDialogOpen(true);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!window.confirm('이 질문을 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('template_questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;

      toast({
        title: "성공",
        description: "질문이 삭제되었습니다."
      });

      fetchTemplateData();
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
        .from('template_sections')
        .insert([{
          template_id: templateId,
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
      fetchTemplateData();
    } catch (error) {
      console.error('Error adding section:', error);
      toast({
        title: "오류",
        description: "섹션 추가 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const resetSectionForm = () => {
    setSectionForm({
      name: '',
      description: ''
    });
    setEditingSection(null);
  };

  const handleEditSection = (section: TemplateSection) => {
    setEditingSection(section);
    setSectionForm({
      name: section.name,
      description: section.description || ''
    });
    setIsSectionDialogOpen(true);
  };

  const handleUpdateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingSection) return;
    
    try {
      const { error } = await supabase
        .from('template_sections')
        .update({
          name: sectionForm.name,
          description: sectionForm.description
        })
        .eq('id', editingSection.id);

      if (error) throw error;

      toast({
        title: "성공",
        description: "섹션이 수정되었습니다."
      });

      resetSectionForm();
      setIsSectionDialogOpen(false);
      fetchTemplateData();
    } catch (error) {
      console.error('Error updating section:', error);
      toast({
        title: "오류",
        description: "섹션 수정 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  // Drag and drop handler
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = questions.findIndex(q => q.id === active.id);
    const newIndex = questions.findIndex(q => q.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newQuestions = arrayMove(questions, oldIndex, newIndex);
    
    // Update order_index for all questions
    const updatedQuestions = newQuestions.map((q, index) => ({
      ...q,
      order_index: index
    }));

    try {
      // Update all questions' order_index in database
      const updates = updatedQuestions.map(q =>
        supabase
          .from('template_questions')
          .update({ order_index: q.order_index })
          .eq('id', q.id)
      );
      
      await Promise.all(updates);
      
      setQuestions(updatedQuestions);
      
      toast({
        title: "성공",
        description: "질문 순서가 변경되었습니다."
      });
    } catch (error) {
      console.error('Error updating question order:', error);
      toast({
        title: "오류",
        description: "질문 순서 변경 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  // Sortable Question Item Component
  const SortableQuestionItem = ({ question, index, isInSection = false }: { question: TemplateQuestion; index: number; isInSection?: boolean }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: question.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    const currentQuestions = isInSection 
      ? questions.filter(q => q.section_id === question.section_id) 
      : questions.filter(q => !q.section_id);
    
    const questionIndex = currentQuestions.findIndex(q => q.id === question.id);
    const isFirst = questionIndex === 0;
    const isLast = questionIndex === currentQuestions.length - 1;

    return (
      <div
        ref={setNodeRef}
        style={style}
        className="relative group border rounded-lg bg-white"
      >
        {/* Left side - Drag handle and move buttons */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-10">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 rounded bg-white border shadow-sm hover:shadow-md transition-shadow"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 bg-white border shadow-sm hover:shadow-md"
              onClick={() => handleMoveQuestion(question.id, 'up')}
              disabled={isFirst}
            >
              <ArrowUp className="h-2.5 w-2.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 bg-white border shadow-sm hover:shadow-md"
              onClick={() => handleMoveQuestion(question.id, 'down')}
              disabled={isLast}
            >
              <ArrowDown className="h-2.5 w-2.5" />
            </Button>
          </div>
        </div>
        
        {/* Right side - Edit and delete buttons */}
        <div className="absolute top-2 right-2 flex gap-1 z-10">
          <Button
            variant="ghost"
            size="sm"
            className="bg-white/90 hover:bg-white border shadow-sm"
            onClick={() => handleEditQuestion(question)}
          >
            <Edit className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="bg-white/90 hover:bg-white border shadow-sm"
            onClick={() => handleDeleteQuestion(question.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        
        {/* Main content with left padding for buttons */}
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
              {question.question_type === 'text' && (
                <Textarea placeholder="답변을 입력하세요" disabled />
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderScaleQuestion = (question: TemplateQuestion, index: number) => {
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

  if (!template) {
    return (
      <div className="flex items-center justify-center py-8">
        <div>템플릿을 찾을 수 없습니다.</div>
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
              onClick={() => navigate('/template-management')}
              variant="ghost"
              size="sm"
              className="mr-3"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              템플릿 관리
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-primary">템플릿 편집</h1>
              <p className="text-xs text-muted-foreground">{template.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="space-y-6">
          {/* Template Header */}
          <Card>
            <CardHeader>
              <CardTitle className="text-center flex items-center justify-center gap-2">
                {template.name}
                {template.is_course_evaluation && <Badge>강의평가</Badge>}
              </CardTitle>
              {template.description && (
                <p className="text-center text-sm text-muted-foreground">
                  {template.description}
                </p>
              )}
            </CardHeader>
          </Card>

          {/* Questions */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">템플릿 질문</h2>
              <div className="flex gap-2">
                <Dialog open={isSectionDialogOpen} onOpenChange={(open) => {
                  setIsSectionDialogOpen(open);
                  if (!open) resetSectionForm();
                }}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <FolderPlus className="h-4 w-4 mr-2" />
                      섹션 추가
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingSection ? '섹션 수정' : '새 섹션 추가'}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={editingSection ? handleUpdateSection : handleAddSection} className="space-y-4">
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
                        <Button type="submit">
                          {editingSection ? '수정' : '추가'}
                        </Button>
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
                              <SelectValue />
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

                       <div>
                         <Label htmlFor="satisfaction_type">만족도 태그</Label>
                         <Select 
                           value={questionForm.satisfaction_type} 
                           onValueChange={(value) => setQuestionForm(prev => ({ ...prev, satisfaction_type: value }))}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="만족도 태그 선택 (선택사항)" />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="none">태그 없음</SelectItem>
                             <SelectItem value="course">과정 만족도</SelectItem>
                             <SelectItem value="instructor">강사 만족도</SelectItem>
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

                       <div className="flex items-center justify-between">
                         <Label htmlFor="is_required">필수 문항</Label>
                         <Switch
                           id="is_required"
                           checked={questionForm.is_required}
                           onCheckedChange={(checked) => setQuestionForm(prev => ({ ...prev, is_required: checked }))}
                         />
                       </div>

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

            {/* Sections with Questions */}
            {sections.length > 0 && (
              <div className="space-y-4">
                {sections.map((section) => {
                  const sectionQuestions = questions.filter(q => q.section_id === section.id);
                  
                  return (
                    <div key={section.id} className="space-y-4">
                      <div className="border-t pt-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{section.name}</Badge>
                            </div>
                            {section.description && (
                              <p className="text-sm text-muted-foreground pl-1 whitespace-pre-wrap">
                                {section.description}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditSection(section)}
                            className="mt-0.5"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                        <Separator className="mt-3" />
                      </div>
                      
                      {/* Questions in this section */}
                      <div className="space-y-3 ml-4">
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleDragEnd}
                        >
                          <SortableContext
                            items={sectionQuestions.map(q => q.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {sectionQuestions.map((question, index) => (
                              <SortableQuestionItem
                                key={question.id}
                                question={question}
                                index={index}
                                isInSection={true}
                              />
                            ))}
                          </SortableContext>
                        </DndContext>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Questions without sections */}
            <div className="space-y-4">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={questions.filter(q => !q.section_id).map(q => q.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {questions
                    .filter((q) => !q.section_id)
                    .map((question, index) => (
                      <SortableQuestionItem
                        key={question.id}
                        question={question}
                        index={index}
                        isInSection={false}
                      />
                    ))}
                </SortableContext>
              </DndContext>
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

export default TemplateBuilder;