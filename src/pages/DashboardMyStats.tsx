import { DashboardLayout } from '@/components/DashboardLayout';
import PersonalDashboard from './PersonalDashboard';

const DashboardMyStats = () => {
  return (
    <DashboardLayout title="내 피드백 통계" description="월/반기/연별 개인 성과 분석">
      <PersonalDashboard />
    </DashboardLayout>
  );
};

export default DashboardMyStats;
