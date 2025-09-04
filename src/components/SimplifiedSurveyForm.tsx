import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';

interface Course {
  id: string;
  title: string;
}

interface Instructor {
  id: string;
  name: string;
  email: string;
}

interface CourseSelection {
  id: string;
  courseId: string;
  instructorId: string;
}

interface SurveyFormData {
  education_year: number;
  education_round: number;
  education_day: number;
  course_name: string;
  is_combined: boolean;
  combined_round_start: number | null;
  combined_round_end: number | null;
  expected_participants: number;
  start_date: string;
  end_date: string;
  description: string;
  is_test?: boolean;
  course_selections?: CourseSelection[];
  course_id?: string;
  instructor_id?: string;
}

interface SimplifiedSurveyFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  initial?: Partial<SurveyFormData>;
}

export default function SimplifiedSurveyForm({ 
  onSubmit, 
  onCancel, 
  isSubmitting = false,
  initial
}: SimplifiedSurveyFormProps) {
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  
  const [formData, setFormData] = useState({
    education_year: initial?.education_year ?? new Date().getFullYear(),
    course_name: initial?.course_name ?? '',
    education_round: initial?.education_round ?? 1,
    is_combined: initial?.is_combined ?? false,
    combined_round_start: initial?.combined_round_start ?? null,
    combined_round_end: initial?.combined_round_end ?? null,
    education_day: initial?.education_day ?? 1,
    expected_participants: initial?.expected_participants ?? 0,
    start_date: initial?.start_date ?? '',
    end_date: initial?.end_date ?? '',
    description: initial?.description ?? '',
    is_test: initial?.is_test ?? false
  });

  const [courseSelections, setCourseSelections] = useState<CourseSelection[]>(
    initial?.course_selections || [{ 
      id: '1', 
      courseId: initial?.course_id || '', 
      instructorId: initial?.instructor_id || ''
    }]
  );

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    console.log("SimplifiedSurveyForm - initial changed:", initial);
    if (initial) {
      const newFormData = {
        education_year: initial.education_year || new Date().getFullYear(),
        course_name: String(initial.course_name || ''), // 문자열 강제 변환
        education_round: initial.education_round || 1,
        is_combined: Boolean(initial.is_combined), // 불린 강제 변환
        combined_round_start: initial.combined_round_start || null,
        combined_round_end: initial.combined_round_end || null,
        education_day: initial.education_day || 1,
        expected_participants: initial.expected_participants || 0,
        start_date: String(initial.start_date || ''), // datetime-local은 문자열
        end_date: String(initial.end_date || ''),
        description: String(initial.description || ''),
        is_test: Boolean(initial.is_test)
      };
      console.log("SimplifiedSurveyForm - Setting new form data:", newFormData);
      setFormData(newFormData);
      
      // course_selections 설정
      if (initial.course_id || initial.instructor_id) {
        const newCourseSelections = [{
          id: '1',
          courseId: String(initial.course_id || ''),
          instructorId: String(initial.instructor_id || '')
        }];
        console.log("SimplifiedSurveyForm - Setting course selections:", newCourseSelections);
        setCourseSelections(newCourseSelections);
      }
    }
  }, [initial]);

  const fetchData = async () => {
    try {
      const [coursesRes, instructorsRes] = await Promise.all([
        supabase.from('courses').select('id, title').order('title'),
        supabase.from('instructors').select('id, name, email').order('name')
      ]);

      if (coursesRes.data) setCourses(coursesRes.data);
      if (instructorsRes.data) setInstructors(instructorsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const addCourseSelection = () => {
    const newId = Date.now().toString();
    setCourseSelections([...courseSelections, { 
      id: newId, 
      courseId: '', 
      instructorId: '' 
    }]);
  };

  const removeCourseSelection = (id: string) => {
    setCourseSelections(courseSelections.filter(selection => selection.id !== id));
  };

  const updateCourseSelection = (id: string, field: 'courseId' | 'instructorId', value: string) => {
    setCourseSelections(courseSelections.map(selection => 
      selection.id === id ? { ...selection, [field]: value } : selection
    ));
  };

  const handleSubmit = () => {
    const submitData = {
      ...formData,
      course_selections: courseSelections
    };
    onSubmit(submitData);
  };

  const generateTitle = () => {
    const year2 = formData.education_year.toString().slice(-2);
    const firstSelection = courseSelections[0];
    const selectedCourse = courses.find(c => c.id === firstSelection?.courseId);
    
    if (selectedCourse && formData.education_round && formData.education_day) {
      const program = formData.course_name || "";
      const prefix = program
        ? `(${year2}-${formData.education_round}차 ${program} ${formData.education_day}일차)`
        : `(${year2}-${formData.education_round}차 ${formData.education_day}일차)`;
      return `${prefix} ${selectedCourse.title}`;
    }
    return '';
  };

  return (
    <div className="space-y-6">
      {/* 기본 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>교육 연도</Label>
              <Select
                value={String(formData.education_year)}
                onValueChange={(value) => setFormData({...formData, education_year: Number(value)})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="연도 선택" />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027, 2028].map(year => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>과정 (프로그램)</Label>
              <Select
                value={String(formData.course_name)}
                onValueChange={(value) => setFormData({...formData, course_name: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="과정 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">선택 안함</SelectItem>
                  <SelectItem value="BS Basic">BS Basic</SelectItem>
                  <SelectItem value="BS Advanced">BS Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>차수</Label>
              <Input
                type="number"
                value={formData.education_round}
                onChange={(e) => setFormData({...formData, education_round: Number(e.target.value)})}
              />
            </div>
            <div>
              <Label>일차</Label>
              <Input
                type="number"
                value={formData.education_day}
                onChange={(e) => setFormData({...formData, education_day: Number(e.target.value)})}
              />
            </div>
            <div>
              <Label>예상 참여자 수</Label>
              <Input
                type="number"
                value={formData.expected_participants}
                onChange={(e) => setFormData({...formData, expected_participants: Number(e.target.value)})}
              />
            </div>
          </div>

          {/* 합반 설정 - BS Advanced일 때만 */}
          {formData.course_name === "BS Advanced" && (
            <div className="space-y-3 border rounded-md p-3">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.is_combined}
                  onCheckedChange={(checked) => setFormData({...formData, is_combined: checked})}
                />
                <Label>합반 (여러 차수를 묶어 동일 설문으로 운영)</Label>
              </div>

              {formData.is_combined && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>시작 차수</Label>
                    <Input
                      type="number"
                      min={1}
                      value={formData.combined_round_start || ''}
                      onChange={(e) => setFormData({...formData, combined_round_start: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label>종료 차수</Label>
                    <Input
                      type="number"
                      min={formData.combined_round_start || 1}
                      value={formData.combined_round_end || ''}
                      onChange={(e) => setFormData({...formData, combined_round_end: Number(e.target.value)})}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>시작일시</Label>
              <Input
                type="datetime-local"
                value={formData.start_date}
                onChange={(e) => setFormData({...formData, start_date: e.target.value})}
              />
            </div>
            <div>
              <Label>종료일시</Label>
              <Input
                type="datetime-local"
                value={formData.end_date}
                onChange={(e) => setFormData({...formData, end_date: e.target.value})}
              />
            </div>
          </div>

          <div>
            <Label>설명</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.is_test}
              onCheckedChange={(checked) => setFormData({...formData, is_test: checked})}
            />
            <Label>테스트 데이터</Label>
          </div>
        </CardContent>
      </Card>

      {/* 과목/강사 선택 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>과목/강사 선택</CardTitle>
          <Button variant="outline" size="sm" onClick={addCourseSelection}>
            <Plus className="h-4 w-4 mr-1" />
            추가
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {courseSelections.map((selection, index) => (
            <div key={selection.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
              <div>
                <Label>과목</Label>
                <Select
                  value={selection.courseId}
                  onValueChange={(value) => updateCourseSelection(selection.id, 'courseId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="과목 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>강사</Label>
                <Select
                  value={selection.instructorId}
                  onValueChange={(value) => updateCourseSelection(selection.id, 'instructorId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="강사 선택" />
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

              <div className="flex items-end">
                {courseSelections.length > 1 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => removeCourseSelection(selection.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 자동 생성된 제목 */}
      {generateTitle() && (
        <Card>
          <CardHeader>
            <CardTitle>자동 생성된 제목</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm bg-muted p-3 rounded">{generateTitle()}</p>
          </CardContent>
        </Card>
      )}

      {/* 버튼 */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          취소
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "저장 중..." : "설문조사 생성"}
        </Button>
      </div>
    </div>
  );
}