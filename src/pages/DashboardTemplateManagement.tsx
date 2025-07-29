import { DashboardLayout } from '@/components/DashboardLayout';
import TemplateManagement from './TemplateManagement';

const DashboardTemplateManagement = () => {
  return (
    <DashboardLayout title="템플릿 관리" description="설문 템플릿 생성 및 관리">
      <TemplateManagement />
    </DashboardLayout>
  );
};

export default DashboardTemplateManagement;