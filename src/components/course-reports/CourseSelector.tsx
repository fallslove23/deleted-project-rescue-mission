
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target } from 'lucide-react';

interface CourseSelectorProps {
  selectedYear: number;
  selectedCourse: string;
  selectedRound: number | null;
  selectedInstructor: string;
  availableCourses: {year: number, round: number, course_name: string, key: string}[];
  availableRounds: number[];
  availableInstructors: {id: string, name: string}[];
  years: number[];
  onYearChange: (year: string) => void;
  onCourseChange: (course: string) => void;
  onRoundChange: (round: string) => void;
  onInstructorChange: (instructor: string) => void;
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
  return (
    <Card className="shadow-lg border-0 bg-gradient-to-r from-card to-card/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          과정별 결과 필터
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="text-sm font-medium">교육 연도</label>
          <Select value={selectedYear.toString()} onValueChange={onYearChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year.toString()}>{year}년</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">과정명</label>
          <Select value={selectedCourse} onValueChange={onCourseChange}>
            <SelectTrigger>
              <SelectValue placeholder="과정 선택" />
            </SelectTrigger>
            <SelectContent>
              {availableCourses.map(course => (
                <SelectItem key={course.key} value={course.key}>
                  {course.course_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">교육 차수</label>
          <Select value={selectedRound?.toString() || ''} onValueChange={onRoundChange}>
            <SelectTrigger>
              <SelectValue placeholder="차수 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">전체</SelectItem>
              {availableRounds.map(round => (
                <SelectItem key={round} value={round.toString()}>{round}차</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">담당 강사</label>
          <Select value={selectedInstructor} onValueChange={onInstructorChange}>
            <SelectTrigger>
              <SelectValue placeholder="강사 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">전체</SelectItem>
              {availableInstructors.map(instructor => (
                <SelectItem key={instructor.id} value={instructor.id}>{instructor.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};

export default CourseSelector;
