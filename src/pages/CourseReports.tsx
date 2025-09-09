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

  const surveyChange = previousReport ? calculateChange(currentReport?.total_surveys || 0, previousReport.total_surveys) : null;
  const responseChange = previousReport ? calculateChange(currentReport?.total_responses || 0, previousReport.total_responses) : null;
  const instructorChange = previousReport ? calculateChange(currentReport?.avg_instructor_satisfaction || 0, previousReport.avg_instructor_satisfaction) : null;

  const instructorTrendData = instructorStats
    .filter(instructor => !isNaN(instructor.avg_satisfaction) && instructor.avg_satisfaction > 0)
    .map(instructor => ({
      name: instructor.instructor_name,
      만족도: Number(instructor.avg_satisfaction.toFixed(1)) || 0,
      응답수: instructor.response_count
    }));

  const satisfactionChartData = currentReport ? [
    { 
      name: '강사 만족도', 
      value: !isNaN(currentReport.avg_instructor_satisfaction) ? Number(currentReport.avg_instructor_satisfaction.toFixed(1)) : 0, 
      fill: 'hsl(var(--chart-1))' 
    },
    { 
      name: '과정 만족도', 
      value: !isNaN(currentReport.avg_course_satisfaction) ? Number(currentReport.avg_course_satisfaction.toFixed(1)) : 0, 
      fill: 'hsl(var(--chart-2))' 
    },
    { 
      name: '운영 만족도', 
      value: !isNaN(currentReport.report_data?.operation_satisfaction || 0) ? Number((currentReport.report_data?.operation_satisfaction || 0).toFixed(1)) : 0, 
      fill: 'hsl(var(--chart-3))' 
    }
  ].filter(item => !isNaN(item.value) && item.value >= 0) : [];

  const currentRoundData = currentReport ? [
    { 
      name: '강사 만족도', 
      value: !isNaN(currentReport.avg_instructor_satisfaction) ? Number(currentReport.avg_instructor_satisfaction.toFixed(1)) : 0 
    },
    { 
      name: '과정 만족도', 
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
      course: '과정 만족도', 
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

        {/* 메인 통계 카드들 */}
        {currentReport && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <Star className="h-4 w-4 text-muted-foreground" />
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
                <CardTitle className="text-sm font-medium">과정 만족도</CardTitle>
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

        {/* 만족도 차트 - Grouped Bar Chart로 개선 */}
        {satisfactionChartData.length > 0 && (
          <div className="space-y-6">
            {/* 섹션 헤더 강화 */}
            <div className="bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg p-6 border-l-4 border-blue-500">
              <h2 className="text-xl font-bold text-blue-700 mb-2 flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                영역별 만족도 비교
              </h2>
              <p className="text-muted-foreground">
                강사, 과정, 운영 영역별 만족도를 그룹화하여 비교 분석합니다
              </p>
            </div>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>영역별 만족도 분석</CardTitle>
                <CardDescription>각 영역별 현재 만족도와 목표 수준 비교</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={satisfactionChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-muted-foreground" />
                    <YAxis domain={[0, 5]} className="text-muted-foreground" />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="value" name="현재 만족도" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Line 
                      type="monotone" 
                      dataKey="target" 
                      stroke="hsl(var(--destructive))" 
                      strokeWidth={2}
                      name="목표 수준 (4.0)"
                      dot={{ fill: 'hsl(var(--destructive))' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 강사 통계 섹션 */}
        {!isInstructor && instructorStats.length > 0 && (
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