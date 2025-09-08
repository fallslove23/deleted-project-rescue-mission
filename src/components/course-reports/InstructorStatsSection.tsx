
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, BarChart3, TrendingUp } from 'lucide-react';
import { AreaChart } from '@/components/charts/AreaChart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface InstructorStats {
  instructor_id: string;
  instructor_name: string;
  survey_count: number;
  response_count: number;
  avg_satisfaction: number;
}

interface InstructorStatsSectionProps {
  instructorStats: InstructorStats[];
  previousStats?: InstructorStats[];
  comparisonLabel?: string;
  onInstructorClick: (instructorId: string) => void;
}

const InstructorStatsSection: React.FC<InstructorStatsSectionProps> = ({
  instructorStats,
  previousStats = [],
  comparisonLabel = '이전 기간',
  onInstructorClick
}) => {
  // 강사별 현재와 이전 기간 비교 데이터 생성
  const instructorComparisonData = instructorStats.map((stat) => {
    const previousStat = previousStats.find(prev => prev.instructor_id === stat.instructor_id);
    return {
      name: stat.instructor_name.length > 6 ? stat.instructor_name.substring(0, 5) + '...' : stat.instructor_name,
      현재: stat.avg_satisfaction,
      [comparisonLabel]: previousStat?.avg_satisfaction || 0,
      현재응답수: stat.response_count,
      이전응답수: previousStat?.response_count || 0
    };
  });

  const hasComparisonData = previousStats.length > 0;

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
        {/* 강사별 비교 차트 */}
        {instructorStats.length > 0 && (
          <div className="mb-6">
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              강사별 만족도 {hasComparisonData ? '비교 분석' : '현황'}
            </h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={instructorComparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 10]} />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(1)}점`, 
                    name === '현재' ? '현재 만족도' : `${comparisonLabel} 만족도`
                  ]}
                />
                <Legend />
                <Bar dataKey="현재" fill="hsl(var(--primary))" name="현재" />
                {hasComparisonData && (
                  <Bar dataKey={comparisonLabel} fill="hsl(var(--muted-foreground))" name={comparisonLabel} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 강사별 상세 리스트 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {instructorStats.map((stat, index) => {
            const previousStat = previousStats.find(prev => prev.instructor_id === stat.instructor_id);
            const hasChange = previousStat && previousStat.avg_satisfaction !== stat.avg_satisfaction;
            const change = hasChange ? stat.avg_satisfaction - previousStat.avg_satisfaction : 0;
            
            return (
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
                    {hasChange && (
                      <div className={`text-xs font-medium ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {change > 0 ? '↗' : '↘'} {Math.abs(change).toFixed(1)}점 {change > 0 ? '상승' : '하락'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary">{stat.avg_satisfaction.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">만족도</div>
                    {previousStat && (
                      <div className="text-xs text-muted-foreground">
                        (이전: {previousStat.avg_satisfaction.toFixed(1)})
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default InstructorStatsSection;
