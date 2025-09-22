import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target } from 'lucide-react';
import { CourseOption } from '@/repositories/courseReportsRepository';

interface CourseSelectorProps {
  selectedYear: number;
  selectedCourse: string;
  selectedRound: number | null;
  selectedInstructor: string;
  availableCourses: CourseOption[];
  availableRounds: number[];
  availableInstructors: { id: string; name: string }[];
  years: number[];
  onYearChange: (year: string) => void;
  onCourseChange: (course: string) => void;
  onRoundChange: (round: string) => void;
  onInstructorChange: (instructor: string) => void;
  testDataToggle?: React.ReactNode;
  isInstructor?: boolean;
  currentInstructorName?: string;
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
  onInstructorChange,
  testDataToggle,
  isInstructor = false,
  currentInstructorName,
}) => {
  const roundValue = selectedRound === null ? 'all' : String(selectedRound);
  const instructorValue = selectedInstructor && selectedInstructor.trim() !== '' ? selectedInstructor : 'all';

  return (
    <Card className="shadow-lg border-0 bg-gradient-to-r from-card to-card/50">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <CardTitle>과정별 결과 필터</CardTitle>
        </div>
        {testDataToggle}
      </CardHeader>

      <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

        <div>
          <label className="text-sm font-medium">과정</label>
          <Select value={selectedCourse} onValueChange={onCourseChange}>
            <SelectTrigger>
              <SelectValue placeholder="과정 선택" />
            </SelectTrigger>
            <SelectContent>
              {availableCourses.map((course) => (
                <SelectItem key={course.normalizedName} value={course.normalizedName}>
                  {course.displayName || course.normalizedName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium">교육 차수</label>
          <Select
            value={roundValue}
            onValueChange={(v) => onRoundChange(v === 'all' ? '' : v)}
            disabled={!selectedCourse}
          >
            <SelectTrigger>
              <SelectValue placeholder={selectedCourse ? '차수 선택' : '먼저 과정을 선택하세요'} />
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

        <div>
          <label className="text-sm font-medium">강사</label>
          {isInstructor ? (
            <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2">
              <span className="flex-1 text-sm">{currentInstructorName || '내 강의'}</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                내 데이터만 표시
              </span>
            </div>
          ) : (
            <Select
              value={instructorValue}
              onValueChange={(v) => onInstructorChange(v === 'all' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="강사 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 강사</SelectItem>
                {availableInstructors
                  .filter((instructor) => instructor?.id && instructor.id.trim() !== '')
                  .map((instructor) => (
                    <SelectItem key={instructor.id} value={instructor.id}>
                      {instructor.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CourseSelector;
