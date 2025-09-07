import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import LoadingScreen from './LoadingScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  redirectTo?: string;
}

const ProtectedRoute = ({ children, allowedRoles, redirectTo }: ProtectedRouteProps) => {
  const { user, userRoles, loading } = useAuth();
  const navigate = useNavigate();
  const didRedirect = useRef(false);

  const needRoleCheck = useMemo(() => !!(allowedRoles && allowedRoles.length > 0), [allowedRoles]);
  const hasAccess = useMemo(
    () => (needRoleCheck ? allowedRoles!.some((r) => userRoles.includes(r)) : true),
    [needRoleCheck, allowedRoles, userRoles]
  );

  useEffect(() => {
    if (loading || didRedirect.current) return;

    // 미인증 → /auth
    if (!user) {
      didRedirect.current = true;
      navigate('/auth', { replace: true });
      return;
    }

    // 역할 필요하지만 아직 로드되지 않았다면: 잠시 대기 (화면에서는 로딩 표시)
    if (needRoleCheck && userRoles.length === 0) return;

    // 접근권한 없음 → 역할별 기본 랜딩으로 보냄
    if (needRoleCheck && !hasAccess) {
      didRedirect.current = true;
      if (userRoles.includes('admin') || userRoles.includes('operator') || userRoles.includes('director')) {
        navigate(redirectTo || '/dashboard', { replace: true });
      } else if (userRoles.includes('instructor')) {
        navigate(redirectTo || '/dashboard/results', { replace: true });
      } else {
        navigate('/auth', { replace: true });
      }
    }
  }, [loading, user, userRoles, needRoleCheck, hasAccess, redirectTo, navigate]);

  // 로딩 중이거나, 역할 체크가 필요한데 아직 roles가 비어있으면 로딩
  if (loading || (needRoleCheck && user && userRoles.length === 0)) {
    return <LoadingScreen />;
  }

  // 미인증: useEffect에서 리다이렉트, 여기선 렌더 중단
  if (!user) return null;

  // 권한 없음: useEffect에서 리다이렉트, 여기선 렌더 중단
  if (needRoleCheck && !hasAccess) return null;

  return <>{children}</>;
};

export default ProtectedRoute;
