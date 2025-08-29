import { DashboardLayout } from '@/components/DashboardLayout';
import CourseReports from './CourseReports';

const DashboardCourseReports = () => {
  return (
    <DashboardLayout title="결과 보고" description="과정별 만족도 조사 결과 분석">
      <CourseReports />
    </DashboardLayout>
  );
};

export default DashboardCourseReports;