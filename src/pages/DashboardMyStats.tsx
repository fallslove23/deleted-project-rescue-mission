import React from 'react';
import { AdminLayout } from '@/components/layouts';
import { Award } from 'lucide-react';
import PersonalDashboard from './PersonalDashboard';

const DashboardMyStats = () => {
  return (
    <AdminLayout
      title="나의 만족도 통계"
      subtitle="개인 강사 만족도 분석"
      icon={<Award className="h-5 w-5 text-white" />}
    >
      <PersonalDashboard />
    </AdminLayout>
  );
};

export default DashboardMyStats;
