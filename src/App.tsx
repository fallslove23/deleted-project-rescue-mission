// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "@/components/ui/toaster";
import { SidebarProvider } from "@/components/ui/sidebar";

// Auth & Layout Components
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleBasedRoute from '@/components/RoleBasedRoute';
import DefaultRedirect from '@/components/DefaultRedirect';
import LoadingScreen from '@/components/LoadingScreen';

// Pages
import Auth from '@/pages/Auth';
import NotFound from '@/pages/NotFound';
import Index from '@/pages/Index';
import ChangePassword from '@/pages/ChangePassword';

// Dashboard Pages
import Dashboard from '@/pages/Dashboard';
import DashboardOverview from '@/pages/DashboardOverview';
import DashboardSurveyManagement from '@/pages/DashboardSurveyManagement';
import DashboardSurveyResults from '@/pages/DashboardSurveyResults';
import DashboardCourseManagement from '@/pages/DashboardCourseManagement';
import DashboardCourseReports from '@/pages/DashboardCourseReports';
import DashboardCourseStatistics from '@/pages/DashboardCourseStatistics';
import DashboardInstructorManagement from '@/pages/DashboardInstructorManagement';
import DashboardUserManagement from '@/pages/DashboardUserManagement';
import DashboardTemplateManagement from '@/pages/DashboardTemplateManagement';
import DashboardEmailLogs from '@/pages/DashboardEmailLogs';
import DashboardSystemLogs from '@/pages/DashboardSystemLogs';
import DashboardCumulativeData from '@/pages/DashboardCumulativeData';
import DashboardMyStats from '@/pages/DashboardMyStats';

// Survey Pages
import SurveyBuilder from '@/pages/SurveyBuilder';
import SurveyPreview from '@/pages/SurveyPreview';
import SurveyManagement from '@/pages/SurveyManagement';
import SurveyManagementV2 from '@/pages/SurveyManagementV2';
import SurveyResults from '@/pages/SurveyResults';
import SurveyAnalysis from '@/pages/SurveyAnalysis';
import SurveyDetailedAnalysis from '@/pages/SurveyDetailedAnalysis';
import SurveyParticipate from '@/pages/SurveyParticipate';
import SurveyParticipateSession from '@/pages/SurveyParticipateSession';

// Template & Course Pages
import TemplateBuilder from '@/pages/TemplateBuilder';
import TemplateManagement from '@/pages/TemplateManagement';
import CourseManagement from '@/pages/CourseManagement';
import CourseReports from '@/pages/CourseReports';

// User & System Pages
import InstructorManagement from '@/pages/InstructorManagement';
import UserManagement from '@/pages/UserManagement';
import EmailLogs from '@/pages/EmailLogs';
import SystemLogs from '@/pages/SystemLogs';
import CumulativeDataTable from '@/pages/CumulativeDataTable';
import PersonalDashboard from '@/pages/PersonalDashboard';

// Role View Test Page
import RoleView from '@/pages/RoleView';

// Hooks
import { useAuth } from '@/hooks/useAuth';

import './App.css';

const queryClient = new QueryClient();

// SidebarProvider가 필요 없는 경로들
const NO_SIDEBAR_PATHS = ['/auth', '/survey/', '/change-password'];

