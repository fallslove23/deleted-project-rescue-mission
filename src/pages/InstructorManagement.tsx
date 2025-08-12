import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Edit, Camera, UserPlus, BookOpen, Upload, X, PlusCircle, Trash2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Instructor {
  id: string;
  name: string;
  email: string;
  bio: string;
  photo_url: string;
  created_at: string;
  updated_at: string;
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

const InstructorManagement = ({ showPageHeader = true }: { showPageHeader?: boolean }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructorCourses, setInstructorCourses] = useState<InstructorCourse[]>([]);
  const [instructorRoles, setInstructorRoles] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseDescription, setNewCourseDescription] = useState('');
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [isCourseDialogOpen, setIsCourseDialogOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'instructors' | 'courses'>('instructors');
  const [courseSearchQuery, setCourseSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    bio: '',
    photo_url: ''
  });

  const [roleEditDialog, setRoleEditDialog] = useState(false);
  const [editingInstructorRoles, setEditingInstructorRoles] = useState<{
    instructorId: string;
    instructorName: string;
    currentRoles: string[];
  } | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [instructorsRes, coursesRes, instructorCoursesRes] = await Promise.all([
        supabase.from('instructors').select('*').order('name'),
        supabase.from('courses').select('*').order('title'),
        supabase.from('instructor_courses').select('*')
      ]);

      if (instructorsRes.error) throw instructorsRes.error;
      if (coursesRes.error) throw coursesRes.error;
      if (instructorCoursesRes.error) throw instructorCoursesRes.error;

      setInstructors(instructorsRes.data || []);
      setCourses(coursesRes.data || []);
      setInstructorCourses(instructorCoursesRes.data || []);

      // 강사별 역할 정보 조회
      await fetchInstructorRoles();
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "오류",
        description: "데이터를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchInstructorRoles = async () => {
    try {
      // user_roles를 먼저 조회하고 profiles와 매칭
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, instructor_id')
        .not('instructor_id', 'is', null);

      if (profilesError) throw profilesError;

      const rolesByInstructor: Record<string, string[]> = {};
      profiles?.forEach(profile => {
        if (profile.instructor_id) {
          const userRolesList = userRoles?.filter(ur => ur.user_id === profile.id);
          if (userRolesList && userRolesList.length > 0) {
            rolesByInstructor[profile.instructor_id] = userRolesList.map(ur => ur.role);
          }
        }
      });

      setInstructorRoles(rolesByInstructor);
    } catch (error) {
      console.error('Error fetching instructor roles:', error);
    }
  };

  const canEditRoles = () => {
    return user?.email === 'sethetrend87@osstem.com';
  };

  const handleOpenRoleDialog = (instructor: Instructor) => {
    const currentRoles = instructorRoles[instructor.id] || [];
    setEditingInstructorRoles({
      instructorId: instructor.id,
      instructorName: instructor.name,
      currentRoles
    });
    setSelectedRoles(currentRoles);
    setRoleEditDialog(true);
  };

  const handleRoleChange = (role: string, checked: boolean) => {
    if (checked) {
      setSelectedRoles(prev => [...prev, role]);
    } else {
      setSelectedRoles(prev => prev.filter(r => r !== role));
    }
  };

  const handleSaveRoles = async () => {
    if (!editingInstructorRoles || !canEditRoles()) return;

    try {
      // 해당 강사 정보 조회
      const instructor = instructors.find(i => i.id === editingInstructorRoles.instructorId);
      if (!instructor) {
        throw new Error('강사 정보를 찾을 수 없습니다.');
      }

      console.log('처리 중인 강사:', instructor);

      // 해당 강사의 실제 프로필(사용자 계정) 찾기
      let profile = null;

      // instructor_id로 프로필 찾기
      const { data: profilesByInstructor, error: err1 } = await supabase
        .from('profiles')
        .select('id, email, instructor_id')
        .eq('instructor_id', editingInstructorRoles.instructorId)
        .limit(1);

      console.log('instructor_id로 찾은 프로필:', profilesByInstructor, err1);

      if (!err1 && profilesByInstructor && profilesByInstructor.length > 0) {
        profile = profilesByInstructor[0];
        console.log('유효한 프로필 선택:', profile);
      }

      // instructor_id로 못 찾았으면 email로 찾기
      if (!profile && instructor.email) {
        const normalizedEmail = instructor.email.trim();
        const { data: profilesByEmail, error: err2 } = await supabase
          .from('profiles')
          .select('id, email, instructor_id')
          .ilike('email', normalizedEmail)
          .limit(1);

        console.log('email로 찾은 프로필:', profilesByEmail, err2);

        if (!err2 && profilesByEmail && profilesByEmail.length > 0) {
          profile = profilesByEmail[0];
          
          // instructor_id가 연결되지 않았다면 자동으로 연결
          if (!profile.instructor_id) {
            console.log('프로필에 instructor_id 자동 연결(관리자 권한) 중...');
            const { error: linkError } = await supabase.rpc('admin_link_profile_to_instructor', {
              target_profile_id: profile.id,
              instructor_id_param: editingInstructorRoles.instructorId
            });
            if (linkError) {
              console.error('instructor_id 연결 실패:', linkError);
              throw new Error('강사 계정 연결 중 오류가 발생했습니다.');
            }
            console.log('instructor_id 연결 성공');
            profile = { ...profile, instructor_id: editingInstructorRoles.instructorId };
            toast({ title: '계정 연결', description: '강사 계정이 자동으로 연결되었습니다.' });
          }
        }
      }

      if (!profile) {
        // 실제 사용자 계정이 없는 경우
        toast({
          title: "알림",
          description: "해당 강사의 사용자 계정이 아직 생성되지 않았습니다. 먼저 계정을 생성한 후 역할을 설정해주세요.",
          variant: "destructive"
        });
        setRoleEditDialog(false);
        setEditingInstructorRoles(null);
        return;
      }

      // 프로필이 없으면 오류 발생
      if (!profile) {
        throw new Error('해당 강사의 사용자 계정이 아직 생성되지 않았습니다. 먼저 계정을 생성해주세요.');
      }

      console.log('최종 선택된 프로필:', profile);

      const profileId = profile.id;

      // 안전한 역할 설정 (auth.users 존재 여부 확인)
      const { error: roleRpcError } = await supabase.rpc('admin_set_user_roles_safe', {
        target_user_id: profileId,
        roles: selectedRoles as unknown as ('operator' | 'instructor' | 'admin' | 'director')[]
      });

      if (roleRpcError) throw roleRpcError;

      // 데이터 새로고침
      await fetchInstructorRoles();

      toast({
        title: "성공",
        description: "역할이 업데이트되었습니다."
      });

      setRoleEditDialog(false);
      setEditingInstructorRoles(null);
    } catch (error) {
      console.error('Error updating roles:', error);
      toast({
        title: "오류",
        description: `역할 업데이트 중 오류가 발생했습니다: ${(error as Error).message}`,
        variant: "destructive"
      });
    }
  };

  const handlePhotoUpload = async (file: File, instructorId?: string) => {
    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${instructorId || 'new'}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data } = await supabase.storage
        .from('instructor-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('instructor-photos')
        .getPublicUrl(fileName);

      const photoUrl = urlData.publicUrl;

      if (instructorId) {
        // Update existing instructor
        const { error: updateError } = await supabase
          .from('instructors')
          .update({ photo_url: photoUrl })
          .eq('id', instructorId);

        if (updateError) throw updateError;
        
        await fetchData();
        toast({
          title: "성공",
          description: "강사 사진이 업데이트되었습니다."
        });
      } else {
        // For new instructor
        setFormData(prev => ({ ...prev, photo_url: photoUrl }));
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: "오류",
        description: "사진 업로드 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let instructorId = editingInstructor?.id;

      // Check for email duplication if email is provided
      if (formData.email) {
        const { data: existingInstructors } = await supabase
          .from('instructors')
          .select('id')
          .eq('email', formData.email.trim())
          .neq('id', editingInstructor?.id || '');

        if (existingInstructors && existingInstructors.length > 0) {
          toast({
            title: "오류",
            description: "이미 사용 중인 이메일입니다.",
            variant: "destructive"
          });
          return;
        }
      }

      if (editingInstructor) {
        // Update existing instructor
        const { error } = await supabase
          .from('instructors')
          .update(formData)
          .eq('id', editingInstructor.id);

        if (error) throw error;
        
        toast({
          title: "성공",
          description: "강사 정보가 수정되었습니다."
        });
      } else {
        // Create new instructor
        const { data, error } = await supabase
          .from('instructors')
          .insert([formData])
          .select()
          .single();

        if (error) throw error;
        instructorId = data.id;
        
        toast({
          title: "성공",
          description: "새 강사가 추가되었습니다."
        });
      }

      // Update course assignments using instructor_courses table
      if (instructorId) {
        // Remove existing course assignments
        await supabase
          .from('instructor_courses')
          .delete()
          .eq('instructor_id', instructorId);

        // Add new course assignments
        if (selectedCourses.length > 0) {
          const coursesToInsert = selectedCourses.map(courseId => ({
            instructor_id: instructorId,
            course_id: courseId
          }));
          
          await supabase
            .from('instructor_courses')
            .insert(coursesToInsert);
        }
      }

      // Create instructor account only for new instructors with email
      if (!editingInstructor && instructorId && formData.email) {
        try {
          const { data: funcResult, error: funcError } = await supabase.rpc(
            'create_instructor_account', 
            {
              instructor_email: formData.email,
              instructor_password: 'bsedu123',
              instructor_id_param: instructorId
            }
          );
          
          if (funcError) throw funcError;
          
          toast({
            title: "알림",
            description: "강사가 로그인 페이지에서 해당 이메일로 회원가입하면 자동으로 계정이 연결됩니다.",
            variant: "default"
          });
        } catch (accountError) {
          console.error('Error creating instructor account:', accountError);
          toast({
            title: "계정 생성 오류",
            description: "강사 계정 생성 중 오류가 발생했습니다.",
            variant: "destructive"
          });
        }
      }

      setIsDialogOpen(false);
      setEditingInstructor(null);
      setFormData({ name: '', email: '', bio: '', photo_url: '' });
      setSelectedCourses([]);
      setNewCourseTitle('');
      setNewCourseDescription('');
      fetchData();
    } catch (error) {
      console.error('Error saving instructor:', error);
      toast({
        title: "오류",
        description: "강사 정보 저장 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const openEditDialog = (instructor: Instructor) => {
    setEditingInstructor(instructor);
    setFormData({
      name: instructor.name,
      email: instructor.email || '',
      bio: instructor.bio || '',
      photo_url: instructor.photo_url || ''
    });
    
    // Set selected courses for this instructor using instructor_courses table
    const instructorCourseIds = instructorCourses
      .filter(ic => ic.instructor_id === instructor.id)
      .map(ic => ic.course_id);
    setSelectedCourses(instructorCourseIds);
    
    setIsDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingInstructor(null);
    setFormData({ name: '', email: '', bio: '', photo_url: '' });
    setSelectedCourses([]);
    setNewCourseTitle('');
    setNewCourseDescription('');
    setIsDialogOpen(true);
  };

  const getInstructorCourses = (instructorId: string) => {
    const instructorCourseIds = instructorCourses
      .filter(ic => ic.instructor_id === instructorId)
      .map(ic => ic.course_id);
    return courses.filter(course => instructorCourseIds.includes(course.id));
  };

  const handleAddNewCourse = async () => {
    if (!newCourseTitle.trim()) return;

    try {
      const { data, error } = await supabase
        .from('courses')
        .insert([{
          title: newCourseTitle,
          description: newCourseDescription
        }])
        .select()
        .single();

      if (error) throw error;

      setCourses(prev => [...prev, data]);
      setSelectedCourses(prev => [...prev, data.id]);
      setNewCourseTitle('');
      setNewCourseDescription('');
      
      toast({
        title: "성공",
        description: "새 과목이 추가되었습니다."
      });
    } catch (error) {
      console.error('Error adding course:', error);
      toast({
        title: "오류",
        description: "과목 추가 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const toggleCourseSelection = (courseId: string) => {
    setSelectedCourses(prev => 
      prev.includes(courseId) 
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleDeleteInstructor = async (instructor: Instructor) => {
    try {
      // Remove course assignments first using instructor_courses table
      await supabase
        .from('instructor_courses')
        .delete()
        .eq('instructor_id', instructor.id);

      // Delete instructor
      const { error } = await supabase
        .from('instructors')
        .delete()
        .eq('id', instructor.id);

      if (error) throw error;

      toast({
        title: "성공",
        description: `강사 "${instructor.name}"가 삭제되었습니다.`
      });

      fetchData();
    } catch (error) {
      console.error('Error deleting instructor:', error);
      toast({
        title: "오류",
        description: "강사 삭제 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const handleEditCourse = (course: Course) => {
    setEditingCourse(course);
    setNewCourseTitle(course.title);
    setNewCourseDescription(course.description || '');
    setIsCourseDialogOpen(true);
  };

  const handleCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseTitle.trim()) return;

    try {
      if (editingCourse) {
        // Check if title already exists (excluding current course)
        const { data: existingCourses } = await supabase
          .from('courses')
          .select('id')
          .eq('title', newCourseTitle.trim())
          .neq('id', editingCourse.id);

        if (existingCourses && existingCourses.length > 0) {
          toast({
            title: "오류",
            description: "이미 존재하는 과목명입니다.",
            variant: "destructive"
          });
          return;
        }

        // Update existing course
        const { error } = await supabase
          .from('courses')
          .update({
            title: newCourseTitle.trim(),
            description: newCourseDescription.trim()
          })
          .eq('id', editingCourse.id);

        if (error) throw error;

        toast({
          title: "성공",
          description: "과목이 수정되었습니다."
        });
      } else {
        // Check if title already exists
        const { data: existingCourses } = await supabase
          .from('courses')
          .select('id')
          .eq('title', newCourseTitle.trim());

        if (existingCourses && existingCourses.length > 0) {
          toast({
            title: "오류",
            description: "이미 존재하는 과목명입니다.",
            variant: "destructive"
          });
          return;
        }

        // Create new course
        const { data, error } = await supabase
          .from('courses')
          .insert([{
            title: newCourseTitle.trim(),
            description: newCourseDescription.trim()
          }])
          .select()
          .single();

        if (error) throw error;

        setSelectedCourses(prev => [...prev, data.id]);
        
        toast({
          title: "성공",
          description: "새 과목이 추가되었습니다."
        });
      }

      setIsCourseDialogOpen(false);
      setEditingCourse(null);
      setNewCourseTitle('');
      setNewCourseDescription('');
      fetchData();
    } catch (error) {
      console.error('Error saving course:', error);
      toast({
        title: "오류",
        description: "과목 저장 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const handleSyncAllInstructors = async () => {
    try {
      // 모든 강사들 중 이메일이 있는 강사들 필터링
      const instructorsWithEmail = instructors.filter(instructor => instructor.email);

      if (instructorsWithEmail.length === 0) {
        toast({
          title: "알림",
          description: "이메일이 설정된 강사가 없습니다.",
        });
        return;
      }

      // Edge Function을 호출하여 사용자 계정 일괄 생성
      const { data, error } = await supabase.functions.invoke('create-instructor-users', {
        body: {
          instructor_emails: instructorsWithEmail.map(instructor => instructor.email)
        }
      });

      if (error) {
        throw error;
      }

      const { results, summary } = data;
      
      // 동기화 대상 이메일 기준으로 실제 생성/기존 계정의 역할 분포 집계 (대소문자 무시, 중복 제거)
      const uniqueEmails = Array.from(
        new Set(instructorsWithEmail.map(i => String(i.email).trim().toLowerCase()))
      );

      // 해당 이메일들의 프로필 조회 (케이스 무시)
      const profiles: { id: string; email: string }[] = [];
      for (const em of uniqueEmails) {
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('id, email')
          .ilike('email', em)
          .maybeSingle();
        if (!profErr && prof) profiles.push(prof as any);
      }

      const userIds = profiles.map(p => p.id);
      let instructorCount = 0;
      let directorCount = 0;
      let operatorCount = 0; // 운영자 + 관리자 합산
      if (userIds.length > 0) {
        const { data: roles, error: rolesErr } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds);
        if (!rolesErr && roles) {
          const rolesByUser: Record<string, Set<string>> = {};
          roles.forEach(r => {
            if (!rolesByUser[r.user_id]) rolesByUser[r.user_id] = new Set();
            rolesByUser[r.user_id].add(r.role);
          });
          Object.values(rolesByUser).forEach(roleSet => {
            if (roleSet.has('instructor')) instructorCount += 1;
            if (roleSet.has('director')) directorCount += 1;
            if (roleSet.has('operator') || roleSet.has('admin')) operatorCount += 1;
          });
        }
      }
      const totalUnique = new Set(userIds).size;
      
      toast({
        title: '계정 동기화 완료',
        description: `강사 ${instructorCount}명 조직장 ${directorCount}명 운영자 ${operatorCount}명 중복 제외 총 ${totalUnique}명 입니다.`
      });

      // 상세 결과를 콘솔에 출력
      console.log('계정 생성 결과:', results);
      
    } catch (error) {
      console.error('Error creating instructor users:', error);
      toast({
        title: "오류",
        description: "강사 계정 생성 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteCourse = async (course: Course) => {
    try {
      // Remove all instructor course assignments first
      await supabase
        .from('instructor_courses')
        .delete()
        .eq('course_id', course.id);

      // Delete the course
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', course.id);

      if (error) throw error;

      toast({
        title: "성공",
        description: `과목 "${course.title}"가 삭제되었습니다.`
      });

      fetchData();
    } catch (error) {
      console.error('Error deleting course:', error);
      toast({
        title: "오류",
        description: "과목 삭제 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
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
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <Button
                onClick={() => navigate('/dashboard')}
                variant="ghost"
                size="sm"
                className="touch-friendly"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">대시보드</span>
                <span className="sm:hidden">뒤로</span>
              </Button>
              <div className="text-center flex-1 min-w-0 mx-4">
                <h1 className="text-sm sm:text-lg font-semibold text-primary break-words">
                  {currentView === 'instructors' ? '강사 관리' : '과목 관리'}
                </h1>
                <p className="text-xs text-muted-foreground break-words">
                  {currentView === 'instructors' ? '강사 정보 등록 및 관리' : '과목 정보 등록 및 관리'}
                </p>
              </div>
            </div>
            
            {/* 탭 버튼들 */}
            <div className="flex gap-2 mb-3">
            <Button
              variant={currentView === 'instructors' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentView('instructors')}
              className="touch-friendly flex-1 text-xs sm:text-sm"
            >
              <UserPlus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              강사 관리
            </Button>
            <Button
              variant={currentView === 'courses' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentView('courses')}
              className="touch-friendly flex-1 text-xs sm:text-sm"
            >
              <BookOpen className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              과목 관리
            </Button>
          </div>
          
          {/* 액션 버튼 */}
          <div className="flex flex-col gap-2">
            {currentView === 'courses' && (
              <Button 
                onClick={() => {
                  setEditingCourse(null);
                  setNewCourseTitle('');
                  setNewCourseDescription('');
                  setIsCourseDialogOpen(true);
                }}
                className="touch-friendly text-xs sm:text-sm w-full"
              >
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                새 과목 추가
              </Button>
            )}
            {currentView === 'instructors' && (
              <div className="grid grid-cols-1 gap-2 w-full">
                <Button onClick={openAddDialog} className="touch-friendly text-xs sm:text-sm w-full">
                  <UserPlus className="h-4 w-4 mr-2" />
                  새 강사 추가
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    onClick={handleSyncAllInstructors} 
                    variant="outline"
                    className="touch-friendly text-xs sm:text-sm w-full"
                  >
                    <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    계정 동기화
                  </Button>
                  <Button 
                    onClick={() => setCurrentView('courses')}
                    variant="secondary"
                    className="touch-friendly text-xs sm:text-sm w-full"
                  >
                    <BookOpen className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    과목 관리
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Action Buttons */}
      <div className="sm:hidden p-4 border-b bg-background">
        <div className="flex gap-2 justify-center">
          {currentView === 'courses' && (
            <Button 
              onClick={() => {
                setEditingCourse(null);
                setNewCourseTitle('');
                setNewCourseDescription('');
                setIsCourseDialogOpen(true);
              }}
              variant="outline"
              className="touch-friendly text-sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              새 과목 추가
            </Button>
          )}
          {currentView === 'instructors' && (
            <Button onClick={openAddDialog} className="touch-friendly text-sm">
              <UserPlus className="h-4 w-4 mr-2" />
              새 강사 추가
            </Button>
          )}
        </div>
      </div>
          

      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">전체 강사</CardTitle>
                <UserPlus className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{instructors.length}</div>
                <p className="text-xs text-muted-foreground">등록된 강사 수</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">전체 과목</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{courses.length}</div>
                <p className="text-xs text-muted-foreground">개설된 과목 수</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">평균 담당 과목</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(() => {
                    const realInstructors = instructors.filter(instructor => 
                      instructorRoles[instructor.id]?.includes('instructor')
                    ).length;
                    return realInstructors > 0 ? Math.round((courses.length / realInstructors) * 10) / 10 : 0;
                  })()}
                </div>
                <p className="text-xs text-muted-foreground">실제 강사당 과목 수</p>
              </CardContent>
            </Card>
          </div>

          {/* Content based on current view */}
          {currentView === 'instructors' && (
            <>
              {/* Instructors Grid */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {instructors.map((instructor) => {
                  const instructorCourses = getInstructorCourses(instructor.id);
                  
                  return (
                    <Card key={instructor.id} className="group hover:shadow-lg transition-all duration-300">
                      <CardHeader className="text-center">
                        <div className="relative mx-auto">
                          <Avatar className="w-20 h-20 mx-auto">
                            <AvatarImage 
                              src={instructor.photo_url} 
                              alt={instructor.name}
                              className="object-cover"
                            />
                            <AvatarFallback className="text-lg">
                              {instructor.name.substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) {
                                  handlePhotoUpload(file, instructor.id);
                                }
                              };
                              input.click();
                            }}
                            disabled={uploadingPhoto}
                          >
                            <Camera className="h-4 w-4" />
                          </Button>
                        </div>
                        <div>
                          <CardTitle className="text-base sm:text-lg break-words">{instructor.name}</CardTitle>
                          {instructor.email && (
                            <p className="text-sm text-muted-foreground break-words">{instructor.email}</p>
                          )}
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        {instructor.bio && (
                          <p className="text-sm text-muted-foreground line-clamp-3 break-words hyphens-auto">
                            {instructor.bio}
                          </p>
                        )}
                        
                          <div>
                           <div className="flex items-center justify-between">
                             <Label className="text-sm font-medium">역할</Label>
                             {canEditRoles() && (
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 onClick={() => handleOpenRoleDialog(instructor)}
                                 className="h-6 px-2 text-xs"
                               >
                                 <Edit className="h-3 w-3 mr-1" />
                                 수정
                               </Button>
                             )}
                           </div>
                           <div className="flex flex-wrap gap-1 mt-1">
                             {instructorRoles[instructor.id]?.length > 0 ? (
                               instructorRoles[instructor.id].map((role) => (
                                 <Badge 
                                   key={role} 
                                   variant={role === 'instructor' ? 'default' : 'outline'} 
                                   className="text-xs break-words"
                                 >
                                   {role === 'instructor' ? '강사' : 
                                    role === 'admin' ? '관리자' : 
                                    role === 'director' ? '조직장' : 
                                    role === 'operator' ? '운영' : role}
                                 </Badge>
                               ))
                             ) : (
                               <span className="text-xs text-muted-foreground">역할 없음</span>
                             )}
                           </div>
                         </div>
                         
                         <div>
                           <Label className="text-sm font-medium">담당 과목</Label>
                           <div className="flex flex-wrap gap-1 mt-1">
                             {instructorCourses.length > 0 ? (
                               instructorCourses.map((course) => (
                                 <Badge key={course.id} variant="secondary" className="text-xs break-words">
                                   {course.title}
                                 </Badge>
                               ))
                             ) : (
                               <span className="text-xs text-muted-foreground">담당 과목 없음</span>
                             )}
                           </div>
                         </div>
                        
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 touch-friendly text-sm"
                            onClick={() => openEditDialog(instructor)}
                          >
                            <Edit className="h-4 w-4 mr-1 sm:mr-2" />
                            <span className="break-words">수정</span>
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="destructive" 
                                size="sm"
                                className="px-3 touch-friendly"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>강사 삭제</AlertDialogTitle>
                                <AlertDialogDescription className="break-words hyphens-auto">
                                  "{instructor.name}" 강사를 삭제하시겠습니까?<br />
                                  이 작업은 되돌릴 수 없으며, 담당 과목에서도 해제됩니다.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteInstructor(instructor)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  삭제
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {instructors.length === 0 && (
                <div className="text-center py-12">
                  <UserPlus className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">등록된 강사가 없습니다</h3>
                  <p className="text-muted-foreground mb-4">첫 번째 강사를 추가해보세요!</p>
                  <Button onClick={openAddDialog}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    강사 추가하기
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Course Management View */}
          {currentView === 'courses' && (
            <>
              {/* Courses List */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    전체 과목 목록
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {courses.length > 0 ? (
                    <div className="space-y-2">
                      {courses.map((course) => {
                        const assignedInstructors = instructorCourses
                          .filter(ic => ic.course_id === course.id)
                          .map(ic => instructors.find(inst => inst.id === ic.instructor_id))
                          .filter(Boolean);
                        
                        return (
                          <div 
                            key={course.id} 
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex-1">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className="font-medium text-sm">{course.title}</h3>
                                  {course.description && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {course.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs text-muted-foreground">담당 강사:</span>
                                    <div className="flex flex-wrap gap-1">
                                      {assignedInstructors.length > 0 ? (
                                        assignedInstructors.map((instructor) => (
                                          <Badge key={instructor?.id} variant="outline" className="text-xs">
                                            {instructor?.name}
                                          </Badge>
                                        ))
                                      ) : (
                                        <span className="text-xs text-muted-foreground">담당 강사 없음</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-2 ml-4">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditCourse(course)}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    수정
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                      >
                                        <Trash2 className="h-4 w-4 mr-1" />
                                        삭제
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>과목 삭제</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          "{course.title}" 과목을 삭제하시겠습니까?<br />
                                          이 작업은 되돌릴 수 없으며, 모든 강사 할당이 해제됩니다.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>취소</AlertDialogCancel>
                                        <AlertDialogAction 
                                          onClick={() => handleDeleteCourse(course)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          삭제
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <h3 className="text-lg font-semibold mb-2">등록된 과목이 없습니다</h3>
                      <p className="text-muted-foreground mb-4">첫 번째 과목을 추가해보세요!</p>
                      <Button 
                        onClick={() => {
                          setEditingCourse(null);
                          setNewCourseTitle('');
                          setNewCourseDescription('');
                          setIsCourseDialogOpen(true);
                        }}
                      >
                        <BookOpen className="h-4 w-4 mr-2" />
                        과목 추가하기
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Add/Edit Instructor Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingInstructor ? '강사 정보 수정' : '새 강사 추가'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Photo Upload */}
              <div className="flex flex-col items-center space-y-2">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={formData.photo_url} />
                  <AvatarFallback>
                    {formData.name ? formData.name.substring(0, 2) : '사진'}
                  </AvatarFallback>
                </Avatar>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        handlePhotoUpload(file);
                      }
                    };
                    input.click();
                  }}
                  disabled={uploadingPhoto}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingPhoto ? '업로드 중...' : '사진 업로드'}
                </Button>
              </div>

              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">이름 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email">이메일</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="bio">소개</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  rows={3}
                  placeholder="강사 소개를 입력하세요..."
                />
              </div>

              {/* Course Management */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">담당 과목</Label>
                
                 {/* All Courses List */}
                 <div>
                   <Label className="text-sm text-muted-foreground">과목 선택</Label>
                   <Input
                     placeholder="과목명으로 검색..."
                     value={courseSearchQuery}
                     onChange={(e) => setCourseSearchQuery(e.target.value)}
                     className="mt-2 mb-2"
                   />
                    <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto border rounded-md p-2">
                      {(() => {
                        const filteredCourses = courses.filter((course) => 
                          course.title.toLowerCase().includes(courseSearchQuery.toLowerCase()) ||
                          (course.description || '').toLowerCase().includes(courseSearchQuery.toLowerCase())
                        );
                        
                        if (filteredCourses.length === 0 && courseSearchQuery.trim() !== '') {
                          return (
                            <div className="text-sm text-muted-foreground text-center py-4">
                              검색 결과가 없습니다
                            </div>
                          );
                        }
                        
                        if (courses.length === 0) {
                          return (
                            <div className="text-sm text-muted-foreground text-center py-4">
                              등록된 과목이 없습니다
                            </div>
                          );
                        }
                        
                        return filteredCourses.map((course) => {
                          const isSelected = selectedCourses.includes(course.id);
                          const otherInstructors = instructorCourses
                            .filter(ic => ic.course_id === course.id && ic.instructor_id !== editingInstructor?.id)
                            .map(ic => instructors.find(inst => inst.id === ic.instructor_id))
                            .filter(Boolean);
                          
                          return (
                            <div
                              key={course.id}
                              className={`flex items-center space-x-2 p-2 rounded transition-colors ${
                                isSelected
                                  ? 'bg-primary/10 border border-primary' 
                                  : 'bg-muted/50 hover:bg-muted'
                              }`}
                            >
                              <div 
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer ${
                                  isSelected
                                    ? 'bg-primary border-primary' 
                                    : 'border-muted-foreground'
                                }`}
                                onClick={() => toggleCourseSelection(course.id)}
                              >
                                {isSelected && (
                                  <div className="w-2 h-2 bg-white rounded-full" />
                                )}
                              </div>
                              <div className="flex-1" onClick={() => toggleCourseSelection(course.id)}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{course.title}</span>
                                  {otherInstructors.length > 0 && (
                                    <div className="flex gap-1">
                                      {otherInstructors.map((instructor, index) => (
                                        <Badge key={index} variant="outline" className="text-xs">
                                          {instructor?.name}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {course.description && (
                                  <div className="text-xs text-muted-foreground">{course.description}</div>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditCourse(course);
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>과목 삭제</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        "{course.title}" 과목을 삭제하시겠습니까?<br />
                                        이 작업은 되돌릴 수 없으며, 모든 강사 할당이 해제됩니다.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>취소</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => handleDeleteCourse(course)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        삭제
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                </div>

                {/* Add New Course */}
                <div className="border-t pt-4">
                  <Label className="text-sm text-muted-foreground">새 과목 추가</Label>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    <Input
                      placeholder="과목명"
                      value={newCourseTitle}
                      onChange={(e) => setNewCourseTitle(e.target.value)}
                    />
                    <Input
                      placeholder="과목 설명 (선택사항)"
                      value={newCourseDescription}
                      onChange={(e) => setNewCourseDescription(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddNewCourse}
                      disabled={!newCourseTitle.trim()}
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      과목 추가
                    </Button>
                  </div>
                </div>

                {/* Selected Courses Display */}
                {selectedCourses.length > 0 && (
                  <div>
                    <Label className="text-sm text-muted-foreground">선택된 과목</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedCourses.map((courseId) => {
                        const course = courses.find(c => c.id === courseId);
                        return course ? (
                          <Badge key={courseId} variant="default" className="flex items-center gap-1">
                            {course.title}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 w-4 h-4"
                              onClick={() => toggleCourseSelection(courseId)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  취소
                </Button>
                <Button type="submit">
                  {editingInstructor ? '수정' : '추가'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Course Edit Dialog */}
        <Dialog open={isCourseDialogOpen} onOpenChange={setIsCourseDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCourse ? '과목 수정' : '새 과목 추가'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCourseSubmit} className="space-y-4">
              <div>
                <Label htmlFor="courseTitle">과목명 *</Label>
                <Input
                  id="courseTitle"
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  placeholder="과목명을 입력하세요"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="courseDescription">설명</Label>
                <Textarea
                  id="courseDescription"
                  value={newCourseDescription}
                  onChange={(e) => setNewCourseDescription(e.target.value)}
                  placeholder="과목 설명을 입력하세요 (선택사항)"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsCourseDialogOpen(false);
                    setEditingCourse(null);
                    setNewCourseTitle('');
                    setNewCourseDescription('');
                  }}
                >
                  취소
                </Button>
                <Button type="submit" disabled={!newCourseTitle.trim()}>
                  {editingCourse ? '수정' : '추가'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* 역할 수정 다이얼로그 */}
        <Dialog open={roleEditDialog} onOpenChange={setRoleEditDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>역할 관리</DialogTitle>
              <DialogDescription>
                {editingInstructorRoles?.instructorName}의 역할을 수정합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-3">
                {['instructor', 'admin', 'director', 'operator'].map((role) => (
                  <div key={role} className="flex items-center space-x-2">
                    <Checkbox
                      id={role}
                      checked={selectedRoles.includes(role)}
                      onCheckedChange={(checked) => handleRoleChange(role, checked as boolean)}
                    />
                    <Label htmlFor={role} className="text-sm">
                      {role === 'instructor' ? '강사' : 
                       role === 'admin' ? '관리자' : 
                       role === 'director' ? '조직장' : 
                       role === 'operator' ? '운영' : role}
                    </Label>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRoleEditDialog(false)}>
                  취소
                </Button>
                <Button onClick={handleSaveRoles}>
                  저장
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default InstructorManagement;