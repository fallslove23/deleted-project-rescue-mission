import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import LoadingScreen from './LoadingScreen';

const DefaultRedirect = () => {
  const { userRoles, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // preview 모드일 때는 리다이렉트하지 않음
    const isPreview = searchParams.get('preview') === 'true';
    
    if (!loading && userRoles.length > 0 && !isPreview) {
      // 역할별 기본 페이지로 리디렉션
      if (userRoles.includes('admin') || userRoles.includes('operator')) {
        navigate('/dashboard');
      } else if (userRoles.includes('instructor') || userRoles.includes('director')) {
        navigate('/dashboard/results');
      }
    }
  }, [userRoles, loading, navigate, searchParams]);

  if (loading) {
    return <LoadingScreen />;
  }

  return null;
};

export default DefaultRedirect;