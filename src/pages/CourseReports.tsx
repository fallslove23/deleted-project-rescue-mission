import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart as ReBarChart,
  LineChart as ReLineChart,
  Bar,
  Line,
  Cell,
} from 'recharts';
import { BarChart3, BookOpen, Download, Share2, Star, Target, TrendingUp, User, Crown, AlertCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import CourseSelector from '@/components/course-reports/CourseSelector';
import InstructorStatsSection from '@/components/course-reports/InstructorStatsSection';
import { KeywordCloud } from '@/components/course-reports/KeywordCloud';
import { DrillDownModal } from '@/components/course-reports/DrillDownModal';
import { generateCourseReportPDF } from '@/utils/pdfExport';
import { useCourseReportsData } from '@/hooks/useCourseReportsData';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { TestDataToggle } from '@/components/TestDataToggle';
import { useTestDataToggle } from '@/hooks/useTestDataToggle';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, index) => CURRENT_YEAR - index);

const toFixedOrZero = (value: number | null | undefined, digits = 1) => {
  if (typeof value !== 'number' || !isFinite(value)) return 0;
  const rounded = Number(value.toFixed(digits));
  return isNaN(rounded) ? 0 : rounded;
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
  const [drillDownModal, setDrillDownModal] = useState<{
    isOpen: boolean;
    type: 'instructor' | 'course' | 'operation';
    title: string;
  }>({ isOpen: false, type: 'instructor', title: '' });

  const isInstructor = userRoles.includes('instructor');
  const isAdmin = userRoles.includes('admin');

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
    isInstructor: hookIsInstructor,
    instructorId,
  } = useCourseReportsData(
    selectedYear,
    selectedCourse,
    selectedRound,
    selectedInstructor,
    testDataOptions.includeTestData
  );

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
    if (!summary) return [];
    return [
      {
        name: '강사 만족도',
        value: toFixedOrZero(summary.avgInstructorSatisfaction),
        fill: 'hsl(var(--chart-1))',
      },
      {
        name: '과정 만족도',
        value: toFixedOrZero(summary.avgCourseSatisfaction),
        fill: 'hsl(var(--chart-2))',
      },
      {
        name: '운영 만족도',
        value: toFixedOrZero(summary.avgOperationSatisfaction),
        fill: 'hsl(var(--chart-3))',
      },
    ];
  }, [summary]);

  const trendChartData = useMemo(() =>
    trend
      .map((point) => ({
        name: point.educationRound ? `${point.educationRound}차` : '전체',
        강사만족도: toFixedOrZero(point.avgInstructorSatisfaction),
        과정만족도: toFixedOrZero(point.avgCourseSatisfaction),
        운영만족도: toFixedOrZero(point.avgOperationSatisfaction),
      }))
      .filter((item) => item.강사만족도 > 0 || item.과정만족도 > 0 || item.운영만족도 > 0),
    [trend]
  );

  const instructorStatsDisplay = useMemo(
    () =>
      instructorStats.map((stat) => ({
        instructor_id: stat.instructorId ?? '',
        instructor_name: stat.instructorName,
        survey_count: stat.surveyCount,
        response_count: stat.responseCount,
        avg_satisfaction: toFixedOrZero(stat.avgSatisfaction),
      })),
    [instructorStats]
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
    [previousInstructorStats]
  );

  const overallSatisfaction = useMemo(() => {
    if (!summary) return 0;
    const scores = [
      summary.avgInstructorSatisfaction,
      summary.avgCourseSatisfaction,
      summary.avgOperationSatisfaction,
    ].map((value) => (typeof value === 'number' && isFinite(value) ? value : null));
    const validScores = scores.filter((value): value is number => typeof value === 'number');
    if (validScores.length === 0) return 0;
    const average = validScores.reduce((acc, value) => acc + value, 0) / validScores.length;
    return toFixedOrZero(average);
  }, [summary]);

  const calculateChange = (current?: number, previous?: number) => {
    if (!current || !previous || previous === 0) return null;
    const change = current - previous;
    const percentage = (change / previous) * 100;
    return { change, percentage };
  };

  const surveyChange = summary && previousSummary
    ? calculateChange(summary.totalSurveys, previousSummary.totalSurveys)
    : null;
  const responseChange = summary && previousSummary
    ? calculateChange(summary.totalResponses, previousSummary.totalResponses)
    : null;
  const instructorChange = summary && previousSummary
    ? calculateChange(
        summary.avgInstructorSatisfaction ?? 0,
        previousSummary.avgInstructorSatisfaction ?? 0
      )
    : null;

  const handleInstructorClick = (instructorIdValue: string) => {
    if (!instructorIdValue) return;
    navigate(`/dashboard/instructor-details/${instructorIdValue}?year=${selectedYear}`);
  };

  const handleShareReport = () => {
    if (!summary) return;
    const shareData = {
      title: `${currentCourseName} 과정별 결과 보고서`,
      text: `${selectedYear}년 ${currentCourseName} 과정의 운영 결과를 확인해보세요.`,
      url: window.location.href,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      navigator.share(shareData).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {
        toast({
          title: '링크 복사됨',
          description: '보고서 링크가 클립보드에 복사되었습니다.',
        });
      });
    }
  };

  const handlePDFExport = () => {
    if (!summary) {
      toast({
        title: '오류',
        description: '내보낼 데이터가 없습니다.',
        variant: 'destructive',
      });
      return;
    }

    try {
      generateCourseReportPDF({
        reportTitle: hookIsInstructor ? '개인 과정별 운영 결과 보고서' : '과정별 운영 결과 보고서',
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
        title: '성공',
        description: 'PDF 파일이 다운로드되었습니다.',
      });
    } catch (error) {
      console.error('PDF export error', error);
      toast({
        title: '오류',
        description: 'PDF 내보내기 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const openDrillDown = (type: 'instructor' | 'course' | 'operation') => {
    const titles = {
      instructor: '강사 만족도 세부 분석',
      course: '과정 만족도 세부 분석',
      operation: '운영 만족도 세부 분석',
    };
    setDrillDownModal({ isOpen: true, type, title: titles[type] });
  };

  const actions = summary ? (
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

  const showEmptyState = hookIsInstructor && instructorId && (!summary || summary.totalResponses === 0);

  return (
    <DashboardLayout
      title="과정 결과 보고"
      subtitle={isInstructor ? '내 담당 과정 결과 분석' : '전체 과정 운영 결과'}
      icon={<BarChart3 className="h-5 w-5 text-white" />}
      actions={actions}
      loading={loading}
    >
      <div className="space-y-6">
        {isInstructor && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-medium text-blue-900">개인 과정 분석</h3>
                  <p className="text-sm text-blue-700">회원님이 담당하신 과정들의 만족도 결과만 표시됩니다.</p>
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
                  <p className="text-sm text-green-700">모든 강사의 과정 결과를 확인하고 비교 분석할 수 있습니다.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {showEmptyState && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
              <h3 className="font-medium text-orange-900 mb-2">설문 데이터가 없습니다</h3>
              <p className="text-sm text-orange-700 mb-4">아직 담당하신 과정의 설문 결과가 없습니다.</p>
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
        />

        {summary && (
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
                  <div className="text-4xl font-bold text-purple-900">{overallSatisfaction.toFixed(1)}</div>
                  <p className="text-sm text-purple-700">점 / 10점 만점</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card onClick={() => openDrillDown('course')} className="cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 설문</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalSurveys}</div>
                <p className="text-xs text-muted-foreground">진행된 설문 수</p>
                {surveyChange && (
                  <p className={`text-xs mt-2 ${surveyChange.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {surveyChange.change >= 0 ? '▲' : '▼'} {Math.abs(surveyChange.percentage).toFixed(1)}%
                  </p>
                )}
              </CardContent>
            </Card>

            <Card onClick={() => openDrillDown('course')} className="cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 응답</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalResponses}</div>
                <p className="text-xs text-muted-foreground">수집된 응답 수</p>
                {responseChange && (
                  <p className={`text-xs mt-2 ${responseChange.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {responseChange.change >= 0 ? '▲' : '▼'} {Math.abs(responseChange.percentage).toFixed(1)}%
                  </p>
                )}
              </CardContent>
            </Card>

            <Card onClick={() => openDrillDown('instructor')} className="cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">강사 만족도</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{toFixedOrZero(summary.avgInstructorSatisfaction).toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">평균 만족도</p>
                {instructorChange && (
                  <p className={`text-xs mt-2 ${instructorChange.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {instructorChange.change >= 0 ? '▲' : '▼'} {Math.abs(instructorChange.percentage).toFixed(1)}%
                  </p>
                )}
              </CardContent>
            </Card>

            <Card onClick={() => openDrillDown('operation')} className="cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">운영 만족도</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{toFixedOrZero(summary.avgOperationSatisfaction).toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">평균 만족도</p>
              </CardContent>
            </Card>
          </div>
        )}

        {summary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                영역별 만족도 비교
              </CardTitle>
              <CardDescription>강사, 과목, 운영 영역별 현재 만족도 현황</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ReBarChart data={satisfactionChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(1)}점`, '만족도']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="value">
                    {satisfactionChartData.map((item, index) => (
                      <Cell key={index} fill={item.fill} />
                    ))}
                  </Bar>
                </ReBarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {trendChartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                차수별 만족도 추이
              </CardTitle>
              <CardDescription>최근 차수별 만족도 흐름을 확인합니다</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <ReLineChart data={trendChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(1)}점`, '만족도']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="강사만족도" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="과정만족도" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="운영만족도" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 4 }} />
                </ReLineChart>
              </ResponsiveContainer>
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

        <DrillDownModal
          isOpen={drillDownModal.isOpen}
          onClose={() => setDrillDownModal((prev) => ({ ...prev, isOpen: false }))}
          title={drillDownModal.title}
          type={drillDownModal.type}
          instructorStats={instructorStatsDisplay}
          textualResponses={textualResponses}
        />
      </div>
    </DashboardLayout>
  );
};

export default CourseReports;
