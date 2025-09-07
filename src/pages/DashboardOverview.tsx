// src/pages/DashboardOverview.tsx

import React, { useEffect, useState, useCallback } from "react";
import AdminLayout from "@/components/layouts/AdminLayout";
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
import { supabase } from "@/integrations/supabase/client";

type Stats = {
  totalSurveys: number;
  activeSurveys: number;
  totalResponses: number;
  recentResponsesCount: number;
  totalInstructors: number;
  totalCourses: number;
  completedSurveys: number;
};

const DashboardOverview: React.FC = () => {
  const { user, userRoles, loading: authLoading } = useAuth();
  const isAdmin = !!userRoles?.includes("admin");

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

  /** 공통 필터 유틸: 관리자 아닐 때 본인 소유/담당 데이터만 */
  const applyScope = <T,>(
    qb: import("@supabase/supabase-js").PostgrestFilterBuilder<T, any, any>
  ) => {
    if (!isAdmin && user?.id) {
      // 🔧 아래 열 이름을 실제 스키마에 맞게 조정하세요.
      // 예: owner_id / instructor_id / created_by 중 존재하는 것 사용
      // or 조건은 Supabase의 .or("col.eq.value,col2.eq.value") 형식
      return qb.or(
        `owner_id.eq.${user.id},instructor_id.eq.${user.id},created_by.eq.${user.id}`
      );
    }
    return qb;
  };

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const todayISO = new Date().toISOString();
      const sevenDaysAgoISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // ---- Surveys: total
      const totalSurveysQ = applyScope(
        supabase.from("surveys").select("*", { count: "exact", head: true })
      );
      const { count: totalSurveys = 0, error: errTotal } = await totalSurveysQ;
      if (errTotal) console.warn("totalSurveys error:", errTotal);

      // ---- Surveys: active (status='active' 또는 기간내 진행중)
      let { count: activeByStatus = 0, error: errActiveStatus } = await applyScope(
        supabase
          .from("surveys")
          .select("*", { count: "exact", head: true })
          .eq("status", "active")
      );
      if (errActiveStatus) console.warn("activeByStatus error:", errActiveStatus);

      // 기간 기반 보조 카운트 (start_date <= today <= end_date)
      let { count: activeByDate = 0, error: errActiveDate } = await applyScope(
        supabase
          .from("surveys")
          .select("*", { count: "exact", head: true })
          .lte("start_date", todayISO)
          .gte("end_date", todayISO)
      );
      if (errActiveDate) console.warn("activeByDate error:", errActiveDate);

      const activeSurveys = Math.max(activeByStatus ?? 0, activeByDate ?? 0);

      // ---- Responses: total
      const totalResponsesQ = applyScope(
        supabase.from("survey_responses").select("*", { count: "exact", head: true })
      );
      const { count: totalResponses = 0, error: errResp } = await totalResponsesQ;
      if (errResp) console.warn("totalResponses error:", errResp);

      // ---- Responses: last 7 days
      const recentResponsesQ = applyScope(
        supabase
          .from("survey_responses")
          .select("*", { count: "exact", head: true })
          .gte("created_at", sevenDaysAgoISO)
      );
      const { count: recentResponsesCount = 0, error: errRecent } = await recentResponsesQ;
      if (errRecent) console.warn("recentResponses error:", errRecent);

      // ---- Instructors
      const instructorsQ = supabase
        .from("instructors")
        .select("*", { count: "exact", head: true });
      const { count: totalInstructors = 0, error: errInst } = await instructorsQ;
      if (errInst) console.warn("totalInstructors error:", errInst);

      // ---- Courses
      const coursesQ = supabase
        .from("courses")
        .select("*", { count: "exact", head: true });
      const { count: totalCourses = 0, error: errCourses } = await coursesQ;
      if (errCourses) console.warn("totalCourses error:", errCourses);

      // ---- Surveys: completed
      const completedQ = applyScope(
        supabase
          .from("surveys")
          .select("*", { count: "exact", head: true })
          .eq("status", "completed")
      );
      const { count: completedSurveys = 0, error: errCompleted } = await completedQ;
      if (errCompleted) console.warn("completedSurveys error:", errCompleted);

      setStats({
        totalSurveys: totalSurveys ?? 0,
        activeSurveys: activeSurveys ?? 0,
        totalResponses: totalResponses ?? 0,
        recentResponsesCount: recentResponsesCount ?? 0,
        totalInstructors: totalInstructors ?? 0,
        totalCourses: totalCourses ?? 0,
        completedSurveys: completedSurveys ?? 0,
      });
    } catch (e) {
      console.error("fetchStats fatal:", e);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const busy = loading || authLoading;

  return (
    <AdminLayout
      title="관리자 대시보드"
      description={isAdmin ? "시스템 관리자" : "강사"}
      loading={busy}
      onRefresh={fetchStats} // ✅ 상단 새로고침은 이 한 개만 노출
      // desktopActions / mobileActions 넘기지 않음 → 중복 버튼 제거
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

          <Card className="relative overflow-hidden bg-white border-0 hover:shadow-lg shadow-sm transition-all duration-300">
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

          <Card className="relative overflow-hidden bg-white border-0 hover:shadow-lg shadow-sm transition-all duration-300">
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

          <Card className="relative overflow-hidden bg-white border-0 hover:shadow-lg shadow-sm transition-all duration-300">
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
            <Card className="relative overflow-hidden bg-white border-0 hover:shadow-lg shadow-sm transition-all duration-300">
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

            <Card className="relative overflow-hidden bg-white border-0 hover:shadow-lg shadow-sm transition-all duration-300">
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

            <Card className="relative overflow-hidden bg-white border-0 hover:shadow-lg shadow-sm transition-all duration-300">
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
      </div>
    </AdminLayout>
  );
};

export default DashboardOverview;
