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
import { ArrowLeft, Send, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { toZonedTime } from 'date-fns-tz';
import { InstructorInfoSection } from '@/components/InstructorInfoSection';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

interface Survey {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  template_id?: string;
  instructor_id?: string;
}

interface Instructor {
  id: string;
  name: string;
  email?: string;
  photo_url?: string;
  bio?: string;
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
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [isCoursEvaluation, setIsCourseEvaluation] = useState(false);

  useEffect(() => {
    if (surveyId) {
      fetchSurveyData();
    }
  }, [surveyId]);

  const fetchSurveyData = async () => {
    try {
      console.log('Fetching survey data for:', surveyId);
      
      // 설문 정보 가져오기 (템플릿 정보 포함)
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select(`
          *,
          survey_templates!template_id (
            id,
            name,
            is_course_evaluation
          )
        `)
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

      // 한국 시간대 기준으로 날짜 검증
      const timeZone = 'Asia/Seoul';
      const nowKST = toZonedTime(new Date(), timeZone);
      const startDateKST = toZonedTime(new Date(surveyData.start_date), timeZone);
      const endDateKST = toZonedTime(new Date(surveyData.end_date), timeZone);
      
      console.log('Survey participation time check:', {
        surveyId,
        nowKST: nowKST.toISOString(),
        startDateKST: startDateKST.toISOString(),
        endDateKST: endDateKST.toISOString(),
        isWithinPeriod: nowKST >= startDateKST && nowKST <= endDateKST
      });
      
      if (nowKST < startDateKST || nowKST > endDateKST) {
        toast({
          title: "설문 참여 기간이 아닙니다",
          description: "설문 참여 가능 기간을 확인해 주세요.",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setSurvey(surveyData);

      // 강의 평가 템플릿 여부 또는 강사 ID 존재 여부 확인
      const isCourseEval = surveyData.survey_templates?.is_course_evaluation || surveyData.instructor_id;
      setIsCourseEvaluation(!!isCourseEval);

      // 강사 ID가 있으면 강사 정보 가져오기
      if (surveyData.instructor_id) {
        const { data: instructorData, error: instructorError } = await supabase
          .from('instructors')
          .select('*')
          .eq('id', surveyData.instructor_id)
          .maybeSingle();

        if (!instructorError && instructorData) {
          setInstructor(instructorData);
        }
      }

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
    // 한 문항씩 표시
    return questions[currentStep] ? [questions[currentStep]] : [];
  };

  const getTotalSteps = () => {
    return questions.length; // 전체 질문 수
  };

  const getStepTitle = () => {
    const currentQuestion = questions[currentStep];
    if (!currentQuestion) return "설문 응답";
    
    // 해당 질문이 속한 섹션 찾기
    if (currentQuestion.section_id) {
      const section = sections.find(s => s.id === currentQuestion.section_id);
      return section?.name || "설문 응답";
    }
    
    return "설문 응답";
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
        .select('id')
        .single();

      console.log('Response data:', responseData, 'Error:', responseError);

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
            className="touch-friendly"
          />
        );
        
      case 'textarea':
        return (
          <Textarea
            value={answer?.answer as string || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="상세한 의견을 입력해 주세요"
            rows={4}
            className="touch-friendly"
          />
        );
        
      case 'multiple_choice':
        return (
          <RadioGroup
            value={answer?.answer as string || ''}
            onValueChange={(value) => handleAnswerChange(question.id, value)}
          >
            {question.options?.map((option: string, index: number) => (
              <div key={index} className="flex items-center space-x-2 touch-friendly">
                <RadioGroupItem value={option} id={`${question.id}-${index}`} className="touch-friendly" />
                <Label htmlFor={`${question.id}-${index}`} className="break-words cursor-pointer">{option}</Label>
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
                <div key={index} className="flex items-center space-x-2 touch-friendly">
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
                    className="touch-friendly"
                  />
                  <Label htmlFor={`${question.id}-${index}`} className="break-words cursor-pointer">{option}</Label>
                </div>
              );
            })}
          </div>
        );
        
      case 'rating':
        const rating = parseInt(answer?.answer as string) || 0;
        return (
          <div className="grid grid-cols-5 gap-2 sm:flex sm:space-x-2">
            {[1, 2, 3, 4, 5].map(value => (
              <Button
                key={value}
                type="button"
                variant={rating === value ? "default" : "outline"}
                size="sm"
                onClick={() => handleAnswerChange(question.id, value.toString())}
                className="touch-friendly text-sm h-10"
              >
                {value}
              </Button>
            ))}
          </div>
        );
        
      case 'scale':
        const min = question.options?.min || 1;
        const max = question.options?.max || 10;
        const scaleValue = parseInt(answer?.answer as string) || 0;
        
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
              <span className="break-words">전혀 그렇지 않다</span>
              <span className="break-words">매우 그렇다</span>
            </div>
            <RadioGroup
              value={answer?.answer as string || ''}
              onValueChange={(value) => handleAnswerChange(question.id, value)}
              className="grid grid-cols-5 sm:flex sm:items-center sm:justify-between gap-2"
            >
              {Array.from({ length: max - min + 1 }, (_, i) => {
                const value = min + i;
                return (
                  <div key={value} className="flex flex-col items-center space-y-1 touch-friendly">
                    <span className="text-xs sm:text-sm font-medium">{value}</span>
                    <RadioGroupItem value={String(value)} id={`${question.id}-${value}`} className="touch-friendly" />
                  </div>
                );
              })}
            </RadioGroup>
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
  
  // 진행률 계산: 현재 문항 위치 기반
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;
  
  const isLastStep = currentStep === totalSteps - 1;
  const currentQuestions = getCurrentStepQuestions();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 py-3 flex items-center gap-4 max-w-full overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm sm:text-base md:text-lg font-semibold break-words line-clamp-1">{survey.title}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground break-words line-clamp-1">{getStepTitle()}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-6 max-w-2xl overflow-hidden">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs sm:text-sm text-muted-foreground">
              {currentStep + 1} / {totalSteps}
            </span>
            <span className="text-xs sm:text-sm text-muted-foreground">
              {Math.round(progress)}% 완료
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* 강의 평가 템플릿일 때만 강사 정보 버튼 표시 */}
        {isCoursEvaluation && instructor && (
          <Card className="mb-4">
            <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full flex items-center gap-2 touch-friendly"
                  >
                    <User className="h-4 w-4" />
                    강사 정보 확인하기
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[90vw] sm:max-w-md mx-4">
                  <InstructorInfoSection 
                    instructor={instructor} 
                    title="강사 정보"
                  />
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )}

        <Card className="max-w-full overflow-hidden">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg break-words">질문 {currentStep + 1}</CardTitle>
            {(() => {
              // 현재 질문의 섹션 설명 표시
              const currentQuestion = questions[currentStep];
              if (!currentQuestion || !currentQuestion.section_id) return null;
              
              const section = sections.find(s => s.id === currentQuestion.section_id);
              return section?.description ? (
                <p className="text-muted-foreground text-sm break-words">
                  {section.description}
                </p>
              ) : null;
            })()}
          </CardHeader>
          <CardContent className="space-y-6 px-4 sm:px-6 pb-4 sm:pb-6">
            {currentQuestions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                이 섹션에는 질문이 없습니다.
              </div>
            ) : (
              currentQuestions.map((question) => (
                <div key={question.id} className="space-y-3">
                  <Label className="text-sm sm:text-base break-words hyphens-auto leading-relaxed block">
                    {question.question_text}
                    {question.is_required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <div className="max-w-full overflow-x-auto">
                    {renderQuestion(question)}
                  </div>
                </div>
              ))
            )}

            <div className="flex justify-between pt-6 gap-3 flex-wrap sm:flex-nowrap">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className="touch-friendly flex-1 sm:flex-none sm:min-w-[100px] order-1"
              >
                이전
              </Button>
              
              {isLastStep ? (
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="touch-friendly flex-1 sm:flex-none sm:min-w-[120px] order-2"
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
                <Button 
                  onClick={handleNext} 
                  className="touch-friendly flex-1 sm:flex-none sm:min-w-[100px] order-2"
                >
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