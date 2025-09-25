import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, BarChart3, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { ChartErrorBoundary } from '@/components/charts/ChartErrorBoundary';

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
  // Vertical Bar Chart용 데이터 준비 (현재 차수와 이전 차수 비교)
  const verticalChartData = instructorStats
    .filter((stat) => !isNaN(stat.avg_satisfaction) && stat.avg_satisfaction > 0) // NaN과 0 값 필터링
    .sort((a, b) => b.avg_satisfaction - a.avg_satisfaction)
    .map((stat) => {
      const previousStat = previousStats.find(prev => prev.instructor_id === stat.instructor_id);
      const displayName = stat.instructor_name.length > 6 ? stat.instructor_name.substring(0, 5) + '...' : stat.instructor_name;
      
      return {
        name: displayName,
        현재차수: Number(stat.avg_satisfaction.toFixed(1)),
        이전차수: previousStat ? Number(previousStat.avg_satisfaction.toFixed(1)) : 0,
        응답수: stat.response_count,
        설문수: stat.survey_count,
        full_name: stat.instructor_name,
        instructor_id: stat.instructor_id
      };
    });

  const hasComparisonData = previousStats.length > 0;

  // 만족도 구간별 색상 설정 (10점 만점 기준)
  const getBarColor = (satisfaction: number) => {
    if (satisfaction >= 8.0) return 'hsl(142, 71%, 45%)'; // 우수
    if (satisfaction >= 6.0) return 'hsl(47, 96%, 53%)';  // 보통
    return 'hsl(346, 87%, 43%)'; // 개선 필요
  };

  return (
    <div className="space-y-6">
      {/* 섹션 헤더 강화 */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg p-6 border-l-4 border-primary">
        <h2 className="text-xl font-bold text-primary mb-2 flex items-center gap-2">
          <Users className="h-6 w-6" />
          강사별 만족도 통계
        </h2>
        <p className="text-muted-foreground">
          각 강사별 평균 만족도와 응답 현황을 비교 분석합니다
        </p>
      </div>

      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            강사별 만족도 현황 (10점 만점)
          </CardTitle>
          <CardDescription>
            {hasComparisonData 
              ? '현재 차수와 이전 차수의 강사별 만족도를 비교할 수 있습니다' 
              : '강사별 만족도 현황을 세로 막대그래프로 확인할 수 있습니다'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {instructorStats.length > 0 ? (
            <ChartErrorBoundary fallbackDescription="강사 통계 차트를 표시하는 중 오류가 발생했습니다.">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart 
                  data={verticalChartData} 
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11 }}
                    height={60}
                    interval={0}
                  />
                  <YAxis 
                    domain={[0, 10]}
                    tick={{ fontSize: 12 }}
                    label={{ value: '만족도 (점)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      `${value}점`, 
                      name === '현재차수' ? '현재 차수' : name === '이전차수' ? comparisonLabel : name
                    ]}
                    labelFormatter={(label: string, payload: any) => {
                      const data = payload?.[0]?.payload;
                      return `강사: ${data?.full_name || label}`;
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="현재차수" 
                    name="현재 차수"
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                  {hasComparisonData && (
                    <Bar 
                      dataKey="이전차수" 
                      name={comparisonLabel}
                      fill="hsl(var(--muted-foreground))" 
                      radius={[4, 4, 0, 0]}
                      opacity={0.7}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </ChartErrorBoundary>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              표시할 강사 데이터가 없습니다.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 강사별 상세 카드 */}
      <Card>
        <CardHeader>
          <CardTitle>상세 통계</CardTitle>
          <CardDescription>
            각 강사의 설문 수행 현황과 만족도 세부사항
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {instructorStats.map((stat) => {
              const previousStat = previousStats.find(prev => prev.instructor_id === stat.instructor_id);
              const hasChange = previousStat && previousStat.avg_satisfaction !== stat.avg_satisfaction;
              const change = hasChange ? stat.avg_satisfaction - previousStat.avg_satisfaction : 0;
              
              return (
                <div 
                  key={stat.instructor_id}
                  className="p-4 rounded-lg border-2 bg-gradient-to-br from-background to-muted/20 hover:shadow-md transition-all cursor-pointer hover:border-primary/50"
                  onClick={() => onInstructorClick(stat.instructor_id)}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-primary">
                      {stat.instructor_name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">{stat.instructor_name}</h4>
                      <div className="text-xs text-muted-foreground">
                        강사 상세 정보
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">평균 만족도</span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-primary">
                          {!isNaN(stat.avg_satisfaction) ? stat.avg_satisfaction.toFixed(1) : '0.0'}점
                        </span>
                        {hasChange && (
                          <span className={`text-xs font-medium ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {change > 0 ? '↗' : '↘'} {Math.abs(change).toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">설문 수</span>
                      <span className="font-medium">{stat.survey_count}개</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">총 응답 수</span>
                      <span className="font-medium">{stat.response_count}개</span>
                    </div>

                    {previousStat && (
                      <div className="pt-2 border-t border-border">
                        <div className="text-xs text-muted-foreground">
                          이전 기간: {!isNaN(previousStat.avg_satisfaction) ? previousStat.avg_satisfaction.toFixed(1) : '0.0'}점
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InstructorStatsSection;