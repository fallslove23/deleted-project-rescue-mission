import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Survey {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: any;
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

interface Answer {
  questionId: string;
  answer: string | string[];
}

const SurveyParticipate = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (surveyId) {
      fetchSurveyData();
    }
  }, [surveyId]);

  const fetchSurveyData = async () => {
    try {
      console.log('Fetching survey data for:', surveyId);
      
      // 설문 정보 가져오기
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', surveyId)
        .eq('status', 'active')
        .single();

      if (surveyError) throw surveyError;

      if (!surveyData) {
        toast({
          title: "설문을 찾을 수 없습니다",
          description: "해당 설문이 존재하지 않거나 비활성화되었습니다.",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      // 날짜 검증
      const today = new Date();
      const startDate = new Date(surveyData.start_date);
      const endDate = new Date(surveyData.end_date);
      
      if (today < startDate || today > endDate) {
        toast({
          title: "설문 참여 기간이 아닙니다",
          description: "설문 참여 가능 기간을 확인해 주세요.",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setSurvey(surveyData);

      // 섹션 가져오기
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('survey_sections')
        .select('*')
        .eq('survey_id', surveyId)
        .order('order_index');

      if (sectionsError) throw sectionsError;
      setSections(sectionsData || []);

      // 질문 가져오기
      const { data: questionsData, error: questionsError } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', surveyId)
        .order('order_index');

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

      // 답변 초기화
      const initialAnswers = (questionsData || []).map(q => ({
        questionId: q.id,
        answer: q.question_type === 'multiple_choice_multiple' ? [] : ''
      }));
      setAnswers(initialAnswers);

    } catch (error) {
      console.error('Error fetching survey data:', error);
      toast({
        title: "오류가 발생했습니다",
        description: "설문 데이터를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: string | string[]) => {
    setAnswers(prev => prev.map(answer => 
      answer.questionId === questionId ? { ...answer, answer: value } : answer
    ));
  };

  const validateCurrentStep = () => {
    const currentQuestions = getCurrentStepQuestions();
    
    for (const question of currentQuestions) {
      if (question.is_required) {
        const answer = answers.find(a => a.questionId === question.id);
        if (!answer || !answer.answer || 
           (Array.isArray(answer.answer) && answer.answer.length === 0) ||
           (typeof answer.answer === 'string' && answer.answer.trim() === '')) {
          return false;
        }
      }
    }
    return true;
  };

  const getCurrentStepQuestions = () => {
    if (sections.length === 0) {
      // 섹션이 없으면 모든 질문을 보여줌
      return questions;
    }
    
    if (currentStep === 0) {
      // 첫 번째 단계: 섹션에 속하지 않은 질문들
      return questions.filter(q => !q.section_id);
    }
    
    // 나머지 단계: 해당 섹션의 질문들
    const currentSection = sections[currentStep - 1];
    return questions.filter(q => q.section_id === currentSection?.id);
  };

  const getTotalSteps = () => {
    if (sections.length === 0) {
      return 1; // 섹션이 없으면 1단계
    }
    
    // 섹션에 속하지 않은 질문들이 있으면 +1단계
    const questionsWithoutSection = questions.filter(q => !q.section_id);
    return sections.length + (questionsWithoutSection.length > 0 ? 1 : 0);
  };

  const getStepTitle = () => {
    if (sections.length === 0) {
      return "설문 응답";
    }
    
    if (currentStep === 0) {
      const questionsWithoutSection = questions.filter(q => !q.section_id);
      if (questionsWithoutSection.length > 0) {
        return "일반 질문";
      }
    }
    
    const section = sections[currentStep === 0 ? 0 : currentStep - 1];
    return section?.name || `섹션 ${currentStep + 1}`;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) {
      toast({
        title: "필수 항목을 완성해 주세요",
        description: "모든 필수 질문에 답변해 주세요.",
        variant: "destructive",
      });
      return;
    }
    
    setCurrentStep(prev => prev + 1);
  };

  const handlePrevious = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) {
      toast({
        title: "필수 항목을 완성해 주세요",
        description: "모든 필수 질문에 답변해 주세요.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    
    try {
      console.log('Submitting anonymous survey response');
      
      // 익명 응답 저장
      const { data: responseData, error: responseError } = await supabase
        .from('survey_responses')
        .insert({
          survey_id: surveyId,
          respondent_email: null // 익명 설문
        })
        .select()
        .single();

      if (responseError) throw responseError;

      // 질문별 답변 저장
      const validAnswers = answers.filter(answer => 
        answer.answer && 
        (typeof answer.answer === 'string' ? answer.answer.trim() !== '' : answer.answer.length > 0)
      );

      if (validAnswers.length > 0) {
        const answerInserts = validAnswers.map(answer => ({
          response_id: responseData.id,
          question_id: answer.questionId,
          answer_text: Array.isArray(answer.answer) ? answer.answer.join(', ') : answer.answer,
          answer_value: answer.answer
        }));

        const { error: answersError } = await supabase
          .from('question_answers')
          .insert(answerInserts);

        if (answersError) throw answersError;
      }

      toast({
        title: "설문 참여 완료!",
        description: "소중한 의견을 주셔서 감사합니다.",
      });

      navigate('/');

    } catch (error) {
      console.error('Error submitting survey:', error);
      toast({
        title: "제출 중 오류가 발생했습니다",
        description: "다시 시도해 주세요.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (question: Question) => {
    const answer = answers.find(a => a.questionId === question.id);
    
    switch (question.question_type) {
      case 'text':
        return (
          <Input
            value={answer?.answer as string || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="답변을 입력해 주세요"
          />
        );
        
      case 'textarea':
        return (
          <Textarea
            value={answer?.answer as string || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="상세한 의견을 입력해 주세요"
            rows={4}
          />
        );
        
      case 'multiple_choice':
        return (
          <RadioGroup
            value={answer?.answer as string || ''}
            onValueChange={(value) => handleAnswerChange(question.id, value)}
          >
            {question.options?.map((option: string, index: number) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${question.id}-${index}`} />
                <Label htmlFor={`${question.id}-${index}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );
        
      case 'multiple_choice_multiple':
        return (
          <div className="space-y-2">
            {question.options?.map((option: string, index: number) => {
              const selectedAnswers = answer?.answer as string[] || [];
              return (
                <div key={index} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${question.id}-${index}`}
                    checked={selectedAnswers.includes(option)}
                    onCheckedChange={(checked) => {
                      const currentAnswers = answer?.answer as string[] || [];
                      if (checked) {
                        handleAnswerChange(question.id, [...currentAnswers, option]);
                      } else {
                        handleAnswerChange(question.id, currentAnswers.filter(a => a !== option));
                      }
                    }}
                  />
                  <Label htmlFor={`${question.id}-${index}`}>{option}</Label>
                </div>
              );
            })}
          </div>
        );
        
      case 'rating':
        const rating = parseInt(answer?.answer as string) || 0;
        return (
          <div className="flex space-x-2">
            {[1, 2, 3, 4, 5].map(value => (
              <Button
                key={value}
                type="button"
                variant={rating === value ? "default" : "outline"}
                size="sm"
                onClick={() => handleAnswerChange(question.id, value.toString())}
              >
                {value}
              </Button>
            ))}
          </div>
        );
        
      default:
        return (
          <Input
            value={answer?.answer as string || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="답변을 입력해 주세요"
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div>설문을 불러오는 중...</div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div>설문을 찾을 수 없습니다.</div>
      </div>
    );
  }

  const totalSteps = getTotalSteps();
  const progress = ((currentStep + 1) / totalSteps) * 100;
  const isLastStep = currentStep === totalSteps - 1;
  const currentQuestions = getCurrentStepQuestions();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{survey.title}</h1>
            <p className="text-sm text-muted-foreground">{getStepTitle()}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">
              {currentStep + 1} / {totalSteps}
            </span>
            <span className="text-sm text-muted-foreground">
              {Math.round(progress)}% 완료
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{getStepTitle()}</CardTitle>
            {sections.length > 0 && currentStep > 0 && sections[currentStep - 1]?.description && (
              <p className="text-muted-foreground">
                {sections[currentStep - 1].description}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {currentQuestions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                이 섹션에는 질문이 없습니다.
              </div>
            ) : (
              currentQuestions.map((question) => (
                <div key={question.id} className="space-y-3">
                  <Label className="text-base">
                    {question.question_text}
                    {question.is_required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {renderQuestion(question)}
                </div>
              ))
            )}

            <div className="flex justify-between pt-6">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
              >
                이전
              </Button>
              
              {isLastStep ? (
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="min-w-24"
                >
                  {submitting ? (
                    "제출 중..."
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      제출하기
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={handleNext}>
                  다음
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default SurveyParticipate;