// SurveyManagement.tsx
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import QRCode from 'qrcode';
import { Plus, Edit, Calendar, Users, ArrowLeft, Play, Square, Mail, Copy, Trash2, FileText, Share2, QrCode, Eye, MoreHorizontal, Target, ChevronsUpDown, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { toZonedTime } from 'date-fns-tz';

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
  instructor_id: string;
  course_id: string;
  course_name?: string;
  combined_round_start?: number | null;
  combined_round_end?: number | null;
  round_label?: string;
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

  const {
    selectedYear,
    selectedCourse,
    availableCourses,
    filteredSurveys,
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
    combined_round_start: null as number | null,
    combined_round_end: null as number | null,
  });

  // ⬇️ 라벨 생성 함수
  const generateRoundLabel = () => {
    const year = formData.education_year;
    const courseType = formData.course_name;
    if (courseType.includes("Advanced") && formData.combined_round_start && formData.combined_round_end) {
      return `${year}년 ${formData.combined_round_start}∼${formData.combined_round_end}차 - BS Advanced`;
    }
    return `${year}년 ${formData.education_round}차 - ${courseType}`;
  };

  const fetchData = async () => {
    try {
      const [surveysRes, instructorsRes, coursesRes, instructorCoursesRes] = await Promise.all([
        supabase.from('surveys').select('*').order('created_at', { ascending: false }),
        supabase.from('instructors').select('*').order('name'),
        supabase.from('courses').select('*').order('title'),
        supabase.from('instructor_courses').select('*')
      ]);
      if (surveysRes.error) throw surveysRes.error;
      setSurveys(surveysRes.data || []);
      setInstructors(instructorsRes.data || []);
      setCourses(coursesRes.data || []);
      setInstructorCourses(instructorCoursesRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchFilteredSurveys();
    fetchAvailableCourses();
  }, []);

  // ✅ 설문 생성
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        round_label: generateRoundLabel(),
        instructor_id: formData.instructor_id || null,
        course_id: formData.course_id || null,
        start_date: formData.start_date ? new Date(formData.start_date + '+09:00').toISOString() : null,
        end_date: formData.end_date ? new Date(formData.end_date + '+09:00').toISOString() : null,
        created_by: user?.id,
      };
      await supabase.from('surveys').insert([payload]);
      toast({ title: "성공", description: "설문조사가 생성되었습니다." });
      setIsDialogOpen(false);
      fetchData();
      fetchFilteredSurveys();
    } catch (e) {
      console.error(e);
    }
  };

  // ✅ 설문 수정
  const handleUpdateSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSurvey) return;
    try {
      const payload = {
        ...formData,
        round_label: generateRoundLabel(),
        instructor_id: formData.instructor_id || null,
        course_id: formData.course_id || null,
        start_date: formData.start_date ? new Date(formData.start_date + '+09:00').toISOString() : null,
        end_date: formData.end_date ? new Date(formData.end_date + '+09:00').toISOString() : null,
      };
      await supabase.from('surveys').update(payload).eq('id', editingSurvey.id);
      toast({ title: "성공", description: "설문조사가 수정되었습니다." });
      setIsEditDialogOpen(false);
      fetchData();
      fetchFilteredSurveys();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div>로딩중...</div>;

  return (
    <div className="min-h-screen bg-background">
      {/* 설문 생성 다이얼로그 (일부만 발췌) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            {/* 과정 선택 */}
            <Label>과정</Label>
            <Select value={formData.course_name} onValueChange={(v) => setFormData(p => ({ ...p, course_name: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BS Basic">BS Basic</SelectItem>
                <SelectItem value="BS Advanced">BS Advanced</SelectItem>
              </SelectContent>
            </Select>

            {/* 차수 입력 */}
            <Label>차수</Label>
            <Input type="number" value={formData.education_round} onChange={e => setFormData(p => ({ ...p, education_round: +e.target.value }))} />

            {/* 합반 옵션 (Advanced일 때만) */}
            {formData.course_name === "BS Advanced" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>합반 시작 차수</Label>
                  <Input type="number" value={formData.combined_round_start ?? ''} onChange={e => setFormData(p => ({ ...p, combined_round_start: +e.target.value }))} />
                </div>
                <div>
                  <Label>합반 끝 차수</Label>
                  <Input type="number" value={formData.combined_round_end ?? ''} onChange={e => setFormData(p => ({ ...p, combined_round_end: +e.target.value }))} />
                </div>
              </div>
            )}

            {/* 라벨 프리뷰 */}
            <p className="text-sm mt-2">📌 라벨 미리보기: {generateRoundLabel()}</p>

            <Button type="submit">저장</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SurveyManagement;