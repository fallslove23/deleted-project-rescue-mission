import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Link2, Clock, MousePointerClick, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface ShortUrlGeneratorProps {
  surveyId: string;
  surveyTitle: string;
}

interface ShortUrlData {
  shortUrl: string;
  shortCode: string;
  originalUrl: string;
  clickCount: number;
  expiresAt: string;
}

const ShortUrlGenerator = ({ surveyId, surveyTitle }: ShortUrlGeneratorProps) => {
  const [shortUrlData, setShortUrlData] = useState<ShortUrlData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  // 기존 짧은 URL 확인
  const checkExistingShortUrl = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('short_urls')
        .select('*')
        .eq('survey_id', surveyId)
        .eq('is_active', true)
        .single();

      if (data && !error) {
        const shortUrl = `${window.location.origin}/s/${data.short_code}`;
        setShortUrlData({
          shortUrl,
          shortCode: data.short_code,
          originalUrl: data.original_url,
          clickCount: data.click_count,
          expiresAt: data.expires_at
        });
      }
    } catch (error) {
      console.log('기존 짧은 URL 없음');
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 기존 URL 확인
  useState(() => {
    checkExistingShortUrl();
  });

  // 새 짧은 URL 생성
  const generateShortUrl = async () => {
    setGenerating(true);
    try {
      console.log('🔗 짧은 URL 생성 시작:', surveyId);

      const { data, error } = await supabase.functions.invoke('create-short-url', {
        body: {
          surveyId,
          originalUrl: `${window.location.origin}/survey/${surveyId}`,
          expiresInDays: 30
        }
      });

      if (error) {
        console.error('❌ 짧은 URL 생성 실패:', error);
        throw error;
      }

      if (data.success) {
        setShortUrlData(data);
        toast({
          title: '짧은 URL 생성 완료!',
          description: `${data.shortCode} 코드로 짧은 URL이 생성되었습니다.`,
        });
        console.log('✅ 짧은 URL 생성 성공:', data);
      } else {
        throw new Error(data.error || '알 수 없는 오류');
      }
    } catch (error) {
      console.error('💥 짧은 URL 생성 오류:', error);
      toast({
        title: '짧은 URL 생성 실패',
        description: error.message || '짧은 URL 생성 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  // URL 복사하기
  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: '복사 완료!',
        description: `${type}이(가) 클립보드에 복사되었습니다.`,
      });
    } catch (error) {
      toast({
        title: '복사 실패',
        description: '클립보드 복사에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  // 새 탭에서 열기
  const openInNewTab = (url: string) => {
    window.open(url, '_blank');
  };

  // 만료일 포맷팅
  const formatExpiryDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          짧은 URL 생성
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {surveyTitle}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!shortUrlData ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              이 설문에 대한 짧은 URL이 아직 생성되지 않았습니다.
            </p>
            <Button 
              onClick={generateShortUrl}
              disabled={generating}
              className="w-full"
            >
              {generating ? '생성 중...' : '짧은 URL 생성하기'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 짧은 URL */}
            <div className="space-y-2">
              <label className="text-sm font-medium">짧은 URL</label>
              <div className="flex items-center gap-2">
                <Input
                  value={shortUrlData.shortUrl}
                  readOnly
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(shortUrlData.shortUrl, '짧은 URL')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openInNewTab(shortUrlData.shortUrl)}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 원본 URL */}
            <div className="space-y-2">
              <label className="text-sm font-medium">원본 URL</label>
              <div className="flex items-center gap-2">
                <Input
                  value={shortUrlData.originalUrl}
                  readOnly
                  className="flex-1 text-xs text-muted-foreground"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(shortUrlData.originalUrl, '원본 URL')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 통계 정보 */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    클릭 수: <Badge variant="secondary">{shortUrlData.clickCount}</Badge>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    만료일: {formatExpiryDate(shortUrlData.expiresAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* 새로고침 버튼 */}
            <Button
              variant="outline"
              size="sm"
              onClick={checkExistingShortUrl}
              disabled={loading}
              className="w-full"
            >
              {loading ? '업데이트 중...' : '통계 새로고침'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ShortUrlGenerator;