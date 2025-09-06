import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';

// Dashboard 페이지들 import
import DashboardOverview from '@/pages/DashboardOverview';
import DashboardSurveyResults from '@/pages/DashboardSurveyResults';
import DashboardCourseReports from '@/pages/DashboardCourseReports';
import DashboardInstructorManagement from '@/pages/DashboardInstructorManagement';
import DashboardUserManagement from '@/pages/DashboardUserManagement';
import DashboardCourseManagement from '@/pages/DashboardCourseManagement';
import DashboardCourseStatistics from '@/pages/DashboardCourseStatistics';
import DashboardTemplateManagement from '@/pages/DashboardTemplateManagement';
import DashboardEmailLogs from '@/pages/DashboardEmailLogs';
import DashboardSystemLogs from '@/pages/DashboardSystemLogs';

function Dashboard() {
  return (
    <Routes>
      <Route path="/" element={
        <DashboardLayout title="관리자 대시보드" description="시스템 관리자 전용">
          <DashboardOverview />
        </DashboardLayout>
      } />
      
      <Route path="/results" element={
        <DashboardLayout title="결과분석" description="설문 결과 분석 및 통계">
          <DashboardSurveyResults />
        </DashboardLayout>
      } />
      
      <Route path="/course-reports" element={
        <DashboardLayout title="결과보고" description="과정별 종합 보고서">
          <DashboardCourseReports />
        </DashboardLayout>
      } />
      
      <Route path="/instructors" element={
        <DashboardLayout title="강사관리" description="강사 정보 및 권한 관리">
          <DashboardInstructorManagement />
        </DashboardLayout>
      } />
      
      <Route path="/users" element={
        <DashboardLayout title="사용자관리" description="시스템 사용자 관리">
          <DashboardUserManagement />
        </DashboardLayout>
      } />
      
      <Route path="/courses" element={
        <DashboardLayout title="과목관리" description="교육과정 및 과목 관리">
          <DashboardCourseManagement />
        </DashboardLayout>
      } />
      
      <Route path="/course-statistics" element={
        <DashboardLayout title="통계관리" description="과정별 상세 통계">
          <DashboardCourseStatistics />
        </DashboardLayout>
      } />
      
      <Route path="/templates" element={
        <DashboardLayout title="템플릿관리" description="설문 템플릿 관리">
          <DashboardTemplateManagement />
        </DashboardLayout>
      } />
      
      <Route path="/email-logs" element={
        <DashboardLayout title="이메일 로그" description="이메일 발송 기록">
          <DashboardEmailLogs />
        </DashboardLayout>
      } />
      
      <Route path="/system-logs" element={
        <DashboardLayout title="시스템 로그" description="시스템 활동 기록">
          <DashboardSystemLogs />
        </DashboardLayout>
      } />
    </Routes>
  );
}

export default Dashboard;