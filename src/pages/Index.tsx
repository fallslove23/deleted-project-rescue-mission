import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { Menu, Clock, Calendar, Users, BarChart, TrendingUp, BookOpen, FileText } from 'lucide-react';
import { MobileOptimizedContainer } from '@/components/MobileOptimizedContainer';
import LoadingScreen from '@/components/LoadingScreen';

interface Survey {
  id: string;
  title: string;
  description?: string;
  status: string;
  created_at: string;
  instructor_id?: string;
  course_id?: string;
  instructors?: {
    name: string;
  };
}

const Index = () => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchSurveys();
  }, []);

  const fetchSurveys = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('surveys')
        .select(`
          id,
          title,
          description,
          status,
          created_at,
          instructor_id,
          course_id,
          instructors(name)
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSurveys(data || []);
    } catch (error) {
      console.error('Error fetching surveys:', error);
      toast({
        title: "오류",
        description: "설문조사를 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">진행중</Badge>;
      case 'completed':
        return <Badge variant="secondary">완료</Badge>;
      default:
        return <Badge variant="outline">준비중</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <MobileOptimizedContainer>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-primary">설문조사 시스템</h1>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Menu className="h-4 w-4" />
                    <span className="sr-only">메뉴 열기</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] sm:w-80 p-4 max-w-[90vw]">
                  <div className="space-y-6 mt-6 overflow-y-auto max-h-[calc(100vh-80px)]">
                    {user ? (
                      <>
                        <div className="border-b pb-4">
                          <h2 className="text-lg font-semibold text-primary">관리자 메뉴</h2>
                          <p className="text-sm text-muted-foreground mt-1 break-words">환영합니다, {user.email}</p>
                        </div>
                        <div className="space-y-3">
                          <Button onClick={() => navigate('/dashboard')} className="w-full justify-start" variant="default">
                            <BarChart className="h-4 w-4 mr-2" />
                            관리 대시보드
                          </Button>
                          
                          {/* 강사 전용 메뉴 추가 */}
                          <div className="border-t pt-3">
                            <h3 className="text-sm font-medium text-muted-foreground mb-2">📊 내 피드백</h3>
                            <Button onClick={() => navigate('/dashboard/my-stats')} className="w-full justify-start" variant="outline">
                              <TrendingUp className="h-4 w-4 mr-2" />
                              나의 만족도 통계
                            </Button>
                            <Button onClick={() => navigate('/dashboard/course-reports')} className="w-full justify-start mt-2" variant="outline">
                              <BookOpen className="h-4 w-4 mr-2" />
                              과정별 결과 보고
                            </Button>
                          </div>

                          {/* 관리 메뉴 */}
                          <div className="border-t pt-3">
                            <h3 className="text-sm font-medium text-muted-foreground mb-2">🔧 관리</h3>
                            <Button onClick={() => navigate('/dashboard/instructors')} className="w-full justify-start" variant="outline">
                              <Users className="h-4 w-4 mr-2" />
                              강사 관리
                            </Button>
                            <Button onClick={() => navigate('/dashboard/surveys')} className="w-full justify-start mt-2" variant="outline">
                              <FileText className="h-4 w-4 mr-2" />
                              설문조사 관리
                            </Button>
                            <Button onClick={() => navigate('/dashboard/results')} className="w-full justify-start mt-2" variant="outline">
                              <BarChart className="h-4 w-4 mr-2" />
                              결과 분석
                            </Button>
                            <Button onClick={() => navigate('/dashboard/templates')} className="w-full justify-start mt-2" variant="outline">
                              <FileText className="h-4 w-4 mr-2" />
                              템플릿 관리
                            </Button>
                          </div>

                          {/* 기타 메뉴 */}
                          <div className="border-t pt-3">
                            <h3 className="text-sm font-medium text-muted-foreground mb-2">📋 기타</h3>
                            <Button onClick={() => navigate('/')} className="w-full justify-start" variant="outline">
                              <FileText className="h-4 w-4 mr-2" />
                              설문 리스트
                            </Button>
                          </div>
                        </div>
                        <Button onClick={() => window.location.reload()} variant="ghost" className="w-full text-muted-foreground">
                          로그아웃
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="border-b pb-4">
                          <h2 className="text-lg font-semibold">관리자/강사 로그인</h2>
                          <p className="text-sm text-muted-foreground mt-1">설문 결과 조회 및 관리</p>
                        </div>
                        <Button onClick={() => navigate('/auth')} className="w-full">
                          로그인하기
                        </Button>
                      </>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">진행중인 설문조사</h2>
            <p className="text-muted-foreground">
              참여 가능한 설문조사 목록입니다. 설문조사를 클릭하여 참여해주세요.
            </p>
          </div>

          {surveys.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">현재 진행중인 설문조사가 없습니다.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {surveys.map((survey) => (
                <Card key={survey.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{survey.title}</CardTitle>
                      {getStatusBadge(survey.status)}
                    </div>
                    {survey.description && (
                      <CardDescription>{survey.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {survey.instructors?.name && (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>강사: {survey.instructors.name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>생성일: {formatDate(survey.created_at)}</span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Button 
                        onClick={() => navigate(`/survey/${survey.id}`)}
                        className="w-full"
                      >
                        설문 참여하기
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </MobileOptimizedContainer>
  );
};

export default Index;