import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DonutChart } from '@/components/charts/DonutChart';
import { AreaChart } from '@/components/charts/AreaChart';
import { BarChart } from 'recharts';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Bar, Legend } from 'recharts';
import { TrendingUp, BookOpen, Star, Target, TrendingDown, Minus, Download, User, Crown, AlertCircle, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCourseReportsData } from '@/hooks/useCourseReportsData';
import CourseSelector from '@/components/course-reports/CourseSelector';
import InstructorStatsSection from '@/components/course-reports/InstructorStatsSection';
import { SatisfactionStatusBadge } from '@/components/course-reports/SatisfactionStatusBadge';
import { DrillDownModal } from '@/components/course-reports/DrillDownModal';
import { KeywordCloud } from '@/components/course-reports/KeywordCloud';
import { generateCourseReportPDF } from '@/utils/pdfExport';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';

const CourseReports = () => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [selectedInstructor, setSelectedInstructor] = useState<string>('');
  const [drillDownModal, setDrillDownModal] = useState<{
    isOpen: boolean;
    type: 'instructor' | 'course' | 'operation';
    title: string;
  }>({ isOpen: false, type: 'instructor', title: '' });
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userRoles, user, signOut } = useAuth();
  
  // 권한 확인
  const isInstructor = userRoles.includes('instructor');
  const isAdmin = userRoles.includes('admin');

  const {
    reports,
    previousReports,
    trendData,
    instructorStats,
    availableCourses,
    availableRounds,
    availableInstructors,
    textualResponses,
    courseStatistics,
    yearlyComparison,
    loading,
    fetchAvailableCourses,
    fetchReports,
    fetchYearlyComparison,
    isInstructor: hookIsInstructor,
    instructorId
  } = useCourseReportsData(selectedYear, selectedCourse, selectedRound, selectedInstructor);

  useEffect(() => {
    fetchAvailableCourses();
  }, [selectedYear]);

  useEffect(() => {
    if (selectedCourse || selectedRound || selectedInstructor) {
      fetchReports();
    }
  }, [selectedCourse, selectedRound, selectedInstructor, instructorId]);

  useEffect(() => {
    // 첫 번째 과정 자동 선택
    if (availableCourses.length > 0 && !selectedCourse) {
      setSelectedCourse(availableCourses[0].key);
    }
  }, [availableCourses, selectedCourse]);

  const handleInstructorClick = (instructorId: string) => {
    navigate(`/dashboard/instructor-details/${instructorId}?year=${selectedYear}`);
  };

  const handlePDFExport = () => {
    if (!currentReport) {
      toast({
        title: "오류",
        description: "내보낼 데이터가 없습니다.",
        variant: "destructive"
      });
      return;
    }

    try {
      generateCourseReportPDF({
        reportTitle: isInstructor ? '개인 과정별 운영 결과 보고서' : '과정별 운영 결과 보고서',
        year: currentReport.education_year,
        round: currentReport.education_round > 0 ? currentReport.education_round : undefined,
        courseName: currentReport.course_title,
        totalSurveys: currentReport.total_surveys,
        totalResponses: currentReport.total_responses,
        instructorCount: currentReport.report_data?.instructor_count || 0,
        avgInstructorSatisfaction: currentReport.avg_instructor_satisfaction,
        avgCourseSatisfaction: currentReport.avg_course_satisfaction,
        avgOperationSatisfaction: currentReport.report_data?.operation_satisfaction || 0,
        instructorStats: instructorStats.map(stat => ({
          name: stat.instructor_name,
          surveyCount: stat.survey_count,
          responseCount: stat.response_count,
          avgSatisfaction: stat.avg_satisfaction
        }))
      });

      toast({
        title: "성공",
        description: "PDF 파일이 다운로드되었습니다.",
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: "오류",
        description: "PDF 내보내기 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const currentReport = reports[0];
  const previousReport = previousReports[0];

  // 증감률 계산 함수
  const calculateChange = (current: number, previous: number) => {
    if (!previous || previous === 0) return null;
    const change = current - previous;
    const percentage = (change / previous) * 100;
    return { change, percentage };
  };

  // KPI 증감치 계산
  const surveyChange = previousReport ? calculateChange(currentReport?.total_surveys || 0, previousReport.total_surveys) : null;
  const responseChange = previousReport ? calculateChange(currentReport?.total_responses || 0, previousReport.total_responses) : null;
  const instructorChange = previousReport ? calculateChange(currentReport?.avg_instructor_satisfaction || 0, previousReport.avg_instructor_satisfaction) : null;

  // 강사 만족도 트렌드 차트 데이터 준비
  const instructorTrendData = instructorStats.map(instructor => ({
    name: instructor.instructor_name,
    만족도: Number(instructor.avg_satisfaction.toFixed(1)),
    응답수: instructor.response_count
  }));

  // 차트 데이터 준비 (과정별로 변경)
  const satisfactionChartData = currentReport ? [
    { name: '강사 만족도', value: currentReport.avg_instructor_satisfaction, color: 'hsl(var(--primary))' },
    { name: '과정 만족도', value: currentReport.avg_course_satisfaction, color: 'hsl(var(--primary) / 0.8)' },
    { name: '운영 만족도', value: currentReport.report_data?.operation_satisfaction || 0, color: 'hsl(var(--primary) / 0.6)' }
  ] : [];

  // 이번 차수 막대그래프 데이터
  const currentRoundData = currentReport ? [
    { name: '강사 만족도', value: currentReport.avg_instructor_satisfaction },
    { name: '과정 만족도', value: currentReport.avg_course_satisfaction },
    { name: '운영 만족도', value: currentReport.report_data?.operation_satisfaction || 0 }
  ] : [];

  // 종합 만족도 계산
  const overallSatisfaction = currentReport ? 
    (currentReport.avg_instructor_satisfaction + currentReport.avg_course_satisfaction + (currentReport.report_data?.operation_satisfaction || 0)) / 3 : 0;

  // 응답률 계산
  const responseRate = currentReport && currentReport.total_surveys > 0 ? 
    (currentReport.total_responses / (currentReport.total_surveys * 20)) * 100 : 0; // 가정: 설문당 평균 20명 예상

  // 전년도 대비 비교 데이터 준비
  const yearlyComparisonData = (() => {
    if (!yearlyComparison.current.length || !yearlyComparison.previous.length) {
      return [];
    }

    const currentYearAvg = {
      instructor: yearlyComparison.current
        .filter(s => s.instructor_satisfaction !== null)
        .reduce((sum, s) => sum + (s.instructor_satisfaction || 0), 0) / 
        yearlyComparison.current.filter(s => s.instructor_satisfaction !== null).length || 0,
      course: yearlyComparison.current
        .filter(s => s.course_satisfaction !== null)
        .reduce((sum, s) => sum + (s.course_satisfaction || 0), 0) / 
        yearlyComparison.current.filter(s => s.course_satisfaction !== null).length || 0,
      operation: yearlyComparison.current
        .filter(s => s.operation_satisfaction !== null)
        .reduce((sum, s) => sum + (s.operation_satisfaction || 0), 0) / 
        yearlyComparison.current.filter(s => s.operation_satisfaction !== null).length || 0
    };

    const previousYearAvg = {
      instructor: yearlyComparison.previous
        .filter(s => s.instructor_satisfaction !== null)
        .reduce((sum, s) => sum + (s.instructor_satisfaction || 0), 0) / 
        yearlyComparison.previous.filter(s => s.instructor_satisfaction !== null).length || 0,
      course: yearlyComparison.previous
        .filter(s => s.course_satisfaction !== null)
        .reduce((sum, s) => sum + (s.course_satisfaction || 0), 0) / 
        yearlyComparison.previous.filter(s => s.course_satisfaction !== null).length || 0,
      operation: yearlyComparison.previous
        .filter(s => s.operation_satisfaction !== null)
        .reduce((sum, s) => sum + (s.operation_satisfaction || 0), 0) / 
        yearlyComparison.previous.filter(s => s.operation_satisfaction !== null).length || 0
    };

    return [
      {
        category: '강사 만족도',
        [`${selectedYear}년`]: Number(currentYearAvg.instructor.toFixed(1)),
        [`${selectedYear - 1}년`]: Number(previousYearAvg.instructor.toFixed(1))
      },
      {
        category: '과정 만족도',
        [`${selectedYear}년`]: Number(currentYearAvg.course.toFixed(1)),
        [`${selectedYear - 1}년`]: Number(previousYearAvg.course.toFixed(1))
      },
      {
        category: '운영 만족도',
        [`${selectedYear}년`]: Number(currentYearAvg.operation.toFixed(1)),
        [`${selectedYear - 1}년`]: Number(previousYearAvg.operation.toFixed(1))
      }
    ];
  })();

  // 드릴다운 모달 열기
  const openDrillDown = (type: 'instructor' | 'course' | 'operation') => {
    const titles = {
      instructor: '강사 만족도',
      course: '과정 만족도', 
      operation: '운영 만족도'
    };
    setDrillDownModal({ isOpen: true, type, title: titles[type] });
  };

  if (loading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AdminSidebar />
          <main className="flex-1 flex flex-col">
            <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-40 shadow-sm">
              <div className="container mx-auto px-4 py-3 md:py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <SidebarTrigger />
                  <div className="h-10 w-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-neon">
                    <BarChart3 className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-base md:text-2xl font-bold bg-gradient-accent bg-clip-text text-transparent">과정별 분석</h1>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      {isInstructor ? '내 담당 과정 결과 분석' : '전체 과정 운영 결과'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs md:text-sm hidden sm:block">환영합니다, {user?.email}</span>
                  <Button onClick={signOut} variant="outline" size="sm">로그아웃</Button>
                </div>
              </div>
            </header>
            <div className="flex-1 flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">데이터를 불러오는 중...</p>
              </div>
            </div>
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        
        <main className="flex-1 flex flex-col">
          {/* Header */}
          <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-40 shadow-sm">
            <div className="container mx-auto px-4 py-3 md:py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div className="h-10 w-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-neon">
                  <BarChart3 className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-base md:text-2xl font-bold bg-gradient-accent bg-clip-text text-transparent">과정별 분석</h1>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    {isInstructor ? '내 담당 과정 결과 분석' : '전체 과정 운영 결과'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentReport && (
                  <Button onClick={handlePDFExport} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    PDF 내보내기
                  </Button>
                )}
                <span className="text-xs md:text-sm hidden sm:block">환영합니다, {user?.email}</span>
                <Button onClick={signOut} variant="outline" size="sm">로그아웃</Button>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 container mx-auto px-4 py-6 space-y-6">
            {/* 권한별 알림 섹션 */}
            {isInstructor && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-blue-600" />
                    <div>
                      <h3 className="font-medium text-blue-900">개인 과정 분석</h3>
                      <p className="text-sm text-blue-700">
                        회원님이 담당하신 과정들의 만족도 결과만 표시됩니다.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {isAdmin && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Crown className="h-5 w-5 text-green-600" />
                    <div>
                      <h3 className="font-medium text-green-900">전체 과정 분석</h3>
                      <p className="text-sm text-green-700">
                        모든 강사의 과정 결과를 확인하고 비교 분석할 수 있습니다.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 강사가 데이터가 없을 때 */}
            {isInstructor && instructorId && reports.length === 0 && !loading && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-6 text-center">
                  <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                  <h3 className="font-medium text-orange-900 mb-2">설문 데이터가 없습니다</h3>
                  <p className="text-sm text-orange-700 mb-4">
                    아직 담당하신 과정의 설문 결과가 없습니다.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/dashboard/templates')}
                    className="border-orange-300 text-orange-700 hover:bg-orange-100"
                  >
                    설문 템플릿 관리로 이동
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="bg-gradient-to-br from-primary/5 via-primary/10 to-secondary/5 rounded-xl p-6 border border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                    {isInstructor ? '개인 과정별 운영 결과' : '과정별 운영 결과 보고'}
                  </h1>
                </div>
              </div>
              <p className="text-muted-foreground">
                {isInstructor 
                  ? '내가 담당한 과정별 종합적인 만족도 조사 결과를 확인할 수 있습니다.'
                  : '과정별 종합적인 만족도 조사 결과와 강사별 통계를 확인할 수 있습니다.'
                }
              </p>
            </div>

            {/* 필터 */}
            <CourseSelector
              selectedYear={selectedYear}
              selectedCourse={selectedCourse}
              selectedRound={selectedRound}
              selectedInstructor={selectedInstructor}
              availableCourses={availableCourses}
              availableRounds={availableRounds}
              availableInstructors={isInstructor ? [] : availableInstructors} // 강사는 강사 필터 숨김
              years={years}
              onYearChange={(value) => setSelectedYear(Number(value))}
              onCourseChange={setSelectedCourse}
              onRoundChange={(value) => setSelectedRound(value ? Number(value) : null)}
              onInstructorChange={setSelectedInstructor}
            />

            {currentReport ? (
              <>
                {/* 1. 상단 KPI 카드 영역 - 이전 차수 대비 증감치 포함 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="relative overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <BookOpen className="h-8 w-8 text-primary" />
                        {surveyChange && (
                          <div className={`flex items-center gap-1 text-sm ${surveyChange.change > 0 ? 'text-green-600' : surveyChange.change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                            {surveyChange.change > 0 ? <TrendingUp className="h-4 w-4" /> : 
                             surveyChange.change < 0 ? <TrendingDown className="h-4 w-4" /> : 
                             <Minus className="h-4 w-4" />}
                            {surveyChange.percentage.toFixed(1)}%
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{isInstructor ? '내 설문 수' : '총 설문 수'}</p>
                      <p className="text-3xl font-bold text-primary">{currentReport.total_surveys}</p>
                    </CardContent>
                  </Card>

                  <Card className="relative overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <Target className="h-8 w-8 text-green-600" />
                        {responseChange && (
                          <div className={`flex items-center gap-1 text-sm ${responseChange.change > 0 ? 'text-green-600' : responseChange.change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                            {responseChange.change > 0 ? <TrendingUp className="h-4 w-4" /> : 
                             responseChange.change < 0 ? <TrendingDown className="h-4 w-4" /> : 
                             <Minus className="h-4 w-4" />}
                            {responseChange.percentage.toFixed(1)}%
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{isInstructor ? '내 응답 수' : '총 응답 수'}</p>
                      <p className="text-3xl font-bold text-green-600">{currentReport.total_responses}</p>
                      <p className="text-xs text-muted-foreground">응답률 {responseRate.toFixed(1)}%</p>
                    </CardContent>
                  </Card>

                  <Card className="relative overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <Star className="h-8 w-8 text-purple-600" />
                      </div>
                      <p className="text-sm text-muted-foreground">{isInstructor ? '참여 강사' : '참여 강사 수'}</p>
                      <p className="text-3xl font-bold text-purple-600">{isInstructor ? '본인' : (currentReport.report_data?.instructor_count || 0)}</p>
                    </CardContent>
                  </Card>

                  <Card className="relative overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <TrendingUp className="h-8 w-8 text-orange-600" />
                        {instructorChange && (
                          <div className={`flex items-center gap-1 text-sm ${instructorChange.change > 0 ? 'text-green-600' : instructorChange.change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                            {instructorChange.change > 0 ? <TrendingUp className="h-4 w-4" /> : 
                             instructorChange.change < 0 ? <TrendingDown className="h-4 w-4" /> : 
                             <Minus className="h-4 w-4" />}
                            {instructorChange.change > 0 ? '+' : ''}{instructorChange.change.toFixed(1)}
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{isInstructor ? '내 평균 점수' : '전체 평균 점수'}</p>
                      <p className="text-3xl font-bold text-orange-600">{overallSatisfaction.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">/ 10.0</p>
                    </CardContent>
                  </Card>
                </div>

                {/* 2. 이번 차수 결과 요약 - 막대그래프, 라인그래프 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>이번 차수 영역별 만족도</CardTitle>
                      <CardDescription>강사, 과정, 운영 만족도 현황</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={currentRoundData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.3)" />
                          <XAxis 
                            dataKey="name" 
                            tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                            axisLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                          />
                          <YAxis 
                            domain={[0, 10]}
                            tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                            axisLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                          />
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              color: 'hsl(var(--card-foreground))'
                            }}
                          />
                          <Bar dataKey="value" fill="hsl(var(--primary))" name="만족도" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* 트렌드 라인 차트 */}
                  {trendData.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>최근 5개 차수 만족도 추이</CardTitle>
                        <CardDescription>차수별 만족도 변화 트렌드</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <AreaChart 
                          data={trendData} 
                          dataKeys={[
                            { key: '강사만족도', label: '강사만족도', color: 'hsl(var(--primary))' },
                            { key: '과정만족도', label: '과정만족도', color: 'hsl(var(--primary) / 0.8)' },
                            { key: '운영만족도', label: '운영만족도', color: 'hsl(var(--primary) / 0.6)' }
                          ]}
                        />
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* 3. 영역별 Drill-down 카드 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openDrillDown('instructor')}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">강사 만족도</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-3xl font-bold text-blue-600">{currentReport.avg_instructor_satisfaction.toFixed(1)}</span>
                        <SatisfactionStatusBadge score={currentReport.avg_instructor_satisfaction} />
                      </div>
                      <Button variant="outline" size="sm" className="w-full">
                        세부 보기
                      </Button>
                    </CardContent>
                  </Card>
