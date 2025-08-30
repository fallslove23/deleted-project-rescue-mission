import { DashboardLayout } from '@/components/DashboardLayout';
import CumulativeDataTable from './CumulativeDataTable';

const DashboardCumulativeData = () => {
  return (
    <DashboardLayout title="누적 데이터" description="전체 설문 결과의 누적 데이터 조회 및 분석">
      <CumulativeDataTable />
    </DashboardLayout>
  );
};

export default DashboardCumulativeData;