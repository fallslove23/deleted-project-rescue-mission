import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div>
          <h1>앱이 정상적으로 로드되었습니다!</h1>
          <p>AuthProvider가 올바르게 설정되었습니다.</p>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;