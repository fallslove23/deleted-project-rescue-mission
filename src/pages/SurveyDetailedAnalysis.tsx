import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { ArrowLeft, Download, Mail, Printer, Loader2, ChevronDown } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TestDataToggle } from '@/components/TestDataToggle';
import { useToast } from '@/hooks/use-toast';
import { useTestDataToggle } from '@/hooks/useTestDataToggle';
import { useSurveyDetailStats } from '@/hooks/useSurveyDetailStats';
import type { SurveyQuestionDistribution } from '@/repositories/surveyDetailRepository';

interface Survey {
  id: string;
  title: string;
  education_year: number;
  education_round: number;
  status: string;
  course_name?: string | null;
  instructor_id?: string | null;
}

interface Instructor {
  id: string;
  name: string;
  email: string;
  photo_url?: string | null;
}

// DB 섹션 원본 타입
interface DbSectionItem {
  id: string;
  name: string | null;
}

// 세션 타입(현재 사용 안 함)
interface SessionItem {
  id: string;
  session_name: string | null;
  instructor_id: string | null;
  course_id: string | null;
  label: string;
}


const RATING_QUESTION_TYPES = new Set(['rating', 'scale']);
const SCORE_RANGE = Array.from({ length: 10 }, (_value, index) => index + 1);
const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

function formatAverage(value: number | null | undefined): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toFixed(1);
  }
  return '-';
}

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return value;
  }
}

