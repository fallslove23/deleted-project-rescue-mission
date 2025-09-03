import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAnonymousSession } from '@/hooks/useAnonymousSession';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
// ⬇️ ScrollArea는 제거 (내부 스크롤 금지)
// import { ScrollArea } from '@/components/ui/scroll-area';
import { Menu, Calendar, Clock, BarChart, FileText, Users, ChevronDown, ChevronRight, CheckCircle } from 'lucide-react';
import { toZonedTime } from 'date-fns-tz';

interface Survey {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  education_year: number;
  education_round: number;
  course_name?: string;
  status: string;
}

const Index = () => {
  const { user, loading } = useAuth();
  const { session, loading: sessionLoading, checkSurveyCompletion } = useAnonymousSession();
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loadingSurveys, setLoadingSurveys] = useState(true);
  const [showAllSurveys, setShowAllSurveys] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [completedSurveys, setCompletedSurveys] = useState<Set<string>>(new Set());

  // ... (fetch / grouping 로직 동일, 생략)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div>로딩중...</div>
      </div>
    );
  }

  const groupedSurveys = groupSurveysByRound(surveys);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header 동일 */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        {/* ... 헤더 내용 동일 ... */}
      </header>

      {/* ↓↓↓ 핵심 변경 1: main에서 overflow-hidden, min-h-screen 제거 */}
      <main className="container mx-auto px-3 sm:px-4 py-6 md:py-8 max-w-full">
        <div className="mb-6 md:mb-8 text-center px-2">
          {/* ... 제목/설명 동일 ... */}
        </div>

        {loadingSurveys ? (
          <div className="text-center py-12">
            <div className="animate-pulse">📋 설문조사를 불러오는 중...</div>
          </div>
        ) : Object.keys(groupedSurveys).length === 0 ? (
          {/* ... 빈 상태 UI 동일 ... */}
          <div className="text-center py-16 px-2 sm:px-4">
            {/* ... */}
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedSurveys).map(([roundTitle, roundSurveys]) => (
              <section key={roundTitle} className="relative animate-fade-in">
                <Collapsible 
                  open={openGroups[roundTitle] || false}
                  onOpenChange={() => toggleGroup(roundTitle)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-3 mb-4 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors">
                      <Badge variant="default" className="text-sm px-3 py-1">
                        🎓 {roundTitle}
                      </Badge>
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground mr-2">
                        {roundSurveys.length}개 설문
                      </span>
                      {openGroups[roundTitle] ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </CollapsibleTrigger>

                  {/* ↓↓↓ 핵심 변경 2: ScrollArea 제거, max-h 제한 없애기 */}
                  <CollapsibleContent>
                    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 px-1">
                      {roundSurveys.map((survey) => (
                        {/* ↓↓↓ 핵심 변경 3: 카드의 overflow-hidden 제거 */}
                        <Card 
                          key={survey.id}
                          className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-primary/30 hover:border-l-primary cursor-pointer max-w-full"
                        >
                          <CardHeader className="pb-3 p-4 sm:p-6">
                            {/* ... 카드 헤더 내용 동일 ... */}
                          </CardHeader>

                          <CardContent className="pt-0 p-4 sm:p-6 sm:pt-0">
                            {/* ... 카드 본문 내용 동일 ... */}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;