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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Trash2, Edit, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options?: any;
  is_required: boolean;
  order_index: number;
}

interface Survey {
  id: string;
  title: string;
  description: string;
  instructor_id: string;
  course_id: string;
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
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  const [questionForm, setQuestionForm] = useState({
    question_text: '',
    question_type: 'scale' as string,
    is_required: true,
    options: null as any
  });

  useEffect(() => {
    if (surveyId) {
      fetchSurveyData();
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

  const resetQuestionForm = () => {
    setQuestionForm({
      question_text: '',
      question_type: 'scale',
      is_required: true,
      options: null
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
        options: questionForm.question_type === 'scale' ? { min: 1, max: 10 } : questionForm.options
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
      options: question.options
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

  const renderScaleQuestion = (question: Question, index: number) => (
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
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i + 1} className="flex flex-col items-center space-y-1">
              <span className="text-xs font-medium">{i + 1}</span>
              <RadioGroupItem value={String(i + 1)} disabled />
            </div>
          ))}
        </RadioGroup>
      </div>
    </div>
  );

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
              <CardTitle className="text-center">
                {survey.title}
              </CardTitle>
              <p className="text-center text-sm text-muted-foreground">
                {survey.description}
              </p>
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
                <DialogContent>
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
                          <SelectItem value="scale">척도 (1-10점)</SelectItem>
                          <SelectItem value="text">주관식</SelectItem>
                          <SelectItem value="multiple_choice">객관식</SelectItem>
                        </SelectContent>
                      </Select>
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

            {/* Question List */}
            <div className="space-y-4">
              {questions.map((question, index) => (
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