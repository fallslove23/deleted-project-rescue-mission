import { DashboardLayout } from '@/components/DashboardLayout';
import SurveyResults from './SurveyResults';

const DashboardSurveyResults = () => {
  return (
    <DashboardLayout title="결과 분석" description="개별 설문 결과 확인 및 공유">
      <SurveyResults />
    </DashboardLayout>
  );
};

export default DashboardSurveyResults;