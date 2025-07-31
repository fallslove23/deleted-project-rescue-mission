import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  redirectTo?: string;
}

const ProtectedRoute = ({ children, allowedRoles, redirectTo }: ProtectedRouteProps) => {
  const { user, userRoles, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/auth');
        return;
      }

      // 특정 역할이 필요한 경우 권한 확인
      if (allowedRoles && allowedRoles.length > 0) {
        const hasAccess = allowedRoles.some(role => userRoles.includes(role));
        
        if (!hasAccess) {
          // 기본 역할별 리디렉션
          if (userRoles.includes('admin') || userRoles.includes('operator')) {
            navigate(redirectTo || '/dashboard');
          } else if (userRoles.includes('instructor') || userRoles.includes('director')) {
            navigate(redirectTo || '/dashboard/results');
          } else {
            navigate('/auth');
          }
        }
      }
    }
  }, [user, userRoles, loading, navigate, allowedRoles, redirectTo]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>로딩중...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // 특정 역할이 필요한 경우 권한 확인
  if (allowedRoles && allowedRoles.length > 0) {
    const hasAccess = allowedRoles.some(role => userRoles.includes(role));
    if (!hasAccess) {
      return null;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;