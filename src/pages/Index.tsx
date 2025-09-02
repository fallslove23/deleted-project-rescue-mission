import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Menu, Calendar, Clock, BarChart, FileText, Users, ChevronDown, ChevronRight } from 'lucide-react';
import { toZonedTime } from 'date-fns-tz';

interface Survey {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  education_year: number;
  education_round: number;
  course_name?: string;
  status: string;
}

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loadingSurveys, setLoadingSurveys] = useState(true);
  const [showAllSurveys, setShowAllSurveys] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // 로그인된 사용자도 랜딩 페이지에 유지 (관리자는 햄버거 메뉴에서 대시보드로)
  // useEffect(() => {
  //   if (!loading && user) {
  //     navigate('/dashboard');
  //   }
  // }, [user, loading, navigate]);

  useEffect(() => {
    if (showAllSurveys) {
      fetchAllSurveys();
    } else {
      fetchTodaysSurveys();
    }
  }, [showAllSurveys]);

   const fetchTodaysSurveys = async () => {
     try {
       console.log('Fetching surveys...');
       
       // 한국 시간대(Asia/Seoul) 기준으로 현재 시각 구하기
       const timeZone = 'Asia/Seoul';
       const nowKST = toZonedTime(new Date(), timeZone);
       
       console.log('Current KST time:', nowKST.toISOString());
       
       const { data, error } = await supabase
         .from('surveys')
         .select('*')
         .eq('status', 'active')
         .lte('start_date', nowKST.toISOString())  // 시작일이 현재 시간보다 이전이거나 같아야 함
         .gte('end_date', nowKST.toISOString())    // 종료일이 현재 시간보다 이후이거나 같아야 함
         .order('education_year', { ascending: false })
         .order('education_round', { ascending: false });

       console.log('Fetched surveys:', data);
       console.log('Query conditions:', {
         status: 'active',
         start_date_lte: nowKST.toISOString(),
         end_date_gte: nowKST.toISOString()
       });
       
       if (error) throw error;
       setSurveys(data || []);
     } catch (error) {
       console.error('Error fetching surveys:', error);
     } finally {
       setLoadingSurveys(false);
     }
   };

   const fetchAllSurveys = async () => {
     try {
       console.log('Fetching all surveys...');
       
       const { data, error } = await supabase
         .from('surveys')
         .select('*')
         .eq('status', 'active')
         .order('education_year', { ascending: false })
         .order('education_round', { ascending: false })
         .order('created_at', { ascending: false });

       console.log('Fetched all surveys:', data);
       
       if (error) throw error;
       setSurveys(data || []);
     } catch (error) {
       console.error('Error fetching all surveys:', error);
     } finally {
       setLoadingSurveys(false);
     }
   };

  const groupSurveysByRound = (surveys: Survey[]) => {
    const grouped = surveys.reduce((acc, survey) => {
      const courseName = survey.course_name || '과정명 없음';
      const key = `${survey.education_year}년 ${survey.education_round}차 - ${courseName}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(survey);
      return acc;
    }, {} as Record<string, Survey[]>);
    
    // 첫 번째 그룹을 기본으로 열어두기
    const firstKey = Object.keys(grouped)[0];
    if (firstKey && !openGroups[firstKey]) {
      setOpenGroups(prev => ({ ...prev, [firstKey]: true }));
    }
    
    return grouped;
  };

  const toggleGroup = (groupKey: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
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
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header with hamburger menu */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 py-3 flex justify-between items-center max-w-full overflow-hidden">
          <div className="absolute left-3 sm:left-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-8 w-8 md:h-10 md:w-10">
                  <Menu className="h-5 w-5 md:h-6 md:w-6" />
                  {user && (
                    <div className="absolute -top-1 -right-1 h-2 w-2 md:h-3 md:w-3 bg-primary rounded-full"></div>
                  )}
                </Button>
              </SheetTrigger>
               <SheetContent side="left" className="w-[280px] sm:w-80 p-4 max-w-[90vw]">
                 <div className="space-y-6 mt-6 overflow-y-auto max-h-[calc(100vh-80px)]">
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
          
          <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-2 sm:px-4">
            <h1 className="text-sm sm:text-base md:text-2xl font-bold text-primary text-center break-words max-w-full">BS/SS 교육과정</h1>
            <p className="text-xs md:text-sm text-muted-foreground text-center break-words max-w-full">교육생 피드백 시스템</p>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant={!showAllSurveys ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setShowAllSurveys(!showAllSurveys);
                setLoadingSurveys(true);
              }}
              className="text-xs px-2 py-1 h-8 min-w-0 whitespace-nowrap"
            >
              <FileText className="h-3 w-3 mr-1 shrink-0" />
              <span className="hidden xs:inline">{showAllSurveys ? "전체" : "오늘"}</span>
              <span className="xs:hidden">{showAllSurveys ? "전체" : "오늘"}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-3 sm:px-4 py-6 md:py-8 min-h-screen max-w-full overflow-hidden">
        <div className="mb-6 md:mb-8 text-center px-2">
          <h2 className="text-lg md:text-3xl font-bold mb-2 md:mb-4 break-words">
            {showAllSurveys ? "📝 전체 설문조사" : "📝 오늘의 설문조사"}
          </h2>
          <p className="text-muted-foreground text-sm md:text-base break-words">
            {showAllSurveys ? "모든 활성 설문조사를 확인하세요" : "진행 중인 설문조사에 참여해 주세요"}
          </p>
        </div>

        {loadingSurveys ? (
          <div className="text-center py-12">
            <div className="animate-pulse">📋 설문조사를 불러오는 중...</div>
          </div>
        ) : Object.keys(groupedSurveys).length === 0 ? (
          <div className="text-center py-16 px-2 sm:px-4">
            <div className="bg-muted/30 rounded-2xl p-6 sm:p-8 max-w-md mx-auto">
              <Calendar className="h-12 sm:h-16 w-12 sm:w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-base sm:text-lg md:text-xl font-semibold mb-2 break-words">
                {showAllSurveys ? "활성 설문조사가 없습니다" : "진행 중인 설문조사가 없습니다"}
              </h3>
              <p className="text-muted-foreground text-sm md:text-base break-words">
                {showAllSurveys 
                  ? "현재 활성화된 설문조사가 없습니다" 
                  : "현재 진행 중인 설문조사가 없습니다"
                }<br />
                새로운 설문조사가 시작되면 알려드릴게요! 📢
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedSurveys).map(([roundTitle, roundSurveys]) => (
              <div key={roundTitle} className="animate-fade-in">
                <Collapsible 
                  open={openGroups[roundTitle] || false}
                  onOpenChange={() => toggleGroup(roundTitle)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-3 mb-4 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors">
                      <Badge variant="default" className="text-sm px-3 py-1">
                        🎓 {roundTitle}
                      </Badge>
                      <div className="flex-1 h-px bg-border"></div>
                      <span className="text-xs text-muted-foreground mr-2">
                        {roundSurveys.length}개 설문
                      </span>
                      {openGroups[roundTitle] ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <ScrollArea className="h-auto max-h-[400px] w-full">
                      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 px-1">
                        {roundSurveys.map((survey) => (
                          <Card 
                            key={survey.id} 
                            className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-primary/30 hover:border-l-primary cursor-pointer max-w-full overflow-hidden"
                          >
                             <CardHeader className="pb-3 p-4 sm:p-6">
                               <div className="flex justify-between items-start gap-2">
                                 <CardTitle className="text-sm sm:text-base md:text-lg group-hover:text-primary transition-colors line-clamp-2 break-words hyphens-auto min-w-0 flex-1">
                                   {survey.title}
                                 </CardTitle>
                                  <Badge variant="secondary" className="text-xs shrink-0 ml-2">
                                    {showAllSurveys ? (
                                      // 전체 보기에서는 현재 시간 기준으로 상태 표시
                                      (() => {
                                        const timeZone = 'Asia/Seoul';
                                        const nowKST = toZonedTime(new Date(), timeZone);
                                        const startDateKST = toZonedTime(new Date(survey.start_date), timeZone);
                                        const endDateKST = toZonedTime(new Date(survey.end_date), timeZone);
                                        
                                        if (nowKST < startDateKST) return "시작 예정";
                                        if (nowKST > endDateKST) return "종료";
                                        return "진행중";
                                      })()
                                    ) : "진행중"}
                                  </Badge>
                              </div>
                               {survey.description && (
                                 <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mt-2 break-words hyphens-auto">
                                   {survey.description}
                                 </p>
                               )}
                             </CardHeader>
                             <CardContent className="pt-0 p-4 sm:p-6 sm:pt-0">
                               <div className="space-y-3">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                                    <span className="text-xs break-all overflow-hidden">
                                      <span className="block sm:inline">
                                        {new Date(survey.start_date).toLocaleString('ko-KR', { 
                                          year: 'numeric', 
                                          month: 'short', 
                                          day: 'numeric', 
                                          hour: '2-digit', 
                                          minute: '2-digit' 
                                        })}
                                      </span>
                                      <span className="block sm:inline sm:before:content-['_~_']">
                                        {new Date(survey.end_date).toLocaleString('ko-KR', { 
                                          year: 'numeric', 
                                          month: 'short', 
                                          day: 'numeric', 
                                          hour: '2-digit', 
                                          minute: '2-digit' 
                                        })}
                                      </span>
                                    </span>
                                  </div>
                                 <Button 
                                   className="w-full group-hover:bg-primary/90 transition-colors touch-friendly min-h-[44px] text-sm"
                                   onClick={() => navigate(`/survey/${survey.id}`)}
                                 >
                                   <FileText className="h-4 w-4 mr-2 shrink-0" />
                                   설문 참여하기
                                 </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
