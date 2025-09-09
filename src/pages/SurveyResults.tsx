// src/pages/SurveyResults.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { BarChart as IconBarChart, FileText, TrendingUp, Send, Menu, BarChart3, FileSpreadsheet } from 'lucide-react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  exportResponsesAsCSV,
  exportSummaryAsCSV,
  downloadCSV,
  generateCSVFilename,
  SurveyResultData,
} from '@/utils/csvExport';
import { TestDataToggle } from '@/components/TestDataToggle';
import { useTestDataToggle } from '@/hooks/useTestDataToggle';


interface Survey {
  id: string;
  title: string;
  education_year: number;
  education_round: number;
  status: 'draft' | 'active' | 'completed' | string;
  instructor_id: string;
  course_name: string;
  expected_participants?: number | null;
}

interface SurveyResponse {
  id: string;
  survey_id: string;
  submitted_at: string;
  respondent_email: string;
}

interface Profile {
  role: string;
  instructor_id: string | null;
}

interface Instructor {
  id: string;
  name: string;
  email?: string | null;
  photo_url?: string | null;
}

interface QuestionAnswer {
  id: string;
  question_id: string;
  response_id: string;
  answer_text: string;
  answer_value: any;
  created_at: string;
}

interface SurveyQuestion {
  id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'single_choice' | 'rating' | 'text' | string;
  satisfaction_type?: 'course' | 'subject' | 'instructor' | 'operation' | string;
  options: string[] | null;
  is_required: boolean;
  survey_id: string;
  order_index: number;
}

