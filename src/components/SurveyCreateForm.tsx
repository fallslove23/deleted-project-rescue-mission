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

// 초기값 타입 정의
interface SurveyFormData {
  education_year: number;
  education_round: number;
  education_day: number;
  course_name: string;
  is_combined: boolean;
  combined_round_start: number | null;
  combined_round_end: number | null;
  round_label: string | null;
  expected_participants: number;
  start_date: string;
  end_date: string;
  description: string;
  is_test?: boolean;
  course_selections?: CourseSelection[];
  course_id?: string;
  instructor_id?: string;
}

interface SurveyCreateFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  initialValues?: Partial<SurveyFormData>;
}

export default function SurveyCreateForm({ 
  onSubmit, 
  onCancel, 
  isSubmitting = false,
  initialValues
}: SurveyCreateFormProps) {
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [instructorCourses, setInstructorCourses] = useState<InstructorCourse[]>([]);
  
  // 안전한 datetime-local 변환 함수
  const toLocalDateTime = (isoString?: string | null): string => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      // 로컬 시간대로 YYYY-MM-DDTHH:mm 형식 반환
      const pad = (n: number) => String(n).padStart(2, '0');
      const year = date.getFullYear();
      const month = pad(date.getMonth() + 1);
      const day = pad(date.getDate());
      const hours = pad(date.getHours());
      const minutes = pad(date.getMinutes());
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  const [formData, setFormData] = useState({
    education_year: initialValues?.education_year ?? new Date().getFullYear(),
    course_name: initialValues?.course_name ?? '',
    education_round: initialValues?.education_round ?? 1,
    is_combined: initialValues?.is_combined ?? false,
    combined_round_start: initialValues?.combined_round_start ?? null,
    combined_round_end: initialValues?.combined_round_end ?? null,
    round_label: initialValues?.round_label ?? null,
    education_day: initialValues?.education_day ?? 1,
    expected_participants: initialValues?.expected_participants ?? 0,
    start_date: toLocalDateTime(initialValues?.start_date),
    end_date: toLocalDateTime(initialValues?.end_date),
    description: initialValues?.description ?? '',
    is_test: initialValues?.is_test ?? false
  });

  // 과목+강사 선택 (세션명 제거)
  const [courseSelections, setCourseSelections] = useState<CourseSelection[]>(
    initialValues?.course_selections || [{ 
      id: '1', 
      courseId: initialValues?.course_id || '', 
      instructorId: initialValues?.instructor_id || ''
    }]
  );

  useEffect(() => {
    fetchData();
  }, []);

  // initialValues 값이 변경되면 formData 업데이트
  useEffect(() => {
    if (initialValues) {
      setFormData({
        education_year: initialValues.education_year ?? new Date().getFullYear(),
        course_name: initialValues.course_name ?? '',
        education_round: initialValues.education_round ?? 1,
        is_combined: initialValues.is_combined ?? false,
        combined_round_start: initialValues.combined_round_start ?? null,
        combined_round_end: initialValues.combined_round_end ?? null,
        round_label: initialValues.round_label ?? null,
        education_day: initialValues.education_day ?? 1,
        expected_participants: initialValues.expected_participants ?? 0,
        start_date: toLocalDateTime(initialValues.start_date),
        end_date: toLocalDateTime(initialValues.end_date),
        description: initialValues.description ?? '',
        is_test: initialValues.is_test ?? false
      });
      
      if (initialValues.course_selections) {
        setCourseSelections(initialValues.course_selections);
      } else if (initialValues.course_id || initialValues.instructor_id) {
        setCourseSelections([{
          id: '1',
          courseId: initialValues.course_id || '',
          instructorId: initialValues.instructor_id || ''
        }]);
      }
    }
  }, [initialValues]);

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
      { 
        id: Date.now().toString(), 
        courseId: '', 
        instructorId: ''
      }
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

  // 안전한 ISO 변환 함수
  const toSafeISOString = (dateTimeLocal: string): string | null => {
    if (!dateTimeLocal) return null;
    try {
      // YYYY-MM-DDTHH:mm 형식을 KST로 해석하여 UTC ISO로 변환
      const date = new Date(dateTimeLocal + ':00+09:00');
      if (isNaN(date.getTime())) return null;
      return date.toISOString();
    } catch {
      return null;
    }
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

    // 과목+강사 선택 검증
    const validCourseSelections = courseSelections.filter(cs => cs.courseId && cs.instructorId);
    if (validCourseSelections.length === 0) {
      alert('최소 1개의 과목과 강사를 선택해야 합니다.');
      return;
    }

    // 자동 라벨 생성 (합반일 때)
    let autoRoundLabel = formData.round_label;
    if (formData.course_name === 'BS Advanced' && formData.is_combined && !autoRoundLabel?.trim()) {
      autoRoundLabel = `${formData.education_year}년 ${formData.combined_round_start}∼${formData.combined_round_end}차 - BS Advanced`;
    }

    const submitData = {
      ...formData,
      round_label: autoRoundLabel,
      course_selections: validCourseSelections,
      start_date: toSafeISOString(formData.start_date),
      end_date: toSafeISOString(formData.end_date),
    };

    onSubmit(submitData);
  };

  return (
    <div className="max-w-4xl mx-auto p-2">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* 기본 정보 */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <Label className="text-sm font-medium">교육 연도</Label>
                <Input
                  type="number"
                  value={formData.education_year}
                  onChange={(e) => setFormData(prev => ({ ...prev, education_year: parseInt(e.target.value) }))}
                  required
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label className="text-sm font-medium">과정</Label>
                <div className="flex gap-1 mt-1">
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
                  <Button type="button" size="sm" variant="outline" className="px-2">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">차수</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.education_round}
                  onChange={(e) => {
                    const round = parseInt(e.target.value);
                    setFormData(prev => ({ 
                      ...prev, 
                      education_round: round,
                      combined_round_start: prev.is_combined ? round : prev.combined_round_start
                    }));
                  }}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">일차</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.education_day}
                  onChange={(e) => setFormData(prev => ({ ...prev, education_day: parseInt(e.target.value) }))}
                  required
                  placeholder="1"
                  className="mt-1"
                />
              </div>
            </div>

            {/* 합반 설정 (BS Advanced일 때만) */}
            {formData.course_name === 'BS Advanced' && (
              <div className="mt-4 p-3 border rounded-md bg-muted/20">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    id="is_combined"
                    type="checkbox"
                    className="h-4 w-4"
                    checked={formData.is_combined}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      is_combined: e.target.checked,
                      combined_round_start: e.target.checked ? prev.education_round : null,
                      combined_round_end: e.target.checked ? prev.combined_round_end : null
                    }))}
                  />
                  <Label htmlFor="is_combined" className="text-sm">합반 설정</Label>
                </div>

                {formData.is_combined && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">시작 차수</Label>
                      <Input
                        type="number"
                        value={formData.combined_round_start || ''}
                        readOnly
                        className="bg-muted mt-1"
                        size={1}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">종료 차수</Label>
                      <Input
                        type="number"
                        min={formData.combined_round_start || 1}
                        value={formData.combined_round_end || ''}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          combined_round_end: e.target.value ? parseInt(e.target.value) : null 
                        }))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4">
              <Label className="text-sm font-medium">예상 참여 인원</Label>
              <Input
                type="number"
                min="1"
                value={formData.expected_participants || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  expected_participants: e.target.value ? parseInt(e.target.value) : 0 
                }))}
                placeholder="예상 참여자 수"
                className="mt-1 max-w-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* 과목+강사 선택 (세션명 제거) */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">과목 및 강사 선택</Label>
              <Button type="button" onClick={addCourseSelection} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                과목 추가
              </Button>
            </div>
            <div className="space-y-3">
              {courseSelections.map((selection, index) => (
                <div key={selection.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">과목 {index + 1}</span>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">과목</Label>
                      <Select 
                        value={selection.courseId} 
                        onValueChange={(value) => {
                          updateCourseSelection(selection.id, 'courseId', value);
                          updateCourseSelection(selection.id, 'instructorId', '');
                        }}
                      >
                        <SelectTrigger className="mt-1">
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

                    <div>
                      <Label className="text-xs">강사</Label>
                      <Select 
                        value={selection.instructorId}
                        onValueChange={(value) => updateCourseSelection(selection.id, 'instructorId', value)}
                        disabled={!selection.courseId}
                      >
                        <SelectTrigger className="mt-1">
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
            </div>
          </CardContent>
        </Card>

        {/* 일정 및 설명 */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">설문 일정</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">시작일시</Label>
                  <Input
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">종료일시</Label>
                  <Input
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    required
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">설명 (선택사항)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="설문조사에 대한 추가 설명을 입력하세요"
                rows={2}
                className="mt-1"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center space-x-3">
                <Switch
                  id="is_test"
                  checked={formData.is_test}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_test: checked }))}
                />
                <div>
                  <Label htmlFor="is_test" className="text-sm font-medium cursor-pointer">
                    테스트 데이터
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    체크 시 운영 통계에서 제외됩니다
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 버튼 */}
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '저장 중...' : (initialValues ? '설문 정보 수정' : '설문조사 생성')}
          </Button>
        </div>
      </form>
    </div>
  );
}