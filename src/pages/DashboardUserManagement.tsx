import { DashboardLayout } from '@/components/DashboardLayout';
import UserManagement from './UserManagement';

const DashboardUserManagement = () => {
  return (
    <DashboardLayout title="사용자 관리" description="시스템 사용자 및 권한 관리">
      <UserManagement showPageHeader={false} />
    </DashboardLayout>
  );
};

export default DashboardUserManagement;