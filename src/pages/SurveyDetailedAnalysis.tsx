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
import { SurveyDetailRepository } from '@/repositories/surveyDetailRepository';
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

interface Survey {
  id: string;
  title: string;
  education_year: number;
  education_round: number;
  status: string;
  course_name?: string | null;
  instructor_id?: string | null;
  operator_name?: string | null;
  operator_contact?: string | null;
}

interface Instructor {
  id: string;
  name: string;
  email: string;
  photo_url?: string | null;
}

// 강사별 필터 옵션
interface InstructorOption {
  key: string;
  label: string;
  instructorId: string;
  courseName?: string;
}

// 과목(강사+세션명에서 Part/세부 평가명을 제거한 그룹) 옵션
interface SubjectOption {
  key: string;        // 드롭다운 value
  label: string;      // 표시용 "강사 - 과목"
  sessionIds: string[]; // 이 과목에 속하는 세션 ID들(Part.1/2 등 포함)
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

function formatSatisfactionType(type: string | null): string {
  if (!type) return '';
  
  switch (type.toLowerCase()) {
    case 'instructor':
      return '강사';
    case 'course':
      return '과목';
    case 'operation':
      return '운영';
    default:
      return type.toUpperCase();
  }
}

const SurveyDetailedAnalysis = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const testDataOptions = useTestDataToggle();
  
  // 데이터 상태
  const [detailStats, setDetailStats] = useState<any>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [loadingSurvey, setLoadingSurvey] = useState(true);
  const [sendingResults, setSendingResults] = useState(false);

