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
    <DashboardLayout title="관리자 대시보드" description="시스템 종합 관리">
      <Routes>
        <Route path="/" element={<DashboardOverview />} />
        <Route path="/results" element={<DashboardSurveyResults />} />
        <Route path="/course-reports" element={<DashboardCourseReports />} />
        <Route path="/instructors" element={<DashboardInstructorManagement />} />
        <Route path="/users" element={<DashboardUserManagement />} />
        <Route path="/courses" element={<DashboardCourseManagement />} />
        <Route path="/course-statistics" element={<DashboardCourseStatistics />} />
        <Route path="/templates" element={<DashboardTemplateManagement />} />
        <Route path="/email-logs" element={<DashboardEmailLogs />} />
        <Route path="/system-logs" element={<DashboardSystemLogs />} />
      </Routes>
    </DashboardLayout>
  );
}

export default Dashboard;