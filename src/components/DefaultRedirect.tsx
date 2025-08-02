import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import LoadingScreen from './LoadingScreen';

const DefaultRedirect = () => {
  const { userRoles, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && userRoles.length > 0) {
      // 역할별 기본 페이지로 리디렉션
      if (userRoles.includes('admin') || userRoles.includes('operator')) {
        navigate('/dashboard');
      } else if (userRoles.includes('instructor') || userRoles.includes('director')) {
        navigate('/dashboard/results');
      }
    }
  }, [userRoles, loading, navigate]);

  if (loading) {
    return <LoadingScreen />;
  }

  return null;
};

export default DefaultRedirect;