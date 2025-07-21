import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, FileText, TrendingUp, Users, ArrowLeft, Download, Printer } from 'lucide-react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Tooltip, Legend } from 'recharts';
import { Progress } from '@/components/ui/progress';

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

interface Profile {
  role: string;
  instructor_id: string;
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
}

const SurveyResults = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedRound, setSelectedRound] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (profile) {
      fetchSurveys();
    }
  }, [profile]);

  useEffect(() => {
    if (selectedSurvey) {
      fetchResponses();
      fetchQuestionsAndAnswers();
    }
  }, [selectedSurvey]);

  const fetchQuestionsAndAnswers = async () => {
    if (!selectedSurvey) return;
    
    try {
      // 설문 질문들 가져오기
      const { data: questionsData, error: questionsError } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', selectedSurvey)
        .order('order_index');
      
      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

      // 해당 설문의 모든 응답 ID들 가져오기
      const { data: responseIds, error: responseError } = await supabase
        .from('survey_responses')
        .select('id')
        .eq('survey_id', selectedSurvey);
      
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

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, instructor_id')
        .eq('id', user.id)
        .single();
        
      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchSurveys = async () => {
    try {
      let query = supabase.from('surveys').select('*');
      
      // 강사인 경우 자신의 강의 설문만 조회
      if (profile?.role === 'instructor' && profile.instructor_id) {
        query = query.eq('instructor_id', profile.instructor_id);
      }
      
      const { data, error } = await query.order('education_year', { ascending: false })
                                      .order('education_round', { ascending: false });
      
      if (error) throw error;
      setSurveys(data || []);
    } catch (error) {
      console.error('Error fetching surveys:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchResponses = async () => {
    if (!selectedSurvey) return;
    
    try {
      const { data, error } = await supabase
        .from('survey_responses')
        .select('*')
        .eq('survey_id', selectedSurvey)
        .order('submitted_at', { ascending: false });
      
      if (error) throw error;
      setResponses(data || []);
    } catch (error) {
      console.error('Error fetching responses:', error);
    }
  };

  const getUniqueYears = () => {
    const years = [...new Set(surveys.map(s => s.education_year))];
    return years.sort((a, b) => b - a);
  };

  const getUniqueRounds = () => {
    let filteredSurveys = surveys;
    if (selectedYear && selectedYear !== '') {
      filteredSurveys = surveys.filter(s => s.education_year.toString() === selectedYear);
    }
    const rounds = [...new Set(filteredSurveys.map(s => s.education_round))];
    return rounds.sort((a, b) => b - a);
  };

  const getFilteredSurveys = () => {
    let filtered = surveys;
    if (selectedYear && selectedYear !== '') {
      filtered = filtered.filter(s => s.education_year.toString() === selectedYear);
    }
    if (selectedRound && selectedRound !== '') {
      filtered = filtered.filter(s => s.education_round.toString() === selectedRound);
    }
    return filtered;
  };

  const getStatistics = () => {
    const totalSurveys = getFilteredSurveys().length;
    const totalResponses = responses.length;
    const activeSurveys = getFilteredSurveys().filter(s => s.status === 'active').length;
    
    return {
      totalSurveys,
      totalResponses,
      activeSurveys,
      avgResponseRate: totalSurveys > 0 ? Math.round((totalResponses / totalSurveys) * 100) / 100 : 0
    };
  };

  // 질문별 분석 데이터 생성
  const getQuestionAnalysis = () => {
    return questions.map(question => {
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

  const questionAnalyses = selectedSurvey ? getQuestionAnalysis() : [];
  
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div>로딩중...</div>
      </div>
    );
  }

  const stats = getStatistics();
  const isAdmin = profile?.role === 'admin';
  const isInstructor = profile?.role === 'instructor';

  return (
    <div className="min-h-screen bg-background">
      {/* Header with back button */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            size="sm"
            className="mr-3"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            대시보드
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-primary">설문 결과 분석</h1>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? '전체 설문조사 결과를 확인할 수 있습니다' : '담당 강의의 설문조사 결과를 확인할 수 있습니다'}
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* 필터 */}
      <div className="flex gap-4">
        <Select value={selectedYear} onValueChange={(value) => {
          setSelectedYear(value);
          setSelectedRound(''); // Reset round when year changes
        }}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="전체 연도" />
          </SelectTrigger>
          <SelectContent>
            {getUniqueYears().map(year => (
              <SelectItem key={year} value={year.toString()}>{year}년</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedRound} onValueChange={setSelectedRound}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="전체 차수" />
          </SelectTrigger>
          <SelectContent>
            {getUniqueRounds().map(round => (
              <SelectItem key={round} value={round.toString()}>{round}차</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(selectedYear || selectedRound) && (
          <Button 
            variant="outline" 
            onClick={() => {
              setSelectedYear('');
              setSelectedRound('');
            }}
          >
            필터 초기화
          </Button>
        )}
          </div>

          {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 설문조사</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSurveys}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">진행중인 설문</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSurveys}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 응답수</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalResponses}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 응답률</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgResponseRate}</div>
          </CardContent>
        </Card>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">개요</TabsTrigger>
          <TabsTrigger value="detailed">상세 분석</TabsTrigger>
          {isAdmin && <TabsTrigger value="individual">개별 통계</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>설문조사 목록</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getFilteredSurveys().map((survey) => (
                  <div
                    key={survey.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedSurvey === survey.id ? 'bg-muted border-primary' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedSurvey(survey.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-medium">{survey.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {survey.education_year}년 {survey.education_round}차
                        </p>
                      </div>
                      <Badge variant={survey.status === 'active' ? 'default' : 'secondary'}>
                        {survey.status === 'active' ? '진행중' : survey.status === 'completed' ? '완료' : '초안'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {selectedSurvey && (
            <Card>
              <CardHeader>
                <CardTitle>응답 현황</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p>총 응답 수: {responses.length}개</p>
                  <p>최근 응답: {responses.length > 0 ? new Date(responses[0].submitted_at).toLocaleString() : '없음'}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="detailed" className="space-y-4">
          {!selectedSurvey ? (
            <Card>
              <CardHeader>
                <CardTitle>상세 분석</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center">
                  분석할 설문조사를 선택해주세요.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* 액션 버튼들 */}
              <div className="flex gap-2 mb-4">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  엑셀 다운로드
                </Button>
                <Button variant="outline" size="sm">
                  <Printer className="h-4 w-4 mr-2" />
                  인쇄
                </Button>
              </div>

              {/* 질문별 분석 */}
              {questionAnalyses.map((analysis, index) => (
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
              ))}

              {questionAnalyses.length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground">
                      선택한 설문조사에 질문이 없거나 응답이 없습니다.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="individual" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>개별 통계</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  강사별/과정별 개별 통계가 여기에 표시됩니다.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default SurveyResults;