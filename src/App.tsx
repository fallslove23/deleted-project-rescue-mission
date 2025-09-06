import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import LoadingScreen from '@/components/LoadingScreen';

// 페이지 컴포넌트 imports
import Auth from '@/pages/Auth';
import Dashboard from '@/pages/Dashboard';
import PersonalDashboard from '@/pages/PersonalDashboard';
import InstructorManagement from '@/pages/InstructorManagement';
import CourseManagement from '@/pages/CourseManagement';
import SurveyManagement from '@/pages/SurveyManagement';
import SurveyManagementV2 from '@/pages/SurveyManagementV2';
import SurveyResults from '@/pages/SurveyResults';
import UserManagement from '@/pages/UserManagement';
import TemplateManagement from '@/pages/TemplateManagement';
import SurveyBuilder from '@/pages/SurveyBuilder';
import TemplateBuilder from '@/pages/TemplateBuilder';
import SurveyParticipate from '@/pages/SurveyParticipate';
import SurveyParticipateSession from '@/pages/SurveyParticipateSession';
import SurveyPreview from '@/pages/SurveyPreview';
import SurveyAnalysis from '@/pages/SurveyAnalysis';
import SurveyDetailedAnalysis from '@/pages/SurveyDetailedAnalysis';
import CourseReports from '@/pages/CourseReports';
import CumulativeDataTable from '@/pages/CumulativeDataTable';
import EmailLogs from '@/pages/EmailLogs';
import SystemLogs from '@/pages/SystemLogs';
import ChangePassword from '@/pages/ChangePassword';
import NotFound from '@/pages/NotFound';
import Index from '@/pages/Index';

// 컴포넌트 imports
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleBasedRoute from '@/components/RoleBasedRoute';
import DefaultRedirect from '@/components/DefaultRedirect';

import './App.css';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* 공개 라우트 */}
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/survey-participate/:sessionId" element={<SurveyParticipate />} />
      <Route path="/survey-participate-session/:sessionId" element={<SurveyParticipateSession />} />
      <Route path="/survey-preview/:surveyId" element={<SurveyPreview />} />
      <Route path="/change-password" element={<ChangePassword />} />

      {/* 보호된 라우트 */}
      <Route
        path="/dashboard/*"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/personal-dashboard"
        element={
          <ProtectedRoute>
            <PersonalDashboard />
          </ProtectedRoute>
        }
      />

      {/* 관리자 전용 라우트 */}
      <Route
        path="/instructor-management"
        element={
          <RoleBasedRoute allowedRoles={['admin', 'super_admin']}>
            <InstructorManagement />
          </RoleBasedRoute>
        }
      />

      <Route
        path="/user-management"
        element={
          <RoleBasedRoute allowedRoles={['admin', 'super_admin']}>
            <UserManagement />
          </RoleBasedRoute>
        }
      />

      <Route
        path="/course-management"
        element={
          <RoleBasedRoute allowedRoles={['admin', 'super_admin', 'instructor']}>
            <CourseManagement />
          </RoleBasedRoute>
        }
      />

      <Route
        path="/surveys"
        element={
          <RoleBasedRoute allowedRoles={['admin', 'super_admin', 'instructor']}>
            <SurveyManagement />
          </RoleBasedRoute>
        }
      />

      <Route
        path="/surveys-v2"
        element={
          <RoleBasedRoute allowedRoles={['admin', 'super_admin', 'instructor']}>
            <SurveyManagementV2 />
          </RoleBasedRoute>
        }
      />

      <Route
        path="/survey-results"
        element={
          <RoleBasedRoute allowedRoles={['admin', 'super_admin', 'instructor']}>
            <SurveyResults />
          </RoleBasedRoute>
        }
      />

      <Route
        path="/templates"
        element={
          <RoleBasedRoute allowedRoles={['admin', 'super_admin']}>
            <TemplateManagement />
          </RoleBasedRoute>
        }
      />

      <Route
        path="/survey-builder/:surveyId?"
        element={
          <RoleBasedRoute allowedRoles={['admin', 'super_admin', 'instructor']}>
            <SurveyBuilder />
          </RoleBasedRoute>
        }
      />

      <Route
        path="/template-builder/:templateId?"
        element={
          <RoleBasedRoute allowedRoles={['admin', 'super_admin']}>
            <TemplateBuilder />
          </RoleBasedRoute>
        }
      />

      <Route
        path="/survey-analysis/:surveyId"
        element={
          <RoleBasedRoute allowedRoles={['admin', 'super_admin', 'instructor']}>
            <SurveyAnalysis />
          </RoleBasedRoute>
        }
      />

      <Route
        path="/survey-detailed-analysis/:surveyId"
        element={
          <RoleBasedRoute allowedRoles={['admin', 'super_admin', 'instructor']}>
            <SurveyDetailedAnalysis />
          </RoleBasedRoute>
        }
      />

      <Route
        path="/course-reports"
        element={
          <RoleBasedRoute allowedRoles={['admin', 'super_admin', 'instructor']}>
            <CourseReports />
          </RoleBasedRoute>
        }
      />

      <Route
        path="/cumulative-data"
        element={
          <RoleBasedRoute allowedRoles={['admin', 'super_admin']}>
            <CumulativeDataTable />
          </RoleBasedRoute>
        }
      />

      <Route
        path="/email-logs"
        element={
          <RoleBasedRoute allowedRoles={['admin', 'super_admin']}>
            <EmailLogs />
          </RoleBasedRoute>
        }
      />

      <Route
        path="/system-logs"
        element={
          <RoleBasedRoute allowedRoles={['admin', 'super_admin']}>
            <SystemLogs />
          </RoleBasedRoute>
        }
      />

      {/* 기본 리디렉션 */}
      <Route
        path="/default-redirect"
        element={
          <ProtectedRoute>
            <DefaultRedirect />
          </ProtectedRoute>
        }
      />

      {/* 404 페이지 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;