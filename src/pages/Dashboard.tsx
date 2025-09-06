// src/pages/Dashboard.tsx
import React, { useMemo } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';

// 배럴에서 임포트하면 새/레거시 이름 모두 커버 가능
import {
  DashboardOverview,
  DashboardSurveyResults,
  DashboardCourseReports,
  DashboardInstructorManagement,
  DashboardUserManagement,
  DashboardCourseManagement,
  DashboardCourseStatistics,
  DashboardTemplateManagement,
  DashboardEmailLogs,
  DashboardSystemLogs,
  // (선택) 레거시 경로 호환용
  SurveyResults as LegacySurveyResults,
  CourseReports as LegacyCourseReports,
} from '@/pages';

const pageMetadata: Record<string, { title: string; description: string }> = {
  '/dashboard': { title: '관리자 대시보드', description: '시스템 종합 현황' },
  '/dashboard/results': { title: '결과분석', description: '설문 결과 분석 및 통계' },
  '/dashboard/course-reports': { title: '결과보고', description: '과정별 종합 보고서' },
  '/dashboard/instructors': { title: '강사관리', description: '강사 정보 및 권한 관리' },
  '/dashboard/users': { title: '사용자관리', description: '시스템 사용자 관리' },
  '/dashboard/courses': { title: '과목관리', description: '교육과정 및 과목 관리' },
  '/dashboard/course-statistics': { title: '통계관리', description: '과정별 상세 통계' },
  '/dashboard/templates': { title: '템플릿관리', description: '설문 템플릿 관리' },
  '/dashboard/email-logs': { title: '이메일 로그', description: '이메일 발송 기록' },
  '/dashboard/system-logs': { title: '시스템 로그', description: '시스템 활동 기록' },
};

export default function Dashboard() {
  const location = useLocation();

  // 긴 prefix 우선 매칭으로 하위 경로까지 안전
  const currentPage = useMemo(() => {
    const pathname = location.pathname.replace(/\/+$/, '');
    const key =
      Object.keys(pageMetadata)
        .filter((k) => pathname === k || pathname.startsWith(k + '/'))
        .sort((a, b) => b.length - a.length)[0] ?? '/dashboard';
    return pageMetadata[key];
  }, [location.pathname]);

  return (
    <DashboardLayout title={currentPage.title} description={currentPage.description}>
      <Routes>
        {/* ✅ 중첩 라우팅에서는 index/상대경로 사용 */}
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

        {/* (옵션) 레거시 경로 호환 */}
        <Route path="survey-results" element={<LegacySurveyResults />} />
        <Route path="reports/courses" element={<LegacyCourseReports />} />

        {/* Fallback */}
        <Route path="*" element={<DashboardOverview />} />
      </Routes>
    </DashboardLayout>
  );
}
