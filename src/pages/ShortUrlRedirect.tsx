import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import LoadingScreen from '@/components/LoadingScreen';

const ShortUrlRedirect = () => {
  const { shortCode } = useParams<{ shortCode: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleRedirect = async () => {
      if (!shortCode) {
        setError('잘못된 링크입니다');
        setLoading(false);
        return;
      }

      try {
        console.log('🔗 짧은 URL 리다이렉트 처리:', shortCode);

        // 짧은 URL 정보 조회
        const { data: shortUrlData, error: fetchError } = await supabase
          .from('short_urls')
          .select('*')
          .eq('short_code', shortCode)
          .eq('is_active', true)
          .single();

        if (fetchError || !shortUrlData) {
          console.error('❌ 짧은 URL 조회 실패:', fetchError);
          setError('존재하지 않거나 비활성화된 링크입니다');
          setLoading(false);
          return;
        }

        // 만료 확인
        if (shortUrlData.expires_at && new Date(shortUrlData.expires_at) < new Date()) {
          console.error('⏰ 만료된 링크:', shortCode);
          setError('만료된 링크입니다');
          setLoading(false);
          return;
        }

        console.log('✅ 짧은 URL 정보 확인됨:', shortUrlData);

        // 클릭 수 증가
        try {
          await supabase
            .from('short_urls')
            .update({ click_count: shortUrlData.click_count + 1 })
            .eq('id', shortUrlData.id);
          
          console.log('📊 클릭 수 업데이트 완료');
        } catch (updateError) {
          // 클릭 수 업데이트 실패는 리다이렉트를 막지 않음
          console.warn('⚠️ 클릭 수 업데이트 실패:', updateError);
        }

        // 원본 URL로 리다이렉트
        console.log('🎯 리다이렉트 대상:', shortUrlData.original_url);
        
        // 내부 경로인 경우 navigate 사용, 외부 URL인 경우 window.location 사용
        if (shortUrlData.original_url.startsWith('/')) {
          navigate(shortUrlData.original_url);
        } else if (shortUrlData.original_url.includes(window.location.host)) {
          // 같은 도메인인 경우 내부 경로 추출
          const url = new URL(shortUrlData.original_url);
          navigate(url.pathname + url.search + url.hash);
        } else {
          // 외부 URL인 경우
          window.location.href = shortUrlData.original_url;
        }

      } catch (error) {
        console.error('💥 리다이렉트 처리 중 오류:', error);
        setError('링크 처리 중 오류가 발생했습니다');
        setLoading(false);
      }
    };

    handleRedirect();
  }, [shortCode, navigate]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="text-4xl">❌</div>
          <h1 className="text-2xl font-bold">링크 오류</h1>
          <p className="text-muted-foreground">{error}</p>
          <button 
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return <LoadingScreen />;
};

export default ShortUrlRedirect;