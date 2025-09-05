import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAnonymousSession } from '@/hooks/useAnonymousSession';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Menu, Calendar, Clock, BarChart, FileText, Users, ChevronDown, ChevronRight, CheckCircle } from 'lucide-react';
import { toZonedTime } from 'date-fns-tz';

interface Survey {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  education_year: number;
  education_round: number;
  course_name?: string | null;
  status: string;

  // 새 필드
  round_label?: string | null;
  is_combined?: boolean | null;
  combined_round_start?: number | null;
  combined_round_end?: number | null;
}

const Index = () => {
  const { user, loading } = useAuth();
  const { session, loading: sessionLoading, checkSurveyCompletion } = useAnonymousSession();
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loadingSurveys, setLoadingSurveys] = useState(true);
  const [showAllSurveys, setShowAllSurveys] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [completedSurveys, setCompletedSurveys] = useState<Set<string>>(new Set());

  // 완료 여부 체크
  useEffect(() => {
    const checkCompletions = async () => {
      if (!session || sessionLoading || surveys.length === 0) return;
      const completions = await Promise.all(
        surveys.map(async (s) => ({ surveyId: s.id, isCompleted: await checkSurveyCompletion(s.id) }))
      );
      const done = new Set(completions.filter((c) => c.isCompleted).map((c) => c.surveyId));
      setCompletedSurveys(done);
    };
    checkCompletions();
  }, [session, sessionLoading, surveys, checkSurveyCompletion]);

  useEffect(() => {
    setLoadingSurveys(true);
    showAllSurveys ? fetchAllSurveys() : fetchTodaysSurveys();
  }, [showAllSurveys]);

  const fetchTodaysSurveys = async () => {
    try {
      const timeZone = 'Asia/Seoul';
      const nowKST = toZonedTime(new Date(), timeZone);
      const { data, error } = await supabase
        .from('surveys')
        .select('*')
        .eq('status', 'active')
        .lte('start_date', nowKST.toISOString())
        .gte('end_date', nowKST.toISOString())
        .order('education_year', { ascending: false })
        .order('education_round', { ascending: false });

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
      const { data, error } = await supabase
        .from('surveys')
        .select('*')
        .in('status', ['active', 'public', 'draft', 'completed'])
        .order('education_year', { ascending: false })
        .order('education_round', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSurveys(data || []);
    } catch (error) {
      console.error('Error fetching all surveys:', error);
    } finally {
      setLoadingSurveys(false);
    }
  };

  // ⬇️ 라벨 우선 그룹핑
  const groupSurveysByRound = (list: Survey[]) => {
    const grouped = list.reduce((acc, survey) => {
      const key =
        survey.round_label?.trim() ||
        `${survey.education_year}년 ${
          survey.is_combined && survey.combined_round_start && survey.combined_round_end
            ? `${survey.combined_round_start}∼${survey.combined_round_end}`
            : survey.education_round
        }차 - ${survey.course_name || '과정'}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(survey);
      return acc;
    }, {} as Record<string, Survey[]>);

    // 첫 그룹 자동 오픈(초기 한번만)
    const firstKey = Object.keys(grouped)[0];
    if (firstKey && openGroups[firstKey] === undefined) {
      setOpenGroups((p) => ({ ...p, [firstKey]: true }));
    }
    return grouped;
  };

  const toggleGroup = (k: string) => setOpenGroups((p) => ({ ...p, [k]: !p[k] }));

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
      {/* Header */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-3 flex justify-between items-center overflow-hidden">
          <div className="absolute left-3 sm:left-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-8 w-8 md:h-10 md:w-10">
                  <Menu className="h-5 w-5 md:h-6 md:w-6" />
                  {user && <div className="absolute -top-1 -right-1 h-2 w-2 md:h-3 md:w-3 bg-primary rounded-full"></div>}
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
                        <Button onClick={() => navigate('/dashboard/instructors')} className="w-full justify-start" variant="outline">
                          <Users className="h-4 w-4 mr-2" />
                          강사 관리
                        </Button>
                        <Button onClick={() => navigate('/dashboard/surveys')} className="w-full justify-start" variant="outline">
                          <FileText className="h-4 w-4 mr-2" />
                          설문조사 관리
                        </Button>
                        <Button onClick={() => navigate('/dashboard/results')} className="w-full justify-start" variant="outline">
                          <BarChart className="h-4 w-4 mr-2" />
                          결과 분석
                        </Button>
                        <Button onClick={() => navigate('/')} className="w-full justify-start" variant="outline">
                          <FileText className="h-4 w-4 mr-2" />
                          설문 리스트
                        </Button>
                        <Button onClick={() => navigate('/dashboard/templates')} className="w-full justify-start" variant="outline">
                          <FileText className="h-4 w-4 mr-2" />
                          템플릿 관리
                        </Button>
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

          <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-2 sm:px-4">
            <h1 className="text-sm sm:text-base md:text-2xl font-bold text-primary text-center break-words max-w-full">BS/SS 교육과정</h1>
            <p className="text-xs md:text-sm text-muted-foreground text-center break-words max-w-full">교육생 피드백 시스템</p>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant={!showAllSurveys ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowAllSurveys((v) => !v)}
              className="text-xs px-2 py-1 h-8 min-w-0 whitespace-nowrap"
            >
              <FileText className="h-3 w-3 mr-1 shrink-0" />
              <span className="hidden xs:inline">{showAllSurveys ? '전체' : '오늘'}</span>
              <span className="xs:hidden">{showAllSurveys ? '전체' : '오늘'}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-6 md:py-8">
        <div className="mb-6 md:mb-8 text-center px-2">
          <h2 className="text-lg md:text-3xl font-bold mb-2 md:mb-4 break-words">{showAllSurveys ? '📝 전체 설문조사' : '📝 오늘의 설문조사'}</h2>
          <p className="text-muted-foreground text-sm md:text-base break-words">
            {showAllSurveys ? '모든 활성 설문조사를 확인하세요' : '진행 중인 설문조사에 참여해 주세요'}
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
                {showAllSurveys ? '활성 설문조사가 없습니다' : '진행 중인 설문조사가 없습니다'}
              </h3>
              <p className="text-muted-foreground text-sm md:text-base break-words">
                {showAllSurveys ? '현재 활성화된 설문조사가 없습니다' : '현재 진행 중인 설문조사가 없습니다'}
                <br />
                새로운 설문조사가 시작되면 알려드릴게요! 📢
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-8">
            {Object.entries(groupedSurveys).map(([roundTitle, roundSurveys]) => (
              <div key={roundTitle} className="animate-fade-in">
                <Collapsible open={openGroups[roundTitle] || false} onOpenChange={() => toggleGroup(roundTitle)}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-3 mb-4 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors">
                      <Badge variant="default" className="text-sm px-3 py-1">
                        🎓 {roundTitle}
                      </Badge>
                      <div className="flex-1 h-px bg-border"></div>
                      <span className="text-xs text-muted-foreground mr-2">{roundSurveys.length}개 설문</span>
                      {openGroups[roundTitle] ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="mb-6">
                      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 px-1">
                        {roundSurveys.map((survey) => (
                          <Card
                            key={survey.id}
                            className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-primary/30 hover:border-l-primary cursor-pointer max-w-full overflow-hidden"
                          >
                            <CardHeader className="pb-3 p-4 sm:p-6">
                              <div className="flex justify-between items-start gap-2">
                                <div className="space-y-1 flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <CardTitle className="text-sm sm:text-base md:text-lg group-hover:text-primary transition-colors line-clamp-2 break-words hyphens-auto">
                                      {survey.title}
                                    </CardTitle>
                                    {completedSurveys.has(survey.id) && <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                  {completedSurveys.has(survey.id) ? (
                                    <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                                      완료
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-xs">진행중</Badge>
                                  )}
                                </div>
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
                                        minute: '2-digit',
                                      })}
                                    </span>
                                    <span className="block sm:inline sm:before:content-['_~_']">
                                      {new Date(survey.end_date).toLocaleString('ko-KR', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </span>
                                </div>
                                {(() => {
                                  const now = new Date();
                                  const startDate = new Date(survey.start_date);
                                  const endDate = new Date(survey.end_date);
                                  const isActive = now >= startDate && now <= endDate;
                                  const isUpcoming = now < startDate;
                                  const isCompleted = completedSurveys.has(survey.id);

                                  return (
                                    <Button
                                      className="w-full group-hover:bg-primary/90 transition-colors touch-friendly min-h-[44px] text-sm"
                                      onClick={() => navigate(`/survey/${survey.id}`)}
                                      disabled={!isActive || isCompleted}
                                      variant={isCompleted ? 'outline' : 'default'}
                                    >
                                      {isCompleted && <CheckCircle className="h-4 w-4 mr-2 text-green-500" />}
                                      <FileText className="h-4 w-4 mr-2 shrink-0" />
                                      {isCompleted ? '참여 완료' : isActive ? '설문 참여하기' : isUpcoming ? '시작 전' : '마감됨'}
                                    </Button>
                                  );
                                })()}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
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