import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Menu, Calendar, Clock } from 'lucide-react';

interface Survey {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  education_year: number;
  education_round: number;
  status: string;
}

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loadingSurveys, setLoadingSurveys] = useState(true);

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    fetchTodaysSurveys();
  }, []);

  const fetchTodaysSurveys = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('surveys')
        .select('*')
        .eq('status', 'active')
        .lte('start_date', today)
        .gte('end_date', today)
        .order('education_year', { ascending: false })
        .order('education_round', { ascending: false });

      if (error) throw error;
      setSurveys(data || []);
    } catch (error) {
      console.error('Error fetching surveys:', error);
    } finally {
      setLoadingSurveys(false);
    }
  };

  const groupSurveysByRound = (surveys: Survey[]) => {
    const grouped = surveys.reduce((acc, survey) => {
      const key = `${survey.education_year}년 ${survey.education_round}차`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(survey);
      return acc;
    }, {} as Record<string, Survey[]>);
    return grouped;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div>로딩중...</div>
      </div>
    );
  }

  const groupedSurveys = groupSurveysByRound(surveys);

  return (
    <div className="min-h-screen bg-background">
      {/* Header with hamburger menu */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">BS/SS 교육과정 교육생 피드백</h1>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <div className="space-y-4 mt-6">
                <h2 className="text-lg font-semibold">관리자/강사 로그인</h2>
                <p className="text-sm text-muted-foreground">
                  설문 결과 조회를 위해 로그인하세요
                </p>
                <Button 
                  onClick={() => navigate('/auth')}
                  className="w-full"
                >
                  로그인하기
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold mb-4">오늘의 설문조사</h2>
          <p className="text-muted-foreground">
            진행 중인 설문조사에 참여해 주세요
          </p>
        </div>

        {loadingSurveys ? (
          <div className="text-center py-8">
            <div>설문조사를 불러오는 중...</div>
          </div>
        ) : Object.keys(groupedSurveys).length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">진행 중인 설문조사가 없습니다</h3>
            <p className="text-muted-foreground">
              현재 활성화된 설문조사가 없습니다
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedSurveys).map(([roundTitle, roundSurveys]) => (
              <div key={roundTitle}>
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Badge variant="secondary">{roundTitle}</Badge>
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {roundSurveys.map((survey) => (
                    <Card key={survey.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle className="text-lg">{survey.title}</CardTitle>
                        {survey.description && (
                          <p className="text-sm text-muted-foreground">
                            {survey.description}
                          </p>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>
                              {new Date(survey.start_date).toLocaleDateString()} ~ {new Date(survey.end_date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <Button className="w-full mt-4">
                          설문 참여하기
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
