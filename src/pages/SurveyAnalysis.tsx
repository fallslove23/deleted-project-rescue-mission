import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Download, Printer, Mail, Share2, BarChart3, Users, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface Survey {
  id: string;
  title: string;
  education_year: number;
  education_round: number;
  status: string;
  instructor_id: string;
  description: string;
  created_at: string;
}

interface SurveyResponse {
  id: string;
  survey_id: string;
  submitted_at: string;
  respondent_email: string;
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
  response_id: string;
}

interface SurveyQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options: any;
  is_required: boolean;
  survey_id: string;
  order_index: number;
  satisfaction_type: string;
}

interface Profile {
  role: string;
  instructor_id: string;
}

const SurveyAnalysis = () => {
  const { user, userRoles } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [allInstructors, setAllInstructors] = useState<Instructor[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<string>('none');
  const [selectedInstructor, setSelectedInstructor] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedRound, setSelectedRound] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [sendingResults, setSendingResults] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const { toast } = useToast();

  const isAdmin = userRoles.includes('admin');
  const isOperator = userRoles.includes('operator');
  const isDirector = userRoles.includes('director');
  const isInstructor = userRoles.includes('instructor');
  const canViewAll = isAdmin || isOperator || isDirector;

  useEffect(() => {
    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (profile) {
      fetchSurveys();
      if (canViewAll) {
        fetchAllInstructors();
      }
    }
  }, [profile]);

  useEffect(() => {
    if (selectedSurvey && selectedSurvey !== 'none') {
      fetchResponses();
      fetchQuestionsAndAnswers();
    }
  }, [selectedSurvey]);

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, instructor_id')
        .eq('id', user.id)
        .maybeSingle();
        
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
      }
      
      setProfile(data);
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    } finally {
      setLoading(false);
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
      
      if (isInstructor && profile?.instructor_id && !canViewAll) {
        query = query.eq('instructor_id', profile.instructor_id);
      }
      
      const { data, error } = await query.order('education_year', { ascending: false })
                                      .order('education_round', { ascending: false });
      
      if (error) throw error;
      setSurveys(data || []);
    } catch (error) {
      console.error('Error fetching surveys:', error);
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

  const fetchQuestionsAndAnswers = async () => {
    if (!selectedSurvey) return;
    
    try {
      const { data: questionsData, error: questionsError } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', selectedSurvey)
        .order('order_index');
      
      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

      const { data: responseIds, error: responseError } = await supabase
        .from('survey_responses')
        .select('id')
        .eq('survey_id', selectedSurvey);
      
      if (responseError) throw responseError;
      
      if (responseIds && responseIds.length > 0) {
        const ids = responseIds.map(r => r.id);
        
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

  const getFilteredSurveys = () => {
    let filtered = surveys;
    if (selectedYear && selectedYear !== 'all') {
      filtered = filtered.filter(s => s.education_year.toString() === selectedYear);
    }
    if (selectedRound && selectedRound !== 'all') {
      filtered = filtered.filter(s => s.education_round.toString() === selectedRound);
    }
    if (canViewAll && selectedInstructor !== 'all') {
      filtered = filtered.filter(s => s.instructor_id === selectedInstructor);
    }
    return filtered;
  };

  const getUniqueYears = () => {
    const years = [...new Set(surveys.map(s => s.education_year))];
    return years.sort((a, b) => b - a);
  };

  const getUniqueRounds = () => {
    let filteredSurveys = surveys;
    if (selectedYear && selectedYear !== 'all') {
      filteredSurveys = surveys.filter(s => s.education_year.toString() === selectedYear);
    }
    const rounds = [...new Set(filteredSurveys.map(s => s.education_round))];
    return rounds.sort((a, b) => b - a);
  };

  const getQuestionAnalysis = () => {
    const sortedQuestions = [...questions].sort((a, b) => a.order_index - b.order_index);
    return sortedQuestions.map(question => {
      const questionAnswers = answers.filter(a => a.question_id === question.id);
      
      if (question.question_type === 'multiple_choice' || question.question_type === 'single_choice') {
        const options = question.options || [];
        const answerCounts: Record<string, number> = {};
        
        options.forEach((option: string) => {
          answerCounts[option] = 0;
        });
        
        questionAnswers.forEach(answer => {
          if (answer.answer_text && Object.prototype.hasOwnProperty.call(answerCounts, answer.answer_text)) {
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
          type: 'chart' as const
        };
      } else if (question.question_type === 'rating') {
        const ratings = questionAnswers.map(a => parseInt(a.answer_text)).filter(r => !isNaN(r));
        const average = ratings.length > 0 ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1) : '0';
        
        const distribution: Record<number, number> = {};
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
          type: 'rating' as const
        };
      } else {
        return {
          question,
          totalAnswers: questionAnswers.length,
          answers: questionAnswers.slice(0, 10),
          type: 'text' as const
        };
      }
    });
  };

  const handleSendResults = async () => {
    if (!selectedSurvey) {
      toast({
        title: "오류",
        description: "결과를 전송할 설문을 선택해주세요.",
        variant: "destructive"
      });
      return;
    }

    if (selectedRecipients.length === 0) {
      toast({
        title: "오류",
        description: "발송할 수신자를 선택해주세요.",
        variant: "destructive"
      });
      return;
    }

    setSendingResults(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-survey-results', {
        body: { 
          surveyId: selectedSurvey,
          recipients: selectedRecipients
        }
      });

      if (error) throw error;

      toast({
        title: "✅ 이메일 전송 완료!",
        description: `${selectedRecipients.length}명에게 설문 결과가 성공적으로 전송되었습니다.`,
      });

      setEmailDialogOpen(false);
      setSelectedRecipients([]);
    } catch (error) {
      console.error('Error sending results:', error);
      toast({
        title: "오류",
        description: "결과 전송 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setSendingResults(false);
    }
  };

  const selectedSurveyData = surveys.find(s => s.id === selectedSurvey);
  const questionAnalyses = selectedSurvey && selectedSurvey !== 'none' ? getQuestionAnalysis() : [];
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

  if (loading) {
    return <div className="flex items-center justify-center h-64">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">설문 결과 분석</h1>
          {selectedSurvey && !isInstructor && (
            <div className="flex gap-2">
              <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Mail className="h-4 w-4 mr-2" />
                    결과 공유
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>설문 결과 이메일 전송</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      선택한 설문의 결과를 이메일로 전송합니다.
                    </p>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">수신자 선택</label>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {allInstructors.map(instructor => (
                          <div key={instructor.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`instructor-${instructor.id}`}
                              checked={selectedRecipients.includes(instructor.email)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedRecipients([...selectedRecipients, instructor.email]);
                                } else {
                                  setSelectedRecipients(selectedRecipients.filter(email => email !== instructor.email));
                                }
                              }}
                            />
                            <label
                              htmlFor={`instructor-${instructor.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                            >
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={instructor.photo_url} alt={instructor.name} />
                                <AvatarFallback>{instructor.name[0]}</AvatarFallback>
                              </Avatar>
                              {instructor.name} ({instructor.email})
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
                        취소
                      </Button>
                      <Button onClick={handleSendResults} disabled={sendingResults}>
                        {sendingResults ? "전송 중..." : "전송"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                다운로드
              </Button>
            </div>
          )}
        </div>

        {/* 필터 */}
        <div className="flex flex-wrap gap-4">
          {canViewAll && (
            <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="강사 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 강사</SelectItem>
                {allInstructors.map(instructor => (
                  <SelectItem key={instructor.id} value={instructor.id}>
                    {instructor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="전체 연도" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
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
              <SelectItem value="all">전체</SelectItem>
              {getUniqueRounds().map(round => (
                <SelectItem key={round} value={round.toString()}>{round}차</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 설문 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            설문 선택
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getFilteredSurveys().map(survey => (
              <Card 
                key={survey.id} 
                className={`cursor-pointer transition-colors ${
                  selectedSurvey === survey.id ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
                }`}
                onClick={() => setSelectedSurvey(survey.id)}
              >
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant={survey.status === 'active' ? 'default' : 'secondary'}>
                        {survey.status === 'active' ? '활성' : survey.status === 'completed' ? '완료' : '대기'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {survey.education_year}년 {survey.education_round}차
                      </span>
                    </div>
                    <h3 className="font-medium line-clamp-2">{survey.title}</h3>
                    {survey.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {survey.description}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 선택된 설문 분석 */}
      {selectedSurvey && selectedSurveyData && (
        <div className="space-y-6">
          {/* 설문 정보 */}
          <Card>
            <CardHeader>
              <CardTitle>{selectedSurveyData.title}</CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{selectedSurveyData.education_year}년 {selectedSurveyData.education_round}차</span>
                <Badge variant={selectedSurveyData.status === 'active' ? 'default' : 'secondary'}>
                  {selectedSurveyData.status === 'active' ? '활성' : selectedSurveyData.status === 'completed' ? '완료' : '대기'}
                </Badge>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {responses.length}명 응답
                </span>
              </div>
            </CardHeader>
          </Card>

          {/* 질문별 분석 */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">개요</TabsTrigger>
              <TabsTrigger value="questions">질문별 분석</TabsTrigger>
              <TabsTrigger value="responses">개별 응답</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="flex items-center p-6">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Users className="h-6 w-6 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">총 응답</p>
                        <p className="text-2xl font-bold">{responses.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="flex items-center p-6">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <BarChart3 className="h-6 w-6 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">질문 수</p>
                        <p className="text-2xl font-bold">{questions.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="flex items-center p-6">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-orange-500/10 rounded-lg">
                        <TrendingUp className="h-6 w-6 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">응답률</p>
                        <p className="text-2xl font-bold">
                          {questions.length > 0 ? Math.round((answers.length / (questions.length * responses.length)) * 100) : 0}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="questions" className="space-y-6">
              {questionAnalyses.map((analysis, index) => (
                <Card key={analysis.question.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Q{index + 1}. {analysis.question.question_text}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{analysis.question.question_type}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {analysis.totalAnswers}개 응답
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {analysis.type === 'chart' && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analysis.chartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip />
                              <Bar dataKey="value" fill="#8884d8" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-2">
                          {analysis.chartData.map((item, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>{item.name}</span>
                                <span>{item.value}개 ({item.percentage}%)</span>
                              </div>
                              <Progress value={item.percentage} className="h-2" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysis.type === 'rating' && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="text-center">
                          <div className="text-4xl font-bold text-primary mb-2">
                            {analysis.average}/5
                          </div>
                          <p className="text-muted-foreground">평균 평점</p>
                        </div>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={analysis.chartData}
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                dataKey="value"
                                label={({ name, percentage }) => `${name}: ${percentage}%`}
                              >
                                {analysis.chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {analysis.type === 'text' && (
                      <div className="space-y-2">
                        <p className="font-medium">최근 응답 ({Math.min(analysis.answers.length, 10)}개)</p>
                        <div className="space-y-2">
                          {analysis.answers.map((answer, idx) => (
                            <div key={idx} className="p-3 bg-muted/50 rounded-lg">
                              <p className="text-sm">{answer.answer_text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="responses" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>개별 응답 목록</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {responses.map((response, index) => (
                      <Card key={response.id}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">응답 #{index + 1}</h4>
                            <span className="text-sm text-muted-foreground">
                              {new Date(response.submitted_at).toLocaleDateString('ko-KR')}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {questions.map(question => {
                              const answer = answers.find(a => 
                                a.response_id === response.id && a.question_id === question.id
                              );
                              return (
                                <div key={question.id} className="border-l-2 border-muted pl-4">
                                  <p className="font-medium text-sm">{question.question_text}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {answer?.answer_text || '답변 없음'}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default SurveyAnalysis;