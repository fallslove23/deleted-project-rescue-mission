import { DashboardLayout } from '@/components/DashboardLayout';
import CourseManagement from './CourseManagement';

const DashboardCourseManagement = () => {
  return (
    <DashboardLayout title="과목 관리" description="과목 정보 및 강사 배정 관리">
      <CourseManagement />
    </DashboardLayout>
  );
};

export default DashboardCourseManagement;