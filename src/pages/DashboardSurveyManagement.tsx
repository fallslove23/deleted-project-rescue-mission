import { DashboardLayout } from '@/components/DashboardLayout';
import SurveyManagementV2 from './SurveyManagementV2';

const DashboardSurveyManagement = () => {
  return (
    <DashboardLayout title="설문 관리" description="설문조사 생성 및 관리">
      <SurveyManagementV2 />
    </DashboardLayout>
  );
};

export default DashboardSurveyManagement;