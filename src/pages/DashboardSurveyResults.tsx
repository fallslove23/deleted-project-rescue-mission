import { DashboardLayout } from '@/components/DashboardLayout';
import SurveyAnalysis from './SurveyAnalysis';

const DashboardSurveyResults = () => {
  return (
    <DashboardLayout title="결과 분석" description="개별 설문 결과 확인 및 공유">
      <SurveyAnalysis />
    </DashboardLayout>
  );
};

export default DashboardSurveyResults;