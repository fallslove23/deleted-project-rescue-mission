import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, BookOpen, FileText, BarChart, Plus, Settings } from 'lucide-react';
import SurveyManagement from './SurveyManagement';
import SurveyResults from './SurveyResults';

interface Profile {
  role: string;
  instructor_id: string;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

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
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-primary">BS Edu 피드백 시스템</h1>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? '관리자' : isInstructor ? '강사' : '사용자'} 대시보드
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm">환영합니다, {user?.email}</span>
            <Button onClick={() => navigate('/')} variant="ghost" size="sm">
              메인으로
            </Button>
            <Button onClick={signOut} variant="outline" size="sm">로그아웃</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">대시보드</TabsTrigger>
            <TabsTrigger value="surveys">
              {isAdmin ? '설문조사 관리' : '설문조사'}
            </TabsTrigger>
            <TabsTrigger value="results">결과 분석</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* 빠른 액션 카드들 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {isAdmin && (
                <>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">강사 관리</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        강사 정보를 관리합니다
                      </p>
                      <Button size="sm" className="mt-2 w-full">
                        <Settings className="h-3 w-3 mr-1" />
                        관리하기
                      </Button>
                    </CardContent>
                  </Card>
                  
                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">강좌 관리</CardTitle>
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        강좌 정보를 관리합니다
                      </p>
                      <Button size="sm" className="mt-2 w-full">
                        <Settings className="h-3 w-3 mr-1" />
                        관리하기
                      </Button>
                    </CardContent>
                  </Card>
                </>
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
                  <p className="text-xs text-muted-foreground">
                    {isAdmin ? '설문조사를 관리합니다' : '설문조사를 확인합니다'}
                  </p>
                  <Button size="sm" className="mt-2 w-full">
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
                  <p className="text-xs text-muted-foreground">
                    피드백 결과를 분석합니다
                  </p>
                  <Button size="sm" className="mt-2 w-full">
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