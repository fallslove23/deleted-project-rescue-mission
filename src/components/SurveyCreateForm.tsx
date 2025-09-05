import React, { useState, useEffect } from 'react';
import { useForm, useController, useFieldArray } from 'react-hook-form';
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
  courseId: string;
  instructorId: string;
}

// React Hook Form 타입 정의
type FormValues = {
  education_year: number;
  education_round: number;
  education_day: number;
  course_name: string;
  expected_participants: number | null;
  start_date: string;
  end_date: string;
  description: string;
  is_combined: boolean;
  combined_round_start: number | null;
  combined_round_end: number | null;
  round_label: string;
  is_test: boolean;
  course_selections: CourseSelection[];
};

interface SurveyCreateFormProps {
  onSubmit: (data: FormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  initialValues?: Partial<FormValues>;
}

// 기본값 정의
const DEFAULTS: FormValues = {
  education_year: new Date().getFullYear(),
  education_round: 1,
  education_day: 1,
  course_name: "",
  expected_participants: null,
  start_date: "",
  end_date: "",
  description: "",
  is_combined: false,
  combined_round_start: null,
  combined_round_end: null,
  round_label: "",
  is_test: false,
  course_selections: [],
};

export default function SurveyCreateForm({ 
  onSubmit, 
  onCancel, 
  isSubmitting = false,
  initialValues
}: SurveyCreateFormProps) {
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [instructorCourses, setInstructorCourses] = useState<InstructorCourse[]>([]);

  // React Hook Form 설정
  const { control, handleSubmit: hookFormSubmit, reset, watch } = useForm<FormValues>({
    defaultValues: DEFAULTS,
  });

  // 필드 배열 관리
  const { fields, append, remove } = useFieldArray({
    control,
    name: "course_selections"
  });

  // 폼 값 감시
  const watchedValues = watch();
  const { course_name, is_combined, education_round } = watchedValues;

  // 제어 컴포넌트들
  const courseNameCtrl = useController({ name: "course_name", control });
  const educationYearCtrl = useController({ name: "education_year", control });
  const educationRoundCtrl = useController({ name: "education_round", control });
  const educationDayCtrl = useController({ name: "education_day", control });
  const expectedParticipantsCtrl = useController({ name: "expected_participants", control });
  const startDateCtrl = useController({ name: "start_date", control });
  const endDateCtrl = useController({ name: "end_date", control });
  const descriptionCtrl = useController({ name: "description", control });
  const isCombinedCtrl = useController({ name: "is_combined", control });
  const combinedRoundStartCtrl = useController({ name: "combined_round_start", control });
  const combinedRoundEndCtrl = useController({ name: "combined_round_end", control });
  const isTestCtrl = useController({ name: "is_test", control });

  useEffect(() => {
    fetchData();
  }, []);

  // initialValues가 변경되면 폼을 리셋 (핵심: reset 사용)
  useEffect(() => {
    if (initialValues && Object.keys(initialValues).length > 0) {
      console.log('SurveyCreateForm - Applying initialValues via reset:', initialValues);
      reset({ ...DEFAULTS, ...initialValues });
    }
  }, [initialValues, reset]);

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
    append({ courseId: '', instructorId: '' });
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
      const date = new Date(dateTimeLocal + ':00+09:00');
      if (isNaN(date.getTime())) return null;
      return date.toISOString();
    } catch {
      return null;
    }
  };

  const handleFormSubmit = (data: FormValues) => {
    // 합반 검증
    if (data.course_name === 'BS Advanced' && data.is_combined) {
      if (!data.combined_round_start || !data.combined_round_end) {
        alert('합반을 선택한 경우 시작/종료 차수를 입력하세요.');
        return;
      }
      if (data.combined_round_start > data.combined_round_end) {
        alert('합반 차수의 시작은 종료보다 클 수 없습니다.');
        return;
      }
    }

    // 과목+강사 선택 검증
    const validCourseSelections = data.course_selections.filter(cs => cs.courseId && cs.instructorId);
    if (validCourseSelections.length === 0) {
      alert('최소 1개의 과목과 강사를 선택해야 합니다.');
      return;
    }

    // 자동 라벨 생성 (합반일 때)
    let autoRoundLabel = data.round_label;
    if (data.course_name === 'BS Advanced' && data.is_combined && !autoRoundLabel?.trim()) {
      autoRoundLabel = `${data.education_year}년 ${data.combined_round_start}∼${data.combined_round_end}차 - BS Advanced`;
    }

    const submitData = {
      ...data,
      round_label: autoRoundLabel,
      course_selections: validCourseSelections,
      start_date: toSafeISOString(data.start_date),
      end_date: toSafeISOString(data.end_date),
    };

    onSubmit(submitData);
  };

  return (
    <div className="max-w-4xl mx-auto p-2">
      <form onSubmit={hookFormSubmit(handleFormSubmit)} className="space-y-3">
        {/* 기본 정보 */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <Label className="text-sm font-medium">교육 연도</Label>
                <Input
                  type="number"
                  value={educationYearCtrl.field.value || ''}
                  onChange={(e) => educationYearCtrl.field.onChange(parseInt(e.target.value) || new Date().getFullYear())}
                  required
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label className="text-sm font-medium">과정</Label>
                <div className="flex gap-1 mt-1">
                  <Select 
                    value={courseNameCtrl.field.value || ""} 
                    onValueChange={courseNameCtrl.field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="과정 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BS Basic">BS Basic</SelectItem>
                      <SelectItem value="BS Advanced">BS Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="outline" 
                    className="px-2"
                    onClick={() => {
                      const newCourse = prompt('새 과정명을 입력하세요:');
                      if (newCourse && newCourse.trim()) {
                        // 기존 옵션에 추가 (실제로는 DB에 저장되어야 함)
                        courseNameCtrl.field.onChange(newCourse.trim());
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">차수</Label>
                <Input
                  type="number"
                  min="1"
                  value={educationRoundCtrl.field.value || ''}
                  onChange={(e) => {
                    const round = parseInt(e.target.value) || 1;
                    educationRoundCtrl.field.onChange(round);
                    // 합반일 때 시작 차수도 업데이트
                    if (is_combined) {
                      combinedRoundStartCtrl.field.onChange(round);
                    }
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
                  value={educationDayCtrl.field.value || ''}
                  onChange={(e) => educationDayCtrl.field.onChange(parseInt(e.target.value) || 1)}
                  required
                  placeholder="1"
                  className="mt-1"
                />
              </div>
            </div>

            {/* 합반 설정 (BS Advanced일 때만) */}
            {course_name === 'BS Advanced' && (
              <div className="mt-4 p-3 border rounded-md bg-muted/20">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    id="is_combined"
                    type="checkbox"
                    className="h-4 w-4"
                    checked={isCombinedCtrl.field.value || false}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      isCombinedCtrl.field.onChange(checked);
                      if (checked) {
                        combinedRoundStartCtrl.field.onChange(education_round);
                      } else {
                        combinedRoundStartCtrl.field.onChange(null);
                        combinedRoundEndCtrl.field.onChange(null);
                      }
                    }}
                  />
                  <Label htmlFor="is_combined" className="text-sm">합반 설정</Label>
                </div>

                {is_combined && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">시작 차수</Label>
                      <Input
                        type="number"
                        value={combinedRoundStartCtrl.field.value || ''}
                        readOnly
                        className="bg-muted mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">종료 차수</Label>
                      <Input
                        type="number"
                        min={combinedRoundStartCtrl.field.value || 1}
                        value={combinedRoundEndCtrl.field.value || ''}
                        onChange={(e) => combinedRoundEndCtrl.field.onChange(parseInt(e.target.value) || null)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>
             )}

             {/* 제목 미리보기 */}
             {watchedValues.education_year && watchedValues.course_name && watchedValues.education_round && watchedValues.education_day && (
               <div className="mt-4 p-3 border rounded-md bg-primary/5">
                 <Label className="text-sm font-medium text-primary">설문 제목 미리보기</Label>
                 <p className="text-sm mt-1 font-medium">
                   {`${watchedValues.education_year}-${watchedValues.course_name}-${watchedValues.education_round}차-${watchedValues.education_day}일차 설문`}
                 </p>
               </div>
             )}

             <div className="mt-4">
              <Label className="text-sm font-medium">예상 참여 인원</Label>
              <Input
                type="number"
                min="1"
                value={expectedParticipantsCtrl.field.value || ''}
                onChange={(e) => expectedParticipantsCtrl.field.onChange(parseInt(e.target.value) || null)}
                placeholder="예상 참여자 수"
                className="mt-1 max-w-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* 과목+강사 선택 */}
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
              {fields.map((field, index) => (
                <div key={field.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">과목 {index + 1}</span>
                    {fields.length > 1 && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">과목</Label>
                      <CourseSelectionField
                        control={control}
                        name={`course_selections.${index}.courseId`}
                        courses={courses}
                        onCourseChange={() => {
                          // 과목 변경 시 강사 초기화
                          const currentValues = watchedValues.course_selections || [];
                          const newSelections = [...currentValues];
                          if (newSelections[index]) {
                            newSelections[index].instructorId = '';
                          }
                        }}
                      />
                    </div>

                    <div>
                      <Label className="text-xs">강사</Label>
                      <InstructorSelectionField
                        control={control}
                        name={`course_selections.${index}.instructorId`}
                        courseId={watchedValues.course_selections?.[index]?.courseId || ''}
                        instructors={getAvailableInstructors(watchedValues.course_selections?.[index]?.courseId || '')}
                      />
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
                    value={startDateCtrl.field.value || ''}
                    onChange={startDateCtrl.field.onChange}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">종료일시</Label>
                  <Input
                    type="datetime-local"
                    value={endDateCtrl.field.value || ''}
                    onChange={endDateCtrl.field.onChange}
                    required
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">설명 (선택사항)</Label>
              <Textarea
                value={descriptionCtrl.field.value || ''}
                onChange={descriptionCtrl.field.onChange}
                placeholder="설문조사에 대한 추가 설명을 입력하세요"
                rows={2}
                className="mt-1"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center space-x-3">
                <Switch
                  id="is_test"
                  checked={isTestCtrl.field.value || false}
                  onCheckedChange={isTestCtrl.field.onChange}
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

// 과목 선택 컴포넌트
function CourseSelectionField({ control, name, courses, onCourseChange }: {
  control: any;
  name: string;
  courses: Course[];
  onCourseChange?: () => void;
}) {
  const { field } = useController({ name, control });

  return (
    <Select 
      value={field.value || ""} 
      onValueChange={(value) => {
        field.onChange(value);
        onCourseChange?.();
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
  );
}

// 강사 선택 컴포넌트
function InstructorSelectionField({ control, name, courseId, instructors }: {
  control: any;
  name: string;
  courseId: string;
  instructors: Instructor[];
}) {
  const { field } = useController({ name, control });

  return (
    <Select 
      value={field.value || ""}
      onValueChange={field.onChange}
      disabled={!courseId}
    >
      <SelectTrigger className="mt-1">
        <SelectValue placeholder={courseId ? "강사 선택" : "먼저 과목을 선택하세요"} />
      </SelectTrigger>
      <SelectContent>
        {instructors.map(instructor => (
          <SelectItem key={instructor.id} value={instructor.id}>
            {instructor.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}