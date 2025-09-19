import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  downloadCSV,
  exportResponsesAsCSV,
  exportSummaryAsCSV,
  generateCSVFilename,
  SurveyResultData,
} from '@/utils/csvExport';
import { useTestDataToggle } from '@/hooks/useTestDataToggle';
import { TestDataToggle } from '@/components/TestDataToggle';

const RESPONSES_PAGE_SIZE = 20;

interface SurveyAggregate {
  survey_id: string;
  title: string;
  education_year: number;
  education_round: number;
  course_name: string | null;
  status: string;
  instructor_id: string | null;
  instructor_name: string | null;
  expected_participants: number | null;
  is_test: boolean | null;
  response_count: number;
  last_response_at: string | null;
  avg_overall_satisfaction: number | null;
  avg_course_satisfaction: number | null;
  avg_instructor_satisfaction: number | null;
  avg_operation_satisfaction: number | null;
}

interface Profile {
  role: string;
  instructor_id: string | null;
}

interface SurveyResponseRow {
  id: string;
  submitted_at: string;
  respondent_email: string | null;
}

interface SurveyQuestionRow {
  id: string;
  question_text: string;
  question_type: string;
  order_index: number;
}

interface QuestionAnswerRow {
  question_id: string;
  response_id: string;
  answer_text: string | null;
  answer_value: any;
}

type DownloadType = 'responses' | 'summary';

type DownloadJob = {
  id: string;
  type: DownloadType;
  status: 'running' | 'completed' | 'error';
  progress: number; // 0 to 1
  message?: string;
  error?: string;
};

const formatNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return '-';
  }
  return value.toLocaleString('ko-KR');
};

const formatSatisfaction = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }
  return value.toFixed(1);
};

