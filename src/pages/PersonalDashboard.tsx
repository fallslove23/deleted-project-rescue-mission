import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, TrendingUp, Users, Award, BarChart3, Download, ArrowLeft } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface Survey {
  id: string;
  title: string;
  education_year: number;
  education_round: number;
  status: string;
  instructor_id: string;
  created_at: string;
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
  response_id: string;
}

interface SurveyQuestion {
  id: string;
  question_text: string;
  question_type: string;
  satisfaction_type: string;
  survey_id: string;
  order_index: number;
}

interface Profile {
  role: string;
  instructor_id: string;
}

const PersonalDashboard = ({ showPageHeader = true }: { showPageHeader?: boolean }) => {
  const navigate = useNavigate();
  const { user, userRoles } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('round');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedRound, setSelectedRound] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const isInstructor = userRoles.includes('instructor');
  const canViewPersonalStats = isInstructor || userRoles.includes('admin');

  useEffect(() => {
    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (profile && canViewPersonalStats) {
      fetchData();
    }
  }, [profile, selectedPeriod, selectedYear, selectedRound, selectedCourse]);

  const fetchProfile = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, instructor_id')
        .eq('id', user.id)
        .maybeSingle();
        
      if (error && error.code !== 'PGRST116') {
        console.error('프로필 조회 오류:', error);
      }
      
      setProfile(data);
    } catch (error) {
      console.error('fetchProfile 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    if (!canViewPersonalStats || !profile) return;

    setLoading(true);
    try {
      // 강사가 아닌 관리자의 경우 전체 데이터 조회
      let surveyQuery = supabase.from('surveys').select('*');
      
      // 강사인 경우 본인 설문만, 관리자인 경우 전체 설문
      if (profile?.instructor_id && isInstructor) {
        surveyQuery = surveyQuery.eq('instructor_id', profile.instructor_id);
      } else if (isInstructor && !profile?.instructor_id) {
        // instructor_id가 없는 강사의 경우 이메일로 매칭 시도
        const { data: instructorData } = await supabase
          .from('instructors')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
          
        if (instructorData) {
          surveyQuery = surveyQuery.eq('instructor_id', instructorData.id);
        }
      }

      // 필터 적용
      if (selectedYear && selectedYear !== 'all') {
        surveyQuery = surveyQuery.eq('education_year', parseInt(selectedYear));
      }
      if (selectedRound && selectedRound !== 'all' && selectedRound !== 'latest') {
        surveyQuery = surveyQuery.eq('education_round', parseInt(selectedRound));
      }
      if (selectedCourse && selectedCourse !== 'all') {
        surveyQuery = surveyQuery.ilike('course_name', `%${selectedCourse}%`);
      }

      const { data: surveysData, error: surveysError } = await surveyQuery
        .order('education_year', { ascending: false })
        .order('education_round', { ascending: false });

      if (surveysError) throw surveysError;
      
      let filteredSurveys = surveysData || [];
      
      // 최신 회차 필터링
      if (selectedRound === 'latest' && filteredSurveys.length > 0) {
        const latestYear = Math.max(...filteredSurveys.map(s => s.education_year));
        const latestYearSurveys = filteredSurveys.filter(s => s.education_year === latestYear);
        const latestRound = Math.max(...latestYearSurveys.map(s => s.education_round));
        filteredSurveys = filteredSurveys.filter(s => 
          s.education_year === latestYear && s.education_round === latestRound
        );
      }

      setSurveys(filteredSurveys);

      // 응답들 가져오기
      if (surveysData && surveysData.length > 0) {
        const allSurveyIds = surveysData.map(s => s.id);
        
        const { data: responsesData, error: responsesError } = await supabase
          .from('survey_responses')
          .select('*')
          .in('survey_id', allSurveyIds);

        if (responsesError) throw responsesError;
        setResponses(responsesData || []);

        // 질문들 가져오기
        const { data: questionsData, error: questionsError } = await supabase
          .from('survey_questions')
          .select('*')
          .in('survey_id', allSurveyIds);

        if (questionsError) throw questionsError;
        setQuestions(questionsData || []);

        // 답변들 가져오기
        if (responsesData && responsesData.length > 0) {
          const responseIds = responsesData.map(r => r.id);
          
          const { data: answersData, error: answersError } = await supabase
            .from('question_answers')
            .select('*')
            .in('response_id', responseIds);

          if (answersError) throw answersError;
          setAnswers(answersData || []);
        } else {
          setAnswers([]);
        }
      } else {
        setResponses([]);
        setQuestions([]);
        setAnswers([]);
      }
    } catch (error) {
      console.error('fetchData 오류:', error);
    } finally {
      setLoading(false);
    }
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
    return rounds.sort((a, b) => a - b);
  };

  const getUniqueCourses = () => {
    let filteredSurveys = surveys;
    if (selectedYear && selectedYear !== 'all') {
      filteredSurveys = surveys.filter(s => s.education_year.toString() === selectedYear);
    }
    
    const courses = filteredSurveys
      .map(survey => {
        if (!survey.course_name) return null;
        const match = survey.course_name.match(/.*?-\s*(.+)$/);
        return match ? match[1].trim() : survey.course_name;
      })
      .filter((course, index, self) => course && self.indexOf(course) === index)
      .sort();
    return courses;
  };

  const getTrendData = () => {
    const ratingQuestions = questions.filter(q => 
      q.question_type === 'rating' || q.question_type === 'scale'
    );
    
    let filteredSurveys = surveys;
    if (selectedYear && selectedYear !== 'all') {
      filteredSurveys = surveys.filter(s => s.education_year.toString() === selectedYear);
    }
    if (selectedRound && selectedRound !== 'all' && selectedRound !== 'latest') {
      filteredSurveys = filteredSurveys.filter(s => s.education_round.toString() === selectedRound);
    }
    if (selectedCourse && selectedCourse !== 'all') {
      filteredSurveys = filteredSurveys.filter(survey => {
        if (!survey.course_name) return false;
        const match = survey.course_name.match(/.*?-\s*(.+)$/);
        const courseType = match ? match[1].trim() : survey.course_name;
        return courseType === selectedCourse;
      });
    }
    
    if (selectedRound === 'latest' && filteredSurveys.length > 0) {
      const latestYear = Math.max(...filteredSurveys.map(s => s.education_year));
      const latestYearSurveys = filteredSurveys.filter(s => s.education_year === latestYear);
      const latestRound = Math.max(...latestYearSurveys.map(s => s.education_round));
      filteredSurveys = filteredSurveys.filter(s => 
        s.education_year === latestYear && s.education_round === latestRound
      );
    }
    
    if (selectedPeriod === 'round') {
      const roundData: Record<string, { total: number; count: number; responses: number }> = {};
      
      filteredSurveys.forEach(survey => {
        const roundKey = `${survey.education_year}-${survey.education_round}차`;
        
        if (!roundData[roundKey]) {
          roundData[roundKey] = { total: 0, count: 0, responses: 0 };
        }
        
        const surveyResponses = responses.filter(r => r.survey_id === survey.id);
        roundData[roundKey].responses += surveyResponses.length;
        
        surveyResponses.forEach(response => {
          const responseAnswers = answers.filter(a => a.response_id === response.id);
          const ratingAnswers = responseAnswers.filter(a => 
            ratingQuestions.some(q => q.id === a.question_id)
          );
          
          ratingAnswers.forEach(answer => {
            const rating = parseFloat(answer.answer_text);
            if (!isNaN(rating) && rating > 0) {
              roundData[roundKey].total += rating;
              roundData[roundKey].count++;
            }
          });
        });
      });

      return Object.entries(roundData)
        .map(([round, data]) => ({
          period: round,
          average: data.count > 0 ? (data.total / data.count) : 0,
          responses: data.responses,
          satisfaction: data.count > 0 ? Math.round((data.total / data.count) * 10) : 0
        }))
        .sort((a, b) => a.period.localeCompare(b.period));
    }
    
    return [];
  };

  const getSummaryStats = () => {
    let filteredSurveys = surveys;
    if (selectedYear && selectedYear !== 'all') {
      filteredSurveys = surveys.filter(s => s.education_year.toString() === selectedYear);
    }
    if (selectedRound && selectedRound !== 'all' && selectedRound !== 'latest') {
      filteredSurveys = filteredSurveys.filter(s => s.education_round.toString() === selectedRound);
    }
    if (selectedCourse && selectedCourse !== 'all') {
      filteredSurveys = filteredSurveys.filter(s => s.course_name === selectedCourse);
    }
    
    if (selectedRound === 'latest' && filteredSurveys.length > 0) {
      const latestYear = Math.max(...filteredSurveys.map(s => s.education_year));
      const latestYearSurveys = filteredSurveys.filter(s => s.education_year === latestYear);
      const latestRound = Math.max(...latestYearSurveys.map(s => s.education_round));
      filteredSurveys = filteredSurveys.filter(s => 
        s.education_year === latestYear && s.education_round === latestRound
      );
    }
    
    const totalSurveys = filteredSurveys.length;
    const filteredResponses = responses.filter(r => 
      filteredSurveys.some(s => s.id === r.survey_id)
    );
    const totalResponses = filteredResponses.length;
    const activeSurveys = filteredSurveys.filter(s => s.status === 'active').length;
    
    const ratingQuestions = questions.filter(q => 
      q.question_type === 'rating' || q.question_type === 'scale'
    );
    const ratingAnswers = answers.filter(a => 
      ratingQuestions.some(q => q.id === a.question_id) &&
      filteredResponses.some(r => r.id === a.response_id)
    );
    
    const validRatings = ratingAnswers
      .map(a => parseFloat(a.answer_text))
      .filter(r => !isNaN(r) && r > 0);
    
    const avgSatisfaction = validRatings.length > 0 
      ? validRatings.reduce((sum, r) => sum + r, 0) / validRatings.length 
      : 0;

    return {
      totalSurveys,
      totalResponses,
      activeSurveys,
      avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
      satisfactionPercentage: Math.round(avgSatisfaction * 10),
      avgResponsesPerSurvey: totalSurveys > 0 ? Math.round(totalResponses / totalSurveys) : 0
    };
  };

  const getRatingDistribution = () => {
    const ratingQuestions = questions.filter(q => 
      q.question_type === 'rating' || q.question_type === 'scale'
    );
    const ratingAnswers = answers.filter(a => 
      ratingQuestions.some(q => q.id === a.question_id)
    );
    
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    ratingAnswers.forEach(answer => {
      const rating = parseInt(answer.answer_text);
      if (rating >= 1 && rating <= 5) {
        distribution[rating as keyof typeof distribution]++;
      }
    });

    return Object.entries(distribution).map(([rating, count]) => ({
      name: `${rating}점`,
      value: count,
      percentage: ratingAnswers.length > 0 ? Math.round((count / ratingAnswers.length) * 100) : 0
    }));
  };

  const generatePersonalStatsCSV = () => {
    let csvContent = '\uFEFF';
    
    const stats = getSummaryStats();
    const trendData = getTrendData();
    
    csvContent += '개인 통계 요약\n';
    csvContent += `총 설문,${stats.totalSurveys}\n`;
    csvContent += `총 응답,${stats.totalResponses}\n`;
    csvContent += `활성 설문,${stats.activeSurveys}\n`;
    csvContent += `평균 만족도,${stats.avgSatisfaction}\n`;
    csvContent += `만족도 백분율,${stats.satisfactionPercentage}%\n`;
    csvContent += `설문당 평균 응답,${stats.avgResponsesPerSurvey}\n\n`;
    
    csvContent += '기간별 트렌드\n';
    csvContent += '기간,평균 만족도,응답 수,만족도(%)\n';
    trendData.forEach(item => {
      csvContent += `${item.period},${item.average.toFixed(1)},${item.responses},${item.satisfaction}%\n`;
    });
    
    return csvContent;
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        {showPageHeader && (
          <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
            <div className="container mx-auto px-4 py-3 flex items-center">
              <Button
                onClick={() => navigate('/dashboard')}
                variant="ghost"
                size="sm"
                className="mr-3 touch-friendly"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                대시보드
              </Button>
              <div className="text-center flex-1">
                <h1 className="text-lg font-semibold text-primary">나의 만족도 통계</h1>
                <p className="text-sm text-muted-foreground">개인 강의 만족도 및 피드백 분석</p>
              </div>
            </div>
          </header>
        )}
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p>데이터를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!canViewPersonalStats) {
    return (
      <div className="min-h-screen bg-background">
        {showPageHeader && (
          <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
            <div className="container mx-auto px-4 py-3 flex items-center">
              <Button
                onClick={() => navigate('/dashboard')}
                variant="ghost"
                size="sm"
                className="mr-3 touch-friendly"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                대시보드
              </Button>
              <div className="text-center flex-1">
                <h1 className="text-lg font-semibold text-primary">나의 만족도 통계</h1>
                <p className="text-sm text-muted-foreground">개인 강의 만족도 및 피드백 분석</p>
              </div>
            </div>
          </header>
        )}
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">개인 통계를 조회할 권한이 없습니다.</p>
          </div>
        </div>
      </div>
    );
  }

  const trendData = getTrendData();
  const summaryStats = getSummaryStats();
  const ratingDistribution = getRatingDistribution();
  const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];

  if (surveys.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        {showPageHeader && (
          <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
            <div className="container mx-auto px-4 py-3 flex items-center">
              <Button
                onClick={() => navigate('/dashboard')}
                variant="ghost"
                size="sm"
                className="mr-3 touch-friendly"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                대시보드
              </Button>
              <div className="text-center flex-1">
                <h1 className="text-lg font-semibold text-primary">나의 만족도 통계</h1>
                <p className="text-sm text-muted-foreground">개인 강의 만족도 및 피드백 분석</p>
              </div>
            </div>
          </header>
        )}
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">표시할 설문 데이터가 없습니다.</p>
            <p className="text-sm text-muted-foreground mt-2">
              {isInstructor ? "아직 생성된 설문이 없거나 권한이 없습니다." : "설문 데이터를 확인해주세요."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {showPageHeader && (
        <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
          <div className="container mx-auto px-4 py-3 flex items-center">
            <Button
              onClick={() => navigate('/dashboard')}
              variant="ghost"
              size="sm"
              className="mr-3 touch-friendly"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              대시보드
            </Button>
            <div className="text-center flex-1">
              <h1 className="text-lg font-semibold text-primary">나의 만족도 통계</h1>
              <p className="text-sm text-muted-foreground">개인 강의 만족도 및 피드백 분석</p>
            </div>
          </div>
        </header>
      )}

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* 통계 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardContent className="flex flex-col items-center text-center p-3 md:p-4 aspect-square">
              <div className="p-2 bg-primary/10 rounded-lg mb-2">
                <BarChart3 className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
              <p className="text-xs font-medium text-muted-foreground mb-1">총 설문</p>
              <p className="text-lg md:text-xl font-bold">{summaryStats.totalSurveys}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col items-center text-center p-3 md:p-4 aspect-square">
              <div className="p-2 bg-blue-500/10 rounded-lg mb-2">
                <Users className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
              </div>
              <p className="text-xs font-medium text-muted-foreground mb-1">총 응답</p>
              <p className="text-lg md:text-xl font-bold">{summaryStats.totalResponses}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col items-center text-center p-3 md:p-4 aspect-square">
              <div className="p-2 bg-green-500/10 rounded-lg mb-2">
                <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
              </div>
              <p className="text-xs font-medium text-muted-foreground mb-1">평균 만족도</p>
              <div className="flex flex-col items-center space-y-1">
                <p className="text-lg md:text-xl font-bold">{summaryStats.avgSatisfaction}</p>
                <Badge variant={summaryStats.avgSatisfaction >= 4 ? "default" : summaryStats.avgSatisfaction >= 3 ? "secondary" : "destructive"} className="text-xs">
                  {summaryStats.satisfactionPercentage}%
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col items-center text-center p-3 md:p-4 aspect-square">
              <div className="p-2 bg-orange-500/10 rounded-lg mb-2">
                <Award className="h-4 w-4 md:h-5 md:w-5 text-orange-500" />
              </div>
              <p className="text-xs font-medium text-muted-foreground mb-1">활성 설문</p>
              <p className="text-lg md:text-xl font-bold">{summaryStats.activeSurveys}</p>
            </CardContent>
          </Card>
        </div>

        {/* 액션 버튼들 */}
        <div className="flex gap-2 mb-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              const element = document.createElement('a');
              const csvContent = generatePersonalStatsCSV();
              const file = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
              element.href = URL.createObjectURL(file);
              element.download = `개인통계_${new Date().toISOString().slice(0, 10)}.csv`;
              document.body.appendChild(element);
              element.click();
              document.body.removeChild(element);
              toast({
                title: "다운로드 완료",
                description: "개인 통계 CSV 파일이 다운로드되었습니다."
              });
            }}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            CSV 다운로드
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handlePrint}
            className="gap-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a1 1 0 001-1v-4a1 1 0 00-1-1H9a1 1 0 00-1 1v4a1 1 0 001 1zm3-5h2m-2-2h2m-2-2h2" />
            </svg>
            인쇄
          </Button>
        </div>

        {/* 필터 컨트롤 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">연도</label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {getUniqueYears().map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}년</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">과정</label>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {getUniqueCourses().map(course => (
                  <SelectItem key={course} value={course}>{course}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">차수</label>
            <Select value={selectedRound} onValueChange={setSelectedRound}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {selectedPeriod === 'round' && <SelectItem value="latest">최신</SelectItem>}
                {getUniqueRounds().map(round => (
                  <SelectItem key={round} value={round.toString()}>{round}차</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 트렌드 분석 */}
        <Tabs defaultValue="trend" className="space-y-4">
          <TabsList>
            <TabsTrigger value="trend">만족도 트렌드</TabsTrigger>
            <TabsTrigger value="distribution">평점 분포</TabsTrigger>
            <TabsTrigger value="insights">인사이트</TabsTrigger>
          </TabsList>

          <TabsContent value="trend" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  만족도 변화 추이
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis domain={[0, 10]} />
                      <Tooltip 
                        formatter={(value: any, name: string) => [
                          name === 'average' ? `${Number(value).toFixed(1)}점` : value,
                          name === 'average' ? '평균 만족도' : name === 'responses' ? '응답 수' : name
                        ]}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="average" 
                        stroke="#8884d8" 
                        strokeWidth={3}
                        dot={{ r: 6 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="responses" 
                        stroke="#82ca9d" 
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="distribution" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>평점 분포</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={ratingDistribution}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, percentage }) => `${name}: ${percentage}%`}
                        >
                          {ratingDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>평점별 상세</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ratingDistribution.map((item, index) => (
                    <div key={item.name} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{item.name}</span>
                        <span>{item.value}개 ({item.percentage}%)</span>
                      </div>
                      <Progress value={item.percentage} className="h-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5" />
                    최근 성과
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">설문당 평균 응답</span>
                    <span className="font-medium">{summaryStats.avgResponsesPerSurvey}개</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">만족도 수준</span>
                    <Badge variant={summaryStats.avgSatisfaction >= 4 ? "default" : summaryStats.avgSatisfaction >= 3 ? "secondary" : "destructive"}>
                      {summaryStats.avgSatisfaction >= 4 ? '우수' : summaryStats.avgSatisfaction >= 3 ? '보통' : '개선필요'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">응답률 트렌드</span>
                    <span className="font-medium">
                      {trendData.length >= 2 && trendData[trendData.length - 1].responses > trendData[trendData.length - 2].responses ? '📈 증가' : '📉 감소'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>개선 제안</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    {summaryStats.avgSatisfaction < 3 && (
                      <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                        <p className="text-red-700 dark:text-red-300">
                          🔴 만족도가 낮습니다. 수업 방식 개선이 필요합니다.
                        </p>
                      </div>
                    )}
                    {summaryStats.avgResponsesPerSurvey < 5 && (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                        <p className="text-yellow-700 dark:text-yellow-300">
                          🟡 응답률이 낮습니다. 설문 참여 독려가 필요합니다.
                        </p>
                      </div>
                    )}
                    {summaryStats.avgSatisfaction >= 4 && (
                      <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                        <p className="text-green-700 dark:text-green-300">
                          🟢 높은 만족도를 유지하고 있습니다. 지속적인 관리가 필요합니다.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default PersonalDashboard;