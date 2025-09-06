// src/pages/SurveyManagement.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useSurveyFilters } from '@/hooks/useSurveyFilters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import QRCode from 'qrcode';
import { Plus, Edit, Calendar, Users, ArrowLeft, Play, Square, Mail, Copy, Trash2, FileText, Share2, QrCode, Eye, MoreHorizontal, Target, ChevronsUpDown, Check, ChevronLeft, ChevronRight, Settings, BarChart, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { toZonedTime } from 'date-fns-tz';
import SurveyCreateForm from '@/components/SurveyCreateForm';

interface Survey {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  education_year: number;
  education_round: number;
  education_day?: number;
  status: string;
  instructor_id: string | null;
  course_id: string | null;
  course_name?: string | null; // 과정명(코스) 표시용

  // ⬇️ 합반 관련/레이블(신규 컬럼)
  round_label?: string | null;
  is_combined?: boolean | null;
  combined_round_start?: number | null;
  combined_round_end?: number | null;

  // 누락된 필드들 추가
  template_id?: string | null;
  expected_participants?: number | null;
  is_test?: boolean | null; // 테스트 데이터 여부 추가
  created_by?: string | null; // 작성자 ID
  creator_name?: string | null; // 작성자 이름 (조인)

  created_at: string;
}

interface Instructor {
  id: string;
  name: string;
  email: string;
}

interface Course {
  id: string;
  title: string;
  description: string;
}

interface InstructorCourse {
  id: string;
  instructor_id: string;
  course_id: string;
  created_at: string;
}

const SurveyManagement = ({ showPageHeader = true }: { showPageHeader?: boolean }) => {
  const navigate = useNavigate();
  const { user, userRoles } = useAuth();
  const { toast } = useToast();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructorCourses, setInstructorCourses] = useState<InstructorCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  
  // 페이징 상태 추가
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // 필터 훅
  const {
    selectedYear,
    selectedCourse,
    availableCourses,
    filteredSurveys,
    loading: filterLoading,
    setSelectedYear,
    setSelectedCourse,
    fetchAvailableCourses,
    fetchSurveys: fetchFilteredSurveys
  } = useSurveyFilters();

  // 추가 필터 상태
  const [selectedRound, setSelectedRound] = useState<string>('');
  const [selectedInstructorFilter, setSelectedInstructorFilter] = useState<string>('all');

  // 사용자 권한 확인
  const isAdmin = userRoles.includes('admin');
  const isOperator = userRoles.includes('operator');
  const isDirector = userRoles.includes('director');
  const isInstructor = userRoles.includes('instructor');
  const canViewAll = isAdmin || isOperator || isDirector;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  const [selectedInstructor, setSelectedInstructor] = useState<string>('');
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedSurveyForShare, setSelectedSurveyForShare] = useState<Survey | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // 생성/수정 폼 상태
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    education_year: new Date().getFullYear(),
    education_round: 1,
    education_day: 1,
    course_name: '',
    instructor_id: '',
    course_id: '',
    expected_participants: 0,

    // ⬇️ 합반 필드
    round_label: '',
    is_combined: false,
    combined_round_start: null as number | null,
    combined_round_end: null as number | null,
  });

  // 제목 자동 업데이트
  const updateTitle = () => {
    const selected = courses.find(c => c.id === formData.course_id);
    const courseName = formData.course_name?.includes('-')
      ? formData.course_name.split('-')[1]?.trim()
      : formData.course_name?.trim() || '';

    if (formData.education_year && formData.education_round && formData.education_day && selected) {
      const yy = formData.education_year.toString().slice(-2);
      const titlePrefix = courseName
        ? `(${yy}-${formData.education_round}차 ${courseName} ${formData.education_day}일차)`
        : `(${yy}-${formData.education_round}차 ${formData.education_day}일차)`;
      const newTitle = `${titlePrefix} ${selected.title}`;
      setFormData(prev => ({ ...prev, title: newTitle }));
    }
  };

  useEffect(() => {
    fetchData();
    fetchFilteredSurveys();
  }, []);

  useEffect(() => {
    fetchAvailableCourses();
  }, [selectedYear]);

  useEffect(() => {
    if (selectedInstructor) {
      const instructorCourseIds = instructorCourses
        .filter(ic => ic.instructor_id === selectedInstructor)
        .map(ic => ic.course_id);
      const filtered = courses.filter(course => instructorCourseIds.includes(course.id));
      setFilteredCourses(filtered);

      const currentCourseValid = instructorCourseIds.includes(formData.course_id);
      setFormData(prev => ({
        ...prev,
        instructor_id: selectedInstructor,
        course_id: currentCourseValid ? prev.course_id : ''
      }));
    }
  }, [selectedInstructor, courses, instructorCourses]);

  // 제목 자동 업데이트 트리거
  useEffect(() => {
    if (formData.course_id && formData.education_year && formData.education_round && formData.education_day) {
      updateTitle();
    }
  }, [
    formData.education_year,
    formData.education_round,
    formData.education_day,
    formData.course_name,
    formData.course_id,
    courses
  ]);

  const fetchData = async () => {
    try {
      const [surveysRes, instructorsRes, coursesRes, instructorCoursesRes] = await Promise.all([
        supabase.from('surveys')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('instructors').select('*').order('name'),
        supabase.from('courses').select('*').order('title'),
        supabase.from('instructor_courses').select('*')
      ]);

      if (surveysRes.error) throw surveysRes.error;
      if (instructorsRes.error) throw instructorsRes.error;
      if (coursesRes.error) throw coursesRes.error;
      if (instructorCoursesRes.error) throw instructorCoursesRes.error;

      // 안전한 데이터 매핑
      const surveysWithCreator = (surveysRes.data || []).map((survey: any) => ({
        ...survey,
        creator_name: '사용자', // 단순화
        // 안전한 Date 처리
        start_date: survey.start_date || new Date().toISOString(),
        end_date: survey.end_date || new Date(Date.now() + 24*60*60*1000).toISOString()
      }));
      setSurveys(surveysWithCreator);
      setInstructors(instructorsRes.data || []);
      setCourses(coursesRes.data || []);
      setInstructorCourses(instructorCoursesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: '오류',
        description: '데이터를 불러오는 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () =>
    setFormData({
      title: '',
      description: '',
      start_date: '',
      end_date: '',
      education_year: new Date().getFullYear(),
      education_round: 1,
      education_day: 1,
      course_name: '',
      instructor_id: '',
      course_id: '',
      expected_participants: 0,
      round_label: '',
      is_combined: false,
      combined_round_start: null,
      combined_round_end: null
    });

  // DateTime 변환 함수들
  const toSafeISOString = (dateTimeLocal: string): string | null => {
    if (!dateTimeLocal) return null;
    try {
      const date = new Date(dateTimeLocal);
      if (isNaN(date.getTime())) return null;
      return date.toISOString();
    } catch {
      return null;
    }
  };

  const toLocalDateTime = (isoString?: string | null): string => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      const pad = (n: number) => String(n).padStart(2, '0');
      const year = date.getFullYear();
      const month = pad(date.getMonth() + 1);
      const day = pad(date.getDate());
      const hours = pad(date.getHours());
      const minutes = pad(date.getMinutes());
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  const handleSubmit = async (data: any) => {
    console.log('SurveyManagement - handleSubmit called with data:', data);
    
    try {
      const payload = {
        title: '', // Will be auto-generated based on data
        description: data.description || '',
        start_date: toSafeISOString(data.start_date),
        end_date: toSafeISOString(data.end_date),
        education_year: data.education_year,
        education_round: data.education_round,
        education_day: data.education_day,
        course_name: data.course_name || '',
        expected_participants: data.expected_participants || 0,
        is_combined: !!data.is_combined,
        combined_round_start: data.is_combined ? data.combined_round_start : null,
        combined_round_end: data.is_combined ? data.combined_round_end : null,
        round_label: data.is_combined ? (data.round_label || '') : null,
        is_test: !!data.is_test,
        created_by: user?.id,
        instructor_id: null as string | null,
        course_id: null as string | null,
        status: 'draft', // Set initial status as draft
      };

      // Handle course selections - for now, use the first one
      if (data.course_selections && data.course_selections.length > 0) {
        const firstSelection = data.course_selections[0];
        payload.instructor_id = firstSelection.instructorId || null;
        payload.course_id = firstSelection.courseId || null;
      }

      // Auto-generate title: "연도-과정-차수-일차 설문"
      const courseName = payload.course_name?.includes('-')
        ? payload.course_name.split('-')[1]?.trim()
        : payload.course_name?.trim() || '';
      if (payload.education_year && payload.education_round && payload.education_day && courseName) {
        payload.title = `${payload.education_year}-${courseName}-${payload.education_round}차-${payload.education_day}일차 설문`;
      }

      const { data: createdSurvey, error } = await supabase
        .from('surveys')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      toast({ 
        title: '성공', 
        description: '설문조사가 생성되었습니다. 질문을 추가하여 설문을 완성하세요.'
      });

      // Navigate to survey builder for immediate question creation
      navigate(`/survey-builder/${createdSurvey.id}`);
    } catch (error: any) {
      console.error('SurveyManagement - Error creating survey:', error);
      toast({
        title: '오류',
        description: `설문조사 생성 실패: ${error?.message || '알 수 없는 오류가 발생했습니다'}`,
        variant: 'destructive'
      });
    }
  };

  const updateSurveyStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('surveys')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      toast({ title: '성공', description: '설문 상태가 업데이트되었습니다.' });
      fetchData();
    } catch (error: any) {
      console.error('Error updating survey status:', error);
      toast({
        title: '오류',
        description: `상태 업데이트 실패: ${error?.message}`,
        variant: 'destructive'
      });
    }
  };

  const duplicateSurvey = async (survey: Survey) => {
    try {
      const { data: duplicatedSurvey, error } = await supabase
        .from('surveys')
        .insert([{
          ...survey,
          id: undefined,
          title: `${survey.title} (복사본)`,
          status: 'draft',
          created_at: undefined,
          created_by: user?.id
        }])
        .select()
        .single();

      if (error) throw error;

      // 질문과 섹션도 복사
      const { data: sections } = await supabase
        .from('survey_sections')
        .select('*')
        .eq('survey_id', survey.id);

      if (sections && sections.length > 0) {
        const newSections = sections.map(section => ({
          ...section,
          id: undefined,
          survey_id: duplicatedSurvey.id,
          created_at: undefined,
          updated_at: undefined
        }));

        await supabase.from('survey_sections').insert(newSections);
      }

      const { data: questions } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', survey.id);

      if (questions && questions.length > 0) {
        const newQuestions = questions.map(question => ({
          ...question,
          id: undefined,
          survey_id: duplicatedSurvey.id,
          created_at: undefined
        }));

        await supabase.from('survey_questions').insert(newQuestions);
      }

      toast({ title: '성공', description: '설문이 복사되었습니다.' });
      fetchData();
    } catch (error: any) {
      console.error('Error duplicating survey:', error);
      toast({
        title: '오류',
        description: `설문 복사 실패: ${error?.message}`,
        variant: 'destructive'
      });
    }
  };

  const deleteSurvey = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까? 모든 질문과 응답이 함께 삭제됩니다.')) return;

    try {
      const { error } = await supabase
        .from('surveys')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: '성공', description: '설문이 삭제되었습니다.' });
      fetchData();
    } catch (error: any) {
      console.error('Error deleting survey:', error);
      toast({
        title: '오류',
        description: `설문 삭제 실패: ${error?.message}`,
        variant: 'destructive'
      });
    }
  };

  const sendSurveyResults = async (surveyId: string) => {
    try {
      const { error } = await supabase.functions.invoke('send-survey-results', {
        body: { surveyId }
      });

      if (error) throw error;

      toast({ title: '성공', description: '결과 전송이 시작되었습니다.' });
    } catch (error: any) {
      console.error('Error sending survey results:', error);
      toast({
        title: '오류',
        description: `결과 전송 실패: ${error?.message}`,
        variant: 'destructive'
      });
    }
  };

  const handleShare = async (survey: Survey) => {
    try {
      setSelectedSurveyForShare(survey);
      const surveyUrl = `${window.location.origin}/survey/${survey.id}`;
      
      // QR 코드 생성
      const qrDataUrl = await QRCode.toDataURL(surveyUrl, {
        width: 256,
        margin: 2
      });
      setQrCodeDataUrl(qrDataUrl);
      setShareDialogOpen(true);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: '오류',
        description: 'QR 코드 생성에 실패했습니다.',
        variant: 'destructive'
      });
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: '성공', description: '클립보드에 복사되었습니다.' });
    } catch (error) {
      toast({
        title: '오류',
        description: '복사에 실패했습니다.',
        variant: 'destructive'
      });
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeDataUrl || !selectedSurveyForShare) return;
    const link = document.createElement('a');
    link.download = `${selectedSurveyForShare.title}_QR코드.png`;
    link.href = qrCodeDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 페이징된 설문 목록  
  const getPaginatedSurveys = () => {
    let filtered = surveys;
    
    // selectedCourse가 있을 때만 필터링 적용
    if (selectedCourse && selectedCourse !== '' && selectedCourse !== 'all') {
      try {
        const [year, round, courseName] = selectedCourse.split('-');
        filtered = filtered.filter(s => 
          s.education_year.toString() === year &&
          s.education_round.toString() === round &&
          s.course_name === courseName
        );
      } catch (error) {
        console.error('Error filtering surveys:', error);
        filtered = surveys; // 에러 시 전체 목록 사용
      }
    }
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  };

  // 전체 페이지 수
  const getTotalPages = () => {
    let filtered = surveys;
    
    // selectedCourse가 있을 때만 필터링 적용
    if (selectedCourse && selectedCourse !== '' && selectedCourse !== 'all') {
      try {
        const [year, round, courseName] = selectedCourse.split('-');
        filtered = filtered.filter(s => 
          s.education_year.toString() === year &&
          s.education_round.toString() === round &&
          s.course_name === courseName
        );
      } catch (error) {
        console.error('Error filtering surveys for pagination:', error);
        filtered = surveys; // 에러 시 전체 목록 사용
      }
    }
    
    return Math.ceil(filtered.length / itemsPerPage);
  };

  // 상태 뱃지 - 안전한 Date 처리
  const getStatusBadge = (survey: Survey) => {
    try {
      const timeZone = 'Asia/Seoul';
      const nowKST = toZonedTime(new Date(), timeZone);
      
      // 안전한 Date 처리
      const startDate = survey.start_date ? new Date(survey.start_date) : new Date();
      const endDate = survey.end_date ? new Date(survey.end_date) : new Date();
      
      // Invalid Date 체크
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return <Badge variant="secondary">상태 확인 불가</Badge>;
      }
      
      const startDateKST = toZonedTime(startDate, timeZone);
      const endDateKST = toZonedTime(endDate, timeZone);

      let displayLabel = '';
      let variant: 'default' | 'secondary' | 'outline' | 'destructive' = 'secondary';

      if (survey.status === 'active') {
        if (nowKST < startDateKST) {
          displayLabel = '시작 예정';
          variant = 'secondary';
        } else if (nowKST >= startDateKST && nowKST <= endDateKST) {
          displayLabel = '진행중';
          variant = 'default';
        } else {
          displayLabel = '종료';
          variant = 'outline';
        }
      } else if (survey.status === 'draft') {
        displayLabel = '초안';
        variant = 'secondary';
      } else if (survey.status === 'completed') {
        displayLabel = '완료';
        variant = 'outline';
      } else {
        displayLabel = survey.status;
        variant = 'secondary';
      }

      return <Badge variant={variant}>{displayLabel}</Badge>;
    } catch (error) {
      console.error('Error in getStatusBadge:', error);
      return <Badge variant="secondary">오류</Badge>;
    }
  };

  // 표시용 라벨 (목록/카드에 사용)
  const displayRoundLabel = (s: Survey) => {
    if (s.round_label && s.round_label.trim().length > 0) return s.round_label;
    if (s.is_combined && s.combined_round_start && s.combined_round_end) {
      // 예: 2025년 6∼9차 - BS Advanced
      const course = s.course_name || '';
      const label = `${s.education_year}년 ${s.combined_round_start}∼${s.combined_round_end}차 - ${course}`;
      return label;
    }
    // 기본
    const course = s.course_name || '';
    return `${s.education_year}년 ${s.education_round}차 - ${course}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div>로딩중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {showPageHeader && (
        <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
          <div className="container mx-auto px-4 py-3 flex items-center relative">
            <Button onClick={() => navigate('/dashboard')} variant="ghost" size="sm" className="touch-friendly">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">대시보드</span>
            </Button>
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <h1 className="text-sm sm:text-lg font-semibold text-primary text-center">설문 관리</h1>
              <p className="text-xs text-muted-foreground text-center">설문조사 생성 및 관리</p>
            </div>
          </div>
        </header>
      )}

      <main className="container mx-auto px-4 py-6 h-[calc(100vh-120px)] flex flex-col">
        {/* 상단 고정 영역 */}
        <div className="flex-shrink-0 space-y-6 mb-6">
          {/* Guide */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                설문 유형 가이드
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div className="border rounded-lg p-3 sm:p-4 bg-muted/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                    <h3 className="font-medium text-sm break-words">이론 과목</h3>
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p><span className="font-medium">구성:</span> 이론만</p>
                    <p><span className="font-medium">강사:</span> 단일 강사</p>
                    <p><span className="font-medium">설문:</span> 이론용 설문만</p>
                  </div>
                </div>

                <div className="border rounded-lg p-3 sm:p-4 bg-muted/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                    <h3 className="font-medium text-sm break-words">이론+실습 (동일강사)</h3>
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p><span className="font-medium">구성:</span> 이론+실습</p>
                    <p><span className="font-medium">강사:</span> 동일 강사</p>
                    <p><span className="font-medium">설문:</span> 실습용 설문만</p>
                  </div>
                </div>

                <div className="border rounded-lg p-3 sm:p-4 bg-muted/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0"></div>
                    <h3 className="font-medium text-sm break-words">이론+실습 (다른강사)</h3>
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p><span className="font-medium">구성:</span> 이론+실습</p>
                    <p><span className="font-medium">강사:</span> 서로 다름</p>
                    <p><span className="font-medium">설문:</span> 각각 별도 설문</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 과정 선택 필터 */}
          <Card className="shadow-lg border-0 bg-gradient-to-r from-card to-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                과정별 설문 검색
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-4">
              <div>
                <label className="text-sm font-medium">교육 연도</label>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(Number(value))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}년</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium">과정</label>
                <Select value={selectedCourse || 'all'} onValueChange={(value) => setSelectedCourse(value === 'all' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="전체 설문 보기 (선택 시 필터링)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 설문 보기</SelectItem>
                    {availableCourses.map(course => (
                      <SelectItem key={course.key} value={course.key}>
                        {course.year}년 {course.round}차 - {course.course_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* 상단 액션 */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-lg sm:text-xl font-bold break-words">
              설문조사 목록 {selectedCourse && `(${availableCourses.find(c => c.key === selectedCourse)?.course_name})`}
            </h2>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="touch-friendly text-sm w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="break-words">새 설문조사</span>
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>새 설문조사 만들기</DialogTitle>
                </DialogHeader>

                <SurveyCreateForm 
                  templates={[]}
                  onSuccess={(surveyId) => {
                    setIsDialogOpen(false);
                    toast({
                      title: "성공",
                      description: "설문조사가 생성되었습니다."
                    });
                     // Refresh surveys list 
                     window.location.reload();
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* 중간 스크롤 가능한 리스트 영역 */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 min-h-0">
          <div className="grid gap-4 p-1">
            {getPaginatedSurveys().length === 0 ? (
              // 빈 상태 표시
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-muted-foreground mb-4">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">설문이 없습니다</h3>
                  <p className="text-sm">
                    {selectedCourse && selectedCourse !== 'all' 
                      ? "선택한 과정에 해당하는 설문이 없습니다. 다른 과정을 선택하거나 새로운 설문을 만들어보세요." 
                      : loading 
                        ? "설문을 불러오는 중입니다..." 
                        : "아직 생성된 설문이 없습니다. 새 설문조사를 만들어보세요."
                    }
                  </p>
                </div>
                {!selectedCourse || selectedCourse === 'all' ? (
                  <Button onClick={() => setIsDialogOpen(true)} className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    첫 설문조사 만들기
                  </Button>
                ) : null}
              </div>
            ) : (
              getPaginatedSurveys().map((survey) => {
                const surveyInstructor = instructors.find(i => i.id === survey.instructor_id);
                const surveyCourse = courses.find(c => c.id === survey.course_id);

                return (
                  <Card key={survey.id} className="transition-shadow hover:shadow-md">
                    <CardHeader className="p-4 sm:p-6">
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                           <div className="flex-1 min-w-0">
                             <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                               <CardTitle className="text-base sm:text-lg break-words line-clamp-2">
                                 {survey.title || `${survey.education_year}-${survey.course_name || '과정명없음'}-${survey.education_round}차-${survey.education_day || 1}일차 설문`}
                               </CardTitle>
                               {getStatusBadge(survey)}
                             </div>
                             <p className="text-sm text-muted-foreground break-words line-clamp-2">
                               {survey.description}
                             </p>
                           </div>
                        </div>

                        {/* Info */}
                        <div className="text-xs sm:text-sm text-muted-foreground space-y-1">
                          <p className="break-words"><strong>작성자:</strong> {survey.creator_name || '알 수 없음'}</p>
                          <p className="break-words"><strong>표시:</strong> {displayRoundLabel(survey)}</p>
                          <p className="break-words"><strong>강사:</strong> {surveyInstructor?.name || 'Unknown'}</p>
                          <p className="break-words"><strong>과목:</strong> {surveyCourse?.title || 'Unknown'}</p>
                          {survey.course_name && (
                            <p className="break-words">
                              <strong>과정명:</strong>{' '}
                              <span className="ml-1 text-primary font-medium">
                                {survey.course_name.includes('-')
                                  ? survey.course_name.split('-')[1]?.trim()
                                  : survey.course_name}
                              </span>
                            </p>
                          )}
                          <p>
                            <strong>교육기간:</strong>{' '}
                            {survey.education_year}년 {survey.education_round}차 {survey.education_day || 1}일차
                            {survey.is_combined && survey.combined_round_start && survey.combined_round_end && (
                              <span className="ml-2">
                                (합반 {survey.combined_round_start}∼{survey.combined_round_end}차)
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 flex-shrink-0" />
                            <span className="break-all">
                              {(() => {
                                try {
                                  const startDate = survey.start_date ? new Date(survey.start_date) : null;
                                  const endDate = survey.end_date ? new Date(survey.end_date) : null;
                                  
                                  const startStr = startDate && !isNaN(startDate.getTime()) 
                                    ? startDate.toLocaleString('ko-KR', {
                                        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                                      })
                                    : '시작일 미설정';
                                    
                                  const endStr = endDate && !isNaN(endDate.getTime())
                                    ? endDate.toLocaleString('ko-KR', {
                                        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                                      })
                                    : '종료일 미설정';
                                    
                                  return `${startStr} ~ ${endStr}`;
                                } catch (error) {
                                  console.error('Date formatting error:', error);
                                  return '날짜 정보 오류';
                                }
                              })()}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/survey-builder/${survey.id}`)}
                            className="touch-friendly text-xs h-9 px-3"
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            질문수정
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleShare(survey)}
                            className="touch-friendly text-xs h-9 px-3"
                          >
                            <Share2 className="h-4 w-4 mr-1" />
                            공유
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => duplicateSurvey(survey)}
                            className="touch-friendly text-xs h-9 px-3"
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            복사
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/survey-results/${survey.id}`)}
                            className="touch-friendly text-xs h-9 px-3"
                          >
                            <BarChart className="h-4 w-4 mr-1" />
                            결과
                          </Button>

                          <Select value={survey.status} onValueChange={(value) => updateSurveyStatus(survey.id, value)}>
                            <SelectTrigger className="w-24 h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">활성</SelectItem>
                              <SelectItem value="draft">초안</SelectItem>
                              <SelectItem value="completed">완료</SelectItem>
                            </SelectContent>
                          </Select>

                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteSurvey(survey.id)}
                            className="touch-friendly text-xs h-9 px-3"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            삭제
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/survey-preview/${survey.id}`)}
                            className="touch-friendly text-xs h-9 px-3"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            미리보기
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* 하단 고정 페이징 영역 */}
        <div className="flex-shrink-0 mt-6">
          {/* 페이징 */}
          {getTotalPages() > 1 && (
            <div className="flex justify-center items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                이전
              </Button>
              
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, getTotalPages()) }, (_, i) => {
                  const startPage = Math.max(1, currentPage - 2);
                  const page = startPage + i;
                  if (page > getTotalPages()) return null;
                  
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-10 h-10"
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, getTotalPages()))}
                disabled={currentPage === getTotalPages()}
              >
                다음
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* 페이징 정보 */}
          <div className="text-center text-sm text-muted-foreground mt-4">
            총 {surveys.length}개 중 {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, surveys.length)}개 표시
          </div>
        </div>
      </main>

      {/* 공유 다이얼로그 */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>설문조사 공유</DialogTitle>
          </DialogHeader>
          
          {selectedSurveyForShare && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">설문 링크</Label>
                <div className="flex mt-1">
                  <Input
                    readOnly
                    value={`${window.location.origin}/survey/${selectedSurveyForShare.id}`}
                    className="flex-1 text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(`${window.location.origin}/survey/${selectedSurveyForShare.id}`)}
                    className="ml-2"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {qrCodeDataUrl && (
                <div className="text-center">
                  <Label className="text-sm font-medium">QR 코드</Label>
                  <div className="mt-2">
                    <img src={qrCodeDataUrl} alt="QR Code" className="mx-auto" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadQRCode}
                      className="mt-2"
                    >
                      <QrCode className="h-4 w-4 mr-1" />
                      QR 코드 다운로드
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SurveyManagement;