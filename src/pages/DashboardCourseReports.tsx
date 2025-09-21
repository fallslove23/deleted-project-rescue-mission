import React from 'react';
import { BarChart3 } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts';
import CourseReports from './CourseReports';

const DashboardCourseReports: React.FC = () => {
  return (
    <DashboardLayout
      title="과정 결과 보고"
      subtitle="과정별 운영 결과 분석"
      icon={<BarChart3 className="h-5 w-5 text-white" />}
    >
      <CourseReports />
    </DashboardLayout>
  );
};

export default DashboardCourseReports;
