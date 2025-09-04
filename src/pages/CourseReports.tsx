
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DonutChart } from '@/components/charts/DonutChart';
import { AreaChart } from '@/components/charts/AreaChart';
import { BarChart } from 'recharts';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Bar, Legend } from 'recharts';
import { TrendingUp, BookOpen, Star, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCourseReportsData } from '@/hooks/useCourseReportsData';
import CourseSelector from '@/components/course-reports/CourseSelector';
import CourseStatsCards from '@/components/course-reports/CourseStatsCards';
import InstructorStatsSection from '@/components/course-reports/InstructorStatsSection';
import { generateCourseReportPDF } from '@/utils/pdfExport';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const CourseReports = () => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [selectedInstructor, setSelectedInstructor] = useState<string>('');
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    reports,
    instructorStats,
    availableCourses,
    availableRounds,
    availableInstructors,
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

  // 강사 만족도 트렌드 차트 데이터 준비
  const instructorTrendData = instructorStats.map(instructor => ({
    name: instructor.instructor_name,
    만족도: Number(instructor.avg_satisfaction.toFixed(1)),
    응답수: instructor.response_count
  }));

  // 차트 데이터 준비 (과정별로 변경)
  const satisfactionChartData = currentReport ? [
    { name: '강사 만족도', value: currentReport.avg_instructor_satisfaction, color: 'hsl(var(--primary))', fill: 'hsl(var(--primary))' },
    { name: '과정 만족도', value: currentReport.avg_course_satisfaction, color: 'hsl(var(--primary) / 0.8)', fill: 'hsl(var(--primary) / 0.8)' },
    { name: '운영 만족도', value: currentReport.report_data?.operation_satisfaction || 0, color: 'hsl(var(--primary) / 0.6)', fill: 'hsl(var(--primary) / 0.6)' }
  ] : [];

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
          {/* 전체 통계 요약 */}
          <CourseStatsCards
            totalSurveys={currentReport.total_surveys}
            totalResponses={currentReport.total_responses}
            instructorCount={currentReport.report_data?.instructor_count || 0}
            avgSatisfaction={(currentReport.avg_instructor_satisfaction + currentReport.avg_course_satisfaction + (currentReport.report_data?.operation_satisfaction || 0)) / 3}
          />

          {/* 강사 만족도 트렌드 차트 */}
          {instructorTrendData.length > 0 && (
            <Card className="col-span-full">
              <CardHeader>
                <CardTitle>강사 만족도 트렌드</CardTitle>
                <CardDescription>필터 설정에 따른 강사별 평균 만족도</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={instructorTrendData}>
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
                    <Legend />
                    <Bar dataKey="만족도" fill="hsl(var(--primary))" name="평균 만족도" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* 만족도 차트 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>영역별 만족도</CardTitle>
                <CardDescription>강사, 과정, 운영 만족도 비교</CardDescription>
              </CardHeader>
              <CardContent>
                <DonutChart data={satisfactionChartData} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>만족도 점수 분포</CardTitle>
                <CardDescription>각 영역별 세부 점수</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {satisfactionChartData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{item.value.toFixed(1)}</span>
                        <span className="text-sm text-muted-foreground">/ 10.0</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 강사별 통계 - 스크롤 개선 */}
          {instructorStats.length > 0 && (
            <div className="max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 border rounded-lg">
              <InstructorStatsSection
                instructorStats={instructorStats}
                onInstructorClick={handleInstructorClick}
              />
            </div>
          )}

          {/* 과정 요약 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-lg border-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/20 dark:to-slate-800/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  {currentReport.education_year}년 {currentReport.education_round}차 주요 지표
                </CardTitle>
                <CardDescription>
                  {currentReport.course_title} 기본 통계
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-white/5 rounded-lg">
                    <span className="font-medium">총 설문조사</span>
                    <span className="text-xl font-bold text-primary">{currentReport.total_surveys}개</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-white/5 rounded-lg">
                    <span className="font-medium">총 응답자</span>
                    <span className="text-xl font-bold text-green-600">{currentReport.total_responses}명</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-white/5 rounded-lg">
                    <span className="font-medium">참여 강사</span>
                    <span className="text-xl font-bold text-purple-600">{currentReport.report_data?.instructor_count || 0}명</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-primary" />
                  만족도 종합 평가
                </CardTitle>
                <CardDescription>
                  영역별 세부 만족도 점수 (10점 만점)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-white/5 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="font-medium">강사 만족도</span>
                    </div>
                    <span className="text-xl font-bold text-blue-600">{currentReport.avg_instructor_satisfaction.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-white/5 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="font-medium">과정 만족도</span>
                    </div>
                    <span className="text-xl font-bold text-green-600">{currentReport.avg_course_satisfaction.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-white/5 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                      <span className="font-medium">운영 만족도</span>
                    </div>
                    <span className="text-xl font-bold text-amber-600">{(currentReport.report_data?.operation_satisfaction || 0).toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg border-2 border-primary/20">
                    <span className="font-bold text-lg">종합 만족도</span>
                    <span className="text-2xl font-bold text-primary">
                      {((currentReport.avg_instructor_satisfaction + currentReport.avg_course_satisfaction + (currentReport.report_data?.operation_satisfaction || 0)) / 3).toFixed(1)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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
    </div>
  );
};

export default CourseReports;
