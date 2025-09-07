import { DashboardLayout } from '@/components/DashboardLayout';
import SurveyManagement from './SurveyManagementV2';

const DashboardSurveyManagement = () => {
  return (
    <DashboardLayout title="설문 관리" description="설문조사 생성 및 관리">
      <SurveyManagementV2 showPageHeader={false} />
    </DashboardLayout>
  );
};

export default DashboardSurveyManagement;