import { DashboardLayout } from '@/components/DashboardLayout';
import CourseStatisticsManagement from '@/components/CourseStatisticsManagement';

const DashboardCourseStatistics = () => {
  return (
    <DashboardLayout title="과정별 통계 관리" description="과정별 통계 데이터 입력 및 관리">
      <CourseStatisticsManagement />
    </DashboardLayout>
  );
};

export default DashboardCourseStatistics;