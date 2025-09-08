import React from 'react';
import { AdminLayout } from '@/components/layouts';
import { Users } from 'lucide-react';
import UserManagement from './UserManagement';

const DashboardUserManagement = () => {
  return (
    <AdminLayout
      title="사용자 관리"
      subtitle="사용자 계정 및 권한 관리"
      icon={<Users className="h-5 w-5 text-white" />}
    >
      <UserManagement />
    </AdminLayout>
  );
};

export default DashboardUserManagement;