const SurveyResults = () => {
  const { user, userRoles } = useAuth();
  const { toast } = useToast();
  const testDataOptions = useTestDataToggle();
  const [searchParams, setSearchParams] = useSearchParams();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [aggregates, setAggregates] = useState<SurveyAggregate[]>([]);
  const [aggregatesLoading, setAggregatesLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedRound, setSelectedRound] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedInstructor, setSelectedInstructor] = useState<string>('all');
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [responses, setResponses] = useState<SurveyResponseRow[]>([]);
  const [responseTotal, setResponseTotal] = useState(0);
  const [responsePage, setResponsePage] = useState(0);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [downloadJob, setDownloadJob] = useState<DownloadJob | null>(null);

  const canViewAll = useMemo(
    () => userRoles.includes('admin') || userRoles.includes('operator') || userRoles.includes('director'),
    [userRoles],
  );
  const isInstructor = useMemo(() => userRoles.includes('instructor'), [userRoles]);

  const appliedSearchSurvey = useRef(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role, instructor_id')
          .eq('id', user.id)
          .maybeSingle();

        if (error && (error as any).code !== 'PGRST116') {
          throw error;
        }

        if (!data) {
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({ id: user.id, email: user.email, role: 'user' })
            .select('role, instructor_id')
            .single();

          if (insertError) {
            throw insertError;
          }

          setProfile(newProfile as Profile);
        } else {
          setProfile(data as Profile);
        }
      } catch (error) {
        console.error('Failed to load profile', error);
        toast({
          title: '프로필 조회 실패',
          description: '사용자 정보를 불러오는데 실패했습니다.',
          variant: 'destructive',
        });
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [toast, user]);

  useEffect(() => {
    const fetchAggregatedResults = async () => {
      if (profileLoading) return;

      setAggregatesLoading(true);
      try {
        let query = supabase
          .from('survey_aggregates')
          .select('*')
          .order('education_year', { ascending: false })
          .order('education_round', { ascending: false })
          .order('last_response_at', { ascending: false, nullsFirst: false });

        if (!testDataOptions.includeTestData) {
          query = query.or('is_test.is.null,is_test.eq.false');
        }

        if (isInstructor && profile?.instructor_id && !canViewAll) {
          query = query.eq('instructor_id', profile.instructor_id);
        }

        const { data, error } = await query;

        if (error) {
          throw error;
        }

        setAggregates((data ?? []) as SurveyAggregate[]);
      } catch (error) {
        console.error('Failed to load aggregated survey results', error);
        toast({
          title: '데이터 조회 실패',
          description: '설문 집계 데이터를 불러오는데 실패했습니다.',
          variant: 'destructive',
        });
      } finally {
        setAggregatesLoading(false);
      }
    };

    fetchAggregatedResults();
  }, [canViewAll, isInstructor, profile?.instructor_id, profileLoading, testDataOptions.includeTestData, toast]);

  useEffect(() => {
    if (aggregates.length === 0) return;
    if (appliedSearchSurvey.current) return;

    const surveyIdFromQuery = searchParams.get('surveyId');
    if (surveyIdFromQuery && aggregates.some((item) => item.survey_id === surveyIdFromQuery)) {
      setSelectedSurveyId(surveyIdFromQuery);
    }

    appliedSearchSurvey.current = true;
  }, [aggregates, searchParams]);

  const years = useMemo(() => {
    const unique = new Set<number>();
    aggregates.forEach((item) => unique.add(item.education_year));
    return Array.from(unique).sort((a, b) => b - a);
  }, [aggregates]);

  const rounds = useMemo(() => {
    const base = selectedYear === 'all'
      ? aggregates
      : aggregates.filter((item) => item.education_year.toString() === selectedYear);
    const unique = new Set<number>();
    base.forEach((item) => unique.add(item.education_round));
    return Array.from(unique).sort((a, b) => b - a);
  }, [aggregates, selectedYear]);

  const courses = useMemo(() => {
    let base = aggregates;
    if (selectedYear !== 'all') {
      base = base.filter((item) => item.education_year.toString() === selectedYear);
    }
    if (selectedRound !== 'all') {
      base = base.filter((item) => item.education_round.toString() === selectedRound);
    }
    const map = new Map<string, { key: string; label: string }>();
    base.forEach((item) => {
      const key = `${item.education_year}-${item.education_round}-${item.course_name ?? '미정'}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: `${item.education_year}년 ${item.education_round}차 ${item.course_name ?? '과정 미정'}`,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.label.localeCompare(a.label, 'ko'));
  }, [aggregates, selectedRound, selectedYear]);

  const instructors = useMemo(() => {
    const map = new Map<string, string>();
    aggregates.forEach((item) => {
      if (item.instructor_id && item.instructor_name) {
        map.set(item.instructor_id, item.instructor_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [aggregates]);

  const filteredAggregates = useMemo(() => {
    let data = aggregates;

    if (selectedYear !== 'all') {
      data = data.filter((item) => item.education_year.toString() === selectedYear);
    }

    if (selectedRound !== 'all') {
      data = data.filter((item) => item.education_round.toString() === selectedRound);
    }

    if (selectedCourse !== 'all') {
      data = data.filter((item) => {
        const key = `${item.education_year}-${item.education_round}-${item.course_name ?? '미정'}`;
        return key === selectedCourse;
      });
    }

    if (selectedInstructor !== 'all') {
      data = data.filter((item) => item.instructor_id === selectedInstructor);
    }

    return [...data].sort((a, b) => {
      if (a.education_year !== b.education_year) {
        return b.education_year - a.education_year;
      }
      if (a.education_round !== b.education_round) {
        return b.education_round - a.education_round;
      }
      const aCourse = a.course_name ?? '';
      const bCourse = b.course_name ?? '';
      return aCourse.localeCompare(bCourse, 'ko');
    });
  }, [aggregates, selectedCourse, selectedInstructor, selectedRound, selectedYear]);

  useEffect(() => {
    if (filteredAggregates.length === 0) {
      setSelectedSurveyId(null);
      return;
    }

    if (!selectedSurveyId || !filteredAggregates.some((item) => item.survey_id === selectedSurveyId)) {
      setSelectedSurveyId(filteredAggregates[0].survey_id);
    }
  }, [filteredAggregates, selectedSurveyId]);

  useEffect(() => {
    if (!selectedSurveyId) return;
    if (responsePage !== 0) {
      setResponsePage(0);
    }
  }, [selectedSurveyId]);

  useEffect(() => {
    const fetchResponses = async () => {
      if (!selectedSurveyId) {
        setResponses([]);
        setResponseTotal(0);
        return;
      }

      setResponsesLoading(true);
      try {
        const from = responsePage * RESPONSES_PAGE_SIZE;
        const to = from + RESPONSES_PAGE_SIZE - 1;

        let query = supabase
          .from('survey_responses')
          .select('id, submitted_at, respondent_email', { count: 'exact' })
          .eq('survey_id', selectedSurveyId)
          .order('submitted_at', { ascending: false })
          .range(from, to);

        if (!testDataOptions.includeTestData) {
          query = query.or('is_test.is.null,is_test.eq.false');
        }

        const { data, error, count } = await query;

        if (error) {
          throw error;
        }

        setResponses((data ?? []) as SurveyResponseRow[]);
        setResponseTotal(count ?? data?.length ?? 0);
      } catch (error) {
        console.error('Failed to load responses', error);
        toast({
          title: '응답 조회 실패',
          description: '응답 데이터를 불러오는데 실패했습니다.',
          variant: 'destructive',
        });
      } finally {
        setResponsesLoading(false);
      }
    };

    fetchResponses();
  }, [responsePage, selectedSurveyId, testDataOptions.includeTestData, toast]);

  const selectedSurvey = useMemo(
    () => filteredAggregates.find((item) => item.survey_id === selectedSurveyId) ?? null,
    [filteredAggregates, selectedSurveyId],
  );

  const summary = useMemo(() => {
    const totalSurveys = filteredAggregates.length;
    const totalResponses = filteredAggregates.reduce((sum, item) => sum + (item.response_count ?? 0), 0);
    const activeSurveys = filteredAggregates.filter((item) => item.status === 'active').length;
    const completedSurveys = filteredAggregates.filter((item) => item.status === 'completed').length;

    const weightedAverage = (key: keyof SurveyAggregate) => {
      let numerator = 0;
      let denominator = 0;
      filteredAggregates.forEach((item) => {
        const value = item[key] as number | null | undefined;
        if (value !== null && value !== undefined && !Number.isNaN(value)) {
          const weight = item.response_count > 0 ? item.response_count : 1;
          numerator += value * weight;
          denominator += weight;
        }
      });
      if (denominator === 0) {
        return null;
      }
      return numerator / denominator;
    };

    return {
      totalSurveys,
      totalResponses,
      activeSurveys,
      completedSurveys,
      avgOverall: weightedAverage('avg_overall_satisfaction'),
      avgCourse: weightedAverage('avg_course_satisfaction'),
      avgInstructor: weightedAverage('avg_instructor_satisfaction'),
      avgOperation: weightedAverage('avg_operation_satisfaction'),
    };
  }, [filteredAggregates]);

  const totalResponsePages = useMemo(() => {
    if (responseTotal === 0) return 0;
    return Math.ceil(responseTotal / RESPONSES_PAGE_SIZE);
  }, [responseTotal]);

  const handleSurveyChange = (surveyId: string) => {
    setSelectedSurveyId(surveyId);
    const params = new URLSearchParams(searchParams);
    if (surveyId) {
      params.set('surveyId', surveyId);
    } else {
      params.delete('surveyId');
    }
    setSearchParams(params);
  };

  const handleDownload = async (type: DownloadType) => {
    if (!selectedSurvey) {
      toast({
        title: '설문 선택 필요',
        description: '다운로드하려면 설문을 먼저 선택하세요.',
        variant: 'destructive',
      });
      return;
    }

    const jobId = `${type}-${Date.now()}`;
    setDownloadJob({
      id: jobId,
      type,
      status: 'running',
      progress: 0,
      message: '백그라운드 작업을 준비하고 있습니다.',
    });

    try {
      const { data: questionData, error: questionError } = await supabase
        .from('survey_questions')
        .select('id, question_text, question_type, order_index')
        .eq('survey_id', selectedSurvey.survey_id)
        .order('order_index');

      if (questionError) {
        throw questionError;
      }

      setDownloadJob((prev) => (prev && prev.id === jobId
        ? { ...prev, progress: 0.15, message: '질문 정보를 불러오는 중입니다.' }
        : prev));

      const questions = (questionData ?? []) as SurveyQuestionRow[];
      const allResponses: SurveyResponseRow[] = [];
      const allAnswers: QuestionAnswerRow[] = [];
      const chunkSize = 250;
      let fetched = 0;
      let total = 0;
      let offset = 0;

      // Fetch responses and answers in chunks so the UI can update progress.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let responseQuery = supabase
          .from('survey_responses')
          .select('id, submitted_at, respondent_email', { count: 'exact' })
          .eq('survey_id', selectedSurvey.survey_id)
          .order('submitted_at', { ascending: true })
          .range(offset, offset + chunkSize - 1);

        if (!testDataOptions.includeTestData) {
          responseQuery = responseQuery.or('is_test.is.null,is_test.eq.false');
        }

        const { data: responseChunk, error: responseError, count } = await responseQuery;
        if (responseError) {
          throw responseError;
        }

        const chunk = (responseChunk ?? []) as SurveyResponseRow[];
        if (total === 0) {
          total = count ?? chunk.length;
        }

        allResponses.push(...chunk);
        fetched += chunk.length;

        if (chunk.length > 0) {
          const responseIds = chunk.map((item) => item.id);
          const { data: answerChunk, error: answerError } = await supabase
            .from('question_answers')
            .select('question_id, response_id, answer_text, answer_value')
            .in('response_id', responseIds);

          if (answerError) {
            throw answerError;
          }

          allAnswers.push(...((answerChunk ?? []) as QuestionAnswerRow[]));
        }

        const progressBase = 0.2;
        const progressRange = 0.7;
        const progress = total > 0 ? fetched / total : 1;
        setDownloadJob((prev) => (prev && prev.id === jobId
          ? {
            ...prev,
            progress: Math.min(0.9, progressBase + progress * progressRange),
            message: `응답 ${Math.min(fetched, total)}/${total}건 처리 중...`,
          }
          : prev));

        offset += chunkSize;
        if (chunk.length < chunkSize) {
          break;
        }

        // Allow the UI to update between chunks.
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const surveyInfo: SurveyResultData['survey'] = {
        id: selectedSurvey.survey_id,
        title: selectedSurvey.title,
        education_year: selectedSurvey.education_year,
        education_round: selectedSurvey.education_round,
        instructor_name: selectedSurvey.instructor_name ?? undefined,
        course_title: selectedSurvey.course_name ?? undefined,
      };

      const payload: SurveyResultData = {
        survey: surveyInfo,
        responses: allResponses,
        questions,
        answers: allAnswers,
      };

      setDownloadJob((prev) => (prev && prev.id === jobId
        ? { ...prev, progress: 0.95, message: 'CSV 파일을 생성하는 중입니다.' }
        : prev));

      const csv = type === 'responses'
        ? exportResponsesAsCSV(payload)
        : exportSummaryAsCSV(payload);
      const filename = generateCSVFilename(surveyInfo, type);
      downloadCSV(csv, filename);

      setDownloadJob({
        id: jobId,
        type,
        status: 'completed',
        progress: 1,
        message: '다운로드가 완료되었습니다.',
      });
      toast({
        title: '다운로드 시작',
        description: 'CSV 파일 다운로드가 완료되었습니다.',
      });
    } catch (error) {
      console.error('Download job failed', error);
      setDownloadJob({
        id: jobId,
        type,
        status: 'error',
        progress: 1,
        message: '다운로드에 실패했습니다.',
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      });
      toast({
        title: '다운로드 실패',
        description: 'CSV 파일을 생성하는 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">설문 결과</h1>
          <p className="text-muted-foreground">
            설문 응답의 주요 지표를 서버에서 집계한 데이터로 빠르게 확인할 수 있습니다.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>필터</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">연도</span>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="전체 연도" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 연도</SelectItem>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">차수</span>
              <Select value={selectedRound} onValueChange={setSelectedRound}>
                <SelectTrigger>
                  <SelectValue placeholder="전체 차수" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 차수</SelectItem>
                  {rounds.map((round) => (
                    <SelectItem key={round} value={round.toString()}>
                      {round}차
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">과정</span>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger>
                  <SelectValue placeholder="전체 과정" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 과정</SelectItem>
                  {courses.map((course) => (
                    <SelectItem key={course.key} value={course.key}>
                      {course.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {canViewAll && (
              <div className="flex flex-col gap-2">
                <span className="text-sm text-muted-foreground">강사</span>
                <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
                  <SelectTrigger>
                    <SelectValue placeholder="전체 강사" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 강사</SelectItem>
                    {instructors.map((instructor) => (
                      <SelectItem key={instructor.id} value={instructor.id}>
                        {instructor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <TestDataToggle />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>요약 지표</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">총 설문 수</p>
              <p className="text-2xl font-semibold">{formatNumber(summary.totalSurveys)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">총 응답 수</p>
              <p className="text-2xl font-semibold">{formatNumber(summary.totalResponses)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">진행 중</p>
              <p className="text-2xl font-semibold">{formatNumber(summary.activeSurveys)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">완료</p>
              <p className="text-2xl font-semibold">{formatNumber(summary.completedSurveys)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">종합 만족도</p>
              <p className="text-2xl font-semibold">{formatSatisfaction(summary.avgOverall)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">강의 만족도</p>
              <p className="text-2xl font-semibold">{formatSatisfaction(summary.avgCourse)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">강사 만족도</p>
              <p className="text-2xl font-semibold">{formatSatisfaction(summary.avgInstructor)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">운영 만족도</p>
              <p className="text-2xl font-semibold">{formatSatisfaction(summary.avgOperation)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>집계 결과</CardTitle>
            <span className="text-sm text-muted-foreground">
              서버 집계를 통해 정렬된 설문 목록입니다.
            </span>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {aggregatesLoading ? (
              <div className="py-12 text-center text-muted-foreground">집계 데이터를 불러오는 중입니다...</div>
            ) : filteredAggregates.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">조건에 맞는 설문이 없습니다.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>설문</TableHead>
                    <TableHead className="w-[80px] text-center">연도</TableHead>
                    <TableHead className="w-[80px] text-center">차수</TableHead>
                    <TableHead>강사</TableHead>
                    <TableHead className="text-center">응답 수</TableHead>
                    <TableHead className="text-center">종합</TableHead>
                    <TableHead className="text-center">강의</TableHead>
                    <TableHead className="text-center">강사</TableHead>
                    <TableHead className="text-center">운영</TableHead>
                    <TableHead className="text-center">상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAggregates.map((item) => (
                    <TableRow
                      key={item.survey_id}
                      className={item.survey_id === selectedSurveyId ? 'bg-muted/40' : ''}
                      onClick={() => handleSurveyChange(item.survey_id)}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{item.title}</span>
                          <span className="text-sm text-muted-foreground">{item.course_name ?? '과정 미정'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{item.education_year}</TableCell>
                      <TableCell className="text-center">{item.education_round}</TableCell>
                      <TableCell>{item.instructor_name ?? '-'}</TableCell>
                      <TableCell className="text-center">{formatNumber(item.response_count)}</TableCell>
                      <TableCell className="text-center">{formatSatisfaction(item.avg_overall_satisfaction)}</TableCell>
                      <TableCell className="text-center">{formatSatisfaction(item.avg_course_satisfaction)}</TableCell>
                      <TableCell className="text-center">{formatSatisfaction(item.avg_instructor_satisfaction)}</TableCell>
                      <TableCell className="text-center">{formatSatisfaction(item.avg_operation_satisfaction)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={item.status === 'completed' ? 'secondary' : 'outline'}>
                          {item.status === 'completed' ? '완료' : '진행 중'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>선택한 설문 상세</CardTitle>
              <p className="text-sm text-muted-foreground">
                설문 응답 목록은 페이지 단위로 불러오며, 대량 다운로드는 백그라운드 작업으로 처리됩니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => handleDownload('summary')}
                disabled={!selectedSurvey || (downloadJob?.status === 'running' && downloadJob.type === 'summary')}
                variant="secondary"
              >
                요약 다운로드
              </Button>
              <Button
                onClick={() => handleDownload('responses')}
                disabled={!selectedSurvey || (downloadJob?.status === 'running' && downloadJob.type === 'responses')}
              >
                응답 다운로드
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedSurvey ? (
              <div className="py-12 text-center text-muted-foreground">
                표시할 설문을 선택하세요.
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">설문 제목</p>
                    <p className="font-semibold">{selectedSurvey.title}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">응답 수</p>
                    <p className="font-semibold">{formatNumber(selectedSurvey.response_count)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">종합 만족도</p>
                    <p className="font-semibold">{formatSatisfaction(selectedSurvey.avg_overall_satisfaction)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">기대 인원 대비 응답률</p>
                    <p className="font-semibold">
                      {selectedSurvey.expected_participants && selectedSurvey.expected_participants > 0
                        ? `${Math.round(
                          (selectedSurvey.response_count / selectedSurvey.expected_participants) * 100,
                        )}%`
                        : '-'}
                    </p>
                  </div>
                </div>

                {downloadJob && (
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {downloadJob.type === 'responses' ? '응답 다운로드' : '요약 다운로드'} 진행 상태
                      </span>
                      <span>{Math.round(downloadJob.progress * 100)}%</span>
                    </div>
                    <Progress value={Math.round(downloadJob.progress * 100)} />
                    <p className="text-sm text-muted-foreground">
                      {downloadJob.message}
                      {downloadJob.status === 'error' && downloadJob.error ? ` (${downloadJob.error})` : ''}
                    </p>
                  </div>
                )}

                <div className="rounded-lg border">
                  <div className="flex items-center justify-between border-b px-4 py-2">
                    <p className="text-sm font-semibold">응답 목록</p>
                    <p className="text-sm text-muted-foreground">
                      총 {formatNumber(responseTotal)}건 · {responsePage + 1}/{totalResponsePages || 1} 페이지
                    </p>
                  </div>
                  {responsesLoading ? (
                    <div className="py-12 text-center text-muted-foreground">응답을 불러오는 중입니다...</div>
                  ) : responses.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">응답이 없습니다.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>응답 ID</TableHead>
                          <TableHead>제출 시각</TableHead>
                          <TableHead>이메일</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {responses.map((response) => (
                          <TableRow key={response.id}>
                            <TableCell className="font-mono text-sm">{response.id}</TableCell>
                            <TableCell>{new Date(response.submitted_at).toLocaleString('ko-KR')}</TableCell>
                            <TableCell>{response.respondent_email ?? '익명'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                {totalResponsePages > 1 && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm text-muted-foreground">
                      페이지 {responsePage + 1} / {totalResponsePages}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        disabled={responsePage === 0}
                        onClick={() => setResponsePage((prev) => Math.max(prev - 1, 0))}
                      >
                        이전
                      </Button>
                      <Button
                        variant="outline"
                        disabled={responsePage + 1 >= totalResponsePages}
                        onClick={() => setResponsePage((prev) => Math.min(prev + 1, totalResponsePages - 1))}
                      >
                        다음
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SurveyResults;
