import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart } from 'lucide-react';
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
import {
  EMPTY_SURVEY_AGGREGATE_SUMMARY,
  SurveyAggregate,
  SurveyAggregateSummary,
  SurveyAggregatesRepository,
} from '@/repositories/surveyAggregatesRepository';

const RESPONSES_PAGE_SIZE = 20;
const COURSE_KEY_SEPARATOR = '::';

interface ParsedCourseKey {
  year: number | null;
  round: number | null;
  courseName: string | null;
}

const buildCourseKey = (year: number | null, round: number | null, courseName: string | null) => {
  const yearPart = year !== null && year !== undefined ? String(year) : 'null';
  const roundPart = round !== null && round !== undefined ? String(round) : 'null';
  const coursePart = courseName ? encodeURIComponent(courseName) : '';
  return [yearPart, roundPart, coursePart].join(COURSE_KEY_SEPARATOR);
};

const parseCourseKey = (key: string): ParsedCourseKey | null => {
  if (!key || key === 'all') {
    return null;
  }

  const parts = key.split(COURSE_KEY_SEPARATOR);
  if (parts.length !== 3) {
    return null;
  }

  const [yearPart, roundPart, coursePart] = parts;
  const year = yearPart === 'null' || yearPart === '' ? null : Number(yearPart);
  const round = roundPart === 'null' || roundPart === '' ? null : Number(roundPart);
  const courseName = coursePart ? decodeURIComponent(coursePart) : null;

  return {
    year: Number.isNaN(year) ? null : year,
    round: Number.isNaN(round) ? null : round,
    courseName,
  };
};

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
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [allAggregates, setAllAggregates] = useState<SurveyAggregate[]>([]);
  const [aggregates, setAggregates] = useState<SurveyAggregate[]>([]);
  const [aggregatesLoading, setAggregatesLoading] = useState(true);
  const [baseSummary, setBaseSummary] = useState<SurveyAggregateSummary>(EMPTY_SURVEY_AGGREGATE_SUMMARY);
  const [summary, setSummary] = useState<SurveyAggregateSummary>(EMPTY_SURVEY_AGGREGATE_SUMMARY);
  const [hasBaseAggregates, setHasBaseAggregates] = useState(false);
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
  const [allInstructorsList, setAllInstructorsList] = useState<Array<{ id: string; name: string }>>([]);
  const [instructorNamesCache, setInstructorNamesCache] = useState<Map<string, string>>(new Map());

  const canViewAll = useMemo(
    () => userRoles.includes('admin') || userRoles.includes('operator') || userRoles.includes('director'),
    [userRoles],
  );
  const isInstructor = useMemo(() => userRoles.includes('instructor'), [userRoles]);

  const fetchAggregatesWithInstructorNames = useCallback(async (baseAggregates: SurveyAggregate[]) => {
    const cache = new Map<string, string>();
    
    // 강사 정보가 없는 설문들에 대해 survey_sessions에서 조회
    const surveysNeedingInstructors = baseAggregates.filter(agg => !agg.instructor_name);
    
    if (surveysNeedingInstructors.length > 0) {
      const surveyIds = surveysNeedingInstructors.map(agg => agg.survey_id);
      
      try {
        const { data: sessionData, error } = await supabase
          .from('survey_sessions')
          .select(`
            survey_id,
            instructor_id,
            instructors!inner(name)
          `)
          .in('survey_id', surveyIds)
          .not('instructor_id', 'is', null);

        if (!error && sessionData && sessionData.length > 0) {
          const surveyInstructorMap = new Map<string, string[]>();
          
          sessionData.forEach((session: any) => {
            const surveyId = session.survey_id;
            const instructorName = session.instructors?.name;
            
            if (instructorName) {
              const existing = surveyInstructorMap.get(surveyId) || [];
              if (!existing.includes(instructorName)) {
                existing.push(instructorName);
              }
              surveyInstructorMap.set(surveyId, existing);
            }
          });
          
          // 강사명 포맷팅
          surveyInstructorMap.forEach((instructorNames, surveyId) => {
            if (instructorNames.length > 1) {
              cache.set(surveyId, `${instructorNames[0]} 외 ${instructorNames.length - 1}명`);
            } else if (instructorNames.length === 1) {
              cache.set(surveyId, instructorNames[0]);
            }
          });
        }
      } catch (error) {
        console.error('Error fetching instructor names:', error);
      }
    }
    
    setInstructorNamesCache(cache);
    return baseAggregates;
  }, []);

  // 운영 설문을 제외한 강사 만족도 계산
  const calculateAdjustedInstructorSatisfaction = () => {
    // 강사 만족도 데이터가 있는 설문들만 필터링 (제목에 관계없이)
    const surveysWithInstructorSatisfaction = aggregates.filter(item => 
      item.avg_instructor_satisfaction !== null &&
      item.avg_instructor_satisfaction > 0 &&
      item.response_count > 0
    );
    
    if (surveysWithInstructorSatisfaction.length === 0) return null;
    
    // 가중 평균 계산 (응답 수로 가중치)
    const totalWeightedScore = surveysWithInstructorSatisfaction.reduce((sum, item) => 
      sum + (item.avg_instructor_satisfaction! * item.response_count), 0
    );
    const totalResponses = surveysWithInstructorSatisfaction.reduce((sum, item) => 
      sum + item.response_count, 0
    );
    
    return totalResponses > 0 ? totalWeightedScore / totalResponses : null;
  };

  // 강사 정보를 포맷하는 함수 (여러 강사 처리)
  const formatInstructorNames = (surveyId: string, instructorName: string | null, allInstructors?: Array<{name: string}>) => {
    // 캐시된 강사 정보 확인
    const cachedName = instructorNamesCache.get(surveyId);
    if (cachedName) {
      return cachedName;
    }
    
    // 집계 데이터에서 해당 설문 찾기
    const currentSurvey = aggregates.find(agg => agg.survey_id === surveyId);
    
    // 강사 만족도 데이터가 없거나 0인 경우에만 운영 만족도로 표시
    if (currentSurvey && (!currentSurvey.avg_instructor_satisfaction || currentSurvey.avg_instructor_satisfaction === 0)) {
      return '운영 만족도';
    }
    
    // 기본 강사 이름이 있으면 여러 강사인지 확인하여 포맷
    if (instructorName && instructorName.trim() !== '') {
      // 쉼표로 구분된 여러 강사 이름 처리
      const instructorNames = instructorName.split(',').map(name => name.trim()).filter(name => name !== '');
      
      if (instructorNames.length > 1) {
        return `${instructorNames[0]} 외 ${instructorNames.length - 1}명`;
      }
      
      return instructorNames[0] || instructorName;
    }
    
    // 여러 강사가 있는 경우 처리 (향후 확장 가능)
    if (allInstructors && allInstructors.length > 0) {
      if (allInstructors.length === 1) {
        return allInstructors[0].name;
      } else {
        return `${allInstructors[0].name} 외 ${allInstructors.length - 1}명`;
      }
    }
    
    // 강사가 할당되지 않은 경우
    return '강사 미배정';
  };

  const filtersApplied = useMemo(
    () =>
      selectedYear !== 'all' ||
      selectedRound !== 'all' ||
      selectedCourse !== 'all' ||
      (canViewAll && selectedInstructor !== 'all'),
    [canViewAll, selectedCourse, selectedInstructor, selectedRound, selectedYear],
  );

  const filtersAppliedRef = useRef(filtersApplied);

  useEffect(() => {
    filtersAppliedRef.current = filtersApplied;
  }, [filtersApplied]);

  const appliedSearchSurvey = useRef(false);

  // 프로필 정보 로드 (역할/강사 연결)
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

  // 관리자/운영/디렉터: 전체 강사 목록 로드
  useEffect(() => {
    const fetchAllInstructors = async () => {
      if (!canViewAll) return;
      const { data, error } = await supabase
        .from('instructors')
        .select('id, name')
        .order('name');
      if (!error) {
        setAllInstructorsList((data || []).map((i) => ({ id: i.id as string, name: i.name as string })));
      } else {
        console.error('Failed to load instructors list', error);
        setAllInstructorsList([]);
      }
    };
    fetchAllInstructors();
  }, [canViewAll]);

  useEffect(() => {
    if (profileLoading) return;

    const restrictToInstructorId = !canViewAll && isInstructor ? profile?.instructor_id ?? null : null;

    const fetchBaseAggregates = async () => {
      try {
        const { aggregates: baseAggregates, summary: baseSummaryResult } =
          await SurveyAggregatesRepository.fetchAggregates({
            includeTestData: false,
            restrictToInstructorId,
          });

        setAllAggregates(baseAggregates);
        setBaseSummary(baseSummaryResult);
      } catch (error) {
        console.error('Failed to load aggregated survey results', error);
        setAllAggregates([]);
        setBaseSummary(EMPTY_SURVEY_AGGREGATE_SUMMARY);
        if (!filtersAppliedRef.current) {
          toast({
            title: '데이터 조회 실패',
            description: '설문 집계 데이터를 불러오는데 실패했습니다.',
            variant: 'destructive',
          });
        }
      } finally {
        setHasBaseAggregates(true);
      }
    };

    setHasBaseAggregates(false);
    fetchBaseAggregates();
  }, [
    canViewAll,
    isInstructor,
    profile?.instructor_id,
    profileLoading,
    toast,
  ]);

  useEffect(() => {
    if (profileLoading) return;

    const restrictToInstructorId = !canViewAll && isInstructor ? profile?.instructor_id ?? null : null;
    const courseFilters = parseCourseKey(selectedCourse);
    const selectedYearNumber = selectedYear !== 'all' ? Number(selectedYear) : null;
    const selectedRoundNumber = selectedRound !== 'all' ? Number(selectedRound) : null;
    const yearFilter = selectedYearNumber ?? courseFilters?.year ?? null;
    const roundFilter = selectedRoundNumber ?? courseFilters?.round ?? null;
    const courseNameFilter = courseFilters?.courseName ?? null;
    const instructorFilter = canViewAll && selectedInstructor !== 'all' ? selectedInstructor : null;

    const noFiltersApplied =
      yearFilter === null &&
      roundFilter === null &&
      courseNameFilter === null &&
      (instructorFilter === null || instructorFilter === undefined);

    if (noFiltersApplied) {
      if (hasBaseAggregates) {
      fetchAggregatesWithInstructorNames(allAggregates).then(enhancedAggregates => {
        setAggregates(enhancedAggregates);
      });
        setSummary(baseSummary);
        setAggregatesLoading(false);
      } else {
        setAggregatesLoading(true);
      }
      return;
    }

    const fetchFilteredAggregates = async () => {
      setAggregatesLoading(true);
      try {
        const { aggregates: filteredAggregates, summary: filteredSummary } =
          await SurveyAggregatesRepository.fetchAggregates({
            year: yearFilter,
            round: roundFilter,
            courseName: courseNameFilter,
            instructorId: instructorFilter,
            restrictToInstructorId,
            includeTestData: false,
          });
        const enhancedAggregates = await fetchAggregatesWithInstructorNames(filteredAggregates);
        setAggregates(enhancedAggregates);
        setSummary(filteredSummary);
      } catch (error) {
        console.error('Failed to load aggregated survey results', error);
        if (!noFiltersApplied) {
          toast({
            title: '데이터 조회 실패',
            description: '설문 집계 데이터를 불러오는데 실패했습니다.',
            variant: 'destructive',
          });
        }
        setAggregates([]);
        setSummary(EMPTY_SURVEY_AGGREGATE_SUMMARY);
      } finally {
        setAggregatesLoading(false);
      }
    };

    fetchFilteredAggregates();
  }, [
    allAggregates,
    baseSummary,
    canViewAll,
    hasBaseAggregates,
    isInstructor,
    profile?.instructor_id,
    profileLoading,
    selectedCourse,
    selectedInstructor,
    selectedRound,
    selectedYear,
    toast,
  ]);

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
    allAggregates.forEach((item) => unique.add(item.education_year));
    return Array.from(unique).sort((a, b) => b - a);
  }, [allAggregates]);

  const rounds = useMemo(() => {
    const base = selectedYear === 'all'
      ? allAggregates
      : allAggregates.filter((item) => item.education_year.toString() === selectedYear);
    const unique = new Set<number>();
    base.forEach((item) => unique.add(item.education_round));
    return Array.from(unique).sort((a, b) => b - a);
  }, [allAggregates, selectedYear]);

  const courses = useMemo(() => {
    let base = allAggregates;
    if (selectedYear !== 'all') {
      base = base.filter((item) => item.education_year.toString() === selectedYear);
    }
    if (selectedRound !== 'all') {
      base = base.filter((item) => item.education_round.toString() === selectedRound);
    }
    const map = new Map<string, { key: string; label: string }>();
    base.forEach((item) => {
      const key = buildCourseKey(item.education_year, item.education_round, item.course_name);
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: `${item.education_year}년 ${item.education_round}차 ${item.course_name ?? '과정 미정'}`,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.label.localeCompare(a.label, 'ko'));
  }, [allAggregates, selectedRound, selectedYear]);

  const courseIncludesRound = useMemo(() => {
    return courses.some((course) => {
      const parsed = parseCourseKey(course.key);
      return parsed?.round !== null && parsed?.round !== undefined;
    });
  }, [courses]);

  const instructors = useMemo(() => {
    return allInstructorsList;
  }, [allInstructorsList]);

  useEffect(() => {
    if (selectedCourse === 'all') return;
    if (!courses.some((course) => course.key === selectedCourse)) {
      setSelectedCourse('all');
    }
  }, [courses, selectedCourse]);

  // 과정 키에 차수가 포함되어 있으면 별도 차수 필터를 초기화하여 중복 필터링을 방지
  useEffect(() => {
    if (courseIncludesRound && selectedRound !== 'all') {
      setSelectedRound('all');
    }
  }, [courseIncludesRound, selectedRound]);

  useEffect(() => {
    if (aggregates.length === 0) {
      setSelectedSurveyId(null);
      return;
    }

    if (!selectedSurveyId || !aggregates.some((item) => item.survey_id === selectedSurveyId)) {
      setSelectedSurveyId(aggregates[0].survey_id);
    }
  }, [aggregates, selectedSurveyId]);

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

        query = query.or('is_test.is.null,is_test.eq.false');

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
  }, [responsePage, selectedSurveyId, toast]);

  const selectedSurvey = useMemo(
    () => aggregates.find((item) => item.survey_id === selectedSurveyId) ?? null,
    [aggregates, selectedSurveyId],
  );

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

        responseQuery = responseQuery.or('is_test.is.null,is_test.eq.false');

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
          <h1 className="text-3xl font-bold">설문 결과 분석</h1>
          <p className="text-muted-foreground">
            설문 응답의 주요 지표를 서버에서 집계한 데이터로 빠르게 확인할 수 있습니다.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>필터</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">연도</span>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="전체 연도" />
                </SelectTrigger>
                <SelectContent className="bg-popover border shadow-lg z-50">
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
              <span className="text-sm text-muted-foreground">과정</span>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger>
                  <SelectValue placeholder="전체 과정" />
                </SelectTrigger>
                <SelectContent className="bg-popover border shadow-lg z-50">
                  <SelectItem value="all">전체 과정</SelectItem>
                  {courses.map((course) => (
                    <SelectItem key={course.key} value={course.key}>
                      {course.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">강사</span>
              <Select 
                value={isInstructor && !canViewAll ? (profile?.instructor_id || 'all') : selectedInstructor} 
                onValueChange={isInstructor && !canViewAll ? undefined : setSelectedInstructor}
                disabled={isInstructor && !canViewAll}
              >
                <SelectTrigger className={isInstructor && !canViewAll ? 'opacity-50' : ''}>
                  <SelectValue placeholder="전체 강사" />
                </SelectTrigger>
                <SelectContent className="bg-popover border shadow-lg z-50">
                  <SelectItem value="all">전체 강사</SelectItem>
                  {instructors.map((instructor) => (
                    <SelectItem key={instructor.id} value={instructor.id}>
                      {instructor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isInstructor && !canViewAll && (
                <p className="text-xs text-muted-foreground mt-1">
                  강사는 자신의 결과만 조회할 수 있습니다.
                </p>
              )}
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
              <p className="text-2xl font-semibold">{formatSatisfaction(calculateAdjustedInstructorSatisfaction())}</p>
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
            ) : aggregates.length === 0 ? (
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
                    <TableHead className="text-center w-[96px]">상세</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aggregates.map((item) => (
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
                      <TableCell>{formatInstructorNames(item.survey_id, item.instructor_name)}</TableCell>
                      <TableCell className="text-center">{formatNumber(item.response_count)}</TableCell>
                      <TableCell className="text-center">{formatSatisfaction(item.avg_overall_satisfaction)}</TableCell>
                       <TableCell className="text-center">{formatSatisfaction(item.avg_course_satisfaction)}</TableCell>
                       <TableCell className="text-center">
                         {item.title.includes('[종료 설문]') || item.title.includes('운영') 
                           ? '-' 
                           : formatSatisfaction(item.avg_instructor_satisfaction)
                         }
                       </TableCell>
                      <TableCell className="text-center">{formatSatisfaction(item.avg_operation_satisfaction)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={item.status === 'completed' ? 'secondary' : 'outline'}>
                          {item.status === 'completed' ? '완료' : '진행 중'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/survey-detailed-analysis/${item.survey_id}`, { state: { from: 'survey-results' } });
                          }}
                        >
                          <BarChart className="h-4 w-4 mr-1" />
                          분석
                        </Button>
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
