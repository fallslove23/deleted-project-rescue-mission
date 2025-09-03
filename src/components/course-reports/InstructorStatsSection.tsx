
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, BarChart3 } from 'lucide-react';
import { AreaChart } from '@/components/charts/AreaChart';

interface InstructorStats {
  instructor_id: string;
  instructor_name: string;
  survey_count: number;
  response_count: number;
  avg_satisfaction: number;
}

interface InstructorStatsSectionProps {
  instructorStats: InstructorStats[];
  onInstructorClick: (instructorId: string) => void;
}

const InstructorStatsSection: React.FC<InstructorStatsSectionProps> = ({
  instructorStats,
  onInstructorClick
}) => {
  const instructorComparisonData = instructorStats.map((stat, index) => ({
    name: stat.instructor_name,
    satisfaction: stat.avg_satisfaction,
    responseCount: stat.response_count,
    fill: `hsl(${200 + index * 20}, 70%, 60%)`
  }));

  return (
    <Card className="shadow-lg border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          강사별 만족도 통계 (10점 만점)
        </CardTitle>
        <CardDescription>
          각 강사별 평균 만족도와 응답 수를 확인할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {instructorStats.map((stat, index) => (
            <div 
              key={stat.instructor_id}
              className="flex justify-between items-center p-3 rounded-lg border bg-muted/10"
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm bg-primary"
                >
                  {stat.instructor_name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-medium text-sm">{stat.instructor_name}</h4>
                  <div className="text-xs text-muted-foreground">
                    설문 {stat.survey_count}개 · 응답 {stat.response_count}개
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">{stat.avg_satisfaction.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">만족도</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {instructorStats.length > 1 && (
          <div className="border-t pt-6">
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              강사별 만족도 비교
            </h4>
            <AreaChart 
              data={instructorComparisonData}
              dataKeys={[
                { key: 'satisfaction', label: '만족도', color: 'hsl(var(--primary))' }
              ]}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InstructorStatsSection;
