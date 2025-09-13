import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Download, Printer, Mail, TrendingUp, Star } from 'lucide-react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { DonutChart, HeatmapChart, GaugeChart, RadarChart, AreaChart } from '@/components/charts';
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
}

interface CourseSession {
  id: string;
  title: string;
  course_name: string;
  session_name: string;
  education_day: number;
  instructor_name?: string;
  instructor_id?: string;
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
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [sendingResults, setSendingResults] = useState(false);
  const [comments, setComments] = useState<AnalysisComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const { toast } = useToast();

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

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
      // 같은 일차의 모든 과목 설문들 가져오기
      const { data: currentSurvey } = await supabase
        .from('surveys')
        .select('education_year, education_round, education_day, course_name')
        .eq('id', surveyId)
        .single();
      
      if (currentSurvey) {
        const { data: sameDaySurveys, error } = await supabase
          .from('surveys')
          .select(`
            id, 
            title, 
            course_name, 
            education_day, 
            instructor_id,
            instructors (
              id,
              name
            ),
            survey_sessions (
              session_name
            )
          `)
          .eq('education_year', currentSurvey.education_year)
          .eq('education_round', currentSurvey.education_round)
          .eq('education_day', currentSurvey.education_day)
          .order('course_name');
        
        if (error) throw error;
        
        const sessions = sameDaySurveys?.map(survey => {
          const sessionData = (survey as any).survey_sessions?.[0];
          const sessionName = sessionData?.session_name || survey.title;
          
          return {
            id: survey.id,
            title: survey.title,
            course_name: survey.course_name || '',
            session_name: sessionName,
            education_day: survey.education_day,
            instructor_name: (survey as any).instructors?.name || '',
            instructor_id: survey.instructor_id
          };
        }) || [];
        
        setCourseSessions(sessions);
      }
    } catch (error) {
      console.error('Error fetching course sessions:', error);
    }
  };

