import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
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

interface InstructorCourse {
  id: string;
  instructor_id: string;
  course_id: string;
}

interface CourseSelection {
  id: string;
  courseId: string;
  instructorId: string;
}

interface SurveyCreateFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export default function SurveyCreateForm({ onSubmit, onCancel, isSubmitting = false }: SurveyCreateFormProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [instructorCourses, setInstructorCourses] = useState<InstructorCourse[]>([]);
  
  const [formData, setFormData] = useState({
    education_year: new Date().getFullYear(),
    course_name: '', // BS Basic | BS Advanced
    education_round: 1,
    is_combined: false,
    combined_round_start: null as number | null,
    combined_round_end: null as number | null,
    education_day: 1,
    expected_participants: 0,
    start_date: '',
    end_date: '',
    description: ''
  });

  const [courseSelections, setCourseSelections] = useState<CourseSelection[]>([
    { id: '1', courseId: '', instructorId: '' }
  ]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [coursesRes, instructorsRes, instructorCoursesRes] = await Promise.all([
        supabase.from('courses').select('*').order('title'),
        supabase.from('instructors').select('*').order('name'),
        supabase.from('instructor_courses').select('*')
      ]);

      if (coursesRes.data) setCourses(coursesRes.data);
      if (instructorsRes.data) setInstructors(instructorsRes.data);
      if (instructorCoursesRes.data) setInstructorCourses(instructorCoursesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const addCourseSelection = () => {
    setCourseSelections(prev => [
      ...prev,
      { id: Date.now().toString(), courseId: '', instructorId: '' }
    ]);
  };

  const removeCourseSelection = (id: string) => {
    if (courseSelections.length > 1) {
      setCourseSelections(prev => prev.filter(cs => cs.id !== id));
    }
  };

  const updateCourseSelection = (id: string, field: keyof CourseSelection, value: string) => {
    setCourseSelections(prev => prev.map(cs => 
      cs.id === id ? { ...cs, [field]: value } : cs
    ));
  };

  const getAvailableInstructors = (courseId: string) => {
    if (!courseId) return [];
    const instructorIds = instructorCourses
      .filter(ic => ic.course_id === courseId)
      .map(ic => ic.instructor_id);
    return instructors.filter(instructor => instructorIds.includes(instructor.id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 합반 검증
    if (formData.course_name === 'BS Advanced' && formData.is_combined) {
      if (!formData.combined_round_start || !formData.combined_round_end) {
        alert('합반을 선택한 경우 시작/종료 차수를 입력하세요.');
        return;
      }
      if (formData.combined_round_start > formData.combined_round_end) {
        alert('합반 차수의 시작은 종료보다 클 수 없습니다.');
        return;
      }
    }

    // 과목 선택 검증
    const validCourseSelections = courseSelections.filter(cs => cs.courseId && cs.instructorId);
    if (validCourseSelections.length === 0) {
      alert('최소 1개의 과목과 강사를 선택해야 합니다.');
      return;
    }

    // 자동 차수 입력 (합반일 때)
    const actualRound = formData.is_combined && formData.combined_round_start ? 
      formData.combined_round_start : formData.education_round;

    const submitData = {
      ...formData,
      education_round: actualRound,
      course_selections: validCourseSelections,
      start_date: formData.start_date ? new Date(formData.start_date + '+09:00').toISOString() : null,
      end_date: formData.end_date ? new Date(formData.end_date + '+09:00').toISOString() : null,
    };

    onSubmit(submitData);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. 연도 선택 */}
        <Card>
          <CardHeader>
            <CardTitle>1. 연도 선택</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>교육 연도</Label>
                <Input
                  type="number"
                  value={formData.education_year}
                  onChange={(e) => setFormData(prev => ({ ...prev, education_year: parseInt(e.target.value) }))}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. 과정 선택 */}
        <Card>
          <CardHeader>
            <CardTitle>2. 과정 선택</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label>과정 (프로그램)</Label>
              <Select 
                value={formData.course_name} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, course_name: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="과정 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BS Basic">BS Basic</SelectItem>
                  <SelectItem value="BS Advanced">BS Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 3. 차수 선택 (합반 여부 체크박스 기능, 합반 시작 차수는 선택한 차수로 자동 입력) */}
        <Card>
          <CardHeader>
            <CardTitle>3. 차수 선택</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>차수</Label>
              <Input
                type="number"
                min="1"
                value={formData.education_round}
                onChange={(e) => {
                  const round = parseInt(e.target.value);
                  setFormData(prev => ({ 
                    ...prev, 
                    education_round: round,
                    // 합반 시작 차수는 선택한 차수로 자동 입력
                    combined_round_start: prev.is_combined ? round : prev.combined_round_start
                  }));
                }}
                required
              />
            </div>

            {/* 합반 여부 체크박스 (BS Advanced일 때만) */}
            {formData.course_name === 'BS Advanced' && (
              <div className="space-y-3 border rounded-md p-4">
                <div className="flex items-center gap-2">
                  <input
                    id="is_combined"
                    type="checkbox"
                    className="h-4 w-4"
                    checked={formData.is_combined}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      is_combined: e.target.checked,
                      // 합반 시작 차수는 선택한 차수로 자동 입력
                      combined_round_start: e.target.checked ? prev.education_round : null,
                      combined_round_end: e.target.checked ? prev.combined_round_end : null
                    }))}
                  />
                  <Label htmlFor="is_combined">합반 (여러 차수를 묶어 동일 설문으로 운영)</Label>
                </div>

                {formData.is_combined && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>시작 차수 (자동 입력)</Label>
                      <Input
                        type="number"
                        value={formData.combined_round_start || ''}
                        readOnly
                        className="bg-muted"
                      />
                    </div>
                    <div>
                      <Label>종료 차수</Label>
                      <Input
                        type="number"
                        min={formData.combined_round_start || 1}
                        value={formData.combined_round_end || ''}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          combined_round_end: e.target.value ? parseInt(e.target.value) : null 
                        }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4. 일차 입력 */}
        <Card>
          <CardHeader>
            <CardTitle>4. 일차 입력</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label>일차 (예: 1일차)</Label>
              <Input
                type="number"
                min="1"
                value={formData.education_day}
                onChange={(e) => setFormData(prev => ({ ...prev, education_day: parseInt(e.target.value) }))}
                required
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground mt-1">전체 교육과정 중 몇 번째 날</p>
            </div>
          </CardContent>
        </Card>

        {/* 5. 설문 인원 입력 */}
        <Card>
          <CardHeader>
            <CardTitle>5. 설문 인원 입력</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label>예상 설문 인원</Label>
              <Input
                type="number"
                min="1"
                value={formData.expected_participants || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  expected_participants: e.target.value ? parseInt(e.target.value) : 0 
                }))}
                placeholder="예상 참여자 수"
              />
            </div>
          </CardContent>
        </Card>

        {/* 6. 과목 선택 (여러개 입력, 과목 추가 버튼) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>6. 과목 선택</CardTitle>
              <Button type="button" onClick={addCourseSelection} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                과목 추가
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {courseSelections.map((selection, index) => (
              <div key={selection.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">과목 {index + 1}</h4>
                  {courseSelections.length > 1 && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => removeCourseSelection(selection.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>과목</Label>
                    <Select 
                      value={selection.courseId} 
                      onValueChange={(value) => {
                        updateCourseSelection(selection.id, 'courseId', value);
                        // 과목 변경시 강사 초기화
                        updateCourseSelection(selection.id, 'instructorId', '');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="과목 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {courses.map(course => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 7. 각 과목 강사 선택 */}
                  <div>
                    <Label>강사</Label>
                    <Select 
                      value={selection.instructorId}
                      onValueChange={(value) => updateCourseSelection(selection.id, 'instructorId', value)}
                      disabled={!selection.courseId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={selection.courseId ? "강사 선택" : "먼저 과목을 선택하세요"} />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableInstructors(selection.courseId).map(instructor => (
                          <SelectItem key={instructor.id} value={instructor.id}>
                            {instructor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 8. 시작일시, 종료일시 입력 */}
        <Card>
          <CardHeader>
            <CardTitle>8. 시작일시, 종료일시 입력</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>시작일시</Label>
                <Input
                  type="datetime-local"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label>종료일시</Label>
                <Input
                  type="datetime-local"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 9. 설명 */}
        <Card>
          <CardHeader>
            <CardTitle>9. 설명</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label>설명</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                placeholder="설문조사에 대한 설명을 입력하세요"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '생성 중...' : '설문조사 생성'}
          </Button>
        </div>
      </form>
    </div>
  );
}