import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target } from 'lucide-react';

interface CourseSelectorProps {
  selectedYear: number;
  selectedCourse: string;
  selectedRound: number | null;                 // null = 전체
  selectedInstructor: string;                   // ''   = 전체
  availableCourses: {year: number, round: number, course_name: string, key: string}[];
  availableRounds: number[];
  availableInstructors: {id: string, name: string}[];
  years: number[];
  onYearChange: (year: string) => void;
  onCourseChange: (course: string) => void;
  onRoundChange: (round: string) => void;       // ''   = 전체  (부모 호환 유지)
  onInstructorChange: (instructor: string) => void; // ''= 전체
}

const CourseSelector: React.FC<CourseSelectorProps> = ({
  selectedYear,
  selectedCourse,
  selectedRound,
  selectedInstructor,
  availableCourses,
  availableRounds,
  availableInstructors,
  years,
  onYearChange,
  onCourseChange,
  onRoundChange,
  onInstructorChange
}) => {
  // 렌더링용 값 보정: 전체일 때는 'all' 토큰 사용 (빈 문자열 금지 규칙 회피)
  const roundValue = selectedRound === null ? 'all' : String(selectedRound);
  const instructorValue = selectedInstructor && selectedInstructor.trim() !== '' ? selectedInstructor : 'all';

  return (
    <Card className="shadow-lg border-0 bg-gradient-to-r from-card to-card/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          과정별 결과 필터
        </CardTitle>
      </CardHeader>

      <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* 교육 연도 */}
        <div>
          <label className="text-sm font-medium">교육 연도</label>
          <Select value={selectedYear.toString()} onValueChange={onYearChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={String(year)} value={year.toString()}>
                  {year}년
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 과정명 */}
        <div>
          <label className="text-sm font-medium">과정명</label>
          <Select value={selectedCourse} onValueChange={onCourseChange}>
            <SelectTrigger>
              <SelectValue placeholder="과정 선택" />
            </SelectTrigger>
            <SelectContent>
              {availableCourses.map((course) => (
                <SelectItem key={course.key} value={course.key}>
                  {course.course_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 교육 차수 */}
        <div>
          <label className="text-sm font-medium">교육 차수</label>
          <Select
            value={roundValue}
            onValueChange={(v) => onRoundChange(v === 'all' ? '' : v)}
            disabled={!selectedCourse}
          >
            <SelectTrigger>
              <SelectValue placeholder={selectedCourse ? "차수 선택" : "먼저 과정을 선택하세요"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {availableRounds.map((round) => (
                <SelectItem key={String(round)} value={round.toString()}>
                  {round}차
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 담당 강사 */}
        <div>
          <label className="text-sm font-medium">담당 강사</label>
          <Select
            value={instructorValue}
            onValueChange={(v) => onInstructorChange(v === 'all' ? '' : v)} // 'all' 선택 시 ''로 역변환
          >
            <SelectTrigger>
              <SelectValue placeholder="강사 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem> {/* 빈 문자열 대신 */}
              {availableInstructors
                .filter((i) => i?.id && String(i.id).trim() !== '')
                .map((instructor) => (
                  <SelectItem key={String(instructor.id)} value={String(instructor.id)}>
                    {instructor.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};

export default CourseSelector;