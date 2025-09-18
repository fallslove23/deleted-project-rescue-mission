import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Download, Printer, Mail, TrendingUp, Star, Users } from 'lucide-react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface Survey {
  id: string;
  title: string;
  education_year: number;
  education_round: number;
  education_day: number;
  status: string;
  instructor_id: string;
  course_name?: string;
}

interface SurveyResponse {
  id: string;
  survey_id: string;
  submitted_at: string;
  respondent_email: string;
}

interface QuestionAnswer {
  id: string;
  question_id: string;
  response_id: string;
  answer_text: string;
  answer_value: any;
  created_at: string;
}

interface SurveyQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options: any;
  is_required: boolean;
  survey_id: string;
  order_index: number;
  satisfaction_type?: 'course' | 'subject' | 'instructor' | 'operation' | string;
  session_id?: string | null;
  scope?: 'session' | 'operation' | string;
}

interface CourseSession {
  id: string;
  title: string;
  course_name: string;
  session_name: string;
  education_day: number;
  instructor_name: string;
  instructor_id: string;
  instructor_email?: string;
  status?: string;
}

interface Instructor {
  id: string;
  name: string;
  email: string;
  photo_url: string;
}

interface AnalysisComment {
  id: string;
  survey_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const SurveyDetailedAnalysis = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { surveyId } = useParams();
  const { user, userRoles } = useAuth();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [courseSessions, setCourseSessions] = useState<CourseSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingResults, setSendingResults] = useState(false);
  const [comments, setComments] = useState<AnalysisComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const { toast } = useToast();

  // Design system chart colors
  const COLORS = [
    'hsl(var(--chart-1))', // Purple
    'hsl(var(--chart-2))', // Light purple
    'hsl(var(--chart-3))', // Violet
    'hsl(var(--chart-4))', // Blue purple
    'hsl(var(--chart-5))'  // Pink purple
  ];

  useEffect(() => {
    if (surveyId) {
      fetchSurveyData();
      fetchResponses();
      fetchQuestionsAndAnswers();  
      fetchCourseSessions();
      loadComments();
    }
  }, [surveyId]);

  const fetchSurveyData = async () => {
    if (!surveyId) return;
    
    try {
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', surveyId)
        .single();
      
      if (surveyError) throw surveyError;
      setSurvey(surveyData);

      // 강사 정보 가져오기
      if (surveyData.instructor_id) {
        const { data: instructorData, error: instructorError } = await supabase
          .from('instructors')
          .select('*')
          .eq('id', surveyData.instructor_id)
          .single();
        
        if (instructorError) throw instructorError;
        setInstructor(instructorData);
      }
    } catch (error) {
      console.error('Error fetching survey data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchResponses = async () => {
    if (!surveyId) return;
    
    try {
      const { data, error } = await supabase
        .from('survey_responses')
        .select('*')
        .eq('survey_id', surveyId)
        .order('submitted_at', { ascending: false });
      
      if (error) throw error;
      setResponses(data || []);
    } catch (error) {
      console.error('Error fetching responses:', error);
    }
  };

  const fetchQuestionsAndAnswers = async () => {
    if (!surveyId) return;
    
    try {
      // 설문 질문들 가져오기
      const { data: questionsData, error: questionsError } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', surveyId)
        .order('order_index');
      
      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

      // 해당 설문의 모든 응답 ID들 가져오기
      const { data: responseIds, error: responseError } = await supabase
        .from('survey_responses')
        .select('id')
        .eq('survey_id', surveyId);
      
      if (responseError) throw responseError;
      
      if (responseIds && responseIds.length > 0) {
        const ids = responseIds.map(r => r.id);
        
        // 답변들 가져오기
        const { data: answersData, error: answersError } = await supabase
          .from('question_answers')
          .select('*')
          .in('response_id', ids)
          .order('created_at');
        
        if (answersError) throw answersError;
        setAnswers(answersData || []);
      } else {
        setAnswers([]);
      }
    } catch (error) {
      console.error('Error fetching questions and answers:', error);
    }
  };

  const fetchCourseSessions = async () => {
    if (!surveyId) return;
    
    try {
      // 현재 설문에서 세션들을 가져오기
      const { data: sessions, error } = await supabase
        .from('survey_sessions')
        .select(`
          id,
          session_name,
          session_order,
          survey_id,
          course_id,
          instructor_id,
          courses (
            id,
            title
          ),
          instructors (
            id,
            name,
            email
          )
        `)
        .eq('survey_id', surveyId)
        .order('session_order');
      
      if (error) throw error;
      
      // 강사 권한 체크 및 필터링
      let filteredSessions = sessions || [];
      if (userRoles.includes('instructor')) {
        // 현재 로그인한 사용자의 강사 ID 찾기
        const { data: profile } = await supabase
          .from('profiles')
          .select('instructor_id')
          .eq('id', user?.id)
          .single();
          
        if (profile?.instructor_id) {
          filteredSessions = sessions?.filter((s: any) => s.instructor_id === profile.instructor_id) || [];
        }
      }

      // 세션 정보 구성
      const courseSessions = filteredSessions.map((session: any) => ({
        id: session.id,
        title: session.courses?.title || session.session_name || '과목명 없음',
        course_name: session.courses?.title || session.session_name || '',
        session_name: session.session_name || session.courses?.title || '과목명 없음',
        education_day: 1, // survey_sessions 테이블에는 education_day가 없으므로 기본값
        instructor_name: session.instructors?.name || '강사 정보 없음',
        instructor_id: session.instructor_id,
        instructor_email: session.instructors?.email || '',
        status: 'active' // survey_sessions 테이블에는 status가 없으므로 기본값
      }));
      
      console.log('Fetched course sessions:', courseSessions);
      setCourseSessions(courseSessions);
    } catch (error) {
      console.error('Error fetching course sessions:', error);
      setCourseSessions([]);
    }
  };

  const loadComments = async () => {
    if (!surveyId) return;
    
    try {
      const { data, error } = await supabase
        .from('survey_analysis_comments')
        .select(`
          *,
          profiles (
            email
          )
        `)
        .eq('survey_id', surveyId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const getSubjectAnalysis = (sessionId: string) => {
    // 선택된 세션에 따라 질문들을 필터링하고 분석
    let filteredQuestions = questions;
    let filteredAnswers = answers;
    let filteredResponses = responses;

    if (sessionId !== 'all') {
      // 선택된 세션 정보 가져오기
      const selectedSession = courseSessions.find(cs => cs.id === sessionId);

      if (selectedSession) {
        // 해당 세션 설문의 질문들만 필터링
        filteredQuestions = questions.filter(q => {
          // session_id가 있는 경우 직접 매칭
          if (q.session_id) {
            return q.session_id === sessionId;
          }
          // session_id가 없지만 과목/강사 문항인 경우 설문 ID로 매칭
          if (surveyId && q.scope !== 'operation') {
            return q.survey_id === surveyId;
          }

          return false;
        });

        // 해당 질문들에 대한 답변만 필터링
        const questionIds = filteredQuestions.map(q => q.id);
        filteredAnswers = answers.filter(a => questionIds.includes(a.question_id));

        // 해당 세션 질문에 응답한 설문 응답만 필터링
        const responseIds = new Set(filteredAnswers.map(answer => answer.response_id));
        filteredResponses = responses.filter(response => responseIds.has(response.id));
      } else {
        // 세션을 찾을 수 없는 경우 빈 배열로 설정
        filteredQuestions = [];
        filteredAnswers = [];
        filteredResponses = [];
      }
    }

    const subjectQuestions: SurveyQuestion[] = [];
    const instructorQuestions: SurveyQuestion[] = [];
    const operationQuestions: SurveyQuestion[] = [];

    filteredQuestions.forEach((question) => {
      const type = (question as any).satisfaction_type as string | undefined;
      if (type === 'instructor') {
        instructorQuestions.push(question);
      } else if (type === 'operation') {
        operationQuestions.push(question);
      } else if (type === 'course' || type === 'subject') {
        subjectQuestions.push(question);
      } else {
        // 타입 정보가 없을 때: 평점형은 과목으로, 나머지는 과목 기본
        if (question.question_type === 'rating' || question.question_type === 'scale') {
          subjectQuestions.push(question);
        } else {
          subjectQuestions.push(question);
        }
      }
    });

    // 필터링된 답변을 사용하여 분석
    const getFilteredQuestionAnalysis = (questions: SurveyQuestion[]) => {
      return questions.map(question => {
        const questionAnswers = filteredAnswers.filter(a => a.question_id === question.id);
        
        if (question.question_type === 'multiple_choice' || question.question_type === 'single_choice') {
          const answerCounts: Record<string, number> = {};
          questionAnswers.forEach(answer => {
            const answerText = answer.answer_text;
            answerCounts[answerText] = (answerCounts[answerText] || 0) + 1;
          });

          return {
            question,
            type: 'chart' as const,
            totalAnswers: questionAnswers.length,
            chartData: Object.entries(answerCounts).map(([answer, count]) => ({
              name: answer,
              value: count,
              percentage: questionAnswers.length > 0 ? Math.round((count / questionAnswers.length) * 100) : 0
            }))
          };
        } else if (question.question_type === 'rating' || question.question_type === 'scale') {
          const ratings = questionAnswers.map(a => parseInt(a.answer_text)).filter(r => !isNaN(r));
          const maxScore = Math.max(...ratings, 0);
          let convertedRatings = ratings;
          
          if (maxScore <= 5 && maxScore > 0) {
            convertedRatings = ratings.map(r => r * 2);
          }
          
          const average = convertedRatings.length > 0 ? (convertedRatings.reduce((sum, r) => sum + r, 0) / convertedRatings.length).toFixed(1) : '0';
          
          const distribution = {};
          for (let i = 1; i <= 10; i++) {
            distribution[i] = convertedRatings.filter(r => r === i).length;
          }
          
          return {
            question,
            type: 'rating' as const,
            totalAnswers: questionAnswers.length,
            average,
            chartData: Object.entries(distribution).map(([score, count]) => ({
              name: `${score}점`,
              value: count as number,
              percentage: convertedRatings.length > 0 ? Math.round(((count as number) / convertedRatings.length) * 100) : 0
            }))
          };
        } else {
          return {
            question,
            type: 'text' as const,
            totalAnswers: questionAnswers.length,
            answers: questionAnswers.slice(0, 10)
          };
        }
      });
    };

    // 카테고리별 평균 계산 함수
    const calculateCategoryAverage = (questionList: SurveyQuestion[]) => {
      const ratingQuestions = questionList.filter(q => q.question_type === 'rating' || q.question_type === 'scale');
      if (ratingQuestions.length === 0) return '0';

      let totalScore = 0;
      let totalCount = 0;

      ratingQuestions.forEach(question => {
        const questionAnswers = filteredAnswers.filter(a => a.question_id === question.id);
        const ratings = questionAnswers.map(a => parseInt(a.answer_text)).filter(r => !isNaN(r));
        
        if (ratings.length > 0) {
          const maxScore = Math.max(...ratings);
          let convertedRatings = ratings;
          
          if (maxScore <= 5) {
            convertedRatings = ratings.map(r => r * 2);
          }
          
          totalScore += convertedRatings.reduce((sum, r) => sum + r, 0);
          totalCount += convertedRatings.length;
        }
      });

      return totalCount > 0 ? (totalScore / totalCount).toFixed(1) : '0';
    };

    return {
      subjectQuestions,
      instructorQuestions,
      operationQuestions,
      filteredQuestions,
      filteredAnswers,
      filteredResponses,
      getFilteredQuestionAnalysis,
      calculateCategoryAverage
    };
  };

  const categorizeQuestions = () => {
    const subjectQuestions: SurveyQuestion[] = [];
    const instructorQuestions: SurveyQuestion[] = [];
    const operationQuestions: SurveyQuestion[] = [];

    questions.forEach((question) => {
      const type = (question as any).satisfaction_type as string | undefined;

      if (type === 'instructor') {
        instructorQuestions.push(question);
      } else if (type === 'operation') {
        operationQuestions.push(question);
      } else if (type === 'course' || type === 'subject') {
        subjectQuestions.push(question);
      } else {
        // 타입 정보가 없을 때의 안전한 기본값: 평점형은 과목으로 분류
        if (question.question_type === 'rating' || question.question_type === 'scale') {
          subjectQuestions.push(question);
        } else {
          subjectQuestions.push(question);
        }
      }
    });

    return { subjectQuestions, instructorQuestions, operationQuestions };
  };

  const getQuestionAnalysis = (questionList: SurveyQuestion[]) => {
    // order_index 순서로 정렬
    const sortedQuestions = [...questionList].sort((a, b) => a.order_index - b.order_index);
    return sortedQuestions.map(question => {
      const questionAnswers = answers.filter(a => a.question_id === question.id);
      
      if (question.question_type === 'multiple_choice' || question.question_type === 'single_choice') {
        const options = question.options || [];
        const answerCounts = {};
        
        options.forEach(option => {
          answerCounts[option] = 0;
        });
        
        questionAnswers.forEach(answer => {
          if (answer.answer_text && answerCounts.hasOwnProperty(answer.answer_text)) {
            answerCounts[answer.answer_text]++;
          }
        });
        
        const chartData = Object.entries(answerCounts).map(([option, count]) => ({
          name: option,
          value: count as number,
          percentage: questionAnswers.length > 0 ? Math.round(((count as number) / questionAnswers.length) * 100) : 0
        }));
        
        return {
          question,
          totalAnswers: questionAnswers.length,
          chartData,
          type: 'chart'
        };
      } else if (question.question_type === 'rating' || question.question_type === 'scale') {
        const ratings = questionAnswers.map(a => parseInt(a.answer_text)).filter(r => !isNaN(r));
        // 원본 점수가 이미 10점 척도인지 5점 척도인지 확인
        const maxScore = Math.max(...ratings);
        let convertedRatings = ratings;
        
        // 5점 척도라면 10점 척도로 변환
        if (maxScore <= 5) {
          convertedRatings = ratings.map(r => r * 2);
        }
        
        const average = convertedRatings.length > 0 ? (convertedRatings.reduce((sum, r) => sum + r, 0) / convertedRatings.length).toFixed(1) : '0';
        
        // 점수별 분포 계산 (10점 만점 기준)
        const distribution = {};
        for (let i = 1; i <= 10; i++) {
          distribution[i] = convertedRatings.filter(r => r === i).length;
        }
        
        const chartData = Object.entries(distribution).map(([score, count]) => ({
          name: `${score}점`,
          value: count as number,
          percentage: convertedRatings.length > 0 ? Math.round(((count as number) / convertedRatings.length) * 100) : 0
        }));
        
        return {
          question,
          totalAnswers: questionAnswers.length,
          average,
          chartData,
          type: 'rating'
        };
      } else {
        // 텍스트 답변
        return {
          question,
          totalAnswers: questionAnswers.length,
          answers: questionAnswers.slice(0, 10), // 최대 10개만 표시
          type: 'text'
        };
      }
    });
  };

  const calculateCategoryAverage = (questionList: SurveyQuestion[]) => {
    const ratingQuestions = questionList.filter(q => q.question_type === 'rating' || q.question_type === 'scale');
    if (ratingQuestions.length === 0) return 0;

    let totalScore = 0;
    let totalCount = 0;

    ratingQuestions.forEach(question => {
      const questionAnswers = answers.filter(a => a.question_id === question.id);
      const ratings = questionAnswers.map(a => parseInt(a.answer_text)).filter(r => !isNaN(r));
      
      if (ratings.length > 0) {
        // 원본 점수가 이미 10점 척도인지 5점 척도인지 확인
        const maxScore = Math.max(...ratings);
        let convertedRatings = ratings;
        
        // 5점 척도라면 10점 척도로 변환
        if (maxScore <= 5) {
          convertedRatings = ratings.map(r => r * 2);
        }
        
        totalScore += convertedRatings.reduce((sum, r) => sum + r, 0);
        totalCount += convertedRatings.length;
      }
    });

    return totalCount > 0 ? (totalScore / totalCount).toFixed(1) : '0';
  };

  const calculateOverallSatisfaction = () => {
    const { subjectQuestions, instructorQuestions, operationQuestions } = categorizeQuestions();
    const allRatingQuestions = [...subjectQuestions, ...instructorQuestions, ...operationQuestions]
      .filter(q => q.question_type === 'rating' || q.question_type === 'scale');
    
    if (allRatingQuestions.length === 0) return '0';

    let totalScore = 0;
    let totalCount = 0;

    allRatingQuestions.forEach(question => {
      const questionAnswers = answers.filter(a => a.question_id === question.id);
      const ratings = questionAnswers.map(a => parseInt(a.answer_text)).filter(r => !isNaN(r));
      
      if (ratings.length > 0) {
        const maxScore = Math.max(...ratings);
        let convertedRatings = ratings;
        
        if (maxScore <= 5) {
          convertedRatings = ratings.map(r => r * 2);
        }
        
        totalScore += convertedRatings.reduce((sum, r) => sum + r, 0);
        totalCount += convertedRatings.length;
      }
    });

    return totalCount > 0 ? (totalScore / totalCount).toFixed(1) : '0';
  };

  const handleSendResults = async () => {
    if (!surveyId) return;
    
    setSendingResults(true);
    try {
      const { error } = await supabase.functions.invoke('send-survey-results', {
        body: { surveyId }
      });
      
      if (error) throw error;
      
      toast({
        title: "전송 완료",
        description: "설문 결과가 이메일로 전송되었습니다.",
      });
    } catch (error) {
      console.error('Error sending results:', error);
      toast({
        title: "전송 실패",
        description: "결과 전송 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setSendingResults(false);
    }
  };

  const handleDownload = () => {
    const csv = generateCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `survey_analysis_${survey?.title || 'results'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateCSV = () => {
    if (!survey) return '';
    
    let csvContent = '설문 상세 분석 결과\n';
    csvContent += `설문명: ${survey.title}\n`;
    csvContent += `교육년도: ${survey.education_year}년\n`;
    csvContent += `교육차수: ${survey.education_round}차\n`;
    csvContent += `총 응답 수: ${responses.length}\n\n`;
    
    // 종합 만족도
    csvContent += `종합 만족도: ${calculateOverallSatisfaction()}/10\n`;
    
    // 과목 만족도 통계
    const subjectAvg = calculateCategoryAverage(categorizeQuestions().subjectQuestions);
    const subjectAvgStr = String(subjectAvg);
    csvContent += `과목 만족도,${subjectAvgStr !== '0' ? subjectAvgStr : '-'}/10\n`;
    
    // 강사 만족도 통계
    const instructorAvg = calculateCategoryAverage(categorizeQuestions().instructorQuestions);
    const instructorAvgStr = String(instructorAvg);
    csvContent += `강사 만족도,${instructorAvgStr !== '0' ? instructorAvgStr : '-'}/10\n`;
    
    // 운영 만족도 통계
    const operationAvg = calculateCategoryAverage(categorizeQuestions().operationQuestions);
    const operationAvgStr = String(operationAvg);
    csvContent += `운영 만족도,${operationAvgStr !== '0' ? operationAvgStr : '-'}/10\n\n`;
    
    // 질문별 분석
    csvContent += `질문,질문유형,응답수,분석결과\n`;
    
    const { subjectQuestions, instructorQuestions, operationQuestions } = categorizeQuestions();
    
    [...subjectQuestions, ...instructorQuestions, ...operationQuestions].forEach((question, index) => {
      const analysis = getQuestionAnalysis([question])[0];
      csvContent += `"${question.question_text}",${question.question_type},${analysis.totalAnswers},"`;
      
      if (analysis.type === 'rating') {
        csvContent += `평균: ${analysis.average}점`;
      } else if (analysis.type === 'chart') {
        const topAnswer = analysis.chartData.reduce((a, b) => a.value > b.value ? a : b, {name: '', value: 0});
        csvContent += `최다응답: ${topAnswer.name} (${topAnswer.value}명)`;
      } else {
        csvContent += `텍스트 응답 ${analysis.totalAnswers}개`;
      }
      
      csvContent += `"\n`;
    });
    
    return csvContent;
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
        <div>설문을 찾을 수 없습니다.</div>
      </div>
    );
  }

  const { subjectQuestions, instructorQuestions, operationQuestions } = categorizeQuestions();
  const subjectAnalysis = getQuestionAnalysis([...subjectQuestions, ...instructorQuestions, ...operationQuestions]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center relative">
          <Button
            onClick={() => {
              const from = location.state?.from;
              if (from === 'survey-management') {
                navigate('/surveys-v2');
              } else {
                navigate('/dashboard/results');
              }
            }}
            variant="ghost"
            size="sm"
            className="touch-friendly"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">
              {location.state?.from === 'survey-management' ? '설문 관리' : '결과 분석'}
            </span>
          </Button>
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <h1 className="text-sm sm:text-lg font-semibold text-primary text-center break-words">상세 분석</h1>
            <p className="text-xs text-muted-foreground break-words text-center line-clamp-2">
              {survey.title}
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* 설문 정보 */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                <div>
                  <CardTitle className="break-words">{survey.title}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={survey.status === 'active' ? 'default' : 'secondary'}>
                      {survey.status === 'active' ? '진행중' : survey.status === 'completed' ? '완료' : '초안'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {survey.education_year}년 {survey.education_round}차
                    </span>
                  </div>
                  {instructor && (
                    <div className="flex items-center gap-2 mt-2">
                      {instructor.photo_url && (
                        <img 
                          src={instructor.photo_url} 
                          alt={instructor.name}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      )}
                      <span className="text-sm text-muted-foreground">
                        강사: {instructor.name} ({instructor.email})
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">{responses.length}</div>
                  <div className="text-sm text-muted-foreground">총 응답</div>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* 액션 버튼들 */}
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleSendResults}
              disabled={sendingResults}
            >
              <Mail className="h-4 w-4 mr-2" />
              {sendingResults ? '전송 중...' : '결과 전송'}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4 mr-2" />
              엑셀 다운로드
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />
              인쇄
            </Button>
          </div>

          {/* 과목-강사별 탭 */}
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${Math.min(courseSessions.length + 1, 6)}, 1fr)` }}>
              <TabsTrigger value="all">전체</TabsTrigger>
              {courseSessions.map((session) => (
                <TabsTrigger key={session.id} value={session.id} className="text-xs">
                  {session.session_name}
                  {session.instructor_name && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {session.instructor_name}
                    </div>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">종합 만족도</CardTitle>
                    <Star className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{calculateOverallSatisfaction()}/10</div>
                    <Progress value={parseFloat(calculateOverallSatisfaction()) * 10} className="mt-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">과목 만족도</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{calculateCategoryAverage(subjectQuestions)}/10</div>
                    <Progress value={parseFloat(String(calculateCategoryAverage(subjectQuestions))) * 10} className="mt-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">강사 만족도</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{calculateCategoryAverage(instructorQuestions)}/10</div>
                    <Progress value={parseFloat(String(calculateCategoryAverage(instructorQuestions))) * 10} className="mt-2" />
                  </CardContent>
                </Card>
              </div>

              {/* 전체 문항 분석 */}
              <div className="space-y-6">
                {subjectAnalysis.map((analysis, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="text-base">{analysis.question.question_text}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {analysis.type === 'rating' && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-4">
                            <div className="text-3xl font-bold text-primary">{analysis.average}/10</div>
                            <div className="text-sm text-muted-foreground">
                              총 {analysis.totalAnswers}개 응답
                            </div>
                          </div>
                          <div className="w-full">
                            <ResponsiveContainer width="100%" height={200}>
                              <RechartsBarChart data={analysis.chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip formatter={(value, name) => [`${value}개 (${analysis.chartData.find(d => d.name === name)?.percentage}%)`, '응답 수']} />
                                <Bar dataKey="value" fill="hsl(var(--chart-1))" />
                              </RechartsBarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                      {analysis.type === 'chart' && (
                        <div className="w-full">
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <Pie
                                data={analysis.chartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percentage }) => `${name} (${percentage}%)`}
                                outerRadius={80}
                                fill="hsl(var(--chart-1))"
                                dataKey="value"
                              >
                                {analysis.chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value, name) => [`${value}개`, name]} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      {analysis.type === 'text' && (
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">
                            총 {analysis.totalAnswers}개 응답 (최대 10개 표시)
                          </div>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {analysis.answers?.map((answer, idx) => (
                              <div key={idx} className="p-2 bg-muted rounded text-sm">
                                {answer.answer_text}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* 개별 과목-강사 탭들 */}
            {courseSessions.map((session) => {
              const sessionAnalysis = getSubjectAnalysis(session.id);
              const sessionSubjectQuestions = sessionAnalysis.subjectQuestions || [];
              const sessionInstructorQuestions = sessionAnalysis.instructorQuestions || [];
              const sessionOperationQuestions = sessionAnalysis.operationQuestions || [];
              
              return (
                <TabsContent key={session.id} value={session.id} className="space-y-6">
                  {/* 과목-강사 정보 헤더 */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-xl">{session.session_name}</CardTitle>
                          <div className="text-sm text-muted-foreground mt-1">
                            강사: {session.instructor_name}
                            {session.instructor_email && (
                              <span className="ml-2">({session.instructor_email})</span>
                            )}
                          </div>
                        </div>
                        <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                          {session.status === 'completed' ? '완료' : session.status}
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* 과목별 통계 요약 */}
                  <div className="grid gap-6 md:grid-cols-3">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">과목 만족도</CardTitle>
                        <Star className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {sessionAnalysis.calculateCategoryAverage(sessionSubjectQuestions)}/10
                        </div>
                        <Progress value={parseFloat(sessionAnalysis.calculateCategoryAverage(sessionSubjectQuestions)) * 10} className="mt-2" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">강사 만족도</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {sessionAnalysis.calculateCategoryAverage(sessionInstructorQuestions)}/10
                        </div>
                        <Progress value={parseFloat(sessionAnalysis.calculateCategoryAverage(sessionInstructorQuestions)) * 10} className="mt-2" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">응답 수</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{sessionAnalysis.filteredResponses.length}</div>
                        <div className="text-xs text-muted-foreground mt-1">총 응답</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 과목별 상세 분석 */}
                  <div className="space-y-6">
                    {sessionAnalysis.getFilteredQuestionAnalysis([...sessionSubjectQuestions, ...sessionInstructorQuestions, ...sessionOperationQuestions]).map((analysis, index) => (
                      <Card key={index}>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            {analysis.question.question_text}
                            <Badge variant="outline" className="text-xs">
                              {analysis.question.satisfaction_type === 'course' || analysis.question.satisfaction_type === 'subject' ? '과목' :
                               analysis.question.satisfaction_type === 'instructor' ? '강사' :
                               analysis.question.satisfaction_type === 'operation' ? '운영' : '기타'}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {analysis.type === 'rating' && (
                            <div className="space-y-4">
                              <div className="flex items-center gap-4">
                                <div className="text-3xl font-bold text-primary">{analysis.average}/10</div>
                                <div className="text-sm text-muted-foreground">
                                  총 {analysis.totalAnswers}개 응답
                                </div>
                              </div>
                              <div className="w-full">
                                <ResponsiveContainer width="100%" height={200}>
                                  <RechartsBarChart data={analysis.chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip formatter={(value, name) => [`${value}개 (${analysis.chartData.find(d => d.name === name)?.percentage}%)`, '응답 수']} />
                                    <Bar dataKey="value" fill="hsl(var(--chart-1))" />
                                  </RechartsBarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          )}
                          {analysis.type === 'chart' && (
                            <div className="w-full">
                              <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                  <Pie
                                    data={analysis.chartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percentage }) => `${name} (${percentage}%)`}
                                    outerRadius={80}
                                    fill="hsl(var(--chart-1))"
                                    dataKey="value"
                                  >
                                    {analysis.chartData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                  </Pie>
                                  <Tooltip formatter={(value, name) => [`${value}개`, name]} />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                          {analysis.type === 'text' && (
                            <div className="space-y-2">
                              <div className="text-sm text-muted-foreground">
                                총 {analysis.totalAnswers}개 응답 (최대 10개 표시)
                              </div>
                              <div className="space-y-2 max-h-60 overflow-y-auto">
                                {analysis.answers?.map((answer, idx) => (
                                  <div key={idx} className="p-2 bg-muted rounded text-sm">
                                    {answer.answer_text}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default SurveyDetailedAnalysis;