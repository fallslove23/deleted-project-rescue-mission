import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, TrendingUp, Users, Award, BarChart3, Download, ArrowLeft } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

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
}

interface Profile {
  role: string;
  instructor_id: string;
}

const PersonalDashboard = ({ showPageHeader = true }: { showPageHeader?: boolean }) => {
  const navigate = useNavigate();
  const { user, userRoles } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('round');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedRound, setSelectedRound] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const isInstructor = userRoles.includes('instructor');
  const canViewPersonalStats = isInstructor || userRoles.includes('admin');

  useEffect(() => {
    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (profile && canViewPersonalStats) {
      fetchData();
    }
  }, [profile, selectedPeriod, selectedYear, selectedRound, selectedCourse]);

  const fetchProfile = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, instructor_id')
        .eq('id', user.id)
        .maybeSingle();
        
      if (error && error.code !== 'PGRST116') {
        console.error('프로필 조회 오류:', error);
      }
      
      setProfile(data);
    } catch (error) {
      console.error('fetchProfile 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    if (!canViewPersonalStats || !profile) return;

    setLoading(true);
    try {
      // 강사가 아닌 관리자의 경우 전체 데이터 조회
      let surveyQuery = supabase.from('surveys').select('*');
      
      // 강사인 경우 본인 설문만, 관리자인 경우 전체 설문
      if (profile?.instructor_id && isInstructor) {
        surveyQuery = surveyQuery.eq('instructor_id', profile.instructor_id);
      } else if (isInstructor && !profile?.instructor_id) {
        // instructor_id가 없는 강사의 경우 이메일로 매칭 시도
        const { data: instructorData } = await supabase
          .from('instructors')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
          
        if (instructorData) {
          surveyQuery = surveyQuery.eq('instructor_id', instructorData.id);
        }
      }

      // 필터 적용
      if (selectedYear && selectedYear !== 'all') {
        surveyQuery = surveyQuery.eq('education_year', parseInt(selectedYear));
      }
      if (selectedRound && selectedRound !== 'all' && selectedRound !== 'latest') {
        surveyQuery = surveyQuery.eq('education_round', parseInt(selectedRound));
      }
      if (selectedCourse && selectedCourse !== 'all') {
        surveyQuery = surveyQuery.ilike('course_name', `%${selectedCourse}%`);
      }

      const { data: surveysData, error: surveysError } = await surveyQuery
        .order('education_year', { ascending: false })
        .order('education_round', { ascending: false });

      if (surveysError) throw surveysError;
      
      let filteredSurveys = surveysData || [];
      
      // 최신 회차 필터링
      if (selectedRound === 'latest' && filteredSurveys.length > 0) {
        const latestYear = Math.max(...filteredSurveys.map(s => s.education_year));
        const latestYearSurveys = filteredSurveys.filter(s => s.education_year === latestYear);
        const latestRound = Math.max(...latestYearSurveys.map(s => s.education_round));
        filteredSurveys = filteredSurveys.filter(s => 
          s.education_year === latestYear && s.education_round === latestRound
        );
      }

      setSurveys(filteredSurveys);

      // 응답들 가져오기
      if (surveysData && surveysData.length > 0) {
        const allSurveyIds = surveysData.map(s => s.id);
        
        const { data: responsesData, error: responsesError } = await supabase
          .from('survey_responses')
          .select('*')
          .in('survey_id', allSurveyIds);

        if (responsesError) throw responsesError;
        setResponses(responsesData || []);

        // 질문들 가져오기
        const { data: questionsData, error: questionsError } = await supabase
          .from('survey_questions')
          .select('*')
          .in('survey_id', allSurveyIds);

        if (questionsError) throw questionsError;
        setQuestions(questionsData || []);

        // 답변들 가져오기
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
  };

  const getUniqueYears = () => {
    const years = [...new Set(surveys.map(s => s.education_year))];
    return years.sort((a, b) => b - a);
  };

  const getUniqueRounds = () => {
    let filteredSurveys = surveys;
    if (selectedYear && selectedYear !== 'all') {
      filteredSurveys = surveys.filter(s => s.education_year.toString() === selectedYear);
    }
    const rounds = [...new Set(filteredSurveys.map(s => s.education_round))];
    return rounds.sort((a, b) => a - b);
  };

  const getUniqueCourses = () => {
    let filteredSurveys = surveys;
    if (selectedYear && selectedYear !== 'all') {
      filteredSurveys = surveys.filter(s => s.education_year.toString() === selectedYear);
    }
    
    const courses = filteredSurveys
      .map(survey => {
        if (!survey.course_name) return null;
        const match = survey.course_name.match(/.*?-\s*(.+)$/);
        return match ? match[1].trim() : survey.course_name;
      })
      .filter