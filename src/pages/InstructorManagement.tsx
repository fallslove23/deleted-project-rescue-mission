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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Edit, Camera, UserPlus, BookOpen, Upload, X, PlusCircle, Trash2 } from 'lucide-react';
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

const InstructorManagement = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructorCourses, setInstructorCourses] = useState<InstructorCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseDescription, setNewCourseDescription] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    bio: '',
    photo_url: ''
  });

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div>로딩중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header with back button */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <Button
              onClick={() => navigate('/dashboard')}
              variant="ghost"
              size="sm"
              className="mr-3"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              대시보드
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-primary">강사 관리</h1>
              <p className="text-xs text-muted-foreground">강사 정보 및 과목 관리</p>
            </div>
          </div>
          <Button onClick={openAddDialog}>
            <UserPlus className="h-4 w-4 mr-2" />
            새 강사 추가
          </Button>
        </div>
      </header>

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
                  {instructors.length > 0 ? Math.round((courses.length / instructors.length) * 10) / 10 : 0}
                </div>
                <p className="text-xs text-muted-foreground">강사당 과목 수</p>
              </CardContent>
            </Card>
          </div>

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
                      <CardTitle className="text-lg">{instructor.name}</CardTitle>
                      {instructor.email && (
                        <p className="text-sm text-muted-foreground">{instructor.email}</p>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {instructor.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {instructor.bio}
                      </p>
                    )}
                    
                    <div>
                      <Label className="text-sm font-medium">담당 과목</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {instructorCourses.length > 0 ? (
                          instructorCourses.map((course) => (
                            <Badge key={course.id} variant="secondary" className="text-xs">
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
                        className="flex-1"
                        onClick={() => openEditDialog(instructor)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        수정
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            className="px-3"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>강사 삭제</AlertDialogTitle>
                            <AlertDialogDescription>
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
                   <div className="grid grid-cols-1 gap-2 mt-2 max-h-32 overflow-y-auto border rounded-md p-2">
                     {courses.map((course) => {
                       const isSelected = selectedCourses.includes(course.id);
                       const otherInstructors = instructorCourses
                         .filter(ic => ic.course_id === course.id && ic.instructor_id !== editingInstructor?.id)
                         .map(ic => instructors.find(inst => inst.id === ic.instructor_id))
                         .filter(Boolean);
                       
                       return (
                         <div
                           key={course.id}
                           className={`flex items-center space-x-2 p-2 rounded transition-colors cursor-pointer ${
                             isSelected
                               ? 'bg-primary/10 border border-primary' 
                               : 'bg-muted/50 hover:bg-muted'
                           }`}
                           onClick={() => toggleCourseSelection(course.id)}
                         >
                           <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                             isSelected
                               ? 'bg-primary border-primary' 
                               : 'border-muted-foreground'
                           }`}>
                             {isSelected && (
                               <div className="w-2 h-2 bg-white rounded-full" />
                             )}
                           </div>
                           <div className="flex-1">
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
                         </div>
                       );
                     })}
                     {courses.length === 0 && (
                       <div className="text-sm text-muted-foreground text-center py-4">
                         등록된 과목이 없습니다
                       </div>
                     )}
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
      </main>
    </div>
  );
};

export default InstructorManagement;