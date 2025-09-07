// src/pages/CourseReports.tsx
import React, { useState, useEffect } from "react";
import AdminLayout from "@/components/layouts/AdminLayout";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { DonutChart } from "@/components/charts/DonutChart";
import { AreaChart } from "@/components/charts/AreaChart";
import {
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Bar,
  Legend,
} from "recharts";

import {
  TrendingUp,
  BookOpen,
  Star,
  Target,
  TrendingDown,
  Minus,
  Download,
  User,
  Crown,
  AlertCircle,
  BarChart3,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { useCourseReportsData } from "@/hooks/useCourseReportsData";
import CourseSelector from "@/components/course-reports/CourseSelector";
import InstructorStatsSection from "@/components/course-reports/InstructorStatsSection";
import { SatisfactionStatusBadge } from "@/components/course-reports/SatisfactionStatusBadge";
import { DrillDownModal } from "@/components/course-reports/DrillDownModal";
import { KeywordCloud } from "@/components/course-reports/KeywordCloud";
import { generateCourseReportPDF } from "@/utils/pdfExport";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

type YearlyStat = {
  instructor_satisfaction: number | null;
  course_satisfaction: number | null;
  operation_satisfaction: number | null;
};

const CourseReports: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [selectedInstructor, setSelectedInstructor] = useState<string>("");

  const [drillDownModal, setDrillDownModal] = useState<{
    isOpen: boolean;
    type: "instructor" | "course" | "operation";
    title: string;
  }>({ isOpen: false, type: "instructor", title: "" });

  const navigate = useNavigate();
  const { toast } = useToast();
  const { userRoles, user, signOut } = useAuth();

  const isInstructor = userRoles.includes("instructor");
  const isAdmin = userRoles.includes("admin");

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
    instructorId,
  } = useCourseReportsData(selectedYear, selectedCourse, selectedRound, selectedInstructor);

  useEffect(() => {
    fetchAvailableCourses();
  }, [selectedYear]);

  useEffect(() => {
    if (selectedCourse || selectedRound || selectedInstructor) {
      fetchReports();
      fetchYearlyComparison();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourse, selectedRound, selectedInstructor, instructorId]);

  // 첫 진입 시 첫 과정 자동 선택
  useEffect(() => {
    if (availableCourses.length > 0 && !selectedCourse) {
      setSelectedCourse(availableCourses[0].key);
    }
  }, [availableCourses, selectedCourse]);

  // 최근 5년 배열
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const currentReport = reports[0];
  const previousReport = previousReports[0];

  // 증감률 계산
  const calculateChange = (current: number, previous: number) => {
    if (!previous || previous === 0) return null;
    const change = current - previous;
    const percentage = (change / previous) * 100;
    return { change, percentage };
  };

  const surveyChange = previousReport
    ? calculateChange(currentReport?.total_surveys || 0, previousReport.total_surveys)
    : null;

  const responseChange = previousReport
    ? calculateChange(currentReport?.total_responses || 0, previousReport.total_responses)
    : null;

  const instructorChange = previousReport
    ? calculateChange(
        currentReport?.avg_instructor_satisfaction || 0,
        previousReport.avg_instructor_satisfaction
      )
    : null;

  // 강사 만족도 트렌드 (막대)
  const instructorTrendData = instructorStats.map((instructor) => ({
    name: instructor.instructor_name,
    만족도: Number(instructor.avg_satisfaction.toFixed(1)),
    응답수: instructor.response_count,
  }));

  // 이번 차수 막대그래프 데이터
  const currentRoundData =
    currentReport
      ? [
          { name: "강사 만족도", value: currentReport.avg_instructor_satisfaction },
          { name: "과정 만족도", value: currentReport.avg_course_satisfaction },
          {
            name: "운영 만족도",
            value: currentReport.report_data?.operation_satisfaction || 0,
          },
        ]
      : [];

  // 종합 만족도
  const overallSatisfaction = currentReport
    ? (currentReport.avg_instructor_satisfaction +
        currentReport.avg_course_satisfaction +
        (currentReport.report_data?.operation_satisfaction || 0)) /
      3
    : 0;

  // 응답률 (가정: 설문당 평균 20명)
  const responseRate =
    currentReport && currentReport.total_surveys > 0
      ? (currentReport.total_responses / (currentReport.total_surveys * 20)) * 100
      : 0;

  // 전년도 대비 비교 데이터 (명시적 타입 사용)
  const avg = (arr: YearlyStat[], key: keyof YearlyStat) => {
    const valid = arr.filter((s) => s[key] !== null);
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, s) => acc + Number(s[key] || 0), 0);
    return sum / valid.length;
  };

  const yc = {
    current: (yearlyComparison.current ?? []) as YearlyStat[],
    previous: (yearlyComparison.previous ?? []) as YearlyStat[],
  };

  const currentYearAvg = {
    instructor: avg(yc.current, "instructor_satisfaction"),
    course: avg(yc.current, "course_satisfaction"),
    operation: avg(yc.current, "operation_satisfaction"),
  };
  const previousYearAvg = {
    instructor: avg(yc.previous, "instructor_satisfaction"),
    course: avg(yc.previous, "course_satisfaction"),
    operation: avg(yc.previous, "operation_satisfaction"),
  };

  const yearlyComparisonData =
    yc.current.length && yc.previous.length
      ? [
          {
            category: "강사 만족도",
            [`${selectedYear}년`]: Number(currentYearAvg.instructor.toFixed(1)),
            [`${selectedYear - 1}년`]: Number(previousYearAvg.instructor.toFixed(1)),
          },
          {
            category: "과정 만족도",
            [`${selectedYear}년`]: Number(currentYearAvg.course.toFixed(1)),
            [`${selectedYear - 1}년`]: Number(previousYearAvg.course.toFixed(1)),
          },
          {
            category: "운영 만족도",
            [`${selectedYear}년`]: Number(currentYearAvg.operation.toFixed(1)),
            [`${selectedYear - 1}년`]: Number(previousYearAvg.operation.toFixed(1)),
          },
        ]
      : [];

  // 드릴다운 모달
  const openDrillDown = (type: "instructor" | "course" | "operation") => {
    const titles = {
      instructor: "강사 만족도",
      course: "과정 만족도",
      operation: "운영 만족도",
    } as const;
    setDrillDownModal({ isOpen: true, type, title: titles[type] });
  };

  // 강사 상세 이동
  const handleInstructorClick = (id: string) => {
    navigate(`/dashboard/instructor-details/${id}?year=${selectedYear}`);
  };

  // PDF 내보내기
  const handlePDFExport = () => {
    if (!currentReport) {
      toast({
        title: "오류",
        description: "내보낼 데이터가 없습니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      generateCourseReportPDF({
        reportTitle: isInstructor ? "개인 과정별 운영 결과 보고서" : "과정별 운영 결과 보고서",
        year: currentReport.education_year,
        round: currentReport.education_round > 0 ? currentReport.education_round : undefined,
        courseName: currentReport.course_title,
        totalSurveys: currentReport.total_surveys,
        totalResponses: currentReport.total_responses,
        instructorCount: currentReport.report_data?.instructor_count || 0,
        avgInstructorSatisfaction: currentReport.avg_instructor_satisfaction,
        avgCourseSatisfaction: currentReport.avg_course_satisfaction,
        avgOperationSatisfaction: currentReport.report_data?.operation_satisfaction || 0,
        instructorStats: instructorStats.map((stat) => ({
          name: stat.instructor_name,
          surveyCount: stat.survey_count,
          responseCount: stat.response_count,
          avgSatisfaction: stat.avg_satisfaction,
        })),
      });

      toast({ title: "성공", description: "PDF 파일이 다운로드되었습니다." });
    } catch (error) {
      console.error("PDF export error:", error);
      toast({
        title: "오류",
        description: "PDF 내보내기 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // AdminLayout header 구성
  const title = "과정별 분석";
  const subtitle = isInstructor ? "내 담당 과정 결과 분석" : "전체 과정 운영 결과";
  const totalCount = currentReport?.total_surveys;
  const actions = [
    currentReport ? (
      <Button key="pdf" onClick={handlePDFExport} variant="outline" size="sm">
        <Download className="h-4 w-4 mr-2" />
        PDF 내보내기
      </Button>
    ) : null,
    <span key="welcome" className="text-xs md:text-sm hidden sm:block">
      환영합니다, {user?.email}
    </span>,
    <Button key="logout" onClick={signOut} variant="outline" size="sm">
      로그아웃
    </Button>,
  ].filter(Boolean) as React.ReactNode[];

  const onRefresh = () => {
    fetchReports();
    fetchYearlyComparison();
  };

  // 로딩
  if (loading) {
    return (
      <AdminLayout
        title={title}
        subtitle={subtitle}
        totalCount={totalCount}
        actions={actions}
        onRefresh={onRefresh}
        loading
      >
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">데이터를 불러오는 중...</p>
          </div>
        </div>
      </AdminLayout>
    );
    }

  return (
    <AdminLayout
      title={title}
      subtitle={subtitle}
      totalCount={totalCount}
      actions={actions}
      onRefresh={onRefresh}
    >
      {/* 권한 안내 배너 */}
      {isInstructor && (
        <Card className="border-blue-200 bg-blue-50 mb-6">
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
        <Card className="border-green-200 bg-green-50 mb-6">
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

      {/* 소개 박스 */}
      <div className="bg-gradient-to-br from-primary/5 via-primary/10 to-secondary/5 rounded-xl p-6 border border-primary/20 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            {isInstructor ? "개인 과정별 운영 결과" : "과정별 운영 결과 보고"}
          </h1>
        </div>
        <p className="text-muted-foreground">
          {isInstructor
            ? "내가 담당한 과정별 종합적인 만족도 조사 결과를 확인할 수 있습니다."
            : "과정별 종합적인 만족도 조사 결과와 강사별 통계를 확인할 수 있습니다."}
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
        availableInstructors={isInstructor ? [] : availableInstructors}
        years={years}
        onYearChange={(value) => setSelectedYear(Number(value))}
        onCourseChange={setSelectedCourse}
        onRoundChange={(value) => setSelectedRound(value ? Number(value) : null)}
        onInstructorChange={setSelectedInstructor}
      />

      {/* 데이터 유무 분기 */}
      {currentReport ? (
        <>
          {/* KPI 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 my-6">
            <Card className="relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <BookOpen className="h-8 w-8 text-primary" />
                  {surveyChange && (
                    <div
                      className={`flex items-center gap-1 text-sm ${
                        surveyChange.change > 0
                          ? "text-green-600"
                          : surveyChange.change < 0
                          ? "text-red-600"
                          : "text-gray-600"
                      }`}
                    >
                      {surveyChange.change > 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : surveyChange.change < 0 ? (
                        <TrendingDown className="h-4 w-4" />
                      ) : (
                        <Minus className="h-4 w-4" />
                      )}
                      {surveyChange.percentage.toFixed(1)}%
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {isInstructor ? "내 설문 수" : "총 설문 수"}
                </p>
                <p className="text-3xl font-bold text-primary">{currentReport.total_surveys}</p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Target className="h-8 w-8 text-green-600" />
                  {responseChange && (
                    <div
                      className={`flex items-center gap-1 text-sm ${
                        responseChange.change > 0
                          ? "text-green-600"
                          : responseChange.change < 0
                          ? "text-red-600"
                          : "text-gray-600"
                      }`}
                    >
                      {responseChange.change > 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : responseChange.change < 0 ? (
                        <TrendingDown className="h-4 w-4" />
                      ) : (
                        <Minus className="h-4 w-4" />
                      )}
                      {responseChange.percentage.toFixed(1)}%
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {isInstructor ? "내 응답 수" : "총 응답 수"}
                </p>
                <p className="text-3xl font-bold text-green-600">{currentReport.total_responses}</p>
                <p className="text-xs text-muted-foreground">응답률 {responseRate.toFixed(1)}%</p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Star className="h-8 w-8 text-purple-600" />
                </div>
                <p className="text-sm text-muted-foreground">{isInstructor ? "참여 강사" : "참여 강사 수"}</p>
                <p className="text-3xl font-bold text-purple-600">
                  {isInstructor ? "본인" : currentReport.report_data?.instructor_count || 0}
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="h-8 w-8 text-orange-600" />
                  {instructorChange && (
                    <div
                      className={`flex items-center gap-1 text-sm ${
                        instructorChange.change > 0
                          ? "text-green-600"
                          : instructorChange.change < 0
                          ? "text-red-600"
                          : "text-gray-600"
                      }`}
                    >
                      {instructorChange.change > 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : instructorChange.change < 0 ? (
                        <TrendingDown className="h-4 w-4" />
                      ) : (
                        <Minus className="h-4 w-4" />
                      )}
                      {instructorChange.change > 0 ? "+" : ""}
                      {instructorChange.change.toFixed(1)}
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {isInstructor ? "내 평균 점수" : "전체 평균 점수"}
                </p>
                <p className="text-3xl font-bold text-orange-600">{overallSatisfaction.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">/ 10.0</p>
              </CardContent>
            </Card>
          </div>

          {/* 이번 차수 현황 & 최근 추이 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>이번 차수 영역별 만족도</CardTitle>
                <CardDescription>강사, 과정, 운영 만족도 현황</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={currentRoundData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.3)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                      axisLine={{ stroke: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      domain={[0, 10]}
                      tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                      axisLine={{ stroke: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--card-foreground))",
                      }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" name="만족도" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {trendData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>최근 5개 차수 만족도 추이</CardTitle>
                  <CardDescription>차수별 만족도 변화 트렌드</CardDescription>
                </CardHeader>
                <CardContent>
                  <AreaChart
                    data={trendData}
                    dataKeys={[
                      { key: "강사만족도", label: "강사만족도", color: "hsl(var(--primary))" },
                      { key: "과정만족도", label: "과정만족도", color: "hsl(var(--primary) / 0.8)" },
                      { key: "운영만족도", label: "운영만족도", color: "hsl(var(--primary) / 0.6)" },
                    ]}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Drill-down 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openDrillDown("instructor")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">강사 만족도</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl font-bold text-blue-600">
                    {currentReport.avg_instructor_satisfaction.toFixed(1)}
                  </span>
                  <SatisfactionStatusBadge score={currentReport.avg_instructor_satisfaction} />
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  세부 보기
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openDrillDown("course")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">과정 만족도</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl font-bold text-green-600">
                    {currentReport.avg_course_satisfaction.toFixed(1)}
                  </span>
                  <SatisfactionStatusBadge score={currentReport.avg_course_satisfaction} />
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  세부 보기
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openDrillDown("operation")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">운영 만족도</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl font-bold text-amber-600">
                    {(currentReport.report_data?.operation_satisfaction || 0).toFixed(1)}
                  </span>
                  <SatisfactionStatusBadge score={currentReport.report_data?.operation_satisfaction || 0} />
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  세부 보기
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* 강사 만족도 트렌드(막대) */}
          {instructorTrendData.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>{isInstructor ? "내 과정별 만족도 트렌드" : "강사 만족도 트렌드"}</CardTitle>
                <CardDescription>
                  {isInstructor ? "내가 담당한 과정별 만족도 평가" : "강사별 만족도 평가 비교 현황"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={instructorTrendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.3)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                      axisLine={{ stroke: "hsl(var(--muted-foreground))" }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      domain={[0, 10]}
                      tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                      axisLine={{ stroke: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid " + "hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--card-foreground))",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="만족도" fill="hsl(var(--primary))" name="평균 만족도" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* 전년도 대비 분석 */}
          {yearlyComparisonData.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>전년도 대비 만족도 비교</CardTitle>
                <CardDescription>
                  {selectedYear}년 vs {selectedYear - 1}년 만족도 변화 추이
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={yearlyComparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.3)" />
                    <XAxis dataKey="category" tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} axisLine={{ stroke: "hsl(var(--muted-foreground))" }} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} axisLine={{ stroke: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid " + "hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--card-foreground))",
                      }}
                    />
                    <Legend />
                    <Bar dataKey={`${selectedYear}년`} fill="hsl(var(--primary))" name={`${selectedYear}년`} radius={[4, 4, 0, 0]} />
                    <Bar dataKey={`${selectedYear - 1}년`} fill="hsl(var(--primary) / 0.7)" name={`${selectedYear - 1}년`} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* 응답자 분석 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>응답자 분포</CardTitle>
                <CardDescription>설문 응답자 구성</CardDescription>
              </CardHeader>
              <CardContent>
                <DonutChart
                  data={[
                    { name: "교육생", value: currentReport.total_responses * 0.8, color: "hsl(var(--primary))" },
                    { name: "강사", value: currentReport.total_responses * 0.15, color: "hsl(var(--primary) / 0.7)" },
                    { name: "운영자", value: currentReport.total_responses * 0.05, color: "hsl(var(--primary) / 0.4)" },
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>응답률 분석</CardTitle>
                <CardDescription>예상 인원 대비 실제 응답률</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      { name: "예상 응답", value: currentReport.total_surveys * 20, type: "예상" },
                      { name: "실제 응답", value: currentReport.total_responses, type: "실제" },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.3)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-center text-sm text-muted-foreground mt-2">응답률: {responseRate.toFixed(1)}%</p>
              </CardContent>
            </Card>
          </div>

          {/* 서술형 요약 */}
          <KeywordCloud textualResponses={textualResponses} />

          {/* 종합 요약 */}
          <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20 my-6">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">{isInstructor ? "개인 종합 만족도 평가" : "종합 만족도 평가"}</CardTitle>
              <CardDescription>{isInstructor ? "내 담당 과정 종합 점수" : "전체 영역 종합 점수"}</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="flex items-center justify-center gap-4">
                <span className="text-6xl font-bold text-primary">{overallSatisfaction.toFixed(1)}</span>
                <div className="text-left">
                  <p className="text-sm text-muted-foreground">/ 10.0</p>
                  <SatisfactionStatusBadge score={overallSatisfaction} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">강사</p>
                  <p className="text-xl font-bold text-blue-600">
                    {currentReport.avg_instructor_satisfaction.toFixed(1)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">과정</p>
                  <p className="text-xl font-bold text-green-600">{currentReport.avg_course_satisfaction.toFixed(1)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">운영</p>
                  <p className="text-xl font-bold text-amber-600">
                    {(currentReport.report_data?.operation_satisfaction || 0).toFixed(1)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 강사별 통계 (관리자 전용) */}
          {!isInstructor && instructorStats.length > 0 && (
            <div className="max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 border rounded-lg">
              <InstructorStatsSection instructorStats={instructorStats} onInstructorClick={handleInstructorClick} />
            </div>
          )}

          {/* 드릴다운 모달 */}
          <DrillDownModal
            isOpen={drillDownModal.isOpen}
            onClose={() => setDrillDownModal((prev) => ({ ...prev, isOpen: false }))}
            title={drillDownModal.title}
            type={drillDownModal.type}
            instructorStats={instructorStats}
            textualResponses={textualResponses}
          />
        </>
      ) : (
        <Card className="text-center py-12 my-6">
          <CardContent>
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">데이터 없음</h3>
            <p className="text-muted-foreground">
              {availableCourses.length === 0
                ? isInstructor
                  ? "담당하신 과정의 완료된 설문이 없습니다."
                  : "선택한 연도에 완료된 설문이 없습니다."
                : "과정을 선택하여 결과를 확인하세요."}
            </p>
          </CardContent>
        </Card>
      )}
    </AdminLayout>
  );
};

export default CourseReports;
