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
import { ArrowLeft, Send, User, KeyRound, AlertCircle, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { toZonedTime } from 'date-fns-tz';
import { InstructorInfoSection } from '@/components/InstructorInfoSection';

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

interface Answer {
  questionId: string;
  answer: string | string[];
}

const SurveyParticipateSession = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const { session, loading: sessionLoading, checkSurveyCompletion, markSurveyCompleted, validateToken } =
    useAnonymousSession();

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [surveySessions, setSurveySessions] = useState<SurveySession[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
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

      setSurvey(surveyData);

      // 세션 데이터 로드
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('survey_sessions')
        .select(`
          *,
          course:courses(id, title),
          instructor:instructors(id, name, email, photo_url, bio)
        `)
        .eq('survey_id', surveyId)
        .order('session_order');

      if (sessionsError) throw sessionsError;
      setSurveySessions(sessionsData || []);

      // 질문 데이터 로드 (세션별로 분류)
      const { data: questionsData } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', surveyId)
        .order('order_index');
      
      const typedQuestions = (questionsData || []).map(q => ({
        ...q,
        scope: (q.scope as 'session' | 'operation') || 'session'
      }));
      setQuestions(typedQuestions);

      const initialAnswers = (questionsData || []).map((q) => ({
        questionId: q.id,
        answer: q.question_type === 'multiple_choice_multiple' ? [] : '',
      }));
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

  const getCurrentSessionQuestions = () => {
    if (!surveySessions[currentSessionIndex]) return [];
    const sessionId = surveySessions[currentSessionIndex].id;
    return questions.filter(q => q.session_id === sessionId);
  };

  // 세션 내 문항을 타입별로 그룹화 (누락 방지, 안정적 페이징)
  const getSessionQuestionGroups = () => {
    const sessionQuestions = getCurrentSessionQuestions();
    const groups: Question[][] = [];
    let currentObjective: Question[] = [];
    let currentSubjective: Question[] = [];
    let lastSatisfactionType: string | null = null;

    const flushObjective = () => {
      if (currentObjective.length > 0) {
        while (currentObjective.length > 0) {
          groups.push(currentObjective.splice(0, Math.min(7, currentObjective.length)));
        }
      }
    };
    const flushSubjective = () => {
      if (currentSubjective.length > 0) {
        while (currentSubjective.length > 0) {
          groups.push(currentSubjective.splice(0, Math.min(2, currentSubjective.length)));
        }
      }
    };
    const flushAll = () => { flushObjective(); flushSubjective(); };

    for (const q of sessionQuestions) {
      const isSubjective = q.question_type === 'text' || q.question_type === 'textarea';
      const isObjective = ['multiple_choice', 'multiple_choice_multiple', 'rating', 'scale'].includes(q.question_type);
      const curType = q.satisfaction_type || null;

      if (lastSatisfactionType !== null && lastSatisfactionType !== curType) {
        flushAll();
        lastSatisfactionType = curType;
      } else if (lastSatisfactionType === null) {
        lastSatisfactionType = curType;
      }

      if (isSubjective) {
        flushObjective();
        currentSubjective.push(q);
        if (currentSubjective.length >= 2) {
          groups.push([...currentSubjective]);
          currentSubjective = [];
        }
      } else if (isObjective) {
        flushSubjective();
        currentObjective.push(q);
        if (currentObjective.length >= 7) {
          groups.push([...currentObjective]);
          currentObjective = [];
        }
      } else {
        flushAll();
        groups.push([q]);
      }
    }

    flushAll();
    return groups;
  };

  const getCurrentQuestions = () => {
    const groups = getSessionQuestionGroups();
    return groups[currentQuestionIndex] || [];
  };

  const validateCurrentQuestions = () => {
    const currentQuestions = getCurrentQuestions();
    for (const question of currentQuestions) {
      if (!question.is_required) continue;
      
      const answer = answers.find(a => a.questionId === question.id);
      if (!answer || !answer.answer) return false;
      if (Array.isArray(answer.answer) && answer.answer.length === 0) return false;
      if (typeof answer.answer === 'string' && answer.answer.trim() === '') return false;
    }
    
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentQuestions()) {
      toast({ title: '필수 항목을 완성해 주세요', description: '모든 필수 답변을 입력해 주세요.', variant: 'destructive' });
      return;
    }
    
    const sessionGroups = getSessionQuestionGroups();
    
    if (currentQuestionIndex < sessionGroups.length - 1) {
      // 현재 세션의 다음 그룹으로
      setCurrentQuestionIndex(prev => prev + 1);
    } else if (currentSessionIndex < surveySessions.length - 1) {
      // 다음 세션의 첫 번째 그룹으로
      setCurrentSessionIndex(prev => prev + 1);
      setCurrentQuestionIndex(0);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      // 현재 세션의 이전 그룹으로
      setCurrentQuestionIndex(prev => prev - 1);
    } else if (currentSessionIndex > 0) {
      // 이전 세션으로 이동
      setCurrentSessionIndex(prev => prev - 1);
      // 이전 세션의 마지막 그룹으로
      const prevSessionQuestions = questions.filter(q => q.session_id === surveySessions[currentSessionIndex - 1].id);
      const prevGroups = getSessionQuestionGroups();
      setCurrentQuestionIndex(prevGroups.length - 1);
    }
  };

  const getTotalQuestions = () => {
    return questions.filter(q => surveySessions.some(s => s.id === q.session_id)).length;
  };

  const getCurrentQuestionNumber = () => {
    let count = 0;
    for (let i = 0; i < currentSessionIndex; i++) {
      const sessionQuestions = questions.filter(q => q.session_id === surveySessions[i].id);
      count += sessionQuestions.length;
    }
    
    // 현재 세션의 현재 그룹까지의 문항 수 추가
    const currentGroups = getSessionQuestionGroups();
    for (let i = 0; i < currentQuestionIndex; i++) {
      count += currentGroups[i]?.length || 0;
    }
    count += getCurrentQuestions().length;
    
    return count;
  };

  const isLastQuestion = () => {
    const sessionGroups = getSessionQuestionGroups();
    return currentSessionIndex === surveySessions.length - 1 && 
           currentQuestionIndex === sessionGroups.length - 1;
  };

  const handleSubmit = async () => {
    if (!validateCurrentQuestions()) {
      toast({ title: '필수 항목을 완성해 주세요', description: '모든 필수 답변을 입력해 주세요.', variant: 'destructive' });
      return;
    }

    console.log('🚀 세션 설문 제출 시작:', { surveyId, answersCount: answers.length });
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
          const answersData = validAnswers.map((a) => ({
            response_id: responseData.id,
            question_id: a.questionId,
            answer_text: Array.isArray(a.answer) ? a.answer.join(', ') : a.answer,
            answer_value: a.answer,
          }));
          console.log('💾 답변 데이터 일괄 삽입 중...', answersData.length, '개 항목');

          // RPC 함수를 사용한 서버 측 일괄 처리
          let attempts = 0;
          while (attempts < 2) {
            const { error } = await supabase.rpc('save_answers_bulk', {
              p_answers: answersData
            });
            if (!error) break;
            
            const msg = (error as any)?.message || '';
            const code = (error as any)?.code;
            if (code === '57014' || /statement timeout/i.test(msg)) {
              attempts++;
              console.warn(`⏳ 타임아웃으로 재시도 (${attempts})...`);
              await new Promise((r) => setTimeout(r, 500));
              continue;
            }
            console.error('❌ 답변 데이터 삽입 실패:', error);
            throw error;
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

      console.log('🎉 세션 설문 제출 완료!');
      toast({ title: '설문 참여 완료!', description: '소중한 의견을 주셔서 감사합니다.' });
      navigate('/');
    } catch (error) {
      console.error('💥 세션 설문 제출 중 오류 발생:', error);
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
        const scale = parseInt((answer?.answer as string) || '0', 10);
        return (
          <div className="grid grid-cols-5 gap-1 sm:grid-cols-10 sm:gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
              <Button
                key={v}
                type="button"
                variant={scale === v ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleAnswerChange(question.id, v.toString())}
                className="touch-friendly text-xs h-8 sm:text-sm sm:h-10"
              >
                {v}
              </Button>
            ))}
          </div>
        );
      }
      default:
        return <div>지원하지 않는 질문 유형입니다.</div>;
    }
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

  if (!survey || surveySessions.length === 0) {
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

  const currentSession = surveySessions[currentSessionIndex];
  const currentQuestions = getCurrentQuestions();
  const totalQuestions = getTotalQuestions();
  const currentQuestionNumber = getCurrentQuestionNumber();
  const progress = totalQuestions > 0 ? (currentQuestionNumber / totalQuestions) * 100 : 0;

  if (!currentQuestions || currentQuestions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">질문이 없습니다</h1>
          <p className="text-muted-foreground mb-4">이 설문에는 아직 질문이 추가되지 않았습니다.</p>
          <Button onClick={() => navigate('/')}>홈으로 돌아가기</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            나가기
          </Button>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">
              {currentQuestionNumber} / {totalQuestions}
            </div>
            <Progress value={progress} className="w-32" />
          </div>
        </div>

        {/* 현재 세션 정보 */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary text-primary-foreground rounded-full px-3 py-1 text-sm font-medium">
                {currentSession.session_name}
              </div>
              {currentSession.course?.title && (
                <span className="text-sm text-muted-foreground">
                  과목: {currentSession.course.title}
                </span>
              )}
            </div>
            {currentSession.instructor && (
              <div className="mt-3">
                <InstructorInfoSection instructor={currentSession.instructor} />
              </div>
            )}
          </CardHeader>
        </Card>

        {/* 질문 카드들 */}
        {currentQuestions.map((question, index) => (
          <Card key={question.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg leading-relaxed">
                    {currentQuestions.length > 1 && (
                      <span className="text-sm text-muted-foreground mr-2">
                        {index + 1}.
                      </span>
                    )}
                    {question.question_text}
                    {question.is_required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderQuestion(question)}
            </CardContent>
          </Card>
        ))}

        {/* 네비게이션 버튼 */}
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentSessionIndex === 0 && currentQuestionIndex === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            이전
          </Button>

          <div className="text-sm text-muted-foreground">
            세션 {currentSessionIndex + 1} / {surveySessions.length}
          </div>

          {isLastQuestion() ? (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? '제출 중...' : (
                <>
                  <Send className="w-4 h-4 mr-1" />
                  완료
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleNext}>
              다음
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SurveyParticipateSession;