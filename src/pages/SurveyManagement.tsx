import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Calendar, Users, ArrowLeft, Play, Square, Mail, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Survey {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  education_year: number;
  education_round: number;
  status: string;
  instructor_id: string;
  course_id: string;
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
  instructor_id: string;
}

const SurveyManagement = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedInstructor, setSelectedInstructor] = useState<string>('');
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    education_year: new Date().getFullYear(),
    education_round: 1,
    instructor_id: '',
    course_id: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedInstructor) {
      const filtered = courses.filter(course => course.instructor_id === selectedInstructor);
      setFilteredCourses(filtered);
      setFormData(prev => ({ ...prev, instructor_id: selectedInstructor, course_id: '' }));
    }
  }, [selectedInstructor, courses]);

  const fetchData = async () => {
    try {
      const [surveysRes, instructorsRes, coursesRes] = await Promise.all([
        supabase.from('surveys').select('*').order('created_at', { ascending: false }),
        supabase.from('instructors').select('*').order('name'),
        supabase.from('courses').select('*').order('title')
      ]);

      if (surveysRes.error) throw surveysRes.error;
      if (instructorsRes.error) throw instructorsRes.error;
      if (coursesRes.error) throw coursesRes.error;

      setSurveys(surveysRes.data || []);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from('surveys')
        .insert([{
          ...formData,
          created_by: user?.id
        }]);

      if (error) throw error;

      toast({
        title: "성공",
        description: "설문조사가 생성되었습니다."
      });

      setIsDialogOpen(false);
      setFormData({
        title: '',
        description: '',
        start_date: '',
        end_date: '',
        education_year: new Date().getFullYear(),
        education_round: 1,
        instructor_id: '',
        course_id: ''
      });
      setSelectedInstructor('');
      fetchData();
    } catch (error) {
      console.error('Error creating survey:', error);
      toast({
        title: "오류",
        description: "설문조사 생성 중 오류가 발생했습니다.",
        variant: "destructive"
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
        title: "성공",
        description: `설문조사가 ${newStatus === 'active' ? '시작' : '종료'}되었습니다.`
      });

      fetchData();
    } catch (error) {
      console.error('Error updating survey status:', error);
      toast({
        title: "오류",
        description: "설문조사 상태 변경 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const duplicateSurvey = async (survey: Survey) => {
    try {
      const { error } = await supabase
        .from('surveys')
        .insert([{
          title: `${survey.title} (복사본)`,
          description: survey.description,
          start_date: survey.start_date,
          end_date: survey.end_date,
          education_year: survey.education_year,
          education_round: survey.education_round,
          instructor_id: survey.instructor_id,
          course_id: survey.course_id,
          status: 'draft',
          created_by: user?.id
        }]);

      if (error) throw error;

      toast({
        title: "성공",
        description: "설문조사가 복제되었습니다."
      });

      fetchData();
    } catch (error) {
      console.error('Error duplicating survey:', error);
      toast({
        title: "오류",
        description: "설문조사 복제 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const sendSurveyResults = async (surveyId: string) => {
    try {
      // TODO: Implement email sending functionality
      toast({
        title: "알림",
        description: "이메일 전송 기능은 구현 예정입니다."
      });
    } catch (error) {
      console.error('Error sending survey results:', error);
      toast({
        title: "오류",
        description: "이메일 전송 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'draft': { label: '초안', variant: 'secondary' as const },
      'active': { label: '진행중', variant: 'default' as const },
      'completed': { label: '완료', variant: 'outline' as const }
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || { label: status, variant: 'secondary' as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
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
              <h1 className="text-lg font-semibold text-primary">설문조사 관리</h1>
              <p className="text-xs text-muted-foreground">설문조사 생성 및 관리</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">설문조사 목록</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              새 설문조사
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>새 설문조사 만들기</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">제목</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="education_year">교육 연도</Label>
                  <Input
                    id="education_year"
                    type="number"
                    value={formData.education_year}
                    onChange={(e) => setFormData(prev => ({ ...prev, education_year: parseInt(e.target.value) }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="education_round">차수</Label>
                  <Input
                    id="education_round"
                    type="number"
                    min="1"
                    value={formData.education_round}
                    onChange={(e) => setFormData(prev => ({ ...prev, education_round: parseInt(e.target.value) }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="start_date">시작일</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">종료일</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="instructor">강사 선택</Label>
                  <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
                    <SelectTrigger>
                      <SelectValue placeholder="강사를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {instructors.map((instructor) => (
                        <SelectItem key={instructor.id} value={instructor.id}>
                          {instructor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="course">강의 선택</Label>
                  <Select value={formData.course_id} onValueChange={(value) => setFormData(prev => ({ ...prev, course_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="강의를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCourses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">설명</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  취소
                </Button>
                <Button type="submit">생성</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {surveys.map((survey) => (
          <Card key={survey.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {survey.title}
                    {getStatusBadge(survey.status)}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {survey.education_year}년 {survey.education_round}차
                  </p>
                </div>
                <div className="flex gap-2">
                  {survey.status === 'draft' && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => updateSurveyStatus(survey.id, 'active')}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      시작
                    </Button>
                  )}
                  {survey.status === 'active' && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => updateSurveyStatus(survey.id, 'completed')}
                    >
                      <Square className="h-4 w-4 mr-1" />
                      종료
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => sendSurveyResults(survey.id)}
                  >
                    <Mail className="h-4 w-4 mr-1" />
                    결과 전송
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => duplicateSurvey(survey)}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    복제
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{survey.description}</p>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(survey.start_date).toLocaleDateString()} ~ {new Date(survey.end_date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>응답 수: 0</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SurveyManagement;