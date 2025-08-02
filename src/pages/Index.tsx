import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Menu, Calendar, Clock, BarChart, FileText, Users } from 'lucide-react';

interface Survey {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  education_year: number;
  education_round: number;
  status: string;
}

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loadingSurveys, setLoadingSurveys] = useState(true);

  // 로그인된 사용자도 랜딩 페이지에 유지 (관리자는 햄버거 메뉴에서 대시보드로)
  // useEffect(() => {
  //   if (!loading && user) {
  //     navigate('/dashboard');
  //   }
  // }, [user, loading, navigate]);

  useEffect(() => {
    fetchTodaysSurveys();
  }, []);

   const fetchTodaysSurveys = async () => {
     try {
       console.log('Fetching surveys...');
       
       // 현재 한국 시간(UTC+9) 기준으로 현재 시각 구하기
       const now = new Date();
       const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
       
       const { data, error } = await supabase
         .from('surveys')
         .select('*')
         .eq('status', 'active')
         .lte('start_date', kstNow.toISOString())
         .gte('end_date', kstNow.toISOString())
         .order('education_year', { ascending: false })
         .order('education_round', { ascending: false });

       console.log('Fetched surveys:', data);
       
       if (error) throw error;
       setSurveys(data || []);
     } catch (error) {
       console.error('Error fetching surveys:', error);
     } finally {
       setLoadingSurveys(false);
     }
   };

  const groupSurveysByRound = (surveys: Survey[]) => {
    const grouped = surveys.reduce((acc, survey) => {
      const key = `${survey.education_year}년 ${survey.education_round}차`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(survey);
      return acc;
    }, {} as Record<string, Survey[]>);
    return grouped;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div>로딩중...</div>
      </div>
    );
  }

  const groupedSurveys = groupSurveysByRound(surveys);

  return (
    <div className="min-h-screen bg-background">
      {/* Header with hamburger menu */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="absolute left-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-8 w-8 md:h-10 md:w-10">
                  <Menu className="h-5 w-5 md:h-6 md:w-6" />
                  {user && (
                    <div className="absolute -top-1 -right-1 h-2 w-2 md:h-3 md:w-3 bg-primary rounded-full"></div>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-80 p-4">
                <div className="space-y-6 mt-6">
                  {user ? (
                    <>
                      <div className="border-b pb-4">
                        <h2 className="text-lg font-semibold text-primary">관리자 메뉴</h2>
                        <p className="text-sm text-muted-foreground mt-1 break-words">
                          환영합니다, {user.email}
                        </p>
                      </div>
                      <div className="space-y-3">
                        <Button 
                          onClick={() => navigate('/dashboard')}
                          className="w-full justify-start"
                          variant="default"
                        >
                          <BarChart className="h-4 w-4 mr-2" />
                          관리 대시보드
                        </Button>
                        <Button 
                          onClick={() => navigate('/dashboard/instructors')}
                          className="w-full justify-start"
                          variant="outline"
                        >
                          <Users className="h-4 w-4 mr-2" />
                          강사 관리
                        </Button>
                        <Button 
                          onClick={() => navigate('/dashboard/surveys')}
                          className="w-full justify-start"
                          variant="outline"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          설문조사 관리
                        </Button>
                         <Button 
                           onClick={() => navigate('/dashboard/results')}
                           className="w-full justify-start"
                           variant="outline"
                         >
                           <BarChart className="h-4 w-4 mr-2" />
                           결과 분석
                         </Button>
                         <Button 
                           onClick={() => navigate('/')}
                           className="w-full justify-start"
                           variant="outline"
                         >
                           <FileText className="h-4 w-4 mr-2" />
                           설문 리스트
                         </Button>
                        <Button 
                          onClick={() => navigate('/dashboard/templates')}
                          className="w-full justify-start"
                          variant="outline"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          템플릿 관리
                        </Button>
                      </div>
                      <Button 
                        onClick={() => {
                          // 로그아웃하고 페이지 새로고침
                          window.location.reload();
                        }}
                        variant="ghost" 
                        className="w-full text-muted-foreground"
                      >
                        로그아웃
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="border-b pb-4">
                        <h2 className="text-lg font-semibold">관리자/강사 로그인</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          설문 결과 조회 및 관리
                        </p>
                      </div>
                      <Button 
                        onClick={() => navigate('/auth')}
                        className="w-full"
                      >
                        로그인하기
                      </Button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-12">
            <h1 className="text-base md:text-2xl font-bold text-primary text-center truncate">BS/SS 교육과정</h1>
            <p className="text-xs md:text-sm text-muted-foreground text-center truncate">교육생 피드백 시스템</p>
          </div>
          
          <div className="w-8 md:w-10"></div> {/* Right spacer for balance */}
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6 md:py-8 min-h-screen">
        <div className="mb-6 md:mb-8 text-center">
          <h2 className="text-lg md:text-3xl font-bold mb-2 md:mb-4 break-words">📝 오늘의 설문조사</h2>
          <p className="text-muted-foreground text-sm md:text-base break-words">
            진행 중인 설문조사에 참여해 주세요
          </p>
        </div>

        {loadingSurveys ? (
          <div className="text-center py-12">
            <div className="animate-pulse">📋 설문조사를 불러오는 중...</div>
          </div>
        ) : Object.keys(groupedSurveys).length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="bg-muted/30 rounded-2xl p-8 max-w-md mx-auto">
              <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg md:text-xl font-semibold mb-2">진행 중인 설문조사가 없습니다</h3>
              <p className="text-muted-foreground text-sm md:text-base">
                현재 활성화된 설문조사가 없습니다<br />
                새로운 설문조사가 시작되면 알려드릴게요! 📢
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedSurveys).map(([roundTitle, roundSurveys]) => (
              <div key={roundTitle} className="animate-fade-in">
                <div className="flex items-center gap-3 mb-4 md:mb-6">
                  <Badge variant="default" className="text-sm px-3 py-1">
                    🎓 {roundTitle}
                  </Badge>
                  <div className="flex-1 h-px bg-border"></div>
                  <span className="text-xs text-muted-foreground">
                    {roundSurveys.length}개 설문
                  </span>
                </div>
                
                <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {roundSurveys.map((survey) => (
                    <Card 
                      key={survey.id} 
                      className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-primary/30 hover:border-l-primary cursor-pointer"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start gap-2">
                          <CardTitle className="text-base md:text-lg group-hover:text-primary transition-colors line-clamp-2 break-words hyphens-auto">
                            {survey.title}
                          </CardTitle>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            진행중
                          </Badge>
                        </div>
                        {survey.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-2 break-words hyphens-auto">
                            {survey.description}
                          </p>
                        )}
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-3">
                           <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                             <Clock className="h-4 w-4 shrink-0" />
                             <span className="text-xs truncate break-all">
                               {new Date(survey.start_date).toLocaleString('ko-KR', { 
                                 year: 'numeric', 
                                 month: 'short', 
                                 day: 'numeric', 
                                 hour: '2-digit', 
                                 minute: '2-digit' 
                               })} ~ {new Date(survey.end_date).toLocaleString('ko-KR', { 
                                 year: 'numeric', 
                                 month: 'short', 
                                 day: 'numeric', 
                                 hour: '2-digit', 
                                 minute: '2-digit' 
                               })}
                             </span>
                           </div>
                          <Button 
                            className="w-full group-hover:bg-primary/90 transition-colors touch-friendly"
                            onClick={() => navigate(`/survey/${survey.id}`)}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            설문 참여하기
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