  // 강사별/과목별 필터링 상태
  const [instructorOptions, setInstructorOptions] = useState<InstructorOption[]>([]);
  const [activeInstructor, setActiveInstructor] = useState<string>('all');
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isResponsesOpen, setIsResponsesOpen] = useState(false);

  const loadSurvey = useCallback(async () => {
    if (!surveyId) return;

    setLoadingSurvey(true);
    try {
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select('id, title, education_year, education_round, status, course_name, instructor_id, operator_name, operator_contact')
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

  // 강사별 옵션 로드
  const loadInstructorOptions = useCallback(async () => {
    if (!surveyId) return;
    try {
      // 해당 설문의 질문들에서 고유한 강사 정보 추출
      const { data: questionsData, error: questionsError } = await supabase
        .from('survey_questions')
        .select(`
          session_id,
          satisfaction_type,
          survey_sessions!inner(instructor_id, session_name)
        `)
        .eq('survey_id', surveyId);

      if (questionsError) throw questionsError;

      const uniqueInstructors = new Set<string>();
      const instructorMap = new Map<string, { name: string; course: string }>();

      for (const question of questionsData || []) {
        if ((question as any).survey_sessions?.instructor_id) {
          uniqueInstructors.add((question as any).survey_sessions.instructor_id);
        }
      }

      if (uniqueInstructors.size > 0) {
        const { data: instructorsData } = await supabase
          .from('instructors')
          .select('id, name')
          .in('id', Array.from(uniqueInstructors));

        instructorsData?.forEach((inst: any) => {
          const sessionName = (questionsData as any)?.find((q: any) => 
            q.survey_sessions?.instructor_id === inst.id
          )?.survey_sessions?.session_name || '';
          
          instructorMap.set(inst.id, {
            name: inst.name,
            course: sessionName
          });
        });
      }

      const options: InstructorOption[] = Array.from(instructorMap.entries()).map(([id, info]) => ({
        key: id,
        label: `${info.name} - ${info.course}`,
        instructorId: id,
        courseName: info.course,
      }));

      setInstructorOptions(options);
    } catch (err) {
      console.error('Error loading instructor options:', err);
      setInstructorOptions([]);
    }
  }, [surveyId]);

  // 과목(강사-과목) 옵션 로드
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

      // 세션명을 과목 단위로 정규화
      const toBase = (name: string | null): string => {
        if (!name) return '';
        let s = name.replace(/\s*-\s*Part\.?\s*\d+.*/i, '');
        s = s.replace(/\s*-\s*(교육|강의|운영).*/i, '');
        return s.trim();
      };

      const group = new Map<string, string[]>();
      raw.forEach((s: any) => {
        const instr = nameMap.get(s.instructor_id) ?? '';
        const base = toBase(s.session_name ?? '');
        let label = '';
        if (base.includes('운영') && survey?.operator_name) {
          label = `${survey.operator_name} - 운영 만족도`;
        } else {
          label = (instr ? `${instr} - ${base}` : base) || '과목';
        }
        const arr = group.get(label) ?? [];
        arr.push(s.id);
        group.set(label, arr);
      });

      const options: SubjectOption[] = Array.from(group.entries()).map(([label, ids]) => ({
        key: label,
        label,
        sessionIds: ids,
      }));

      setSubjectOptions(options);
    } catch (err) {
      console.error('Error loading sessions:', err);
      setSubjectOptions([]);
    }
  }, [surveyId, survey?.operator_name]);

  // 설문 상세 분석 데이터 로드
  const loadDetailStats = useCallback(async () => {
    if (!surveyId || !testDataOptions) return;
    
    setInitialLoading(true);
    setError(null);
    
    try {
      const stats = await SurveyDetailRepository.fetchSurveyDetailStats({
        surveyId,
        includeTestData: testDataOptions.includeTestData,
        responseLimit: 100,
        distributionLimit: 50,
        textLimit: 100,
      });
      
      setDetailStats(stats);
    } catch (err) {
      console.error('Error loading detail stats:', err);
      setError('분석 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setInitialLoading(false);
    }
  }, [surveyId, testDataOptions?.includeTestData]);

  useEffect(() => {
    if (surveyId) {
      loadSurvey();
    }
  }, [surveyId]);

  useEffect(() => {
    if (surveyId) {
      loadInstructorOptions();
      loadSessions();
    }
  }, [surveyId, loadInstructorOptions, loadSessions]);

  useEffect(() => {
    if (surveyId && testDataOptions?.includeTestData !== undefined) {
      loadDetailStats();
    }
  }, [surveyId, testDataOptions?.includeTestData]);

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
    if (!survey || !detailStats) return '';

    let csv = '설문 상세 분석 결과\n';
    csv += `설문명: ${survey.title}\n`;
    csv += `교육년도: ${survey.education_year}년\n`;
    csv += `교육차수: ${survey.education_round}차\n`;
    csv += `총 응답 수: ${detailStats.summary.responseCount}\n\n`;

    csv += `전체 만족도,${formatAverage(detailStats.summary.avgOverall)}/10\n`;
    csv += `과목 만족도,${formatAverage(detailStats.summary.avgCourse)}/10\n`;
    csv += `강사 만족도,${formatAverage(detailStats.summary.avgInstructor)}/10\n`;
    csv += `운영 만족도,${formatAverage(detailStats.summary.avgOperation)}/10\n\n`;

    if (detailStats.textAnswers.items.length > 0) {
      csv += '피드백 내용\n';
      detailStats.textAnswers.items.forEach((answer: any, index: number) => {
        csv += `${index + 1},"${answer.answerText.replace(/"/g, '""')}"\n`;
      });
    }

    return csv;
  }, [detailStats, survey]);

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

  // 과목(강사-과목) 기준 필터링
  const selectedSessionIds = useMemo(() => {
    if (activeTab === 'all') return null;
    return subjectOptions.find((o) => o.key === activeTab)?.sessionIds ?? null;
  }, [activeTab, subjectOptions]);

  // 세션 ID 기준 필터링 - 분포 데이터
  const filteredQuestions = useMemo(() => {
    const items = detailStats?.distributions?.items || [];
    if (!selectedSessionIds) return items;
    const sessionSet = new Set(selectedSessionIds);
    return items.filter((q: any) => !q.sessionId || sessionSet.has(q.sessionId));
  }, [detailStats, selectedSessionIds]);

  // 세션 ID 기준 필터링 - 텍스트 데이터
  const filteredTextAnswers = useMemo(() => {
    const items = detailStats?.textAnswers?.items || [];
    if (!selectedSessionIds) return items;
    const sessionSet = new Set(selectedSessionIds);
    return items.filter((a: any) => !a.sessionId || sessionSet.has(a.sessionId));
  }, [detailStats, selectedSessionIds]);

  // 세션 ID 기준 필터링 - 응답 데이터
  const filteredResponses = useMemo(() => {
    const items = detailStats?.responses?.items || [];
    if (!selectedSessionIds) return items;
    const sessionSet = new Set(selectedSessionIds);
    return items.filter((r: any) => !r.sessionId || sessionSet.has(r.sessionId));
  }, [detailStats, selectedSessionIds]);

  // 텍스트 피드백 그룹핑
  const textFeedbacks = useMemo(() => {
    if (!filteredTextAnswers.length) return [];

    // 질문별로 그룹핑
    const grouped = filteredTextAnswers.reduce((acc: any, answer: any) => {
      if (!acc[answer.questionId]) {
        acc[answer.questionId] = {
          questionId: answer.questionId,
          questionText: answer.questionText,
          satisfactionType: answer.satisfactionType,
          orderIndex: answer.orderIndex,
          answers: []
        };
      }
      acc[answer.questionId].answers.push(answer);
      return acc;
    }, {});

    return Object.values(grouped).sort((a: any, b: any) => 
      (a.orderIndex || 0) - (b.orderIndex || 0)
    );
  }, [filteredTextAnswers]);

  // 평점 분석
  const ratingAnalysis = useMemo(() => {
    return filteredQuestions
      .filter((question: any) => RATING_QUESTION_TYPES.has(question.questionType))
      .map((question: any) => {
        const chartData = SCORE_RANGE.map((score) => ({
          name: `${score}점`,
          value: question.ratingDistribution[score] || 0,
          percentage: question.totalAnswers > 0 
            ? Math.round(((question.ratingDistribution[score] || 0) / question.totalAnswers) * 100) 
            : 0,
        }));

        return {
          question: {
            id: question.questionId,
            question_text: question.questionText,
            satisfaction_type: question.satisfactionType,
            order_index: question.orderIndex,
          },
          average: question.average || 0,
          totalAnswers: question.totalAnswers,
          distribution: question.ratingDistribution,
          chartData
        };
      });
  }, [filteredQuestions]);

  if (!surveyId) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">유효한 설문 ID가 제공되지 않았습니다.</p>
      </div>
    );
  }

  if (loadingSurvey || initialLoading) {
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

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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

  const renderRatingChart = (analysis: typeof ratingAnalysis[0]) => {
    const chartData = SCORE_RANGE.map((score) => ({
      name: `${score}점`,
      value: analysis.distribution[score] || 0,
      percentage: analysis.totalAnswers > 0 ? Math.round(((analysis.distribution[score] || 0) / analysis.totalAnswers) * 100) : 0,
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={handleNavigateBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              뒤로 가기
            </Button>
            <h1 className="text-2xl font-bold">{survey.title}</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{survey.education_year}년 {survey.education_round}차</span>
            <span>{survey.course_name}</span>
            <Badge variant={survey.status === 'completed' ? 'secondary' : 'outline'}>
              {survey.status === 'completed' ? '완료' : '진행 중'}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {testDataOptions && <TestDataToggle testDataOptions={testDataOptions} />}
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            CSV 다운로드
          </Button>
          <Button
            onClick={handleSendResults}
            disabled={sendingResults}
          >
            {sendingResults ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            결과 전송
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            인쇄
          </Button>
        </div>
      </div>

      {/* 과목-강사 필터 */}
      {subjectOptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>과목별 분석</CardTitle>
            <p className="text-sm text-muted-foreground">
              강사-과목을 선택하여 상세 분석을 확인하세요.
            </p>
          </CardHeader>
          <CardContent>
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="all">전체</SelectItem>
                {subjectOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {!detailStats ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">분석할 데이터가 없습니다.</p>
        </div>
      ) : (
        <>
          {/* Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 응답 수</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{detailStats.summary.responseCount || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">전체 만족도</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatAverage(detailStats.summary.avgOverall)}</div>
                <Progress value={(detailStats.summary.avgOverall || 0) * 10} className="mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">과목 만족도</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatAverage(detailStats.summary.avgCourse)}</div>
                <Progress value={(detailStats.summary.avgCourse || 0) * 10} className="mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">강사 만족도</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatAverage(detailStats.summary.avgInstructor)}</div>
                <Progress value={(detailStats.summary.avgInstructor || 0) * 10} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          {/* 평점별 분석 */}
          {ratingAnalysis.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>평가별 분석</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {ratingAnalysis.length}개 평가 항목의 상세 분석 결과입니다.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {ratingAnalysis.map((analysis, index) => (
                    <div key={analysis.question.id} className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium mb-1">
                            {String(index + 1).padStart(2, '0')}. {analysis.question.question_text}
                          </h4>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>평균: {formatAverage(analysis.average)}/10</span>
                            <span>{analysis.totalAnswers}개 응답</span>
                            {analysis.question.satisfaction_type && (
                              <Badge variant="outline" className="text-xs">
                                {formatSatisfactionType(analysis.question.satisfaction_type)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            {formatAverage(analysis.average)}
                          </div>
                          <div className="text-xs text-muted-foreground">/ 10</div>
                        </div>
                      </div>
                      <div className="w-full">
                        <ResponsiveContainer width="100%" height={200}>
                          <RechartsBarChart data={analysis.chartData}>
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
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 텍스트 피드백 */}
          {textFeedbacks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>텍스트 피드백</CardTitle>
                 <p className="text-sm text-muted-foreground">
                   {(() => {
                     const feedbackCount = textFeedbacks.reduce((total: number, group: any) => total + (group.answers?.length || 0), 0);
                     return `${feedbackCount}개의 피드백이 있습니다.${activeInstructor !== 'all' ? ' (선택된 강사 기준)' : ''}`;
                   })()}
                 </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-6 max-h-96 overflow-y-auto">
                  {textFeedbacks.map((group: any) => (
                    <div key={group.questionId} className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">
                        {group.questionText}
                        {group.satisfactionType && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {formatSatisfactionType(group.satisfactionType)}
                          </Badge>
                        )}
                      </h4>
                      <div className="space-y-2">
                        {group.answers.slice(0, 10).map((answer: any, index: number) => (
                          <div key={answer.answerId} className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-sm">{answer.answerText}</p>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatDateTime(answer.createdAt)}
                            </div>
                          </div>
                        ))}
                        {group.answers.length > 10 && (
                          <div className="text-center pt-2">
                            <p className="text-xs text-muted-foreground">
                              {group.answers.length - 10}개의 추가 답변이 있습니다.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                   {(() => {
                     const totalFeedbacks = textFeedbacks.reduce((total: number, group: any) => total + (group.answers?.length || 0), 0) as number;
                     return totalFeedbacks > 50 ? (
                       <div className="text-center pt-4">
                         <p className="text-sm text-muted-foreground">
                           CSV 다운로드를 통해 전체 피드백을 확인하세요.
                         </p>
                       </div>
                     ) : null;
                   })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 응답 목록 */}
          <Collapsible open={isResponsesOpen} onOpenChange={setIsResponsesOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle>응답 목록</CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {filteredResponses.length}개 응답
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isResponsesOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredResponses.slice(0, 50).map((response: any) => (
                      <div key={response.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {response.respondentEmail || '익명 응답자'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(response.submittedAt)}
                          </div>
                        </div>
                        {response.isTest && (
                          <Badge variant="outline" className="text-xs">
                            테스트
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </>
      )}
    </div>
  );
};

export default SurveyDetailedAnalysis;