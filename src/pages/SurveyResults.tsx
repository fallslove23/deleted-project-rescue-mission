import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, FileText, TrendingUp, Users } from 'lucide-react';

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

const SurveyResults = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
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
    }
  }, [selectedSurvey]);

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">설문 결과 분석</h1>
        <p className="text-muted-foreground">
          {isAdmin ? '전체 설문조사 결과를 확인할 수 있습니다' : '담당 강의의 설문조사 결과를 확인할 수 있습니다'}
        </p>
      </div>

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
          <Card>
            <CardHeader>
              <CardTitle>상세 분석</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                상세한 설문 분석 기능이 여기에 표시됩니다.
              </p>
            </CardContent>
          </Card>
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
  );
};

export default SurveyResults;