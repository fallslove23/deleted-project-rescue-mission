import React from 'react';
import { AdminLayout } from '@/components/layouts';
import { TrendingUp, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCourseReportsData } from '@/hooks/useCourseReportsData';
import { useState } from 'react';
import CourseSelector from '@/components/course-reports/CourseSelector';
import InstructorStatsSection from '@/components/course-reports/InstructorStatsSection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { generateCourseReportPDF } from '@/utils/pdfExport';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const DashboardCourseReports = () => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [selectedInstructor, setSelectedInstructor] = useState<string>('');
  const { toast } = useToast();
  const { userRoles } = useAuth();
  
  const isInstructor = userRoles.includes('instructor');

  const {
    reports,
    instructorStats,
    availableCourses,
    availableRounds,
    availableInstructors,
    loading,
    fetchAvailableCourses,
    fetchReports,
  } = useCourseReportsData(selectedYear, selectedCourse, selectedRound, selectedInstructor);

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

  const actions = (
    <Button onClick={handlePDFExport} variant="outline" size="sm" disabled={!currentReport}>
      <Download className="h-4 w-4 mr-2" />
      PDF 내보내기
    </Button>
  );

  return (
    <AdminLayout
      title="과정별 분석"
      subtitle={isInstructor ? '내 담당 과정 결과 분석' : '전체 과정 운영 결과'}
      icon={<TrendingUp className="h-5 w-5 text-white" />}
      actions={actions}
      loading={loading}
    >
      <div className="space-y-6">
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

        {/* 강사 통계 섹션 */}
        {!isInstructor && instructorStats.length > 0 && (
          <InstructorStatsSection
            instructorStats={instructorStats}
            onInstructorClick={(instructorId) => console.log('Instructor clicked:', instructorId)}
          />
        )}

        {/* 기본 통계 카드들 */}
        {currentReport && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>총 설문</CardTitle>
                <CardDescription>진행된 설문 수</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentReport.total_surveys}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>총 응답</CardTitle>
                <CardDescription>수집된 응답 수</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentReport.total_responses}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>강사 만족도</CardTitle>
                <CardDescription>평균 강사 만족도</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentReport.avg_instructor_satisfaction.toFixed(1)}</div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default DashboardCourseReports;
