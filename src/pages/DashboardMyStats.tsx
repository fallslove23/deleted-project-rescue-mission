import { DashboardLayout } from '@/components/DashboardLayout';
import SurveyResults from './SurveyResults';

const DashboardMyStats = () => {
  return (
    <DashboardLayout title="내 피드백 통계" description="내 강의 설문 피드백 요약">
      <SurveyResults showPageHeader={false} />
    </DashboardLayout>
  );
};

export default DashboardMyStats;
