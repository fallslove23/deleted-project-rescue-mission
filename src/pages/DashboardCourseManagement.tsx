import React from 'react';
import { DashboardLayout } from '@/components/layouts';
import { BookOpen } from 'lucide-react';
import CourseManagement from './CourseManagement';

const DashboardCourseManagement = () => {
  return (
    <DashboardLayout
      title="과목 관리"
      subtitle="교육 과정 및 과목 정보 관리"
      icon={<BookOpen className="h-5 w-5 text-white" />}
    >
      <CourseManagement />
    </DashboardLayout>
  );
};

export default DashboardCourseManagement;
