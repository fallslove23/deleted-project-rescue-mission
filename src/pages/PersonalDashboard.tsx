import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, TrendingUp, Users, Award, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Progress } from '@/components/ui/progress';
import SurveyStatsByRound from '@/components/SurveyStatsByRound';

interface Survey {
  id: string;
  title: string;
  education_year: number;
  education_round: number;
  status: string;
  instructor_id: string;
  created_at: string;
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
}

interface Profile {
  role: string;
  instructor_id: string;
}

const PersonalDashboard = () => {
  const { user, userRoles } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('round');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedRound, setSelectedRound] = useState<string>('latest');
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
  }, [profile, selectedPeriod, selectedYear, selectedRound]);

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      console.log('내 피드백 - 사용자 정보:', { userId: user.id, email: user.email });
      
      const { data, error } = await supabase
        .from('profiles')
        .select('role, instructor_id')
        .eq('id', user.id)
        .maybeSingle();
        
      if (error && error.code !== 'PGRST116') {
        console.error('내 피드백 - 프로필 조회 오류:', error);
      }
      
      console.log('내 피드백 - 프로필 데이터:', data);
      setProfile(data);
    } catch (error) {
      console.error('내 피드백 - fetchProfile 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    console.log('내 피드백 - fetchData 호출:', { 
      profile, 
      instructor_id: profile?.instructor_id, 
      canViewPersonalStats,
      isInstructor,
      userRoles 
    });

    if (!canViewPersonalStats) {
      console.log('내 피드백 - 권한 없음');
      return;
    }

    try {
      // 강사가 아닌 관리자의 경우 전체 데이터 조회
      let surveyQuery = supabase.from('surveys').select('*');
      
      // 강사인 경우 본인 설문만, 관리자인 경우 전체 설문
      if (profile?.instructor_id && isInstructor) {
        console.log('내 피드백 - 강사 필터링:', profile.instructor_id);
        surveyQuery = surveyQuery.eq('instructor_id', profile.instructor_id);
      } else if (isInstructor && !profile?.instructor_id) {
        // instructor_id가 없는 강사의 경우 이메일로 매칭 시도
        console.log('내 피드백 - 이메일로 강사 찾기:', user.email);
        const { data: instructorData } = await supabase
          .from('instructors')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
          
        if (instructorData) {
          console.log('내 피드백 - 이메일로 찾은 강사 ID:', instructorData.id);
          surveyQuery = surveyQuery.eq('instructor_id', instructorData.id);
        } else {
          console.log('내 피드백 - 이메일로 강사를 찾을 수 없음');
        }
      }

      if (selectedYear && selectedYear !== 'all') {
        surveyQuery = surveyQuery.eq('education_year', parseInt(selectedYear));
      }

      if (selectedRound && selectedRound !== 'all' && selectedRound !== 'latest') {
        surveyQuery = surveyQuery.eq('education_round', parseInt(selectedRound));
      }

      const { data: surveysData, error: surveysError } = await surveyQuery
        .order('education_year', { ascending: false })
        .order('education_round', { ascending: false });

      if (surveysError) throw surveysError;
      
      let filteredSurveys = surveysData || [];
      console.log('내 피드백 - 조회된 설문 데이터:', filteredSurveys);
      
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
      if (filteredSurveys && filteredSurveys.length > 0) {
        const surveyIds = filteredSurveys.map(s => s.id);
        
        const { data: responsesData, error: responsesError } = await supabase
          .from('survey_responses')
          .select('*')
          .in('survey_id', surveyIds);

        if (responsesError) throw responsesError;
        setResponses(responsesData || []);
        console.log('내 피드백 - 조회된 응답 데이터:', responsesData?.length || 0, '개');

        // 질문들 가져오기
        const { data: questionsData, error: questionsError } = await supabase
          .from('survey_questions')
          .select('*')
          .in('survey_id', surveyIds);

        if (questionsError) throw questionsError;
        setQuestions(questionsData || []);
        console.log('내 피드백 - 조회된 질문 데이터:', questionsData?.length || 0, '개');

        // 답변들 가져오기
        if (responsesData && responsesData.length > 0) {
          const responseIds = responsesData.map(r => r.id);
          
          const { data: answersData, error: answersError } = await supabase
            .from('question_answers')
            .select('*')
            .in('response_id', responseIds);

          if (answersError) throw answersError;
          setAnswers(answersData || []);
          console.log('내 피드백 - 조회된 답변 데이터:', answersData?.length || 0, '개');
        } else {
          setAnswers([]);
        }
      } else {
        setResponses([]);
        setQuestions([]);
        setAnswers([]);
      }
    } catch (error) {
      console.error('내 피드백 - fetchData 오류:', error);
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

  const getTrendData = () => {
    // 평점 질문들 (rating 또는 scale 타입) 찾기
    const ratingQuestions = questions.filter(q => 
      q.question_type === 'rating' || q.question_type === 'scale'
    );
    
    if (selectedPeriod === 'round') {
      // 회차별 트렌드
      const roundData: Record<string, { total: number; count: number; responses: number }> = {};
      
      surveys.forEach(survey => {
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
              // 5점 척도를 10점 척도로 변환
              const convertedRating = rating <= 5 ? rating * 2 : rating;
              roundData[roundKey].total += convertedRating;
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
    } else if (selectedPeriod === 'month') {
      // 월별 트렌드
      const monthlyData: Record<string, { total: number; count: number; responses: number }> = {};
      
      responses.forEach(response => {
        const date = new Date(response.submitted_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { total: 0, count: 0, responses: 0 };
        }
        monthlyData[monthKey].responses++;
        
        const responseAnswers = answers.filter(a => a.response_id === response.id);
        const ratingAnswers = responseAnswers.filter(a => 
          ratingQuestions.some(q => q.id === a.question_id)
        );
        
          ratingAnswers.forEach(answer => {
            const rating = parseFloat(answer.answer_text);
            if (!isNaN(rating) && rating > 0) {
              const convertedRating = rating <= 5 ? rating * 2 : rating;
              monthlyData[monthKey].total += convertedRating;
              monthlyData[monthKey].count++;
            }
          });
      });

      return Object.entries(monthlyData)
        .map(([month, data]) => ({
          period: month,
          average: data.count > 0 ? (data.total / data.count) : 0,
          responses: data.responses,
          satisfaction: data.count > 0 ? Math.round((data.total / data.count) * 20) : 0
        }))
        .sort((a, b) => a.period.localeCompare(b.period));
    } else if (selectedPeriod === 'half') {
      // 반기별 트렌드  
      const halfYearData: Record<string, { total: number; count: number; responses: number }> = {};
      
      surveys.forEach(survey => {
        const half = survey.education_round <= 2 ? 1 : 2;
        const halfKey = `${survey.education_year}-H${half}`;
        
        if (!halfYearData[halfKey]) {
          halfYearData[halfKey] = { total: 0, count: 0, responses: 0 };
        }
        
        const surveyResponses = responses.filter(r => r.survey_id === survey.id);
        halfYearData[halfKey].responses += surveyResponses.length;
        
        surveyResponses.forEach(response => {
          const responseAnswers = answers.filter(a => a.response_id === response.id);
          const ratingAnswers = responseAnswers.filter(a => 
            ratingQuestions.some(q => q.id === a.question_id)
          );
          
          ratingAnswers.forEach(answer => {
            const rating = parseFloat(answer.answer_text);
            if (!isNaN(rating) && rating > 0) {
              const convertedRating = rating <= 5 ? rating * 2 : rating;
              halfYearData[halfKey].total += convertedRating;
              halfYearData[halfKey].count++;
            }
          });
        });
      });

      return Object.entries(halfYearData)
        .map(([half, data]) => ({
          period: half,
          average: data.count > 0 ? (data.total / data.count) : 0,
          responses: data.responses,
          satisfaction: data.count > 0 ? Math.round((data.total / data.count) * 20) : 0
        }))
        .sort((a, b) => a.period.localeCompare(b.period));
    } else {
      // 연도별 트렌드
      const yearlyData: Record<string, { total: number; count: number; responses: number }> = {};
      
      surveys.forEach(survey => {
        const year = survey.education_year.toString();
        
        if (!yearlyData[year]) {
          yearlyData[year] = { total: 0, count: 0, responses: 0 };
        }
        
        const surveyResponses = responses.filter(r => r.survey_id === survey.id);
        yearlyData[year].responses += surveyResponses.length;
        
        surveyResponses.forEach(response => {
          const responseAnswers = answers.filter(a => a.response_id === response.id);
          const ratingAnswers = responseAnswers.filter(a => 
            ratingQuestions.some(q => q.id === a.question_id)
          );
          
          ratingAnswers.forEach(answer => {
            const rating = parseFloat(answer.answer_text);
            if (!isNaN(rating) && rating > 0) {
              const convertedRating = rating <= 5 ? rating * 2 : rating;
              yearlyData[year].total += convertedRating;
              yearlyData[year].count++;
            }
          });
        });
      });

      return Object.entries(yearlyData)
        .map(([year, data]) => ({
          period: year,
          average: data.count > 0 ? (data.total / data.count) : 0,
          responses: data.responses,
          satisfaction: data.count > 0 ? Math.round((data.total / data.count) * 20) : 0
        }))
        .sort((a, b) => a.period.localeCompare(b.period));
    }
  };

  const getSummaryStats = () => {
    const totalSurveys = surveys.length;
    const totalResponses = responses.length;
    const activeSurveys = surveys.filter(s => s.status === 'active').length;
    
    // 만족도 평균 계산 - rating 타입 질문들 사용
    const ratingQuestions = questions.filter(q => 
      q.question_type === 'rating' || q.question_type === 'scale'
    );
    const ratingAnswers = answers.filter(a => 
      ratingQuestions.some(q => q.id === a.question_id)
    );
    
    const validRatings = ratingAnswers
      .map(a => parseFloat(a.answer_text))
      .filter(r => !isNaN(r) && r > 0)
      .map(r => r <= 5 ? r * 2 : r); // 5점 척도를 10점으로 변환
    
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

  // CSV 내보내기 함수
  const generatePersonalStatsCSV = () => {
    let csvContent = '\uFEFF'; // BOM for Excel
    
    const stats = getSummaryStats();
    const trendData = getTrendData();
    
    // 기본 통계
    csvContent += '개인 통계 요약\n';
    csvContent += `총 설문,${stats.totalSurveys}\n`;
    csvContent += `총 응답,${stats.totalResponses}\n`;
    csvContent += `활성 설문,${stats.activeSurveys}\n`;
    csvContent += `평균 만족도,${stats.avgSatisfaction}\n`;
    csvContent += `만족도 백분율,${stats.satisfactionPercentage}%\n`;
    csvContent += `설문당 평균 응답,${stats.avgResponsesPerSurvey}\n\n`;
    
    // 트렌드 데이터
    csvContent += '기간별 트렌드\n';
    csvContent += '기간,평균 만족도,응답 수,만족도(%)\n';
    trendData.forEach(item => {
      csvContent += `${item.period},${item.average.toFixed(1)},${item.responses},${item.satisfaction}%\n`;
    });
    
    return csvContent;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">로딩 중...</div>;
  }

  if (!canViewPersonalStats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">개인 통계를 조회할 권한이 없습니다.</p>
        </div>
      </div>
    );
  }

  const trendData = getTrendData();
  const summaryStats = getSummaryStats();
  const ratingDistribution = getRatingDistribution();
  const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];

  return (
    <div className="space-y-6">
      {/* 필터 및 통계 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">총 설문</p>
                <p className="text-2xl font-bold">{summaryStats.totalSurveys}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">총 응답</p>
                <p className="text-2xl font-bold">{summaryStats.totalResponses}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">평균 만족도</p>
                <div className="flex items-center space-x-2">
                  <p className="text-2xl font-bold">{summaryStats.avgSatisfaction}</p>
                  <Badge variant={summaryStats.avgSatisfaction >= 4 ? "default" : summaryStats.avgSatisfaction >= 3 ? "secondary" : "destructive"}>
                    {summaryStats.satisfactionPercentage}%
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Award className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">활성 설문</p>
                <p className="text-2xl font-bold">{summaryStats.activeSurveys}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 액션 버튼들 */}
      <div className="flex gap-2 mb-4">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => window.print()}
          className="gap-2"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a1 1 0 001-1v-4a1 1 0 00-1-1H9a1 1 0 00-1 1v4a1 1 0 001 1zm3-5h2m-2-2h2m-2-2h2" />
          </svg>
          인쇄
        </Button>
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
          }}
          className="gap-2"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          CSV 다운로드
        </Button>
      </div>

      {/* 필터 컨트롤 */}
      <div className="flex flex-wrap gap-4">
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="기간 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="round">회차별</SelectItem>
            <SelectItem value="month">월별</SelectItem>
            <SelectItem value="half">반기별</SelectItem>
            <SelectItem value="year">연도별</SelectItem>
          </SelectContent>
        </Select>

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

        {selectedPeriod !== 'round' && (
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
        )}
        
        {selectedPeriod === 'round' && (
          <Select value={selectedRound} onValueChange={setSelectedRound}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="회차 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">최신 회차</SelectItem>
              <SelectItem value="all">전체</SelectItem>
              {getUniqueRounds().map(round => (
                <SelectItem key={round} value={round.toString()}>{round}차</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
                    <YAxis domain={[1, 5]} />
                    <YAxis yAxisId="right" orientation="right" />
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
                      yAxisId="right"
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
    </div>
  );
};

export default PersonalDashboard;