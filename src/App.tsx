import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import LoadingScreen from '@/components/LoadingScreen';

// 존재하는 페이지만 import (오류 방지)
import Auth from '@/pages/Auth';
import Dashboard from '@/pages/Dashboard';
import Index from '@/pages/Index';
import NotFound from '@/pages/NotFound';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleBasedRoute from '@/components/RoleBasedRoute';

// 존재하는 경우에만 import (주석처리된 것들은 나중에 추가)
// import SurveyManagement from '@/pages/SurveyManagement';
import SurveyManagementV2 from '@/pages/SurveyManagementV2';
// import PersonalDashboard from '@/pages/PersonalDashboard';
// import InstructorManagement from '@/pages/InstructorManagement';
// import CourseManagement from '@/pages/CourseManagement';
// import SurveyResults from '@/pages/SurveyResults';
// import UserManagement from '@/pages/UserManagement';
// import TemplateManagement from '@/pages/TemplateManagement';

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

      {/* 보호된 라우트 */}
      <Route
        path="/dashboard/*"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* 설문관리 - V2만 사용 */}
      <Route
        path="/surveys-v2"
        element={
          <RoleBasedRoute allowedRoles={['admin', 'super_admin', 'instructor']}>
            <SurveyManagementV2 />
          </RoleBasedRoute>
        }
      />

      {/* 기본 리디렉션 */}
      <Route 
        path="/app" 
        element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/auth" replace />} 
      />

      {/* 404 페이지 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;