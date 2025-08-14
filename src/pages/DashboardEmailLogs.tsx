import { DashboardLayout } from '@/components/DashboardLayout';
import EmailLogs from './EmailLogs';

const DashboardEmailLogs = () => {
  return (
    <DashboardLayout title="이메일 로그" description="설문 결과 이메일 발송 기록 및 통계">
      <EmailLogs />
    </DashboardLayout>
  );
};

export default DashboardEmailLogs;