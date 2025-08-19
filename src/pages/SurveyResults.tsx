import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { BarChart, FileText, TrendingUp, Users, ArrowLeft, Download, Printer, Mail, Filter, Calendar, User, BookOpen, ChevronDown, ChevronRight, Eye, Send, X, BarChart3, FileSpreadsheet, Settings } from 'lucide-react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Tooltip, Legend } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import InstructorIndividualStats from '@/components/InstructorIndividualStats';
import SurveyStatsByRound from '@/components/SurveyStatsByRound';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { exportResponsesAsCSV, exportSummaryAsCSV, downloadCSV, generateCSVFilename, SurveyResultData } from '@/utils/csvExport';

interface Survey {
  id: string;
  title: string;
  education_year: number;
  education_round: number;
  status: string;
  instructor_id: string;
  expected_participants?: number;
}

interface SurveyResponse {
  id: string;
  survey_id: string;
  submitted_at: string;
  respondent_email: string;
}

interface Profile {
  role: string;
  instructor_id: string;
}

interface Instructor {
  id: string;
  name: string;
  email: string;
  photo_url: string;
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
  question_type: string;
  options: any;
  is_required: boolean;
  survey_id: string;
  order_index: number;
}

const SurveyResults = ({ showPageHeader = true }: { showPageHeader?: boolean }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
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
  const [loading, setLoading] = useState(true);
  const [sendingResults, setSendingResults] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const { toast } = useToast();

  // 사용자 권한 확인 (새로운 역할 시스템 사용)
  const { userRoles } = useAuth();
  const isAdmin = userRoles.includes('admin');
  const isOperator = userRoles.includes('operator');
  const isDirector = userRoles.includes('director');
  const isInstructor = userRoles.includes('instructor');
  const canViewAll = isAdmin || isOperator || isDirector;

  useEffect(() => {
    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (profile) {
      fetchAllInstructors();
      fetchSurveys();
      fetchAllResponses();
      fetchAllQuestionsAndAnswers(); // 모든 질문과 답변 데이터 로드
    }
  }, [profile]);

  useEffect(() => {
    if (selectedSurvey) {
      fetchResponses();
      fetchQuestionsAndAnswers();
    }
  }, [selectedSurvey]);

  const fetchAllResponses = async () => {
    try {
      let query = supabase.from('survey_responses').select('*');
      
      // 관리자/운영자/조직장인 경우 전체 응답 조회, 강사 역할만 있는 경우에만 자신의 강의 설문에 대한 응답만 조회
      if (isInstructor && profile.instructor_id && !canViewAll) {
        const { data: instructorSurveys } = await supabase
          .from('surveys')
          .select('id')
          .eq('instructor_id', profile.instructor_id);
        
        if (instructorSurveys && instructorSurveys.length > 0) {
          const surveyIds = instructorSurveys.map(s => s.id);
          query = query.in('survey_id', surveyIds);
        }
      }
      
      const { data, error } = await query.order('submitted_at', { ascending: false });
      
      if (error) throw error;
      setAllResponses(data || []);
    } catch (error) {
      console.error('Error fetching all responses:', error);
    }
  };

  // 모든 설문의 질문과 답변 데이터 로드 (차수별 통계용)
  const fetchAllQuestionsAndAnswers = async () => {
    try {
      let surveyQuery = supabase.from('surveys').select('id');
      
      // 권한에 따라 설문 필터링
      if (isInstructor && profile?.instructor_id && !canViewAll) {
        surveyQuery = surveyQuery.eq('instructor_id', profile.instructor_id);
      }
      
      const { data: surveyData, error: surveyError } = await surveyQuery;
      if (surveyError) throw surveyError;
      
      const surveyIds = surveyData?.map(s => s.id) || [];
      if (surveyIds.length === 0) return;

      // 모든 설문의 질문들 가져오기
      const { data: questionsData, error: questionsError } = await supabase
        .from('survey_questions')
        .select('*')
        .in('survey_id', surveyIds)
        .order('order_index');
      
      if (questionsError) throw questionsError;
      setAllQuestions(questionsData || []);

      // 모든 설문의 응답 ID들 가져오기
      const { data: responseIds, error: responseError } = await supabase
        .from('survey_responses')
        .select('id')
        .in('survey_id', surveyIds);
      
      if (responseError) throw responseError;
      
      if (responseIds && responseIds.length > 0) {
        const ids = responseIds.map(r => r.id);
        
        // 모든 답변들 가져오기
        const { data: answersData, error: answersError } = await supabase
          .from('question_answers')
          .select('*')
          .in('response_id', ids)
          .order('created_at');
        
        if (answersError) throw answersError;
        setAllAnswers(answersData || []);
      } else {
        setAllAnswers([]);
      }
    } catch (error) {
      console.error('Error fetching all questions and answers:', error);
    }
  };

  const fetchQuestionsAndAnswers = async () => {
    if (!selectedSurvey) return;
    
    try {
      // 선택된 설문의 질문들 가져오기
      const { data: questionsData, error: questionsError } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', selectedSurvey)
        .order('order_index');
      
      if (questionsError) throw questionsError;
      
      // 선택된 설문의 응답 ID들 가져오기
      const { data: responseIds, error: responseError } = await supabase
        .from('survey_responses')
        .select('id')
        .eq('survey_id', selectedSurvey);
      
      if (responseError) throw responseError;
      
      if (responseIds && responseIds.length > 0) {
        const ids = responseIds.map(r => r.id);
        
        // 선택된 설문의 답변들 가져오기
        const { data: answersData, error: answersError } = await supabase
          .from('question_answers')
          .select('*')
          .in('response_id', ids)
          .order('created_at');
        
        if (answersError) throw answersError;
        
        // 선택된 설문의 질문과 답변만 별도로 상태 관리 (개별 분석용)
        setQuestions(questionsData || []);
        setAnswers(answersData || []);
      }
    } catch (error) {
      console.error('Error fetching questions and answers:', error);
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
        
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
      }
      
      // 프로필이 없는 경우 기본 프로필 생성
      if (!data) {
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            role: 'user'
          })
          .select()
          .single();
          
        if (insertError) {
          console.error('Error creating profile:', insertError);
        } else {
          setProfile(newProfile);
        }
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
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
      setInstructor(data);
    } catch (error) {
      console.error('Error fetching instructor info:', error);
    }
  };

  const fetchAllInstructors = async () => {
    try {
      // 강사 역할을 가진 사용자들만 가져오기
      const { data: instructorUsers, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'instructor');
      
      if (rolesError) throw rolesError;
      
      const instructorUserIds = instructorUsers.map(ur => ur.user_id);
      
      if (instructorUserIds.length === 0) {
        setAllInstructors([]);
        return;
      }
      
      // 강사 역할을 가진 사용자들 중 instructor_id가 있는 프로필만 가져오기
      const { data: instructorProfiles, error: profileError } = await supabase
        .from('profiles')
        .select('instructor_id')
        .in('id', instructorUserIds)
        .not('instructor_id', 'is', null);
      
      if (profileError) throw profileError;
      
      const instructorIds = instructorProfiles.map(p => p.instructor_id).filter(Boolean);
      
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
      setAllInstructors(data || []);
    } catch (error) {
      console.error('Error fetching all instructors:', error);
    }
  };

  const fetchSurveys = async () => {
    try {
      let query = supabase.from('surveys').select('*');
      
      // 관리자/운영자/조직장인 경우 전체 설문 조회, 강사 역할만 있는 경우에만 자신의 강의 설문만 조회
      if (isInstructor && profile.instructor_id && !canViewAll) {
        query = query.eq('instructor_id', profile.instructor_id);
      }
      
      const { data, error } = await query.order('education_year', { ascending: false })
                                      .order('education_round', { ascending: false });
      
      if (error) throw error;
      setSurveys(data || []);
    } catch (error) {
      console.error('Error fetching surveys:', error);
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
      setResponses(data || []);
    } catch (error) {
      console.error('Error fetching responses:', error);
    }
  };

  const getUniqueYears = () => {
    const years = [...new Set(surveys.map(s => s.education_year))];
    return years.sort((a, b) => b - a);
  };

  const getUniqueRounds = () => {
    let filteredSurveys = surveys;
    if (selectedYear && selectedYear !== '') {
      filteredSurveys = surveys.filter(s => s.education_year.toString() === selectedYear);
    }
    const rounds = [...new Set(filteredSurveys.map(s => s.education_round))];
    return rounds.sort((a, b) => b - a);
  };

  const getFilteredSurveys = () => {
    let filtered = surveys;
    if (selectedYear && selectedYear !== '') {
      filtered = filtered.filter(s => s.education_year.toString() === selectedYear);
    }
    if (selectedRound && selectedRound !== '') {
      filtered = filtered.filter(s => s.education_round.toString() === selectedRound);
    }
    if (canViewAll && selectedInstructor !== 'all') {
      filtered = filtered.filter(s => s.instructor_id === selectedInstructor);
    }
    return filtered;
  };

  const getStatistics = () => {
    // 관리자/운영자는 전체 통계, 강사는 자신의 설문만
    const relevantSurveys = canViewAll ? getFilteredSurveys() : getFilteredSurveys().filter(s => 
      profile?.instructor_id && s.instructor_id === profile.instructor_id
    );
    
    // 응답은 선택된 설문이 있으면 해당 설문의 응답만, 없으면 관련 설문들의 전체 응답
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
      avgResponseRate: totalSurveys > 0 ? Math.round((totalResponses / totalSurveys) * 10) / 10 : 0
    };
  };

  // 차수별 통계 계산 (페이지네이션 고려)
  const getRoundStatistics = () => {
    const relevantSurveys = canViewAll ? getFilteredSurveys() : getFilteredSurveys().filter(s => 
      profile?.instructor_id && s.instructor_id === profile.instructor_id
    );
    
    // 최신 2년치 데이터만 표시 (성능 최적화)
    const currentYear = new Date().getFullYear();
    const recentSurveys = relevantSurveys.filter(s => 
      s.education_year >= currentYear - 1
    );
    
    const roundStats: Record<string, {
      surveys: Survey[];
      responses: number;
      year: number;
      round: number;
      courseSatisfaction: number;
      instructorSatisfaction: number;
      responseRate: number;
    }> = {};

    recentSurveys.forEach(survey => {
      const key = `${survey.education_year}-${survey.education_round}`;
      if (!roundStats[key]) {
        roundStats[key] = {
          surveys: [],
          responses: 0,
          year: survey.education_year,
          round: survey.education_round,
          courseSatisfaction: 0,
          instructorSatisfaction: 0,
          responseRate: 0
        };
      }
      roundStats[key].surveys.push(survey);
      const surveyResponses = allResponses.filter(r => r.survey_id === survey.id).length;
      roundStats[key].responses += surveyResponses;
      
      // 응답률 계산 (예상 참가자 수가 있는 경우)
      if (survey.expected_participants && survey.expected_participants > 0) {
        roundStats[key].responseRate = Math.round((surveyResponses / survey.expected_participants) * 100);
      }
    });

    // 각 차수별 만족도 계산 (현재 로드된 데이터 기반)
    Object.values(roundStats).forEach(round => {
      let totalCourseSatisfaction = 0;
      let totalInstructorSatisfaction = 0;
      let courseCount = 0;
      let instructorCount = 0;

      round.surveys.forEach(survey => {
        // 전체 로드된 questions와 answers에서 해당 설문 데이터 찾기
        const surveyQuestions = allQuestions.filter(q => q.survey_id === survey.id);
        const surveyResponses = allResponses.filter(r => r.survey_id === survey.id);
        const surveyAnswers = allAnswers.filter(a => 
          surveyResponses.some(r => r.id === a.response_id)
        );

        if (surveyQuestions.length === 0 || surveyAnswers.length === 0) return;

        // 질문 분류
        const courseQuestions: SurveyQuestion[] = [];
        const instructorQuestions: SurveyQuestion[] = [];

        surveyQuestions.forEach(question => {
          const questionText = question.question_text.toLowerCase();
          
          if (questionText.includes('강사') || 
              questionText.includes('지도') || 
              questionText.includes('설명') || 
              questionText.includes('질문응답') ||
              questionText.includes('교수법') ||
              questionText.includes('전달력') ||
              questionText.includes('준비도')) {
            instructorQuestions.push(question);
          } else if (questionText.includes('과정') || 
                     questionText.includes('교육') || 
                     questionText.includes('내용') || 
                     questionText.includes('커리큘럼') ||
                     questionText.includes('시간') ||
                     questionText.includes('교재') ||
                     questionText.includes('환경') ||
                     questionText.includes('시설')) {
            courseQuestions.push(question);
          } else {
            courseQuestions.push(question);
          }
        });

        // 과정 만족도 계산
        const courseRatingQuestions = courseQuestions.filter(q => q.question_type === 'rating' || q.question_type === 'scale');
        if (courseRatingQuestions.length > 0) {
          let courseTotalScore = 0;
          let courseTotalCount = 0;

          courseRatingQuestions.forEach(question => {
            const questionAnswers = surveyAnswers.filter(a => a.question_id === question.id);
            const ratings = questionAnswers.map(a => parseInt(a.answer_text)).filter(r => !isNaN(r));
            
            if (ratings.length > 0) {
              const maxScore = Math.max(...ratings);
              let convertedRatings = ratings;
              
              if (maxScore <= 5) {
                convertedRatings = ratings.map(r => r * 2);
              }
              
              courseTotalScore += convertedRatings.reduce((sum, r) => sum + r, 0);
              courseTotalCount += convertedRatings.length;
            }
          });

          if (courseTotalCount > 0) {
            totalCourseSatisfaction += courseTotalScore / courseTotalCount;
            courseCount++;
          }
        }

        // 강사 만족도 계산
        const instructorRatingQuestions = instructorQuestions.filter(q => q.question_type === 'rating' || q.question_type === 'scale');
        if (instructorRatingQuestions.length > 0) {
          let instructorTotalScore = 0;
          let instructorTotalCount = 0;

          instructorRatingQuestions.forEach(question => {
            const questionAnswers = surveyAnswers.filter(a => a.question_id === question.id);
            const ratings = questionAnswers.map(a => parseInt(a.answer_text)).filter(r => !isNaN(r));
            
            if (ratings.length > 0) {
              const maxScore = Math.max(...ratings);
              let convertedRatings = ratings;
              
              if (maxScore <= 5) {
                convertedRatings = ratings.map(r => r * 2);
              }
              
              instructorTotalScore += convertedRatings.reduce((sum, r) => sum + r, 0);
              instructorTotalCount += convertedRatings.length;
            }
          });

          if (instructorTotalCount > 0) {
            totalInstructorSatisfaction += instructorTotalScore / instructorTotalCount;
            instructorCount++;
          }
        }
      });

      round.courseSatisfaction = courseCount > 0 ? totalCourseSatisfaction / courseCount : 0;
      round.instructorSatisfaction = instructorCount > 0 ? totalInstructorSatisfaction / instructorCount : 0;
    });

    return Object.entries(roundStats)
      .map(([key, data]) => ({
        key,
        ...data,
        displayName: `${data.year}년 ${data.round}차`
      }))
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.round - a.round;
      });
  };

  // 질문별 분석 데이터 생성
  const getQuestionAnalysis = () => {
    const sortedQuestions = [...questions].sort((a, b) => a.order_index - b.order_index);
    return sortedQuestions.map(question => {
      const questionAnswers = answers.filter(a => a.question_id === question.id);
      
      if (question.question_type === 'multiple_choice' || question.question_type === 'single_choice') {
        const options = question.options || [];
        const answerCounts: Record<string, number> = {};
        
        options.forEach((option: string) => {
          answerCounts[option] = 0;
        });
        
        questionAnswers.forEach(answer => {
          if (answer.answer_text && Object.prototype.hasOwnProperty.call(answerCounts, answer.answer_text)) {
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
          type: 'chart' as const
        };
      } else if (question.question_type === 'rating') {
        const ratings = questionAnswers.map(a => parseInt(a.answer_text)).filter(r => !isNaN(r));
        const average = ratings.length > 0 ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1) : '0';
        
        // 점수별 분포 계산
        const distribution: Record<number, number> = {};
        for (let i = 1; i <= 5; i++) {
          distribution[i] = ratings.filter(r => r === i).length;
        }
        
        const chartData = Object.entries(distribution).map(([score, count]) => ({
          name: `${score}점`,
          value: count as number,
          percentage: ratings.length > 0 ? Math.round(((count as number) / ratings.length) * 100) : 0
        }));
        
        return {
          question,
          totalAnswers: questionAnswers.length,
          average,
          chartData,
          type: 'rating' as const
        };
      } else {
        // 텍스트 답변
        return {
          question,
          totalAnswers: questionAnswers.length,
          answers: questionAnswers.slice(0, 10), // 최대 10개만 표시
          type: 'text' as const
        };
      }
    });
  };

  const questionAnalyses = selectedSurvey ? getQuestionAnalysis() : [];
  
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

  const handleSendResults = async () => {
    if (!selectedSurvey) {
      toast({
        title: "오류",
        description: "결과를 전송할 설문을 선택해주세요.",
        variant: "destructive"
      });
      return;
    }

    if (selectedRecipients.length === 0) {
      toast({
        title: "오류",
        description: "발송할 수신자를 선택해주세요.",
        variant: "destructive"
      });
      return;
    }

    setSendingResults(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-survey-results', {
        body: { 
          surveyId: selectedSurvey,
          recipients: selectedRecipients
        }
      });

      if (error) throw error;

      const results = (data as any)?.results as Array<{ to: string; status: 'sent' | 'failed' }> | undefined;
      const recipients = (data as any)?.recipients as string[] | undefined;
      const sent = results?.filter(r => r.status === 'sent').map(r => r.to) || recipients || [];
      const failed = results?.filter(r => r.status === 'failed').map(r => r.to) || [];

      toast({
        title: failed.length === 0 ? "✅ 이메일 전송 완료!" : "⚠️ 일부 전송 실패",
        description: failed.length === 0 
          ? `${sent.length}명에게 설문 결과가 성공적으로 전송되었습니다. 📧` 
          : `성공 ${sent.length}건${sent.length ? `: ${sent.join(', ')}` : ''} / 실패 ${failed.length}건: ${failed.join(', ')}`,
        duration: 5000,
      });
      
      setEmailDialogOpen(false);
      setSelectedRecipients([]);
    } catch (error: any) {
      console.error('Error sending results:', error);
      toast({
        title: "오류",
        description: error.message || "결과 전송 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setSendingResults(false);
    }
  };

  const handleExportCSV = (type: 'responses' | 'summary') => {
    if (!selectedSurvey) {
      toast({
        title: "오류",
        description: "내보낼 설문을 선택해주세요.",
        variant: "destructive"
      });
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
          course_title: undefined // surveys don't have direct course relation
        },
        responses,
        questions,
        answers
      };

      const filename = generateCSVFilename(exportData.survey, type);
      const csvContent = type === 'responses' 
        ? exportResponsesAsCSV(exportData)
        : exportSummaryAsCSV(exportData);

      downloadCSV(csvContent, filename);

      toast({
        title: "성공",
        description: `${type === 'responses' ? '응답 데이터' : '요약 통계'}가 CSV 파일로 다운로드되었습니다.`
      });
    } catch (error) {
      console.error('CSV export error:', error);
      toast({
        title: "오류",
        description: "CSV 내보내기 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const openEmailDialog = () => {
    if (!selectedSurvey) {
      toast({
        title: "오류",
        description: "결과를 전송할 설문을 선택해주세요.",
        variant: "destructive"
      });
      return;
    }
    
    // 기본적으로 관리자와 강사를 선택
    setSelectedRecipients(['admin', 'instructor']);
    setEmailDialogOpen(true);
  };

  const toggleRecipient = (recipientType: string) => {
    setSelectedRecipients(prev => 
      prev.includes(recipientType) 
        ? prev.filter(r => r !== recipientType)
        : [...prev, recipientType]
    );
  };

  const handleLoadFilterPreset = (filters: any) => {
    if (filters.selectedYear !== undefined) setSelectedYear(filters.selectedYear);
    if (filters.selectedRound !== undefined) setSelectedRound(filters.selectedRound);
    if (filters.selectedInstructor !== undefined) setSelectedInstructor(filters.selectedInstructor);
  };

  const getCurrentFilters = () => ({
    selectedYear,
    selectedRound,
    selectedInstructor
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div>로딩중...</div>
      </div>
    );
  }

  const stats = getStatistics();
  const roundStats = getRoundStatistics();

  return (
    <div className="min-h-screen bg-background">
      {showPageHeader && (
        <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
          <div className="container mx-auto px-4 py-3 flex items-center relative">
            <Button
              onClick={() => navigate('/dashboard')}
              variant="ghost"
              size="sm"
              className="touch-friendly"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">대시보드</span>
            </Button>
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <h1 className="text-sm sm:text-lg font-semibold text-primary text-center">설문 결과 분석</h1>
              <p className="text-xs text-muted-foreground break-words hyphens-auto">
                {canViewAll ? '전체 설문조사 결과 및 통계를 확인할 수 있습니다' : 
                 instructor ? `${instructor.name} 강사의 설문조사 결과를 확인할 수 있습니다` : 
                 '담당 강의의 설문조사 결과를 확인할 수 있습니다'}
              </p>
              {!canViewAll && instructor && (
                <div className="flex items-center gap-2 mt-2">
                  {instructor.photo_url && (
                    <img 
                      src={instructor.photo_url} 
                      alt={instructor.name}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  )}
                  <span className="text-sm text-muted-foreground break-words truncate">
                    강사: {instructor.name}
                  </span>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          {isInstructor && instructor && (
            <section aria-label="강사 정보" className="rounded-xl border bg-card p-4 sm:p-6 shadow-sm">
              <div className="flex items-center gap-4">
                 <Avatar className="h-20 w-20 sm:h-24 sm:w-24 ring-2 ring-primary/20">
                   <AvatarImage 
                     src={instructor.photo_url || ''} 
                     alt={`${instructor.name} 강사 사진`}
                     className="object-cover"
                   />
                   <AvatarFallback>{(instructor.name || 'IN').slice(0, 2)}</AvatarFallback>
                 </Avatar>
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold leading-tight break-words">{instructor.name}</h2>
                  {instructor.email && (
                    <p className="text-sm text-muted-foreground break-words">{instructor.email}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">담당 강사의 설문 결과입니다.</p>
                </div>
          </div>
            </section>
          )}
          {/* 필터 */}
          <div className="flex gap-2 sm:gap-4 flex-wrap">
            <Select value={selectedYear} onValueChange={(value) => {
              setSelectedYear(value);
              setSelectedRound(''); // Reset round when year changes
            }}>
              <SelectTrigger className="w-24 sm:w-32 touch-friendly">
                <SelectValue placeholder="전체 연도" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {getUniqueYears().map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}년</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedRound} onValueChange={setSelectedRound}>
              <SelectTrigger className="w-24 sm:w-32 touch-friendly">
                <SelectValue placeholder="전체 차수" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {getUniqueRounds().map(round => (
                  <SelectItem key={round} value={round.toString()}>{round}차</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {canViewAll && (
              <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
                <SelectTrigger className="w-32 sm:w-48 touch-friendly">
                  <SelectValue placeholder="전체 강사" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="all">전체 강사</SelectItem>
                  {allInstructors.map(inst => (
                    <SelectItem key={inst.id} value={inst.id} className="break-words">
                      {inst.name} {inst.email && `(${inst.email})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {(selectedYear || selectedRound || (canViewAll && selectedInstructor !== 'all')) && (
              <Button 
                variant="outline" 
                className="touch-friendly text-sm border-2 border-muted-foreground/30 hover:border-primary hover:bg-muted/50"
                onClick={() => {
                  setSelectedYear('');
                  setSelectedRound('');
                  setSelectedInstructor('all');
                }}
              >
                <span className="break-words">필터 초기화</span>
              </Button>
            )}
          </div>

          {/* 전체 통계 요약 */}
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

          {/* Enhanced Trendy Chart for Round Statistics */}
          {roundStats.length > 0 && (
            <Card className="border-2 border-muted-foreground/30">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  차수별 만족도 트렌드
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsBarChart data={roundStats.slice(0, 8).reverse()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" opacity={0.3} />
                    <XAxis 
                      dataKey="displayName"
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      domain={[0, 10]}
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                      formatter={(value: any, name: string) => [
                        `${value.toFixed(1)}/10`, 
                        name === 'courseSatisfaction' ? '과정 만족도' : '강사 만족도'
                      ]}
                      labelFormatter={(label) => `${label}`}
                    />
                    <Legend 
                      formatter={(value) => value === 'courseSatisfaction' ? '과정 만족도' : '강사 만족도'}
                    />
                    <Bar 
                      dataKey="courseSatisfaction" 
                      name="courseSatisfaction"
                      fill="hsl(var(--chart-primary))" 
                      radius={[4, 4, 0, 0]}
                      maxBarSize={60}
                    />
                    <Bar 
                      dataKey="instructorSatisfaction" 
                      name="instructorSatisfaction"
                      fill="hsl(var(--chart-secondary))" 
                      radius={[4, 4, 0, 0]}
                      maxBarSize={60}
                    />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Enhanced Round Statistics Cards */}
          {roundStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  차수별 통계
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {roundStats.map((round) => (
                    <Card key={round.key} className="border-2 border-muted-foreground/30 hover:border-primary transition-colors bg-gradient-to-br from-background to-muted/20">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          {round.displayName}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">진행중인 설문</span>
                          <span className="font-semibold text-primary">{round.surveys.length}개</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">총 응답 수</span>
                          <span className="font-semibold text-primary">{round.responses}개</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">과정 만족도</span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{round.courseSatisfaction > 0 ? `${round.courseSatisfaction.toFixed(1)}/10` : '-'}</span>
                            {round.courseSatisfaction > 0 && (
                              <Badge variant={round.courseSatisfaction >= 8 ? 'default' : round.courseSatisfaction >= 6 ? 'secondary' : 'destructive'}>
                                {round.courseSatisfaction >= 8 ? '우수' : round.courseSatisfaction >= 6 ? '보통' : '개선필요'}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">강사 만족도</span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{round.instructorSatisfaction > 0 ? `${round.instructorSatisfaction.toFixed(1)}/10` : '-'}</span>
                            {round.instructorSatisfaction > 0 && (
                              <Badge variant={round.instructorSatisfaction >= 8 ? 'default' : round.instructorSatisfaction >= 6 ? 'secondary' : 'destructive'}>
                                {round.instructorSatisfaction >= 8 ? '우수' : round.instructorSatisfaction >= 6 ? '보통' : '개선필요'}
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
          )}

          {/* 설문조사 목록 */}
          <Card>
            <CardHeader>
              <CardTitle>설문조사 목록</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getFilteredSurveys().map((survey) => (
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
                           className="touch-friendly text-xs h-9 px-3 bg-primary hover:bg-primary/90"
                         >
                           <Eye className="h-3 w-3 mr-1" />
                           상세 분석
                         </Button>
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => setSelectedSurvey(survey.id)}
                           className="touch-friendly text-xs h-9 px-3 border-2 border-muted-foreground/30 hover:border-primary"
                         >
                           <BarChart className="h-3 w-3 mr-1" />
                           개별 통계
                         </Button>
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => {
                             setSelectedSurvey(survey.id);
                             openEmailDialog();
                           }}
                           className="touch-friendly text-xs h-9 px-3 border-2 border-muted-foreground/30 hover:border-primary"
                         >
                           <Send className="h-3 w-3 mr-1" />
                           결과 송부
                         </Button>
                       </div>
                     </div>
                   </div>
                ))}
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
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="overview" className="text-sm">전체 분석</TabsTrigger>
                    <TabsTrigger value="round-stats" className="text-sm">회차별 통계</TabsTrigger>
                    <TabsTrigger value="individual" className="text-sm">개별 통계</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <SurveyStatsByRound instructorId={canViewAll ? undefined : profile?.instructor_id} />
                  </TabsContent>

                  <TabsContent value="round-stats" className="space-y-4">
                    <SurveyStatsByRound instructorId={canViewAll ? undefined : profile?.instructor_id} />
                  </TabsContent>

                  <TabsContent value="individual" className="space-y-4">
                    {canViewAll && (
                      <InstructorIndividualStats 
                        allInstructors={allInstructors}
                        getFilteredSurveys={getFilteredSurveys}
                        setSelectedSurvey={setSelectedSurvey}
                        selectedSurvey={selectedSurvey}
                        answers={answers}
                        questions={questions}
                      />
                    )}
                    {!canViewAll && (
                      <div className="text-center py-8 text-muted-foreground">
                        개별 통계는 관리자 권한이 필요합니다.
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {/* 이메일 발송 다이얼로그 */}
          <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>결과 이메일 발송</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  설문 결과를 받을 수신자를 선택해주세요:
                </p>
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="admin"
                      checked={selectedRecipients.includes('admin')}
                      onCheckedChange={() => toggleRecipient('admin')}
                    />
                    <label htmlFor="admin" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      관리자 및 운영자
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="instructor"
                      checked={selectedRecipients.includes('instructor')}
                      onCheckedChange={() => toggleRecipient('instructor')}
                    />
                    <label htmlFor="instructor" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      해당 강사
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="director"
                      checked={selectedRecipients.includes('director')}
                      onCheckedChange={() => toggleRecipient('director')}
                    />
                    <label htmlFor="director" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      조직장
                    </label>
                      </div>
                    </div>
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setEmailDialogOpen(false)}
                    disabled={sendingResults}
                  >
                    취소
                  </Button>
                  <Button
                    onClick={handleSendResults}
                    disabled={sendingResults || selectedRecipients.length === 0}
                   >
                     {sendingResults ? '발송 중...' : '발송'}
                   </Button>
                 </div>
               </DialogContent>
             </Dialog>
           </div>
         </main>
       </div>
     );
   };

   export default SurveyResults;
