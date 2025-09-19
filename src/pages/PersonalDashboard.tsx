import { useState, useEffect, useCallback } from 'react';
import type { FC } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, TrendingUp, Users, Award, BarChart3, Download, ArrowLeft, Eye } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
} from 'recharts';
import { Progress } from '@/components/ui/progress';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { formatDateTime, formatMessage, formatNumber, MESSAGE_KEYS } from '@/utils/formatters';

interface Survey {
  id: string;
  title: string;
  education_year: number;
  education_round: number;
  status: string;
  instructor_id: string;
  created_at: string;
  course_name?: string;
}

interface SurveyResponse {
  id: string;
  survey_id: string;
  submitted_at: string;
  respondent_email: string;
}

interface QuestionAnswer {
  id: string;
  question_id: string;
  answer_text: string;
  answer_value: any;
  response_id: string;
}

interface SurveyQuestion {
  id: string;
  question_text: string;
  question_type: string;
  satisfaction_type: string;
  survey_id: string;
  order_index: number;
  options?: any;
}

interface Profile {
  role: string;
  instructor_id: string;
}

const normalizeCourseName = (courseName?: string | null) => {
  if (!courseName) return null;
  const match = courseName.match(/.*?-\s*(.+)$/);
  return match ? match[1].trim() : courseName.trim();
};

