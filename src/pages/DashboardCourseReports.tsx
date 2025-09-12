import React, { useEffect } from 'react';
import { DashboardLayout } from '@/components/layouts';
import { TrendingUp, Download, Star, Target, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
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
import { ManagerInsightCards } from '@/components/dashboard/ManagerInsightCards';

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
    previousInstructorStats,
    availableCourses,
    availableRounds,
    availableInstructors,
    textualResponses,
    loading,
    fetchAvailableCourses,
    fetchReports,
  } = useCourseReportsData(selectedYear, selectedCourse, selectedRound, selectedInstructor);

  // 초기 데이터 로딩
  useEffect(() => {
    console.log('DashboardCourseReports: Initial data loading');
    fetchAvailableCourses();
  }, [selectedYear]);

  // 필터 변경 시 리포트 다시 가져오기
  useEffect(() => {
    console.log('DashboardCourseReports: Filters changed, fetching reports');
    fetchReports();
  }, [selectedYear, selectedCourse, selectedRound, selectedInstructor]);

  const handleInstructorClick = (instructorId: string) => {
    setSelectedInstructor(instructorId);
  };

  const handleSatisfactionClick = (type: 'instructor' | 'course' | 'operation') => {
    const titles = {
      instructor: '강사 만족도',
      course: '과목 만족도', 
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

  // 안전한 숫자 변환 함수
  const safeToFixed = (value: number, digits: number = 1) => {
    return isNaN(value) || !isFinite(value) ? 0 : Number(value.toFixed(digits));
  };

  // 차트 데이터 구성
  const satisfactionData = currentReport ? [
    { 
      name: '강사', 
      value: safeToFixed(currentReport.avg_instructor_satisfaction),
      color: '#3b82f6'
    },
    { 
      name: '과정', 
      value: safeToFixed(currentReport.avg_course_satisfaction),
      color: '#10b981'
    },
    { 
      name: '운영', 
      value: safeToFixed(currentReport.report_data?.operation_satisfaction || 0),
      color: '#f59e0b'
    }
  ] : [];

  const trendData = reports.map(report => ({
    name: `${report.education_round}차`,
    instructor: safeToFixed(report.avg_instructor_satisfaction),
    course: safeToFixed(report.avg_course_satisfaction),
    operation: safeToFixed(report.report_data?.operation_satisfaction || 0)
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
      title={isInstructor ? "과정별 결과 보고" : "과정별 결과 보고"}
      subtitle={isInstructor ? '개인 성과 및 과목별 피드백 분석' : '조직 전체 과정 운영 결과 및 인사이트'}
      icon={<TrendingUp className="h-5 w-5 text-white" />}
      actions={actions}
      loading={loading}
    >
      <div className="space-y-6">
        {/* 로딩 상태 표시 */}
        {loading && (
          <div className="text-center py-8">
            <div className="text-lg">데이터를 불러오는 중...</div>
          </div>
        )}

        {/* 필터 */}
        {!loading && (
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
        )}

        {/* 데이터가 없을 때 안내 메시지 */}
        {!loading && availableCourses.length === 0 && (
          <div className="text-center py-8">
            <div className="text-lg text-muted-foreground">설문 데이터가 없습니다.</div>
            <div className="text-sm text-muted-foreground mt-2">
              {selectedYear}년도에 완료된 설문이 없습니다. 다른 연도를 선택해보세요.
            </div>
          </div>
        )}

        {/* 전체 평균 만족도 강조 섹션 */}
        {!loading && currentReport && (
          <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-lg text-primary">전체 평균 만족도</CardTitle>
              <CardDescription>강사, 과정, 운영 만족도 종합 점수</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-6xl font-bold text-primary mb-4">
                {((currentReport.avg_instructor_satisfaction + 
                   currentReport.avg_course_satisfaction + 
                   (currentReport.report_data?.operation_satisfaction || 0)) / 3).toFixed(1)}
              </div>
              <div className="text-lg text-muted-foreground mb-4">10점 만점</div>
              <div className="flex justify-center">
                <SatisfactionStatusBadge 
                  score={(currentReport.avg_instructor_satisfaction + 
                         currentReport.avg_course_satisfaction + 
                         (currentReport.report_data?.operation_satisfaction || 0)) / 3} 
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* 기본 통계 카드 */}
        {!loading && currentReport && (
          <CourseStatsCards
            totalSurveys={currentReport.total_surveys}
            totalResponses={currentReport.total_responses}
            instructorCount={currentReport.report_data?.instructor_count || 0}
            avgSatisfaction={currentReport.avg_instructor_satisfaction}
          />
        )}

        {/* 만족도 점수 카드 */}
        {!loading && currentReport && (
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
                <CardTitle className="text-sm font-medium">과목 만족도</CardTitle>
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
        {!loading && currentReport && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 강사 만족도 도넛 차트 */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleSatisfactionClick('instructor')}
            >
              <CardHeader>
                <CardTitle>강사 만족도 분포</CardTitle>
                <CardDescription>클릭하여 상세 정보 보기</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: '우수 (8-10점)', value: instructorStats.filter(s => s.avg_satisfaction >= 8).length, fill: 'hsl(var(--chart-1))' },
                          { name: '보통 (6-8점)', value: instructorStats.filter(s => s.avg_satisfaction >= 6 && s.avg_satisfaction < 8).length, fill: 'hsl(var(--chart-2))' },
                          { name: '개선필요 (0-6점)', value: instructorStats.filter(s => s.avg_satisfaction < 6).length, fill: 'hsl(var(--chart-3))' }
                        ].filter(item => item.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {instructorStats.map((_, index) => (
                          <Cell key={`cell-${index}`} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 만족도 비교 차트 */}
            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleSatisfactionClick('course')}
            >
              <CardHeader>
                <CardTitle>영역별 만족도 비교</CardTitle>
                <CardDescription>강사, 과정, 운영 만족도 점수 (클릭하여 기간별 데이터 보기)</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={satisfactionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--foreground))" />
                    <YAxis domain={[0, 10]} stroke="hsl(var(--foreground))" />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--card-foreground))'
                      }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 트렌드 차트 */}
            {trendData.length > 1 && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>만족도 트렌드</CardTitle>
                  <CardDescription>차수별 만족도 변화</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--foreground))" />
                      <YAxis domain={[0, 10]} stroke="hsl(var(--foreground))" />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--card-foreground))'
                        }}
                      />
                      <Line type="monotone" dataKey="instructor" stroke="hsl(var(--chart-1))" strokeWidth={3} name="강사" />
                      <Line type="monotone" dataKey="course" stroke="hsl(var(--chart-2))" strokeWidth={3} name="과정" />
                      <Line type="monotone" dataKey="operation" stroke="hsl(var(--chart-3))" strokeWidth={3} name="운영" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* 강사 통계 섹션 */}
        {!loading && !isInstructor && instructorStats.length > 0 && (
          <InstructorStatsSection
            instructorStats={instructorStats}
            previousStats={previousInstructorStats}
            comparisonLabel={selectedRound ? `${selectedRound - 1}차` : '이전 연도'}
            onInstructorClick={handleInstructorClick}
          />
        )}

        {/* 키워드 클라우드 */}
        {!loading && textualResponses.length > 0 && (
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
          periodData={trendData}
        />
      </div>
    </DashboardLayout>
  );
};

export default DashboardCourseReports;