const SurveyResults = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userRoles } = useAuth();
  const testDataOptions = useTestDataToggle();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [allInstructors, setAllInstructors] = useState<Instructor[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [allResponses, setAllResponses] = useState<SurveyResponse[]>([]);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [allQuestions, setAllQuestions] = useState<SurveyQuestion[]>([]);
  const [allAnswers, setAllAnswers] = useState<QuestionAnswer[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<string>('');
  const [selectedInstructor, setSelectedInstructor] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedRound, setSelectedRound] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [availableCourses, setAvailableCourses] = useState<
    { year: number; round: number; course_name: string; key: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [sendingResults, setSendingResults] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false); // 향후 다이얼로그 적용 대비
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);

  const isAdmin = userRoles.includes('admin');
  const isOperator = userRoles.includes('operator');
  const isDirector = userRoles.includes('director');
  const isInstructor = userRoles.includes('instructor');
  const canViewAll = isAdmin || isOperator || isDirector;

  // test data 토글 변경 시 리프레시
  useEffect(() => {
    if (profile) {
      fetchAllResponses();
      fetchAllQuestionsAndAnswers();
      fetchSurveys();
      fetchAvailableCourses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testDataOptions.includeTestData]);

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!profile) return;

    fetchInstructorInfo();
    fetchAllInstructors();
    fetchAvailableCourses();
    fetchSurveys();
    fetchAllResponses();
    fetchAllQuestionsAndAnswers();

    const surveyIdFromUrl = searchParams.get('surveyId');
    if (surveyIdFromUrl) setSelectedSurvey(surveyIdFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, searchParams]);

  // 선택된 설문이 바뀌면 해당 설문 응답/질문/답변 로드
  useEffect(() => {
    if (selectedSurvey) {
      // 기존: fetchReports();  // ❌ 존재하지 않는 함수 호출 제거
      fetchQuestionsAndAnswers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSurvey]);

  // allResponses 또는 selectedSurvey가 바뀌면 responses를 계산해서 세팅
  useEffect(() => {
    if (!selectedSurvey) {
      setResponses([]);
      return;
    }
    const filtered = allResponses.filter((r) => r.survey_id === selectedSurvey);
    setResponses(filtered);
  }, [selectedSurvey, allResponses]);

  // ======= Data fetchers =======
  const fetchAllResponses = async () => {
    try {
      let query = supabase.from('survey_responses').select('*');

      // 테스트 데이터 필터링
      if (!testDataOptions.includeTestData) {
        // 테스트 설문의 응답 제외
        const { data: nonTestSurveys } = await supabase
          .from('surveys')
          .select('id')
          .or('is_test.is.null,is_test.eq.false');
        
        if (nonTestSurveys && nonTestSurveys.length > 0) {
          const surveyIds = nonTestSurveys.map(s => s.id);
          query = query.in('survey_id', surveyIds);
        }
      }

      if (isInstructor && !canViewAll) {
        let instructorId = profile?.instructor_id;
        
        // instructor_id가 없는 경우 이메일로 매칭 시도
        if (!instructorId && user?.email) {
          const { data: instructorData } = await supabase
            .from('instructors')
            .select('id')
            .eq('email', user.email)
            .maybeSingle();
          if (instructorData) {
            instructorId = instructorData.id;
          }
        }
        
        if (instructorId) {
          let surveyQuery = supabase
            .from('surveys')
            .select('id')
            .eq('instructor_id', instructorId);
          
          // 테스트 데이터 필터링
          if (!testDataOptions.includeTestData) {
            surveyQuery = surveyQuery.or('is_test.is.null,is_test.eq.false');
          }
          
          const { data: instructorSurveys } = await surveyQuery;

          if (instructorSurveys && instructorSurveys.length > 0) {
            const ids = instructorSurveys.map((s: any) => s.id);
            query = query.in('survey_id', ids);
          } else {
            // 강사에게 설문이 없는 경우 빈 결과 반환
            setAllResponses([]);
            return;
          }
        } else {
          // instructor_id를 찾을 수 없는 경우 빈 결과 반환
          setAllResponses([]);
          return;
        }
      }

      const { data, error } = await query.order('submitted_at', { ascending: false });
      if (error) throw error;
      setAllResponses((data ?? []) as SurveyResponse[]);
    } catch (e) {
      console.error('Error fetching all responses:', e);
    }
  };

  const fetchAllQuestionsAndAnswers = async () => {
    try {
      let surveyQuery = supabase.from('surveys').select('id');

      // 테스트 데이터 필터링
      if (!testDataOptions.includeTestData) {
        surveyQuery = surveyQuery.or('is_test.is.null,is_test.eq.false');
      }

      if (isInstructor && !canViewAll) {
        let instructorId = profile?.instructor_id;
        
        // instructor_id가 없는 경우 이메일로 매칭 시도
        if (!instructorId && user?.email) {
          const { data: instructorData } = await supabase
            .from('instructors')
            .select('id')
            .eq('email', user.email)
            .maybeSingle();
          if (instructorData) {
            instructorId = instructorData.id;
          }
        }
        
        if (instructorId) {
          surveyQuery = surveyQuery.eq('instructor_id', instructorId);
        } else {
          // instructor_id를 찾을 수 없는 경우 빈 결과 반환
          setAllQuestions([]);
          setAllAnswers([]);
          return;
        }
      }

      const { data: surveyData, error: surveyError } = await surveyQuery;
      if (surveyError) throw surveyError;

      const surveyIds = (surveyData ?? []).map((s: any) => s.id);
      if (surveyIds.length === 0) {
        setAllQuestions([]);
        setAllAnswers([]);
        return;
      }

      const { data: qData, error: qErr } = await supabase
        .from('survey_questions')
        .select('*')
        .in('survey_id', surveyIds)
        .order('order_index');
      if (qErr) throw qErr;
      setAllQuestions((qData ?? []) as SurveyQuestion[]);

      const { data: respIds, error: rErr } = await supabase
        .from('survey_responses')
        .select('id')
        .in('survey_id', surveyIds);
      if (rErr) throw rErr;

      if (respIds && respIds.length) {
        const ids = respIds.map((r: any) => r.id);
        const { data: aData, error: aErr } = await supabase
          .from('question_answers')
          .select('*')
          .in('response_id', ids)
          .order('created_at');
        if (aErr) throw aErr;
        setAllAnswers((aData ?? []) as QuestionAnswer[]);
      } else {
        setAllAnswers([]);
      }
    } catch (e) {
      console.error('Error fetching all questions/answers:', e);
    }
  };

  const fetchQuestionsAndAnswers = async () => {
    if (!selectedSurvey) return;
    try {
      const { data: qData, error: qErr } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', selectedSurvey)
        .order('order_index');
      if (qErr) throw qErr;

      const { data: rIds, error: rErr } = await supabase
        .from('survey_responses')
        .select('id')
        .eq('survey_id', selectedSurvey);
      if (rErr) throw rErr;

      if (rIds && rIds.length) {
        const ids = rIds.map((r: any) => r.id);
        const { data: aData, error: aErr } = await supabase
          .from('question_answers')
          .select('*')
          .in('response_id', ids)
          .order('created_at');
        if (aErr) throw aErr;

        setQuestions((qData ?? []) as SurveyQuestion[]);
        setAnswers((aData ?? []) as QuestionAnswer[]);
      } else {
        setQuestions((qData ?? []) as SurveyQuestion[]);
        setAnswers([]);
      }
    } catch (e) {
      console.error('Error fetching questions/answers:', e);
    }
  };

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, instructor_id')
        .eq('id', user.id)
        .maybeSingle();

      if (error && (error as any).code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
      }

      if (!data) {
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({ id: user.id, email: user.email, role: 'user' })
          .select()
          .single();
        if (insertError) {
          console.error('Error creating profile:', insertError);
        } else {
          setProfile(newProfile as unknown as Profile);
        }
      } else {
        setProfile(data as unknown as Profile);
      }
    } catch (e) {
      console.error('Error in fetchProfile:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchInstructorInfo = async () => {
    if (!profile?.instructor_id) return;
    try {
      const { data, error } = await supabase
        .from('instructors')
        .select('id, name, email, photo_url')
        .eq('id', profile.instructor_id)
        .single();
      if (error) throw error;
      setInstructor(data as Instructor);
    } catch (e) {
      console.error('Error fetching instructor info:', e);
    }
  };

  const fetchAllInstructors = async () => {
    try {
      const { data: instructorUsers, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'instructor');
      if (rolesError) throw rolesError;

      const instructorUserIds = (instructorUsers ?? []).map((ur: any) => ur.user_id);
      if (!instructorUserIds.length) {
        setAllInstructors([]);
        return;
      }

      const { data: instructorProfiles, error: profileError } = await supabase
        .from('profiles')
        .select('instructor_id')
        .in('id', instructorUserIds)
        .not('instructor_id', 'is', null);
      if (profileError) throw profileError;

      const instructorIds = (instructorProfiles ?? []).map((p: any) => p.instructor_id).filter(Boolean);
      if (!instructorIds.length) {
        setAllInstructors([]);
        return;
      }

      const { data, error } = await supabase
        .from('instructors')
        .select('id, name, email, photo_url')
        .in('id', instructorIds)
        .order('name');
      if (error) throw error;

      setAllInstructors((data ?? []) as Instructor[]);
    } catch (e) {
      console.error('Error fetching all instructors:', e);
    }
  };

  const fetchSurveys = async () => {
    try {
      let query = supabase.from('surveys').select('*');
      
      // 테스트 데이터 필터링
      if (!testDataOptions.includeTestData) {
        query = query.or('is_test.is.null,is_test.eq.false');
      }
      
      if (isInstructor && !canViewAll) {
        let instructorId = profile?.instructor_id;
        
        // instructor_id가 없는 경우 이메일로 매칭 시도
        if (!instructorId && user?.email) {
          const { data: instructorData } = await supabase
            .from('instructors')
            .select('id')
            .eq('email', user.email)
            .maybeSingle();
          if (instructorData) {
            instructorId = instructorData.id;
          }
        }
        
        if (instructorId) {
          query = query.eq('instructor_id', instructorId);
        } else {
          // instructor_id를 찾을 수 없는 경우 빈 결과 반환
          setSurveys([]);
          return;
        }
      }
      const { data, error } = await query
        .order('education_year', { ascending: false })
        .order('education_round', { ascending: false });
      if (error) throw error;
      setSurveys((data ?? []) as Survey[]);
    } catch (e) {
      console.error('Error fetching surveys:', e);
      setSurveys([]);
    } finally {
      setLoading(false);
    }
  };

  // ======= Selectors / stats =======
  const getUniqueYears = () => {
    const years = [...new Set(surveys.map((s) => s.education_year))];
    return years.sort((a, b) => b - a);
  };

  const fetchAvailableCourses = async () => {
    try {
      let query = supabase
        .from('surveys')
        .select('education_year, education_round, course_name, instructor_id, status')
        .not('course_name', 'is', null)
        .in('status', ['completed', 'active']);

      // 테스트 데이터 필터링
      if (!testDataOptions.includeTestData) {
        query = query.or('is_test.is.null,is_test.eq.false');
      }

      if (isInstructor && !canViewAll) {
        let instructorId = profile?.instructor_id;
        
        // instructor_id가 없는 경우 이메일로 매칭 시도
        if (!instructorId && user?.email) {
          const { data: instructorData } = await supabase
            .from('instructors')
            .select('id')
            .eq('email', user.email)
            .maybeSingle();
          if (instructorData) {
            instructorId = instructorData.id;
          }
        }
        
        if (instructorId) {
          query = query.eq('instructor_id', instructorId);
        } else {
          // instructor_id를 찾을 수 없는 경우 빈 결과 반환
          setAvailableCourses([]);
          return;
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      const unique = Array.from(
        new Map(
          (data ?? []).map((s: any) => [`${s.education_year}-${s.education_round}-${s.course_name}`, s])
        ).values()
      ).map((s: any) => ({
        year: s.education_year,
        round: s.education_round,
        course_name: s.course_name,
        key: `${s.education_year}-${s.education_round}-${s.course_name}`,
      }));

      unique.sort((a, b) => b.year - a.year || b.round - a.round);
      setAvailableCourses(unique);
    } catch (e) {
      console.error('Error fetching courses:', e);
    }
  };

  const getUniqueRounds = () => {
    const filtered = selectedYear && selectedYear !== 'all' ? surveys.filter((s) => String(s.education_year) === selectedYear) : surveys;
    const rounds = [...new Set(filtered.map((s) => s.education_round))];
    return rounds.sort((a, b) => b - a);
  };

  const getFilteredSurveys = () => {
    let filtered = surveys;
    if (selectedYear && selectedYear !== 'all') filtered = filtered.filter((s) => String(s.education_year) === selectedYear);
    if (selectedRound && selectedRound !== 'all') filtered = filtered.filter((s) => String(s.education_round) === selectedRound);

    if (selectedCourse && selectedCourse !== 'all') {
      const [year, round, ...rest] = selectedCourse.split('-'); // 코스명에 '-' 포함 가능성
      const courseName = rest.join('-');
      filtered = filtered.filter(
        (s) =>
          String(s.education_year) === year &&
          String(s.education_round) === round &&
          s.course_name === courseName
      );
    }

    if (canViewAll && selectedInstructor !== 'all') {
      filtered = filtered.filter((s) => s.instructor_id === selectedInstructor);
    }
    return filtered;
  };

  const getStatistics = () => {
    const relevantSurveys = canViewAll
      ? getFilteredSurveys()
      : getFilteredSurveys().filter((s) => profile?.instructor_id && s.instructor_id === profile.instructor_id);

    const relevantResponses = selectedSurvey
      ? responses
      : allResponses.filter((r) => relevantSurveys.some((s) => s.id === r.survey_id));

    const totalSurveys = relevantSurveys.length;
    const totalResponses = relevantResponses.length;
    const activeSurveys = relevantSurveys.filter((s) => s.status === 'active').length;
    const completedSurveys = relevantSurveys.filter((s) => s.status === 'completed').length;

    return {
      totalSurveys,
      totalResponses,
      activeSurveys,
      completedSurveys,
      avgResponseRate: totalSurveys > 0 ? Math.round((totalResponses / totalSurveys) * 10) / 10 : 0,
    };
  };

  const getCourseStatistics = () => {
    const relevantSurveys = canViewAll
      ? getFilteredSurveys()
      : getFilteredSurveys().filter((s) => profile?.instructor_id && s.instructor_id === profile.instructor_id);

    const currentYear = new Date().getFullYear();
    const recent = relevantSurveys.filter((s) => s.education_year >= currentYear - 1);

    const courseStats: Record<
      string,
      {
        surveys: Survey[];
        responses: number;
        year: number;
        round: number;
        course_name: string;
        instructorSatisfaction: number;
        subjectSatisfaction: number;
        operationSatisfaction: number;
      }
    > = {};

    recent.forEach((survey) => {
      const key = `${survey.education_year}-${survey.education_round}-${survey.course_name}`;
      if (!courseStats[key]) {
        courseStats[key] = {
          surveys: [],
          responses: 0,
          year: survey.education_year,
          round: survey.education_round,
          course_name: survey.course_name,
          instructorSatisfaction: 0,
          subjectSatisfaction: 0,
          operationSatisfaction: 0,
        };
      }
      courseStats[key].surveys.push(survey);
      courseStats[key].responses += allResponses.filter((r) => r.survey_id === survey.id).length;
    });

    // 만족도 계산
    Object.keys(courseStats).forEach((key) => {
      const stat = courseStats[key];
      const surveyIds = stat.surveys.map((s) => s.id);
      const surveyQuestions = allQuestions.filter((q) => surveyIds.includes(q.survey_id));
      const responseIds = allResponses
        .filter((r) => surveyIds.includes(r.survey_id))
        .map((r) => r.id);
      const surveyAnswers = allAnswers.filter((a) => responseIds.includes(a.response_id));

      ['instructor', 'subject', 'operation'].forEach((type) => {
        const typeQuestions = surveyQuestions.filter((q) => q.satisfaction_type === type && q.question_type === 'rating');
        if (typeQuestions.length > 0) {
          const questionIds = typeQuestions.map((q) => q.id);
          const typeAnswers = surveyAnswers.filter((a) => questionIds.includes(a.question_id));
          if (typeAnswers.length > 0) {
            const sum = typeAnswers.reduce((acc, a) => {
              const value = typeof a.answer_value === 'string' ? parseFloat(a.answer_value) : Number(a.answer_value);
              return acc + (isNaN(value) ? 0 : value);
            }, 0);
            const avg = sum / typeAnswers.length;
            if (type === 'instructor') stat.instructorSatisfaction = avg;
            else if (type === 'subject') stat.subjectSatisfaction = avg;
            else if (type === 'operation') stat.operationSatisfaction = avg;
          }
        }
      });
    });

    return Object.values(courseStats).map((stat) => ({
      ...stat,
      key: `${stat.year}-${stat.round}-${stat.course_name}`,
      displayName: `${stat.year}년 ${stat.round}차 ${stat.course_name}`,
    }));
  };

  // ======= Visualization helpers =======
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff00ff', '#00ffff'];

  const getQuestionAnalyses = () => {
    if (!selectedSurvey || questions.length === 0) return [];

    return questions.map((question) => {
      const questionAnswers = answers.filter((a) => a.question_id === question.id);
      const totalAnswers = questionAnswers.length;

      if (question.question_type === 'rating' || question.question_type === 'scale') {
        const values = questionAnswers.map((a) => {
          const value = typeof a.answer_value === 'string' ? parseFloat(a.answer_value) : Number(a.answer_value);
          return isNaN(value) ? 0 : value;
        });
        const average = values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : '0.0';

        const distribution: Record<number, number> = {};
        for (let i = 1; i <= 10; i++) distribution[i] = 0;
        values.forEach((val) => {
          if (val >= 1 && val <= 10) distribution[val]++;
        });

        const chartData = Object.entries(distribution).map(([key, value]) => ({
          name: `${key}점`,
          value,
        }));

        return {
          question,
          type: 'rating' as const,
          totalAnswers,
          average,
          chartData,
        };
      } else if (question.question_type === 'multiple_choice' || question.question_type === 'single_choice') {
        const counts: Record<string, number> = {};
        questionAnswers.forEach((a) => {
          try {
            const answerArray = Array.isArray(a.answer_value) ? a.answer_value : JSON.parse(a.answer_value || '[]');
            answerArray.forEach((ans: string) => {
              counts[ans] = (counts[ans] || 0) + 1;
            });
          } catch {
            const answerText = a.answer_text || String(a.answer_value || '');
            if (answerText) counts[answerText] = (counts[answerText] || 0) + 1;
          }
        });

        const chartData = Object.entries(counts)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);

        return {
          question,
          type: 'chart' as const,
          totalAnswers,
          chartData,
        };
      } else {
        return {
          question,
          type: 'text' as const,
          totalAnswers,
          answers: questionAnswers.map((a) => a.answer_text).filter(Boolean),
        };
      }
    });
  };

  // ======= Event handlers =======
  const openEmailDialog = () => {
    const survey = surveys.find((s) => s.id === selectedSurvey);
    if (!survey) {
      toast({
        title: '오류',
        description: '선택된 설문을 찾을 수 없습니다.',
        variant: 'destructive',
      });
      return;
    }

    // 실제로는 다이얼로그를 열겠지만, 지금은 간단히 toast로 대체
    toast({
      title: '결과 송부 준비',
      description: `"${survey.title}" 설문 결과를 송부할 준비가 되었습니다.`,
    });
  };

  const handleExportCSV = (type: 'responses' | 'summary') => {
    if (!selectedSurvey) {
      toast({
        title: '오류',
        description: '선택된 설문이 없습니다.',
        variant: 'destructive',
      });
      return;
    }

    const survey = surveys.find((s) => s.id === selectedSurvey);
    if (!survey) {
      toast({
        title: '오류',
        description: '선택된 설문을 찾을 수 없습니다.',
        variant: 'destructive',
      });
      return;
    }

    const data: SurveyResultData = {
      survey,
      questions,
      responses,
      answers,
    };

    if (type === 'responses') {
      const csv = exportResponsesAsCSV(data);
      const filename = generateCSVFilename(survey, type);
      downloadCSV(csv, filename);
    } else {
      const csv = exportSummaryAsCSV(data);
      const filename = generateCSVFilename(survey, type);
      downloadCSV(csv, filename);
    }

    toast({
      title: '다운로드 완료',
      description: `${type === 'responses' ? '응답 데이터' : '요약 통계'} CSV 파일이 다운로드되었습니다.`,
    });
  };

  // ======= Derived data =======
  const statistics = getStatistics();
  const courseStats = getCourseStatistics();
  const questionAnalyses = getQuestionAnalyses();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">설문 결과를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                설문 결과 분석
              </h1>
              <p className="text-gray-600 mt-1">
                설문 응답을 분석하고 통계를 확인하세요
              </p>
            </div>
            <div className="flex items-center gap-2">
              <TestDataToggle 
                testDataOptions={testDataOptions}
              />
            </div>
          </div>
        </div>

        {/* 필터 섹션 */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">교육 연도</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {getUniqueYears().map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">교육 차수</label>
              <Select value={selectedRound} onValueChange={setSelectedRound}>
                <SelectTrigger>
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {getUniqueRounds().map((round) => (
                    <SelectItem key={round} value={String(round)}>
                      {round}차
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">과정</label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger>
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {availableCourses.map((course) => (
                    <SelectItem key={course.key} value={course.key}>
                      {course.year}년 {course.round}차 {course.course_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {canViewAll && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">강사</label>
                <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
                  <SelectTrigger>
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {allInstructors.map((instructor) => (
                      <SelectItem key={instructor.id} value={instructor.id}>
                        {instructor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">총 설문</p>
                  <p className="text-2xl font-bold">{statistics.totalSurveys}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">총 응답</p>
                  <p className="text-2xl font-bold">{statistics.totalResponses}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">진행중인 설문</p>
                  <p className="text-2xl font-bold">{statistics.activeSurveys}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <IconBarChart className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">완료된 설문</p>
                  <p className="text-2xl font-bold">{statistics.completedSurveys}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 트렌드 차트 (향후 구현) */}
        {courseStats.length > 0 ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                월별 트렌드
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>트렌드 차트는 향후 업데이트될 예정입니다.</p>
                <p className="text-sm">현재는 과정별 통계를 확인하실 수 있습니다.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                월별 트렌드
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>트렌드 데이터가 없습니다.</p>
                <p className="text-sm">설문 응답이 있는 경우 트렌드 차트가 표시됩니다.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 과정별 통계 카드 */}
        {courseStats.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                과정별 통계
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {courseStats.map((course) => (
                  <Card
                    key={course.key}
                    className="border-2 border-muted-foreground/30 hover:border-primary transition-colors bg-gradient-to-br from-background to-muted/20"
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {course.displayName}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">진행중인 설문</span>
                        <span className="font-semibold text-primary">{course.surveys.length}개</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">총 응답 수</span>
                        <span className="font-semibold text-primary">{course.responses}개</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">과목 만족도</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {course.subjectSatisfaction > 0 ? `${course.subjectSatisfaction.toFixed(1)}/10` : '-'}
                          </span>
                          {course.subjectSatisfaction > 0 && (
                            <Badge
                              variant={
                                course.subjectSatisfaction >= 8
                                  ? 'default'
                                  : course.subjectSatisfaction >= 6
                                  ? 'secondary'
                                  : 'destructive'
                              }
                            >
                              {course.subjectSatisfaction >= 8 ? '우수' : course.subjectSatisfaction >= 6 ? '보통' : '개선필요'}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">강사 만족도</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {course.instructorSatisfaction > 0 ? `${course.instructorSatisfaction.toFixed(1)}/10` : '-'}
                          </span>
                          {course.instructorSatisfaction > 0 && (
                            <Badge
                              variant={
                                course.instructorSatisfaction >= 8
                                  ? 'default'
                                  : course.instructorSatisfaction >= 6
                                  ? 'secondary'
                                  : 'destructive'
                              }
                            >
                              {course.instructorSatisfaction >= 8 ? '우수' : course.instructorSatisfaction >= 6 ? '보통' : '개선필요'}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">운영 만족도</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {course.operationSatisfaction > 0 ? `${course.operationSatisfaction.toFixed(1)}/10` : '-'}
                          </span>
                          {course.operationSatisfaction > 0 && (
                            <Badge
                              variant={
                                course.operationSatisfaction >= 8 ? 'default' : course.operationSatisfaction >= 6 ? 'secondary' : 'destructive'
                              }
                            >
                              {course.operationSatisfaction >= 8 ? '우수' : course.operationSatisfaction >= 6 ? '보통' : '개선필요'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                과정별 통계
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>과목별 통계 데이터가 없습니다.</p>
                <p className="text-sm">설문 응답이 있는 경우 통계가 표시됩니다.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 설문조사 목록 */}
        <Card>
          <CardHeader>
            <CardTitle>설문조사 목록</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {getFilteredSurveys().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>설문 결과가 없습니다.</p>
                  <p className="text-sm">선택한 조건에 맞는 설문조사가 없습니다.</p>
                </div>
              ) : (
                getFilteredSurveys().map((survey) => (
                  <div key={survey.id} className="p-3 border rounded-lg transition-colors hover:bg-muted/50">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium break-words">{survey.title}</h4>
                        <p className="text-sm text-muted-foreground break-words">
                          {survey.education_year}년 {survey.education_round}차
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={survey.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                            {survey.status === 'active' ? '진행중' : survey.status === 'completed' ? '완료' : '초안'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            응답 수: {allResponses.filter((r) => r.survey_id === survey.id).length}개
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => navigate(`/dashboard/detailed-analysis/${survey.id}`)}
                          className="text-xs h-9 px-3 bg-primary hover:bg-primary/90"
                        >
                          상세 분석
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedSurvey(survey.id);
                            openEmailDialog();
                          }}
                          className="text-xs h-9 px-3 border-2 border-muted-foreground/30 hover:border-primary"
                        >
                          <Send className="h-3 w-3 mr-1" />
                          결과 송부
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* 선택된 설문 분석 */}
        {selectedSurvey && (
          <Card>
            <CardHeader>
              <CardTitle>선택된 설문 분석</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="overview" className="text-sm">
                    전체 분석
                  </TabsTrigger>
                  <TabsTrigger value="round-stats" className="text-sm">
                    회차별 통계
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  {questionAnalyses.length > 0 ? (
                    <div className="space-y-6">
                      {/* 상단 카드 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{questions.length}</div>
                            <p className="text-xs text-muted-foreground">총 질문 수</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{responses.length}</div>
                            <p className="text-xs text-muted-foreground">총 응답 수</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-2xl font-bold">
                              {(() => {
                                const expected =
                                  surveys.find((s) => s.id === selectedSurvey)?.expected_participants ??
                                  responses.length;
                                const rate = expected > 0 ? Math.round((responses.length / expected) * 100) : 0;
                                return `${rate}%`;
                              })()}
                            </div>
                            <p className="text-xs text-muted-foreground">응답률</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6 flex items-center justify-between">
                            <div>
                              <div className="text-lg font-bold">CSV</div>
                              <p className="text-xs text-muted-foreground">데이터 다운로드</p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleExportCSV('responses')}
                                title="응답 데이터 CSV 다운로드"
                              >
                                <FileSpreadsheet className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleExportCSV('summary')}
                                title="요약 통계 CSV 다운로드"
                              >
                                <BarChart3 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* 질문별 분석 */}
                      <div className="space-y-4">
                        {questionAnalyses.map((analysis, idx) => (
                          <Card key={analysis.question.id}>
                            <CardHeader>
                              <CardTitle className="text-base">
                                {idx + 1}. {analysis.question.question_text}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              {analysis.type === 'chart' && (
                                <div className="h-64">
                                  {analysis.chartData.some((d) => d.value > 0) ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                      <PieChart>
                                        <Pie
                                          data={analysis.chartData}
                                          cx="50%"
                                          cy="50%"
                                          labelLine={false}
                                          label={({ name, percentage }) => `${name}: ${percentage}%`}
                                          outerRadius={80}
                                          dataKey="value"
                                        >
                                          {analysis.chartData.map((_, i) => (
                                            <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                                          ))}
                                        </Pie>
                                        <Tooltip />
                                      </PieChart>
                                    </ResponsiveContainer>
                                  ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground">
                                      <div className="text-center">
                                        <IconBarChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">데이터가 없습니다</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {analysis.type === 'rating' && (
                                <div className="space-y-2">
                                  <div className="text-sm">
                                    평균: <span className="font-semibold">{analysis.average}</span>
                                  </div>
                                  <div className="h-64">
                                    {analysis.chartData.some((d) => d.value > 0) ? (
                                      <ResponsiveContainer width="100%" height="100%">
                                        <RechartsBarChart data={analysis.chartData}>
                                          <CartesianGrid strokeDasharray="3 3" />
                                          <XAxis dataKey="name" />
                                          <YAxis allowDecimals={false} />
                                          <Tooltip />
                                          <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                                        </RechartsBarChart>
                                      </ResponsiveContainer>
                                    ) : (
                                      <div className="flex items-center justify-center h-full text-muted-foreground">
                                        <div className="text-center">
                                          <IconBarChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                          <p className="text-sm">데이터가 없습니다</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {analysis.type === 'text' && (
                                <div className="space-y-2 text-sm">
                                  {analysis.totalAnswers === 0 ? (
                                    <div className="text-muted-foreground">텍스트 응답이 없습니다.</div>
                                  ) : (
                                    analysis.answers!.map((a, idx) => (
                                      <div key={idx} className="p-2 bg-muted/50 rounded border-l-2 border-primary">
                                        {a}
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <IconBarChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>분석할 데이터가 없습니다.</p>
                      <p className="text-sm">선택된 설문에 응답이 없거나 질문이 없습니다.</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="round-stats" className="space-y-4">
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>회차별 통계는 향후 구현될 예정입니다.</p>
                    <p className="text-sm">현재는 전체 분석만 확인하실 수 있습니다.</p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SurveyResults;