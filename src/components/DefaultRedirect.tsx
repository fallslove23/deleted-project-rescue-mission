// src/components/DefaultRedirect.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import LoadingScreen from './LoadingScreen';

const DefaultRedirect = () => {
  const { user, userRoles, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const didRedirect = useRef(false);

  // next 파라미터와 preview 모드
  const next = useMemo(() => searchParams.get('next'), [searchParams]);
  const isPreview = useMemo(() => searchParams.get('preview') === 'true', [searchParams]);

  // roles가 늦게 채워지는 환경을 대비하여 한 번 더 조회
  const [extraRoles, setExtraRoles] = useState<string[] | null>(null);

  useEffect(() => {
    if (!loading && user && userRoles.length === 0 && extraRoles === null) {
      let canceled = false;

      (async () => {
        try {
          const { data, error } = await supabase.rpc('get_user_roles', {
            target_user_id: user.id,
          });
          if (canceled) return;

          if (!error && Array.isArray(data)) {
            setExtraRoles(data.map((d: any) => d.role));
          } else {
            setExtraRoles([]);
          }
        } catch {
          if (!canceled) setExtraRoles([]);
        }
      })();

      return () => {
        canceled = true;
      };
    }
  }, [loading, user, userRoles, extraRoles]);

  // 역할 우선순위 함수
  const getRolePriority = (role: string): number => {
    const priorities: Record<string, number> = {
      admin: 1,
      operator: 2,
      director: 3,
      instructor: 4, // 가장 낮은 우선순위
    };
    return priorities[role] || 99;
  };

  const rawRoles = userRoles.length ? userRoles : (extraRoles ?? []);
  // 역할 우선순위로 정렬 (instructor를 맨 뒤로)
  const finalRoles = rawRoles.sort((a: string, b: string) => getRolePriority(a) - getRolePriority(b));

  useEffect(() => {
    if (loading || didRedirect.current || isPreview) return;

    // 미인증 → /auth
    if (!user) {
      didRedirect.current = true;
      navigate('/auth', { replace: true });
      return;
    }

    // 역할 아직 준비 안 됨 → 잠시 대기
    if (finalRoles.length === 0) return;

    // next 우선
    if (next) {
      didRedirect.current = true;
      navigate(next, { replace: true });
      return;
    }

    // 역할별 기본 랜딩 (첫 번째 우선순위 역할 기준)
    didRedirect.current = true;
    const primaryRole = finalRoles[0];
    if (primaryRole === 'admin' || primaryRole === 'operator' || primaryRole === 'director') {
      navigate('/dashboard', { replace: true });
    } else if (primaryRole === 'instructor') {
      navigate('/dashboard/results', { replace: true });
    } else {
      navigate('/results', { replace: true });
    }
  }, [loading, user, finalRoles, next, isPreview, navigate]);

  // 미리보기 모드에선 아무 것도 하지 않음
  if (isPreview) return null;

  // 로딩/역할 대기 시 스피너
  if (loading || (user && finalRoles.length === 0)) {
    return <LoadingScreen />;
  }

  return null;
};

export default DefaultRedirect;
