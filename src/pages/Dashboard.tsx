import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, BookOpen, FileText, BarChart, Plus, Settings, TrendingUp, Clock } from 'lucide-react';
import SurveyManagement from './SurveyManagement';
import SurveyResults from './SurveyResults';

interface Profile {
  role: string;
  instructor_id: string;
}

interface DashboardStats {
  totalSurveys: number;
  activeSurveys: number;
  completedSurveys: number;
  totalResponses: number;
  totalInstructors: number;
  totalCourses: number;
  recentResponsesCount: number;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<DashboardStats>({
    totalSurveys: 0,
    activeSurveys: 0,
    completedSurveys: 0,
    totalResponses: 0,
    totalInstructors: 0,
    totalCourses: 0,
    recentResponsesCount: 0
  });

  useEffect(() => {
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
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (profile) {
      fetchDashboardStats();
    }
  }, [profile]);

  const fetchDashboardStats = async () => {
    try {
      const isAdmin = profile?.role === 'admin';
      const isInstructor = profile?.role === 'instructor';

      // 기본 쿼리들
      let surveysQuery = supabase.from('surveys').select('*', { count: 'exact' });
      let responsesQuery = supabase.from('survey_responses').select('*', { count: 'exact' });

      // 강사인 경우 자신의 강의만 조회
      if (isInstructor && profile.instructor_id) {
        surveysQuery = surveysQuery.eq('instructor_id', profile.instructor_id);
        
        // 먼저 해당 강사의 설문 ID들을 가져온 다음 responses 쿼리
        const { data: instructorSurveys } = await supabase
          .from('surveys')
          .select('id')
          .eq('instructor_id', profile.instructor_id);
        
        const surveyIds = instructorSurveys?.map(s => s.id) || [];
        if (surveyIds.length > 0) {
          responsesQuery = responsesQuery.in('survey_id', surveyIds);
        } else {
          // 설문이 없으면 빈 결과 반환
          responsesQuery = responsesQuery.eq('survey_id', 'none');
        }
      }

      const [
        surveysResult,
        activeSurveysResult,
        completedSurveysResult,
        responsesResult,
        instructorsResult,
        coursesResult,
        recentResponsesResult
      ] = await Promise.all([
        surveysQuery,
        surveysQuery.eq('status', 'active'),
        surveysQuery.eq('status', 'completed'),
        responsesQuery,
        isAdmin ? supabase.from('instructors').select('*', { count: 'exact' }) : Promise.resolve({ count: 0 }),
        isAdmin ? supabase.from('courses').select('*', { count: 'exact' }) : Promise.resolve({ count: 0 }),
        responsesQuery.gte('submitted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      ]);

      setStats({
        totalSurveys: surveysResult.count || 0,
        activeSurveys: activeSurveysResult.count || 0,
        completedSurveys: completedSurveysResult.count || 0,
        totalResponses: responsesResult.count || 0,
        totalInstructors: instructorsResult.count || 0,
        totalCourses: coursesResult.count || 0,
        recentResponsesCount: recentResponsesResult.count || 0
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>로딩중...</div>
      </div>
    );
  }

  const isAdmin = profile?.role === 'admin';
  const isInstructor = profile?.role === 'instructor';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3 md:py-4 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                <BarChart className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg md:text-2xl font-bold text-primary">관리자 대시보드</h1>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {isAdmin ? '시스템 관리자' : isInstructor ? '강사' : '사용자'} 전용
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <span className="text-xs md:text-sm hidden sm:block">환영합니다, {user?.email}</span>
            <Button onClick={() => navigate('/')} variant="ghost" size="sm">
              설문 메인
            </Button>
            <Button onClick={signOut} variant="outline" size="sm">로그아웃</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 md:py-6 safe-area-bottom">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 md:space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-12">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              📊 대시보드
            </TabsTrigger>
            <TabsTrigger value="surveys" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {isAdmin ? '🛠️ 설문관리' : '📋 설문조사'}
            </TabsTrigger>
            <TabsTrigger value="results" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              📈 결과분석
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* 주요 통계 카드들 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">전체 설문조사</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalSurveys}</div>
                  <p className="text-xs text-muted-foreground">
                    {isAdmin ? '전체 시스템' : '담당 강의'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">진행중인 설문</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeSurveys}</div>
                  <p className="text-xs text-muted-foreground">
                    현재 응답 가능
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">총 응답수</CardTitle>
                  <BarChart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalResponses}</div>
                  <p className="text-xs text-muted-foreground">
                    누적 응답 수
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">최근 7일 응답</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.recentResponsesCount}</div>
                  <p className="text-xs text-muted-foreground">
                    최근 활동
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 관리자 전용 통계 */}
            {isAdmin && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">전체 강사수</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalInstructors}</div>
                    <p className="text-xs text-muted-foreground">
                      등록된 강사
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">전체 강좌수</CardTitle>
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalCourses}</div>
                    <p className="text-xs text-muted-foreground">
                      개설된 강좌
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">완료된 설문</CardTitle>
                    <BarChart className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.completedSurveys}</div>
                    <p className="text-xs text-muted-foreground">
                      설문 완료
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 빠른 액션 카드들 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isAdmin && (
                <Card 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate('/instructors')}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">강사 관리</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-2">
                      강사 정보를 관리합니다
                    </p>
                    <Button size="sm" className="w-full">
                      <Settings className="h-3 w-3 mr-1" />
                      관리하기
                    </Button>
                  </CardContent>
                </Card>
              )}
              
              <Card 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setActiveTab('surveys')}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">설문조사</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-2">
                    {isAdmin ? '설문조사를 관리합니다' : '설문조사를 확인합니다'}
                  </p>
                  <Button size="sm" className="w-full">
                    {isAdmin ? <Plus className="h-3 w-3 mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
                    {isAdmin ? '새 설문' : '확인하기'}
                  </Button>
                </CardContent>
              </Card>
              
              <Card 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setActiveTab('results')}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">결과 분석</CardTitle>
                  <BarChart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-2">
                    피드백 결과를 분석합니다
                  </p>
                  <Button size="sm" className="w-full">
                    <BarChart className="h-3 w-3 mr-1" />
                    분석하기
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* 최근 활동 */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">최근 활동</h2>
              <Card>
                <CardHeader>
                  <CardTitle>시스템 상태</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-muted-foreground">
                      역할: {profile?.role === 'admin' ? '관리자' : profile?.role === 'instructor' ? '강사' : '사용자'}
                    </p>
                    <p className="text-muted-foreground">
                      시스템이 정상적으로 작동 중입니다.
                    </p>
                    {isInstructor && profile?.instructor_id && (
                      <p className="text-sm text-blue-600">
                        강사 계정으로 로그인되었습니다.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="surveys">
            {isAdmin ? <SurveyManagement /> : <SurveyResults />}
          </TabsContent>

          <TabsContent value="results">
            <SurveyResults />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;