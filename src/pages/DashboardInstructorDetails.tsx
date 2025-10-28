import React from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts';
import LoadingScreen from '@/components/LoadingScreen';
import { PageErrorBoundary } from '@/components/error-boundaries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, BarChart3 } from 'lucide-react';
import { useInstructorStats } from '@/hooks/useInstructorStats';
import SurveyStatsByRound from '@/components/SurveyStatsByRound';

const DashboardInstructorDetails: React.FC = () => {
  const { instructorId } = useParams<{ instructorId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const yearParam = searchParams.get('year');
  const selectedYear = yearParam ? Number(yearParam) : (new Date().getFullYear());

  const { loading, summary, hasData, records } = useInstructorStats({
    instructorId: instructorId,
    includeTestData: true,
    filters: {
      year: Number.isFinite(selectedYear) ? selectedYear : 'all',
      round: 'all',
      course: 'all',
    },
    enabled: Boolean(instructorId),
  });

  if (loading) return <LoadingScreen />;

  const instructorName = records?.[0]?.instructorName || '강사 상세 통계';

  return (
    <DashboardLayout
      title={instructorName}
      subtitle="강사별 상세 통계"
      icon={<User className="h-5 w-5 text-white" />}
      actions={[
        <Button key="back" variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> 뒤로가기
        </Button>
      ]}
    >
      <PageErrorBoundary pageName="Dashboard Instructor Details">
        {!hasData ? (
          <Card>
            <CardHeader>
              <CardTitle>데이터가 없습니다</CardTitle>
            </CardHeader>
            <CardContent>
              선택한 연도에 대한 통계가 없습니다. 다른 연도나 조건으로 다시 시도해 주세요.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>설문 수</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-bold text-primary">{summary.totalSurveys}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>총 응답 수</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-bold text-primary">{summary.totalResponses}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>평균 만족도</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-bold text-primary">{summary.avgSatisfaction.toFixed(1)}</CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" /> 차수별 통계
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SurveyStatsByRound instructorId={instructorId} />
              </CardContent>
            </Card>
          </div>
        )}
      </PageErrorBoundary>
    </DashboardLayout>
  );
};

export default DashboardInstructorDetails;