const SurveyDetailedAnalysis = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const testDataOptions = useTestDataToggle();
  const {
    summary,
    responses,
    responsesTotal,
    hasMoreResponses,
    responsesLoading,
    loadMoreResponses,
    distributions,
    distributionsTotal,
    hasMoreDistributions,
    distributionsLoading,
    loadMoreDistributions,
    groupedTextAnswers,
    textAnswersTotal,
    hasMoreTextAnswers,
    textAnswersLoading,
    loadMoreTextAnswers,
    initialLoading,
    error,
    refresh,
  } = useSurveyDetailStats({ surveyId, includeTestData: testDataOptions.includeTestData });

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [loadingSurvey, setLoadingSurvey] = useState(true);
  const [sendingResults, setSendingResults] = useState(false);

  // 세션(과목·강사) 드롭다운 및 현재 선택 상태
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isResponsesOpen, setIsResponsesOpen] = useState(false);

  const loadSurvey = useCallback(async () => {
    if (!surveyId) return;

    setLoadingSurvey(true);
    try {
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select('id, title, education_year, education_round, status, course_name, instructor_id')
        .eq('id', surveyId)
        .single();

      if (surveyError) throw surveyError;
      setSurvey(surveyData as Survey);

      if (surveyData?.instructor_id) {
        const { data: instructorData, error: instructorError } = await supabase
          .from('instructors')
          .select('id, name, email, photo_url')
          .eq('id', surveyData.instructor_id)
          .single();

        if (instructorError) throw instructorError;
        setInstructor(instructorData as Instructor);
      } else {
        setInstructor(null);
      }
    } catch (err) {
      console.error('Error loading survey:', err);
      setSurvey(null);
    } finally {
      setLoadingSurvey(false);
    }
  }, [surveyId]);

  // 세션(과목) 목록 불러오기
  const loadSessions = useCallback(async () => {
    if (!surveyId) return;
    try {
      const { data: sessData, error: sessError } = await supabase
        .from('survey_sessions')
        .select('id, session_name, instructor_id, course_id')
        .eq('survey_id', surveyId)
        .order('session_order', { ascending: true });

      if (sessError) throw sessError;
      const raw = (sessData || []).filter((s: any) => s.instructor_id && s.course_id);

      const instructorIds = Array.from(new Set(raw.map((s: any) => s.instructor_id)));
      let nameMap = new Map<string, string>();
      if (instructorIds.length) {
        const { data: instData } = await supabase
          .from('instructors')
          .select('id, name')
          .in('id', instructorIds);
        instData?.forEach((i: any) => nameMap.set(i.id, i.name || ''));
      }

      const mapped: SessionItem[] = raw.map((s: any) => ({
        id: s.id,
        session_name: s.session_name ?? null,
        instructor_id: s.instructor_id ?? null,
        course_id: s.course_id ?? null,
        label: `${nameMap.get(s.instructor_id) ?? ''}${nameMap.get(s.instructor_id) ? ' - ' : ''}${s.session_name ?? ''}`.trim() || '과목',
      }));
      setSessions(mapped);
    } catch (err) {
      console.error('Error loading sessions:', err);
      setSessions([]);
    }
  }, [surveyId]);

  useEffect(() => {
    loadSurvey();
  }, [loadSurvey]);

  // 세션도 함께 로드
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleSendResults = useCallback(async () => {
    if (!surveyId) return;

    setSendingResults(true);
    try {
      const { error: sendError } = await supabase.functions.invoke('send-survey-results', {
        body: { surveyId },
      });

      if (sendError) throw sendError;

      toast({
        title: '전송 완료',
        description: '설문 결과가 이메일로 전송되었습니다.',
      });
    } catch (err) {
      console.error('Error sending results:', err);
      toast({
        title: '전송 실패',
        description: '결과 전송 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setSendingResults(false);
    }
  }, [surveyId, toast]);

  const generateCSV = useCallback(() => {
    if (!survey || !summary) return '';

    let csv = '설문 상세 분석 결과\n';
    csv += `설문명: ${survey.title}\n`;
    csv += `교육년도: ${survey.education_year}년\n`;
    csv += `교육차수: ${survey.education_round}차\n`;
    csv += `총 응답 수: ${summary.responseCount}\n\n`;

    csv += `종합 만족도,${formatAverage(summary.avgOverall)}/10\n`;
    csv += `과목 만족도,${formatAverage(summary.avgCourse)}/10\n`;
    csv += `강사 만족도,${formatAverage(summary.avgInstructor)}/10\n`;
    csv += `운영 만족도,${formatAverage(summary.avgOperation)}/10\n\n`;

    csv += '질문,질문유형,응답수,분석결과\n';
    distributions.forEach((distribution) => {
      const escapedQuestion = distribution.questionText.replace(/"/g, '""');
      const base = `"${escapedQuestion}",${distribution.questionType},${distribution.totalAnswers},`;

      if (RATING_QUESTION_TYPES.has(distribution.questionType)) {
        csv += `${base}"평균: ${formatAverage(distribution.average)}/10"\n`;
      } else if (distribution.optionCounts.length > 0) {
        const top = distribution.optionCounts.reduce(
          (best, option) => (option.count > best.count ? option : best),
          { option: '', count: 0 },
        );
        csv += `${base}"최다 응답: ${top.option} (${top.count}명)"\n`;
      } else {
        const group = groupedTextAnswers.find((item) => item.questionId === distribution.questionId);
        const count = group ? group.answers.length : 0;
        csv += `${base}"텍스트 응답 ${count}개"\n`;
      }
    });

    if (groupedTextAnswers.length > 0) {
      csv += '\n텍스트 응답 요약\n';
      groupedTextAnswers.forEach((group) => {
        const escapedQuestion = group.questionText.replace(/"/g, '""');
        const preview = group.answers
          .slice(0, 5)
          .map((answer) => answer.answerText.replace(/"/g, '""'))
          .join('; ');
        csv += `"${escapedQuestion}",text,${group.answers.length},"${preview}"\n`;
      });
    }

    return csv;
  }, [distributions, groupedTextAnswers, summary, survey]);

  const handleDownload = useCallback(() => {
    const csv = generateCSV();
    if (!csv) return;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `survey_analysis_${survey?.title || 'results'}.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [generateCSV, survey?.title]);

  // 세션 기반 필터링 (질문의 session_id로 필터링)
  const filteredDistributions = useMemo(() => {
    if (activeTab === 'all') return distributions;
    
    return distributions.filter((d) => d.sessionId === activeTab);
  }, [activeTab, distributions]);

  // 선택된 세션에 따라 요약 통계도 필터링
  const filteredSummary = useMemo(() => {
    if (!summary || activeTab === 'all') return summary;
    
    // 선택된 세션의 질문들만 가져와서 평균 계산
    const sessionDists = distributions.filter((d) => d.sessionId === activeTab);
    const responseCount = sessionDists.reduce((acc, d) => acc + d.totalAnswers, 0);

    const avg = (arr: typeof sessionDists, type?: string | null) => {
      const items = type ? arr.filter((d) => d.satisfactionType === type) : arr;
      if (items.length === 0) return null;
      return items.reduce((acc, d) => acc + (d.average || 0), 0) / items.length;
    };
    
    return {
      ...summary,
      responseCount,
      avgOverall: avg(sessionDists),
      avgCourse: avg(sessionDists, 'course'),
      avgInstructor: avg(sessionDists, 'instructor'),
      avgOperation: avg(sessionDists, 'operation'),
    };
  }, [activeTab, summary, distributions]);

  const filteredResponses = useMemo(
    () => (activeTab === 'all' ? responses : responses.filter((r) => r.sessionId === activeTab)),
    [responses, activeTab],
  );

  const filteredTextAnswers = useMemo(() => {
    if (activeTab === 'all') return groupedTextAnswers;
    
    // 선택된 세션의 질문들에 대한 텍스트 답변만 필터링
    return groupedTextAnswers
      .map((g) => ({
        ...g,
        answers: g.answers.filter((a) => a.sessionId === activeTab),
      }))
      .filter((g) => g.answers.length > 0);
  }, [activeTab, groupedTextAnswers]);

  const ratingDistributions = useMemo(
    () => filteredDistributions.filter((item) => RATING_QUESTION_TYPES.has(item.questionType)),
    [filteredDistributions],
  );

  const choiceDistributions = useMemo(
    () =>
      filteredDistributions.filter(
        (item) => !RATING_QUESTION_TYPES.has(item.questionType) && item.optionCounts.length > 0,
      ),
    [filteredDistributions],
  );

  const otherQuestions = useMemo(
    () =>
      filteredDistributions.filter(
        (item) => !RATING_QUESTION_TYPES.has(item.questionType) && item.optionCounts.length === 0,
      ),
    [filteredDistributions],
  );

  if (!surveyId) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">유효한 설문 ID가 제공되지 않았습니다.</p>
      </div>
    );
  }

  if (loadingSurvey) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">설문을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const handleNavigateBack = () => {
    const from = (location.state as { from?: string } | undefined)?.from;
    if (from === 'survey-management') {
      navigate('/surveys-v2');
    } else {
      navigate('/dashboard/results');
    }
  };

  const renderSummaryCard = (title: string, value: string) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {value !== '-' && (
          <Progress value={Number(value) * 10} className="mt-2" />
        )}
      </CardContent>
    </Card>
  );

  const renderRatingChart = (distribution: SurveyQuestionDistribution) => {
    const values = distribution.ratingDistribution;
    const total = SCORE_RANGE.reduce((acc, score) => acc + (values[score] ?? 0), 0);
    const chartData = SCORE_RANGE.map((score) => ({
      name: `${score}점`,
      value: values[score] ?? 0,
      percentage: total > 0 ? Math.round(((values[score] ?? 0) / total) * 100) : 0,
    }));

    return (
      <div className="w-full">
        <ResponsiveContainer width="100%" height={200}>
          <RechartsBarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip
              formatter={(value: number | string, _name, props) => {
                const percentage = props?.payload?.percentage ?? 0;
                return [`${value}개 (${percentage}%)`, '응답 수'];
              }}
            />
            <Bar dataKey="value" fill="hsl(var(--chart-1))" />
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderChoiceChart = (distribution: SurveyQuestionDistribution) => {
    const total = distribution.optionCounts.reduce((acc, item) => acc + item.count, 0);
    const chartData = distribution.optionCounts.map((item) => ({
      name: item.option,
      value: item.count,
      percentage: total > 0 ? Math.round((item.count / total) * 100) : 0,
    }));

    return (
      <div className="w-full">
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percentage }) => `${name} (${percentage}%)`}
              outerRadius={100}
              dataKey="value"
            >
              {chartData.map((_entry, index) => (
                <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value, name) => [`${value}개`, name]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Button onClick={handleNavigateBack} variant="ghost" size="sm" className="touch-friendly">
            <ArrowLeft className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">뒤로가기</span>
          </Button>
          <div className="text-center">
            <h1 className="text-sm font-semibold text-primary sm:text-lg">상세 분석</h1>
            <p className="line-clamp-2 text-xs text-muted-foreground sm:text-sm">{survey.title}</p>
          </div>
          <div className="w-16" aria-hidden />
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-4 py-6">
        {testDataOptions.canToggleTestData && (
          <div className="flex justify-end">
            <TestDataToggle testDataOptions={testDataOptions} />
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <CardTitle className="break-words text-xl">{survey.title}</CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant={survey.status === 'active' ? 'default' : 'secondary'}>
                    {survey.status === 'active' ? '진행중' : survey.status === 'completed' ? '완료' : '초안'}
                  </Badge>
                  <span>
                    {survey.education_year}년 {survey.education_round}차
                  </span>
                  {survey.course_name && <span>{survey.course_name}</span>}
                </div>
                {instructor && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {instructor.photo_url && (
                      <img
                        src={instructor.photo_url}
                        alt={instructor.name}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    )}
                    <span>
                      강사: {instructor.name}
                      {instructor.email ? ` (${instructor.email})` : ''}
                    </span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">
                  {summary ? summary.responseCount : '-'}
                </div>
                <div className="text-sm text-muted-foreground">총 응답</div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSendResults} size="sm" disabled={sendingResults}>
            {sendingResults ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                전송 중...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" /> 결과 전송
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!summary}>
            <Download className="mr-2 h-4 w-4" /> 엑셀 다운로드
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> 인쇄
          </Button>
          <Button variant="outline" size="sm" onClick={refresh} disabled={initialLoading}>
            {initialLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 새로고침 중
              </>
            ) : (
              '새로고침'
            )}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mb-6">
          <label htmlFor="section-select" className="block text-sm font-medium mb-2">
            과목별 필터
          </label>
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent className="z-50 bg-background border shadow-lg">
              <SelectItem value="all">전체</SelectItem>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">요약 통계</h2>
          {initialLoading && !filteredSummary ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {renderSummaryCard('종합 만족도', formatAverage(filteredSummary?.avgOverall))}
              {renderSummaryCard('과목 만족도', formatAverage(filteredSummary?.avgCourse))}
              {renderSummaryCard('강사 만족도', formatAverage(filteredSummary?.avgInstructor))}
              {renderSummaryCard('운영 만족도', formatAverage(filteredSummary?.avgOperation))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">평가형 문항 분석</h2>
            <span className="text-sm text-muted-foreground">
              {ratingDistributions.length} {activeTab === 'all' ? `/ ${distributionsTotal} 문항` : '문항'}
            </span>
          </div>
          {initialLoading && ratingDistributions.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : ratingDistributions.length === 0 ? (
            <p className="text-sm text-muted-foreground">평가형 문항이 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {ratingDistributions.map((distribution) => (
                <Card key={distribution.questionId}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{distribution.questionText}</CardTitle>
                      {distribution.satisfactionType && (
                        <Badge variant="outline" className="text-xs uppercase">
                          {distribution.satisfactionType}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div className="text-3xl font-bold text-primary">
                        {formatAverage(distribution.average)} / 10
                      </div>
                      <div className="text-sm text-muted-foreground">
                        총 {distribution.totalAnswers}개 응답
                      </div>
                    </div>
                    {renderRatingChart(distribution)}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {hasMoreDistributions && (
            <div className="flex justify-center">
              <Button
                onClick={loadMoreDistributions}
                variant="outline"
                disabled={distributionsLoading}
              >
                {distributionsLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 불러오는 중...
                  </>
                ) : (
                  '더 보기'
                )}
              </Button>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">선택형 문항 분포</h2>
            <span className="text-sm text-muted-foreground">
              {choiceDistributions.length} {activeTab === 'all' ? `/ ${distributionsTotal} 문항` : '문항'}
            </span>
          </div>
          {initialLoading && choiceDistributions.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : choiceDistributions.length === 0 ? (
            <p className="text-sm text-muted-foreground">선택형 문항이 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {choiceDistributions.map((distribution) => (
                <Card key={distribution.questionId}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{distribution.questionText}</CardTitle>
                      {distribution.satisfactionType && (
                        <Badge variant="outline" className="text-xs uppercase">
                          {distribution.satisfactionType}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      총 {distribution.totalAnswers}개 응답
                    </div>
                    {renderChoiceChart(distribution)}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {otherQuestions.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">기타 문항</h2>
            <div className="space-y-4">
              {otherQuestions.map((question) => (
                <Card key={question.questionId}>
                  <CardHeader>
                    <CardTitle className="text-base">{question.questionText}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      해당 문항은 별도의 통계가 제공되지 않습니다. 텍스트 응답 섹션을 확인하세요.
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">텍스트 응답</h2>
            <span className="text-sm text-muted-foreground">
              {filteredTextAnswers.length}개의 문항 / {filteredTextAnswers.reduce((acc, g) => acc + g.answers.length, 0)}개 응답
            </span>
          </div>
          {initialLoading && filteredTextAnswers.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTextAnswers.length === 0 ? (
            <p className="text-sm text-muted-foreground">텍스트 응답이 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {filteredTextAnswers.map((group) => (
                <Card key={group.questionId}>
                  <CardHeader>
                    <CardTitle className="text-base">{group.questionText}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-2 text-sm text-muted-foreground">
                      총 {group.answers.length}개 응답
                    </div>
                    <div className="max-h-64 space-y-2 overflow-y-auto">
                      {group.answers.map((answer) => (
                        <div key={answer.answerId} className="rounded border bg-muted/50 p-2 text-sm">
                          {answer.answerText}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {hasMoreTextAnswers && (
            <div className="flex justify-center">
              <Button
                onClick={loadMoreTextAnswers}
                variant="outline"
                disabled={textAnswersLoading}
              >
                {textAnswersLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 불러오는 중...
                  </>
                ) : (
                  '더 보기'
                )}
              </Button>
            </div>
          )}
        </section>

        <Collapsible open={isResponsesOpen} onOpenChange={setIsResponsesOpen}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto text-lg font-semibold hover:bg-transparent">
                <h2>응답 목록</h2>
                <ChevronDown className={`h-4 w-4 transition-transform ${isResponsesOpen ? 'rotate-180' : ''}`} />
                <span className="text-sm text-muted-foreground font-normal">
                  {responses.length} / {responsesTotal} 응답
                </span>
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="space-y-4 mt-4">
            {initialLoading && responses.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : responses.length === 0 ? (
              <p className="text-sm text-muted-foreground">등록된 응답이 없습니다.</p>
            ) : (
              <Card>
                <CardContent className="overflow-x-auto p-0">
                  <table className="min-w-full divide-y divide-border text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">응답 ID</th>
                        <th className="px-4 py-3 text-left font-medium">제출일</th>
                        <th className="px-4 py-3 text-left font-medium">이메일</th>
                        <th className="px-4 py-3 text-left font-medium">세션</th>
                        <th className="px-4 py-3 text-left font-medium">테스트</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {responses.map((response) => (
                        <tr key={response.id}>
                          <td className="px-4 py-3 font-mono text-xs sm:text-sm">{response.id}</td>
                          <td className="px-4 py-3">{formatDateTime(response.submittedAt)}</td>
                          <td className="px-4 py-3">{response.respondentEmail ?? '-'}</td>
                          <td className="px-4 py-3">{response.sessionId ?? '-'}</td>
                          <td className="px-4 py-3">
                            {response.isTest ? (
                              <Badge variant="outline" className="text-xs text-orange-600">테스트</Badge>
                            ) : (
                              <span className="text-muted-foreground">실제</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
            {hasMoreResponses && (
              <div className="flex justify-center">
                <Button onClick={loadMoreResponses} variant="outline" disabled={responsesLoading}>
                  {responsesLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 불러오는 중...
                    </>
                  ) : (
                    '더 보기'
                  )}
                </Button>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </main>
    </div>
  );
};

export default SurveyDetailedAnalysis;
