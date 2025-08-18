import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Camera, UserPlus, Upload, X, Trash2, Users, RefreshCcw, Grid3X3, List } from 'lucide-react';
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
  const [viewType, setViewType] = useState<'card' | 'list'>('card');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseDescription, setNewCourseDescription] = useState('');
  const [isCreateUsersDialogOpen, setIsCreateUsersDialogOpen] = useState(false);
  const [selectedInstructorsForUsers, setSelectedInstructorsForUsers] = useState<string[]>([]);
  const [creatingUsers, setCreatingUsers] = useState(false);

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
      // First delete instructor-course assignments
      await supabase
        .from('instructor_courses')
        .delete()
        .eq('instructor_id', instructor.id);

      // Then delete the instructor
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

  // 계정 동기화 기능
  const handleSyncAllInstructors = async () => {
    setCreatingUsers(true);
    try {
      const instructorsWithEmail = instructors.filter(instructor => instructor.email);
      
      if (instructorsWithEmail.length === 0) {
        toast({
          title: "알림",
          description: "이메일이 등록된 강사가 없습니다.",
          variant: "default"
        });
        return;
      }

      const instructorData = instructorsWithEmail.map(instructor => ({
        id: instructor.id,
        email: instructor.email,
        name: instructor.name
      }));

      const response = await fetch('/api/create-instructor-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ instructors: instructorData }),
      });

      if (!response.ok) {
        throw new Error('계정 동기화 요청 실패');
      }

      const result = await response.json();
      
      toast({
        title: "동기화 완료",
        description: `${result.successful.length}명의 강사 계정이 처리되었습니다.`,
        variant: "default"
      });

      // 역할 정보 새로고침
      await fetchInstructorRoles();
    } catch (error) {
      console.error('Error syncing instructors:', error);
      toast({
        title: "오류",
        description: "계정 동기화 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setCreatingUsers(false);
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
    <div className="space-y-6">
      {/* Header */}
      {showPageHeader && (
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold">강사 관리</h1>
            <p className="text-muted-foreground">강사 정보 및 계정 관리</p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button onClick={openAddDialog} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                새 강사 추가
              </Button>
              <Button 
                onClick={handleSyncAllInstructors} 
                variant="outline"
                disabled={creatingUsers}
                className="flex items-center gap-2"
              >
                <RefreshCcw className={`h-4 w-4 ${creatingUsers ? 'animate-spin' : ''}`} />
                계정 동기화
              </Button>
            </div>
            
            {/* View Toggle */}
            <div className="flex gap-1 border rounded-md p-1">
              <Button
                variant={viewType === 'card' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewType('card')}
                className="h-8 px-3"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewType === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewType('list')}
                className="h-8 px-3"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">총 강사 수</p>
                <p className="text-2xl font-bold">{instructors.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <UserPlus className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">계정 연결된 강사</p>
                <p className="text-2xl font-bold">
                  {Object.keys(instructorRoles).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instructors Grid/List */}
      {viewType === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {instructors.map((instructor) => {
            const instructorCoursesData = getInstructorCourses(instructor.id);
            
            return (
              <Card key={instructor.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={instructor.photo_url} alt={instructor.name} />
                        <AvatarFallback>{instructor.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg leading-tight">{instructor.name}</CardTitle>
                        {instructor.email && (
                          <p className="text-sm text-muted-foreground truncate">{instructor.email}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpload(file, instructor.id);
                        }}
                        className="hidden"
                        id={`photo-${instructor.id}`}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => document.getElementById(`photo-${instructor.id}`)?.click()}
                        disabled={uploadingPhoto}
                        className="p-1 h-auto"
                      >
                        <Camera className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  {instructor.bio && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {instructor.bio}
                    </p>
                  )}
                </CardHeader>
                
                <CardContent className="pt-0 space-y-4">
                  {/* Roles */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">역할</p>
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
                    <div className="flex flex-wrap gap-1">
                      {instructorRoles[instructor.id]?.length > 0 ? (
                        instructorRoles[instructor.id].map((role) => (
                          <Badge 
                            key={role} 
                            variant={role === 'instructor' ? 'default' : 'outline'} 
                            className="text-xs"
                          >
                            {role === 'instructor' ? '강사' : 
                             role === 'admin' ? '관리자' : 
                             role === 'director' ? '조직장' : 
                             role === 'operator' ? '운영' : role}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="text-xs">역할 없음</Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Courses */}
                  <div>
                    <p className="text-sm font-medium mb-2">담당 과목</p>
                    <div className="flex flex-wrap gap-1">
                      {instructorCoursesData.length > 0 ? (
                        instructorCoursesData.map((course) => (
                          <Badge key={course.id} variant="secondary" className="text-xs">
                            {course.title}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="text-xs">담당 과목 없음</Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(instructor)}
                      className="flex-1"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      수정
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>강사 삭제</AlertDialogTitle>
                          <AlertDialogDescription>
                            정말로 "{instructor.name}" 강사를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
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
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-medium">강사</th>
                    <th className="text-left p-4 font-medium">이메일</th>
                    <th className="text-left p-4 font-medium">역할</th>
                    <th className="text-left p-4 font-medium">담당 과목</th>
                    <th className="text-left p-4 font-medium">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {instructors.map((instructor) => {
                    const instructorCoursesData = getInstructorCourses(instructor.id);
                    
                    return (
                      <tr key={instructor.id} className="border-b hover:bg-muted/50">
                        <td className="p-4">
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={instructor.photo_url} alt={instructor.name} />
                              <AvatarFallback>{instructor.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{instructor.name}</p>
                              {instructor.bio && (
                                <p className="text-sm text-muted-foreground line-clamp-1">{instructor.bio}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-sm">{instructor.email || '-'}</p>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {instructorRoles[instructor.id]?.length > 0 ? (
                              instructorRoles[instructor.id].map((role) => (
                                <Badge 
                                  key={role} 
                                  variant={role === 'instructor' ? 'default' : 'outline'} 
                                  className="text-xs"
                                >
                                  {role === 'instructor' ? '강사' : 
                                   role === 'admin' ? '관리자' : 
                                   role === 'director' ? '조직장' : 
                                   role === 'operator' ? '운영' : role}
                                </Badge>
                              ))
                            ) : (
                              <Badge variant="outline" className="text-xs">역할 없음</Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {instructorCoursesData.length > 0 ? (
                              instructorCoursesData.slice(0, 2).map((course) => (
                                <Badge key={course.id} variant="secondary" className="text-xs">
                                  {course.title}
                                </Badge>
                              ))
                            ) : (
                              <Badge variant="outline" className="text-xs">담당 과목 없음</Badge>
                            )}
                            {instructorCoursesData.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{instructorCoursesData.length - 2}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(instructor)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            
                            {canEditRoles() && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenRoleDialog(instructor)}
                              >
                                <UserPlus className="h-4 w-4" />
                              </Button>
                            )}
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>강사 삭제</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    정말로 "{instructor.name}" 강사를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Instructor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingInstructor ? '강사 수정' : '새 강사 추가'}
            </DialogTitle>
            <DialogDescription>
              강사 기본 정보와 담당 과목을 설정하세요.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">이름 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="강사 이름"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="이메일 주소"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="bio">소개</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="강사 소개"
                rows={3}
              />
            </div>
            
            {/* Photo Upload */}
            <div className="space-y-2">
              <Label>프로필 사진</Label>
              <div className="flex items-center gap-4">
                {formData.photo_url && (
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={formData.photo_url} alt="미리보기" />
                    <AvatarFallback><Camera /></AvatarFallback>
                  </Avatar>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoUpload(file);
                    }}
                    className="hidden"
                    id="photo-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('photo-upload')?.click()}
                    disabled={uploadingPhoto}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploadingPhoto ? '업로드 중...' : '사진 업로드'}
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Course Selection */}
            <div className="space-y-2">
              <Label>담당 과목</Label>
              <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                {courses.length > 0 ? (
                  courses.map((course) => (
                    <div key={course.id} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`course-${course.id}`}
                        checked={selectedCourses.includes(course.id)}
                        onCheckedChange={() => toggleCourseSelection(course.id)}
                      />
                      <Label htmlFor={`course-${course.id}`} className="flex-1 text-sm">
                        {course.title}
                        {course.description && (
                          <span className="text-muted-foreground"> - {course.description}</span>
                        )}
                      </Label>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">등록된 과목이 없습니다.</p>
                )}
              </div>
            </div>
            
            {/* Add New Course */}
            <div className="space-y-2">
              <Label>새 과목 추가</Label>
              <div className="border rounded-md p-3 space-y-3">
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
                  onClick={handleAddNewCourse}
                  disabled={!newCourseTitle.trim()}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  과목 추가하고 선택
                </Button>
              </div>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                취소
              </Button>
              <Button type="submit" className="flex-1">
                {editingInstructor ? '수정' : '추가'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Role Edit Dialog */}
      <Dialog open={roleEditDialog} onOpenChange={setRoleEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>역할 수정</DialogTitle>
            <DialogDescription>
              {editingInstructorRoles?.instructorName}의 역할을 설정하세요.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {['instructor', 'admin', 'operator', 'director'].map((role) => (
              <div key={role} className="flex items-center space-x-2">
                <Checkbox
                  id={`role-${role}`}
                  checked={selectedRoles.includes(role)}
                  onCheckedChange={(checked) => handleRoleChange(role, !!checked)}
                />
                <Label htmlFor={`role-${role}`}>
                  {role === 'instructor' ? '강사' : 
                   role === 'admin' ? '관리자' : 
                   role === 'director' ? '조직장' : 
                   role === 'operator' ? '운영' : role}
                </Label>
              </div>
            ))}
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => setRoleEditDialog(false)} className="flex-1">
              취소
            </Button>
            <Button onClick={handleSaveRoles} className="flex-1">
              저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InstructorManagement;