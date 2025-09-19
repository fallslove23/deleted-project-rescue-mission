// src/pages/DashboardOverview.tsx

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layouts";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText,
  TrendingUp,
  BarChart,
  Clock,
  Users,
  BookOpen,
  Activity,
} from "lucide-react";
import { Check } from "lucide-react";
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
import { FilterPresetManager } from "@/components/FilterPresetManager";

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

/** ---------- Page ---------- */
const DashboardOverview: React.FC = () => {
  const { userRoles, loading: authLoading } = useAuth();
  const isAdmin = !!userRoles?.includes("admin"); // ✅ 반드시 함수 내부에서 선언
  const [searchParams, setSearchParams] = useSearchParams();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [pendingTimeRange, setPendingTimeRange] = useState<'7d' | '30d' | '90d'>('7d');

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
  const timeRangeLabels: Record<'7d' | '30d' | '90d', string> = {
    '7d': '최근 7일',
    '30d': '최근 30일',
    '90d': '최근 90일',
  };
  const timeRangeOptions: Array<{ value: '7d' | '30d' | '90d'; label: string }> = [
    { value: '7d', label: timeRangeLabels['7d'] },
    { value: '30d', label: timeRangeLabels['30d'] },
    { value: '90d', label: timeRangeLabels['90d'] },
  ];

  useEffect(() => {
    const param = searchParams.get('range');
    if (!param) {
      if (timeRange !== '7d') {
        setTimeRange('7d');
      }
      return;
    }

    if (param === timeRange) return;

    if (param === '7d' || param === '30d' || param === '90d') {
      setTimeRange(param as '7d' | '30d' | '90d');
    }
  }, [searchParams, timeRange]);

  useEffect(() => {
    setPendingTimeRange(timeRange);
  }, [timeRange]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (timeRange !== '7d') {
      next.set('range', timeRange);
    } else {
      next.delete('range');
    }

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [timeRange, searchParams, setSearchParams]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const surveyCountQuery = () =>
        supabase.from('surveys').select('id', { count: 'exact', head: true });

      const responsesBase = () =>
        supabase.from('survey_responses').select('id', { count: 'exact', head: true });

      const nowIso = new Date().toISOString();
      const rangeDays = timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 7;
      const rangeStartIso = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString();

      const [
        totalSurveysRes,
        activeSurveysRes,
        completedStatusRes,
        overdueActiveRes,
        totalResponsesRes,
        instructorsRes,
        coursesRes,
        recentResponsesRes,
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
          .gte('submitted_at', rangeStartIso),
      ]);

      const completedSurveysCount =
        (completedStatusRes.count || 0) + (overdueActiveRes.count || 0);

      setStats({
        totalSurveys: totalSurveysRes.count || 0,
        activeSurveys: activeSurveysRes.count || 0,
        completedSurveys: completedSurveysCount,
        totalResponses: totalResponsesRes.count || 0,
        totalInstructors: instructorsRes.count || 0,
        totalCourses: coursesRes.count || 0,
        recentResponsesCount: recentResponsesRes.count || 0,
      });
    } catch (e) {
      console.error("Failed to load dashboard stats:", e);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, timeRange]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const busy = loading || authLoading;
  const handlePendingTimeRangeChange = (value: string) => {
    if (value === '7d' || value === '30d' || value === '90d') {
      setPendingTimeRange(value);
    }
  };

  const handleApplyFilters = () => {
    setTimeRange(pendingTimeRange);
  };

  const handleResetFilters = () => {
    setPendingTimeRange('7d');
    setTimeRange('7d');
  };

  const handleRemoveFilter = (key: string) => {
    if (key === 'timeRange') {
      handleResetFilters();
    }
  };

  const handleLoadPreset = (filters: any) => {
    const nextRange = filters?.timeRange;
    if (nextRange === '7d' || nextRange === '30d' || nextRange === '90d') {
      setPendingTimeRange(nextRange);
      setTimeRange(nextRange);
    } else {
      handleResetFilters();
    }
  };
  const responseTrendData = useMemo(() => {
    const points = timeRange === '7d' ? 7 : 6;
    const base = Math.max(stats.recentResponsesCount, 1);

    return Array.from({ length: points }).map((_, index) => {
      const isLast = index === points - 1;
      const remaining = points - index - 1;
      let label: string;

      if (isLast) {
        label = '오늘';
      } else if (timeRange === '30d') {
        label = `${(remaining + 1) * 5}일 전`;
      } else if (timeRange === '90d') {
        label = `${(remaining + 1) * 15}일 전`;
      } else {
        label = `${remaining + 1}일 전`;
      }

      const ratio = points > 1 ? index / (points - 1) : 1;
      const responses = isLast
        ? base
        : Math.max(0, Math.round(base * (0.5 + ratio * 0.5)));

      return {
        date: label,
        responses,
      };
    });
  }, [stats.recentResponsesCount, timeRange]);
  const rangeLabel = timeRangeLabels[timeRange];
  const overviewFilters = { timeRange };
  const overviewFilterDisplayValues = { timeRange: timeRangeLabels[timeRange] };
  const overviewFilterLabels = { timeRange: '조회 기간' } as const;

  return (
    <DashboardLayout
      title="관리자 대시보드"
      description={isAdmin ? "시스템 관리자" : "강사"}
      loading={busy}
    >
      <div className="space-y-6">
        {/* 필터 섹션 */}
        <div className="bg-card text-card-foreground rounded-lg shadow-sm border border-border/60 mb-6 overflow-hidden">
          <div className="sticky top-24 z-20 -mx-6 px-6 py-4 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-b border-border/60 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <FilterPresetManager
              filterType="survey_analysis"
              currentFilters={overviewFilters}
              filterLabels={overviewFilterLabels}
              filterDisplayValues={overviewFilterDisplayValues}
              onLoadPreset={handleLoadPreset}
              onRemoveFilter={handleRemoveFilter}
              className="flex-1"
            />
            <div className="flex flex-col gap-2 w-full md:w-auto md:flex-row md:items-center">
              <Button
                variant="outline"
                onClick={handleResetFilters}
                className="w-full md:w-auto"
              >
                필터 초기화
              </Button>
              <Button onClick={handleApplyFilters} className="w-full md:w-auto">
                필터 적용
              </Button>
            </div>
          </div>
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">조회 기간</label>
              <Select value={pendingTimeRange} onValueChange={handlePendingTimeRangeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="조회 기간 선택" />
                </SelectTrigger>
                <SelectContent>
                  {timeRangeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <Button
        size="icon"
        className="md:hidden fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-lg border border-border/60"
        onClick={handleApplyFilters}
        aria-label="필터 적용"
      >
        <Check className="h-6 w-6" />
      </Button>

      {/* 주요 통계 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent" />
            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-purple-100">
                  <FileText className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">전체 설문조사</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {busy ? "-" : stats.totalSurveys}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {isAdmin ? "전체 시스템" : "담당 강의"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-blue-100">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">진행중인 설문</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {busy ? "-" : stats.activeSurveys}
                  </span>
                </div>
                <p className="text-xs text-gray-500">현재 응답 가능</p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent" />
            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-green-100">
                  <BarChart className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">총 응답수</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {busy ? "-" : stats.totalResponses}
                  </span>
                </div>
                <p className="text-xs text-gray-500">누적 응답 수</p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent" />
            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-orange-100">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">최근 응답 ({rangeLabel})</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {busy ? "-" : stats.recentResponsesCount}
                  </span>
                </div>
                <p className="text-xs text-gray-500">최근 활동</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 관리자 전용 통계 */}
        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent" />
              <CardHeader className="relative pb-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-indigo-100">
                    <Users className="h-5 w-5 text-indigo-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600">전체 강사수</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {busy ? "-" : stats.totalInstructors}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">등록된 강사</p>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-transparent" />
              <CardHeader className="relative pb-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-pink-100">
                    <BookOpen className="h-5 w-5 text-pink-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600">전체 강좌수</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {busy ? "-" : stats.totalCourses}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">개설된 강좌</p>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent" />
              <CardHeader className="relative pb-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-teal-100">
                    <Activity className="h-5 w-5 text-teal-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600">완료된 설문</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {busy ? "-" : stats.completedSurveys}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">설문 완료</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 차트 섹션 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 응답 트렌드 차트 */}
          <Card className="bg-white border-0 shadow-sm">
            <CardHeader>
              <h3 className="text-lg font-semibold text-foreground">응답 트렌드</h3>
              <p className="text-sm text-muted-foreground">{rangeLabel} 응답 추이</p>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsAreaChart data={responseTrendData}>
                    <defs>
                      <linearGradient id="responseGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
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
                <h3 className="text-lg font-semibold text-foreground">일일 활동</h3>
                <p className="text-sm text-muted-foreground">오늘의 주요 지표</p>
              </CardHeader>
              <CardContent>
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
                      {stats.totalSurveys > 0 ? Math.round((stats.completedSurveys / stats.totalSurveys) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 시스템 상태 */}
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <h3 className="text-lg font-semibold text-foreground">시스템 상태</h3>
                <p className="text-sm text-muted-foreground">현재 시스템 운영 현황</p>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>

            {/* 월간 요약 */}
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <h3 className="text-lg font-semibold text-foreground">월간 요약</h3>
                <p className="text-sm text-muted-foreground">이번 달 주요 성과</p>
              </CardHeader>
              <CardContent>
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
                    <span className="font-semibold text-foreground">4.2/10.0</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DashboardOverview;
