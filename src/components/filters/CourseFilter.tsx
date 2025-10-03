import React, { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { fetchCourseOptions, CourseOption } from '@/repositories/filterOptionsRepository';
import { useToast } from '@/hooks/use-toast';

interface CourseFilterProps {
  value: string;
  onChange: (courseId: string, courseTitle?: string) => void;
  year?: number | null;
  label?: string;
  includeAll?: boolean;
  searchTerm?: string;
}

const CourseFilter: React.FC<CourseFilterProps> = ({
  value,
  onChange,
  year,
  label = '과정',
  includeAll = true,
  searchTerm = null,
}) => {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadCourses = async () => {
      setLoading(true);
      try {
        const data = await fetchCourseOptions({ year, search: searchTerm });
        setCourses(data);
      } catch (error) {
        console.error('Failed to load courses:', error);
        toast({
          title: '오류',
          description: '과정 목록을 불러오지 못했습니다. 네트워크 또는 권한 문제일 수 있어요.',
          variant: 'destructive',
        });
        setCourses([]);
      } finally {
        setLoading(false);
      }
    };

    loadCourses();
  }, [year, searchTerm, toast]);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Select 
        value={value || 'all'} 
        onValueChange={(newValue) => {
          const actualValue = newValue === 'all' ? '' : newValue;
          const selectedCourse = courses.find(c => c.course_id === actualValue);
          onChange(actualValue, selectedCourse?.course_title);
        }} 
        disabled={loading}
      >
        <SelectTrigger>
          <SelectValue placeholder={loading ? '로딩 중...' : '과정 선택'}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="z-50 bg-background border shadow-md">
          {includeAll && (
            <SelectItem value="all">전체 과정</SelectItem>
          )}
          {courses.map((course) => (
            <SelectItem key={course.course_id} value={course.course_id}>
              {course.course_title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default CourseFilter;
