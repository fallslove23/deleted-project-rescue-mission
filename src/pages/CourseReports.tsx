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
import CourseSelector, { CombinedCourseOption } from '@/components/course-reports/CourseSelector';
import CourseStatsCards from '@/components/course-reports/CourseStatsCards';
import InstructorStatsSection from '@/components/course-reports/InstructorStatsSection';
import { DonutChart } from '@/components/charts/DonutChart';
import { AreaChart } from '@/components/charts/AreaChart';
import { KeywordCloud } from '@/components/course-reports/KeywordCloud';
import { useCourseReportsData } from '@/hooks/useCourseReportsData';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { generateCourseReportPDF } from '@/utils/pdfExport';
import { CourseOption } from '@/repositories/courseReportsRepositoryFixed';
import { ChartErrorBoundary, PageErrorBoundary, HookErrorBoundary, DataProcessingErrorBoundary } from '@/components/error-boundaries';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, index) => CURRENT_YEAR - index);

const toFixedOrZero = (value: number | null | undefined, digits = 1) => {
  // Comprehensive NaN/invalid number handling
  if (value === null || value === undefined) return 0;
  if (typeof value !== 'number') return 0;
  if (!Number.isFinite(value) || Number.isNaN(value)) return 0;
  
  const rounded = Number(value.toFixed(digits));
  return Number.isFinite(rounded) && !Number.isNaN(rounded) ? rounded : 0;
};

const CourseReports: React.FC = () => {
  return (
    <PageErrorBoundary pageName="Course Reports">
      <CourseReportsContent />
    </PageErrorBoundary>  
  );
};

