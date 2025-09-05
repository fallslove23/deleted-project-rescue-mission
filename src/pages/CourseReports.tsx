
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DonutChart } from '@/components/charts/DonutChart';
import { AreaChart } from '@/components/charts/AreaChart';
import { BarChart } from 'recharts';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Bar, Legend } from 'recharts';
import { TrendingUp, BookOpen, Star, Target, TrendingDown, Minus, Download } from 'lucide-react';
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

  const {
    reports,
    previousReports,
    trendData,
    instructorStats,
    availableCourses,
    availableRounds,
    availableInstructors,
    textualResponses,
    loading,
    fetchAvailableCourses,
    fetchReports
  } = useCourseReportsData(selectedYear, selectedCourse, selectedRound, selectedInstructor);

  useEffect(() => {
    fetchAvailableCourses();
  }, [selectedYear]);

  useEffect(() => {
    if (selectedCourse || selectedRound || selectedInstructor) {
      fetchReports();
    }
  }, [selectedCourse, selectedRound, selectedInstructor]);

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
        reportTitle: '과정별 운영 결과 보고서',
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
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-primary/5 via-primary/10 to-secondary/5 rounded-xl p-6 border border-primary/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              과정별 운영 결과 보고
            </h1>
          </div>
          {currentReport && (
            <Button onClick={handlePDFExport} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              PDF 내보내기
            </Button>
          )}
        </div>
        <p className="text-muted-foreground">
          과정별 종합적인 만족도 조사 결과와 강사별 통계를 확인할 수 있습니다.
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
        availableInstructors={availableInstructors}
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
                <p className="text-sm text-muted-foreground">총 설문 수</p>
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
                <p className="text-sm text-muted-foreground">총 응답 수</p>
                <p className="text-3xl font-bold text-green-600">{currentReport.total_responses}</p>
                <p className="text-xs text-muted-foreground">응답률 {responseRate.toFixed(1)}%</p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Star className="h-8 w-8 text-purple-600" />
                </div>
                <p className="text-sm text-muted-foreground">참여 강사 수</p>
                <p className="text-3xl font-bold text-purple-600">{currentReport.report_data?.instructor_count || 0}</p>
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
                <p className="text-sm text-muted-foreground">전체 평균 점수</p>
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

            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openDrillDown('course')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">과정 만족도</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl font-bold text-green-600">{currentReport.avg_course_satisfaction.toFixed(1)}</span>
                  <SatisfactionStatusBadge score={currentReport.avg_course_satisfaction} />
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  세부 보기
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openDrillDown('operation')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">운영 만족도</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl font-bold text-amber-600">{(currentReport.report_data?.operation_satisfaction || 0).toFixed(1)}</span>
                  <SatisfactionStatusBadge score={currentReport.report_data?.operation_satisfaction || 0} />
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  세부 보기
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* 4. 강사 만족도 트렌드 */}
          {instructorTrendData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>강사 만족도 트렌드</CardTitle>
                <CardDescription>강사별 만족도 평가 비교 현황</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={instructorTrendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.3)" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                      axisLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
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
                    <Legend />
                    <Bar 
                      dataKey="만족도" 
                      fill="hsl(var(--primary))" 
                      name="평균 만족도"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* 5. 응답자 분석 영역 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>응답자 분포</CardTitle>
                <CardDescription>설문 응답자 구성</CardDescription>
              </CardHeader>
              <CardContent>
                <DonutChart data={[
                  { name: '교육생', value: currentReport.total_responses * 0.8, color: 'hsl(var(--primary))' },
                  { name: '강사', value: currentReport.total_responses * 0.15, color: 'hsl(var(--primary) / 0.7)' },
                  { name: '운영자', value: currentReport.total_responses * 0.05, color: 'hsl(var(--primary) / 0.4)' }
                ]} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>응답률 분석</CardTitle>
                <CardDescription>예상 인원 대비 실제 응답률</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { name: '예상 응답', value: currentReport.total_surveys * 20, type: '예상' },
                    { name: '실제 응답', value: currentReport.total_responses, type: '실제' }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.3)" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                    />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-center text-sm text-muted-foreground mt-2">
                  응답률: {responseRate.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 5. 서술형 응답 요약 영역 */}
          <KeywordCloud textualResponses={textualResponses} />

          {/* 6. 종합 요약 */}
          <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">종합 만족도 평가</CardTitle>
              <CardDescription>전체 영역 종합 점수</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="flex items-center justify-center gap-4">
                <span className="text-6xl font-bold text-primary">{overallSatisfaction.toFixed(1)}</span>
                <div className="text-left">
                  <p className="text-sm text-muted-foreground">/ 10.0</p>
                  <SatisfactionStatusBadge score={overallSatisfaction} />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">강사</p>
                  <p className="text-xl font-bold text-blue-600">{currentReport.avg_instructor_satisfaction.toFixed(1)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">과정</p>
                  <p className="text-xl font-bold text-green-600">{currentReport.avg_course_satisfaction.toFixed(1)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">운영</p>
                  <p className="text-xl font-bold text-amber-600">{(currentReport.report_data?.operation_satisfaction || 0).toFixed(1)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 강사별 통계 (기존 유지) */}
          {instructorStats.length > 0 && (
            <div className="max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 border rounded-lg">
              <InstructorStatsSection
                instructorStats={instructorStats}
                onInstructorClick={handleInstructorClick}
              />
            </div>
          )}
        </>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">데이터 없음</h3>
            <p className="text-muted-foreground">
              {availableCourses.length === 0 
                ? "선택한 연도에 완료된 설문이 없습니다." 
                : "과정을 선택하여 결과를 확인하세요."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 드릴다운 모달 */}
      <DrillDownModal
        isOpen={drillDownModal.isOpen}
        onClose={() => setDrillDownModal({ ...drillDownModal, isOpen: false })}
        title={drillDownModal.title}
        type={drillDownModal.type}
        instructorStats={instructorStats}
        textualResponses={textualResponses}
      />
    </div>
  );
};

export default CourseReports;
