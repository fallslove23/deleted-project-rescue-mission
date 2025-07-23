import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, FileText, TrendingUp, Users, ArrowLeft, Download, Printer, Mail } from 'lucide-react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Tooltip, Legend } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import InstructorIndividualStats from '@/components/InstructorIndividualStats';

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

interface Instructor {
  id: string;
  name: string;
  email: string;
  photo_url: string;
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
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [allInstructors, setAllInstructors] = useState<Instructor[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<string>('');
  const [selectedInstructor, setSelectedInstructor] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedRound, setSelectedRound] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [sendingResults, setSendingResults] = useState(false);
  const { toast } = useToast();

  // 사용자 권한 확인
  const isAdmin = profile?.role === 'admin';
  const isManager = profile?.role === 'manager';
  const isDirector = profile?.role === 'director';
  const isTeamLeader = profile?.role === 'team_leader';
  const isInstructor = profile?.role === 'instructor';
  const canViewAll = isAdmin || isManager || isDirector || isTeamLeader;

  useEffect(() => {
    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (profile) {
      fetchSurveys();
      if (canViewAll) {
        fetchAllInstructors();
      }
      if (profile.instructor_id) {
        fetchInstructorInfo();
      }
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

  const fetchInstructorInfo = async () => {
    if (!profile?.instructor_id) return;
    
    try {
      const { data, error } = await supabase
        .from('instructors')
        .select('id, name, email, photo_url')
        .eq('id', profile.instructor_id)
        .single();
        
      if (error) throw error;
      setInstructor(data);
    } catch (error) {
      console.error('Error fetching instructor info:', error);
    }
  };

  const fetchAllInstructors = async () => {
    try {
      const { data, error } = await supabase
        .from('instructors')
        .select('id, name, email, photo_url')
        .order('name');
        
      if (error) throw error;
      setAllInstructors(data || []);
    } catch (error) {
      console.error('Error fetching all instructors:', error);
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
    if (canViewAll && selectedInstructor !== 'all') {
      filtered = filtered.filter(s => s.instructor_id === selectedInstructor);
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

  const handleSendResults = async () => {
    if (!selectedSurvey) {
      toast({
        title: "오류",
        description: "결과를 전송할 설문을 선택해주세요.",
        variant: "destructive"
      });
      return;
    }

    setSendingResults(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-survey-results', {
        body: { surveyId: selectedSurvey }
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

  const stats = getStatistics();

  return (
    <div className="min-h-screen bg-background">
      {/* Header with back button */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            size="sm"
            className="mr-3 touch-friendly"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">대시보드</span>
            <span className="sm:hidden">대시보드</span>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm sm:text-lg font-semibold text-primary break-words">설문 결과 분석</h1>
            <p className="text-xs text-muted-foreground break-words hyphens-auto">
              {canViewAll ? '전체 설문조사 결과를 확인할 수 있습니다' : 
               instructor ? `${instructor.name} 강사의 설문조사 결과를 확인할 수 있습니다` : 
               '담당 강의의 설문조사 결과를 확인할 수 있습니다'}
            </p>
            {isInstructor && instructor && (
              <div className="flex items-center gap-2 mt-2">
                {instructor.photo_url && (
                  <img 
                    src={instructor.photo_url} 
                    alt={instructor.name}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                )}
                <span className="text-sm text-muted-foreground break-words truncate">
                  강사: {instructor.name} ({instructor.email})
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* 필터 */}
          <div className="flex gap-2 sm:gap-4 flex-wrap">
            <Select value={selectedYear} onValueChange={(value) => {
              setSelectedYear(value);
              setSelectedRound(''); // Reset round when year changes
            }}>
              <SelectTrigger className="w-24 sm:w-32 touch-friendly">
                <SelectValue placeholder="전체 연도" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {getUniqueYears().map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}년</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedRound} onValueChange={setSelectedRound}>
              <SelectTrigger className="w-24 sm:w-32 touch-friendly">
                <SelectValue placeholder="전체 차수" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {getUniqueRounds().map(round => (
                  <SelectItem key={round} value={round.toString()}>{round}차</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {canViewAll && (
              <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
                <SelectTrigger className="w-32 sm:w-48 touch-friendly">
                  <SelectValue placeholder="전체 강사" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="all">전체 강사</SelectItem>
                  {allInstructors.map(inst => (
                    <SelectItem key={inst.id} value={inst.id} className="break-words">
                      {inst.name} {inst.email && `(${inst.email})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {(selectedYear || selectedRound || (canViewAll && selectedInstructor !== 'all')) && (
              <Button 
                variant="outline" 
                className="touch-friendly text-sm"
                onClick={() => {
                  setSelectedYear('');
                  setSelectedRound('');
                  setSelectedInstructor('all');
                }}
              >
                <span className="break-words">필터 초기화</span>
              </Button>
            )}
          </div>

          {/* 요약 통계 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-3">
              <div className="text-center">
                <div className="text-lg sm:text-xl font-bold text-primary">{stats.totalSurveys}</div>
                <div className="text-xs text-muted-foreground">설문조사</div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-center">
                <div className="text-lg sm:text-xl font-bold text-primary">{stats.totalResponses}</div>
                <div className="text-xs text-muted-foreground">응답</div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-center">
                <div className="text-lg sm:text-xl font-bold text-primary">{stats.avgResponseRate}</div>
                <div className="text-xs text-muted-foreground">평균응답</div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-center">
                <div className="text-lg sm:text-xl font-bold text-primary">{stats.activeSurveys}</div>
                <div className="text-xs text-muted-foreground">진행중</div>
              </div>
            </Card>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3">
          <TabsTrigger value="overview" className="text-sm touch-friendly">개요</TabsTrigger>
          <TabsTrigger value="detailed" className="text-sm touch-friendly">상세 분석</TabsTrigger>
          {canViewAll && <TabsTrigger value="individual" className="text-sm touch-friendly">개별 통계</TabsTrigger>}
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
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium break-words">{survey.title}</h4>
                        <p className="text-sm text-muted-foreground break-words">
                          {survey.education_year}년 {survey.education_round}차
                        </p>
                      </div>
                      <Badge variant={survey.status === 'active' ? 'default' : 'secondary'} className="text-xs flex-shrink-0">
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

        {canViewAll && (
          <TabsContent value="individual" className="space-y-4">
            <InstructorIndividualStats 
              allInstructors={allInstructors}
              getFilteredSurveys={getFilteredSurveys}
              setSelectedSurvey={setSelectedSurvey}
              selectedSurvey={selectedSurvey}
              answers={answers}
              questions={questions}
            />
          </TabsContent>
        )}
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default SurveyResults;