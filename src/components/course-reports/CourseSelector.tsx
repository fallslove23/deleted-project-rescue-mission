
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target } from 'lucide-react';

interface CourseSelectorProps {
  selectedYear: number;
  selectedCourse: string;
  availableCourses: {year: number, round: number, course_name: string, key: string}[];
  years: number[];
  onYearChange: (year: string) => void;
  onCourseChange: (course: string) => void;
}

const CourseSelector: React.FC<CourseSelectorProps> = ({
  selectedYear,
  selectedCourse,
  availableCourses,
  years,
  onYearChange,
  onCourseChange
}) => {
  return (
    <Card className="shadow-lg border-0 bg-gradient-to-r from-card to-card/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          과정 선택
        </CardTitle>
      </CardHeader>
      <CardContent className="flex gap-4">
        <div>
          <label className="text-sm font-medium">교육 연도</label>
          <Select value={selectedYear.toString()} onValueChange={onYearChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year.toString()}>{year}년</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium">과정</label>
          <Select value={selectedCourse} onValueChange={onCourseChange}>
            <SelectTrigger>
              <SelectValue placeholder="분석할 과정을 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              {availableCourses.map(course => (
                <SelectItem key={course.key} value={course.key}>
                  {course.year}년 {course.round}차 - {course.course_name}
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
