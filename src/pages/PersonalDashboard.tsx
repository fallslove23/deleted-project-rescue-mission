import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Users, TrendingUp, Award, BarChart3, Download, Eye } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useInstructorStats } from '@/hooks/useInstructorStats';
import { useTestDataToggle } from '@/hooks/useTestDataToggle';
import { TestDataToggle } from '@/components/TestDataToggle';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ChartEmptyState } from '@/components/charts';
import {
  getCombinedRecordMetrics,
  type AggregatedQuestion,
  type SummaryMetrics,
  type TrendPoint,
} from '@/utils/surveyStats';

interface Profile {
  role: string;
  instructor_id: string | null;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];

// Personal dashboard component for instructor statistics
const PersonalDashboard: FC = () => {
  const location = useLocation();
  const { user, userRoles } = useAuth();
  const { toast } = useToast();
  const testDataOptions = useTestDataToggle();

  const searchParams = new URLSearchParams(location.search);
  const viewAs = searchParams.get('viewAs');
  const previewInstructorId = searchParams.get('instructorId');
  const previewInstructorEmail = searchParams.get('instructorEmail');

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [previewResolvedInstructorId, setPreviewResolvedInstructorId] = useState<string | null>(previewInstructorId);

  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');

  const isInstructor = userRoles.includes('instructor');
  const isPreviewingInstructor = viewAs === 'instructor';
  const asInstructor = isInstructor || isPreviewingInstructor;
  const canViewPersonalStats = asInstructor || userRoles.includes('admin');

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, instructor_id')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      setProfile(data as Profile | null);
    } catch (error) {
      console.error('프로필 조회 오류:', error);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (!isPreviewingInstructor) {
      setPreviewResolvedInstructorId(previewInstructorId);
      return;
    }

    if (previewInstructorId) {
      setPreviewResolvedInstructorId(previewInstructorId);
      return;
    }

    if (!previewInstructorEmail) return;

    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('instructors')
          .select('id')
          .eq('email', previewInstructorEmail)
          .maybeSingle();

        if (!active) return;
        if (error) throw error;
        setPreviewResolvedInstructorId(data?.id ?? null);
      } catch (error) {
        console.error('미리보기 강사 조회 오류:', error);
        if (active) setPreviewResolvedInstructorId(null);
      }
    })();

    return () => {
      active = false;
    };
  }, [isPreviewingInstructor, previewInstructorEmail, previewInstructorId]);

  useEffect(() => {
    if (!user || !isInstructor || profile?.instructor_id || !user.email) return;

    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('instructors')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();

        if (!active) return;

        if (data?.id) {
          setProfile(prev => (prev ? { ...prev, instructor_id: data.id } : { role: 'instructor', instructor_id: data.id }));
          await supabase.from('profiles').update({ instructor_id: data.id }).eq('id', user.id);
        }
      } catch (error) {
        console.error('강사 ID 매핑 오류:', error);
      }
    })();

    return () => {
      active = false;
    };
  }, [isInstructor, profile?.instructor_id, user]);

  const instructorId = useMemo(() => {
    if (isPreviewingInstructor) {
      return previewResolvedInstructorId;
    }
    return profile?.instructor_id ?? null;
  }, [isPreviewingInstructor, previewResolvedInstructorId, profile?.instructor_id]);

  const filters = useMemo(() => ({
    year: selectedYear === 'all' ? 'all' as const : Number(selectedYear),
    round: 'all' as const,
    course: selectedCourse,
  }), [selectedYear, selectedCourse]);

  const stats = useInstructorStats({
    instructorId: instructorId ?? undefined,
    includeTestData: testDataOptions.includeTestData,
    filters,
    enabled: canViewPersonalStats && Boolean(instructorId),
  });

  const loading = profileLoading || stats.loading;
  const hasData = stats.hasData;
  const usingTestData = useMemo(() => {
    if (!testDataOptions.includeTestData) return false;
    return stats.filteredRecords.some(record => getCombinedRecordMetrics(record, true).source === 'test');
  }, [stats.filteredRecords, testDataOptions.includeTestData]);

  const handleDownload = useCallback(() => {
    const csvContent = generatePersonalStatsCSV(stats.summary, stats.trend);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `개인통계_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    toast({ title: '다운로드 완료', description: '개인 통계 CSV 파일이 다운로드되었습니다.' });
  }, [stats.summary, stats.trend, toast]);

  return (
    <div className="space-y-6">
      {isPreviewingInstructor && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4 flex items-center gap-2 text-sm text-orange-700">
            <Eye className="h-4 w-4" />
            <span>강사 페이지 미리보기 모드</span>
            {previewInstructorEmail && <Badge variant="outline">{previewInstructorEmail}</Badge>}
            {previewResolvedInstructorId && (
              <Badge variant="secondary" className="ml-2">
                ID: {previewResolvedInstructorId}
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">나의 만족도 통계</h1>
          <p className="text-muted-foreground text-sm">
            강의 만족도, 응답 추이, 주요 피드백을 한눈에 확인하세요.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <TestDataToggle testDataOptions={testDataOptions} className="sm:mr-4" />
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            disabled={!hasData}
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
            CSV 다운로드
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>조회 조건</CardTitle>
          <CardDescription>
            선택한 연도, 과정을 기준으로 집계된 통계를 확인합니다.
            {usingTestData && (
              <Badge variant="secondary" className="ml-2">
                테스트 데이터 포함
              </Badge>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">연도</p>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="연도 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {stats.availableYears.map(year => (
                    <SelectItem key={year} value={String(year)}>
                      {year}년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">과정</p>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger>
                  <SelectValue placeholder="과정 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {stats.availableCourses.map(course => (
                    <SelectItem key={course} value={course}>
                      {course}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!canViewPersonalStats ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Users className="mx-auto mb-4 h-12 w-12" />
            개인 통계를 조회할 권한이 없습니다.
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent className="py-16">
            <ChartEmptyState description="데이터를 불러오는 중입니다." />
          </CardContent>
        </Card>
      ) : stats.error ? (
        <Card>
          <CardContent className="py-16">
            <ChartEmptyState description="집계 데이터를 불러오지 못했습니다." actions={stats.error} />
          </CardContent>
        </Card>
      ) : !instructorId ? (
        <Card>
          <CardContent className="py-16">
            <ChartEmptyState description="강사 정보가 확인되지 않았습니다." />
          </CardContent>
        </Card>
      ) : !hasData ? (
        <Card>
          <CardContent className="py-16">
            <ChartEmptyState description="표시할 데이터가 없습니다." />
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">요약</TabsTrigger>
            <TabsTrigger value="distribution">응답 분포</TabsTrigger>
            <TabsTrigger value="insights">질문 분석</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              <SummaryCard icon={<BarChart3 className="h-4 w-4 text-primary" />} label="총 설문" value={stats.summary.totalSurveys} />
              <SummaryCard icon={<Users className="h-4 w-4 text-blue-500" />} label="총 응답" value={stats.summary.totalResponses} />
              <SummaryCard
                icon={<TrendingUp className="h-4 w-4 text-green-500" />}
                label="평균 만족도"
                value={`${stats.summary.avgSatisfaction.toFixed(1)}점`}
                extra={<Badge variant="secondary">{stats.summary.satisfactionPercentage}%</Badge>}
              />
              <SummaryCard icon={<Award className="h-4 w-4 text-amber-500" />} label="활성 설문" value={stats.summary.activeSurveys} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>응답 추이</CardTitle>
                <CardDescription>기간별 평균 만족도와 응답 수를 확인하세요.</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.trend.length === 0 ? (
                  <ChartEmptyState description="추세를 계산할 데이터가 없습니다." />
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.trend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis yAxisId="left" domain={[0, 10]} tickFormatter={value => `${value}점`} />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip formatter={(value: number) => value.toLocaleString()} />
                        <Line yAxisId="left" type="monotone" dataKey="average" name="평균 만족도" stroke="#2563eb" strokeWidth={2} />
                        <Line yAxisId="right" type="monotone" dataKey="responses" name="응답 수" stroke="#10b981" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>과정별 만족도</CardTitle>
                <CardDescription>응답이 수집된 과정의 평균 만족도를 비교합니다.</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.courseBreakdown.length === 0 ? (
                  <ChartEmptyState description="과정별 데이터를 계산할 수 없습니다." />
                ) : (
                  <div className="space-y-3">
                    {stats.courseBreakdown.map(course => (
                      <div key={course.course} className="rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">{course.course}</h4>
                          <Badge variant={course.avgSatisfaction >= 8 ? 'default' : 'secondary'}>
                            {course.avgSatisfaction.toFixed(1)}점
                          </Badge>
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                          <div className="flex justify-between">
                            <span>응답 수</span>
                            <span>{course.responses.toLocaleString()}명</span>
                          </div>
                          <div className="flex justify-between">
                            <span>설문 수</span>
                            <span>{course.surveys.toLocaleString()}개</span>
                          </div>
                          <Progress value={course.satisfactionPercentage} className="h-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="distribution" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>평점 분포</CardTitle>
                <CardDescription>응답자들이 남긴 평점 범위를 확인하세요.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-2">
                {stats.ratingDistribution.every(bucket => bucket.value === 0) ? (
                  <ChartEmptyState description="평점 분포를 계산할 데이터가 없습니다." />
                ) : (
                  <>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={stats.ratingDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                            {stats.ratingDistribution.map((entry, index) => (
                              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-3">
                      {stats.ratingDistribution.map(entry => (
                        <div key={entry.name} className="space-y-2">
                          <div className="flex justify-between text-sm font-medium">
                            <span>{entry.name}</span>
                            <span>
                              {entry.value.toLocaleString()} ({entry.percentage}%)
                            </span>
                          </div>
                          <Progress value={entry.percentage} className="h-2" />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>카테고리 요약</CardTitle>
                <CardDescription>만족도 영역별 평균 점수를 비교하세요.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <CategoryCard title="과정 만족도" average={stats.questionInsights.categories.subject.average} count={stats.questionInsights.categories.subject.questions.length} />
                <CategoryCard title="강사 만족도" average={stats.questionInsights.categories.instructor.average} count={stats.questionInsights.categories.instructor.questions.length} />
                <CategoryCard title="운영 만족도" average={stats.questionInsights.categories.operation.average} count={stats.questionInsights.categories.operation.questions.length} />
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              {stats.questionInsights.questions.map((question, index) => (
                <QuestionAnalysisCard key={`${question.questionId}-${index}`} question={question} />
              ))}
            </div>

            {stats.questionInsights.textResponses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>자유 서술형 피드백</CardTitle>
                  <CardDescription>최근 수집된 의견을 확인하세요.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {stats.questionInsights.textResponses.slice(0, 10).map((text, index) => (
                    <div key={`${text}-${index}`} className="rounded-lg border p-3 text-sm">
                      {text}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

interface SummaryCardProps {
  icon: JSX.Element;
  label: string;
  value: string | number;
  extra?: JSX.Element;
}

const SummaryCard = ({ icon, label, value, extra }: SummaryCardProps) => (
  <Card>
    <CardContent className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
      <div className="rounded-lg bg-muted p-2">{icon}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
      {extra}
    </CardContent>
  </Card>
);

interface CategoryCardProps {
  title: string;
  average: number | null;
  count: number;
}

const CategoryCard = ({ title, average, count }: CategoryCardProps) => (
  <div className="rounded-lg border p-4 text-center">
    <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
    <div className="mt-2 text-2xl font-bold">{average !== null ? average.toFixed(1) : '0.0'}</div>
    <div className="text-xs text-muted-foreground">질문 {count}개</div>
  </div>
);

const QuestionAnalysisCard = ({ question }: { question: AggregatedQuestion }) => {
  const isRating = question.questionType === 'rating' || question.questionType === 'scale';
  const totalResponses = Object.values(question.ratingDistribution).reduce((sum, value) => sum + value, 0);
  const textAnswers = question.textAnswers.slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{question.questionText}</CardTitle>
        <CardDescription>
          총 응답 {question.totalAnswers.toLocaleString()}개
          {question.average !== null && isRating && (
            <span className="ml-2 font-semibold text-primary">{question.average.toFixed(1)}점</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isRating ? (
          totalResponses === 0 ? (
            <ChartEmptyState description="평점 데이터를 확인할 수 없습니다." />
          ) : (
            <div className="space-y-3">
              {Array.from({ length: 10 }, (_v, index) => index + 1).map(score => {
                const value = question.ratingDistribution[score] ?? 0;
                const percentage = totalResponses > 0 ? Math.round((value / totalResponses) * 100) : 0;
                return (
                  <div key={score} className="flex items-center gap-3 text-sm">
                    <span className="w-12 font-medium">{score}점</span>
                    <Progress value={percentage} className="h-2 flex-1" />
                    <span className="w-16 text-right text-muted-foreground">
                      {value.toLocaleString()} ({percentage}%)
                    </span>
                  </div>
                );
              })}
            </div>
          )
        ) : textAnswers.length > 0 ? (
          <div className="space-y-2 text-sm">
            {textAnswers.map((answer, index) => (
              <div key={`${answer}-${index}`} className="rounded border p-3">
                {answer}
              </div>
            ))}
          </div>
        ) : (
          <ChartEmptyState description="표시할 서술형 응답이 없습니다." />
        )}
      </CardContent>
    </Card>
  );
};

function generatePersonalStatsCSV(summary: SummaryMetrics, trend: TrendPoint[]) {
  let csv = '개인 통계 요약\n';
  csv += `총 설문,${summary.totalSurveys}\n`;
  csv += `총 응답,${summary.totalResponses}\n`;
  csv += `활성 설문,${summary.activeSurveys}\n`;
  csv += `평균 만족도,${summary.avgSatisfaction.toFixed(1)}\n`;
  csv += `만족도 백분율,${summary.satisfactionPercentage}%\n`;
  csv += `설문당 평균 응답,${summary.avgResponsesPerSurvey}\n\n`;
  csv += '기간별 트렌드\n';
  csv += '기간,평균 만족도,응답 수,만족도(%)\n';
  trend.forEach(point => {
    csv += `${point.period},${point.average.toFixed(1)},${point.responses},${point.satisfaction}\n`;
  });
  return csv;
}

export default PersonalDashboard;
