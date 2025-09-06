import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Edit3, Trash2, GripVertical, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Course {
  id: string;
  title: string;
}

interface Instructor {
  id: string;
  name: string;
  email?: string;
  photo_url?: string;
  bio?: string;
}

interface SurveySession {
  id: string;
  survey_id: string;
  course_id: string | null;
  instructor_id: string | null;
  session_name: string;
  session_order: number;
  course?: Course;
  instructor?: Instructor;
}

interface SessionManagerProps {
  surveyId: string;
  sessions: SurveySession[];
  courses: Course[];
  instructors: Instructor[];
  onSessionsChange: (sessions: SurveySession[]) => void;
}

interface SortableSessionItemProps {
  session: SurveySession;
  courses: Course[];
  instructors: Instructor[];
  onEdit: (session: SurveySession) => void;
  onDelete: (sessionId: string) => void;
}

const SortableSessionItem = ({ session, courses, instructors, onEdit, onDelete }: SortableSessionItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: session.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const courseTitle = courses.find(c => c.id === session.course_id)?.title || '과목 미선택';
  const instructorName = instructors.find(i => i.id === session.instructor_id)?.name || '강사 미선택';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border"
    >
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-center w-8 h-8 cursor-move text-muted-foreground hover:text-foreground"
      >
        <GripVertical size={16} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{session.session_name}</span>
          <span className="text-xs text-muted-foreground">#{session.session_order + 1}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">{courseTitle}</span>
          {session.instructor_id && (
            <>
              <span className="mx-1">•</span>
              <span className="flex items-center gap-1">
                <User size={12} />
                {instructorName}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(session)}
        >
          <Edit3 size={14} />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <Trash2 size={14} />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>세션 삭제</AlertDialogTitle>
              <AlertDialogDescription>
                '{session.session_name}' 세션을 삭제하시겠습니까?<br/>
                이 세션에 속한 질문들은 미분류로 이동됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(session.id)}>
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export const SessionManager = ({ 
  surveyId, 
  sessions, 
  courses, 
  instructors, 
  onSessionsChange 
}: SessionManagerProps) => {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<SurveySession | null>(null);
  const [sessionForm, setSessionForm] = useState({
    session_name: "",
    course_id: "",
    instructor_id: ""
  });

  const handleSessionSave = async () => {
    if (!sessionForm.session_name.trim()) {
      toast({ title: "오류", description: "세션 이름을 입력해주세요.", variant: "destructive" });
      return;
    }

    try {
      if (editingSession) {
        // 수정
        const { error } = await supabase
          .from('survey_sessions')
          .update({
            session_name: sessionForm.session_name,
            course_id: sessionForm.course_id === "none" ? null : sessionForm.course_id,
            instructor_id: sessionForm.instructor_id === "none" ? null : sessionForm.instructor_id,
          })
          .eq('id', editingSession.id);
        
        if (error) throw error;
        
        const updatedSessions = sessions.map(s => 
          s.id === editingSession.id 
            ? { 
                ...s, 
                session_name: sessionForm.session_name,
                course_id: sessionForm.course_id === "none" ? null : sessionForm.course_id,
                instructor_id: sessionForm.instructor_id === "none" ? null : sessionForm.instructor_id,
                course: courses.find(c => c.id === sessionForm.course_id),
                instructor: instructors.find(i => i.id === sessionForm.instructor_id)
              }
            : s
        );
        onSessionsChange(updatedSessions);
        
        toast({ title: "성공", description: "세션이 수정되었습니다." });
      } else {
        // 추가
        const { data, error } = await supabase
          .from('survey_sessions')
          .insert({
            survey_id: surveyId,
            session_name: sessionForm.session_name,
            course_id: sessionForm.course_id === "none" ? null : sessionForm.course_id,
            instructor_id: sessionForm.instructor_id === "none" ? null : sessionForm.instructor_id,
            session_order: sessions.length,
          })
          .select(`
            *,
            course:courses(id, title),
            instructor:instructors(id, name, email, photo_url, bio)
          `)
          .single();
        
        if (error) throw error;
        
        onSessionsChange([...sessions, data]);
        toast({ title: "성공", description: "세션이 추가되었습니다." });
      }
      
      setDialogOpen(false);
      setEditingSession(null);
      setSessionForm({ session_name: "", course_id: "none", instructor_id: "none" });
    } catch (error: any) {
      console.error(error);
      toast({ title: "오류", description: error.message || "세션 저장 중 오류가 발생했습니다.", variant: "destructive" });
    }
  };

  const handleEditSession = (session: SurveySession) => {
    setEditingSession(session);
    setSessionForm({
      session_name: session.session_name,
      course_id: session.course_id || "none",
      instructor_id: session.instructor_id || "none"
    });
    setDialogOpen(true);
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('survey_sessions')
        .delete()
        .eq('id', sessionId);
      
      if (error) throw error;
      
      const updatedSessions = sessions.filter(s => s.id !== sessionId);
      onSessionsChange(updatedSessions);
      
      toast({ title: "성공", description: "세션이 삭제되었습니다." });
    } catch (error: any) {
      console.error(error);
      toast({ title: "오류", description: error.message || "세션 삭제 중 오류가 발생했습니다.", variant: "destructive" });
    }
  };

  const openAddDialog = () => {
    setEditingSession(null);
    setSessionForm({ session_name: "", course_id: "none", instructor_id: "none" });
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg">과목 세션 관리</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              세션 추가
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSession ? "세션 수정" : "세션 추가"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="session-name">세션 이름 *</Label>
                <Input
                  id="session-name"
                  placeholder="예: BS Check List, 파주조, 운영 평가"
                  value={sessionForm.session_name}
                  onChange={(e) => setSessionForm(prev => ({...prev, session_name: e.target.value}))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="course">과목</Label>
                <Select 
                  value={sessionForm.course_id} 
                  onValueChange={(value) => setSessionForm(prev => ({...prev, course_id: value}))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="과목을 선택하세요 (선택사항)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">선택 안함</SelectItem>
                    {courses.map(course => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructor">강사</Label>
                <Select 
                  value={sessionForm.instructor_id} 
                  onValueChange={(value) => setSessionForm(prev => ({...prev, instructor_id: value}))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="강사를 선택하세요 (선택사항)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">선택 안함</SelectItem>
                    {instructors.map(instructor => (
                      <SelectItem key={instructor.id} value={instructor.id}>
                        {instructor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  취소
                </Button>
                <Button onClick={handleSessionSave}>
                  {editingSession ? "수정" : "추가"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="mb-2">아직 추가된 세션이 없습니다</div>
            <div className="text-sm">
              "세션 추가" 버튼을 클릭하여 과목별 세션을 만들어보세요
            </div>
          </div>
        ) : (
          sessions.map(session => (
            <SortableSessionItem
              key={session.id}
              session={session}
              courses={courses}
              instructors={instructors}
              onEdit={handleEditSession}
              onDelete={handleDeleteSession}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
};