const PersonalDashboard: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userRoles } = useAuth();
  const { toast } = useToast();

  // Preview parameters for admin/developer to view as instructor
  const searchParams = new URLSearchParams(location.search);
  const viewAs = searchParams.get('viewAs');
  const previewInstructorId = searchParams.get('instructorId');
  const previewInstructorEmail = searchParams.get('instructorEmail');

  const [profile, setProfile] = useState<Profile | null>(null);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [allSurveys, setAllSurveys] = useState<Survey[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('round');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedRound, setSelectedRound] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const isInstructor = userRoles.includes('instructor');
  const isPreviewingInstructor = viewAs === 'instructor';
  const asInstructor = isInstructor || isPreviewingInstructor;
  const canViewPersonalStats = asInstructor || userRoles.includes('admin');

  /* ─────────────────────────────────── Fetchers ─────────────────────────────────── */
  const fetchProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, instructor_id')
        .eq('id', user.id)
        .maybeSingle();
      if (error && (error as any).code !== 'PGRST116') {
        console.error('프로필 조회 오류:', error);
      }
      setProfile(data);
    } catch (error) {
      console.error('fetchProfile 오류:', error);
    }
  }, [user]);

  const fetchData = useCallback(async () => {
    if (!canViewPersonalStats) return;

    console.log('PersonalDashboard fetchData 시작', { 
      isPreviewingInstructor, 
      previewInstructorId, 
      asInstructor, 
      canViewPersonalStats 
    });

    setLoading(true);
    try {
      let surveyQuery = supabase.from('surveys').select('*');
      let instructorId = profile?.instructor_id;

      // 강사(또는 강사로 미리보기)인 경우 대상 instructor_id 확인 및 설정
      if (asInstructor) {
        // 미리보기로 특정 강사를 지정한 경우 우선 사용
        if (isPreviewingInstructor && previewInstructorId) {
          instructorId = previewInstructorId;
        } else if (!isPreviewingInstructor) {
          // 실제 강사 계정인데 instructor_id가 없는 경우 이메일로 매칭 시도
          if (!instructorId && user?.email) {
            const { data: instructorData } = await supabase
              .from('instructors')
              .select('id')
              .eq('email', user.email)
              .maybeSingle();
            if (instructorData) {
              instructorId = instructorData.id;
              // 프로필에 instructor_id 업데이트
              await supabase
                .from('profiles')
                .update({ instructor_id: instructorData.id })
                .eq('id', user.id);
              setProfile(prev => prev ? { ...prev, instructor_id: instructorData.id } : null);
            }
          }
        }
        
        // 강사는(또는 미리보기) 본인 설문만 조회
        if (instructorId) {
          console.log('강사 설문 조회 시작', { instructorId });
          surveyQuery = surveyQuery.eq('instructor_id', instructorId);
        } else {
          console.log('instructor_id 없음, 빈 결과 반환');
          // instructor_id가 없는 경우 빈 결과 반환
          setSurveys([]);
          setResponses([]);
          setQuestions([]);
          setAnswers([]);
          setLoading(false);
          return;
        }
      }

      // 필터 적용
      if (selectedYear && selectedYear !== 'all') {
        surveyQuery = surveyQuery.eq('education_year', parseInt(selectedYear));
      }
      if (selectedRound && selectedRound !== 'all' && selectedRound !== 'latest') {
        surveyQuery = surveyQuery.eq('education_round', parseInt(selectedRound));
      }
      const { data: surveysData, error: surveysError } = await surveyQuery
        .order('education_year', { ascending: false })
        .order('education_round', { ascending: false });

      console.log('설문 조회 결과', { surveysData, surveysError });

      if (surveysError) throw surveysError;

      setAllSurveys(surveysData || []);

      let filteredSurveys = surveysData || [];

      if (selectedCourse && selectedCourse !== 'all') {
        filteredSurveys = filteredSurveys.filter(
          survey => normalizeCourseName(survey.course_name) === selectedCourse
        );
      }

      // 최신 회차 필터링
      if (selectedRound === 'latest' && filteredSurveys.length > 0) {
        const latestYear = Math.max(...filteredSurveys.map(s => s.education_year));
        const latestYearSurveys = filteredSurveys.filter(s => s.education_year === latestYear);
        const latestRound = Math.max(...latestYearSurveys.map(s => s.education_round));
        filteredSurveys = filteredSurveys.filter(
          s => s.education_year === latestYear && s.education_round === latestRound
        );
      }

      setSurveys(filteredSurveys);

      // 응답/질문/답변 로드 - 원본 surveysData 사용 (필터링 전 데이터)
      if (filteredSurveys && filteredSurveys.length > 0) {
        const allSurveyIds = filteredSurveys.map(s => s.id);

        const { data: responsesData, error: responsesError } = await supabase
          .from('survey_responses')
          .select('*')
          .in('survey_id', allSurveyIds);
        if (responsesError) throw responsesError;
        setResponses(responsesData || []);

        const { data: questionsData, error: questionsError } = await supabase
          .from('survey_questions')
          .select('*')
          .in('survey_id', allSurveyIds);
        if (questionsError) throw questionsError;
        setQuestions(questionsData || []);

        if (responsesData && responsesData.length > 0) {
          const responseIds = responsesData.map(r => r.id);
          const { data: answersData, error: answersError } = await supabase
            .from('question_answers')
            .select('*')
            .in('response_id', responseIds);
          if (answersError) throw answersError;
          setAnswers(answersData || []);
        } else {
          setAnswers([]);
        }
      } else {
        setResponses([]);
        setQuestions([]);
        setAnswers([]);
      }
    } catch (error) {
      console.error('fetchData 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [canViewPersonalStats, profile?.instructor_id, asInstructor, isPreviewingInstructor, previewInstructorId, user?.email, selectedYear, selectedRound, selectedCourse]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await fetchProfile();
      await fetchData();
    } finally {
      setLoading(false);
    }
  }, [fetchProfile, fetchData]);

  /* ─────────────────────────────────── Effects ─────────────────────────────────── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await fetchProfile();
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile && canViewPersonalStats) {
      fetchData();
    }
  }, [profile, canViewPersonalStats, fetchData, selectedPeriod, selectedYear, selectedRound, selectedCourse]);

  /* ─────────────────────────────────── Derivations ─────────────────────────────────── */
  const getBaseSurveysForOptions = () => {
    let baseSurveys = allSurveys;

    if (selectedYear && selectedYear !== 'all') {
      baseSurveys = baseSurveys.filter(s => s.education_year.toString() === selectedYear);
    }

    if (selectedRound && selectedRound !== 'all') {
      if (selectedRound === 'latest' && baseSurveys.length > 0) {
        const latestYear = Math.max(...baseSurveys.map(s => s.education_year));
        const latestYearSurveys = baseSurveys.filter(s => s.education_year === latestYear);
        const latestRound = Math.max(...latestYearSurveys.map(s => s.education_round));
        baseSurveys = baseSurveys.filter(
          s => s.education_year === latestYear && s.education_round === latestRound
        );
      } else if (selectedRound !== 'latest') {
        baseSurveys = baseSurveys.filter(s => s.education_round.toString() === selectedRound);
      }
    }

    return baseSurveys;
  };

  const getUniqueYears = () => {
    const years = [...new Set(allSurveys.map(s => s.education_year))];
    return years.sort((a, b) => b - a);
  };

  const getUniqueRounds = () => {
    const baseSurveys = getBaseSurveysForOptions();
    const rounds = [...new Set(baseSurveys.map(s => s.education_round))];
    return rounds.sort((a, b) => a - b);
  };

  const getUniqueCourses = () => {
    const baseSurveys = getBaseSurveysForOptions();
    const courses = baseSurveys
      .map(survey => normalizeCourseName(survey.course_name))
      .filter((course, index, self) => course && self.indexOf(course) === index)
      .sort();
    return courses as string[];
  };

  const getTrendData = () => {
    const ratingQuestions = questions.filter(q => q.question_type === 'rating' || q.question_type === 'scale');

    let filteredSurveys = surveys;
    if (selectedYear && selectedYear !== 'all') {
      filteredSurveys = surveys.filter(s => s.education_year.toString() === selectedYear);
    }
    if (selectedRound && selectedRound !== 'all' && selectedRound !== 'latest') {
      filteredSurveys = filteredSurveys.filter(s => s.education_round.toString() === selectedRound);
    }
    if (selectedCourse && selectedCourse !== 'all') {
      filteredSurveys = filteredSurveys.filter(
        survey => normalizeCourseName(survey.course_name) === selectedCourse
      );
    }
    if (selectedRound === 'latest' && filteredSurveys.length > 0) {
      const latestYear = Math.max(...filteredSurveys.map(s => s.education_year));
      const latestYearSurveys = filteredSurveys.filter(s => s.education_year === latestYear);
      const latestRound = Math.max(...latestYearSurveys.map(s => s.education_round));
      filteredSurveys = filteredSurveys.filter(s => s.education_year === latestYear && s.education_round === latestRound);
    }

    if (selectedPeriod === 'round') {
      const roundData: Record<string, { total: number; count: number; responses: number; courses: Set<string> }> = {};
      filteredSurveys.forEach(survey => {
        const roundKey = `${survey.education_year}-${survey.education_round}차`;
        if (!roundData[roundKey]) roundData[roundKey] = { total: 0, count: 0, responses: 0, courses: new Set() };
        
        // Add course to track course diversity
        if (survey.course_name) {
          const courseType = normalizeCourseName(survey.course_name);
          if (courseType) {
            roundData[roundKey].courses.add(courseType);
          }
        }
        
        const surveyResponses = responses.filter(r => r.survey_id === survey.id);
        roundData[roundKey].responses += surveyResponses.length;

        surveyResponses.forEach(response => {
          const responseAnswers = answers.filter(a => a.response_id === response.id);
          const ratingAnswers = responseAnswers.filter(a => ratingQuestions.some(q => q.id === a.question_id));
          ratingAnswers.forEach(answer => {
            const rating = parseFloat(answer.answer_text);
            if (!isNaN(rating) && rating > 0) {
              // Convert 5-point scale to 10-point scale
              const convertedRating = rating <= 5 ? rating * 2 : rating;
              roundData[roundKey].total += convertedRating;
              roundData[roundKey].count++;
            }
          });
        });
      });

      return Object.entries(roundData)
        .map(([round, data]) => ({
          period: round,
          average: data.count > 0 ? (data.total / data.count) : 0,
          responses: data.responses,
          satisfaction: data.count > 0 ? Math.round((data.total / data.count) * 10) : 0,
          courses: Array.from(data.courses).join(', '),
          courseCount: data.courses.size
        }))
        .sort((a, b) => a.period.localeCompare(b.period));
    }

    return [];
  };

  const getCourseBreakdown = () => {
    let filteredSurveys = surveys;
    if (selectedYear && selectedYear !== 'all') {
      filteredSurveys = surveys.filter(s => s.education_year.toString() === selectedYear);
    }
    if (selectedRound && selectedRound !== 'all' && selectedRound !== 'latest') {
      filteredSurveys = filteredSurveys.filter(s => s.education_round.toString() === selectedRound);
    }
    if (selectedRound === 'latest' && filteredSurveys.length > 0) {
      const latestYear = Math.max(...filteredSurveys.map(s => s.education_year));
      const latestYearSurveys = filteredSurveys.filter(s => s.education_year === latestYear);
      const latestRound = Math.max(...latestYearSurveys.map(s => s.education_round));
      filteredSurveys = filteredSurveys.filter(s => s.education_year === latestYear && s.education_round === latestRound);
    }

    const ratingQuestions = questions.filter(q => q.question_type === 'rating' || q.question_type === 'scale');
    const courseData: Record<string, { total: number; count: number; responses: number; surveys: number }> = {};

    filteredSurveys.forEach(survey => {
      const courseType = normalizeCourseName(survey.course_name);
      if (!courseType) return;

      if (!courseData[courseType]) {
        courseData[courseType] = { total: 0, count: 0, responses: 0, surveys: 0 };
      }
      
      courseData[courseType].surveys++;
      const surveyResponses = responses.filter(r => r.survey_id === survey.id);
      courseData[courseType].responses += surveyResponses.length;

      surveyResponses.forEach(response => {
        const responseAnswers = answers.filter(a => a.response_id === response.id);
        const ratingAnswers = responseAnswers.filter(a => ratingQuestions.some(q => q.id === a.question_id));
        ratingAnswers.forEach(answer => {
          const rating = parseFloat(answer.answer_text);
          if (!isNaN(rating) && rating > 0) {
            // Convert 5-point scale to 10-point scale
            const convertedRating = rating <= 5 ? rating * 2 : rating;
            courseData[courseType].total += convertedRating;
            courseData[courseType].count++;
          }
        });
      });
    });

    return Object.entries(courseData)
      .map(([course, data]) => ({
        course,
        avgSatisfaction: data.count > 0 ? +(data.total / data.count).toFixed(1) : 0,
        responses: data.responses,
        surveys: data.surveys,
        satisfactionPercentage: data.count > 0 ? Math.round((data.total / data.count) * 10) : 0
      }))
      .sort((a, b) => b.avgSatisfaction - a.avgSatisfaction);
  };

  const getSummaryStats = () => {
    let filtered = surveys;
    if (selectedYear && selectedYear !== 'all') {
      filtered = surveys.filter(s => s.education_year.toString() === selectedYear);
    }
    if (selectedRound && selectedRound !== 'all' && selectedRound !== 'latest') {
      filtered = filtered.filter(s => s.education_round.toString() === selectedRound);
    }
    if (selectedCourse && selectedCourse !== 'all') {
      filtered = filtered.filter(
        s => normalizeCourseName(s.course_name) === selectedCourse
      );
    }
    if (selectedRound === 'latest' && filtered.length > 0) {
      const latestYear = Math.max(...filtered.map(s => s.education_year));
      const latestYearSurveys = filtered.filter(s => s.education_year === latestYear);
      const latestRound = Math.max(...latestYearSurveys.map(s => s.education_round));
      filtered = filtered.filter(s => s.education_year === latestYear && s.education_round === latestRound);
    }

    const totalSurveys = filtered.length;
    const filteredResponses = responses.filter(r => filtered.some(s => s.id === r.survey_id));
    const totalResponses = filteredResponses.length;
    const activeSurveys = filtered.filter(s => s.status === 'active').length;

    const ratingQuestions = questions.filter(q => q.question_type === 'rating' || q.question_type === 'scale');
    const ratingAnswers = answers.filter(
      a => ratingQuestions.some(q => q.id === a.question_id) && filteredResponses.some(r => r.id === a.response_id)
    );
    const validRatings = ratingAnswers.map(a => parseFloat(a.answer_text)).filter(r => !isNaN(r) && r > 0);
    const avgSatisfaction = validRatings.length > 0 ? validRatings.reduce((sum, r) => sum + r, 0) / validRatings.length : 0;

    return {
      totalSurveys,
      totalResponses,
      activeSurveys,
      avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
      satisfactionPercentage: Math.round(avgSatisfaction * 10),
      avgResponsesPerSurvey: totalSurveys > 0 ? Math.round(totalResponses / totalSurveys) : 0,
    };
  };

  const getRatingDistribution = () => {
    const ratingQuestions = questions.filter(q => q.question_type === 'rating' || q.question_type === 'scale');
    const ratingCounts: Record<string, number> = {};
    
    let filteredSurveys = surveys;
    if (selectedYear && selectedYear !== 'all') {
      filteredSurveys = surveys.filter(s => s.education_year.toString() === selectedYear);
    }
    if (selectedRound && selectedRound !== 'all' && selectedRound !== 'latest') {
      filteredSurveys = filteredSurveys.filter(s => s.education_round.toString() === selectedRound);
    }
    if (selectedCourse && selectedCourse !== 'all') {
      filteredSurveys = filteredSurveys.filter(
        s => normalizeCourseName(s.course_name) === selectedCourse
      );
    }
    if (selectedRound === 'latest' && filteredSurveys.length > 0) {
      const latestYear = Math.max(...filteredSurveys.map(s => s.education_year));
      const latestYearSurveys = filteredSurveys.filter(s => s.education_year === latestYear);
      const latestRound = Math.max(...latestYearSurveys.map(s => s.education_round));
      filteredSurveys = filteredSurveys.filter(s => s.education_year === latestYear && s.education_round === latestRound);
    }

    filteredSurveys.forEach(survey => {
      const surveyResponses = responses.filter(r => r.survey_id === survey.id);
      surveyResponses.forEach(response => {
        const responseAnswers = answers.filter(a => a.response_id === response.id);
        const ratingAnswers = responseAnswers.filter(a => ratingQuestions.some(q => q.id === a.question_id));
        ratingAnswers.forEach(answer => {
          const rating = parseFloat(answer.answer_text);
          if (!isNaN(rating) && rating > 0) {
            // Convert 5-point scale to 10-point scale
            const convertedRating = rating <= 5 ? rating * 2 : rating;
            const ratingRange = convertedRating >= 9 ? '9-10점' : convertedRating >= 7 ? '7-8점' : convertedRating >= 5 ? '5-6점' : '1-4점';
            ratingCounts[ratingRange] = (ratingCounts[ratingRange] || 0) + 1;
          }
        });
      });
    });

    const totalRatings = Object.values(ratingCounts).reduce((sum, count) => sum + count, 0);
    
    return ['9-10점', '7-8점', '5-6점', '1-4점']
      .map(range => ({
        name: range,
        value: ratingCounts[range] || 0,
        percentage: totalRatings > 0 ? Math.round(((ratingCounts[range] || 0) / totalRatings) * 100) : 0
      }))
      .filter(item => item.value > 0);
  };

  // 과목-강사별 고유 조합 가져오기
  const getUniqueSubjects = () => {
    let filteredSurveys = surveys;
    if (selectedYear && selectedYear !== 'all') {
      filteredSurveys = surveys.filter(s => s.education_year.toString() === selectedYear);
    }
    if (selectedRound && selectedRound !== 'all' && selectedRound !== 'latest') {
      filteredSurveys = filteredSurveys.filter(s => s.education_round.toString() === selectedRound);
    }
    if (selectedCourse && selectedCourse !== 'all') {
      filteredSurveys = filteredSurveys.filter(
        survey => normalizeCourseName(survey.course_name) === selectedCourse
      );
    }
    if (selectedRound === 'latest' && filteredSurveys.length > 0) {
      const latestYear = Math.max(...filteredSurveys.map(s => s.education_year));
      const latestYearSurveys = filteredSurveys.filter(s => s.education_year === latestYear);
      const latestRound = Math.max(...latestYearSurveys.map(s => s.education_round));
      filteredSurveys = filteredSurveys.filter(s => s.education_year === latestYear && s.education_round === latestRound);
    }

    const subjectMap = new Map();
    
    filteredSurveys.forEach(survey => {
      const rawCourseName = survey.course_name || survey.title;
      const courseType = normalizeCourseName(rawCourseName) || rawCourseName;

      const key = `${courseType}`;
      if (!subjectMap.has(key)) {
        subjectMap.set(key, {
          key,
          courseName: courseType,
          displayName: courseType,
          surveys: [],
          totalResponses: 0
        });
      }
      
      const subject = subjectMap.get(key);
      subject.surveys.push(survey);
      subject.totalResponses += responses.filter(r => r.survey_id === survey.id).length;
    });

    return Array.from(subjectMap.values());
  };

  // 특정 과목의 상세 분석
  const getSubjectDetailedAnalysis = (subjectSurveys: Survey[]) => {
    const subjectSurveyIds = subjectSurveys.map(s => s.id);
    const subjectQuestions = questions.filter(q => subjectSurveyIds.includes(q.survey_id));
    const subjectResponses = responses.filter(r => subjectSurveyIds.includes(r.survey_id));
    const subjectAnswers = answers.filter(a => 
      subjectResponses.some(r => r.id === a.response_id)
    );

    // 질문 분류
    const subjectQuestionsList: SurveyQuestion[] = [];
    const instructorQuestionsList: SurveyQuestion[] = [];
    const operationQuestionsList: SurveyQuestion[] = [];

    subjectQuestions.forEach((question) => {
      const type = question.satisfaction_type;
      if (type === 'instructor') {
        instructorQuestionsList.push(question);
      } else if (type === 'operation') {
        operationQuestionsList.push(question);
      } else if (type === 'course' || type === 'subject') {
        subjectQuestionsList.push(question);
      } else {
        // 타입 정보가 없을 때: 평점형은 과목으로 분류
        if (question.question_type === 'rating' || question.question_type === 'scale') {
          subjectQuestionsList.push(question);
        } else {
          subjectQuestionsList.push(question);
        }
      }
    });

    // 각 카테고리 분석
    const getQuestionAnalysis = (questionList: SurveyQuestion[]) => {
      const sortedQuestions = [...questionList].sort((a, b) => a.order_index - b.order_index);
      return sortedQuestions.map(question => {
        const questionAnswers = subjectAnswers.filter(a => a.question_id === question.id);
        
        if (question.question_type === 'multiple_choice' || question.question_type === 'single_choice') {
          const options = question.options || [];
          const answerCounts = {};
          
          options.forEach(option => {
            answerCounts[option] = 0;
          });
          
          questionAnswers.forEach(answer => {
            if (answer.answer_text && answerCounts.hasOwnProperty(answer.answer_text)) {
              answerCounts[answer.answer_text]++;
            }
          });
          
          const chartData = Object.entries(answerCounts).map(([option, count]) => ({
            name: option,
            value: count as number,
            percentage: questionAnswers.length > 0 ? Math.round(((count as number) / questionAnswers.length) * 100) : 0
          }));
          
          return {
            question,
            totalAnswers: questionAnswers.length,
            chartData,
            type: 'chart'
          };
        } else if (question.question_type === 'rating' || question.question_type === 'scale') {
          const ratings = questionAnswers.map(a => parseInt(a.answer_text)).filter(r => !isNaN(r));
          const maxScore = Math.max(...ratings);
          let convertedRatings = ratings;
          
          if (maxScore <= 5) {
            convertedRatings = ratings.map(r => r * 2);
          }
          
          const average = convertedRatings.length > 0 ? (convertedRatings.reduce((sum, r) => sum + r, 0) / convertedRatings.length).toFixed(1) : '0';
          
          const distribution = {};
          for (let i = 1; i <= 10; i++) {
            distribution[i] = convertedRatings.filter(r => r === i).length;
          }
          
          const chartData = Object.entries(distribution).map(([score, count]) => ({
            name: `${score}점`,
            value: count as number,
            percentage: convertedRatings.length > 0 ? Math.round(((count as number) / convertedRatings.length) * 100) : 0
          }));
          
          return {
            question,
            totalAnswers: questionAnswers.length,
            average,
            chartData,
            type: 'rating'
          };
        } else {
          return {
            question,
            totalAnswers: questionAnswers.length,
            answers: questionAnswers.slice(0, 10),
            type: 'text'
          };
        }
      });
    };

    // 카테고리별 평균 계산
    const calculateCategoryAverage = (questionList: SurveyQuestion[]) => {
      const ratingQuestions = questionList.filter(q => q.question_type === 'rating' || q.question_type === 'scale');
      if (ratingQuestions.length === 0) return '0';

      let totalScore = 0;
      let totalCount = 0;

      ratingQuestions.forEach(question => {
        const questionAnswers = subjectAnswers.filter(a => a.question_id === question.id);
        const ratings = questionAnswers.map(a => parseInt(a.answer_text)).filter(r => !isNaN(r));
        
        if (ratings.length > 0) {
          const maxScore = Math.max(...ratings);
          let convertedRatings = ratings;
          
          if (maxScore <= 5) {
            convertedRatings = ratings.map(r => r * 2);
          }
          
          totalScore += convertedRatings.reduce((sum, r) => sum + r, 0);
          totalCount += convertedRatings.length;
        }
      });

      return totalCount > 0 ? (totalScore / totalCount).toFixed(1) : '0';
    };

    return {
      subjectQuestions: subjectQuestionsList,
      instructorQuestions: instructorQuestionsList,
      operationQuestions: operationQuestionsList,
      subjectAnalyses: getQuestionAnalysis(subjectQuestionsList),
      instructorAnalyses: getQuestionAnalysis(instructorQuestionsList),
      operationAnalyses: getQuestionAnalysis(operationQuestionsList),
      subjectAverage: calculateCategoryAverage(subjectQuestionsList),
      instructorAverage: calculateCategoryAverage(instructorQuestionsList),
      operationAverage: calculateCategoryAverage(operationQuestionsList)
    };
  };

  // 질문 분석 렌더링
  const renderQuestionAnalysis = (analysis: any, index: number) => (
    <Card key={analysis.question.id}>
      <CardHeader>
        <CardTitle className="text-lg">
          Q{index + 1}. {analysis.question.question_text}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          총 응답 수: {analysis.totalAnswers}개
          {analysis.question.is_required && (
            <Badge variant="secondary" className="ml-2">필수</Badge>
          )}
        </p>
      </CardHeader>
      <CardContent>
        {analysis.type === 'chart' && (
          <div className="space-y-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analysis.chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {analysis.chartData.map((entry: any, idx: number) => (
                      <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number | string, _name: string, props: any) => {
                      const percentage = props?.payload?.percentage ?? 0;
                      return [`${value}개 (${percentage}%)`, props?.payload?.name ?? props?.name ?? ''];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis.chartData.map((item: any, idx: number) => (
                <div key={item.name} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <span className="text-sm">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatMessage(MESSAGE_KEYS.common.countWithUnit, {
                        count: formatNumber(item.value),
                        unit: '개',
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatMessage(MESSAGE_KEYS.common.percentage, {
                        value: formatNumber(item.percentage),
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {analysis.type === 'rating' && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{analysis.average}</div>
              <p className="text-sm text-muted-foreground">평균 점수 (10점 만점)</p>
            </div>
            <div className="space-y-2">
              {analysis.chartData.map((item: any, idx: number) => (
                <div key={item.name} className="flex items-center gap-4">
                  <span className="text-sm w-12">{item.name}</span>
                  <div className="flex-1">
                    <Progress value={item.percentage} className="h-2" />
                  </div>
                  <span className="text-sm text-muted-foreground w-16">
                    {formatMessage(MESSAGE_KEYS.analysis.valueWithPercentage, {
                      count: formatNumber(item.value),
                      percentage: formatNumber(item.percentage),
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {analysis.type === 'text' && (
          <div className="space-y-3">
            {analysis.answers && analysis.answers.length > 0 ? (
              analysis.answers.map((answer: any, idx: number) => (
                <div key={answer.id} className="p-3 border rounded-lg">
                  <p className="text-sm">{answer.answer_text}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDateTime(answer.created_at)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-center py-8">
                {formatMessage(MESSAGE_KEYS.common.noResponses)}
              </p>
            )}
            {analysis.totalAnswers > 10 && (
              <p className="text-sm text-muted-foreground text-center">
                {formatMessage(MESSAGE_KEYS.common.recentResponsesLimited, {
                  count: formatNumber(analysis.totalAnswers),
                })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const generatePersonalStatsCSV = () => {
    let csvContent = '\uFEFF';
    const stats = getSummaryStats();
    const trendData = getTrendData();

    csvContent += '개인 통계 요약\n';
    csvContent += `총 설문,${stats.totalSurveys}\n`;
    csvContent += `총 응답,${stats.totalResponses}\n`;
    csvContent += `활성 설문,${stats.activeSurveys}\n`;
    csvContent += `평균 만족도,${stats.avgSatisfaction}\n`;
    csvContent += `만족도 백분율,${stats.satisfactionPercentage}%\n`;
    csvContent += `설문당 평균 응답,${stats.avgResponsesPerSurvey}\n\n`;

    csvContent += '기간별 트렌드\n';
    csvContent += '기간,평균 만족도,응답 수,만족도(%)\n';
    trendData.forEach(item => {
      csvContent += `${item.period},${item.average.toFixed(1)},${item.responses},${item.satisfaction}%\n`;
    });

    return csvContent;
  };

  const handlePrint = () => {
    window.print();
  };

  const trendData = getTrendData();
  const summaryStats = getSummaryStats();
  const ratingDistribution = getRatingDistribution();
  const courseBreakdown = getCourseBreakdown();
  const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];

  /* ─────────────────────────────────── Header Actions ─────────────────────────────────── */
  const desktopActions = [
    <Button
      key="csv"
      variant="outline"
      size="sm"
      className="rounded-full px-3 gap-2"
      onClick={() => {
        const element = document.createElement('a');
        const csvContent = generatePersonalStatsCSV();
        const file = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        element.href = URL.createObjectURL(file);
        element.download = `개인통계_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        toast({ title: '다운로드 완료', description: '개인 통계 CSV 파일이 다운로드되었습니다.' });
      }}
    >
      <Download className="h-4 w-4" />
      CSV 다운로드
    </Button>,
    <Button
      key="print"
      variant="outline"
      size="sm"
      className="rounded-full px-3"
      onClick={handlePrint}
    >
      인쇄
    </Button>,
  ];

  const mobileActions = [
    <Button
      key="csv-m"
      variant="outline"
      size="sm"
      className="rounded-full"
      onClick={() => {
        const element = document.createElement('a');
        const csvContent = generatePersonalStatsCSV();
        const file = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        element.href = URL.createObjectURL(file);
        element.download = `개인통계_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        toast({ title: '다운로드 완료', description: '개인 통계 CSV 파일이 다운로드되었습니다.' });
      }}
    >
      <Download className="h-4 w-4" />
    </Button>,
  ];

  /* ─────────────────────────────────── Render ─────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* 미리보기 표시 */}
      {isPreviewingInstructor && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">
                강사 페이지 미리보기 모드
              </span>
              {previewInstructorId && (
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  강사 ID: {previewInstructorId}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 액션 버튼들 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">나의 만족도 통계</h1>
          <p className="text-muted-foreground">개인 강의 만족도 및 피드백 분석 - 전체 {surveys.length}개</p>
        </div>
        <div className="flex gap-2">
          {desktopActions.map((action, index) => (
            <div key={index}>{action}</div>
          ))}
        </div>
      </div>
      <div className="space-y-6">
        {!canViewPersonalStats ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">개인 통계를 조회할 권한이 없습니다.</p>
            </div>
          </div>
        ) : surveys.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">표시할 설문 데이터가 없습니다.</p>
              <p className="text-sm text-muted-foreground mt-2">
                {asInstructor ? '아직 생성된 설문이 없거나 권한이 없습니다.' : '설문 데이터를 확인해주세요.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* 통계 요약 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <Card>
                <CardContent className="flex flex-col items-center text-center p-3 md:p-4 aspect-square">
                  <div className="p-2 bg-primary/10 rounded-lg mb-2">
                    <BarChart3 className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">총 설문</p>
                  <p className="text-lg md:text-xl font-bold">{summaryStats.totalSurveys}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex flex-col items-center text-center p-3 md:p-4 aspect-square">
                  <div className="p-2 bg-blue-500/10 rounded-lg mb-2">
                    <Users className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">총 응답</p>
                  <p className="text-lg md:text-xl font-bold">{summaryStats.totalResponses}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex flex-col items-center text-center p-3 md:p-4 aspect-square">
                  <div className="p-2 bg-green-500/10 rounded-lg mb-2">
                    <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">평균 만족도</p>
                  <div className="flex flex-col items-center space-y-1">
                    <p className="text-lg md:text-xl font-bold">{summaryStats.avgSatisfaction}</p>
                    <Badge
                      variant={
                        summaryStats.avgSatisfaction >= 4
                          ? 'default'
                          : summaryStats.avgSatisfaction >= 3
                          ? 'secondary'
                          : 'destructive'
                      }
                      className="text-xs"
                    >
                      {summaryStats.satisfactionPercentage}%
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex flex-col items-center text-center p-3 md:p-4 aspect-square">
                  <div className="p-2 bg-orange-500/10 rounded-lg mb-2">
                    <Award className="h-4 w-4 md:h-5 md:w-5 text-orange-500" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">활성 설문</p>
                  <p className="text-lg md:text-xl font-bold">{summaryStats.activeSurveys}</p>
                </CardContent>
              </Card>
            </div>

            {/* 필터 컨트롤 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">연도</label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {getUniqueYears().map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}년
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">과정</label>
                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {getUniqueCourses().map(course => (
                      <SelectItem key={course} value={course}>
                        {course}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">차수</label>
                <Select value={selectedRound} onValueChange={setSelectedRound}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {selectedPeriod === 'round' && <SelectItem value="latest">최신</SelectItem>}
                    {getUniqueRounds().map(round => (
                      <SelectItem key={round} value={round.toString()}>
                        {round}차
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 트렌드 분석 */}
            <Tabs defaultValue="trend" className="space-y-4">
              <TabsList>
                <TabsTrigger value="trend">만족도 트렌드</TabsTrigger>
                <TabsTrigger value="courses">과목별 분석</TabsTrigger>
                <TabsTrigger value="detailed">상세 분석</TabsTrigger>
                <TabsTrigger value="distribution">평점 분포</TabsTrigger>
                <TabsTrigger value="insights">인사이트</TabsTrigger>
              </TabsList>

              <TabsContent value="trend" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      만족도 변화 추이
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" />
                          <YAxis domain={[0, 10]} />
                          <Tooltip
                            formatter={(value: any, name: string) => [
                              name === 'average' ? `${Number(value).toFixed(1)}점` : value,
                              name === 'average' ? '평균 만족도' : name === 'responses' ? '응답 수' : name,
                            ]}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="average" stroke="#8884d8" strokeWidth={3} dot={{ r: 6 }} />
                          <Line type="monotone" dataKey="responses" stroke="#82ca9d" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="detailed" className="space-y-4">
                {/* 과목-강사별 상세 분석 */}
                <div className="space-y-4">
                  {getUniqueSubjects().length > 0 ? (
                    <Tabs defaultValue={getUniqueSubjects()[0]?.key || 'default'} className="space-y-4">
                      <TabsList className="w-full overflow-x-auto">
                        {getUniqueSubjects().map((subject) => (
                          <TabsTrigger 
                            key={subject.key} 
                            value={subject.key} 
                            className="text-sm touch-friendly whitespace-nowrap"
                          >
                            {subject.displayName}
                          </TabsTrigger>
                        ))}
                      </TabsList>

                      {getUniqueSubjects().map((subject) => {
                        const subjectAnalysis = getSubjectDetailedAnalysis(subject.surveys);
                        
                        return (
                          <TabsContent key={subject.key} value={subject.key} className="space-y-4">
                            {/* 과정별 만족도 종합 */}
                            <Card>
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                  <TrendingUp className="h-5 w-5 text-blue-500" />
                                  과정별 만족도 종합
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                  과목별 만족도를 종합 분석합니다.
                                </p>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-6">
                                  <Card className="border-l-4 border-l-blue-500">
                                    <CardHeader>
                                      <CardTitle className="text-lg">
                                        {subject.courseName}
                                      </CardTitle>
                                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                        <span>총 {subject.surveys.length}개 설문</span>
                                        <span>총 {subject.totalResponses}명 응답</span>
                                      </div>
                                    </CardHeader>
                                    <CardContent>
                                      {/* 포함 과목 */}
                                      <div className="mb-4">
                                        <h4 className="font-medium mb-2">포함 과목:</h4>
                                        <div className="flex flex-wrap gap-2">
                                          <Badge variant="secondary" className="text-xs">
                                            {subject.courseName}
                                          </Badge>
                                        </div>
                                      </div>

                                      {/* 섹션별 만족도 */}
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Card className="border border-blue-200">
                                          <CardContent className="pt-4">
                                            <div className="text-center">
                                              <div className="text-3xl font-bold text-blue-500">
                                                {subjectAnalysis.subjectAverage}
                                              </div>
                                              <div className="text-sm text-muted-foreground">과목 만족도</div>
                                              <div className="text-xs text-muted-foreground">
                                                {subjectAnalysis.subjectQuestions.length}개 질문
                                              </div>
                                            </div>
                                          </CardContent>
                                        </Card>

                                        <Card className="border border-orange-200">
                                          <CardContent className="pt-4">
                                            <div className="text-center">
                                              <div className="text-3xl font-bold text-orange-500">
                                                {subjectAnalysis.instructorAverage}
                                              </div>
                                              <div className="text-sm text-muted-foreground">강사 만족도</div>
                                              <div className="text-xs text-muted-foreground">
                                                {subjectAnalysis.instructorQuestions.length}개 질문
                                              </div>
                                            </div>
                                          </CardContent>
                                        </Card>

                                        <Card className="border border-green-200">
                                          <CardContent className="pt-4">
                                            <div className="text-center">
                                              <div className="text-3xl font-bold text-green-500">
                                                {subjectAnalysis.operationAverage}
                                              </div>
                                              <div className="text-sm text-muted-foreground">운영 만족도</div>
                                              <div className="text-xs text-muted-foreground">
                                                {subjectAnalysis.operationQuestions.length}개 질문
                                              </div>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>
                              </CardContent>
                            </Card>

                            {/* 질문별 상세 분석 */}
                            <div className="space-y-4">
                              {[
                                ...subjectAnalysis.subjectAnalyses,
                                ...subjectAnalysis.instructorAnalyses,
                                ...subjectAnalysis.operationAnalyses
                              ].map((analysis, index) => renderQuestionAnalysis(analysis, index))}
                            </div>
                          </TabsContent>
                        );
                      })}
                    </Tabs>
                  ) : (
                    <Card>
                      <CardContent className="text-center py-8">
                        <p className="text-muted-foreground">상세 분석할 데이터가 없습니다.</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="courses" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>과목별 만족도</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {courseBreakdown.map((course, index) => (
                          <div key={course.course} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">{course.course}</span>
                              <span className="text-sm text-muted-foreground">
                                {course.avgSatisfaction.toFixed(1)}점
                              </span>
                            </div>
                            <Progress value={course.satisfactionPercentage} className="h-2" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>설문 {course.surveys}개</span>
                              <span>응답 {course.responses}개</span>
                            </div>
                          </div>
                        ))}
                        {courseBreakdown.length === 0 && (
                          <p className="text-center text-muted-foreground py-8">
                            과목별 데이터가 없습니다.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>과목별 상세 통계</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {courseBreakdown.map((course, index) => (
                          <Card key={course.course} className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium">{course.course}</h4>
                              <Badge variant={course.avgSatisfaction >= 8 ? 'default' : course.avgSatisfaction >= 6 ? 'secondary' : 'destructive'}>
                                {course.avgSatisfaction.toFixed(1)}점
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                              <div>설문: {course.surveys}개</div>
                              <div>응답: {course.responses}개</div>
                              <div>만족도: {course.satisfactionPercentage}%</div>
                              <div>평균: {course.avgSatisfaction.toFixed(1)}/10</div>
                            </div>
                          </Card>
                        ))}
                        {courseBreakdown.length === 0 && (
                          <p className="text-center text-muted-foreground py-8">
                            표시할 과목이 없습니다.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="courses" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>과목별 만족도</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {courseBreakdown.map((course, index) => (
                          <div key={course.course} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">{course.course}</span>
                              <span className="text-sm text-muted-foreground">
                                {course.avgSatisfaction.toFixed(1)}점
                              </span>
                            </div>
                            <Progress value={course.satisfactionPercentage} className="h-2" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>설문 {course.surveys}개</span>
                              <span>응답 {course.responses}개</span>
                            </div>
                          </div>
                        ))}
                        {courseBreakdown.length === 0 && (
                          <p className="text-center text-muted-foreground py-8">
                            과목별 데이터가 없습니다.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>과목별 상세 통계</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {courseBreakdown.map((course, index) => (
                          <Card key={course.course} className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium">{course.course}</h4>
                              <Badge variant={course.avgSatisfaction >= 8 ? 'default' : course.avgSatisfaction >= 6 ? 'secondary' : 'destructive'}>
                                {course.avgSatisfaction.toFixed(1)}점
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                              <div>설문: {course.surveys}개</div>
                              <div>응답: {course.responses}개</div>
                              <div>만족도: {course.satisfactionPercentage}%</div>
                              <div>평균: {course.avgSatisfaction.toFixed(1)}/10</div>
                            </div>
                          </Card>
                        ))}
                        {courseBreakdown.length === 0 && (
                          <p className="text-center text-muted-foreground py-8">
                            표시할 과목이 없습니다.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="distribution" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>평점 분포</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={ratingDistribution}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              dataKey="value"
                              label={({ name, percentage }) => `${name}: ${percentage}%`}
                            >
                              {ratingDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>평점별 상세</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {ratingDistribution.map(item => (
                        <div key={item.name} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>{item.name}</span>
                            <span>
                              {item.value}개 ({item.percentage}%)
                            </span>
                          </div>
                          <Progress value={item.percentage} className="h-2" />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="insights" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5" />
                        최근 성과
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">설문당 평균 응답</span>
                        <span className="font-medium">{summaryStats.avgResponsesPerSurvey}개</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">만족도 수준</span>
                        <Badge
                          variant={
                            summaryStats.avgSatisfaction >= 4
                              ? 'default'
                              : summaryStats.avgSatisfaction >= 3
                              ? 'secondary'
                              : 'destructive'
                          }
                        >
                          {summaryStats.avgSatisfaction >= 4 ? '우수' : summaryStats.avgSatisfaction >= 3 ? '보통' : '개선필요'}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">응답률 트렌드</span>
                        <span className="font-medium">
                          {trendData.length >= 2 &&
                          trendData[trendData.length - 1].responses >
                            trendData[trendData.length - 2].responses
                            ? '📈 증가'
                            : '📉 감소'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>개선 제안</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 text-sm">
                        {summaryStats.avgSatisfaction < 3 && (
                          <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                            <p className="text-red-700 dark:text-red-300">🔴 만족도가 낮습니다. 수업 방식 개선이 필요합니다.</p>
                          </div>
                        )}
                        {summaryStats.avgResponsesPerSurvey < 5 && (
                          <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                            <p className="text-yellow-700 dark:text-yellow-300">🟡 응답률이 낮습니다. 설문 참여 독려가 필요합니다.</p>
                          </div>
                        )}
                        {summaryStats.avgSatisfaction >= 4 && (
                          <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                            <p className="text-green-700 dark:text-green-300">🟢 높은 만족도를 유지하고 있습니다. 지속적인 관리가 필요합니다.</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
};

export default PersonalDashboard;
