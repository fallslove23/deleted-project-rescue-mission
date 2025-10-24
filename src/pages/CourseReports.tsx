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
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import CourseStatsCards from '@/components/course-reports/CourseStatsCards';
import InstructorStatsSection from '@/components/course-reports/InstructorStatsSection';
import { DonutChart } from '@/components/charts/DonutChart';
import { AreaChart } from '@/components/charts/AreaChart';
import { KeywordCloud } from '@/components/course-reports/KeywordCloud';
import { YearFilter, CourseFilter } from '@/components/filters';
import { useFilterState } from '@/hooks/useFilterState';
import { useCourseReportsData } from '@/hooks/useCourseReportsData';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { generateCourseReportPDF } from '@/utils/pdfExport';
import { ChartErrorBoundary, PageErrorBoundary, HookErrorBoundary, DataProcessingErrorBoundary } from '@/components/error-boundaries';
import { fetchDashboardCounts, type DashboardCounts } from '@/repositories/dashboardRepository';

const CURRENT_YEAR = new Date().getFullYear();

const toFixedOrZero = (value: number | null | undefined, digits = 1) => {
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
  
  // Use new filter state hook with URL synchronization
  const { filters, updateFilter } = useFilterState({
    defaultYear: CURRENT_YEAR,
    syncToUrl: true,
  });

  const [selectedSessionKey, setSelectedSessionKey] = useState<string>('');
  const [selectedCourseLabel, setSelectedCourseLabel] = useState<string>('전체 과정');
  const [dashboardCounts, setDashboardCounts] = useState<DashboardCounts | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(false);

  const {
    summary,
    previousSummary,
    trend,
    instructorStats,
    previousInstructorStats,
    textualResponses,
    availableSessions,  // Changed from availableCourses
    availableRounds,
    availableInstructors,
    loading,
    isInstructor,
    instructorId,
    instructorName,
  } = useCourseReportsData(
    filters.year || CURRENT_YEAR,
    selectedSessionKey, // Now passing sessionKey instead of courseName
    null, // round - not using round filter for now
    '', // instructor - not filtering by instructor in this view
    false,
  );

  // Fetch dashboard counts when year or sessionKey changes
  useEffect(() => {
    const loadDashboardCounts = async () => {
      setLoadingCounts(true);
      try {
        const counts = await fetchDashboardCounts(
          filters.year || CURRENT_YEAR,
          selectedSessionKey || null
        );
        setDashboardCounts(counts);
      } catch (error) {
        console.error('Failed to load dashboard counts:', error);
        toast({
          title: '오류',
          description: '대시보드 통계를 불러오지 못했습니다.',
          variant: 'destructive',
        });
      } finally {
        setLoadingCounts(false);
      }
    };

    loadDashboardCounts();
  }, [filters.year, selectedSessionKey, toast]);

  // Sync session key from filters.courseId (which now contains sessionKey UUID)
  useEffect(() => {
    if (filters.courseId) {
      setSelectedSessionKey(filters.courseId);
    } else {
      setSelectedSessionKey('');
      setSelectedCourseLabel('전체 과정');
    }
  }, [filters.courseId]);

  const currentCourseName = useMemo(() => {
    return selectedCourseLabel || '전체 과정';
  }, [selectedCourseLabel]);

  const satisfactionChartData = useMemo(() => {
    if (!dashboardCounts || !dashboardCounts.avg_score) return [] as Array<{ name: string; value: number; color: string }>;

    // Use the same avg_score for all three categories as a simplified version
    // In a real implementation, you might want to fetch separate scores
    const avgValue = toFixedOrZero(dashboardCounts.avg_score);

    const data = [
      { name: '강사 만족도', value: avgValue, color: 'hsl(var(--chart-1))' },
      { name: '과정 만족도', value: avgValue, color: 'hsl(var(--chart-2))' },
      { name: '운영 만족도', value: avgValue, color: 'hsl(var(--chart-3))' },
    ];

    return data
      .filter((item) => Number.isFinite(item.value) && !Number.isNaN(item.value) && item.value > 0)
      .map(item => ({
        ...item,
        value: Number.isFinite(item.value) ? item.value : 0
      }));
  }, [dashboardCounts]);

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
    if (!dashboardCounts || !dashboardCounts.avg_score) return 0;
    return toFixedOrZero(dashboardCounts.avg_score);
  }, [dashboardCounts]);

  const satisfactionChange = useMemo(() => {
    // Previous year comparison is not implemented in new RPC
    // Could be added later if needed
    return null;
  }, []);

  const handleInstructorClick = (instructorIdValue: string) => {
    if (!instructorIdValue) return;
    navigate(`/dashboard/instructor-details/${instructorIdValue}?year=${filters.year || CURRENT_YEAR}`);
  };

  const hasExportable = useMemo(() => {
    return (dashboardCounts?.survey_count ?? 0) > 0;
  }, [dashboardCounts]);

  const handleShareReport = () => {
    if (!hasExportable) {
      toast({
        title: '공유할 데이터가 없습니다.',
        description: '데이터를 불러온 후 다시 시도해 주세요.',
        variant: 'destructive',
      });
      return;
    }

    const shareData = {
      title: `${filters.year || CURRENT_YEAR}년 ${currentCourseName} 결과 보고서`,
      text: `${filters.year || CURRENT_YEAR}년 ${currentCourseName} 결과를 확인해보세요.`,
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
    if (!hasExportable) {
      toast({
        title: '내보낼 데이터가 없습니다.',
        description: '데이터를 불러온 후 다시 시도해 주세요.',
        variant: 'destructive',
      });
      return;
    }

    try {
      generateCourseReportPDF({
        reportTitle: `${currentCourseName} 결과 보고서`,
        year: filters.year || CURRENT_YEAR,
        round: undefined,
        courseName: currentCourseName,
        totalSurveys: dashboardCounts.survey_count,
        totalResponses: dashboardCounts.respondent_count,
        instructorCount: dashboardCounts.instructor_count,
        avgInstructorSatisfaction: dashboardCounts.avg_score ? toFixedOrZero(dashboardCounts.avg_score) : 0,
        avgCourseSatisfaction: dashboardCounts.avg_score ? toFixedOrZero(dashboardCounts.avg_score) : 0,
        avgOperationSatisfaction: dashboardCounts.avg_score ? toFixedOrZero(dashboardCounts.avg_score) : 0,
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

  const content = (loading || loadingCounts) ? (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
      데이터를 불러오는 중입니다...
    </div>
  ) : dashboardCounts ? (
    <>
      {selectedSessionKey && dashboardCounts.survey_count === 0 && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
          선택한 세션으로 귀속된 응답이 없어 요약 지표가 0으로 표시됩니다. 
          <span className="block mt-1 text-xs">
            (관리자 안내: 응답의 <code className="px-1 py-0.5 bg-amber-100 rounded">session_id</code> 매핑 필요)
          </span>
        </div>
      )}
      
      <CourseStatsCards
        totalSurveys={dashboardCounts?.survey_count || 0}
        totalResponses={dashboardCounts?.respondent_count || 0}
        instructorCount={dashboardCounts?.instructor_count || 0}
        avgSatisfaction={dashboardCounts?.avg_score ? toFixedOrZero(dashboardCounts.avg_score) : 0}
      />

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              영역별 만족도
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">강사, 과정, 운영 만족도를 비교해 보세요.</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] sm:h-[320px]">
            <ChartErrorBoundary fallbackDescription="만족도 차트를 표시할 수 없습니다.">
              <DonutChart data={satisfactionChartData} />
            </ChartErrorBoundary>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Star className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              만족도 요약
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">전체 과정의 핵심 지표를 한눈에 확인하세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between text-sm sm:text-base">
                <span className="text-xs sm:text-sm text-muted-foreground">과정명</span>
                <span className="font-semibold truncate ml-2">{currentCourseName}</span>
              </div>
              <div className="flex items-center justify-between text-sm sm:text-base">
                <span className="text-xs sm:text-sm text-muted-foreground">교육 연도</span>
                <span className="font-semibold">{filters.year || CURRENT_YEAR}년</span>
              </div>
              <div className="flex items-center justify-between text-sm sm:text-base">
                <span className="text-xs sm:text-sm text-muted-foreground">응답한 인원수</span>
                <span className="font-semibold">{dashboardCounts?.respondent_count.toLocaleString() || 0}명</span>
              </div>
              <div className="flex items-center justify-between text-sm sm:text-base">
                <span className="text-xs sm:text-sm text-muted-foreground">참여 강사</span>
                <span className="font-semibold">{dashboardCounts?.instructor_count.toLocaleString() || 0}명</span>
              </div>
              <div className="flex items-center justify-between border-t pt-3 sm:pt-4">
                <div>
                  <div className="text-xs sm:text-sm text-muted-foreground">종합 만족도</div>
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
                <div className="flex items-baseline gap-1 sm:gap-2">
                  <span className="text-3xl sm:text-4xl font-bold text-primary">{overallSatisfaction.toFixed(1)}</span>
                  <span className="text-xs sm:text-sm text-muted-foreground">/ 10점</span>
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
              {dashboardCounts && (
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>{filters.year || CURRENT_YEAR}년 전체 과정</span>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                  <span>{dashboardCounts.survey_count.toLocaleString()}개 설문</span>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                  <span>{dashboardCounts.respondent_count.toLocaleString()}명 응답</span>
                </div>
              )}
            </div>
            {dashboardCounts && (
              <div className="flex flex-wrap items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleShareReport} 
                  className="bg-white/70"
                  disabled={!hasExportable}
                  title={!hasExportable ? '내보낼 데이터가 없습니다' : ''}
                >
                  <Share2 className="mr-2 h-4 w-4" /> 공유하기
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handlePDFExport} 
                  className="bg-white/70"
                  disabled={!hasExportable}
                  title={!hasExportable ? '내보낼 데이터가 없습니다' : ''}
                >
                  <Download className="mr-2 h-4 w-4" /> PDF 다운로드
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* New Filter System */}
        <Card className="shadow-lg border-0 bg-gradient-to-r from-card to-card/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              <CardTitle>필터</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <YearFilter
              value={filters.year}
              onChange={(year) => updateFilter('year', year)}
              includeAll={false}
            />
            <CourseFilter
              value={filters.courseId}
              onChange={(sessionKey, label) => {
                updateFilter('courseId', sessionKey, { courseTitle: label });
                setSelectedCourseLabel(label || '전체 과정');
              }}
              year={filters.year}
              includeAll={true}
            />
          </CardContent>
        </Card>

        <ChartErrorBoundary fallbackDescription="보고서 렌더링 중 오류가 발생했습니다.">
          {content}
        </ChartErrorBoundary>
      </div>
    </HookErrorBoundary>
  );
};

export default CourseReports;
