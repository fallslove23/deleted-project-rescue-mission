import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useAnonymousSession() {
  const [session, setSession] = useState<null | any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        if (!data.session) {
          try {
            // 익명 로그인이 켜져 있으면 성공, 꺼져 있으면 throw
            await supabase.auth.signInAnonymously();
            const { data: after } = await supabase.auth.getSession();
            if (!mounted) return;
            setSession(after.session ?? null);
          } catch (e) {
            console.warn('anonymous sign-in skipped:', e);
            setSession(null); // ❗없어도 앱은 동작
          }
        } else {
          setSession(data.session);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // 서버 측 중복 제출 체크(옵션: 세션 없으면 false 반환)
  const checkSurveyCompletion = useCallback(async (surveyId: string) => {
    if (!session) return false;
    const { data, error } = await supabase
      .from('survey_completion')
      .select('survey_id')
      .eq('survey_id', surveyId)
      .limit(1);
    if (error) return false;
    return (data?.length ?? 0) > 0;
  }, [session]);

  const markSurveyCompleted = useCallback(async (surveyId: string) => {
    if (!session) return;
    await supabase.from('survey_completion').upsert({ survey_id: surveyId });
  }, [session]);

  const validateToken = useCallback(async (surveyId: string, code: string) => {
    const { data, error } = await supabase
      .from('survey_tokens')
      .select('id, used_at, expired_at')
      .eq('survey_id', surveyId)
      .eq('code', code)
      .maybeSingle();
    if (error || !data) return false;
    if (data.used_at || (data.expired_at && new Date(data.expired_at) < new Date())) return false;
    return true;
  }, []);

  return { session, loading, checkSurveyCompletion, markSurveyCompleted, validateToken };
}