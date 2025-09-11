import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Menu, Clock, Calendar, Users, BarChart, TrendingUp, BookOpen, FileText, Filter } from 'lucide-react';
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

const Index = () => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [allSurveys, setAllSurveys] = useState<Survey[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<'today' | 'all'>('today'); // 기본값: 오늘
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterSurveys();
  }, [selectedCourse, timeFilter, allSurveys]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 활성 설문조사 데이터 조회 (public 설문만)
      const { data: surveyData, error: surveyError } = await supabase
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
        .order('created_at', { ascending: false });

      if (surveyError) {
        console.warn('Error fetching surveys:', surveyError);
        // RLS 오류가 발생해도 빈 배열로 처리
        setAllSurveys([]);
        setSurveys([]);
      } else {
        // 설문 데이터를 바로 표시 (시간 필터링 제거)
        const surveysWithRelations = surveyData || [];
        setAllSurveys(surveysWithRelations);
        setSurveys(surveysWithRelations);
      }

      // 과정 데이터 조회 (선택사항)
      try {
        const { data: courseData } = await supabase
          .from('courses')
          .select('id, title')
          .order('title');
        
        setCourses(courseData || []);
      } catch (courseError) {
        console.warn('Error fetching courses:', courseError);
        setCourses([]);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      // 전체적인 오류가 발생해도 빈 상태로 설정
      setAllSurveys([]);
      setSurveys([]);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const filterSurveys = () => {
    let filtered = allSurveys;
    
    // 과정별 필터링
    if (selectedCourse !== 'all') {
      filtered = filtered.filter(survey => survey.course_id === selectedCourse);
    }
    
    // 시간별 필터링 (오늘/전체)
    if (timeFilter === 'today') {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
      
      filtered = filtered.filter(survey => {
        // start_date가 오늘이거나, start_date가 없고 created_at이 오늘인 경우
        if (survey.start_date) {
          const startDate = new Date(survey.start_date);
          return startDate >= todayStart && startDate <= todayEnd;
        } else {
          // start_date가 없으면 created_at으로 판단
          const createdDate = new Date(survey.created_at);
          return createdDate >= todayStart && createdDate <= todayEnd;
        }
      });
    }
    
    setSurveys(filtered);
  };

  const getStatusBadge = (status: string) => {
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
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2 font-display">설문조사 시스템</h2>
              <p className="text-muted-foreground font-sans">
                참여 가능한 설문조사 목록입니다. 설문조사를 클릭하여 참여해주세요.
              </p>
            </div>
            
            {/* 오늘/전체 선택 버튼 - 우측 상단으로 이동 */}
            <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
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

          {/* 과정별 필터 */}
          {courses.length > 0 && (
            <Card className="mb-6 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-display">
                  <Filter className="h-5 w-5 text-primary" />
                  과정별 필터
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="text-sm font-medium font-sans">과정 선택:</label>
                  <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                    <SelectTrigger className="w-[200px] font-sans">
                      <SelectValue placeholder="과정을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="font-sans">전체 과정</SelectItem>
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={course.id} className="font-sans">
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground font-sans">
                    ({surveys.length}개 설문)
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {surveys.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg font-sans">
                {loading 
                  ? '설문을 불러오는 중입니다...'
                  : timeFilter === 'today'
                    ? selectedCourse === 'all' 
                      ? '오늘 진행중인 설문조사가 없습니다.' 
                      : '선택한 과정에 오늘 진행중인 설문조사가 없습니다.'
                    : selectedCourse === 'all' 
                      ? '현재 진행중인 설문조사가 없습니다.' 
                      : '선택한 과정에 진행중인 설문조사가 없습니다.'
                }
              </p>
              {!loading && (
                <div className="mt-4 space-y-2">
                  {timeFilter === 'today' && (
                    <Button 
                      variant="outline" 
                      onClick={() => setTimeFilter('all')}
                      className="mr-2"
                    >
                      전체 설문 보기
                    </Button>
                  )}
                  {selectedCourse !== 'all' && (
                    <Button 
                      variant="outline" 
                      onClick={() => setSelectedCourse('all')}
                    >
                      모든 과정 보기
                    </Button>
                  )}
                </div>
              )}
              {!loading && surveys.length === 0 && allSurveys.length === 0 && (
                <div className="mt-4 text-sm text-muted-foreground">
                  <p>설문 데이터를 불러올 수 없습니다.</p>
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.reload()}
                    className="mt-2"
                  >
                    페이지 새로고침
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* 과정별로 그룹화하여 표시 */}
              {(() => {
                // 과정별로 설문 그룹화
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
                        <Card key={survey.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <CardTitle className="text-lg font-display">{survey.title}</CardTitle>
                              {getStatusBadge(survey.status)}
                            </div>
                            {survey.description && (
                              <CardDescription className="font-sans">{survey.description}</CardDescription>
                            )}
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 text-sm font-sans">
                              {(() => {
                                // 강사 정보 표시 로직 - 일반화된 방식
                                let instructorName = '';
                                
                                // survey_instructors에서 먼저 확인
                                if (survey.survey_instructors && survey.survey_instructors.length > 0) {
                                  const names = survey.survey_instructors
                                    .map(si => si.instructors.name)
                                    .filter(Boolean);
                                  if (names.length > 0) {
                                    instructorName = names.join(', ');
                                  }
                                }
                                
                                // 개별 instructor 확인 (fallback)
                                if (!instructorName && survey.instructors?.name) {
                                  instructorName = survey.instructors.name;
                                }
                                
                                // 강사 정보가 있으면 항상 표시
                                if (instructorName) {
                                  return (
                                    <div className="flex items-center gap-2">
                                      <Users className="h-4 w-4 text-muted-foreground" />
                                      <span>강사: {instructorName}</span>
                                    </div>
                                  );
                                }
                                return null;
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