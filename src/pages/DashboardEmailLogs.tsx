import React from 'react';
import { AdminLayout } from '@/components/layouts';
import { Mail } from 'lucide-react';
import EmailLogs from './EmailLogs';

const DashboardEmailLogs = () => {
  return (
    <AdminLayout
      title="이메일 로그"
      subtitle="이메일 발송 이력 및 상태 확인"
      icon={<Mail className="h-5 w-5 text-white" />}
    >
      <EmailLogs />
    </AdminLayout>
  );
};

export default DashboardEmailLogs;
