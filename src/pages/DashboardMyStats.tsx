import React from 'react';
import { DashboardLayout } from '@/components/layouts';
import { Award } from 'lucide-react';
import PersonalDashboard from './PersonalDashboard';
import { InstructorInsightCards } from '@/components/dashboard/InstructorInsightCards';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DashboardMyStats = () => {
  const { userRoles } = useAuth();
  const navigate = useNavigate();
  const isAdmin = userRoles.includes('admin');

  return (
    <DashboardLayout
      title="나의 만족도 통계"
      subtitle="개인 성과 분석 및 자기 개선 포인트"
      icon={<Award className="h-5 w-5 text-white" />}
    >
      {isAdmin && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>관리자 전용</CardTitle>
            <CardDescription>강사별 페이지를 미리보기 하여 오류사항을 확인할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate('/course-reports')}
              variant="outline"
              className="w-full"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              강사 페이지로 이동 (Course Reports)
            </Button>
          </CardContent>
        </Card>
      )}
      <PersonalDashboard />
    </DashboardLayout>
  );
};

export default DashboardMyStats;
