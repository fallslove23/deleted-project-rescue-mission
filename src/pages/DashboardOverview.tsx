import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, BookOpen, FileText, BarChart, TrendingUp, Clock, Activity } from 'lucide-react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DashboardLayout } from '@/components/DashboardLayout';

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

const DashboardOverview = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
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
          .maybeSingle();
          
        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error);
        }
        
        // 프로필이 없는 경우 기본 프로필 생성
        if (!data) {
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email,
              role: 'user'
            })
            .select()
            .single();
            
          if (insertError) {
            console.error('Error creating profile:', insertError);
          } else {
            setProfile(newProfile);
          }
        } else {
          setProfile(data);
        }
      } catch (error) {
        console.error('Error in fetchProfile:', error);
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
    if (!profile) return;
    
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
        // 실제 강사 역할을 가진 사용자 수 카운팅 (instructor 역할을 가진 profiles)
        isAdmin ? supabase
          .from('profiles')
          .select('*', { count: 'exact' })
          .not('instructor_id', 'is', null) : Promise.resolve({ count: 0 }),
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
      <DashboardLayout title="관리자 대시보드" description="시스템 개요">
        <div className="flex items-center justify-center py-8">
          <div>로딩중...</div>
        </div>
      </DashboardLayout>
    );
  }

  const isAdmin = profile?.role === 'admin';

  // 차트 데이터 준비
  const chartData = [
    {
      name: '전체 설문',
      value: stats.totalSurveys,
      color: '#8884d8'
    },
    {
      name: '진행중',
      value: stats.activeSurveys,
      color: '#82ca9d'
    },
    {
      name: '완료',
      value: stats.completedSurveys,
      color: '#ffc658'
    }
  ];

  const responseData = [
    {
      period: '지난주',
      responses: Math.max(0, stats.totalResponses - stats.recentResponsesCount)
    },
    {
      period: '이번주',
      responses: stats.recentResponsesCount
    }
  ];

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658'];

  return (
    <DashboardLayout 
      title="관리자 대시보드" 
      description={isAdmin ? '시스템 관리자' : '강사'} 
    >
      <div className="space-y-6">
        {/* 주요 통계 카드들 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-white border border-gray-200 hover:border-primary/20 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">전체 설문조사</CardTitle>
              <div className="h-8 w-8 bg-gradient-primary rounded-lg flex items-center justify-center opacity-80">
                <FileText className="h-4 w-4 text-primary-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.totalSurveys}</div>
              <p className="text-xs text-muted-foreground">
                {isAdmin ? '전체 시스템' : '담당 강의'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 hover:border-primary/20 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">진행중인 설문</CardTitle>
              <div className="h-8 w-8 bg-gradient-primary rounded-lg flex items-center justify-center opacity-80">
                <TrendingUp className="h-4 w-4 text-primary-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.activeSurveys}</div>
              <p className="text-xs text-muted-foreground">
                현재 응답 가능
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 hover:border-primary/20 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 응답수</CardTitle>
              <div className="h-8 w-8 bg-gradient-primary rounded-lg flex items-center justify-center opacity-80">
                <BarChart className="h-4 w-4 text-primary-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.totalResponses}</div>
              <p className="text-xs text-muted-foreground">
                누적 응답 수
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 hover:border-primary/20 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">최근 7일 응답</CardTitle>
              <div className="h-8 w-8 bg-gradient-primary rounded-lg flex items-center justify-center opacity-80">
                <Clock className="h-4 w-4 text-primary-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.recentResponsesCount}</div>
              <p className="text-xs text-muted-foreground">
                최근 활동
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 관리자 전용 통계 */}
        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white border border-gray-200 hover:border-primary/20 transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">전체 강사수</CardTitle>
                <div className="h-8 w-8 bg-gradient-primary rounded-lg flex items-center justify-center opacity-80">
                  <Users className="h-4 w-4 text-primary-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stats.totalInstructors}</div>
                <p className="text-xs text-muted-foreground">
                  등록된 강사
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200 hover:border-primary/20 transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">전체 강좌수</CardTitle>
                <div className="h-8 w-8 bg-gradient-primary rounded-lg flex items-center justify-center opacity-80">
                  <BookOpen className="h-4 w-4 text-primary-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stats.totalCourses}</div>
                <p className="text-xs text-muted-foreground">
                  개설된 강좌
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200 hover:border-primary/20 transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">완료된 설문</CardTitle>
                <div className="h-8 w-8 bg-gradient-primary rounded-lg flex items-center justify-center opacity-80">
                  <BarChart className="h-4 w-4 text-primary-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stats.completedSurveys}</div>
                <p className="text-xs text-muted-foreground">
                  설문 완료
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 차트 섹션 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white border border-gray-200 hover:border-primary/20 transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">설문 현황</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-4">
                {chartData.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index] }}
                    />
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 hover:border-primary/20 transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">응답 추이</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={responseData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Bar dataKey="responses" fill="#8884d8" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DashboardOverview;