function AppContent() {
  const location = useLocation();
  const { isLoading } = useAuth();

  // 현재 경로가 사이드바가 필요 없는 경로인지 확인
  const needsSidebar = !NO_SIDEBAR_PATHS.some(path => 
    location.pathname.startsWith(path)
  );

  if (isLoading) {
    return <LoadingScreen />;
  }

  const routesContent = (
    <Routes>
      {/* Public Routes */}
      <Route path="/auth" element={<Auth />} />
      <Route path="/change-password" element={<ChangePassword />} />
      
      {/* Survey Participation Routes (No Auth Required) */}
      <Route path="/survey/:surveyId" element={<SurveyParticipate />} />
      <Route path="/survey/:surveyId/session/:sessionId" element={<SurveyParticipateSession />} />
      
      {/* Protected Routes */}
      <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
      
      {/* Dashboard Routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>
        <Route index element={<DefaultRedirect />} />
        <Route path="overview" element={<DashboardOverview />} />
        
        {/* Survey Management */}
        <Route path="surveys" element={<DashboardSurveyManagement />} />
        <Route path="results" element={<DashboardSurveyResults />} />
        
        {/* Course Management */}
        <Route path="courses" element={<DashboardCourseManagement />} />
        <Route path="course-reports" element={<DashboardCourseReports />} />
        <Route path="course-statistics" element={<DashboardCourseStatistics />} />
        
        {/* User Management */}
        <Route path="instructors" element={
          <RoleBasedRoute allowedRoles={['admin']}>
            <DashboardInstructorManagement />
          </RoleBasedRoute>
        } />
        <Route path="users" element={
          <RoleBasedRoute allowedRoles={['admin']}>
            <DashboardUserManagement />
          </RoleBasedRoute>
        } />
        
        {/* Template Management */}
        <Route path="templates" element={<DashboardTemplateManagement />} />
        
        {/* System Management */}
        <Route path="email-logs" element={
          <RoleBasedRoute allowedRoles={['admin']}>
            <DashboardEmailLogs />
          </RoleBasedRoute>
        } />
        <Route path="system-logs" element={
          <RoleBasedRoute allowedRoles={['admin']}>
            <DashboardSystemLogs />
          </RoleBasedRoute>
        } />
        
        {/* Data Management */}
        <Route path="cumulative-data" element={<DashboardCumulativeData />} />
        
        {/* Personal Stats (Instructor View) */}
        <Route path="my-stats" element={
          <RoleBasedRoute allowedRoles={['instructor']}>
            <DashboardMyStats />
          </RoleBasedRoute>
        } />
      </Route>
      
      {/* Individual Page Routes */}
      <Route path="/survey-builder" element={<ProtectedRoute><SurveyBuilder /></ProtectedRoute>} />
      <Route path="/survey-builder/:surveyId" element={<ProtectedRoute><SurveyBuilder /></ProtectedRoute>} />
      <Route path="/survey-preview/:surveyId" element={<ProtectedRoute><SurveyPreview /></ProtectedRoute>} />
      <Route path="/survey-management" element={<ProtectedRoute><SurveyManagement /></ProtectedRoute>} />
      <Route path="/survey-management-v2" element={<ProtectedRoute><SurveyManagementV2 /></ProtectedRoute>} />
      <Route path="/survey-results" element={<ProtectedRoute><SurveyResults /></ProtectedRoute>} />
      <Route path="/survey-analysis/:surveyId" element={<ProtectedRoute><SurveyAnalysis /></ProtectedRoute>} />
      <Route path="/survey-detailed-analysis/:surveyId" element={<ProtectedRoute><SurveyDetailedAnalysis /></ProtectedRoute>} />
      
      {/* Template Routes */}
      <Route path="/template-builder" element={<ProtectedRoute><TemplateBuilder /></ProtectedRoute>} />
      <Route path="/template-builder/:templateId" element={<ProtectedRoute><TemplateBuilder /></ProtectedRoute>} />
      <Route path="/template-management" element={<ProtectedRoute><TemplateManagement /></ProtectedRoute>} />
      
      {/* Course Routes */}
      <Route path="/course-management" element={<ProtectedRoute><CourseManagement /></ProtectedRoute>} />
      <Route path="/course-reports" element={<ProtectedRoute><CourseReports /></ProtectedRoute>} />
      
      {/* User Management Routes */}
      <Route path="/instructor-management" element={
        <ProtectedRoute>
          <RoleBasedRoute allowedRoles={['admin']}>
            <InstructorManagement />
          </RoleBasedRoute>
        </ProtectedRoute>
      } />
      <Route path="/user-management" element={
        <ProtectedRoute>
          <RoleBasedRoute allowedRoles={['admin']}>
            <UserManagement />
          </RoleBasedRoute>
        </ProtectedRoute>
      } />
      
      {/* System Routes */}
      <Route path="/email-logs" element={
        <ProtectedRoute>
          <RoleBasedRoute allowedRoles={['admin']}>
            <EmailLogs />
          </RoleBasedRoute>
        </ProtectedRoute>
      } />
      <Route path="/system-logs" element={
        <ProtectedRoute>
          <RoleBasedRoute allowedRoles={['admin']}>
            <SystemLogs />
          </RoleBasedRoute>
        </ProtectedRoute>
      } />
      
      {/* Data Routes */}
      <Route path="/cumulative-data" element={<ProtectedRoute><CumulativeDataTable /></ProtectedRoute>} />
      <Route path="/personal-dashboard" element={
        <ProtectedRoute>
          <RoleBasedRoute allowedRoles={['instructor']}>
            <PersonalDashboard />
          </RoleBasedRoute>
        </ProtectedRoute>
      } />
      
      {/* Role View Test Routes (Admin Only) */}
      <Route path="/role-view/:role" element={
        <ProtectedRoute>
          <RoleBasedRoute allowedRoles={['admin']}>
            <RoleView />
          </RoleBasedRoute>
        </ProtectedRoute>
      } />
      
      {/* 404 Route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );

  // SidebarProvider가 필요한 경우에만 감싸기
  if (needsSidebar) {
    return (
      <SidebarProvider>
        {routesContent}
      </SidebarProvider>
    );
  }

  return routesContent;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AppContent />
        <Toaster />
      </Router>
    </QueryClientProvider>
  );
}

export default App;