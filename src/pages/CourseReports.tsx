// src/pages/CourseReports.tsx
import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layouts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Bar,
  Legend,
  BarChart as ReBarChart,
  LineChart as ReLineChart,
  Line,
  ComposedChart,
} from 'recharts';
import { TrendingUp, BookOpen, Star, Target, Download, User, Crown, AlertCircle, BarChart3, Share2 } from 'lucide-react';
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
  const { userRoles } = useAuth();
  
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
    if (availableCourses.length > 0 && !selectedCourse) {
      setSelectedCourse(availableCourses[0].key);
    }
  }, [availableCourses, selectedCourse]);

  const handleInstructorClick = (instructorId: string) => {
    navigate(`/dashboard/instructor-details/${instructorId}?year=${selectedYear}`);
  };

  const handleShareReport = () => {
    if (!currentReport) return;
    
    const shareData = {
      title: `${currentReport.course_title} 과정별 결과 보고서`,
      text: `${selectedYear}년 ${selectedCourse} 과정의 운영 결과를 확인해보세요.`,
      url: window.location.href,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      navigator.share(shareData).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {
        toast({
          title: "링크 복사됨",
          description: "보고서 링크가 클립보드에 복사되었습니다.",
        });
      });
    }
  };

  const handlePDFExport = () => {
    const currentReport = reports[0];
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

  const calculateChange = (current: number, previous: number) => {
    if (!previous || previous === 0) return null;
    const change = current - previous;
    const percentage = (change / previous) * 100;
    return { change, percentage };
  };

  // 차트용 안전한 데이터 준비
  const safeCourseStatistics = courseStatistics?.map(stat => ({
    ...stat,
    enrolled_count: isNaN(stat.enrolled_count) ? 0 : stat.enrolled_count,
    total_satisfaction: isNaN(stat.total_satisfaction) || !isFinite(stat.total_satisfaction) ? 0 : stat.total_satisfaction,
    instructor_satisfaction: isNaN(stat.instructor_satisfaction) || !isFinite(stat.instructor_satisfaction) ? 0 : stat.instructor_satisfaction,
    course_satisfaction: isNaN(stat.course_satisfaction) || !isFinite(stat.course_satisfaction) ? 0 : stat.course_satisfaction,
    operation_satisfaction: isNaN(stat.operation_satisfaction) || !isFinite(stat.operation_satisfaction) ? 0 : stat.operation_satisfaction
  })).filter(stat => stat.enrolled_count > 0 || stat.total_satisfaction > 0) || [];

  const surveyChange = previousReport ? calculateChange(currentReport?.total_surveys || 0, previousReport.total_surveys) : null;
  const responseChange = previousReport ? calculateChange(currentReport?.total_responses || 0, previousReport.total_responses) : null;
  const instructorChange = previousReport ? calculateChange(currentReport?.avg_instructor_satisfaction || 0, previousReport.avg_instructor_satisfaction) : null;

  const instructorTrendData = instructorStats
    .filter(instructor => !isNaN(instructor.avg_satisfaction) && isFinite(instructor.avg_satisfaction) && instructor.avg_satisfaction > 0)
    .map(instructor => ({
      name: instructor.instructor_name,
      만족도: Number(instructor.avg_satisfaction.toFixed(1)) || 0,
      응답수: instructor.response_count
    }));

  const satisfactionChartData = currentReport ? [
    { 
      name: '강사 만족도', 
      value: !isNaN(currentReport.avg_instructor_satisfaction) && isFinite(currentReport.avg_instructor_satisfaction) ? Number(currentReport.avg_instructor_satisfaction.toFixed(1)) : 0, 
      fill: 'hsl(var(--chart-1))' 
    },
    { 
      name: '과목 만족도', 
      value: !isNaN(currentReport.avg_course_satisfaction) && isFinite(currentReport.avg_course_satisfaction) ? Number(currentReport.avg_course_satisfaction.toFixed(1)) : 0, 
      fill: 'hsl(var(--chart-2))' 
    },
    { 
      name: '운영 만족도', 
      value: !isNaN(currentReport.report_data?.operation_satisfaction || 0) && isFinite(currentReport.report_data?.operation_satisfaction || 0) ? Number((currentReport.report_data?.operation_satisfaction || 0).toFixed(1)) : 0, 
      fill: 'hsl(var(--chart-3))' 
    }
  ].filter(item => !isNaN(item.value) && isFinite(item.value) && item.value >= 0) : [];

  const currentRoundData = currentReport ? [
    { 
      name: '강사 만족도', 
      value: !isNaN(currentReport.avg_instructor_satisfaction) ? Number(currentReport.avg_instructor_satisfaction.toFixed(1)) : 0 
    },
    { 
      name: '과목 만족도', 
      value: !isNaN(currentReport.avg_course_satisfaction) ? Number(currentReport.avg_course_satisfaction.toFixed(1)) : 0 
    },
    { 
      name: '운영 만족도', 
      value: !isNaN(currentReport.report_data?.operation_satisfaction || 0) ? Number((currentReport.report_data?.operation_satisfaction || 0).toFixed(1)) : 0 
    }
  ].filter(item => !isNaN(item.value) && item.value >= 0) : [];

  const overallSatisfaction = currentReport && !isNaN(currentReport.avg_instructor_satisfaction) && !isNaN(currentReport.avg_course_satisfaction) ? 
    Number(((currentReport.avg_instructor_satisfaction + currentReport.avg_course_satisfaction + (currentReport.report_data?.operation_satisfaction || 0)) / 3).toFixed(1)) || 0 : 0;

  const responseRate = currentReport && currentReport.total_surveys > 0 ? 
    (currentReport.total_responses / (currentReport.total_surveys * 20)) * 100 : 0;

  const openDrillDown = (type: 'instructor' | 'course' | 'operation') => {
    const titles = {
      instructor: '강사 만족도',
      course: '과목 만족도', 
      operation: '운영 만족도'
    };
    setDrillDownModal({ isOpen: true, type, title: titles[type] });
  };

  const actions = currentReport ? (
    <div className="flex items-center gap-2">
      <Button onClick={handleShareReport} variant="outline" size="sm" className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100">
        <Share2 className="h-4 w-4 mr-2" />
        공유하기
      </Button>
      <Button onClick={handlePDFExport} size="sm" className="bg-primary text-white hover:bg-primary/90 shadow-md">
        <Download className="h-4 w-4 mr-2" />
        PDF 다운로드
      </Button>
    </div>
  ) : null;

  return (
    <DashboardLayout
      title="과정 결과 보고"
      subtitle={isInstructor ? '내 담당 과정 결과 분석' : '전체 과정 운영 결과'}
      icon={<BarChart3 className="h-5 w-5 text-white" />}
      actions={actions}
      loading={loading}
    >
      <div className="space-y-6">
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

        {/* 필터 */}
        <CourseSelector
          selectedYear={selectedYear}
          selectedCourse={selectedCourse}
          selectedRound={selectedRound}
          selectedInstructor={selectedInstructor}
          availableCourses={availableCourses}
          availableRounds={availableRounds}
          availableInstructors={isInstructor ? [] : availableInstructors}
          years={years}
          onYearChange={(value) => setSelectedYear(Number(value))}
          onCourseChange={setSelectedCourse}
          onRoundChange={(value) => setSelectedRound(value ? Number(value) : null)}
          onInstructorChange={setSelectedInstructor}
        />

        {/* 과정 만족도 메인 카드 */}
        {currentReport && (
          <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 rounded-full">
                    <Star className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-purple-900">과정 만족도</h3>
                    <p className="text-sm text-purple-700">강사, 과목, 운영 종합 평가</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-purple-900">
                    {overallSatisfaction ? overallSatisfaction.toFixed(1) : '0.0'}
                  </div>
                  <p className="text-sm text-purple-700">점 / 10점 만점</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 상세 통계 카드들 */}
        {currentReport && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 설문</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentReport.total_surveys}</div>
                <p className="text-xs text-muted-foreground">
                  진행된 설문 수
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 응답</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentReport.total_responses}</div>
                <p className="text-xs text-muted-foreground">
                  수집된 응답 수
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">강사 만족도</CardTitle>
                <User className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {!isNaN(currentReport.avg_instructor_satisfaction) ? currentReport.avg_instructor_satisfaction.toFixed(1) : '0.0'}
                </div>
                <p className="text-xs text-muted-foreground">평균 만족도</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">과목 만족도</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {!isNaN(currentReport.avg_course_satisfaction) ? currentReport.avg_course_satisfaction.toFixed(1) : '0.0'}
                </div>
                <p className="text-xs text-muted-foreground">평균 만족도</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 만족도 차트 섹션 */}
        {satisfactionChartData.length > 0 && (
          <div className="space-y-6">
            {/* 섹션 헤더 */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border-l-4 border-blue-500">
              <h2 className="text-lg font-semibold text-blue-700 mb-1 flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                영역별 만족도 비교
              </h2>
              <p className="text-sm text-muted-foreground">
                강사, 과목, 운영 영역별 만족도를 비교 분석합니다
              </p>
            </div>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">영역별 만족도 분석</CardTitle>
                <CardDescription>각 영역별 현재 만족도 현황</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ReBarChart data={satisfactionChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis 
                      domain={[0, 5]} 
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                      formatter={(value: any) => [`${value}점`, '만족도']}
                    />
                    <Bar 
                      dataKey="value" 
                      fill="hsl(var(--primary))" 
                      radius={[2, 2, 0, 0]}
                      maxBarSize={80}
                    />
                  </ReBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 월별 트렌드 차트 */}
        {trendData && trendData.length > 0 && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border-l-4 border-green-500">
              <h2 className="text-lg font-semibold text-green-700 mb-1 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                월별 트렌드
              </h2>
              <p className="text-sm text-muted-foreground">
                차수별 만족도 변화 추이를 확인합니다
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">차수별 만족도 추이</CardTitle>
                <CardDescription>교육 차수별 만족도 변화 분석</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ReLineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis 
                      dataKey="round" 
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis 
                      domain={[0, 10]} 
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                      formatter={(value: any) => [`${value}점`, '만족도']}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="강사만족도" 
                      stroke="hsl(var(--chart-1))" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="과정만족도" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="운영만족도" 
                      stroke="hsl(var(--chart-3))" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </ReLineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 과정별 통계 차트 */}
        {safeCourseStatistics && safeCourseStatistics.length > 0 && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-4 border-l-4 border-orange-500">
              <h2 className="text-lg font-semibold text-orange-700 mb-1 flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                과정별 통계
              </h2>
              <p className="text-sm text-muted-foreground">
                과정별 수강 및 만족도 통계를 비교합니다
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">과정별 수강생 및 만족도</CardTitle>
                <CardDescription>과정별 운영 현황 및 성과 분석</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={safeCourseStatistics} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis 
                      dataKey="course_name" 
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis 
                      yAxisId="left"
                      orientation="left"
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 10]}
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    />
                    <Legend />
                    <Bar 
                      yAxisId="left"
                      dataKey="enrolled_count" 
                      fill="hsl(var(--chart-1))" 
                      name="수강생수"
                      radius={[2, 2, 0, 0]}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="total_satisfaction" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={3}
                      name="총 만족도"
                      dot={{ r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 강사 통계 섹션 */}
        {instructorStats.length > 0 && (
          <InstructorStatsSection
            instructorStats={instructorStats}
            onInstructorClick={handleInstructorClick}
          />
        )}

        {/* 키워드 및 의견 분석 섹션 */}
        {textualResponses && textualResponses.length > 0 && (
          <KeywordCloud textualResponses={textualResponses} />
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
    </DashboardLayout>
  );
};

export default CourseReports;