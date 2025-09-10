// src/pages/SurveyResults.tsx
import { useState, useEffect, useMemo } from 'react';
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
  const [selectedSurvey, setSelectedSurvey] = useState<string>('all');
  const [selectedInstructor, setSelectedInstructor] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedRound, setSelectedRound] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [showCourseStats, setShowCourseStats] = useState<boolean>(false);
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
    if (selectedSurvey && selectedSurvey !== 'all') {
      // 기존: fetchReports();  // ❌ 존재하지 않는 함수 호출 제거
      fetchQuestionsAndAnswers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSurvey]);

  // allResponses 또는 selectedSurvey가 바뀌면 responses를 계산해서 세팅
  useEffect(() => {
    if (!selectedSurvey || selectedSurvey === 'all') {
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

      // 강사인 경우 본인 설문 우선 표시하되, 없으면 전체 설문 표시
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
          // 먼저 본인 설문이 있는지 확인
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
          }
          // 본인 설문이 없어도 전체 설문을 보여줌 (필터링하지 않음)
        }
        // instructor_id를 찾을 수 없어도 전체 설문을 보여줌
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

      // 강사인 경우 본인 설문 우선 표시하되, 없으면 전체 설문 표시
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
          // 먼저 본인 설문이 있는지 확인
          const { data: instructorSurveys } = await supabase
            .from('surveys')
            .select('id')
            .eq('instructor_id', instructorId);
          
          if (instructorSurveys && instructorSurveys.length > 0) {
            surveyQuery = surveyQuery.eq('instructor_id', instructorId);
          }
          // 본인 설문이 없어도 전체 설문을 보여줌 (필터링하지 않음)
        }
        // instructor_id를 찾을 수 없어도 전체 설문을 보여줌
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
    if (!selectedSurvey || selectedSurvey === 'all') return;
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

      // 강사인 경우 본인 설문 우선 표시하되, 없으면 전체 설문 표시
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
          // 먼저 본인 설문이 있는지 확인
          const { data: instructorSurveys } = await supabase
            .from('surveys')
            .select('id')
            .eq('instructor_id', instructorId);
          
          if (instructorSurveys && instructorSurveys.length > 0) {
            query = query.eq('instructor_id', instructorId);
          }
          // 본인 설문이 없어도 전체 설문을 보여줌 (필터링하지 않음)
        }
        // instructor_id를 찾을 수 없어도 전체 설문을 보여줌
      }

      const { data, error } = await query;
      if (error) throw error;

      // 차수 정보를 제거하고 과정명만 사용
      const unique = Array.from(
        new Map(
          (data ?? []).map((s: any) => [s.course_name, s])
        ).values()
      ).map((s: any) => ({
        year: s.education_year,
        round: s.education_round,
        course_name: s.course_name,
        key: s.course_name, // 과정명만 키로 사용
      }));

      unique.sort((a, b) => a.course_name.localeCompare(b.course_name));
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

    if (selectedCourse && selectedCourse !== 'all') {
      // 과정명으로 직접 필터링
      filtered = filtered.filter((s) => s.course_name === selectedCourse);
    }

    if (canViewAll && selectedInstructor !== 'all') {
      // 강사별 필터링을 설문의 instructor_id로 처리
      filtered = filtered.filter((s) => s.instructor_id === selectedInstructor);
    }
    return filtered;
  };

  const getStatistics = () => {
    const relevantSurveys = getFilteredSurveys();
    let relevantResponses = allResponses.filter((r) => relevantSurveys.some((s) => s.id === r.survey_id));
    let relevantQuestions = allQuestions.filter((q) => relevantSurveys.some((s) => s.id === q.survey_id));
    let relevantAnswers = allAnswers.filter((a) => relevantResponses.some((r) => r.id === a.response_id));

    // 강사별 필터링 (질문 레벨에서 instructor_id 또는 session의 instructor_id로 필터링)
    if (canViewAll && selectedInstructor !== 'all') {
      // instructor_id로 설문 질문 필터링하거나 session 기반 필터링
      const instructorQuestions = relevantQuestions.filter(q => {
        // survey의 instructor_id 확인
        const survey = relevantSurveys.find(s => s.id === q.survey_id);
        return survey && survey.instructor_id === selectedInstructor;
      });
      
      const instructorQuestionIds = instructorQuestions.map(q => q.id);
      relevantAnswers = relevantAnswers.filter(a => instructorQuestionIds.includes(a.question_id));
      relevantQuestions = instructorQuestions;
    } else if (isInstructor && profile?.instructor_id) {
      // 강사가 로그인한 경우, 본인 관련 질문만 필터링
      const instructorQuestions = relevantQuestions.filter(q => {
        const survey = relevantSurveys.find(s => s.id === q.survey_id);
        return survey && (survey.instructor_id === profile.instructor_id || 
                         q.satisfaction_type === 'instructor'); // 강사 관련 질문만
      });
      
      const instructorQuestionIds = instructorQuestions.map(q => q.id);
      relevantAnswers = relevantAnswers.filter(a => instructorQuestionIds.includes(a.question_id));
      relevantQuestions = instructorQuestions;
    }

    // 선택된 설문이 있으면 해당 설문의 응답만, 아니면 모든 관련 응답 사용
    if (selectedSurvey && selectedSurvey !== 'all') {
      relevantResponses = responses; // 이미 선택된 설문의 응답으로 필터링됨
    }

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

    console.log('📊 Course Statistics Debug:', {
      relevantSurveys: relevantSurveys.length,
      allResponses: allResponses.length,
      allQuestions: allQuestions.length,
      allAnswers: allAnswers.length
    });

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
          course_name: survey.course_name || '미지정',
          instructorSatisfaction: 0,
          subjectSatisfaction: 0,
          operationSatisfaction: 0,
        };
      }
      courseStats[key].surveys.push(survey);
      courseStats[key].responses += allResponses.filter((r) => r.survey_id === survey.id).length;
    });

    // 만족도 계산 개선
    Object.keys(courseStats).forEach((key) => {
      const stat = courseStats[key];
      const surveyIds = stat.surveys.map((s) => s.id);
      const surveyQuestions = allQuestions.filter((q) => surveyIds.includes(q.survey_id));
      const responseIds = allResponses
        .filter((r) => surveyIds.includes(r.survey_id))
        .map((r) => r.id);
      const surveyAnswers = allAnswers.filter((a) => responseIds.includes(a.response_id));

      console.log(`📋 ${key} 통계:`, {
        surveyQuestions: surveyQuestions.length,
        surveyAnswers: surveyAnswers.length,
        responseIds: responseIds.length
      });

      // 만족도 타입별 계산 (더 유연하게 매칭) - 0점은 평균에서 제외
      const satisfactionTypes = [
        { key: 'instructorSatisfaction', types: ['instructor'] },
        { key: 'subjectSatisfaction', types: ['subject', 'course'] }, 
        { key: 'operationSatisfaction', types: ['operation'] }
      ];

      satisfactionTypes.forEach(({ key: satKey, types }) => {
        const typeQuestions = surveyQuestions.filter((q) => 
          types.includes(q.satisfaction_type || '') && 
          ['rating', 'scale'].includes(q.question_type)
        );
        
        if (typeQuestions.length > 0) {
          const questionIds = typeQuestions.map((q) => q.id);
          const typeAnswers = surveyAnswers.filter((a) => questionIds.includes(a.question_id));
          
          if (typeAnswers.length > 0) {
            const values = typeAnswers.map(a => {
              let value = 0;
              if (typeof a.answer_value === 'string') {
                value = parseFloat(a.answer_value);
              } else if (typeof a.answer_value === 'number') {
                value = a.answer_value;
              } else if (a.answer_value && typeof a.answer_value === 'object') {
                // JSON 형태일 경우 처리
                value = parseFloat(String(a.answer_value));
              }
              return isNaN(value) ? 0 : value;
            });
            
            // 0점이 아닌 값들만 필터링해서 평균 계산
            const validValues = values.filter(v => v > 0);
            
            if (validValues.length > 0) {
              const sum = validValues.reduce((acc, v) => acc + v, 0);
              const avg = sum / validValues.length;
              (stat as any)[satKey] = avg;
              
              console.log(`${satKey} 계산 (0점 제외):`, {
                questions: typeQuestions.length,
                totalAnswers: typeAnswers.length,
                validAnswers: validValues.length,
                validValues: validValues.slice(0, 5), // 처음 5개만 로그
                avg
              });
            } else {
              (stat as any)[satKey] = 0; // 유효한 값이 없으면 0으로 설정
            }
          }
        }
      });
    });

    const result = Object.values(courseStats).map((stat) => ({
      ...stat,
      key: `${stat.year}-${stat.round}-${stat.course_name}`,
      displayName: `${stat.year}년 ${stat.round}차 ${stat.course_name}`,
    }));

    console.log('📈 최종 courseStats:', result);
    return result;
  };

  // ======= Visualization helpers =======
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff00ff', '#00ffff'];

  const getQuestionAnalyses = () => {
    // 전체 설문 선택 시 모든 질문 분석, 개별 설문 선택 시 해당 설문 질문만 분석
    if (selectedSurvey === 'all') {
      const filteredSurveys = getFilteredSurveys();
      if (filteredSurveys.length === 0) return [];
      
      const allSurveyIds = filteredSurveys.map(s => s.id);
      const allSurveyQuestions = allQuestions.filter(q => allSurveyIds.includes(q.survey_id));
      const allSurveyResponseIds = allResponses.filter(r => allSurveyIds.includes(r.survey_id)).map(r => r.id);
      const allSurveyAnswers = allAnswers.filter(a => allSurveyResponseIds.includes(a.response_id));
      
      return allSurveyQuestions.map((question) => {
        const questionAnswers = allSurveyAnswers.filter((a) => a.question_id === question.id);
        return getQuestionAnalysis(question, questionAnswers);
      });
    } else if (!selectedSurvey || questions.length === 0) return [];

    return questions.map((question) => {
      const questionAnswers = answers.filter((a) => a.question_id === question.id);
      return getQuestionAnalysis(question, questionAnswers);
    });
  };

  const getQuestionAnalysis = (question: SurveyQuestion, questionAnswers: QuestionAnswer[]) => {
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

  // ======= Derived data with memoization =======
  const statistics = useMemo(() => {
    const result = getStatistics();
    console.log('🔄 Statistics 재계산:', result);
    return result;
  }, [getFilteredSurveys(), allResponses, selectedSurvey, responses, selectedInstructor, profile?.instructor_id]);

  const courseStats = useMemo(() => {
    const result = getCourseStatistics();
    console.log('🔄 CourseStats 재계산:', result.length, 'courses');
    return result;
  }, [getFilteredSurveys(), allResponses, allQuestions, allAnswers, profile?.instructor_id]);

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-2">과정</label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger>
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {availableCourses.map((course) => (
                    <SelectItem key={course.key} value={course.key}>
                      {course.course_name}
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

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">설문 선택</label>
              <Select value={selectedSurvey} onValueChange={setSelectedSurvey}>
                <SelectTrigger>
                  <SelectValue placeholder="전체 설문" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 설문</SelectItem>
                  {getFilteredSurveys().map((survey) => (
                    <SelectItem key={survey.id} value={survey.id}>
                      {survey.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSelectedYear('all');
                  setSelectedCourse('all');
                  setSelectedInstructor('all');
                  setSelectedSurvey('all');
                }}
                className="flex items-center gap-2 whitespace-nowrap"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                필터 초기화
              </Button>
            </div>
          </div>
        </div>

        {/* 평균 만족도 - 가장 중요한 지표로 상단에 배치 */}
        <div className="mb-6">
          <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 border-2 border-primary/30 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="p-3 bg-primary rounded-xl shadow-lg mr-4">
                    <TrendingUp className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-primary mb-1">전체 평균 만족도</p>
                    <p className="text-sm text-primary/70">가장 중요한 핵심 지표</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold text-primary">
                    {(() => {
                      // 0점 제외하고 평균 계산
                      const validSatisfactions = courseStats.filter(course => course.subjectSatisfaction > 0);
                      return validSatisfactions.length > 0 
                        ? (validSatisfactions.reduce((acc, course) => acc + course.subjectSatisfaction, 0) / validSatisfactions.length).toFixed(1)
                        : '0.0';
                    })()}
                    <span className="text-2xl text-primary/70 ml-1">/10</span>
                  </p>
                  <div className="mt-2 flex justify-end">
                    <div className="w-32 h-2.5 bg-primary/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-700"
                        style={{ 
                          width: `${(() => {
                            const validSatisfactions = courseStats.filter(course => course.subjectSatisfaction > 0);
                            return validSatisfactions.length > 0 
                              ? ((validSatisfactions.reduce((acc, course) => acc + course.subjectSatisfaction, 0) / validSatisfactions.length) / 10) * 100
                              : 0;
                          })()}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center">
                <div className="p-1.5 bg-chart-1/20 rounded-md">
                  <FileText className="h-4 w-4" style={{ color: 'hsl(var(--chart-1))' }} />
                </div>
                <div className="ml-2">
                  <p className="text-xs font-medium text-muted-foreground">총 설문</p>
                  <p className="text-lg font-bold">{statistics.totalSurveys}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center">
                <div className="p-1.5 bg-chart-2/20 rounded-md">
                  <TrendingUp className="h-4 w-4" style={{ color: 'hsl(var(--chart-2))' }} />
                </div>
                <div className="ml-2">
                  <p className="text-xs font-medium text-muted-foreground">총 응답</p>
                  <p className="text-lg font-bold">{statistics.totalResponses}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center">
                <div className="p-1.5 bg-chart-warning/20 rounded-md">
                  <BarChart3 className="h-4 w-4" style={{ color: 'hsl(var(--chart-warning))' }} />
                </div>
                <div className="ml-2">
                  <p className="text-xs font-medium text-muted-foreground">진행중</p>
                  <p className="text-lg font-bold">{statistics.activeSurveys}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center">
                <div className="p-1.5 bg-chart-3/20 rounded-md">
                  <IconBarChart className="h-4 w-4" style={{ color: 'hsl(var(--chart-3))' }} />
                </div>
                <div className="ml-2">
                  <p className="text-xs font-medium text-muted-foreground">완료</p>
                  <p className="text-lg font-bold">{statistics.completedSurveys}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center">
                <div className="p-1.5 bg-chart-4/20 rounded-md">
                  <FileText className="h-4 w-4" style={{ color: 'hsl(var(--chart-4))' }} />
                </div>
                <div className="ml-2">
                  <p className="text-xs font-medium text-muted-foreground">응답률</p>
                  <p className="text-lg font-bold">
                    {courseStats.length > 0 
                      ? Math.round((statistics.totalResponses / Math.max(courseStats.reduce((acc, course) => acc + course.surveys.length * 20, 0), 1)) * 100) + '%'
                      : '0%'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 과정별 통계 카드 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">과정별 통계</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCourseStats(!showCourseStats)}
              className="flex items-center gap-2"
            >
              {showCourseStats ? (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  숨기기
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  보기
                </>
              )}
            </Button>
          </div>
          
          {showCourseStats && (
            courseStats.length > 0 ? (
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {courseStats.map((course) => (
                      <Card
                        key={course.key}
                        className="border border-border hover:border-primary transition-colors"
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">
                            {course.displayName}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">설문 수</span>
                            <span className="font-medium">{course.surveys.length}개</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">응답 수</span>
                            <span className="font-medium">{course.responses}개</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">과목 만족도</span>
                            <div className="flex items-center gap-1">
                              <span className="font-medium">
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
                                  className="text-xs px-1"
                                >
                                  {course.subjectSatisfaction >= 8 ? '우수' : course.subjectSatisfaction >= 6 ? '보통' : '개선필요'}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">강사 만족도</span>
                            <div className="flex items-center gap-1">
                              <span className="font-medium">
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
                                  className="text-xs px-1"
                                >
                                  {course.instructorSatisfaction >= 8 ? '우수' : course.instructorSatisfaction >= 6 ? '보통' : '개선필요'}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">운영 만족도</span>
                            <div className="flex items-center gap-1">
                              <span className="font-medium">
                                {course.operationSatisfaction > 0 ? `${course.operationSatisfaction.toFixed(1)}/10` : '-'}
                              </span>
                              {course.operationSatisfaction > 0 && (
                                <Badge
                                  variant={
                                    course.operationSatisfaction >= 8 ? 'default' : course.operationSatisfaction >= 6 ? 'secondary' : 'destructive'
                                  }
                                  className="text-xs px-1"
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
                <CardContent className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>과목별 통계 데이터가 없습니다.</p>
                  <p className="text-sm">설문 응답이 있는 경우 통계가 표시됩니다.</p>
                </CardContent>
              </Card>
            )
          )}
        </div>

        {/* 만족도 트렌드 그래프 */}
        {selectedSurvey && selectedSurvey !== 'all' && courseStats.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">만족도 트렌드 분석</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* 과정별 만족도 트렌드 */}
              <Card className="shadow-sm border border-border">
                <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 border-b">
                  <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    과정별 만족도 추세
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                       <RechartsBarChart
                         data={courseStats.filter(course => course.subjectSatisfaction > 0 || course.operationSatisfaction > 0).map((course) => ({
                           name: `${course.round}차`,
                           과목만족도: course.subjectSatisfaction > 0 ? parseFloat(course.subjectSatisfaction.toFixed(1)) : null,
                           운영만족도: course.operationSatisfaction > 0 ? parseFloat(course.operationSatisfaction.toFixed(1)) : null,
                         }))}
                         margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                         barCategoryGap="20%"
                       >
                         <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                         <XAxis 
                           dataKey="name" 
                           tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                           axisLine={{ stroke: 'hsl(var(--border))' }}
                         />
                         <YAxis 
                           domain={[0, 10]} 
                           tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                           axisLine={{ stroke: 'hsl(var(--border))' }}
                         />
                         <Tooltip 
                           contentStyle={{ 
                             backgroundColor: 'hsl(var(--card))', 
                             border: '1px solid hsl(var(--border))',
                             borderRadius: '8px',
                             boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                           }}
                         />
                         <Legend 
                           wrapperStyle={{ paddingTop: '20px' }}
                         />
                         <Bar 
                           dataKey="과목만족도" 
                           fill="hsl(var(--chart-1))" 
                           name="과목 만족도"
                           radius={[4, 4, 0, 0]}
                         />
                         <Bar 
                           dataKey="운영만족도" 
                           fill="hsl(var(--chart-2))" 
                           name="운영 만족도"
                           radius={[4, 4, 0, 0]}
                         />
                       </RechartsBarChart>
                     </ResponsiveContainer>
                   </div>
                 </CardContent>
               </Card>

               {/* 강사 만족도 트렌드 */}
               <Card className="shadow-sm border border-border">
                 <CardHeader className="bg-gradient-to-r from-chart-3/10 to-chart-4/10 border-b">
                   <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                     <TrendingUp className="h-5 w-5" style={{ color: 'hsl(var(--chart-3))' }} />
                     강사 만족도 추세
                   </CardTitle>
                 </CardHeader>
                 <CardContent className="p-6">
                   <div className="h-72">
                     <ResponsiveContainer width="100%" height="100%">
                       <RechartsBarChart
                         data={courseStats.filter(course => course.instructorSatisfaction > 0).map((course) => ({
                           name: `${course.round}차`,
                           강사만족도: course.instructorSatisfaction > 0 ? parseFloat(course.instructorSatisfaction.toFixed(1)) : null,
                         }))}
                         margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                         barCategoryGap="20%"
                       >
                         <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                         <XAxis 
                           dataKey="name" 
                           tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                           axisLine={{ stroke: 'hsl(var(--border))' }}
                         />
                         <YAxis 
                           domain={[0, 10]} 
                           tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                           axisLine={{ stroke: 'hsl(var(--border))' }}
                         />
                         <Tooltip 
                           contentStyle={{ 
                             backgroundColor: 'hsl(var(--card))', 
                             border: '1px solid hsl(var(--border))',
                             borderRadius: '8px',
                             boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                           }}
                         />
                         <Legend 
                           wrapperStyle={{ paddingTop: '20px' }}
                         />
                         <Bar 
                           dataKey="강사만족도" 
                           fill="hsl(var(--chart-3))" 
                           name="강사 만족도"
                           radius={[4, 4, 0, 0]}
                         />
                       </RechartsBarChart>
                     </ResponsiveContainer>
                   </div>
                 </CardContent>
               </Card>
            </div>
          </div>
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
                  <div 
                    key={survey.id} 
                    className={`p-3 border rounded-lg transition-all cursor-pointer ${
                      selectedSurvey === survey.id 
                        ? 'border-primary bg-primary/5 shadow-md' 
                        : 'hover:bg-muted/50 hover:border-muted-foreground/50'
                    }`}
                    onClick={() => setSelectedSurvey(survey.id)}
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            selectedSurvey === survey.id ? 'border-primary bg-primary' : 'border-gray-300'
                          }`}>
                            {selectedSurvey === survey.id && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                          <h4 className="font-medium break-words">{survey.title}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground break-words ml-6">
                          {survey.education_year}년 {survey.education_round}차
                        </p>
                        <div className="flex items-center gap-2 mt-2 ml-6">
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
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/dashboard/detailed-analysis/${survey.id}`);
                          }}
                          className="text-xs h-9 px-3 bg-primary hover:bg-primary/90"
                        >
                          상세 분석
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
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


      </div>
    </div>
  );
};

export default SurveyResults;