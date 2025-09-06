// src/pages/Dashboard.tsx
import React, { useMemo } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";

// Dashboard 페이지들 import
import DashboardOverview from "@/pages/DashboardOverview";
import DashboardSurveyResults from "@/pages/DashboardSurveyResults";
import DashboardCourseReports from "@/pages/DashboardCourseReports";
import DashboardInstructorManagement from "@/pages/DashboardInstructorManagement";
import DashboardUserManagement from "@/pages/DashboardUserManagement";
import DashboardCourseManagement from "@/pages/DashboardCourseManagement";
import DashboardCourseStatistics from "@/pages/DashboardCourseStatistics";
import DashboardTemplateManagement from "@/pages/DashboardTemplateManagement";
import DashboardEmailLogs from "@/pages/DashboardEmailLogs";
import DashboardSystemLogs from "@/pages/DashboardSystemLogs";

// 페이지별 메타데이터 (키는 절대경로 prefix)
// 세부 경로가 붙어도 startsWith로 매칭되도록 설계
const pageMetadata: Record<
  string,
  { title: string; description: string }
> = {
  "/dashboard": { title: "관리자 대시보드", description: "시스템 종합 현황" },
  "/dashboard/results": { title: "결과분석", description: "설문 결과 분석 및 통계" },
  "/dashboard/course-reports": { title: "결과보고", description: "과정별 종합 보고서" },
  "/dashboard/instructors": { title: "강사관리", description: "강사 정보 및 권한 관리" },
  "/dashboard/users": { title: "사용자관리", description: "시스템 사용자 관리" },
  "/dashboard/courses": { title: "과목관리", description: "교육과정 및 과목 관리" },
  "/dashboard/course-statistics": { title: "통계관리", description: "과정별 상세 통계" },
  "/dashboard/templates": { title: "템플릿관리", description: "설문 템플릿 관리" },
  "/dashboard/email-logs": { title: "이메일 로그", description: "이메일 발송 기록" },
  "/dashboard/system-logs": { title: "시스템 로그", description: "시스템 활동 기록" },
};

function Dashboard() {
  const location = useLocation();

  // 현재 경로와 가장 길게 일치하는 메타를 선택 (세부 경로 대응)
  const currentPage = useMemo(() => {
    const pathname = location.pathname.replace(/\/+$/, ""); // 트레일링 슬래시 제거
    const candidates = Object.keys(pageMetadata)
      .filter((key) => pathname === key || pathname.startsWith(key + "/"))
      .sort((a, b) => b.length - a.length); // 가장 긴 prefix 우선
    const matchedKey = candidates[0] ?? "/dashboard";
    return pageMetadata[matchedKey];
  }, [location.pathname]);

  return (
    <DashboardLayout title={currentPage.title} description={currentPage.description}>
      <Routes>
        {/* 중첩 라우팅에서는 index 사용 */}
        <Route index element={<DashboardOverview />} />
        <Route path="results" element={<DashboardSurveyResults />} />
        <Route path="course-reports" element={<DashboardCourseReports />} />
        <Route path="instructors" element={<DashboardInstructorManagement />} />
        <Route path="users" element={<DashboardUserManagement />} />
        <Route path="courses" element={<DashboardCourseManagement />} />
        <Route path="course-statistics" element={<DashboardCourseStatistics />} />
        <Route path="templates" element={<DashboardTemplateManagement />} />
        <Route path="email-logs" element={<DashboardEmailLogs />} />
        <Route path="system-logs" element={<DashboardSystemLogs />} />
        {/* 알 수 없는 하위 경로는 개요로 */}
        <Route path="*" element={<DashboardOverview />} />
      </Routes>
    </DashboardLayout>
  );
}

export default Dashboard;
