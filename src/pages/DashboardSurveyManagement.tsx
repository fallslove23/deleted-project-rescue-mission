import { DashboardLayout } from '@/components/DashboardLayout';
import SurveyManagement from './SurveyManagement';

const DashboardSurveyManagement = () => {
  return (
    <DashboardLayout title="설문 관리" description="설문조사 생성 및 관리">
      <SurveyManagement />
    </DashboardLayout>
  );
};

export default DashboardSurveyManagement;