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
import { Plus, Edit, Calendar, Users, ArrowLeft, Play, Square, Mail, Copy, Trash2, FileText, Share2, QrCode, Eye, MoreHorizontal, Target, ChevronsUpDown, Check } from 'lucide-react';
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
  const { user } = useAuth();
  const { toast } = useToast();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructorCourses, setInstructorCourses] = useState<InstructorCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

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
        supabase.from('surveys').select('*').order('created_at', { ascending: false }),
        supabase.from('instructors').select('*').order('name'),
        supabase.from('courses').select('*').order('title'),
        supabase.from('instructor_courses').select('*')
      ]);

      if (surveysRes.error) throw surveysRes.error;
      if (instructorsRes.error) throw instructorsRes.error;
      if (coursesRes.error) throw coursesRes.error;
      if (instructorCoursesRes.error) throw instructorCoursesRes.error;

      setSurveys((surveysRes.data as Survey[]) || []);
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

  const handleSubmit = async (data: any) => {
    try {
      const payload = {
        title: '', // Will be auto-generated based on data
        description: data.description || '',
        start_date: data.start_date ? new Date(data.start_date + '+09:00').toISOString() : null,
        end_date: data.end_date ? new Date(data.end_date + '+09:00').toISOString() : null,
        education_year: data.education_year,
        education_round: data.education_round,
        education_day: data.education_day,
        course_name: data.course_name,
        expected_participants: data.expected_participants,
        is_combined: data.is_combined || false,
        combined_round_start: data.is_combined ? data.combined_round_start : null,
        combined_round_end: data.is_combined ? data.combined_round_end : null,
        created_by: user?.id,
        instructor_id: null as string | null,
        course_id: null as string | null,
      };

      // Handle course selections - for now, use the first one
      if (data.course_selections && data.course_selections.length > 0) {
        const firstSelection = data.course_selections[0];
        payload.instructor_id = firstSelection.instructorId;
        payload.course_id = firstSelection.courseId;
      }

      // Auto-generate title
      const selectedCourse = courses.find(c => c.id === payload.course_id);
      if (selectedCourse && payload.education_year && payload.education_round && payload.education_day) {
        const yy = payload.education_year.toString().slice(-2);
        const courseName = payload.course_name?.includes('-')
          ? payload.course_name.split('-')[1]?.trim()
          : payload.course_name?.trim() || '';
        const titlePrefix = courseName
          ? `(${yy}-${payload.education_round}차 ${courseName} ${payload.education_day}일차)`
          : `(${yy}-${payload.education_round}차 ${payload.education_day}일차)`;
        payload.title = `${titlePrefix} ${selectedCourse.title}`;
      }

      const { error } = await supabase.from('surveys').insert([payload]);

      if (error) throw error;

      toast({ title: '성공', description: '설문조사가 생성되었습니다.' });

      setIsDialogOpen(false);
      fetchData();
      fetchFilteredSurveys();
    } catch (error: any) {
      console.error('Error creating survey:', error);
      toast({
        title: '오류',
        description: `설문조사 생성 실패: ${error?.message || '권한 또는 유효성 문제'}`,
        variant: 'destructive'
      });
    }
  };

  const handleUpdateSubmit = async (data: any) => {
    if (!editingSurvey) return;

    try {
      const payload = {
        title: '', // Will be auto-generated based on data
        description: data.description || '',
        start_date: data.start_date ? new Date(data.start_date + '+09:00').toISOString() : null,
        end_date: data.end_date ? new Date(data.end_date + '+09:00').toISOString() : null,
        education_year: data.education_year,
        education_round: data.education_round,
        education_day: data.education_day,
        course_name: data.course_name,
        expected_participants: data.expected_participants,
        is_combined: data.is_combined || false,
        combined_round_start: data.is_combined ? data.combined_round_start : null,
        combined_round_end: data.is_combined ? data.combined_round_end : null,
        instructor_id: null as string | null,
        course_id: null as string | null,
      };

      // Handle course selections - for now, use the first one
      if (data.course_selections && data.course_selections.length > 0) {
        const firstSelection = data.course_selections[0];
        payload.instructor_id = firstSelection.instructorId;
        payload.course_id = firstSelection.courseId;
      }

      // Auto-generate title
      const selectedCourse = courses.find(c => c.id === payload.course_id);
      if (selectedCourse && payload.education_year && payload.education_round && payload.education_day) {
        const yy = payload.education_year.toString().slice(-2);
        const courseName = payload.course_name?.includes('-')
          ? payload.course_name.split('-')[1]?.trim()
          : payload.course_name?.trim() || '';
        const titlePrefix = courseName
          ? `(${yy}-${payload.education_round}차 ${courseName} ${payload.education_day}일차)`
          : `(${yy}-${payload.education_round}차 ${payload.education_day}일차)`;
        payload.title = `${titlePrefix} ${selectedCourse.title}`;
      }

      const { error } = await supabase
        .from('surveys')
        .update(payload)
        .eq('id', editingSurvey.id);

      if (error) throw error;

      toast({ title: '성공', description: '설문조사가 수정되었습니다.' });

      setIsEditDialogOpen(false);
      setEditingSurvey(null);
      fetchData();
      fetchFilteredSurveys();
    } catch (error: any) {
      console.error('Error updating survey:', error);
      toast({
        title: '오류',
        description: `설문조사 수정 실패: ${error?.message || '권한 또는 유효성 문제'}`,
        variant: 'destructive'
      });
    }
  };

  const handleEditSurvey = (survey: Survey) => {
    setEditingSurvey(survey);
    setFormData({
      title: survey.title || '',
      description: survey.description || '',
      start_date: survey.start_date ? new Date(survey.start_date).toISOString().slice(0, 16) : '',
      end_date: survey.end_date ? new Date(survey.end_date).toISOString().slice(0, 16) : '',
      education_year: survey.education_year,
      education_round: survey.education_round,
      education_day: survey.education_day || 1,
      course_name: survey.course_name || '',
      instructor_id: survey.instructor_id || '',
      course_id: survey.course_id || '',
      expected_participants: (survey as any).expected_participants || 0,

      // 합반 필드
      round_label: survey.round_label || '',
      is_combined: !!survey.is_combined,
      combined_round_start: survey.combined_round_start ?? null,
      combined_round_end: survey.combined_round_end ?? null
    });
    setSelectedInstructor(survey.instructor_id || '');
    setIsEditDialogOpen(true);
  };

  const handleUpdateSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSurvey) return;

    try {
      const payload = {
        ...formData,
        instructor_id: formData.instructor_id || null,
        course_id: formData.course_id || null,
        start_date: formData.start_date ? new Date(formData.start_date + '+09:00').toISOString() : null,
        end_date: formData.end_date ? new Date(formData.end_date + '+09:00').toISOString() : null,

        // 합반 전송값 정리
        is_combined: !!formData.is_combined,
        combined_round_start: formData.is_combined ? formData.combined_round_start : null,
        combined_round_end: formData.is_combined ? formData.combined_round_end : null,
        round_label:
          (formData.round_label && formData.round_label.trim().length > 0)
            ? formData.round_label.trim()
            : null
      };

      const { error } = await supabase
        .from('surveys')
        .update(payload)
        .eq('id', editingSurvey.id);

      if (error) throw error;

      toast({ title: '성공', description: '설문조사가 수정되었습니다.' });

      setIsEditDialogOpen(false);
      setEditingSurvey(null);
      resetForm();
      setSelectedInstructor('');
      fetchData();
      fetchFilteredSurveys();
    } catch (error: any) {
      console.error('Error updating survey:', error);
      toast({
        title: '오류',
        description: `설문조사 수정 실패: ${error?.message || '권한 또는 유효성 문제'}`,
        variant: 'destructive'
      });
    }
  };

  const updateSurveyStatus = async (surveyId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('surveys')
        .update({ status: newStatus })
        .eq('id', surveyId);

      if (error) throw error;

      toast({
        title: '성공',
        description: `설문조사가 ${newStatus === 'active' ? '시작' : '종료'}되었습니다.`
      });

      fetchData();
      fetchFilteredSurveys();
    } catch (error) {
      console.error('Error updating survey status:', error);
      toast({
        title: '오류',
        description: '설문조사 상태 변경 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
    }
  };

  const duplicateSurvey = async (survey: Survey) => {
    try {
      const { error } = await supabase.from('surveys').insert([{
        title: `${survey.title} (복사본)`,
        description: survey.description,
        start_date: survey.start_date,
        end_date: survey.end_date,
        education_year: survey.education_year,
        education_round: survey.education_round,
        education_day: survey.education_day || null,
        instructor_id: survey.instructor_id,
        course_id: survey.course_id,
        course_name: survey.course_name || null,
        status: 'draft',
        created_by: user?.id,

        // 합반 필드 복제
        round_label: survey.round_label || null,
        is_combined: !!survey.is_combined,
        combined_round_start: survey.combined_round_start ?? null,
        combined_round_end: survey.combined_round_end ?? null
      }]);

      if (error) throw error;

      toast({ title: '성공', description: '설문조사가 복제되었습니다.' });
      fetchData();
      fetchFilteredSurveys();
    } catch (error) {
      console.error('Error duplicating survey:', error);
      toast({
        title: '오류',
        description: '설문조사 복제 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
    }
  };

  const deleteSurvey = async (surveyId: string) => {
    if (!window.confirm('정말로 이 설문을 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase.from('surveys').delete().eq('id', surveyId);
      if (error) throw error;

      toast({ title: '성공', description: '설문조사가 삭제되었습니다.' });
      fetchData();
      fetchFilteredSurveys();
    } catch (error) {
      console.error('Error deleting survey:', error);
      toast({
        title: '오류',
        description: '설문조사 삭제 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
    }
  };

  const sendSurveyResults = async (surveyId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-survey-results', {
        body: { surveyId, recipients: ['admin', 'instructor'] }
      });
      if (error) throw error;

      const results = (data as any)?.results as Array<{ to: string; name?: string; status: 'sent' | 'failed' }> | undefined;
      const recipientNames = (data as any)?.recipientNames as Record<string, string> | undefined;

      const sent = results?.filter(r => r.status === 'sent') || [];
      const failed = results?.filter(r => r.status === 'failed') || [];

      const getSentNames = () => sent.map(r => r.name || recipientNames?.[r.to] || r.to.split('@')[0]).join(', ');
      const getFailedNames = () => failed.map(r => r.name || recipientNames?.[r.to] || r.to.split('@')[0]).join(', ');

      toast({
        title: failed.length === 0 ? '✅ 이메일 전송 완료!' : '⚠️ 일부 전송 실패',
        description:
          failed.length === 0
            ? `${sent.length}명에게 설문 결과가 성공적으로 전송되었습니다. 📧\n받는 분: ${getSentNames()}`
            : `성공 ${sent.length}건${sent.length ? `: ${getSentNames()}` : ''}\n실패 ${failed.length}건: ${getFailedNames()}`,
        duration: 6000
      });
    } catch (error: any) {
      console.error('Error sending survey results:', error);
      toast({
        title: '오류',
        description: error.message || '이메일 전송 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
    }
  };

  const handleShare = async (survey: Survey) => {
    setSelectedSurveyForShare(survey);
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/survey/${survey.id}`;

    try {
      const qrCodeUrl = await QRCode.toDataURL(shareUrl, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
        errorCorrectionLevel: 'M'
      });
      setQrCodeDataUrl(qrCodeUrl);
      setShareDialogOpen(true);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: '오류',
        description: 'QR 코드 생성 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: '성공', description: '링크가 클립보드에 복사되었습니다.' });
    } catch {
      toast({
        title: '오류',
        description: '클립보드 복사에 실패했습니다.',
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

  // 상태 뱃지
  const getStatusBadge = (survey: Survey) => {
    const timeZone = 'Asia/Seoul';
    const nowKST = toZonedTime(new Date(), timeZone);
    const startDateKST = toZonedTime(new Date(survey.start_date), timeZone);
    const endDateKST = toZonedTime(new Date(survey.end_date), timeZone);

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

      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
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

          {/* 상단 액션 + 생성 다이얼로그 */}
          <div className="flex flex-col gap-4">
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
                    onSubmit={handleSubmit}
                    onCancel={() => setIsDialogOpen(false)}
                    isSubmitting={false}
                  />
                </DialogContent>
              </Dialog>
            </div>

            {/* 목록 */}
            <div className="grid gap-4">
              {(selectedCourse ? filteredSurveys : surveys).map((survey) => {
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
                                {survey.title}
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
                              {new Date(survey.start_date).toLocaleString('ko-KR', {
                                year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                              })} ~ {new Date(survey.end_date).toLocaleString('ko-KR', {
                                year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditSurvey(survey)}
                            className="touch-friendly text-xs h-9 px-3"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            정보수정
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/survey-builder/${survey.id}`)}
                            className="touch-friendly text-xs h-9 px-3"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            질문편집
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

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleShare(survey)}
                            className="touch-friendly text-xs h-9 px-3"
                          >
                            <Share2 className="h-4 w-4 mr-1" />
                            공유
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="touch-friendly text-xs h-9 px-3">
                                <MoreHorizontal className="h-4 w-4 mr-1" />
                                더보기
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => duplicateSurvey(survey)}>
                                <Copy className="h-4 w-4 mr-2" />
                                복사하기
                              </DropdownMenuItem>

                              <DropdownMenuItem onClick={() => navigate(`/dashboard/results?surveyId=${survey.id}`)}>
                                <FileText className="h-4 w-4 mr-2" />
                                결과 보기
                              </DropdownMenuItem>

                              <DropdownMenuItem onClick={() => sendSurveyResults(survey.id)}>
                                <Mail className="h-4 w-4 mr-2" />
                                이메일 전송
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              {survey.status === 'draft' && (
                                <DropdownMenuItem onClick={() => updateSurveyStatus(survey.id, 'active')}>
                                  <Play className="h-4 w-4 mr-2" />
                                  설문 시작
                                </DropdownMenuItem>
                              )}

                              {survey.status === 'active' && (
                                <DropdownMenuItem onClick={() => updateSurveyStatus(survey.id, 'completed')}>
                                  <Square className="h-4 w-4 mr-2" />
                                  설문 종료
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteSurvey(survey.id)}
                            className="touch-friendly text-xs h-9 px-3 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            삭제
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
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
                <h3 className="font-medium text-sm mb-2">{selectedSurveyForShare.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {displayRoundLabel(selectedSurveyForShare)}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">공유 링크</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={`${window.location.origin}/survey/${selectedSurveyForShare.id}`}
                      readOnly
                      className="text-xs"
                    />
                    <Button
                      size="sm"
                      onClick={() => copyToClipboard(`${window.location.origin}/survey/${selectedSurveyForShare.id}`)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="text-center">
                  <Label className="text-sm font-medium">QR 코드</Label>
                  {qrCodeDataUrl && (
                    <div className="mt-2 space-y-3">
                      <div className="flex justify-center">
                        <img src={qrCodeDataUrl} alt="QR 코드" className="border rounded-lg" />
                      </div>
                      <Button variant="outline" size="sm" onClick={downloadQRCode} className="w-full">
                        <QrCode className="h-4 w-4 mr-2" />
                        QR 코드 다운로드
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setShareDialogOpen(false)}>닫기</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 수정 다이얼로그 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>설문조사 정보 수정</DialogTitle>
          </DialogHeader>

          {editingSurvey && (
            <SurveyCreateForm 
              onSubmit={handleUpdateSubmit}
              onCancel={() => setIsEditDialogOpen(false)}
              isSubmitting={false}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SurveyManagement;