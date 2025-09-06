import { DashboardLayout } from '@/components/DashboardLayout';
import SurveyManagementV2 from './SurveyManagementV2';  // V2로 변경

const DashboardSurveyManagement = () => {
  return (
    <DashboardLayout title="설문 관리" description="설문조사 생성 및 관리">
      <SurveyManagementV2 />  {/* showPageHeader prop 제거 - V2에서 지원하지 않을 수 있음 */}
    </DashboardLayout>
  );
};

export default DashboardSurveyManagement;