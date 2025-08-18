import { DashboardLayout } from '@/components/DashboardLayout';
import InstructorManagement from './InstructorManagement';

const DashboardInstructorManagement = () => {
  return (
    <DashboardLayout title="강사 관리" description="강사 정보 및 계정 관리">
      <InstructorManagement showPageHeader={true} />
    </DashboardLayout>
  );
};

export default DashboardInstructorManagement;