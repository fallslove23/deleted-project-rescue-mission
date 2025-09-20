import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  CourseOption,
  CourseReportStatisticsResponse,
  CourseReportsRepository,
} from '@/repositories/courseReportsRepository';
import { useCourseReportStatistics } from '@/hooks/useCourseReportStatistics';

export interface UseCourseReportsDataResult {
  summary: CourseReportStatisticsResponse['summary'] | null;
  previousSummary: CourseReportStatisticsResponse['summary'] | null;
  trend: CourseReportStatisticsResponse['trend'];
  instructorStats: CourseReportStatisticsResponse['instructorStats'];
  previousInstructorStats: CourseReportStatisticsResponse['instructorStats'];
  textualResponses: CourseReportStatisticsResponse['textualResponses'];
  availableCourses: CourseOption[];
  availableRounds: number[];
  availableInstructors: { id: string; name: string }[];
  loading: boolean;
  isInstructor: boolean;
  instructorId: string | null;
  refetch: () => Promise<CourseReportStatisticsResponse | null>;
}

export const useCourseReportsData = (
  selectedYear: number,
  selectedCourse: string,
  selectedRound: number | null,
  selectedInstructor: string,
  includeTestData = false
): UseCourseReportsDataResult => {
  const { toast } = useToast();
  const { user, userRoles } = useAuth();
  const isInstructor = userRoles.includes('instructor');

  const [instructorId, setInstructorId] = useState<string | null>(null);
  const [instructorIdLoaded, setInstructorIdLoaded] = useState(false);
  const { data, loading, fetchStatistics } = useCourseReportStatistics();
  const [previousData, setPreviousData] = useState<CourseReportStatisticsResponse | null>(null);

  // Load instructor id for instructor role
  useEffect(() => {
    let isActive = true;

    const fetchInstructorId = async () => {
      if (!isInstructor) {
        if (isActive) {
          setInstructorId(null);
          setInstructorIdLoaded(true);
        }
        return;
      }

      if (isActive) {
        setInstructorIdLoaded(false);
      }

      if (!user?.email) {
        if (isActive) {
          setInstructorId(null);
          setInstructorIdLoaded(true);
        }
        return;
      }

      const { data: instructor, error } = await supabase
        .from('instructors')
        .select('id')
        .eq('email', user.email)
        .maybeSingle();

      if (!isActive) return;

      if (error) {
        console.error('Failed to fetch instructor id', error);
        toast({
          title: '오류',
          description: '강사 정보를 불러오는 중 오류가 발생했습니다.',
          variant: 'destructive',
        });
        setInstructorId(null);
      } else {
        setInstructorId(instructor?.id ?? null);
      }

      setInstructorIdLoaded(true);
    };

    fetchInstructorId();

    return () => {
      isActive = false;
    };
  }, [isInstructor, user?.email, toast]);

  const instructorFilter = isInstructor ? instructorId : (selectedInstructor || null);

  const refetch = useCallback(async () => {
    if (!selectedYear) return null;
    if (isInstructor && !instructorIdLoaded) return null; // wait until instructor id lookup completes

    try {
      const current = await fetchStatistics({
        year: selectedYear,
        courseName: selectedCourse || null,
        round: selectedRound ?? null,
        instructorId: instructorFilter,
        includeTestData,
      });

      if (current) {
        try {
          const previous = await CourseReportsRepository.fetchStatistics({
            year: selectedYear - 1,
            courseName: current.summary.normalizedCourseName ?? (selectedCourse || null),
            round: selectedRound ?? null,
            instructorId: instructorFilter,
            includeTestData,
          });
          setPreviousData(previous);
        } catch (prevError) {
          console.error('Failed to fetch previous year statistics', prevError);
          setPreviousData(null);
        }
      } else {
        setPreviousData(null);
      }

      return current;
    } catch (error) {
      console.error('Failed to load course report statistics', error);
      toast({
        title: '오류',
        description: '과정 보고서를 불러오는 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
      return null;
    }
  }, [
    fetchStatistics,
    includeTestData,
    instructorFilter,
    instructorId,
    isInstructor,
    instructorIdLoaded,
    selectedCourse,
    selectedRound,
    selectedYear,
    toast,
  ]);

  useEffect(() => {
    if (!selectedYear) return;
    if (isInstructor && !instructorIdLoaded) return;
    refetch();
  }, [
    refetch,
    selectedYear,
    selectedCourse,
    selectedRound,
    instructorFilter,
    includeTestData,
    isInstructor,
    instructorId,
    instructorIdLoaded,
  ]);

  const availableCourses = data?.availableCourses ?? [];

  const availableRounds = useMemo(() => {
    if (!data) return [];
    const normalized = selectedCourse || data.summary.normalizedCourseName || '';
    const matched = availableCourses.find((course) => course.normalizedName === normalized);
    if (matched) {
      return matched.rounds;
    }
    return data.summary.availableRounds ?? [];
  }, [availableCourses, data, selectedCourse]);

  return {
    summary: data?.summary ?? null,
    previousSummary: previousData?.summary ?? null,
    trend: data?.trend ?? [],
    instructorStats: data?.instructorStats ?? [],
    previousInstructorStats: previousData?.instructorStats ?? [],
    textualResponses: data?.textualResponses ?? [],
    availableCourses,
    availableRounds,
    availableInstructors: data?.availableInstructors ?? [],
    loading,
    isInstructor,
    instructorId,
    refetch,
  };
};
