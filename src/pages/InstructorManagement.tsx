import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Edit, Camera, UserPlus, BookOpen, Upload } from 'lucide-react';
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
  instructor_id: string;
}

const InstructorManagement = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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
      const [instructorsRes, coursesRes] = await Promise.all([
        supabase.from('instructors').select('*').order('name'),
        supabase.from('courses').select('*').order('title')
      ]);

      if (instructorsRes.error) throw instructorsRes.error;
      if (coursesRes.error) throw coursesRes.error;

      setInstructors(instructorsRes.data || []);
      setCourses(coursesRes.data || []);
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
      if (editingInstructor) {
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
        const { error } = await supabase
          .from('instructors')
          .insert([formData]);

        if (error) throw error;
        
        toast({
          title: "성공",
          description: "새 강사가 추가되었습니다."
        });
      }

      setIsDialogOpen(false);
      setEditingInstructor(null);
      setFormData({ name: '', email: '', bio: '', photo_url: '' });
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
    setIsDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingInstructor(null);
    setFormData({ name: '', email: '', bio: '', photo_url: '' });
    setIsDialogOpen(true);
  };

  const getInstructorCourses = (instructorId: string) => {
    return courses.filter(course => course.instructor_id === instructorId);
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
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => openEditDialog(instructor)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      수정
                    </Button>
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
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingInstructor ? '강사 정보 수정' : '새 강사 추가'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <div className="flex justify-end gap-2">
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