const CourseReportsContent: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userRoles } = useAuth();
  

  // 단순화된 필터: 연도와 결합된 과정 선택
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('all');
  const [selectedCombinedCourse, setSelectedCombinedCourse] = useState<string>('all');
  
  // 내부적으로 사용할 분해된 값들
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [selectedInstructor, setSelectedInstructor] = useState<string>('');
  const [allCoursesForYear, setAllCoursesForYear] = useState<CourseOption[]>([]);

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
    false,
  );

  // 연도 변경 또는 전체 과정 선택 시, 해당 연도의 전체 과정 목록을 유지
  useEffect(() => {
    if (Array.isArray(availableCourses) && availableCourses.length > 0) {
      if (selectedCombinedCourse === 'all') {
        setAllCoursesForYear(availableCourses);
      } else if (allCoursesForYear.length === 0) {
        // 초기 로딩 보호: 선택된 과정이 있어도 목록이 비어있으면 한 번 채움
        setAllCoursesForYear(availableCourses);
      }
    }
  }, [selectedYear, availableCourses, selectedCombinedCourse, allCoursesForYear.length]);

  // 사용 가능한 연도 옵션 생성
  const availableYears = useMemo(() => {
    const years = ['all', ...YEARS.map(year => year.toString())];
    return years;
  }, []);

  // 결합된 과정 옵션 생성
  const combinedCourseOptions = useMemo((): CombinedCourseOption[] => {
    const combined: CombinedCourseOption[] = [
      {
        key: 'all',
        displayName: '전체 과정',
        year: selectedYear,
        course: '',
        round: null,
        instructor: ''
      }
    ];

    // 현재 연도 기준 전체 과정 목록을 유지하여, 특정 과정 선택 시에도 목록이 사라지지 않도록 함
    const sourceCourses = (allCoursesForYear.length > 0 ? allCoursesForYear : availableCourses) || [];

    // 각 과정별 보유 차수(rounds)를 사용해 옵션 생성 (글로벌 availableRounds 사용 금지)
    sourceCourses.forEach((course) => {
      const rounds = Array.isArray(course.rounds) ? [...course.rounds].sort((a, b) => a - b) : [];
      rounds.forEach((round) => {
        const name = course.displayName || course.normalizedName;
        const displayName = `${selectedYear}년 ${round}차 ${name}`;
        combined.push({
          key: `${selectedYear}-${course.normalizedName}-${round}`,
          displayName,
          year: selectedYear,
          course: course.normalizedName,
          round,
          instructor: ''
        });
      });
    });

    return combined;
  }, [selectedYear, allCoursesForYear, availableCourses]);

  // 결합된 과정 선택 파싱
  const parseCombinedCourse = (courseKey: string) => {
    if (courseKey === 'all') {
      return { year: selectedYear, course: '', round: null, instructor: '' };
    }
    
    const parts = courseKey.split('-');
    if (parts.length >= 3) {
      const year = parseInt(parts[0]);
      const course = parts[1];
      const round = parseInt(parts[2]);
      return { year, course, round, instructor: '' };
    }
    
    return { year: selectedYear, course: '', round: null, instructor: '' };
  };

  // 연도 변경 핸들러
  const handleYearChange = (year: string) => {
    setSelectedYearFilter(year);
    if (year === 'all') {
      setSelectedYear(CURRENT_YEAR);
    } else {
      setSelectedYear(parseInt(year));
    }
    // 연도 변경시 과정 선택 초기화
    setSelectedCombinedCourse('all');
    setSelectedCourse('');
    setSelectedRound(null);
    setSelectedInstructor('');
    setAllCoursesForYear([]);
  };

  // 결합된 과정 변경 핸들러
  const handleCombinedCourseChange = (courseKey: string) => {
    setSelectedCombinedCourse(courseKey);
    const parsed = parseCombinedCourse(courseKey);
    
    // 연도가 바뀌는 경우에만 연도 필터도 업데이트
    if (parsed.year !== selectedYear) {
      setSelectedYearFilter(parsed.year.toString());
      setSelectedYear(parsed.year);
    }
    
    setSelectedCourse(parsed.course);
    setSelectedRound(parsed.round);
    setSelectedInstructor(parsed.instructor);
  };

  // 자동 초기화 로직은 제거 (사용자가 직접 선택하도록 함)

  // 과정 표시 이름 계산
  const currentCourseName = useMemo(() => {
    if (summary?.courseName) return summary.courseName;
    const match = availableCourses.find(c => c.normalizedName === selectedCourse);
    return match?.displayName || selectedCourse || '';
  }, [summary?.courseName, availableCourses, selectedCourse]);

  const satisfactionChartData = useMemo(() => {
    if (!summary) return [] as Array<{ name: string; value: number; color: string }>;

    const data = [
      { name: '강사 만족도', value: toFixedOrZero(summary.avgInstructorSatisfaction), color: 'hsl(var(--chart-1))' },
      { name: '과정 만족도', value: toFixedOrZero(summary.avgCourseSatisfaction), color: 'hsl(var(--chart-2))' },
      { name: '운영 만족도', value: toFixedOrZero(summary.avgOperationSatisfaction), color: 'hsl(var(--chart-3))' },
    ];

    return data
      .filter((item) => Number.isFinite(item.value) && !Number.isNaN(item.value) && item.value > 0)
      .map(item => ({
        ...item,
        value: Number.isFinite(item.value) ? item.value : 0
      }));
  }, [summary]);

  const trendChartData = useMemo(() => {
    if (!Array.isArray(trend)) return [];
    return trend
      .map((point, index) => {
        const instructorVal = toFixedOrZero(point.avgInstructorSatisfaction);
        const courseVal = toFixedOrZero(point.avgCourseSatisfaction);
        const operationVal = toFixedOrZero(point.avgOperationSatisfaction);
        return {
          name: point.educationRound ? `${point.educationRound}차` : `기준 ${index + 1}`,
          '강사 만족도': Number.isFinite(instructorVal) ? instructorVal : 0,
          '과정 만족도': Number.isFinite(courseVal) ? courseVal : 0,
          '운영 만족도': Number.isFinite(operationVal) ? operationVal : 0,
        };
      })
      .filter(item => item['강사 만족도'] > 0 || item['과정 만족도'] > 0 || item['운영 만족도'] > 0);
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
        description: '데이터를 불러온 후 다시 시도해 주세요.',
        variant: 'destructive',
      });
      return;
    }

      const shareData = {
        title: `${selectedYear}년 ${currentCourseName}${selectedRound ? `-${selectedRound}차` : ''} 결과 보고서`,
        text: `${selectedYear}년 ${currentCourseName}${selectedRound ? `-${selectedRound}차` : ''} 결과를 확인해보세요.`,
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
        description: '데이터를 불러온 후 다시 시도해 주세요.',
        variant: 'destructive',
      });
      return;
    }

    try {
      generateCourseReportPDF({
        reportTitle: `${currentCourseName}${selectedRound ? ` ${selectedRound}차` : ''} 결과 보고서`,
        year: summary.educationYear,
        round: summary.educationRound ?? undefined,
        courseName: currentCourseName,
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
            <ChartErrorBoundary fallbackDescription="만족도 차트를 표시할 수 없습니다.">
              <DonutChart data={satisfactionChartData} />
            </ChartErrorBoundary>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              만족도 요약
            </CardTitle>
            <CardDescription>전체 과정의 핵심 지표를 한눈에 확인하세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">과정명</span>
                <span className="font-semibold">{currentCourseName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">교육 연도</span>
                <span className="font-semibold">{summary.educationYear}년</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">응답한 인원수</span>
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
            <ChartErrorBoundary fallbackDescription="만족도 추이 차트를 표시할 수 없습니다. 데이터를 확인해 주세요.">
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
            </ChartErrorBoundary>
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
          선택한 연도에 완료된 설문이 없습니다. 다른 연도를 선택해 보세요.
        </p>
      </CardContent>
    </Card>
  );

  return (
    <HookErrorBoundary hookName="useCourseReportsData">
      <div className="space-y-6">
        <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-secondary/5 p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-primary">설문 결과 분석</h1>
                  <p className="text-sm text-muted-foreground">
                    설문 응답자 주요 지표를 서비스에서 진행한 데이터로 제공합니다.
                  </p>
                </div>
              </div>
              {summary && (
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>{summary.educationYear}년 전체 과정</span>
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
                <Button variant="outline" size="sm" onClick={handlePDFExport} className="bg-white/70">
                  <Download className="mr-2 h-4 w-4" /> PDF 다운로드
                </Button>
              </div>
            )}
          </div>
        </div>

        <CourseSelector
          selectedYear={selectedYearFilter}
          selectedCourse={selectedCombinedCourse}
          availableYears={availableYears}
          availableCourses={combinedCourseOptions}
          onYearChange={handleYearChange}
          onCourseChange={handleCombinedCourseChange}
        />

        <ChartErrorBoundary fallbackDescription="보고서 렌더링 중 오류가 발생했습니다.">
          {content}
        </ChartErrorBoundary>
      </div>
    </HookErrorBoundary>
  );
};

export default CourseReports;