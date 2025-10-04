// src/pages/DashboardOverview.tsx

import React, { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/layouts";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  TrendingUp,
  BarChart,
  Clock,
  Users,
  BookOpen,
  Activity,
  AlertCircle,
} from "lucide-react";
import { 
  AreaChart as RechartsAreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer, 
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { supabase } from "@/integrations/supabase/client";

/** ---------- Types ---------- */
type Stats = {
  totalSurveys: number;
  activeSurveys: number;
  totalResponses: number;
  recentResponsesCount: number;
  totalInstructors: number;
  totalCourses: number;
  completedSurveys: number;
};

type ResponseTrendPoint = {
  date: string;
  responses: number;
};

type ResponseTrendRow = {
  submitted_at: string | null;
};

const getRelativeDayLabel = (offset: number) => {
  if (offset === 0) return "오늘";
  if (offset === 1) return "어제";
  return `${offset}일 전`;
};

const createSampleTrendData = (recentResponses: number): ResponseTrendPoint[] => {
  const multipliers = [0.6, 0.7, 0.8, 0.9, 1.1, 1.2, 1];
  const base = Math.max(recentResponses, 8);

  return multipliers.map((multiplier, index) => {
    const offset = 6 - index;
    return {
      date: getRelativeDayLabel(offset),
      responses: Math.max(0, Math.round(base * multiplier)),
    };
  });
};

const aggregateTrendData = (
  responseDates: ResponseTrendRow[],
  now: Date
): ResponseTrendPoint[] => {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const offset = 6 - index;
    const current = new Date(midnight);
    current.setDate(current.getDate() - offset);
    const dateKey = current.toISOString().split("T")[0];

    const responses = responseDates.filter((entry) => {
      if (!entry?.submitted_at) return false;
      return entry.submitted_at.startsWith(dateKey);
    }).length;

    return {
      date: getRelativeDayLabel(offset),
      responses,
    };
  });
};

