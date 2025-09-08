import React from 'react';
import { AdminLayout } from '@/components/layouts';
import { UserCheck } from 'lucide-react';
import InstructorManagement from './InstructorManagement';

const DashboardInstructorManagement = () => {
  return (
    <AdminLayout
      title="강사 관리"
      subtitle="강사 정보 등록 및 관리"
      icon={<UserCheck className="h-5 w-5 text-white" />}
    >
      <InstructorManagement />
    </AdminLayout>
  );
};

export default DashboardInstructorManagement;
