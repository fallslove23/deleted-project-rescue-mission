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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, BookOpen, Trash2, Users, Grid3X3, List, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';

interface Course {
  id: string;
  title: string;
  description: string;
}

interface Instructor {
  id: string;
  name: string;
  email: string;
}

interface InstructorCourse {
  id: string;
  instructor_id: string;
  course_id: string;
}

const CourseManagement = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [instructorCourses, setInstructorCourses] = useState<InstructorCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState<'card' | 'list'>('card');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [coursesRes, instructorsRes, instructorCoursesRes] = await Promise.all([
        supabase.from('courses').select('*').order('title'),
        supabase.from('instructors').select('id, name, email').order('name'),
        supabase.from('instructor_courses').select('*')
      ]);

      if (coursesRes.error) throw coursesRes.error;
      if (instructorsRes.error) throw instructorsRes.error;
      if (instructorCoursesRes.error) throw instructorCoursesRes.error;

      setCourses(coursesRes.data || []);
      setInstructors(instructorsRes.data || []);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingCourse) {
        // Update existing course
        const { error } = await supabase
          .from('courses')
          .update(formData)
          .eq('id', editingCourse.id);

        if (error) throw error;
        
        toast({
          title: "성공",
          description: "과목 정보가 수정되었습니다."
        });
      } else {
        // Create new course
        const { error } = await supabase
          .from('courses')
          .insert([formData]);

        if (error) throw error;
        
        toast({
          title: "성공",
          description: "새 과목이 추가되었습니다."
        });
      }

      setIsDialogOpen(false);
      setEditingCourse(null);
      setFormData({ title: '', description: '' });
      fetchData();
    } catch (error) {
      console.error('Error saving course:', error);
      toast({
        title: "오류",
        description: "과목 정보 저장 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const openEditDialog = (course: Course) => {
    setEditingCourse(course);
    setFormData({
      title: course.title,
      description: course.description || ''
    });
    setIsDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingCourse(null);
    setFormData({ title: '', description: '' });
    setIsDialogOpen(true);
  };

  const handleDeleteCourse = async (courseId: string) => {
    try {
      // First delete instructor-course assignments
      await supabase
        .from('instructor_courses')
        .delete()
        .eq('course_id', courseId);

      // Then delete the course
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) throw error;

      toast({
        title: "성공",
        description: "과목이 삭제되었습니다."
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

  const getCourseInstructors = (courseId: string) => {
    const courseInstructorIds = instructorCourses
      .filter(ic => ic.course_id === courseId)
      .map(ic => ic.instructor_id);
    return instructors.filter(instructor => courseInstructorIds.includes(instructor.id));
  };

  // Filter courses based on search query
  const filteredCourses = courses.filter(course => {
    const searchLower = searchQuery.toLowerCase();
    const courseInstructors = getCourseInstructors(course.id);
    const instructorNames = courseInstructors.map(instructor => instructor.name.toLowerCase()).join(' ');
    
    return course.title.toLowerCase().includes(searchLower) ||
           (course.description && course.description.toLowerCase().includes(searchLower)) ||
           instructorNames.includes(searchLower);
  });

  if (loading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AdminSidebar />
          <main className="flex-1 flex flex-col">
            <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-40 shadow-sm">
              <div className="container mx-auto px-4 py-3 md:py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <SidebarTrigger />
                  <div className="h-10 w-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-neon">
                    <BookOpen className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-base md:text-2xl font-bold bg-gradient-accent bg-clip-text text-transparent">과목 관리</h1>
                    <p className="text-xs md:text-sm text-muted-foreground">과목 정보 및 강사 배정 관리</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs md:text-sm hidden sm:block">환영합니다, {user?.email}</span>
                  <Button onClick={signOut} variant="outline" size="sm">로그아웃</Button>
                </div>
              </div>
            </header>
            <div className="flex-1 flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">데이터를 불러오는 중...</p>
              </div>
            </div>
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        
        <main className="flex-1 flex flex-col">
          {/* Header */}
          <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-40 shadow-sm">
            <div className="container mx-auto px-4 py-3 md:py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div className="h-10 w-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-neon">
                  <BookOpen className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-base md:text-2xl font-bold bg-gradient-accent bg-clip-text text-transparent">과목 관리</h1>
                  <p className="text-xs md:text-sm text-muted-foreground">과목 정보 및 강사 배정 관리</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs md:text-sm hidden sm:block">환영합니다, {user?.email}</span>
                <Button onClick={signOut} variant="outline" size="sm">로그아웃</Button>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 container mx-auto px-4 py-6 space-y-6">
            {/* Action Bar */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">과목 목록</h2>
                <p className="text-muted-foreground text-sm">과목 정보를 관리하고 강사를 배정하세요</p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={openAddDialog} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  새 과목 추가
                </Button>
                
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

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="과목명, 설명, 배정강사로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <BookOpen className="h-8 w-8 text-primary" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">총 과목 수</p>
                      <p className="text-2xl font-bold">{courses.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-primary" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">배정된 강사 수</p>
                      <p className="text-2xl font-bold">
                        {new Set(instructorCourses.map(ic => ic.instructor_id)).size}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Courses Grid/List */}
            {viewType === 'card' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCourses.map((course) => {
                  const courseInstructors = getCourseInstructors(course.id);
                  
                  return (
                    <Card key={course.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">{course.title}</CardTitle>
                            {course.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {course.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pt-0 space-y-4">
                        {/* Assigned Instructors */}
                        <div>
                          <p className="text-sm font-medium mb-2">
                            배정된 강사 ({courseInstructors.length}명)
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {courseInstructors.length > 0 ? (
                              courseInstructors.map((instructor) => (
                                <Badge key={instructor.id} variant="secondary" className="text-xs">
                                  {instructor.name}
                                </Badge>
                              ))
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                배정된 강사 없음
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(course)}
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
                                <AlertDialogTitle>과목 삭제</AlertDialogTitle>
                                <AlertDialogDescription>
                                  정말로 "{course.title}" 과목을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteCourse(course.id)}
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
                          <th className="text-left p-4 font-medium">과목명</th>
                          <th className="text-left p-4 font-medium">설명</th>
                          <th className="text-left p-4 font-medium">배정된 강사</th>
                          <th className="text-left p-4 font-medium">강사 수</th>
                          <th className="text-left p-4 font-medium">작업</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCourses.map((course) => {
                          const courseInstructors = getCourseInstructors(course.id);
                          
                          return (
                            <tr key={course.id} className="border-b hover:bg-muted/50">
                              <td className="p-4">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 bg-primary/10 rounded-md flex items-center justify-center">
                                    <BookOpen className="h-5 w-5 text-primary" />
                                  </div>
                                  <div>
                                    <p className="font-medium">{course.title}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <p className="text-sm text-muted-foreground">
                                  {course.description || '-'}
                                </p>
                              </td>
                              <td className="p-4">
                                <div className="flex flex-wrap gap-1">
                                  {courseInstructors.length > 0 ? (
                                    courseInstructors.slice(0, 2).map((instructor) => (
                                      <Badge key={instructor.id} variant="secondary" className="text-xs">
                                        {instructor.name}
                                      </Badge>
                                    ))
                                  ) : (
                                    <Badge variant="outline" className="text-xs">배정된 강사 없음</Badge>
                                  )}
                                  {courseInstructors.length > 2 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{courseInstructors.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="p-4">
                                <Badge variant="outline" className="text-sm">
                                  {courseInstructors.length}명
                                </Badge>
                              </td>
                              <td className="p-4">
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditDialog(course)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>과목 삭제</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          정말로 "{course.title}" 과목을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>취소</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteCourse(course.id)}
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

            {/* Add/Edit Course Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingCourse ? '과목 수정' : '새 과목 추가'}
                  </DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">과목명 *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="과목명을 입력하세요"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">설명</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="과목 설명을 입력하세요"
                      rows={3}
                    />
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                      취소
                    </Button>
                    <Button type="submit" className="flex-1">
                      {editingCourse ? '수정' : '추가'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default CourseManagement;
