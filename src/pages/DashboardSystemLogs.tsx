import { DashboardLayout } from '@/components/DashboardLayout';
import SystemLogs from './SystemLogs';

const DashboardSystemLogs = () => {
  return (
    <DashboardLayout title="시스템 로그" description="시스템 운영 및 관리 관련 로그 모니터링">
      <SystemLogs />
    </DashboardLayout>
  );
};

export default DashboardSystemLogs;