import { useState, useEffect, useCallback, useMemo, useRef, KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Menu, Clock, Calendar, Users, BarChart, TrendingUp, BookOpen, FileText, Filter, Search, Hourglass } from 'lucide-react';
import { MobileOptimizedContainer } from '@/components/MobileOptimizedContainer';
import LoadingScreen from '@/components/LoadingScreen';

interface Survey {
  id: string;
  title: string;
  description?: string;
  status: string;
  created_at: string;
  start_date?: string;
  end_date?: string;
  instructor_id?: string;
  course_id?: string;
  course_name?: string;
  survey_instructors?: Array<{
    instructors: {
      id: string;
      name: string;
    };
  }>;
  instructors?: {
    id: string;
    name: string;
  };
  courses?: {
    title: string;
  };
}

interface Course {
  id: string;
  title: string;
}

interface Instructor {
  id: string;
  name: string;
}

interface SurveyParticipation {
  survey: Survey;
  submitted_at: string;
}

const Index = () => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [instructorFilter, setInstructorFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<'today' | 'all'>('today');
  const [recentParticipations, setRecentParticipations] = useState<SurveyParticipation[]>([]);
  const [closingSoonSurveys, setClosingSoonSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const skipUrlSyncRef = useRef(false);
  const { toast } = useToast();

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: '전체 상태' },
      { value: 'active', label: '진행중' },
      { value: 'public', label: '공개' },
      { value: 'completed', label: '완료' },
    ],
    [],
  );

  useEffect(() => {
    skipUrlSyncRef.current = true;
    const q = searchParams.get('q') ?? '';
    const statusParam = searchParams.get('status') ?? 'all';
    const instructorParam = searchParams.get('instructor') ?? 'all';
    const courseParam = searchParams.get('course') ?? 'all';
    const timeParam = (searchParams.get('time') ?? 'today') as 'today' | 'all';

    const allowedStatus = statusOptions.some((option) => option.value === statusParam) ? statusParam : 'all';
    const allowedTime = timeParam === 'all' ? 'all' : 'today';

    setSearchTerm(q);
    setStatusFilter(allowedStatus);
    setInstructorFilter(instructorParam);
    setCourseFilter(courseParam);
    setTimeFilter(allowedTime);
  }, [searchParams, statusOptions]);

  useEffect(() => {
    if (skipUrlSyncRef.current) {
      skipUrlSyncRef.current = false;
      return;
    }

    const params = new URLSearchParams();
    if (searchTerm) {
      params.set('q', searchTerm);
    }
    if (statusFilter !== 'all') {
      params.set('status', statusFilter);
    }
    if (instructorFilter !== 'all') {
      params.set('instructor', instructorFilter);
    }
    if (courseFilter !== 'all') {
      params.set('course', courseFilter);
    }
    if (timeFilter !== 'today') {
      params.set('time', timeFilter);
    }

    const current = searchParams.toString();
    const next = params.toString();
    if (current !== next) {
      setSearchParams(params, { replace: true });
    }
  }, [searchTerm, statusFilter, instructorFilter, courseFilter, timeFilter, searchParams, setSearchParams]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);

      let query = supabase
        .from('surveys')
        .select(`
          id,
          title,
          description,
          status,
          created_at,
          start_date,
          end_date,
          instructor_id,
          course_id,
          course_name,
          survey_instructors (
            instructors (id, name)
          ),
          instructors (id, name)
        `);

      if (statusFilter === 'all') {
        query = query.in('status', ['active', 'public']);
      } else {
        query = query.eq('status', statusFilter);
      }

      if (courseFilter !== 'all') {
        query = query.eq('course_id', courseFilter);
      }

      if (instructorFilter !== 'all') {
        query = query.or(`instructor_id.eq.${instructorFilter},survey_instructors.instructor_id.eq.${instructorFilter}`);
      }

      const sanitizedSearchTerm = searchTerm.replace(/,/g, '\\,').trim();
      if (sanitizedSearchTerm) {
        query = query.or(`title.ilike.%${sanitizedSearchTerm}%,description.ilike.%${sanitizedSearchTerm}%`);
      }

      if (timeFilter === 'today') {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
        const startIso = start.toISOString();
        const endIso = end.toISOString();
        query = query.or(
          `and(start_date.gte.${startIso},start_date.lte.${endIso}),and(start_date.is.null,created_at.gte.${startIso},created_at.lte.${endIso})`,
        );
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setSurveys(data ?? []);
    } catch (error) {
      console.error('Error fetching surveys:', error);
      setFetchError('설문 데이터를 불러오는 중 오류가 발생했습니다.');
      setSurveys([]);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '설문 목록을 불러오지 못했습니다.',
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, courseFilter, instructorFilter, searchTerm, timeFilter, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select('id, title')
          .order('title');

        if (courseError) {
          throw courseError;
        }

        setCourses(courseData || []);
      } catch (error) {
        console.warn('Error fetching courses:', error);
        setCourses([]);
      }

      try {
        const { data: instructorData, error: instructorError } = await supabase
          .from('instructors')
          .select('id, name')
          .order('name');

        if (instructorError) {
          throw instructorError;
        }

        setInstructors(instructorData || []);
      } catch (error) {
        console.warn('Error fetching instructors:', error);
        setInstructors([]);
      }
    };

    loadFilterOptions();
  }, []);

  const fetchRecommendations = useCallback(async () => {
    try {
      setRecommendationsLoading(true);

      if (!user?.email) {
        setRecentParticipations([]);
        setClosingSoonSurveys([]);
        return;
      }

      const { data: participationData, error: participationError } = await supabase
        .from('survey_responses')
        .select(`
          id,
          submitted_at,
          survey_id,
          surveys (
            id,
            title,
            description,
            status,
            created_at,
            start_date,
            end_date,
            instructor_id,
            course_id,
            course_name,
            survey_instructors (
              instructors (id, name)
            ),
            instructors (id, name)
          )
        `)
        .eq('respondent_email', user.email)
        .order('submitted_at', { ascending: false })
        .limit(4);

      if (participationError) {
        throw participationError;
      }

      const recentItems: SurveyParticipation[] = (participationData || [])
        .filter((item): item is typeof item & { surveys: Survey } => Boolean(item.surveys))
        .map((item) => ({
          survey: item.surveys,
          submitted_at: item.submitted_at,
        }));

      setRecentParticipations(recentItems);

      const now = new Date();
      const upcomingLimit = new Date(now);
      upcomingLimit.setDate(upcomingLimit.getDate() + 7);
      const nowIso = now.toISOString();
      const upcomingIso = upcomingLimit.toISOString();

      const { data: closingSoonData, error: closingSoonError } = await supabase
        .from('surveys')
        .select(`
          id,
          title,
          description,
          status,
          created_at,
          start_date,
          end_date,
          instructor_id,
          course_id,
          course_name,
          survey_instructors (
            instructors (id, name)
          ),
          instructors (id, name)
        `)
        .in('status', ['active', 'public'])
        .not('end_date', 'is', null)
        .gte('end_date', nowIso)
        .lte('end_date', upcomingIso)
        .order('end_date', { ascending: true })
        .limit(4);

      if (closingSoonError) {
        throw closingSoonError;
      }

      setClosingSoonSurveys(closingSoonData || []);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setRecentParticipations([]);
      setClosingSoonSurveys([]);
    } finally {
      setRecommendationsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const filterSummaryBadges = useMemo(() => {
    const badges: string[] = [];

    badges.push(timeFilter === 'today' ? '오늘 설문' : '전체 기간');

    const statusLabel = statusOptions.find((option) => option.value === statusFilter)?.label ?? '전체 상태';
    badges.push(`상태: ${statusLabel}`);

    const courseLabel = courseFilter === 'all'
      ? '전체 과정'
      : courses.find((course) => course.id === courseFilter)?.title ?? '선택한 과정';
    badges.push(`과정: ${courseLabel}`);

    const instructorLabel = instructorFilter === 'all'
      ? '전체 강사'
      : instructors.find((instructor) => instructor.id === instructorFilter)?.name ?? '선택한 강사';
    badges.push(`강사: ${instructorLabel}`);

    if (searchTerm) {
      badges.push(`검색: ${searchTerm}`);
    }

    return badges;
  }, [timeFilter, statusFilter, courseFilter, instructorFilter, searchTerm, courses, instructors, statusOptions]);

  const emptyStateMessage = useMemo(() => {
    if (loading) {
      return '설문을 불러오는 중입니다...';
    }

    if (fetchError) {
      return fetchError;
    }

    if (searchTerm) {
      return '검색 조건에 맞는 설문조사가 없습니다.';
    }

    if (timeFilter === 'today') {
      if (courseFilter !== 'all' && instructorFilter !== 'all') {
        return '선택한 과정과 강사에 오늘 진행중인 설문이 없습니다.';
      }
      if (courseFilter !== 'all') {
        return '선택한 과정에 오늘 진행중인 설문조사가 없습니다.';
      }
      if (instructorFilter !== 'all') {
        return '선택한 강사의 오늘 설문이 없습니다.';
      }
      if (statusFilter !== 'all') {
        return '선택한 상태의 오늘 설문조사가 없습니다.';
      }
      return '오늘 진행중인 설문조사가 없습니다.';
    }

    if (courseFilter !== 'all' && instructorFilter !== 'all') {
      return '선택한 과정과 강사에 해당하는 설문이 없습니다.';
    }
    if (courseFilter !== 'all') {
      return '선택한 과정에 진행중인 설문조사가 없습니다.';
    }
    if (instructorFilter !== 'all') {
      return '선택한 강사의 설문조사가 없습니다.';
    }
    if (statusFilter !== 'all') {
      return '선택한 상태의 설문조사가 없습니다.';
    }

    return '현재 진행중인 설문조사가 없습니다.';
  }, [loading, fetchError, searchTerm, timeFilter, courseFilter, instructorFilter, statusFilter]);

  const getInstructorNames = (survey: Survey): string | null => {
    let instructorName = '';

    if (survey.survey_instructors && survey.survey_instructors.length > 0) {
      const names = survey.survey_instructors
        .map((item) => item.instructors?.name)
        .filter(Boolean) as string[];
      if (names.length > 0) {
        instructorName = names.join(', ');
      }
    }

    if (!instructorName && survey.instructors?.name) {
      instructorName = survey.instructors.name;
    }

    return instructorName || null;
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setInstructorFilter('all');
    setCourseFilter('all');
    setTimeFilter('today');
  };

  const getStatusBadge = (status: string, endDate?: string | null): JSX.Element => {
    // 종료 날짜가 있고 현재 시간이 종료 날짜를 지났으면 "완료"로 표시
    if (endDate) {
      const now = new Date();
      const end = new Date(endDate);
      if (now > end) {
        return <Badge variant="secondary" className="font-sans">완료됨</Badge>;
      }
    }
    
    switch (status) {
      case 'active':
        return <Badge variant="default" className="font-sans">진행중</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="font-sans">완료</Badge>;
      default:
        return <Badge variant="outline" className="font-sans">준비중</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  const handleSurveyNavigation = (surveyId: string) => {
    navigate(`/survey/${surveyId}`);
  };

  const handleCardKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    surveyId: string,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSurveyNavigation(surveyId);
    }
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
              <h1 className="text-2xl font-bold text-primary font-display">설문조사 시스템</h1>

              {user ? (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Menu className="h-4 w-4" />
                      <span className="sr-only">메뉴 열기</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[280px] sm:w-80 p-4 max-w-[90vw]">
                    <div className="space-y-6 mt-6 overflow-y-auto max-h-[calc(100vh-80px)]">
                      <div className="border-b pb-4">
                        <h2 className="text-lg font-semibold text-primary font-display">관리자 메뉴</h2>
                        <p className="text-sm text-muted-foreground mt-1 break-words font-sans">환영합니다, {user.email}</p>
                      </div>
                      <div className="space-y-3">
                        <Button onClick={() => navigate('/dashboard')} className="w-full justify-start" variant="default">
                          <BarChart className="h-4 w-4 mr-2" />
                          관리 대시보드
                        </Button>
                        
                        {/* 강사 전용 메뉴 추가 */}
                        <div className="border-t pt-3">
                          <h3 className="text-sm font-medium text-muted-foreground mb-2 font-sans">📊 내 피드백</h3>
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
                          <h3 className="text-sm font-medium text-muted-foreground mb-2 font-sans">🔧 관리</h3>
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
                          <h3 className="text-sm font-medium text-muted-foreground mb-2 font-sans">📋 기타</h3>
                          <Button onClick={() => navigate('/')} className="w-full justify-start" variant="outline">
                            <FileText className="h-4 w-4 mr-2" />
                            설문 리스트
                          </Button>
                        </div>
                      </div>
                      <Button onClick={() => window.location.href = '/auth'} variant="ghost" className="w-full text-muted-foreground">
                        로그아웃
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              ) : (
                <Button onClick={() => navigate('/auth')} variant="default" size="sm">
                  로그인
                </Button>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {filterSummaryBadges.map((badgeLabel, index) => (
                <Badge key={`${badgeLabel}-${index}`} variant="outline" className="font-sans">
                  {badgeLabel}
                </Badge>
              ))}
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 space-y-8">
          <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-2 font-display">설문조사 시스템</h2>
                <p className="text-muted-foreground font-sans">
                  참여 가능한 설문조사 목록입니다. 설문조사를 클릭하여 참여해주세요.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start rounded-lg bg-muted p-1">
                <Button
                  variant={timeFilter === 'today' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTimeFilter('today')}
                  className="px-4 py-2"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  오늘 설문
                </Button>
                <Button
                  variant={timeFilter === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTimeFilter('all')}
                  className="px-4 py-2"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  전체 설문
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="shadow-sm h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg font-display">
                    <Clock className="h-5 w-5 text-primary" />
                    최근 참여 설문
                  </CardTitle>
                  <CardDescription className="font-sans">
                    최근에 응답한 설문을 다시 확인해보세요.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {recommendationsLoading ? (
                    <p className="text-sm text-muted-foreground text-center font-sans">
                      추천 설문을 불러오는 중입니다.
                    </p>
                  ) : user?.email ? (
                    recentParticipations.length > 0 ? (
                      <div className="space-y-3">
                        {recentParticipations.map((item) => {
                          const instructorName = getInstructorNames(item.survey);
                          return (
                            <div
                              key={`${item.survey.id}-${item.submitted_at}`}
                              role="button"
                              tabIndex={0}
                              onClick={() => handleSurveyNavigation(item.survey.id)}
                              onKeyDown={(event) => handleCardKeyDown(event, item.survey.id)}
                              className="rounded-lg border bg-muted/40 p-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-foreground flex-1 truncate" title={item.survey.title}>
                                  {item.survey.title}
                                </span>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatDate(item.submitted_at)}
                                </span>
                              </div>
                              {instructorName && (
                                <p className="mt-1 text-xs text-muted-foreground truncate" title={instructorName}>
                                  강사: {instructorName}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center font-sans">
                        최근에 참여한 설문이 없습니다.
                      </p>
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground text-center font-sans">
                      로그인하면 최근 참여 설문을 확인할 수 있습니다.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg font-display">
                    <Hourglass className="h-5 w-5 text-primary" />
                    마감 임박
                  </CardTitle>
                  <CardDescription className="font-sans">
                    마감이 가까운 설문을 놓치지 마세요.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {recommendationsLoading ? (
                    <p className="text-sm text-muted-foreground text-center font-sans">
                      추천 설문을 불러오는 중입니다.
                    </p>
                  ) : closingSoonSurveys.length > 0 ? (
                    <div className="space-y-3">
                      {closingSoonSurveys.map((survey) => {
                        const instructorName = getInstructorNames(survey);
                        return (
                          <div
                            key={survey.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleSurveyNavigation(survey.id)}
                            onKeyDown={(event) => handleCardKeyDown(event, survey.id)}
                            className="rounded-lg border bg-muted/40 p-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-foreground flex-1 truncate" title={survey.title}>
                                {survey.title}
                              </span>
                              {survey.end_date && (
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  마감 {formatDate(survey.end_date)}
                                </span>
                              )}
                            </div>
                            {instructorName && (
                              <p className="mt-1 text-xs text-muted-foreground truncate" title={instructorName}>
                                강사: {instructorName}
                              </p>
                            )}
                            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                              <span className="truncate" title={survey.course_name || '기타 과정'}>
                                {survey.course_name || '기타 과정'}
                              </span>
                              <div className="shrink-0">
                                {getStatusBadge(survey.status, survey.end_date)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center font-sans">
                      마감이 임박한 설문이 없습니다.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-display">
                <Filter className="h-5 w-5 text-primary" />
                설문 필터
              </CardTitle>
              <CardDescription className="font-sans">
                검색어나 조건을 선택해 원하는 설문을 찾아보세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium font-sans" htmlFor="survey-search">
                    검색어
                  </label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="survey-search"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="설문 제목이나 설명을 입력하세요"
                      className="pl-9 font-sans"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium font-sans">상태</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="mt-1 font-sans">
                      <SelectValue placeholder="상태를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="font-sans">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium font-sans">강사</label>
                  <Select value={instructorFilter} onValueChange={setInstructorFilter}>
                    <SelectTrigger className="mt-1 font-sans">
                      <SelectValue placeholder="강사를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="font-sans">
                        전체 강사
                      </SelectItem>
                      {instructors.map((instructor) => (
                        <SelectItem key={instructor.id} value={instructor.id} className="font-sans">
                          {instructor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium font-sans">과정</label>
                  <Select value={courseFilter} onValueChange={setCourseFilter}>
                    <SelectTrigger className="mt-1 font-sans">
                      <SelectValue placeholder="과정을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="font-sans">
                        전체 과정
                      </SelectItem>
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={course.id} className="font-sans">
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground font-sans">
                  총 {surveys.length}개의 설문이 검색되었습니다.
                </span>
                <Button variant="ghost" size="sm" onClick={resetFilters} className="font-sans">
                  필터 초기화
                </Button>
              </div>
            </CardContent>
          </Card>

          {surveys.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-lg bg-muted/30">
              <p className="text-muted-foreground text-lg font-sans">{emptyStateMessage}</p>
              {!loading && !fetchError && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {timeFilter === 'today' && (
                    <Button variant="outline" onClick={() => setTimeFilter('all')} className="font-sans">
                      전체 설문 보기
                    </Button>
                  )}
                  {(searchTerm || statusFilter !== 'all' || instructorFilter !== 'all' || courseFilter !== 'all') && (
                    <Button variant="outline" onClick={resetFilters} className="font-sans">
                      필터 초기화
                    </Button>
                  )}
                </div>
              )}
              {fetchError && (
                <Button variant="outline" onClick={() => fetchData()} className="mt-4 font-sans">
                  다시 불러오기
                </Button>
              )}
            </div>
          ) : (
            <>
              {(() => {
                const groupedSurveys = surveys.reduce((groups, survey) => {
                  const courseName = survey.course_name || '기타';
                  if (!groups[courseName]) {
                    groups[courseName] = [];
                  }
                  groups[courseName].push(survey);
                  return groups;
                }, {} as Record<string, Survey[]>);

                return Object.entries(groupedSurveys).map(([courseName, courseSurveys]) => (
                  <div key={courseName} className="mb-8">
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-foreground font-display flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        {courseName}
                        <Badge variant="secondary" className="ml-2 font-sans">
                          {courseSurveys.length}개
                        </Badge>
                      </h3>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {courseSurveys.map((survey) => (
                        <Card
                          key={survey.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`${survey.title} 설문 참여하기`}
                          onClick={() => handleSurveyNavigation(survey.id)}
                          onKeyDown={(event) => handleCardKeyDown(event, survey.id)}
                          className="cursor-pointer hover:shadow-lg transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        >
                          <CardHeader>
                            <div className="flex items-start justify-between gap-4">
                              <CardTitle className="text-lg font-display truncate" title={survey.title}>
                                {survey.title}
                              </CardTitle>
                              {getStatusBadge(survey.status, survey.end_date)}
                            </div>
                            {survey.description && (
                              <CardDescription className="font-sans truncate" title={survey.description}>
                                {survey.description}
                              </CardDescription>
                            )}
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 text-sm font-sans">
                              {(() => {
                                const instructorName = getInstructorNames(survey);
                                if (!instructorName) {
                                  return null;
                                }
                                return (
                                  <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                    <span className="truncate" title={instructorName}>
                                      강사: {instructorName}
                                    </span>
                                  </div>
                                );
                              })()}
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>생성일: {formatDate(survey.created_at)}</span>
                              </div>
                              {(survey.start_date || survey.end_date) && (
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span>
                                    {survey.start_date && `시작: ${formatDate(survey.start_date)}`}
                                    {survey.start_date && survey.end_date && ' | '}
                                    {survey.end_date && `종료: ${formatDate(survey.end_date)}`}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="mt-4 flex items-center justify-between text-primary font-medium font-sans">
                              <span>설문 참여하기</span>
                              <span aria-hidden="true">→</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </>
          )}
        </main>
      </div>
    </MobileOptimizedContainer>
  );
};

export default Index;