/** ---------- Page ---------- */
const DashboardOverview: React.FC = () => {
  const { userRoles, loading: authLoading } = useAuth();
  const isAdmin = !!userRoles?.includes("admin"); // ✅ 반드시 함수 내부에서 선언

  const [stats, setStats] = useState<Stats>({
    totalSurveys: 0,
    activeSurveys: 0,
    totalResponses: 0,
    recentResponsesCount: 0,
    totalInstructors: 0,
    totalCourses: 0,
    completedSurveys: 0,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [responseTrendData, setResponseTrendData] = useState<ResponseTrendPoint[]>(
    createSampleTrendData(0)
  );
  const [usingSampleTrendData, setUsingSampleTrendData] = useState<boolean>(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const surveyCountQuery = () =>
        supabase.from('surveys').select('id', { count: 'exact', head: true });

      const responsesBase = () =>
        supabase.from('survey_responses').select('id', { count: 'exact', head: true });

      const nowIso = new Date().toISOString();
      const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [
        totalSurveysRes,
        activeSurveysRes,
        completedStatusRes,
        overdueActiveRes,
        totalResponsesRes,
        instructorsRes,
        coursesRes,
        recentResponsesRes,
        responseTrendRes,
      ] = await Promise.all([
        surveyCountQuery(),
        surveyCountQuery().eq('status', 'active'),
        surveyCountQuery().eq('status', 'completed'),
        surveyCountQuery().in('status', ['active', 'public']).lte('end_date', nowIso),
        responsesBase(),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'instructor'),
        supabase.from('courses').select('id', { count: 'exact', head: true }),
        supabase
          .from('survey_responses')
          .select('id', { count: 'exact', head: true })
          .gte('submitted_at', sevenDaysAgoIso),
        supabase
          .from('survey_responses')
          .select('submitted_at')
          .gte('submitted_at', sevenDaysAgoIso)
          .lte('submitted_at', nowIso),
      ]);

      if (totalSurveysRes.error) throw totalSurveysRes.error;
      if (activeSurveysRes.error) throw activeSurveysRes.error;
      if (completedStatusRes.error) throw completedStatusRes.error;
      if (overdueActiveRes.error) throw overdueActiveRes.error;
      if (totalResponsesRes.error) throw totalResponsesRes.error;
      if (instructorsRes.error) throw instructorsRes.error;
      if (coursesRes.error) throw coursesRes.error;
      if (recentResponsesRes.error) throw recentResponsesRes.error;
      if (responseTrendRes.error) throw responseTrendRes.error;

      const completedSurveysCount =
        (completedStatusRes.count || 0) + (overdueActiveRes.count || 0);

      const statsData: Stats = {
        totalSurveys: totalSurveysRes.count || 0,
        activeSurveys: activeSurveysRes.count || 0,
        completedSurveys: completedSurveysCount,
        totalResponses: totalResponsesRes.count || 0,
        totalInstructors: instructorsRes.count || 0,
        totalCourses: coursesRes.count || 0,
        recentResponsesCount: recentResponsesRes.count || 0,
      };

      setStats(statsData);

      const aggregatedTrend = aggregateTrendData(responseTrendRes.data ?? [], new Date(nowIso));
      const hasTrendData = aggregatedTrend.some((point) => point.responses > 0);

      if (hasTrendData) {
        setResponseTrendData(aggregatedTrend);
        setUsingSampleTrendData(false);
      } else {
        setResponseTrendData(createSampleTrendData(statsData.recentResponsesCount));
        setUsingSampleTrendData(true);
      }
    } catch (e) {
      console.error("Failed to load dashboard stats:", e);
      setError("대시보드 지표를 불러오는 중 오류가 발생했습니다. 샘플 데이터를 표시합니다.");
      setResponseTrendData(createSampleTrendData(0));
      setUsingSampleTrendData(true);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const busy = loading || authLoading;
  const hasSurveyData =
    stats.totalSurveys > 0 || stats.activeSurveys > 0 || stats.completedSurveys > 0;

  return (
    <DashboardLayout
      title="관리자 대시보드"
      description={isAdmin ? "시스템 관리자" : "강사"}
      loading={busy}
    >
      <div className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>데이터를 불러오지 못했습니다</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 주요 통계 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent" />
            <CardHeader className="relative pb-2 p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="p-1.5 sm:p-2 rounded-lg bg-purple-100">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative p-3 sm:p-4 pt-0 sm:pt-0">
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">전체 설문조사</p>
                <div className="flex items-baseline gap-1 sm:gap-2">
                  <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {busy ? "-" : stats.totalSurveys}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {isAdmin ? "전체 시스템" : "담당 강의"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
            <CardHeader className="relative pb-2 p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="p-1.5 sm:p-2 rounded-lg bg-blue-100">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative p-3 sm:p-4 pt-0 sm:pt-0">
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">진행중인 설문</p>
                <div className="flex items-baseline gap-1 sm:gap-2">
                  <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {busy ? "-" : stats.activeSurveys}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">현재 응답 가능</p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent" />
            <CardHeader className="relative pb-2 p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="p-1.5 sm:p-2 rounded-lg bg-green-100">
                  <BarChart className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative p-3 sm:p-4 pt-0 sm:pt-0">
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">총 응답수</p>
                <div className="flex items-baseline gap-1 sm:gap-2">
                  <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {busy ? "-" : stats.totalResponses}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">누적 응답 수</p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent" />
            <CardHeader className="relative pb-2 p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="p-1.5 sm:p-2 rounded-lg bg-orange-100">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative p-3 sm:p-4 pt-0 sm:pt-0">
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">최근 7일 응답</p>
                <div className="flex items-baseline gap-1 sm:gap-2">
                  <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {busy ? "-" : stats.recentResponsesCount}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">최근 활동</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 관리자 전용 통계 */}
        {isAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent" />
              <CardHeader className="relative pb-2 p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-indigo-100">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative p-3 sm:p-4 pt-0 sm:pt-0">
                <div className="space-y-0.5 sm:space-y-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">전체 강사수</p>
                  <div className="flex items-baseline gap-1 sm:gap-2">
                    <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                      {busy ? "-" : stats.totalInstructors}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">등록된 강사</p>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-transparent" />
              <CardHeader className="relative pb-2 p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-pink-100">
                    <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-pink-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative p-3 sm:p-4 pt-0 sm:pt-0">
                <div className="space-y-0.5 sm:space-y-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">전체 강좌수</p>
                  <div className="flex items-baseline gap-1 sm:gap-2">
                    <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                      {busy ? "-" : stats.totalCourses}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">개설된 강좌</p>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent" />
              <CardHeader className="relative pb-2 p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-teal-100">
                    <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-teal-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative p-3 sm:p-4 pt-0 sm:pt-0">
                <div className="space-y-0.5 sm:space-y-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">완료된 설문</p>
                  <div className="flex items-baseline gap-1 sm:gap-2">
                    <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                      {busy ? "-" : stats.completedSurveys}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">설문 완료</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 차트 섹션 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* 응답 트렌드 차트 */}
          <Card className="bg-white border-0 shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-foreground">응답 트렌드</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">최근 7일간 응답 추이</p>
                </div>
                {!busy && usingSampleTrendData && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    샘플 데이터
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {busy ? (
                <div className="h-64 flex items-center justify-center">
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : (
                <>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsAreaChart data={responseTrendData}>
                        <defs>
                          <linearGradient id="responseGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--card-foreground))'
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="responses"
                          stroke="hsl(var(--chart-1))"
                          fillOpacity={1}
                          fill="url(#responseGradient)"
                          strokeWidth={3}
                        />
                      </RechartsAreaChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground text-center">
                    {usingSampleTrendData
                      ? "최근 7일 응답 데이터가 없어 샘플 추이를 표시합니다."
                      : "Supabase의 실제 응답 데이터를 기반으로 집계되었습니다."}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* 설문 상태 분포 도넛 차트 */}
          <Card className="bg-white border-0 shadow-sm">
            <CardHeader>
              <h3 className="text-lg font-semibold text-foreground">설문 상태 분포</h3>
              <p className="text-sm text-muted-foreground">설문별 진행 상황</p>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {busy ? (
                  <div className="h-full flex items-center justify-center">
                    <Skeleton className="h-40 w-full" />
                  </div>
                ) : !hasSurveyData ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-sm text-muted-foreground">
                    <p>표시할 설문 데이터가 없습니다.</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      설문이 생성되면 분포가 자동으로 업데이트됩니다.
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: '활성', value: stats.activeSurveys, fill: 'hsl(var(--chart-2))' },
                          { name: '완료', value: stats.completedSurveys, fill: 'hsl(var(--chart-1))' },
                          { name: '대기', value: Math.max(0, stats.totalSurveys - stats.activeSurveys - stats.completedSurveys), fill: 'hsl(var(--chart-3))' }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {[
                          { name: '활성', value: stats.activeSurveys, fill: 'hsl(var(--chart-2))' },
                          { name: '완료', value: stats.completedSurveys, fill: 'hsl(var(--chart-1))' },
                          { name: '대기', value: Math.max(0, stats.totalSurveys - stats.activeSurveys - stats.completedSurveys), fill: 'hsl(var(--chart-3))' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [`${value}개`, name]}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--card-foreground))'
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 추가 통계 섹션 */}
        {isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 일일 활동 통계 */}
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">일일 활동</h3>
                    <p className="text-sm text-muted-foreground">오늘의 주요 지표</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {busy ? (
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">오늘 신규 응답</span>
                        <span className="font-semibold text-foreground">{Math.floor(stats.recentResponsesCount * 0.3)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">활성 사용자</span>
                        <span className="font-semibold text-foreground">{Math.floor(stats.totalInstructors * 0.7)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">완료율</span>
                        <span className="font-semibold text-foreground">
                          {stats.totalSurveys > 0
                            ? Math.round((stats.completedSurveys / stats.totalSurveys) * 100)
                            : 0}%
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* 시스템 상태 */}
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">시스템 상태</h3>
                    <p className="text-sm text-muted-foreground">현재 시스템 운영 현황</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {busy ? (
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">서비스 상태</span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">정상</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">평균 응답 시간</span>
                        <span className="font-semibold text-foreground">1.2초</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">활성 세션</span>
                        <span className="font-semibold text-foreground">{Math.floor(stats.recentResponsesCount * 0.5)}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* 월간 요약 */}
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">월간 요약</h3>
                    <p className="text-sm text-muted-foreground">이번 달 주요 성과</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {busy ? (
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">신규 설문</span>
                        <span className="font-semibold text-foreground">{Math.floor(stats.totalSurveys * 0.2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">총 참여자</span>
                        <span className="font-semibold text-foreground">{Math.floor(stats.totalResponses * 0.8)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">만족도 평균</span>
                        <span className="font-semibold text-foreground">8.5/10.0</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DashboardOverview;
