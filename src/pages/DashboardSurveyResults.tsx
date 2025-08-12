import { DashboardLayout } from '@/components/DashboardLayout';
import SurveyResults from './SurveyResults';

const DashboardSurveyResults = () => {
  return (
    <DashboardLayout title="결과 분석" description="설문조사 결과 분석 및 통계">
      <SurveyResults showPageHeader={false} />
    </DashboardLayout>
  );
};

export default DashboardSurveyResults;