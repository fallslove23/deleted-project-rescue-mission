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
import { BarChart, FileText, TrendingUp, Send, Menu, BarChart3, FileSpreadsheet } from 'lucide-react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { exportResponsesAsCSV, exportSummaryAsCSV, downloadCSV, generateCSVFilename, SurveyResultData } from '@/utils/csvExport';
import { TestDataToggle } from '@/components/TestDataToggle';
import { useTestDataToggle } from '@/hooks/useTestDataToggle';
import { AdminLayout } from '@/components/AdminLayout';

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
  const { user } = useAuth();
  const testDataOptions = useTestDataToggle();
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
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedRound, setSelectedRound] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [availableCourses, setAvailableCourses] = useState<{year: number, round: number, course_name: string, key: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingResults, setSendingResults] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const { toast } = useToast();

  // roles
  const { userRoles } = useAuth();
  const isAdmin = userRoles.includes('admin');
  const isOperator = userRoles.includes('operator');
  const isDirector = userRoles.includes('director');
  const isInstructor = userRoles.includes('instructor');
  const canViewAll = isAdmin || isOperator || isDirector;

  // Refresh when test-data toggle changes
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
    if (profile) {
      fetchInstructorInfo();
      fetchAllInstructors();
      fetchAvailableCourses();
      fetchSurveys();
      fetchAllResponses();
      fetchAllQuestionsAndAnswers();

      // preselect survey via URL param
      const surveyIdFromUrl = searchParams.get('surveyId');
      if (surveyIdFromUrl) setSelectedSurvey(surveyIdFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, searchParams]);

  useEffect(() => {
    if (selectedSurvey) {
      fetchResponses();
      fetchQuestionsAndAnswers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSurvey]);

  const fetchAllResponses = async () => {
    try {
      let query = testDataOptions.includeTestData
        ? supabase.from('survey_responses').select('*')
        : supabase.from('analytics_responses').select('*');

      if (isInstructor && profile?.instructor_id && !canViewAll) {
        const surveyQuery = testDataOptions.includeTestData
          ? supabase.from('surveys').select('id').eq('instructor_id', profile.instructor_id)
          : supabase.from('analytics_surveys').select('id').eq('instructor_id', profile.instructor_id);

        const { data: instructorSurveys } = await surveyQuery;
        if (instructorSurveys && instructorSurveys.length > 0) {
          const surveyIds = instructorSurveys.map((s: any) => s.id);
          query = query.in('survey_id', surveyIds);
        }
      }

      const { data, error } = await query.order('submitted_at', { ascending: false });
      if (error) throw error;
      setAllResponses((data ?? []) as SurveyResponse[]);
    } catch (err) {
      console.error('Error fetching all responses:', err);
    }
  };

  const fetchAllQuestionsAndAnswers = async () => {
    try {
      let surveyQuery = testDataOptions.includeTestData
        ? supabase.from('surveys').select('id')
        : supabase.from('analytics_surveys').select('id');

      if (isInstructor && profile?.instructor_id && !canViewAll) {
        surveyQuery = surveyQuery.eq('instructor_id', profile.instructor_id);
      }

      const { data: surveyData, error: surveyError } = await surveyQuery;
      if (surveyError) throw surveyError;

      const surveyIds = (surveyData ?? []).map((s: any) => s.id);
      if (surveyIds.length === 0) {
        setAllQuestions([]);
        setAllAnswers([]);
        return;
      }

      const { data: questionsData, error: questionsError } = await supabase
        .from('survey_questions')
        .select('*')
        .in('survey_id', surveyIds)
        .order('order_index');
      if (questionsError) throw questionsError;
      setAllQuestions((questionsData ?? []) as SurveyQuestion[]);

      const responseQuery = testDataOptions.includeTestData
        ? supabase.from('survey_responses').select('id').in('survey_id', surveyIds)
        : supabase.from('analytics_responses').select('id').in('survey_id', surveyIds);

      const { data: responseIds, error: responseError } = await responseQuery;
      if (responseError) throw responseError;

      if (responseIds && responseIds.length > 0) {
        const ids = responseIds.map((r: any) => r.id);
        const { data: answersData, error: answersError } = await supabase
          .from('question_answers')
          .select('*')
          .in('response_id', ids)
          .order('created_at');
        if (answersError) throw answersError;
        setAllAnswers((answersData ?? []) as QuestionAnswer[]);
      } else {
        setAllAnswers([]);
      }
    } catch (err) {
      console.error('Error fetching all questions and answers:', err);
    }
  };

  const fetchQuestionsAndAnswers = async () => {
    if (!selectedSurvey) return;
    try {
      const { data: questionsData, error: questionsError } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', selectedSurvey)
        .order('order_index');
      if (questionsError) throw questionsError;

      const { data: responseIds, error: responseError } = await supabase
        .from('survey_responses')
        .select('id')
        .eq('survey_id', selectedSurvey);
      if (responseError) throw responseError;

      if (responseIds && responseIds.length > 0) {
        const ids = responseIds.map((r: any) => r.id);
        const { data: answersData, error: answersError } = await supabase
          .from('question_answers')
          .select('*')
          .in('response_id', ids)
          .order('created_at');
        if (answersError) throw answersError;

        setQuestions((questionsData ?? []) as SurveyQuestion[]);
        setAnswers((answersData ?? []) as QuestionAnswer[]);
      } else {
        setQuestions((questionsData ?? []) as SurveyQuestion[]);
        setAnswers([]);
      }
    } catch (err) {
      console.error('Error fetching questions and answers:', err);
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
          .insert({
            id: user.id,
            email: user.email,
            role: 'user',
          })
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
    } catch (err) {
      console.error('Error in fetchProfile:', err);
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
    } catch (err) {
      console.error('Error fetching instructor info:', err);
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
      if (instructorUserIds.length === 0) {
        setAllInstructors([]);
        return;
      }

      const { data: instructorProfiles, error: profileError } = await supabase
        .from('profiles')
        .select('instructor_id')
        .in('id', instructorUserIds)
        .not('instructor_id', 'is', null);
      if (profileError) throw profileError;

      const instructorIds = (instructorProfiles ?? [])
        .map((p: any) => p.instructor_id)
        .filter(Boolean);

      if (instructorIds.length === 0) {
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
    } catch (err) {
      console.error('Error fetching all instructors:', err);
    }
  };

  const fetchSurveys = async () => {
    try {
      let query = supabase.from('surveys').select('*');
      if (isInstructor && profile?.instructor_id && !canViewAll) {
        query = query.eq('instructor_id', profile.instructor_id);
      }
      const { data, error } = await query
        .order('education_year', { ascending: false })
        .order('education_round', { ascending: false });

      if (error) {
        console.error('Error fetching surveys:', error);
        setSurveys([]);
      } else {
        setSurveys((data ?? []) as Survey[]);
      }
    } catch (err) {
      console.error('Error fetching surveys:', err);
      setSurveys([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchResponses = async () => {
    if (!selectedSurvey) return;
    try {
      const { data, error } = await supabase
        .from('survey_responses')
        .select('*')
        .eq('survey_id', selectedSurvey)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      setResponses((data ?? []) as SurveyResponse[]);
    } catch (err) {
      console.error('Error fetching responses:', err);
    }
  };

  const getUniqueYears = () => {
    const years = [...new Set(surveys.map(s => s.education_year))];
    return years.sort((a, b) => b - a);
  };

  const fetchAvailableCourses = async () => {
    try {
      let query = supabase
        .from('surveys')
        .select('education_year, education_round, course_name, instructor_id, status')
        .not('course_name', 'is', null)
        .in('status', ['completed', 'active']);

      if (isInstructor && profile?.instructor_id && !canViewAll) {
        query = query.eq('instructor_id', profile.instructor_id);
      }

      const { data: courseSurveys, error } = await query;
      if (error) throw error;

      const uniqueCourses = Array.from(
        new Map(
          (courseSurveys ?? []).map((s: any) => [
            `${s.education_year}-${s.education_round}-${s.course_name}`,
            s,
          ])
        ).values()
      ).map((s: any) => ({
        year: s.education_year,
        round: s.education_round,
        course_name: s.course_name,
        key: `${s.education_year}-${s.education_round}-${s.course_name}`,
      }));

      uniqueCourses.sort((a, b) => (b.year - a.year) || (b.round - a.round));
      setAvailableCourses(uniqueCourses);
    } catch (err) {
      console.error('Error fetching courses:', err);
    }
  };

  const getUniqueRounds = () => {
    const filtered = selectedYear
      ? surveys.filter(s => String(s.education_year) === selectedYear)
      : surveys;
    const rounds = [...new Set(filtered.map(s => s.education_round))];
    return rounds.sort((a, b) => b - a);
  };

  const getFilteredSurveys = () => {
    let filtered = surveys;
    if (selectedYear) {
      filtered = filtered.filter(s => String(s.education_year) === selectedYear);
    }
    if (selectedRound) {
      filtered = filtered.filter(s => String(s.education_round) === selectedRound);
    }
    if (selectedCourse) {
      const [year, round, ...rest] = selectedCourse.split('-');
      const courseName = rest.join('-'); // course name에 '-'가 있을 수도 있으므로
      filtered = filtered.filter(
        s =>
          String(s.education_year) === year &&
          String(s.education_round) === round &&
          s.course_name === courseName
      );
    }
    if (canViewAll && selectedInstructor !== 'all') {
      filtered = filtered.filter(s => s.instructor_id === selectedInstructor);
    }
    return filtered;
  };

  const getStatistics = () => {
    const relevantSurveys = canViewAll
      ? getFilteredSurveys()
      : getFilteredSurveys().filter(s => profile?.instructor_id && s.instructor_id === profile.instructor_id);

    const relevantResponses = selectedSurvey
      ? responses
      : allResponses.filter(r => relevantSurveys.some(s => s.id === r.survey_id));

    const totalSurveys = relevantSurveys.length;
    const totalResponses = relevantResponses.length;
    const activeSurveys = relevantSurveys.filter(s => s.status === 'active').length;
    const completedSurveys = relevantSurveys.filter(s => s.status === 'completed').length;

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
      : getFilteredSurveys().filter(s => profile?.instructor_id && s.instructor_id === profile.instructor_id);

    const currentYear = new Date().getFullYear();
    const recentSurveys = relevantSurveys.filter(s => s.education_year >= currentYear - 1);

    const courseStats: Record<
      string,
      {
        surveys: Survey[];
        responses: number;
        year: number;
        round: number;
        courseName: string;
        subjectSatisfaction: number;
        instructorSatisfaction: number;
        operationSatisfaction: number;
        responseRate: number;
      }
    > = {};

    recentSurveys.forEach(survey => {
      const key = `${survey.education_year}-${survey.education_round}-${survey.course_name}`;
      if (!courseStats[key]) {
        courseStats[key] = {
          surveys: [],
          responses: 0,
          year: survey.education_year,
          round: survey.education_round,
          courseName: survey.course_name,
          subjectSatisfaction: 0,
          instructorSatisfaction: 0,
          operationSatisfaction: 0,
          responseRate: 0,
        };
      }
      courseStats[key].surveys.push(survey);
      const surveyResponses = allResponses.filter(r => r.survey_id === survey.id).length;
      courseStats[key].responses += surveyResponses;

      if (survey.expected_participants && survey.expected_participants > 0) {
        courseStats[key].responseRate = Math.round((surveyResponses / survey.expected_participants) * 100);
      }
    });

    Object.values(courseStats).forEach(course => {
      let totalSubjectSatisfaction = 0;
      let totalInstructorSatisfaction = 0;
      let totalOperationSatisfaction = 0;
      let subjectCount = 0;
      let instructorCount = 0;
      let operationCount = 0;

      course.surveys.forEach(survey => {
        const surveyQuestions = allQuestions.filter(q => q.survey_id === survey.id);
        const surveyResponses = allResponses.filter(r => r.survey_id === survey.id);
        const surveyAnswers = allAnswers.filter(a => surveyResponses.some(r => r.id === a.response_id));

        surveyQuestions.forEach(question => {
          const satisfactionType = question.satisfaction_type;
          const asNums = (arr: QuestionAnswer[]) =>
            arr
              .map(a => parseInt(a.answer_text, 10))
              .filter(n => !Number.isNaN(n) && n > 0)
              .map(n => (n <= 5 ? n * 2 : n)); // 5점척도 → 10점 환산

          if (satisfactionType === 'course' || satisfactionType === 'subject') {
            const nums = asNums(surveyAnswers.filter(a => a.question_id === question.id));
            if (nums.length) {
              totalSubjectSatisfaction += nums.reduce((s, n) => s + n, 0);
              subjectCount += nums.length;
            }
          } else if (satisfactionType === 'instructor') {
            const nums = asNums(surveyAnswers.filter(a => a.question_id === question.id));
            if (nums.length) {
              totalInstructorSatisfaction += nums.reduce((s, n) => s + n, 0);
              instructorCount += nums.length;
            }
          } else if (satisfactionType === 'operation') {
            const nums = asNums(surveyAnswers.filter(a => a.question_id === question.id));
            if (nums.length) {
              totalOperationSatisfaction += nums.reduce((s, n) => s + n, 0);
              operationCount += nums.length;
            }
          }
        });
      });

      course.subjectSatisfaction = subjectCount ? parseFloat((totalSubjectSatisfaction / subjectCount).toFixed(1)) : 0;
      course.instructorSatisfaction = instructorCount ? parseFloat((totalInstructorSatisfaction / instructorCount).toFixed(1)) : 0;
      course.operationSatisfaction = operationCount ? parseFloat((totalOperationSatisfaction / operationCount).toFixed(1)) : 0;
    });

    return Object.entries(courseStats)
      .map(([key, data]) => ({
        key,
        ...data,
        displayName: `${data.year}년 ${data.round}차 - ${data.courseName}`,
      }))
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.round !== b.round) return b.round - a.round;
        return (a.courseName || '').localeCompare(b.courseName || '');
      });
  };

  const getQuestionAnalysis = () => {
    const sortedQuestions = [...questions].sort((a, b) => a.order_index - b.order_index);
    return sortedQuestions.map(question => {
      const questionAnswers = answers.filter(a => a.question_id === question.id);

      if (question.question_type === 'multiple_choice' || question.question_type === 'single_choice') {
        const opts = (question.options ?? []) as string[];
        const answerCounts: Record<string, number> = {};
        opts.forEach(option => {
          answerCounts[option] = 0;
        });
        questionAnswers.forEach(answer => {
          if (answer.answer_text in answerCounts) {
            answerCounts[answer.answer_text] += 1;
          }
        });
        const chartData = Object.entries(answerCounts).map(([option, count]) => ({
          name: option,
          value: count as number,
          percentage: questionAnswers.length > 0 ? Math.round(((count as number) / questionAnswers.length) * 100) : 0,
        }));
        return {
          question,
          totalAnswers: questionAnswers.length,
          chartData,
          type: 'chart' as const,
        };
      } else if (question.question_type === 'rating') {
        const ratings = questionAnswers.map(a => parseInt(a.answer_text, 10)).filter(r => !Number.isNaN(r));
        const average = ratings.length > 0 ? (ratings.reduce((s, n) => s + n, 0) / ratings.length).toFixed(1) : '0';
        const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        ratings.forEach(r => {
          if (distribution[r as 1 | 2 | 3 | 4 | 5] !== undefined) distribution[r as 1 | 2 | 3 | 4 | 5] += 1;
        });
        const chartData = Object.entries(distribution).map(([score, count]) => ({
          name: `${score}점`,
          value: count as number,
          percentage: ratings.length > 0 ? Math.round(((count as number) / ratings.length) * 100) : 0,
        }));
        return {
          question,
          totalAnswers: questionAnswers.length,
          average,
          chartData,
          type: 'rating' as const,
        };
      } else {
        return {
          question,
          totalAnswers: questionAnswers.length,
          answers: questionAnswers.slice(0, 10),
          type: 'text' as const,
        };
      }
    });
  };

  const questionAnalyses = selectedSurvey ? getQuestionAnalysis() : [];
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

  const handleSendResults = async () => {
    if (!selectedSurvey) {
      toast({ title: '오류', description: '결과를 전송할 설문을 선택해주세요.', variant: 'destructive' });
      return;
    }
    if (selectedRecipients.length === 0) {
      toast({ title: '오류', description: '발송할 수신자를 선택해주세요.', variant: 'destructive' });
      return;
    }

    setSendingResults(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-survey-results', {
        body: { surveyId: selectedSurvey, recipients: selectedRecipients },
      });
      if (error) throw error;

      const results = (data as any)?.results as Array<{ to: string; name?: string; status: 'sent' | 'failed' }> | undefined;
      const recipientNames = (data as any)?.recipientNames as Record<string, string> | undefined;

      const sent = results?.filter(r => r.status === 'sent') ?? [];
      const failed = results?.filter(r => r.status === 'failed') ?? [];

      const label = (arr: typeof sent) => arr.map(r => r.name || recipientNames?.[r.to] || r.to.split('@')[0]).join(', ');

      toast({
        title: failed.length === 0 ? '✅ 이메일 전송 완료!' : '⚠️ 일부 전송 실패',
        description:
          failed.length === 0
            ? `${sent.length}명에게 설문 결과가 성공적으로 전송되었습니다. 📧\n받는 분: ${label(sent)}`
            : `성공 ${sent.length}건${sent.length ? `: ${label(sent)}` : ''}\n실패 ${failed.length}건: ${label(failed as any)}`,
        duration: 6000,
      });

      setEmailDialogOpen(false);
      setSelectedRecipients([]);
    } catch (err: any) {
      console.error('Error sending results:', err);
      toast({ title: '오류', description: err?.message || '결과 전송 중 오류가 발생했습니다.', variant: 'destructive' });
    } finally {
      setSendingResults(false);
    }
  };

  const handleExportCSV = (type: 'responses' | 'summary') => {
    if (!selectedSurvey) {
      toast({ title: '오류', description: '내보낼 설문을 선택해주세요.', variant: 'destructive' });
      return;
    }
    const survey = surveys.find(s => s.id === selectedSurvey);
    if (!survey) return;

    try {
      const exportData: SurveyResultData = {
        survey: {
          id: survey.id,
          title: survey.title,
          education_year: survey.education_year,
          education_round: survey.education_round,
          instructor_name: instructor?.name,
          course_title: undefined,
        },
        responses,
        questions,
        answers,
      };

      const filename = generateCSVFilename(exportData.survey, type);
      const csv = type === 'responses' ? exportResponsesAsCSV(exportData) : exportSummaryAsCSV(exportData);
      downloadCSV(csv, filename);
      toast({ title: '성공', description: `${type === 'responses' ? '응답 데이터' : '요약 통계'}가 CSV 파일로 다운로드되었습니다.` });
    } catch (err) {
      console.error('CSV export error:', err);
      toast({ title: '오류', description: 'CSV 내보내기 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  const openEmailDialog = (surveyId?: string) => {
    const targetSurvey = surveyId || selectedSurvey;
    if (!targetSurvey) {
      toast({ title: '오류', description: '결과를 전송할 설문을 선택해주세요.', variant: 'destructive' });
      return;
    }
    if (surveyId && surveyId !== selectedSurvey) setSelectedSurvey(surveyId);
    setSelectedRecipients(['admin', 'instructor']);
    setEmailDialogOpen(true);
  };

  const toggleRecipient = (t: string) => {
    setSelectedRecipients(prev => (prev.includes(t) ? prev.filter(r => r !== t) : [...prev, t]));
  };

  const stats = getStatistics();
  const courseStats = getCourseStatistics();

  const DesktopActions = () => (
    <div className="flex items-center gap-2">
      <TestDataToggle testDataOptions={testDataOptions} />
      {selectedSurvey && (
        <Button variant="outline" onClick={() => openEmailDialog()}>
          <Send className="h-4 w-4 mr-2" />
          결과 발송
        </Button>
      )}
    </div>
  );

  const MobileActions = () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>설문 결과 메뉴</SheetTitle>
        </SheetHeader>
        <div className="py-4 space-y-4">
          <TestDataToggle testDataOptions={testDataOptions} />
          {selectedSurvey && (
            <Button className="w-full justify-start" variant="outline" onClick={() => openEmailDialog()}>
              <Send className="h-4 w-4 mr-2" />
              결과 발송
            </Button>
          )}
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="font-medium">통계 요약</div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>총 설문:</span>
                <span className="font-medium">{stats.totalSurveys}</span>
              </div>
              <div className="flex justify-between">
                <span>총 응답:</span>
                <span className="font-medium">{stats.totalResponses}</span>
              </div>
              <div className="flex justify-between">
                <span>진행중:</span>
                <span className="font-medium">{stats.activeSurveys}</span>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <AdminLayout
      title="설문 결과 분석"
      description={
        canViewAll
          ? '전체 설문조사 결과 및 통계를 확인할 수 있습니다'
          : instructor
            ? `${instructor.name} 강사의 설문조사 결과를 확인할 수 있습니다`
            : '담당 강의의 설문조사 결과를 확인할 수 있습니다'
      }
      loading={loading}
      desktopActions={<DesktopActions />}
      mobileActions={<MobileActions />}
    >
      <div className="space-y-6">
        {/* 강사 정보 */}
        {isInstructor && instructor && (
          <section aria-label="강사 정보" className="rounded-xl border bg-card p-4 sm:p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 ring-2 ring-primary/20">
                <AvatarImage src={instructor.photo_url ?? ''} alt={`${instructor.name} 강사 사진`} className="object-cover" />
                <AvatarFallback>{(instructor.name || 'IN').slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold leading-tight break-words">{instructor.name}</h2>
                {instructor.email && <p className="text-sm text-muted-foreground break-words">{instructor.email}</p>}
                <p className="text-xs text-muted-foreground mt-1">담당 강사의 설문 결과입니다.</p>
              </div>
            </div>
          </section>
        )}

        {/* 필터 */}
        <div className="flex gap-2 sm:gap-4 flex-wrap">
          <Select
            value={selectedYear}
            onValueChange={(value) => {
              setSelectedYear(value);
              setSelectedRound('');
            }}
          >
            <SelectTrigger className="w-24 sm:w-32">
              <SelectValue placeholder="전체 연도" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              {getUniqueYears().map((year) => (
                <SelectItem key={year} value={String(year)}>{year}년</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedRound} onValueChange={setSelectedRound}>
            <SelectTrigger className="w-24 sm:w-32">
              <SelectValue placeholder="전체 차수" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              {getUniqueRounds().map((round) => (
                <SelectItem key={round} value={String(round)}>{round}차</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canViewAll && (
            <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
              <SelectTrigger className="w-32 sm:w-48">
                <SelectValue placeholder="전체 강사" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">전체 강사</SelectItem>
                {allInstructors.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id} className="break-words">
                    {inst.name} {inst.email ? `(${inst.email})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select
            value={selectedCourse || 'all'}
            onValueChange={(value) => setSelectedCourse(value === 'all' ? '' : value)}
          >
            <SelectTrigger className="w-40 sm:w-64">
              <SelectValue placeholder="전체 과정" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="all">전체 과정</SelectItem>
              {availableCourses.map((course) => (
                <SelectItem key={course.key} value={course.key} className="break-words">
                  {course.year}년 {course.round}차 - {course.course_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(selectedYear || selectedRound || selectedCourse || (canViewAll && selectedInstructor !== 'all')) && (
            <Button
              variant="outline"
              className="text-sm border-2 border-muted-foreground/30 hover:border-primary hover:bg-muted/50"
              onClick={() => {
                setSelectedYear('');
                setSelectedRound('');
                setSelectedCourse('');
                setSelectedInstructor('all');
              }}
            >
              필터 초기화
            </Button>
          )}
        </div>

        {/* 통계 요약 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-3">
            <div className="text-center">
              <div className="text-lg sm:text-xl font-bold text-primary">{stats.totalSurveys}</div>
              <div className="text-xs text-muted-foreground">총 설문</div>
            </div>
          </Card>
        <Card className="p-3">
            <div className="text-center">
              <div className="text-lg sm:text-xl font-bold text-primary">{stats.totalResponses}</div>
              <div className="text-xs text-muted-foreground">총 응답</div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-center">
              <div className="text-lg sm:text-xl font-bold text-primary">{stats.activeSurveys}</div>
              <div className="text-xs text-muted-foreground">진행중</div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-center">
              <div className="text-lg sm:text-xl font-bold text-primary">{stats.completedSurveys}</div>
              <div className="text-xs text-muted-foreground">완료</div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-center">
              <div className="text-lg sm:text-xl font-bold text-primary">{stats.avgResponseRate}</div>
              <div className="text-xs text-muted-foreground">평균 응답률</div>
            </div>
          </Card>
        </div>

        {/* 과정별 만족도 트렌드 */}
        {courseStats.length > 0 ? (
          <Card className="border-2 border-muted-foreground/30">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                과정별 만족도 트렌드
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsBarChart data={courseStats.slice(0, 8).reverse()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="displayName" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: any, name: string) => [
                      `${Number(value).toFixed(1)}/10`,
                      name === 'subjectSatisfaction'
                        ? '과정 만족도'
                        : name === 'instructorSatisfaction'
                          ? '강사 만족도'
                          : '운영 만족도',
                    ]}
                  />
                  <Legend
                    formatter={(value) =>
                      value === 'subjectSatisfaction'
                        ? '과정 만족도'
                        : value === 'instructorSatisfaction'
                          ? '강사 만족도'
                          : '운영 만족도'
                    }
                  />
                  <Bar dataKey="subjectSatisfaction" name="subjectSatisfaction" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="instructorSatisfaction" name="instructorSatisfaction" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="operationSatisfaction" name="operationSatisfaction" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </RechartsBarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2 border-muted-foreground/30">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                과정별 만족도 트렌드
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
                        <span className="text-sm text-muted-foreground">과정 만족도</span>
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
                                course.operationSatisfaction >= 8
                                  ? 'default'
                                  : course.operationSatisfaction >= 6
                                    ? 'secondary'
                                    : 'destructive'
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
                  <div
                    key={survey.id}
                    className="p-3 border rounded-lg transition-colors hover:bg-muted/50"
                  >
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
                            응답 수: {allResponses.filter(r => r.survey_id === survey.id).length}개
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
                  <TabsTrigger value="overview" className="text-sm">전체 분석</TabsTrigger>
                  <TabsTrigger value="round-stats" className="text-sm">회차별 통계</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  {questionAnalyses.length > 0 ? (
                    <div className="space-y-6">
                      {/* 상단 카드 4 */}
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
                                        <BarChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
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
                                          <BarChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
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
                                    analysis.answers!.map((a) => (
                                      <div key={a.id} className="p-2 rounded border bg-card/50">
                                        {a.answer_text || '(빈 응답)'}
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
                      <BarChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>분석할 응답이 없습니다.</p>
                    </div>
                  )}
                </TabsContent>

                {/* 회차별 통계 탭(향후 확장 자리표시자) */}
                <TabsContent value="round-stats">
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    회차별 통계는 곧 제공될 예정입니다.
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default SurveyResults;
