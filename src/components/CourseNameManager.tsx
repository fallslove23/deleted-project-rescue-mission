import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2 } from "lucide-react";

interface CourseName {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

interface CourseNameManagerProps {
  selectedCourse: string;
  onCourseSelect: (courseName: string) => void;
}

export default function CourseNameManager({ selectedCourse, onCourseSelect }: CourseNameManagerProps) {
  const { toast } = useToast();
  const [courseNames, setCourseNames] = useState<CourseName[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseName | null>(null);
  
  const [form, setForm] = useState({
    name: "",
    description: ""
  });

  useEffect(() => {
    fetchCourseNames();
  }, []);

  const fetchCourseNames = async () => {
    try {
      const { data, error } = await supabase
        .from('course_names')
        .select('*')
        .order('name');

      if (error) throw error;
      setCourseNames(data || []);
    } catch (error: any) {
      console.error('Error fetching course names:', error);
      toast({
        title: "오류",
        description: "과정명 목록을 불러오는 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.name.trim()) {
      toast({
        title: "오류",
        description: "과정명을 입력해주세요.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      if (editingCourse) {
        // 수정
        const { error } = await supabase
          .from('course_names')
          .update({
            name: form.name.trim(),
            description: form.description.trim() || null
          })
          .eq('id', editingCourse.id);

        if (error) throw error;
        toast({ title: "성공", description: "과정명이 수정되었습니다." });
      } else {
        // 추가
        const { error } = await supabase
          .from('course_names')
          .insert([{
            name: form.name.trim(),
            description: form.description.trim() || null
          }]);

        if (error) throw error;
        toast({ title: "성공", description: "과정명이 추가되었습니다." });
      }

      setForm({ name: "", description: "" });
      setEditingCourse(null);
      setIsDialogOpen(false);
      fetchCourseNames();
    } catch (error: any) {
      console.error('Error saving course name:', error);
      toast({
        title: "오류",
        description: error.message || "과정명 저장 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (course: CourseName) => {
    setEditingCourse(course);
    setForm({
      name: course.name,
      description: course.description || ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 과정명을 삭제하시겠습니까?")) return;

    try {
      const { error } = await supabase
        .from('course_names')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({ title: "성공", description: "과정명이 삭제되었습니다." });
      fetchCourseNames();
    } catch (error: any) {
      console.error('Error deleting course name:', error);
      toast({
        title: "오류",
        description: error.message || "과정명 삭제 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const handleNewCourse = () => {
    setEditingCourse(null);
    setForm({ name: "", description: "" });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>과정 (프로그램)</Label>
        <div className="flex gap-2">
          <Select
            value={selectedCourse}
            onValueChange={onCourseSelect}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="과정을 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              {courseNames.map((course) => (
                <SelectItem key={course.id} value={course.name}>
                  {course.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={handleNewCourse}>
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCourse ? "과정명 수정" : "새 과정명 추가"}
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>과정명</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="예: BS Advanced, 웹개발 기초 등"
                  />
                </div>
                <div>
                  <Label>설명 (선택사항)</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="과정에 대한 간단한 설명"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                  >
                    취소
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "저장 중..." : "저장"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 과정명 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">등록된 과정명</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {courseNames.map((course) => (
              <div key={course.id} className="flex items-center justify-between p-2 border rounded">
                <div>
                  <div className="font-medium text-sm">{course.name}</div>
                  {course.description && (
                    <div className="text-xs text-muted-foreground">{course.description}</div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(course)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(course.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            {courseNames.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                등록된 과정명이 없습니다.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}