const categorizeQuestions = () => {
  // 선택된 과목에 따라 필터링
  let filteredQuestions = questions;
  if (selectedCourse !== 'all') {
    // 해당 과목의 설문 ID 찾기
    const selected = courseSessions.find((session) => session.session_name === selectedCourse);
    if (selected) {
      filteredQuestions = questions.filter((q) => q.survey_id === selected.id);
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

  const getSubjectAnalysis = (subjectId: string) => {
    // 선택된 과목에 따라 질문들을 필터링하고 분석
    let filteredQuestions = questions;
    if (subjectId !== 'all') {
      // 해당 과목의 설문 ID로 필터링
      filteredQuestions = questions.filter(q => q.survey_id === subjectId);
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

    return {
      subjectQuestions,
      instructorQuestions,
      operationQuestions,
      subjectAnalyses: getQuestionAnalysis(subjectQuestions),
      instructorAnalyses: getQuestionAnalysis(instructorQuestions),
      operationAnalyses: getQuestionAnalysis(operationQuestions),
      subjectAverage: calculateCategoryAverage(subjectQuestions),
      instructorAverage: calculateCategoryAverage(instructorQuestions),
      operationAverage: calculateCategoryAverage(operationQuestions)
    };
  };

  const renderQuestionAnalysis = (analysis: any, index: number) => (
    <Card key={analysis.question.id}>
      <CardHeader>
        <CardTitle className="text-lg">
          Q{index + 1}. {analysis.question.question_text}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          총 응답 수: {analysis.totalAnswers}개
          {analysis.question.is_required && (
            <Badge variant="secondary" className="ml-2">필수</Badge>
          )}
        </p>
      </CardHeader>
      <CardContent>
        {analysis.type === 'chart' && (
          <div className="space-y-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analysis.chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {analysis.chartData.map((entry: any, idx: number) => (
                      <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value}개 (${analysis.chartData.find((d: any) => d.name === name)?.percentage}%)`, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis.chartData.map((item: any, idx: number) => (
                <div key={item.name} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <span className="text-sm">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{item.value}개</p>
                    <p className="text-xs text-muted-foreground">{item.percentage}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {analysis.type === 'rating' && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{analysis.average}</div>
              <p className="text-sm text-muted-foreground">평균 점수 (10점 만점)</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={analysis.chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value, name) => [`${value}개 (${analysis.chartData.find((d: any) => d.name === name)?.percentage}%)`, '응답 수']} />
                  <Bar dataKey="value" fill="#8884d8" />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {analysis.chartData.map((item: any, idx: number) => (
                <div key={item.name} className="flex items-center gap-4">
                  <span className="text-sm w-12">{item.name}</span>
                  <div className="flex-1">
                    <Progress value={item.percentage} className="h-2" />
                  </div>
                  <span className="text-sm text-muted-foreground w-16">
                    {item.value}개 ({item.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {analysis.type === 'text' && (
          <div className="space-y-3">
            {analysis.answers && analysis.answers.length > 0 ? (
              analysis.answers.map((answer: any, idx: number) => (
                <div key={answer.id} className="p-3 border rounded-lg">
                  <p className="text-sm">{answer.answer_text}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(answer.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-center py-8">
                아직 응답이 없습니다.
              </p>
            )}
            {analysis.totalAnswers > 10 && (
              <p className="text-sm text-muted-foreground text-center">
                총 {analysis.totalAnswers}개 응답 중 최근 10개만 표시됩니다.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const getAvailableSubjects = () => {
    return courseSessions
      .map(session => ({
        id: session.id,
        displayName: `${session.session_name}${session.instructor_name ? ` - ${session.instructor_name}` : ''}`,
        courseName: session.session_name,
        instructorName: session.instructor_name || ''
      }))
      .filter((subject, index, self) => 
        subject.courseName && 
        self.findIndex(s => s.id === subject.id) === index
      )
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  };

  // 과목이 여러 개인지 확인하는 함수
  const shouldShowSubjectTabs = () => {
    const subjects = getAvailableSubjects();
    return subjects.length > 1;
  };

  // 강사의 접근 권한 확인 함수
  const getAccessibleSubjects = () => {
    const { userRoles } = useAuth();
    const subjects = getAvailableSubjects();
    
    // 관리자 권한(admin, operator, director)이면 모든 과목 접근 가능
    if (userRoles.some(role => ['admin', 'operator', 'director'].includes(role))) {
      return subjects;
    }
    
    // 강사 권한이면 본인 담당 과목만 접근 가능
    if (userRoles.includes('instructor') && user) {
      return subjects.filter(subject => 
        courseSessions.some(session => 
          session.id === subject.id && session.instructor_id === user.id
        )
      );
    }
    
    return subjects;
  };

  const handleSendResults = async () => {
    setSendingResults(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-survey-results', {
        body: { 
          surveyId,
          recipients: ['admin', 'instructor'] // 기본적으로 관리자와 강사에게 전송
        }
      });

      if (error) throw error;

      const results = (data as any)?.results as Array<{ to: string; name?: string; status: 'sent' | 'failed' }> | undefined;
      const recipientNames = (data as any)?.recipientNames as Record<string, string> | undefined;
      
      const sent = results?.filter(r => r.status === 'sent') || [];
      const failed = results?.filter(r => r.status === 'failed') || [];

      // 이름 기반 메시지 생성
      const getSentNames = () => {
        return sent.map(r => r.name || recipientNames?.[r.to] || r.to.split('@')[0]).join(', ');
      };

      const getFailedNames = () => {
        return failed.map(r => r.name || recipientNames?.[r.to] || r.to.split('@')[0]).join(', ');
      };

      toast({
        title: failed.length === 0 ? "✅ 결과 전송 완료!" : "⚠️ 일부 전송 실패",
        description: failed.length === 0 
          ? `${sent.length}명에게 설문 결과가 성공적으로 전송되었습니다. 📧\n받는 분: ${getSentNames()}` 
          : `성공 ${sent.length}건${sent.length ? `: ${getSentNames()}` : ''}\n실패 ${failed.length}건: ${getFailedNames()}`,
        duration: 6000,
      });
    } catch (error: any) {
      console.error('Error sending results:', error);
      toast({
        title: "오류",
        description: error.message || "결과 전송 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setSendingResults(false);
    }
  };

  // 코멘트 로드
  const loadComments = async () => {
    if (!surveyId) return;
    try {
      const { data, error } = await supabase
        .from('survey_analysis_comments')
        .select('*')
        .eq('survey_id', surveyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setComments(data || []);
    } catch (e) {
      console.error('Error loading comments:', e);
    }
  };

  // 코멘트 추가
  const handleAddComment = async () => {
    if (!user) {
      toast({ title: '오류', description: '로그인이 필요합니다.', variant: 'destructive' });
      return;
    }
    if (!surveyId) return;
    const text = commentText.trim();
    if (!text) {
      toast({ title: '오류', description: '코멘트를 입력해주세요.', variant: 'destructive' });
      return;
    }
    setSavingComment(true);
    try {
      const { error } = await supabase
        .from('survey_analysis_comments')
        .insert({ survey_id: surveyId, author_id: user.id, content: text });
      if (error) throw error;
      setCommentText('');
      await loadComments();
      toast({ title: '등록 완료', description: '코멘트가 등록되었습니다.' });
    } catch (e: any) {
      console.error('Error adding comment:', e);
      toast({ title: '오류', description: e.message || '코멘트 등록 중 오류가 발생했습니다.', variant: 'destructive' });
    } finally {
      setSavingComment(false);
    }
  };

  // 코멘트 삭제
  const handleDeleteComment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('survey_analysis_comments')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await loadComments();
    } catch (e) {
      console.error('Error deleting comment:', e);
    }
  };

  // 엑셀 다운로드 기능
  const handleDownload = () => {
    if (!survey) return;
    
    try {
      const csvContent = generateCSVContent();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${survey.title}_분석결과_${survey.education_year}년_${survey.education_round}차.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "성공",
        description: "설문 분석 결과가 CSV 파일로 다운로드되었습니다."
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "오류",
        description: "다운로드 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const generateCSVContent = () => {
    if (!survey) return '';
    
    let csvContent = '\uFEFF'; // BOM for Excel
    
    // 설문 기본 정보
    csvContent += `설문명,${survey.title}\n`;
    csvContent += `교육년도,${survey.education_year}\n`;
    csvContent += `교육차수,${survey.education_round}\n`;
    csvContent += `총 응답수,${responses.length}\n`;
    csvContent += `강사명,${instructor?.name || '-'}\n\n`;
    
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
  const subjectAnalyses = getQuestionAnalysis(subjectQuestions);
  const instructorAnalyses = getQuestionAnalysis(instructorQuestions);
  const operationAnalyses = getQuestionAnalysis(operationQuestions);
  const subjectAverage = calculateCategoryAverage(subjectQuestions);
  const instructorAverage = calculateCategoryAverage(instructorQuestions);
  const operationAverage = calculateCategoryAverage(operationQuestions);

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


          {/* 종합 만족도 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  과목 만족도
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-500">{subjectAverage}</div>
                  <div className="text-sm text-muted-foreground">평균 점수 (10점 만점)</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {subjectQuestions.length}개 질문 기준
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-orange-500" />
                  강사 만족도
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-500">{instructorAverage}</div>
                  <div className="text-sm text-muted-foreground">평균 점수 (10점 만점)</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {instructorQuestions.length}개 질문 기준
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  운영 만족도
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-500">{operationAverage}</div>
                  <div className="text-sm text-muted-foreground">평균 점수 (10점 만점)</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {operationQuestions.length}개 질문 기준
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                  과정 만족도 (종합)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-500">{calculateOverallSatisfaction()}</div>
                  <div className="text-sm text-muted-foreground">평균 점수 (10점 만점)</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    강사+과목+운영 종합
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 과목별 상세 분석 탭 */}
          <Tabs defaultValue="all" className="space-y-4">
            {shouldShowSubjectTabs() && (
              <TabsList className="grid w-full grid-cols-4 md:grid-cols-6 overflow-x-auto">
                <TabsTrigger value="all" className="text-sm touch-friendly whitespace-nowrap">
                  전체 분석
                </TabsTrigger>
                {getAccessibleSubjects().map(subject => (
                  <TabsTrigger key={subject.id} value={subject.id} className="text-sm touch-friendly whitespace-nowrap">
                    {subject.displayName}
                  </TabsTrigger>
                ))}
              </TabsList>
            )}

            {/* 전체 분석 탭 */}
            <TabsContent value="all" className="space-y-4">
              <Tabs defaultValue="subject" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="subject" className="text-sm touch-friendly">
                    과목 만족도 ({subjectQuestions.length})
                  </TabsTrigger>
                  <TabsTrigger value="instructor" className="text-sm touch-friendly">
                    강사 만족도 ({instructorQuestions.length})
                  </TabsTrigger>
                  <TabsTrigger value="operation" className="text-sm touch-friendly">
                    운영 만족도 ({operationQuestions.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="subject" className="space-y-4">
                  {subjectAnalyses.length > 0 ? (
                    subjectAnalyses.map((analysis, index) => renderQuestionAnalysis(analysis, index))
                  ) : (
                    <Card>
                      <CardContent className="text-center py-8">
                        <p className="text-muted-foreground">과목 관련 질문이 없습니다.</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="instructor" className="space-y-4">
                  {instructorAnalyses.length > 0 ? (
                    instructorAnalyses.map((analysis, index) => renderQuestionAnalysis(analysis, index))
                  ) : (
                    <Card>
                      <CardContent className="text-center py-8">
                        <p className="text-muted-foreground">강사 관련 질문이 없습니다.</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="operation" className="space-y-4">
                  {operationAnalyses.length > 0 ? (
                    operationAnalyses.map((analysis, index) => renderQuestionAnalysis(analysis, index))
                  ) : (
                    <Card>
                      <CardContent className="text-center py-8">
                        <p className="text-muted-foreground">운영 관련 질문이 없습니다.</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* 각 과목별 분석 탭 - 과목이 여러 개일 때만 표시 */}
            {shouldShowSubjectTabs() && getAccessibleSubjects().map((subject) => {
              const subjectAnalysis = getSubjectAnalysis(subject.id);
              return (
                <TabsContent key={subject.id} value={subject.id} className="space-y-4">
                  {/* 해당 과목의 종합 만족도 카드 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-blue-500" />
                          과목 만족도
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-blue-500">{subjectAnalysis.subjectAverage}</div>
                          <div className="text-sm text-muted-foreground">평균 점수 (10점 만점)</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {subjectAnalysis.subjectQuestions.length}개 질문 기준
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Star className="h-5 w-5 text-orange-500" />
                          강사 만족도
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-orange-500">{subjectAnalysis.instructorAverage}</div>
                          <div className="text-sm text-muted-foreground">평균 점수 (10점 만점)</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {subjectAnalysis.instructorQuestions.length}개 질문 기준
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-green-500" />
                          운영 만족도
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-green-500">{subjectAnalysis.operationAverage}</div>
                          <div className="text-sm text-muted-foreground">평균 점수 (10점 만점)</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {subjectAnalysis.operationQuestions.length}개 질문 기준
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 해당 과목의 상세 분석 서브탭 */}
                  <Tabs defaultValue="subject" className="space-y-4">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="subject" className="text-sm touch-friendly">
                        과목 만족도 ({subjectAnalysis.subjectQuestions.length})
                      </TabsTrigger>
                      <TabsTrigger value="instructor" className="text-sm touch-friendly">
                        강사 만족도 ({subjectAnalysis.instructorQuestions.length})
                      </TabsTrigger>
                      <TabsTrigger value="operation" className="text-sm touch-friendly">
                        운영 만족도 ({subjectAnalysis.operationQuestions.length})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="subject" className="space-y-4">
                      {subjectAnalysis.subjectAnalyses.length > 0 ? (
                        subjectAnalysis.subjectAnalyses.map((analysis, index) => renderQuestionAnalysis(analysis, index))
                      ) : (
                        <Card>
                          <CardContent className="text-center py-8">
                            <p className="text-muted-foreground">과목 관련 질문이 없습니다.</p>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    <TabsContent value="instructor" className="space-y-4">
                      {subjectAnalysis.instructorAnalyses.length > 0 ? (
                        subjectAnalysis.instructorAnalyses.map((analysis, index) => renderQuestionAnalysis(analysis, index))
                      ) : (
                        <Card>
                          <CardContent className="text-center py-8">
                            <p className="text-muted-foreground">강사 관련 질문이 없습니다.</p>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    <TabsContent value="operation" className="space-y-4">
                      {subjectAnalysis.operationAnalyses.length > 0 ? (
                        subjectAnalysis.operationAnalyses.map((analysis, index) => renderQuestionAnalysis(analysis, index))
                      ) : (
                        <Card>
                          <CardContent className="text-center py-8">
                            <p className="text-muted-foreground">운영 관련 질문이 없습니다.</p>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>
                  </Tabs>
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