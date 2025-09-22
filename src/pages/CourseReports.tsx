import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Download,
  Share2,
  Star,
  Target,
  BookOpen,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import CourseSelector from '@/components/course-reports/CourseSelector';
import CourseStatsCards from '@/components/course-reports/CourseStatsCards';
import InstructorStatsSection from '@/components/course-reports/InstructorStatsSection';
import { DonutChart } from '@/components/charts/DonutChart';
import { AreaChart } from '@/components/charts/AreaChart';
import { KeywordCloud } from '@/components/course-reports/KeywordCloud';
import { useCourseReportsData } from '@/hooks/useCourseReportsData';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useTestDataToggle } from '@/hooks/useTestDataToggle';
import { TestDataToggle } from '@/components/TestDataToggle';
import { generateCourseReportPDF } from '@/utils/pdfExport';
import { ChartErrorBoundary } from '@/components/charts/ChartErrorBoundary';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, index) => CURRENT_YEAR - index);

const toFixedOrZero = (value: number | null | undefined, digits = 1) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const rounded = Number(value.toFixed(digits));
  return Number.isNaN(rounded) ? 0 : rounded;
};

const CourseReports: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userRoles } = useAuth();
  const testDataOptions = useTestDataToggle();

  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [selectedInstructor, setSelectedInstructor] = useState<string>('');

  const {
    summary,
    previousSummary,
    trend,
    instructorStats,
    previousInstructorStats,
    textualResponses,
    availableCourses,
    availableRounds,
    availableInstructors,
    loading,
    isInstructor,
    instructorId,
    instructorName,
  } = useCourseReportsData(
    selectedYear,
    selectedCourse,
    selectedRound,
    selectedInstructor,
    testDataOptions.includeTestData,
  );

  const currentInstructorName = useMemo(() => {
    if (!isInstructor || !instructorId) return null;
    return instructorName || availableInstructors.find(inst => inst.id === instructorId)?.name || null;
  }, [isInstructor, instructorId, instructorName, availableInstructors]);

  useEffect(() => {
    if (availableCourses.length === 0) return;
    if (selectedCourse && availableCourses.some((course) => course.normalizedName === selectedCourse)) return;
    setSelectedCourse(availableCourses[0].normalizedName);
  }, [availableCourses, selectedCourse]);

  useEffect(() => {
    if (!selectedRound) return;
    if (!availableRounds.includes(selectedRound)) {
      setSelectedRound(null);
    }
  }, [availableRounds, selectedRound]);

  useEffect(() => {
    if (!selectedInstructor) return;
    if (!availableInstructors.some((instructor) => instructor.id === selectedInstructor)) {
      setSelectedInstructor('');
    }
  }, [availableInstructors, selectedInstructor]);

  const currentCourseName = useMemo(() => {
    if (summary?.courseName) return summary.courseName;
    const fallback = availableCourses.find((course) => course.normalizedName === selectedCourse);
    return fallback?.displayName ?? selectedCourse;
  }, [summary?.courseName, availableCourses, selectedCourse]);

  const satisfactionChartData = useMemo(() => {
    if (!summary) return [] as Array<{ name: string; value: number; color: string }>;

    const data = [
      { name: '강사 만족도', value: toFixedOrZero(summary.avgInstructorSatisfaction), color: 'hsl(var(--chart-1))' },
      { name: '과정 만족도', value: toFixedOrZero(summary.avgCourseSatisfaction), color: 'hsl(var(--chart-2))' },
      { name: '운영 만족도', value: toFixedOrZero(summary.avgOperationSatisfaction), color: 'hsl(var(--chart-3))' },
    ];

    return data.filter((item) => item.value > 0);
  }, [summary]);

  const trendChartData = useMemo(() => {
    return trend
      .map((point, index) => ({
        name: point.educationRound ? `${point.educationRound}차` : `기준 ${index + 1}`,
        '강사 만족도': toFixedOrZero(point.avgInstructorSatisfaction),
        '과정 만족도': toFixedOrZero(point.avgCourseSatisfaction),
        '운영 만족도': toFixedOrZero(point.avgOperationSatisfaction),
      }))
      .filter((item) =>
        item['강사 만족도'] > 0 || item['과정 만족도'] > 0 || item['운영 만족도'] > 0,
      );
  }, [trend]);

  const instructorStatsDisplay = useMemo(
    () =>
      instructorStats.map((stat) => ({
        instructor_id: stat.instructorId ?? '',
        instructor_name: stat.instructorName,
        survey_count: stat.surveyCount,
        response_count: stat.responseCount,
        avg_satisfaction: toFixedOrZero(stat.avgSatisfaction),
      })),
    [instructorStats],
  );

  const previousInstructorStatsDisplay = useMemo(
    () =>
      previousInstructorStats.map((stat) => ({
        instructor_id: stat.instructorId ?? '',
        instructor_name: stat.instructorName,
        survey_count: stat.surveyCount,
        response_count: stat.responseCount,
        avg_satisfaction: toFixedOrZero(stat.avgSatisfaction),
      })),
    [previousInstructorStats],
  );

  const overallSatisfaction = useMemo(() => {
    if (!summary) return 0;
    const values = [summary.avgInstructorSatisfaction, summary.avgCourseSatisfaction, summary.avgOperationSatisfaction]
      .map((value) => (typeof value === 'number' && Number.isFinite(value) ? value : null))
      .filter((value): value is number => value !== null);

    if (values.length === 0) return 0;
    const average = values.reduce((acc, value) => acc + value, 0) / values.length;
    return toFixedOrZero(average);
  }, [summary]);

  const previousOverallSatisfaction = useMemo(() => {
    if (!previousSummary) return 0;
    const values = [
      previousSummary.avgInstructorSatisfaction,
      previousSummary.avgCourseSatisfaction,
      previousSummary.avgOperationSatisfaction,
    ]
      .map((value) => (typeof value === 'number' && Number.isFinite(value) ? value : null))
      .filter((value): value is number => value !== null);

    if (values.length === 0) return 0;
    const average = values.reduce((acc, value) => acc + value, 0) / values.length;
    return toFixedOrZero(average);
  }, [previousSummary]);

  const satisfactionChange = useMemo(() => {
    if (!previousOverallSatisfaction || previousOverallSatisfaction === 0) return null;
    const diff = overallSatisfaction - previousOverallSatisfaction;
    return {
      diff,
      percent: previousOverallSatisfaction === 0 ? 0 : (diff / previousOverallSatisfaction) * 100,
    };
  }, [overallSatisfaction, previousOverallSatisfaction]);

  const handleInstructorClick = (instructorIdValue: string) => {
    if (!instructorIdValue) return;
    navigate(`/dashboard/instructor-details/${instructorIdValue}?year=${selectedYear}`);
  };

  const handleShareReport = () => {
    if (!summary) {
      toast({
        title: '공유할 데이터가 없습니다.',
        description: '과정을 선택하여 결과를 불러온 후 다시 시도해 주세요.',
        variant: 'destructive',
      });
      return;
    }

    const shareData = {
      title: `${selectedYear}년 ${currentCourseName} 과정별 결과 보고서`,
      text: `${selectedYear}년 ${currentCourseName} 과정의 운영 결과를 확인해보세요.`,
      url: window.location.href,
    };

    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        navigator.share(shareData);
      } else {
        navigator.clipboard.writeText(window.location.href).then(() => {
          toast({
            title: '링크 복사 완료',
            description: '보고서 링크가 클립보드에 복사되었습니다.',
          });
        });
      }
    } catch (error) {
      console.error('Share report error', error);
      toast({
        title: '공유 실패',
        description: '결과를 공유하는 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handlePDFExport = () => {
    if (!summary) {
      toast({
        title: '내보낼 데이터가 없습니다.',
        description: '과정을 선택하여 결과를 불러온 후 다시 시도해 주세요.',
        variant: 'destructive',
      });
      return;
    }

    try {
      generateCourseReportPDF({
        reportTitle: isInstructor ? '개인 과정별 운영 결과 보고서' : '과정별 운영 결과 보고서',
        year: summary.educationYear,
        round: summary.educationRound ?? undefined,
        courseName: currentCourseName || '과정 미정',
        totalSurveys: summary.totalSurveys,
        totalResponses: summary.totalResponses,
        instructorCount: summary.instructorCount,
        avgInstructorSatisfaction: toFixedOrZero(summary.avgInstructorSatisfaction),
        avgCourseSatisfaction: toFixedOrZero(summary.avgCourseSatisfaction),
        avgOperationSatisfaction: toFixedOrZero(summary.avgOperationSatisfaction),
        instructorStats: instructorStatsDisplay.map((stat) => ({
          name: stat.instructor_name,
          surveyCount: stat.survey_count,
          responseCount: stat.response_count,
          avgSatisfaction: stat.avg_satisfaction,
        })),
      });

      toast({
        title: 'PDF 다운로드 완료',
        description: '과정 결과 보고서 PDF가 생성되었습니다.',
      });
    } catch (error) {
      console.error('PDF export error', error);
      toast({
        title: 'PDF 내보내기 실패',
        description: '보고서를 PDF로 내보내는 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const content = loading ? (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
      데이터를 불러오는 중입니다...
    </div>
  ) : summary ? (
    <>
      <CourseStatsCards
        totalSurveys={summary.totalSurveys}
        totalResponses={summary.totalResponses}
        instructorCount={summary.instructorCount}
        avgSatisfaction={overallSatisfaction}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              영역별 만족도
            </CardTitle>
            <CardDescription>강사, 과정, 운영 만족도를 비교해 보세요.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <DonutChart data={satisfactionChartData} />
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              만족도 요약
            </CardTitle>
            <CardDescription>선택한 과정의 핵심 지표를 한눈에 확인하세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">과정명</span>
                <span className="font-semibold">{currentCourseName || '과정 미정'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">교육 연도</span>
                <span className="font-semibold">{summary.educationYear}년</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">교육 차수</span>
                <span className="font-semibold">{summary.educationRound ? `${summary.educationRound}차` : '전체'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">총 응답 수</span>
                <span className="font-semibold">{summary.totalResponses.toLocaleString()}명</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">참여 강사</span>
                <span className="font-semibold">{summary.instructorCount.toLocaleString()}명</span>
              </div>
              <div className="flex items-center justify-between border-t pt-4">
                <div>
                  <div className="text-sm text-muted-foreground">종합 만족도</div>
                  {satisfactionChange && (
                    <div
                      className={`text-xs font-medium ${
                        satisfactionChange.diff >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {satisfactionChange.diff >= 0 ? '▲' : '▼'} {Math.abs(satisfactionChange.diff).toFixed(1)}점
                    </div>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-primary">{overallSatisfaction.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">/ 10점</span>
                </div>
              </div>
              {testDataOptions.includeTestData && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  테스트 데이터가 포함되어 있어 실제 응답 수와 차이가 있을 수 있습니다.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {trendChartData.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              만족도 추이
            </CardTitle>
            <CardDescription>차수별 만족도 변화를 확인해 보세요.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <AreaChart
              data={trendChartData}
              dataKeys={[
                { key: '강사 만족도', label: '강사 만족도', color: 'hsl(var(--chart-1))' },
                { key: '과정 만족도', label: '과정 만족도', color: 'hsl(var(--chart-2))' },
                { key: '운영 만족도', label: '운영 만족도', color: 'hsl(var(--chart-3))' },
              ]}
              xAxisLabel="교육 차수"
              yAxisLabel="만족도 점수"
            />
          </CardContent>
        </Card>
      )}

      {instructorStatsDisplay.length > 0 && (
        <InstructorStatsSection
          instructorStats={instructorStatsDisplay}
          previousStats={previousInstructorStatsDisplay}
          onInstructorClick={handleInstructorClick}
        />
      )}

      {textualResponses.length > 0 && <KeywordCloud textualResponses={textualResponses} />}
    </>
  ) : (
    <Card className="border-dashed text-center">
      <CardContent className="py-12">
        <Target className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-semibold">분석할 설문 데이터가 없습니다.</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {availableCourses.length === 0
            ? '선택한 연도에 완료된 설문이 없습니다. 다른 연도를 선택해 보세요.'
            : '과정과 필터를 선택하면 상세 결과를 확인할 수 있습니다.'}
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-secondary/5 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-primary">과정 운영 결과 보고</h1>
                <p className="text-sm text-muted-foreground">
                  과정별 종합 만족도와 강사별 통계를 한눈에 확인해 보세요.
                </p>
              </div>
            </div>
            {summary && (
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{summary.educationYear}년 {summary.educationRound ? `${summary.educationRound}차` : '전체'} 과정</span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                <span>{summary.totalSurveys.toLocaleString()}개 설문</span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                <span>{summary.totalResponses.toLocaleString()}명 응답</span>
              </div>
            )}
          </div>
          {summary && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleShareReport} className="bg-white/70">
                <Share2 className="mr-2 h-4 w-4" /> 공유하기
              </Button>
              <Button size="sm" onClick={handlePDFExport} className="bg-primary text-white shadow-md hover:bg-primary/90">
                <Download className="mr-2 h-4 w-4" /> PDF 다운로드
              </Button>
            </div>
          )}
        </div>
      </div>

      <CourseSelector
        selectedYear={selectedYear}
        selectedCourse={selectedCourse}
        selectedRound={selectedRound}
        selectedInstructor={selectedInstructor}
        availableCourses={availableCourses}
        availableRounds={availableRounds}
        availableInstructors={isInstructor ? [] : availableInstructors}
        years={YEARS}
        onYearChange={(value) => setSelectedYear(Number(value))}
        onCourseChange={setSelectedCourse}
        onRoundChange={(value) => setSelectedRound(value ? Number(value) : null)}
        onInstructorChange={setSelectedInstructor}
        testDataToggle={<TestDataToggle testDataOptions={testDataOptions} />}
        isInstructor={isInstructor}
        currentInstructorName={currentInstructorName}
      />
      <ChartErrorBoundary fallbackDescription="보고서 렌더링 중 오류가 발생했습니다. 필터를 변경해 다시 시도하세요.">
        {content}
      </ChartErrorBoundary>
    </div>
  );
};

export default CourseReports;
