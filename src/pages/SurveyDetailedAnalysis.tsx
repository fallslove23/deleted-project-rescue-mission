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

// 과목(강사+세션명에서 Part/세부 평가명을 제거한 그룹) 옵션
interface SubjectOption {
  key: string;        // 드롭다운 value
  label: string;      // 표시용 "강사 - 과목"
  sessionIds: string[]; // 이 과목에 속하는 세션 ID들(Part.1/2 등 포함)
}

interface QuestionData {
  id: string;
  question_text: string;
  question_type: string;
  satisfaction_type?: string;
  order_index?: number;
  session_id?: string;
}

interface AnswerData {
  id: string;
  question_id: string;
  answer_text?: string;
  answer_value?: any;
  response_id: string;
  created_at: string;
}

interface ResponseData {
  id: string;
  survey_id: string;
  session_id?: string;
  submitted_at: string;
  respondent_email?: string;
  is_test: boolean;
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
  
  // 데이터 상태
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [answers, setAnswers] = useState<AnswerData[]>([]);
  const [responses, setResponses] = useState<ResponseData[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [loadingSurvey, setLoadingSurvey] = useState(true);
  const [sendingResults, setSendingResults] = useState(false);

  // 과목(세션 그룹) 드롭다운 및 현재 선택 상태
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

      // 세션명을 과목 단위로 정규화: " - Part.X ..." 및 평가명 접미어 제거
      const toBase = (name: string | null): string => {
        if (!name) return '';
        let s = name.replace(/\s*-\s*Part\.?\s*\d+.*/i, '');
        s = s.replace(/\s*-\s*(교육|강의|운영).*/i, '');
        return s.trim();
      };

      // 과목(강사+과목) 라벨로 그룹핑
      const group = new Map<string, string[]>();
      raw.forEach((s: any) => {
        const instr = nameMap.get(s.instructor_id) ?? '';
        const base = toBase(s.session_name ?? '');
        
        // 운영 만족도 세션이고 survey에 operator_name이 있으면 운영자 정보 표시
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

  // 설문 분석 데이터 로드
  const loadAnalysisData = useCallback(async () => {
    if (!surveyId) return;
    
    setInitialLoading(true);
    setError(null);
    
    try {
      // 1. 기본 분석 데이터
      const { data: analysisResult, error: rpcError } = await supabase.rpc('get_survey_analysis', {
        survey_id_param: surveyId
      });
      
      if (rpcError) throw rpcError;
      
      if (analysisResult && analysisResult.length > 0) {
        setAnalysisData(analysisResult[0]);
      }

      // 2. 질문 데이터
      const { data: questionsData, error: questionsError } = await supabase
        .from('survey_questions')
        .select('id, question_text, question_type, satisfaction_type, order_index, session_id')
        .eq('survey_id', surveyId)
        .order('order_index', { ascending: true });

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

      // 3. 응답 데이터
      const { data: responsesData, error: responsesError } = await supabase
        .from('survey_responses')
        .select('id, survey_id, session_id, submitted_at, respondent_email, is_test')
        .eq('survey_id', surveyId)
        .order('submitted_at', { ascending: false })
        .limit(100);

      if (responsesError) throw responsesError;
      setResponses(responsesData || []);

      // 4. 답변 데이터 (상위 200개만)
      if (responsesData && responsesData.length > 0) {
        const responseIds = responsesData.slice(0, 50).map(r => r.id);
        const { data: answersData, error: answersError } = await supabase
          .from('question_answers')
          .select('id, question_id, answer_text, answer_value, response_id, created_at')
          .in('response_id', responseIds)
          .order('created_at', { ascending: false });

        if (answersError) throw answersError;
        setAnswers(answersData || []);
      }

    } catch (err) {
      console.error('Error loading analysis data:', err);
      setError('분석 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setInitialLoading(false);
    }
  }, [surveyId]);

  useEffect(() => {
    loadSurvey();
  }, [loadSurvey]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    loadAnalysisData();
  }, [loadAnalysisData]);

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
    if (!survey || !analysisData) return '';

    let csv = '설문 상세 분석 결과\n';
    csv += `설문명: ${survey.title}\n`;
    csv += `교육년도: ${survey.education_year}년\n`;
    csv += `교육차수: ${survey.education_round}차\n`;
    csv += `총 응답 수: ${analysisData.response_count}\n\n`;

    const scores = analysisData.satisfaction_scores || {};
    csv += `과목 만족도,${formatAverage(scores.course_satisfaction)}/10\n`;
    csv += `강사 만족도,${formatAverage(scores.instructor_satisfaction)}/10\n`;
    csv += `운영 만족도,${formatAverage(scores.operation_satisfaction)}/10\n\n`;

    if (analysisData.feedback_text && analysisData.feedback_text.length > 0) {
      csv += '피드백 내용\n';
      analysisData.feedback_text.forEach((feedback: string, index: number) => {
        csv += `${index + 1},"${feedback.replace(/"/g, '""')}"\n`;
      });
    }

    return csv;
  }, [analysisData, survey]);

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

  // 과목(세션 그룹) 기준 필터링
  const selectedSessionIds = useMemo(() => {
    if (activeTab === 'all') return null;
    return subjectOptions.find((o) => o.key === activeTab)?.sessionIds ?? null;
  }, [activeTab, subjectOptions]);

  // 필터링된 데이터
  const filteredQuestions = useMemo(() => {
    if (!selectedSessionIds) return questions;
    const set = new Set(selectedSessionIds);
    return questions.filter((q) => !q.session_id || set.has(q.session_id));
  }, [questions, selectedSessionIds]);

  const filteredAnswers = useMemo(() => {
    if (!selectedSessionIds) return answers;
    const set = new Set(selectedSessionIds);
    const filteredQuestionIds = new Set(filteredQuestions.map(q => q.id));
    return answers.filter((a) => filteredQuestionIds.has(a.question_id));
  }, [answers, filteredQuestions, selectedSessionIds]);

  const filteredResponses = useMemo(() => {
    if (!selectedSessionIds) return responses;
    const set = new Set(selectedSessionIds);
    return responses.filter((r) => !r.session_id || set.has(r.session_id));
  }, [responses, selectedSessionIds]);

  // 분석 데이터에서 만족도 점수 추출
  const satisfactionScores = useMemo(() => {
    if (!analysisData?.satisfaction_scores) return null;
    return analysisData.satisfaction_scores;
  }, [analysisData]);

  // 텍스트 질문별 피드백 추출 (필터링 적용)
  const textFeedbacks = useMemo(() => {
    const textQuestions = filteredQuestions.filter(q => 
      ['text', 'long_text', 'textarea', 'paragraph'].includes(q.question_type)
    );
    
    if (textQuestions.length === 0) return [];

    const questionMap = new Map(textQuestions.map(q => [q.id, q]));
    const textAnswers = filteredAnswers.filter(a => 
      questionMap.has(a.question_id) && 
      a.answer_text && 
      a.answer_text.trim() !== '' && 
      a.answer_text.trim() !== '.' && 
      a.answer_text.trim() !== '없습니다' && 
      a.answer_text.trim() !== '없음'
    );

    // 질문별로 그룹핑
    const grouped = textAnswers.reduce((acc, answer) => {
      const question = questionMap.get(answer.question_id);
      if (!question) return acc;
      
      if (!acc[answer.question_id]) {
        acc[answer.question_id] = {
          question,
          answers: []
        };
      }
      acc[answer.question_id].answers.push(answer);
      return acc;
    }, {} as Record<string, { question: QuestionData; answers: AnswerData[] }>);

    return Object.values(grouped).sort((a, b) => 
      (a.question.order_index || 0) - (b.question.order_index || 0)
    );
  }, [filteredQuestions, filteredAnswers]);

  // 평점 질문별 분석
  const ratingAnalysis = useMemo(() => {
    const ratingQuestions = filteredQuestions.filter(q => RATING_QUESTION_TYPES.has(q.question_type));
    
    return ratingQuestions.map(question => {
      const questionAnswers = filteredAnswers.filter(a => a.question_id === question.id);
      const ratings = questionAnswers
        .map(a => {
          const value = a.answer_value || a.answer_text;
          const num = typeof value === 'string' ? parseFloat(value) : value;
          return typeof num === 'number' && !isNaN(num) ? (num <= 5 ? num * 2 : num) : null;
        })
        .filter((v): v is number => v !== null);

      const average = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      
      // 분포 계산
      const distribution = SCORE_RANGE.reduce((acc, score) => {
        acc[score] = ratings.filter(r => Math.round(r) === score).length;
        return acc;
      }, {} as Record<number, number>);

      return {
        question,
        average,
        totalAnswers: ratings.length,
        distribution
      };
    });
  }, [filteredQuestions, filteredAnswers]);

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

      {/* 과목별 필터 */}
      {subjectOptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>과목별 분석</CardTitle>
            <p className="text-sm text-muted-foreground">
              강사별 과목을 선택하여 상세 분석을 확인하세요.
            </p>
          </CardHeader>
          <CardContent>
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent className="bg-popover border shadow-lg z-50">
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

      {!analysisData ? (
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
                <div className="text-2xl font-bold">{filteredResponses.length || 0}</div>
              </CardContent>
            </Card>
            {satisfactionScores && renderSummaryCard('과목 만족도', formatAverage(satisfactionScores.course_satisfaction))}
            {satisfactionScores && renderSummaryCard('강사 만족도', formatAverage(satisfactionScores.instructor_satisfaction))}
            {satisfactionScores && renderSummaryCard('운영 만족도', formatAverage(satisfactionScores.operation_satisfaction))}
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
                  {ratingAnalysis.slice(0, 10).map((analysis, index) => (
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
                                {analysis.question.satisfaction_type.toUpperCase()}
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
                      {renderRatingChart(analysis)}
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
                  {textFeedbacks.reduce((total, group) => total + group.answers.length, 0)}개의 피드백이 있습니다.
                  {activeTab !== 'all' && ' (선택된 강사/과목 기준)'}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-6 max-h-96 overflow-y-auto">
                  {textFeedbacks.map((group) => (
                    <div key={group.question.id} className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">
                        {group.question.question_text}
                        {group.question.satisfaction_type && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {group.question.satisfaction_type.toUpperCase()}
                          </Badge>
                        )}
                      </h4>
                      <div className="space-y-2">
                        {group.answers.slice(0, 10).map((answer, index) => (
                          <div key={answer.id} className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-sm">{answer.answer_text}</p>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatDateTime(answer.created_at)}
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
                  {textFeedbacks.reduce((total, group) => total + group.answers.length, 0) > 50 && (
                    <div className="text-center pt-4">
                      <p className="text-sm text-muted-foreground">
                        CSV 다운로드를 통해 전체 피드백을 확인하세요.
                      </p>
                    </div>
                  )}
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
                    {filteredResponses.slice(0, 50).map((response) => (
                      <div key={response.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {response.respondent_email || '익명 응답자'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(response.submitted_at)}
                          </div>
                        </div>
                        {response.is_test && (
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