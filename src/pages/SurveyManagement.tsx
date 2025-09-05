// src/pages/SurveyManagement.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Settings, BarChart, Trash2, FileText, Target, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SurveyCreateForm from '@/components/SurveyCreateForm';

interface Survey {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  education_year: number;
  education_round: number;
  education_day?: number;
  status: string;
  course_name?: string | null;
  created_at: string;
}

const SurveyManagement = ({ showPageHeader = true }: { showPageHeader?: boolean }) => {
  const navigate = useNavigate();
  const { user, userRoles } = useAuth();
  const { toast } = useToast();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // 사용자 권한 확인
  const isAdmin = userRoles.includes('admin');
  const isOperator = userRoles.includes('operator');
  const isDirector = userRoles.includes('director');
  const canViewAll = isAdmin || isOperator || isDirector;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      console.log('Starting data fetch...');
      
      const { data: surveysData, error } = await supabase
        .from('surveys')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('Raw surveys data:', surveysData);
      console.log('Surveys error:', error);

      if (error) {
        throw error;
      }

      const processedSurveys = (surveysData || []).map((survey: any) => ({
        ...survey,
        // 안전한 Date 처리
        start_date: survey.start_date || new Date().toISOString(),
        end_date: survey.end_date || new Date(Date.now() + 24*60*60*1000).toISOString()
      }));
      
      console.log('Processed surveys:', processedSurveys);
      setSurveys(processedSurveys);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: '오류',
        description: '데이터를 불러오는 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteSurvey = async (id: string) => {
    try {
      const { error } = await supabase
        .from('surveys')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: '성공', description: '설문이 삭제되었습니다.' });
      fetchData(); // 목록 새로고침
    } catch (error: any) {
      console.error('Error deleting survey:', error);
      toast({
        title: '오류',
        description: `설문 삭제 실패: ${error?.message || '알 수 없는 오류가 발생했습니다'}`,
        variant: 'destructive'
      });
    }
  };

  // 간단한 페이징 (처음 10개만)
  const displayedSurveys = surveys.slice(0, 10);

  console.log('Final render - surveys length:', surveys.length);
  console.log('Final render - displayed surveys:', displayedSurveys.length);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div>로딩중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {showPageHeader && (
        <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
          <div className="container mx-auto px-4 py-3 flex items-center relative">
            <Button onClick={() => navigate('/dashboard')} variant="ghost" size="sm" className="touch-friendly">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">대시보드</span>
            </Button>
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <h1 className="text-sm sm:text-lg font-semibold text-primary text-center">설문 관리</h1>
              <p className="text-xs text-muted-foreground text-center">설문조사 생성 및 관리</p>
            </div>
          </div>
        </header>
      )}

      <main className="container mx-auto px-4 py-6">
        {/* 상단 액션 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-lg sm:text-xl font-bold">설문조사 목록</h2>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="touch-friendly text-sm w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                <span className="break-words">새 설문조사</span>
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>새 설문조사 만들기</DialogTitle>
              </DialogHeader>

              <SurveyCreateForm 
                templates={[]}
                onSuccess={(surveyId) => {
                  setIsDialogOpen(false);
                  toast({
                    title: "성공",
                    description: "설문조사가 생성되었습니다."
                  });
                  fetchData(); // 목록 새로고침
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* 디버그 정보 */}
        <div className="p-4 bg-yellow-100 border border-yellow-300 rounded mb-4">
          <h3 className="font-bold">디버그 정보</h3>
          <p>총 설문 수: {surveys.length}</p>
          <p>표시되는 수: {displayedSurveys.length}</p>
          <p>로딩 상태: {loading ? '로딩중' : '완료'}</p>
          <p>사용자 권한: {userRoles.join(', ')}</p>
        </div>

        {/* 설문 목록 */}
        <div className="grid gap-4">
          {displayedSurveys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">설문이 없습니다</h3>
              <p className="text-sm text-muted-foreground mb-4">
                아직 생성된 설문이 없습니다. 새 설문조사를 만들어보세요.
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                첫 설문조사 만들기
              </Button>
            </div>
          ) : (
            displayedSurveys.map((survey, index) => (
              <Card key={survey.id} className="transition-shadow hover:shadow-md">
                <CardHeader className="p-4 sm:p-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base sm:text-lg break-words">
                          {survey.title || `설문 ${index + 1}`}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-2">
                          {survey.description || '설명 없음'}
                        </p>
                      </div>
                      <Badge variant="secondary">{survey.status || 'draft'}</Badge>
                    </div>

                    {/* 기본 정보 */}
                    <div className="text-xs sm:text-sm text-muted-foreground space-y-1">
                      <p>과정: {survey.course_name || '미설정'}</p>
                      <p>년도: {survey.education_year || '미설정'}년</p>
                      <p>차수: {survey.education_round || '미설정'}차</p>
                      <p>생성일: {new Date(survey.created_at).toLocaleDateString('ko-KR')}</p>
                    </div>

                    {/* 액션 버튼들 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/survey-builder/${survey.id}`)}
                        className="text-xs h-9 px-3"
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        수정
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/survey-results/${survey.id}`)}
                        className="text-xs h-9 px-3"
                      >
                        <BarChart className="h-4 w-4 mr-1" />
                        결과
                      </Button>

                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm('정말 삭제하시겠습니까?')) {
                            deleteSurvey(survey.id);
                          }
                        }}
                        className="text-xs h-9 px-3"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        삭제
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>

        {/* 더 보기 버튼 */}
        {surveys.length > 10 && (
          <div className="text-center mt-6">
            <p className="text-sm text-muted-foreground">
              총 {surveys.length}개 중 10개 표시 (더 많은 기능은 추후 추가 예정)
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default SurveyManagement;