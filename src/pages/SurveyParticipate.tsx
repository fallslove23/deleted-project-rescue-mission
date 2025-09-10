import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAnonymousSession } from '@/hooks/useAnonymousSession';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Send, User, KeyRound, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { toZonedTime } from 'date-fns-tz';
import { InstructorInfoSection } from '@/components/InstructorInfoSection';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

interface Survey {
  id: string;
  title: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  template_id?: string | null;
  instructor_id?: string | null;
}

interface SurveySession {
  id: string;
  survey_id: string;
  course_id: string;
  instructor_id: string;
  session_order: number;
  session_name: string;
  course?: {
    title: string;
  };
  instructor?: {
    id: string;
    name: string;
    email?: string;
    photo_url?: string;
    bio?: string;
  };
}

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: any;
  is_required: boolean;
  order_index: number;
  section_id?: string | null;
  session_id?: string | null;
  satisfaction_type?: string | null;
  scope: 'session' | 'operation';
}

interface Instructor {
  id: string;
  name: string;
  email?: string;
  photo_url?: string;
  bio?: string;
}

interface SessionAnswer {
  sessionId: string;
  questionAnswers: Answer[];
  attended: boolean;
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
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const { session, loading: sessionLoading, checkSurveyCompletion, markSurveyCompleted, validateToken } =
    useAnonymousSession();

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [surveySessions, setSurveySessions] = useState<SurveySession[]>([]);
  const [sessionAnswers, setSessionAnswers] = useState<SessionAnswer[]>([]);
  const [isCourseEvaluation, setIsCourseEvaluation] = useState(false);
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [currentQuestionInstructor, setCurrentQuestionInstructor] = useState<Instructor | null>(null);
  const [tokenCode, setTokenCode] = useState('');
  const [needsToken, setNeedsToken] = useState(false);
  const [tokenValidated, setTokenValidated] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);

  const completedKey = surveyId ? `survey_completed_${surveyId}` : '';

  useEffect(() => {
    const checkAccess = async () => {
      if (!surveyId || sessionLoading) return;

      const lsCompleted = completedKey && localStorage.getItem(completedKey) === '1';
      if (lsCompleted) {
        setAlreadyCompleted(true);
        setLoading(false);
        return;
      }

      if (session) {
        try {
          const isCompleted = await checkSurveyCompletion(surveyId);
          if (isCompleted) {
            setAlreadyCompleted(true);
            setLoading(false);
            return;
          }
        } catch {/* no-op */}
      }

      const urlToken = searchParams.get('code');
      if (urlToken) {
        try {
          const isValid = await validateToken(surveyId, urlToken);
          if (!isValid) {
            toast({
              variant: 'destructive',
              title: '유효하지 않은 코드',
              description: '코드가 만료되었거나 이미 사용된 코드입니다. 계속 진행합니다.',
            });
          }
          setTokenValidated(true);
          setTokenCode(urlToken);
        } catch {/* 검증 실패해도 설문은 로드 */}
      }

      await fetchSurveyData();
    };

    checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId, session, sessionLoading, searchParams]);

  // 현재 질문의 강사 정보 업데이트
  useEffect(() => {
    const updateCurrentQuestionInstructor = async () => {
      const currentQuestion = questions[currentStep];
      if (!currentQuestion) {
        setCurrentQuestionInstructor(null);
        return;
      }

      // 강사 만족도 질문이고 session_id가 있는 경우
      if (currentQuestion.satisfaction_type === 'instructor' && currentQuestion.session_id) {
        // 세션의 강사 정보 가져오기
        try {
          const { data: sessionData } = await supabase
            .from('survey_sessions')
            .select(`
              instructor_id,
              instructors (
                id,
                name,
                email,
                photo_url,
                bio
              )
            `)
            .eq('id', currentQuestion.session_id)
            .maybeSingle();

          if (sessionData?.instructors) {
            setCurrentQuestionInstructor(sessionData.instructors as Instructor);
          } else {
            setCurrentQuestionInstructor(null);
          }
        } catch (error) {
          console.error('Error fetching session instructor:', error);
          setCurrentQuestionInstructor(null);
        }
      } 
      // 강사 만족도 질문이지만 세션별 강사가 없는 경우 기본 강사 사용
      else if (currentQuestion.satisfaction_type === 'instructor' && instructor) {
        setCurrentQuestionInstructor(instructor);
      } 
      // 강사 만족도 질문이 아니면 null
      else {
        setCurrentQuestionInstructor(null);
      }
    };

    updateCurrentQuestionInstructor();
  }, [currentStep, questions, instructor]);

  const handleTokenSubmit = async () => {
    if (!tokenCode.trim() || !surveyId) return;
    const isValid = await validateToken(surveyId, tokenCode.trim());
    if (isValid) {
      setTokenValidated(true);
      setNeedsToken(false);
      await fetchSurveyData();
      toast({ title: '코드 확인됨', description: '설문에 참여할 수 있습니다.' });
    } else {
      toast({ variant: 'destructive', title: '유효하지 않은 코드', description: '코드를 다시 확인해주세요.' });
    }
  };

  const fetchSurveyData = async () => {
    try {
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select(`
          *,
          survey_templates!template_id (
            id, name, is_course_evaluation
          )
        `)
        .eq('id', surveyId)
        .single();

      if (surveyError) throw surveyError;
      if (!surveyData) {
        toast({
          title: '설문을 찾을 수 없습니다',
          description: '해당 설문이 존재하지 않거나 비활성화되었습니다.',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      const timeZone = 'Asia/Seoul';
      const nowKST = toZonedTime(new Date(), timeZone);
      void nowKST;

      setSurvey(surveyData);

      const isCourseEval = surveyData.survey_templates?.is_course_evaluation;
      setIsCourseEvaluation(!!isCourseEval);

      // 강사 정보 가져오기 - 단순하고 확실한 방법
      let instructorData = null;
      
      // survey_instructors 테이블에서 강사 정보 조회
      const { data: surveyInstructors, error: siError } = await supabase
        .from('survey_instructors')
        .select(`
          instructors (
            id,
            name,
            email,
            photo_url,
            bio
          )
        `)
        .eq('survey_id', surveyId);

      if (!siError && surveyInstructors && surveyInstructors.length > 0) {
        const instructors = surveyInstructors
          .map(si => si.instructors)
          .filter(Boolean) as Instructor[];
        
        if (instructors.length > 0) {
          instructorData = {
            id: instructors[0].id,
            name: instructors.map(i => i.name).join(', '),
            email: instructors[0].email,
            photo_url: instructors[0].photo_url,
            bio: instructors[0].bio
          };
        }
      }

      // 개별 instructor_id로 조회 (backup)
      if (!instructorData && surveyData.instructor_id) {
        const { data: singleInstructor } = await supabase
          .from('instructors')
          .select('*')
          .eq('id', surveyData.instructor_id)
          .maybeSingle();
        if (singleInstructor) instructorData = singleInstructor;
      }

      if (instructorData) setInstructor(instructorData);

      const { data: sectionsData } = await supabase
        .from('survey_sections')
        .select('*')
        .eq('survey_id', surveyId)
        .order('order_index');
      setSections(sectionsData || []);

      const { data: questionsData } = await supabase
        .from('survey_questions')
        .select(`
          *,
          survey_sessions (
            id,
            instructor_id,
            instructors (
              id,
              name,
              email,
              photo_url,
              bio
            )
          )
        `)
        .eq('survey_id', surveyId)
        .order('order_index');
      
      // Cast the questions data to match our interface
      const typedQuestions = (questionsData || []).map(q => ({
        ...q,
        scope: (q.scope as 'session' | 'operation') || 'session'
      }));
      setQuestions(typedQuestions);

      const initialAnswers =
        (questionsData || []).map((q) => ({
          questionId: q.id,
          answer: q.question_type === 'multiple_choice_multiple' ? [] : '',
        })) ?? [];
      setAnswers(initialAnswers);
    } catch (error) {
      console.error('Error fetching survey data:', error);
      toast({
        title: '오류가 발생했습니다',
        description: '설문 데이터를 불러오는 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: string | string[]) => {
    setAnswers((prev) => prev.map((a) => (a.questionId === questionId ? { ...a, answer: value } : a)));
  };

  const getCurrentStepQuestions = () => (questions[currentStep] ? [questions[currentStep]] : []);
  const getTotalSteps = () => questions.length;

  const validateCurrentStep = () => {
    const currentQuestions = getCurrentStepQuestions();
    for (const q of currentQuestions) {
      if (q.is_required) {
        const a = answers.find((x) => x.questionId === q.id);
        if (!a || !a.answer) return false;
        if (Array.isArray(a.answer) && a.answer.length === 0) return false;
        if (typeof a.answer === 'string' && a.answer.trim() === '') return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) {
      toast({ title: '필수 항목을 완성해 주세요', description: '모든 필수 질문에 답변해 주세요.', variant: 'destructive' });
      return;
    }
    setCurrentStep((p) => p + 1);
  };

  const handlePrevious = () => setCurrentStep((p) => p - 1);

  const handleSubmit = async () => {
    if (!validateCurrentStep()) {
      toast({ title: '필수 항목을 완성해 주세요', description: '모든 필수 질문에 답변해 주세요.', variant: 'destructive' });
      return;
    }

    console.log('🚀 설문 제출 시작:', { surveyId, answersCount: answers.length });
    setSubmitting(true);
    try {
      console.log('📝 응답 데이터 삽입 중...');
      const { data: responseData, error: responseError } = await supabase
        .from('survey_responses')
        .insert({ survey_id: surveyId, respondent_email: null })
        .select('id')
        .single();
      
      if (responseError) {
        console.error('❌ 응답 데이터 삽입 실패:', responseError);
        throw responseError;
      }
      console.log('✅ 응답 데이터 삽입 성공:', responseData);

      const validAnswers = answers.filter((a) =>
        Array.isArray(a.answer) ? a.answer.length > 0 : String(a.answer || '').trim() !== ''
      );
      console.log('📋 유효한 답변:', validAnswers.length, '개');

      if (validAnswers.length > 0) {
        const rows = validAnswers.map((a) => ({
          response_id: responseData.id,
          question_id: a.questionId,
          answer_text: Array.isArray(a.answer) ? a.answer.join(', ') : a.answer,
          answer_value: a.answer,
        }));
        console.log('💾 답변 데이터 삽입 중...', rows.length, '개 항목');
        const { error: answersError } = await supabase.from('question_answers').insert(rows);
        if (answersError) {
          console.error('❌ 답변 데이터 삽입 실패:', answersError);
          throw answersError;
        }
        console.log('✅ 답변 데이터 삽입 성공');
      }

      if (session) {
        try {
          console.log('🎯 설문 완료 마킹 중...');
          await markSurveyCompleted(surveyId!);
          console.log('✅ 설문 완료 마킹 성공');
        } catch (markError) {
          console.error('⚠️ 설문 완료 마킹 실패 (비필수):', markError);
        }
      }
      if (completedKey) {
        localStorage.setItem(completedKey, '1');
        console.log('💾 로컬 스토리지 완료 표시 저장됨');
      }

      console.log('🎉 설문 제출 완료!');
      toast({ title: '설문 참여 완료!', description: '소중한 의견을 주셔서 감사합니다.' });
      navigate('/');
    } catch (error) {
      console.error('💥 설문 제출 중 오류 발생:', error);
      console.error('오류 세부 정보:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });
      toast({ 
        title: '제출 중 오류가 발생했습니다', 
        description: `오류: ${error?.message || '알 수 없는 오류'}`, 
        variant: 'destructive' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStepTitle = () => {
    const q = questions[currentStep];
    if (!q) return '설문 응답';
    if (q.section_id) {
      const s = sections.find((x) => x.id === q.section_id);
      return s?.name || '설문 응답';
    }
    return '설문 응답';
  };

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">설문을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (alreadyCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold">이미 참여 완료</h1>
          <p className="text-muted-foreground">이 설문에 이미 참여하셨습니다.</p>
          <Button onClick={() => navigate('/')}>홈으로 돌아가기</Button>
        </div>
      </div>
    );
  }

  if (needsToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>참여 코드 입력</CardTitle>
            <p className="text-sm text-muted-foreground">설문 참여를 위해 코드를 입력해주세요</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">참여 코드</Label>
              <Input
                id="token"
                placeholder="예: ABC123XY"
                value={tokenCode}
                onChange={(e) => setTokenCode(e.target.value.toUpperCase())}
                className="text-center font-mono"
              />
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>강사님께서 공유해주신 8자리 참여 코드를 입력해주세요.</AlertDescription>
            </Alert>
            <Button onClick={handleTokenSubmit} className="w-full" disabled={!tokenCode.trim()}>
              확인
            </Button>
            <Button variant="outline" onClick={() => navigate('/')} className="w-full">
              취소
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">설문을 찾을 수 없습니다</h1>
          <p className="text-muted-foreground mb-4">요청하신 설문이 존재하지 않거나 삭제되었습니다.</p>
          <Button onClick={() => navigate('/')}>홈으로 돌아가기</Button>
        </div>
      </div>
    );
  }

  const totalSteps = getTotalSteps();
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;
  const isLastStep = currentStep === totalSteps - 1;
  const currentQuestions = getCurrentStepQuestions();

  const renderQuestion = (question: Question) => {
    const answer = answers.find((a) => a.questionId === question.id);

    switch (question.question_type) {
      case 'text':
        return (
          <Input
            value={(answer?.answer as string) || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="답변을 입력해 주세요"
            className="touch-friendly"
          />
        );
      case 'textarea':
        return (
          <Textarea
            value={(answer?.answer as string) || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="상세한 의견을 입력해 주세요"
            rows={4}
            className="touch-friendly"
          />
        );
      case 'multiple_choice':
        return (
          <RadioGroup value={(answer?.answer as string) || ''} onValueChange={(v) => handleAnswerChange(question.id, v)}>
            {question.options?.map((option: string, i: number) => (
              <div key={i} className="flex items-center space-x-2 touch-friendly">
                <RadioGroupItem value={option} id={`${question.id}-${i}`} className="touch-friendly" />
                <Label htmlFor={`${question.id}-${i}`} className="break-words cursor-pointer">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );
      case 'multiple_choice_multiple':
        return (
          <div className="space-y-2">
            {question.options?.map((option: string, i: number) => {
              const selected = (answer?.answer as string[]) || [];
              const checked = selected.includes(option);
              return (
                <div key={i} className="flex items-center space-x-2 touch-friendly">
                  <Checkbox
                    id={`${question.id}-${i}`}
                    checked={checked}
                    onCheckedChange={(c) => {
                      const cur = (answer?.answer as string[]) || [];
                      handleAnswerChange(question.id, c ? [...cur, option] : cur.filter((x) => x !== option));
                    }}
                    className="touch-friendly"
                  />
                  <Label htmlFor={`${question.id}-${i}`} className="break-words cursor-pointer">
                    {option}
                  </Label>
                </div>
              );
            })}
          </div>
        );
      case 'rating': {
        const rating = parseInt((answer?.answer as string) || '0', 10);
        return (
          <div className="grid grid-cols-5 gap-2 sm:flex sm:space-x-2">
            {[1, 2, 3, 4, 5].map((v) => (
              <Button
                key={v}
                type="button"
                variant={rating === v ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleAnswerChange(question.id, v.toString())}
                className="touch-friendly text-sm h-10"
              >
                {v}
              </Button>
            ))}
          </div>
        );
      }
      case 'scale': {
        const min = question.options?.min ?? 1;
        const max = question.options?.max ?? 10;
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
              <span className="break-words">전혀 그렇지 않다</span>
              <span className="break-words">매우 그렇다</span>
            </div>
            <RadioGroup
              value={(answer?.answer as string) || ''}
              onValueChange={(v) => handleAnswerChange(question.id, v)}
              className="grid grid-cols-5 sm:flex sm:items-center sm:justify-between gap-2"
            >
              {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((v) => (
                <div key={v} className="flex flex-col items-center space-y-1 touch-friendly">
                  <span className="text-xs sm:text-sm font-medium">{v}</span>
                  <RadioGroupItem value={String(v)} id={`${question.id}-${v}`} className="touch-friendly" />
                </div>
              ))}
            </RadioGroup>
          </div>
        );
      }
      default:
        return (
          <Input
            value={(answer?.answer as string) || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="답변을 입력해 주세요"
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 py-3 flex items-center gap-4 max-w-full overflow-hidden">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm sm:text-base md:text-lg font-semibold break-words line-clamp-1">
              {survey.title}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground break-words line-clamp-1">{getStepTitle()}</p>
          </div>
        </div>
      </header>

      {/* ⬇️ 스크롤 허용 */}
      <main className="container mx-auto px-3 sm:px-4 py-6 max-w-2xl overflow-x-hidden overflow-y-auto">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs sm:text-sm text-muted-foreground">{currentStep + 1} / {totalSteps}</span>
            <span className="text-xs sm:text-sm text-muted-foreground">{Math.round(progress)}% 완료</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* 강사 정보 섹션 - 강사 만족도 질문일 때만 동적으로 표시 */}
        {(() => {
          console.log('강사 정보 표시 조건 (참여):', {
            isCourseEvaluation,
            hasCurrentQuestionInstructor: !!currentQuestionInstructor,
            currentQuestion: questions[currentStep],
            instructorData: currentQuestionInstructor
          });
          return null;
        })()}
        {currentQuestionInstructor && (
          <div className="mb-6">
            <InstructorInfoSection instructor={currentQuestionInstructor} />
          </div>
        )}

        {/* overflow-hidden 제거 */}
        <Card className="max-w-full">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg break-words">질문 {currentStep + 1}</CardTitle>
            {(() => {
              const q = questions[currentStep];
              if (!q || !q.section_id) return null;
              const s = sections.find((x) => x.id === q.section_id);
              return s?.description ? <p className="text-muted-foreground text-sm break-words">{s.description}</p> : null;
            })()}
          </CardHeader>

          <CardContent className="space-y-6 px-4 sm:px-6 pb-4 sm:pb-6">
            {currentQuestions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">이 섹션에는 질문이 없습니다.</div>
            ) : (
              currentQuestions.map((q) => (
                <div key={q.id} className="space-y-3">
                  <Label className="text-sm sm:text-base break-words hyphens-auto leading-relaxed block">
                    {q.question_text}
                    {q.is_required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <div className="max-w-full overflow-x-auto">{renderQuestion(q)}</div>
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
                <Button onClick={handleSubmit} disabled={submitting} className="touch-friendly flex-1 sm:flex-none sm:min-w-[120px] order-2">
                  {submitting ? '제출 중...' : (<><Send className="h-4 w-4 mr-2" />제출하기</>)}
                </Button>
              ) : (
                <Button onClick={handleNext} className="touch-friendly flex-1 sm:flex-none sm:min-w-[100px] order-2">
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