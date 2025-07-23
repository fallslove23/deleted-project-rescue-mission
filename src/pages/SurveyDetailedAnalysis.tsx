import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Download, Printer, Mail, TrendingUp, Star } from 'lucide-react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface Survey {
  id: string;
  title: string;
  education_year: number;
  education_round: number;
  status: string;
  instructor_id: string;
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
}

interface Instructor {
  id: string;
  name: string;
  email: string;
  photo_url: string;
}

const SurveyDetailedAnalysis = () => {
  const navigate = useNavigate();
  const { surveyId } = useParams();
  const { user } = useAuth();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingResults, setSendingResults] = useState(false);
  const { toast } = useToast();

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

  useEffect(() => {
    if (surveyId) {
      fetchSurveyData();
      fetchResponses();
      fetchQuestionsAndAnswers();
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

  const categorizeQuestions = () => {
    const courseQuestions: SurveyQuestion[] = [];
    const instructorQuestions: SurveyQuestion[] = [];

    questions.forEach(question => {
      const questionText = question.question_text.toLowerCase();
      
      // 강사 관련 키워드
      if (questionText.includes('강사') || 
          questionText.includes('지도') || 
          questionText.includes('설명') || 
          questionText.includes('질문응답') ||
          questionText.includes('교수법') ||
          questionText.includes('전달력') ||
          questionText.includes('준비도')) {
        instructorQuestions.push(question);
      } 
      // 과정 관련 키워드
      else if (questionText.includes('과정') || 
               questionText.includes('교육') || 
               questionText.includes('내용') || 
               questionText.includes('커리큘럼') ||
               questionText.includes('시간') ||
               questionText.includes('교재') ||
               questionText.includes('환경') ||
               questionText.includes('시설')) {
        courseQuestions.push(question);
      } else {
        // 기본적으로 과정 만족도로 분류
        courseQuestions.push(question);
      }
    });

    return { courseQuestions, instructorQuestions };
  };

  const getQuestionAnalysis = (questionList: SurveyQuestion[]) => {
    return questionList.map(question => {
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
      } else if (question.question_type === 'rating') {
        const ratings = questionAnswers.map(a => parseInt(a.answer_text)).filter(r => !isNaN(r));
        const average = ratings.length > 0 ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1) : '0';
        
        // 점수별 분포 계산
        const distribution = {};
        for (let i = 1; i <= 5; i++) {
          distribution[i] = ratings.filter(r => r === i).length;
        }
        
        const chartData = Object.entries(distribution).map(([score, count]) => ({
          name: `${score}점`,
          value: count as number,
          percentage: ratings.length > 0 ? Math.round(((count as number) / ratings.length) * 100) : 0
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
    const ratingQuestions = questionList.filter(q => q.question_type === 'rating');
    if (ratingQuestions.length === 0) return 0;

    let totalScore = 0;
    let totalCount = 0;

    ratingQuestions.forEach(question => {
      const questionAnswers = answers.filter(a => a.question_id === question.id);
      const ratings = questionAnswers.map(a => parseInt(a.answer_text)).filter(r => !isNaN(r));
      
      if (ratings.length > 0) {
        totalScore += ratings.reduce((sum, r) => sum + r, 0);
        totalCount += ratings.length;
      }
    });

    return totalCount > 0 ? (totalScore / totalCount).toFixed(1) : '0';
  };

  const handleSendResults = async () => {
    setSendingResults(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-survey-results', {
        body: { surveyId }
      });

      if (error) throw error;

      toast({
        title: "성공",
        description: "설문 결과가 성공적으로 전송되었습니다.",
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

  const { courseQuestions, instructorQuestions } = categorizeQuestions();
  const courseAnalyses = getQuestionAnalysis(courseQuestions);
  const instructorAnalyses = getQuestionAnalysis(instructorQuestions);
  const courseAverage = calculateCategoryAverage(courseQuestions);
  const instructorAverage = calculateCategoryAverage(instructorQuestions);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center relative">
          <Button
            onClick={() => navigate('/survey-results')}
            variant="ghost"
            size="sm"
            className="touch-friendly"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">결과 분석</span>
          </Button>
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <h1 className="text-sm sm:text-lg font-semibold text-primary text-center">상세 분석</h1>
            <p className="text-xs text-muted-foreground break-words text-center">
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
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              엑셀 다운로드
            </Button>
            <Button variant="outline" size="sm">
              <Printer className="h-4 w-4 mr-2" />
              인쇄
            </Button>
          </div>

          {/* 종합 만족도 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  과정 만족도
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-500">{courseAverage}</div>
                  <div className="text-sm text-muted-foreground">평균 점수 (5점 만점)</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {courseQuestions.length}개 질문 기준
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
                  <div className="text-sm text-muted-foreground">평균 점수 (5점 만점)</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {instructorQuestions.length}개 질문 기준
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 상세 분석 탭 */}
          <Tabs defaultValue="course" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="course" className="text-sm touch-friendly">
                과정 만족도 ({courseQuestions.length})
              </TabsTrigger>
              <TabsTrigger value="instructor" className="text-sm touch-friendly">
                강사 만족도 ({instructorQuestions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="course" className="space-y-4">
              {courseAnalyses.length > 0 ? (
                courseAnalyses.map((analysis, index) => (
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
                                  {analysis.chartData.map((entry, idx) => (
                                    <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value, name) => [`${value}개 (${analysis.chartData.find(d => d.name === name)?.percentage}%)`, name]} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {analysis.chartData.map((item, idx) => (
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
                            <p className="text-sm text-muted-foreground">평균 점수 (5점 만점)</p>
                          </div>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <RechartsBarChart data={analysis.chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip formatter={(value, name) => [`${value}개 (${analysis.chartData.find(d => d.name === name)?.percentage}%)`, '응답 수']} />
                                <Bar dataKey="value" fill="#8884d8" />
                              </RechartsBarChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="space-y-2">
                            {analysis.chartData.map((item, idx) => (
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
                            analysis.answers.map((answer, idx) => (
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
                ))
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground">과정 관련 질문이 없습니다.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="instructor" className="space-y-4">
              {instructorAnalyses.length > 0 ? (
                instructorAnalyses.map((analysis, index) => (
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
                                  {analysis.chartData.map((entry, idx) => (
                                    <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value, name) => [`${value}개 (${analysis.chartData.find(d => d.name === name)?.percentage}%)`, name]} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {analysis.chartData.map((item, idx) => (
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
                            <p className="text-sm text-muted-foreground">평균 점수 (5점 만점)</p>
                          </div>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <RechartsBarChart data={analysis.chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip formatter={(value, name) => [`${value}개 (${analysis.chartData.find(d => d.name === name)?.percentage}%)`, '응답 수']} />
                                <Bar dataKey="value" fill="#8884d8" />
                              </RechartsBarChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="space-y-2">
                            {analysis.chartData.map((item, idx) => (
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
                            analysis.answers.map((answer, idx) => (
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
                ))
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground">강사 관련 질문이 없습니다.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default SurveyDetailedAnalysis;