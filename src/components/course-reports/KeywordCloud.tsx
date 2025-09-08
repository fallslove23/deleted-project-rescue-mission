import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';

interface KeywordCloudProps {
  textualResponses: string[];
}

export const KeywordCloud = ({ textualResponses }: KeywordCloudProps) => {
  if (!textualResponses || !Array.isArray(textualResponses) || textualResponses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            키워드 분석
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            분석할 텍스트 응답이 없습니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  // 간단한 키워드 추출 로직 (실제로는 더 정교한 NLP 처리 필요)
  const extractKeywords = (responses: string[]) => {
    const allText = responses.join(' ').toLowerCase();
    const words = allText.match(/[가-힣]{2,}/g) || [];
    const wordCount = new Map();
    
    // 불용어 제거
    const stopWords = ['있는', '같은', '대한', '하는', '되는', '이런', '저런', '그런', '많은', '좋은', '나쁜'];
    
  words.forEach((word: string) => {
    if (!stopWords.includes(word) && word && word.length >= 2) {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    }
  });
    
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));
  };

  const getTopComments = (responses: string[]) => {
    return responses
      .filter(response => response.length > 10)
      .sort((a, b) => b.length - a.length)
      .slice(0, 3);
  };

  const keywords = extractKeywords(textualResponses);
  const topComments = getTopComments(textualResponses);

  const getFontSize = (count: number, maxCount: number) => {
    const minSize = 12;
    const maxSize = 24;
    return minSize + (count / maxCount) * (maxSize - minSize);
  };

  const maxCount = keywords[0]?.count || 1;

  return (
    <div className="space-y-6">
      {/* 키워드 클라우드 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            주요 키워드
          </CardTitle>
        </CardHeader>
        <CardContent>
          {keywords.length > 0 ? (
            <div className="flex flex-wrap gap-3 justify-center p-6">
              {keywords.map(({ word, count }, index) => (
                <span
                  key={index}
                  className="inline-block px-3 py-1 bg-primary/10 text-primary rounded-full transition-all hover:bg-primary/20"
                  style={{
                    fontSize: `${getFontSize(count, maxCount)}px`,
                    fontWeight: count > maxCount * 0.7 ? 'bold' : 'normal'
                  }}
                >
                  {word}
                  <span className="text-xs ml-1 opacity-70">({count})</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              분석할 텍스트 응답이 없습니다.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Top 3 개선 의견 */}
      <Card>
        <CardHeader>
          <CardTitle>주요 개선 의견</CardTitle>
        </CardHeader>
        <CardContent>
          {topComments.length > 0 ? (
            <div className="space-y-4">
              {topComments.map((comment, index) => (
                <div key={index} className="p-4 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-lg border border-primary/20">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-relaxed flex-1">{comment}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              표시할 주요 의견이 없습니다.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};