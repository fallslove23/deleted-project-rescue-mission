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
import { ArrowLeft, Eye, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { InstructorInfoSection } from '@/components/InstructorInfoSection';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  satisfaction_type?: string;
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

const SurveyPreview = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [isCourseEvaluation, setIsCourseEvaluation] = useState(false);

  useEffect(() => {
    if (surveyId) {
      fetchSurveyData();
    }
  }, [surveyId]);

  const fetchSurveyData = async () => {
    try {
      console.log('Fetching survey preview data for:', surveyId);
      
      // 설문 정보 가져오기 (상태나 날짜 제한 없이)
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
        .single();

      if (surveyError) throw surveyError;

      if (!surveyData) {
        toast({
          title: "설문을 찾을 수 없습니다",
          description: "해당 설문이 존재하지 않습니다.",
          variant: "destructive",
        });
        navigate('/surveys');
        return;
      }

      setSurvey(surveyData);

      // 강의 평가 템플릿 여부 또는 강사 ID 존재 여부 확인
      const isCourseEval = surveyData.survey_templates?.is_course_evaluation || surveyData.instructor_id;
      setIsCourseEvaluation(!!isCourseEval);

      // 강사 ID가 있으면 강사 정보 가져오기
      if (surveyData.instructor_id) {
        console.log('강사 ID 발견:', surveyData.instructor_id);
        const { data: instructorData, error: instructorError } = await supabase
          .from('instructors')
          .select('*')
          .eq('id', surveyData.instructor_id)
          .maybeSingle();

        if (!instructorError && instructorData) {
          console.log('강사 정보 로드됨:', instructorData);
          setInstructor(instructorData);
        } else {
          console.log('강사 정보 로드 실패:', instructorError);
        }
      } else {
        console.log('설문에 강사 ID가 없음');
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
      
      console.log('Preview Questions Data:', questionsData);
      console.log('Questions Length:', questionsData?.length || 0);
      
      setQuestions(questionsData || []);
      
      // currentStep 초기화 (질문이 있을 때만)
      if (questionsData && questionsData.length > 0) {
        setCurrentStep(0);
      }

      // 답변 초기화
      const initialAnswers = (questionsData || []).map(q => ({
        questionId: q.id,
        answer: q.question_type === 'multiple_choice_multiple' ? [] : ''
      }));
      
      console.log('Preview Initial Answers:', initialAnswers);
      setAnswers(initialAnswers);

    } catch (error) {
      console.error('Error fetching survey preview data:', error);
      toast({
        title: "오류가 발생했습니다",
        description: "설문 데이터를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      navigate('/surveys');
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
    console.log('Preview getTotalSteps - questions.length:', questions.length);
    return questions.length; // 전체 질문 수
  };

  const getStepTitle = () => {
    const currentQuestion = questions[currentStep];
    if (!currentQuestion) return "설문 미리보기";
    
    // 해당 질문이 속한 섹션 찾기
    if (currentQuestion.section_id) {
      const section = sections.find(s => s.id === currentQuestion.section_id);
      return section?.name || "설문 미리보기";
    }
    
    return "설문 미리보기";
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

  const handlePreviewComplete = () => {
    toast({
      title: "📋 미리보기 완료!",
      description: "설문 미리보기를 성공적으로 완료했습니다.",
      duration: 3000,
    });

    navigate('/surveys');
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
  
  console.log('Preview Render - currentStep:', currentStep, 'totalSteps:', totalSteps, 'questions:', questions);
  
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
            onClick={() => navigate('/surveys')}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <h1 className="text-sm sm:text-base md:text-lg font-semibold break-words line-clamp-1">{survey.title}</h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground break-words line-clamp-1">미리보기 모드 - {getStepTitle()}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-6 max-w-2xl overflow-hidden">
        {/* 미리보기 알림 */}
        <Alert className="mb-6 bg-blue-50 border-blue-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            이것은 설문 미리보기 모드입니다. 응답 데이터는 실제로 저장되지 않습니다.
          </AlertDescription>
        </Alert>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs sm:text-sm text-muted-foreground">
              {currentStep + 1} / {totalSteps}
            </span>
            <span className="text-xs sm:text-sm text-muted-foreground">
              {Math.round(progress)}% 완료
            </span>
          </div>
          <Progress value={progress} className="h-2 mb-4" />
        </div>

        {/* 강사 정보 (강사 만족도 질문일 때만 표시) */}
        {(() => {
          console.log('강사 정보 표시 조건 확인:', {
            isCourseEvaluation,
            hasInstructor: !!instructor,
            currentQuestionsLength: currentQuestions.length,
            satisfactionType: currentQuestions[0]?.satisfaction_type,
            instructorData: instructor
          });
          return null;
        })()}
        {isCourseEvaluation && instructor && currentQuestions.length > 0 && 
         currentQuestions[0].satisfaction_type === 'instructor' && (
          <div className="mb-6">
            <InstructorInfoSection instructor={instructor} />
          </div>
        )}

        {/* 질문 카드 */}
        {currentQuestions.map((question, index) => (
          <Card key={question.id} className="mb-6">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg break-words flex items-start gap-2">
                <span className="flex-1">{question.question_text}</span>
                {question.is_required && (
                  <span className="text-red-500 text-sm shrink-0">*</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderQuestion(question)}
            </CardContent>
          </Card>
        ))}

        {/* 네비게이션 버튼 */}
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-between items-stretch sm:items-center mt-8">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="touch-friendly order-2 sm:order-1"
          >
            이전
          </Button>
          
          {!isLastStep ? (
            <Button
              type="button"
              onClick={handleNext}
              className="touch-friendly order-1 sm:order-2"
            >
              다음
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handlePreviewComplete}
              className="touch-friendly bg-green-600 hover:bg-green-700 order-1 sm:order-2"
            >
              <Eye className="h-4 w-4 mr-2" />
              미리보기 완료
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default SurveyPreview;