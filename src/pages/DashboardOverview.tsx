// src/pages/DashboardOverview.tsx

import React, { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/components/layouts/AdminLayout"; // ✅ default export
import { useAuth } from "@/hooks/useAuth";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import {
  FileText,
  TrendingUp,
  BarChart,
  Clock,
  Users,
  BookOpen,
  Activity,
} from "lucide-react";
// import { supabase } from "@/integrations/supabase/client"; // ← 실제 연동 시 사용

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

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      // TODO: 실제 데이터 연동 (Supabase 예시)
      // const { data: ... } = await supabase.rpc('get_dashboard_stats', { scope: isAdmin ? 'all' : 'mine' });
      // setStats(mappedData);

      // 데모용 지연 + 더미 데이터
      await new Promise((r) => setTimeout(r, 300));
      setStats({
        totalSurveys: 42,
        activeSurveys: 5,
        totalResponses: 1280,
        recentResponsesCount: 73,
        totalInstructors: 18,
        totalCourses: 27,
        completedSurveys: 31,
      });
    } catch (e) {
      console.error("Failed to load dashboard stats:", e);
    } finally {
      setLoading(false);
    }
  }, []); // isAdmin 의존이 필요하면 여기에 추가

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const busy = loading || authLoading;

  return (
    <AdminLayout
      title="관리자 대시보드"
      description={isAdmin ? "시스템 관리자" : "강사"}
      loading={busy}
    >
      <div className="space-y-6">
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
                <p className="text-sm font-medium text-gray-600">최근 7일 응답</p>
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

        {/* 차트 섹션 등 추가 요소는 기존 유지 */}
      </div>
    </AdminLayout>
  );
};

export default DashboardOverview;
