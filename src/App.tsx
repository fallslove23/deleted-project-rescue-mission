import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import LoadingScreen from '@/components/LoadingScreen';

// 필수 페이지만 import (오류 방지)
import Auth from '@/pages/Auth';
import Dashboard from '@/pages/Dashboard';
import Index from '@/pages/Index';
import NotFound from '@/pages/NotFound';
import ProtectedRoute from '@/components/ProtectedRoute';

import './App.css';

function App() {
  // AuthProvider 내부에서 안전하게 useAuth 사용
  try {
    const { user, loading } = useAuth();

    if (loading) {
      return <LoadingScreen />;
    }

    return (
      <Routes>
        {/* 기본 라우트 */}
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
        
        {/* 기본 리디렉션 */}
        <Route 
          path="/app" 
          element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/auth" replace />} 
        />
        
        {/* 404 페이지 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  } catch (error) {
    // AuthProvider가 아직 초기화되지 않은 경우 로딩 화면 표시
    console.error('Auth context error:', error);
    return <LoadingScreen />;
  }
}

export default App;