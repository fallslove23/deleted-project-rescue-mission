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
  
  // 분석 데이터 상태
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [loadingSurvey, setLoadingSurvey] = useState(true);
  const [sendingResults, setSendingResults] = useState(false);

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

  // 설문 분석 데이터 로드
  const loadAnalysisData = useCallback(async () => {
    if (!surveyId) return;
    
    setInitialLoading(true);
    setError(null);
    
    try {
      const { data, error: rpcError } = await supabase.rpc('get_survey_analysis', {
        survey_id_param: surveyId
      });
      
      if (rpcError) throw rpcError;
      
      if (data && data.length > 0) {
        setAnalysisData(data[0]);
      } else {
        setAnalysisData(null);
      }
    } catch (err) {
      console.error('Error loading analysis data:', err);
      setError('분석 데이터를 불러오는 중 오류가 발생했습니다.');
      setAnalysisData(null);
    } finally {
      setInitialLoading(false);
    }
  }, [surveyId]);

  useEffect(() => {
    loadSurvey();
  }, [loadSurvey]);

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

  // 분석 데이터에서 만족도 점수 추출
  const satisfactionScores = useMemo(() => {
    if (!analysisData?.satisfaction_scores) return null;
    return analysisData.satisfaction_scores;
  }, [analysisData]);

  // 피드백 텍스트 추출
  const feedbackTexts = useMemo(() => {
    if (!analysisData?.feedback_text) return [];
    return analysisData.feedback_text.filter((text: string) => 
      text && text.trim() !== '' && text.trim() !== '.' && text.trim() !== '없습니다' && text.trim() !== '없음'
    );
  }, [analysisData]);

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
                <div className="text-2xl font-bold">{analysisData.response_count || 0}</div>
              </CardContent>
            </Card>
            {satisfactionScores && renderSummaryCard('과목 만족도', formatAverage(satisfactionScores.course_satisfaction))}
            {satisfactionScores && renderSummaryCard('강사 만족도', formatAverage(satisfactionScores.instructor_satisfaction))}
            {satisfactionScores && renderSummaryCard('운영 만족도', formatAverage(satisfactionScores.operation_satisfaction))}
          </div>

          {/* 텍스트 피드백 */}
          {feedbackTexts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>텍스트 피드백</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {feedbackTexts.length}개의 피드백이 있습니다.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {feedbackTexts.slice(0, 20).map((feedback: string, index: number) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm">{feedback}</p>
                    </div>
                  ))}
                  {feedbackTexts.length > 20 && (
                    <div className="text-center pt-4">
                      <p className="text-sm text-muted-foreground">
                        {feedbackTexts.length - 20}개의 추가 피드백이 있습니다. CSV 다운로드를 통해 전체 내용을 확인하세요.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default SurveyDetailedAnalysis;