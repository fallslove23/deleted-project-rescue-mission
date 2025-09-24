import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter } from 'lucide-react';

export interface CombinedCourseOption {
  key: string; // unique identifier
  displayName: string; // e.g., "2025년 7차 BS Basic"
  year: number;
  course: string;
  round: number | null;
  instructor: string;
}

interface CourseSelectorProps {
  selectedYear: string;
  selectedCourse: string;
  availableYears: string[];
  availableCourses: CombinedCourseOption[];
  onYearChange: (year: string) => void;
  onCourseChange: (courseKey: string) => void;
  testDataToggle?: React.ReactNode;
}

const CourseSelector: React.FC<CourseSelectorProps> = ({
  selectedYear,
  selectedCourse,
  availableYears,
  availableCourses,
  onYearChange,
  onCourseChange,
  testDataToggle,
}) => {
  return (
    <Card className="shadow-lg border-0 bg-gradient-to-r from-card to-card/50">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-primary" />
          <CardTitle>필터</CardTitle>
        </div>
        {testDataToggle}
      </CardHeader>

      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">연도</label>
          <Select value={selectedYear} onValueChange={onYearChange}>
            <SelectTrigger>
              <SelectValue placeholder="연도 선택" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year}>
                  {year === 'all' ? '전체 연도' : `${year}년`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">과정</label>
          <Select value={selectedCourse} onValueChange={onCourseChange}>
            <SelectTrigger>
              <SelectValue placeholder="과정 선택" />
            </SelectTrigger>
            <SelectContent>
              {availableCourses.map((course) => (
                <SelectItem key={course.key} value={course.key}>
                  {course.displayName}
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
