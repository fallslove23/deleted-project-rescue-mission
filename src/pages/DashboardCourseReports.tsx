import React from 'react';
import { DashboardLayout } from '@/components/layouts';
import { TrendingUp, Download, Star, Target, Minus, BookOpen, User, Crown, AlertCircle, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Area, AreaChart, PieChart, Pie, Cell,
} from 'recharts';
import { useCourseReportsData } from '@/hooks/useCourseReportsData';
import { useState } from 'react';
import CourseSelector from '@/components/course-reports/CourseSelector';
import InstructorStatsSection from '@/components/course-reports/InstructorStatsSection';
import CourseStatsCards from '@/components/course-reports/CourseStatsCards';
import { SatisfactionStatusBadge } from '@/components/course-reports/SatisfactionStatusBadge';
import { DrillDownModal } from '@/components/course-reports/DrillDownModal';
import { KeywordCloud } from '@/components/course-reports/KeywordCloud';
import { generateCourseReportPDF } from '@/utils/pdfExport';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const DashboardCourseReports = () => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [selectedInstructor, setSelectedInstructor] = useState<string>('');
  const [drillDownModal, setDrillDownModal] = useState<{
    isOpen: boolean;
    type: 'instructor' | 'course' | 'operation';
    title: string;
  }>({ isOpen: false, type: 'instructor', title: '' });
  
  const { toast } = useToast();
  const { userRoles } = useAuth();
  
  const isInstructor = userRoles.includes('instructor');

  const {
    reports,
    instructorStats,
    availableCourses,
    availableRounds,
    availableInstructors,
    textualResponses,
    loading,
    fetchAvailableCourses,
    fetchReports,
  } = useCourseReportsData(selectedYear, selectedCourse, selectedRound, selectedInstructor);

  const handleInstructorClick = (instructorId: string) => {
    setSelectedInstructor(instructorId);
  };

  const handleSatisfactionClick = (type: 'instructor' | 'course' | 'operation') => {
    const titles = {
      instructor: '강사 만족도',
      course: '과정 만족도', 
      operation: '운영 만족도'
    };
    setDrillDownModal({ isOpen: true, type, title: titles[type] });
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

  // 차트 데이터 구성
  const satisfactionData = currentReport ? [
    { 
      name: '강사', 
      value: Number(currentReport.avg_instructor_satisfaction.toFixed(1)),
      color: '#3b82f6'
    },
    { 
      name: '과정', 
      value: Number(currentReport.avg_course_satisfaction.toFixed(1)),
      color: '#10b981'
    },
    { 
      name: '운영', 
      value: Number((currentReport.report_data?.operation_satisfaction || 0).toFixed(1)),
      color: '#f59e0b'
    }
  ] : [];

  const trendData = reports.map(report => ({
    name: `${report.education_round}차`,
    instructor: Number(report.avg_instructor_satisfaction.toFixed(1)),
    course: Number(report.avg_course_satisfaction.toFixed(1)),
    operation: Number((report.report_data?.operation_satisfaction || 0).toFixed(1))
  })).reverse();

  const getSatisfactionIcon = (score: number) => {
    if (score >= 8) return <Star className="h-4 w-4 text-yellow-500" />;
    if (score >= 6) return <Target className="h-4 w-4 text-blue-500" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const actions = currentReport ? (
    <Button onClick={handlePDFExport} variant="outline" size="sm">
      <Download className="h-4 w-4 mr-2" />
      PDF 내보내기
    </Button>
  ) : null;

  return (
    <DashboardLayout
      title="과정 결과 보고"
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

        {/* 기본 통계 카드 */}
        {currentReport && (
          <CourseStatsCards
            totalSurveys={currentReport.total_surveys}
            totalResponses={currentReport.total_responses}
            instructorCount={currentReport.report_data?.instructor_count || 0}
            avgSatisfaction={currentReport.avg_instructor_satisfaction}
          />
        )}

        {/* 만족도 점수 카드 */}
        {currentReport && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleSatisfactionClick('instructor')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">강사 만족도</CardTitle>
                {getSatisfactionIcon(currentReport.avg_instructor_satisfaction)}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentReport.avg_instructor_satisfaction.toFixed(1)}
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <Progress value={currentReport.avg_instructor_satisfaction * 10} className="flex-1" />
                  <SatisfactionStatusBadge score={currentReport.avg_instructor_satisfaction} />
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleSatisfactionClick('course')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">과정 만족도</CardTitle>
                {getSatisfactionIcon(currentReport.avg_course_satisfaction)}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentReport.avg_course_satisfaction.toFixed(1)}
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <Progress value={currentReport.avg_course_satisfaction * 10} className="flex-1" />
                  <SatisfactionStatusBadge score={currentReport.avg_course_satisfaction} />
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleSatisfactionClick('operation')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">운영 만족도</CardTitle>
                {getSatisfactionIcon(currentReport.report_data?.operation_satisfaction || 0)}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(currentReport.report_data?.operation_satisfaction || 0).toFixed(1)}
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <Progress value={(currentReport.report_data?.operation_satisfaction || 0) * 10} className="flex-1" />
                  <SatisfactionStatusBadge score={currentReport.report_data?.operation_satisfaction || 0} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 차트 섹션 */}
        {currentReport && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 만족도 비교 차트 */}
            <Card>
              <CardHeader>
                <CardTitle>영역별 만족도 비교</CardTitle>
                <CardDescription>강사, 과정, 운영 만족도 점수</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={satisfactionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 10]} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 트렌드 차트 */}
            {trendData.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>만족도 트렌드</CardTitle>
                  <CardDescription>차수별 만족도 변화</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 10]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="instructor" stroke="#3b82f6" name="강사" />
                      <Line type="monotone" dataKey="course" stroke="#10b981" name="과정" />
                      <Line type="monotone" dataKey="operation" stroke="#f59e0b" name="운영" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* 강사 통계 섹션 */}
        {!isInstructor && instructorStats.length > 0 && (
          <InstructorStatsSection
            instructorStats={instructorStats}
            onInstructorClick={handleInstructorClick}
          />
        )}

        {/* 키워드 클라우드 */}
        {textualResponses.length > 0 && (
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

export default DashboardCourseReports;
