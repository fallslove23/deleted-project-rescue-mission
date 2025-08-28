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

      // 강사인 경우 해당 강사의 설문 ID 목록 조회
      let instructorSurveyIds: string[] = [];
      if (isInstructor && profile.instructor_id) {
        const { data: instructorSurveys } = await supabase
          .from('surveys')
          .select('id')
          .eq('instructor_id', profile.instructor_id);
        instructorSurveyIds = (instructorSurveys || []).map((s: any) => s.id);
      }

      // 공통 헬퍼: 설문 카운트 쿼리 생성 (빌더 재사용 금지)
      const surveyCount = (extra?: { status?: string }) => {
        let q = supabase.from('surveys').select('*', { count: 'exact' });
        if (isInstructor && profile.instructor_id) q = q.eq('instructor_id', profile.instructor_id);
        if (extra?.status) q = q.eq('status', extra.status);
        return q;
      };

      // 응답 카운트 쿼리 생성 (빌더를 반환하고, 설문이 없으면 null)
      const responsesBase = () => {
        let q = supabase
          .from('survey_responses')
          .select('*', { count: 'exact', head: true });
        if (isInstructor) {
          if (instructorSurveyIds.length === 0) return null;
          q = q.in('survey_id', instructorSurveyIds);
        }
        return q;
      };

      const [
        totalSurveysRes,
        activeSurveysRes,
        completedSurveysRes,
        totalResponsesRes,
        totalInstructorsRes,
        totalCoursesRes,
        recentResponsesRes,
      ] = await Promise.all([
        surveyCount(),
        surveyCount({ status: 'active' }),
        surveyCount({ status: 'completed' }),
        (responsesBase() ?? Promise.resolve({ count: 0 } as any)),
        isAdmin ? supabase
          .from('instructors')
          .select('id', { count: 'exact' }) : Promise.resolve({ count: 0 } as any),
        isAdmin ? supabase.from('courses').select('*', { count: 'exact' }) : Promise.resolve({ count: 0 } as any),
        (() => {
          const base = responsesBase();
          if (!base) return Promise.resolve({ count: 0 } as any);
          return base.gte('submitted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
        })(),
      ]);

      setStats({
        totalSurveys: totalSurveysRes.count || 0,
        activeSurveys: activeSurveysRes.count || 0,
        completedSurveys: completedSurveysRes.count || 0,
        totalResponses: totalResponsesRes.count || 0,
        totalInstructors: totalInstructorsRes.count || 0,
        totalCourses: totalCoursesRes.count || 0,
        recentResponsesCount: recentResponsesRes.count || 0,
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
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          <Card className="bg-white border border-gray-200 hover:border-primary/20 transition-all duration-300">
            <CardHeader className="flex flex-col items-center space-y-0 pb-2 p-4 md:p-6 text-center">
              <div className="h-6 w-6 md:h-8 md:w-8 bg-gradient-primary rounded-lg flex items-center justify-center opacity-80 mb-2">
                <FileText className="h-3 w-3 md:h-4 md:w-4 text-primary-foreground" />
              </div>
              <CardTitle className="text-xs md:text-sm font-medium">전체 설문조사</CardTitle>
            </CardHeader>
            <CardContent className="text-center p-4 md:p-6 pt-0">
              <div className="text-xl md:text-2xl font-bold text-foreground">{stats.totalSurveys}</div>
              <p className="text-xs text-muted-foreground">
                {isAdmin ? '전체 시스템' : '담당 강의'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 hover:border-primary/20 transition-all duration-300">
            <CardHeader className="flex flex-col items-center space-y-0 pb-2 p-4 md:p-6 text-center">
              <div className="h-6 w-6 md:h-8 md:w-8 bg-gradient-primary rounded-lg flex items-center justify-center opacity-80 mb-2">
                <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-primary-foreground" />
              </div>
              <CardTitle className="text-xs md:text-sm font-medium">진행중인 설문</CardTitle>
            </CardHeader>
            <CardContent className="text-center p-4 md:p-6 pt-0">
              <div className="text-xl md:text-2xl font-bold text-foreground">{stats.activeSurveys}</div>
              <p className="text-xs text-muted-foreground">
                현재 응답 가능
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 hover:border-primary/20 transition-all duration-300">
            <CardHeader className="flex flex-col items-center space-y-0 pb-2 p-4 md:p-6 text-center">
              <div className="h-6 w-6 md:h-8 md:w-8 bg-gradient-primary rounded-lg flex items-center justify-center opacity-80 mb-2">
                <BarChart className="h-3 w-3 md:h-4 md:w-4 text-primary-foreground" />
              </div>
              <CardTitle className="text-xs md:text-sm font-medium">총 응답수</CardTitle>
            </CardHeader>
            <CardContent className="text-center p-4 md:p-6 pt-0">
              <div className="text-xl md:text-2xl font-bold text-foreground">{stats.totalResponses}</div>
              <p className="text-xs text-muted-foreground">
                누적 응답 수
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200 hover:border-primary/20 transition-all duration-300">
            <CardHeader className="flex flex-col items-center space-y-0 pb-2 p-4 md:p-6 text-center">
              <div className="h-6 w-6 md:h-8 md:w-8 bg-gradient-primary rounded-lg flex items-center justify-center opacity-80 mb-2">
                <Clock className="h-3 w-3 md:h-4 md:w-4 text-primary-foreground" />
              </div>
              <CardTitle className="text-xs md:text-sm font-medium">최근 7일 응답</CardTitle>
            </CardHeader>
            <CardContent className="text-center p-4 md:p-6 pt-0">
              <div className="text-xl md:text-2xl font-bold text-foreground">{stats.recentResponsesCount}</div>
              <p className="text-xs text-muted-foreground">
                최근 활동
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 관리자 전용 통계 */}
        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
            <Card className="bg-white border border-gray-200 hover:border-primary/20 transition-all duration-300">
              <CardHeader className="flex flex-col items-center space-y-0 pb-2 p-4 md:p-6 text-center">
                <div className="h-6 w-6 md:h-8 md:w-8 bg-gradient-primary rounded-lg flex items-center justify-center opacity-80 mb-2">
                  <Users className="h-3 w-3 md:h-4 md:w-4 text-primary-foreground" />
                </div>
                <CardTitle className="text-xs md:text-sm font-medium">전체 강사수</CardTitle>
              </CardHeader>
              <CardContent className="text-center p-4 md:p-6 pt-0">
                <div className="text-xl md:text-2xl font-bold text-foreground">{stats.totalInstructors}</div>
                <p className="text-xs text-muted-foreground">
                  등록된 강사
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200 hover:border-primary/20 transition-all duration-300">
              <CardHeader className="flex flex-col items-center space-y-0 pb-2 p-4 md:p-6 text-center">
                <div className="h-6 w-6 md:h-8 md:w-8 bg-gradient-primary rounded-lg flex items-center justify-center opacity-80 mb-2">
                  <BookOpen className="h-3 w-3 md:h-4 md:w-4 text-primary-foreground" />
                </div>
                <CardTitle className="text-xs md:text-sm font-medium">전체 강좌수</CardTitle>
              </CardHeader>
              <CardContent className="text-center p-4 md:p-6 pt-0">
                <div className="text-xl md:text-2xl font-bold text-foreground">{stats.totalCourses}</div>
                <p className="text-xs text-muted-foreground">
                  개설된 강좌
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200 hover:border-primary/20 transition-all duration-300">
              <CardHeader className="flex flex-col items-center space-y-0 pb-2 p-4 md:p-6 text-center">
                <div className="h-6 w-6 md:h-8 md:w-8 bg-gradient-primary rounded-lg flex items-center justify-center opacity-80 mb-2">
                  <BarChart className="h-3 w-3 md:h-4 md:w-4 text-primary-foreground" />
                </div>
                <CardTitle className="text-xs md:text-sm font-medium">완료된 설문</CardTitle>
              </CardHeader>
              <CardContent className="text-center p-4 md:p-6 pt-0">
                <div className="text-xl md:text-2xl font-bold text-foreground">{stats.completedSurveys}</div>
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