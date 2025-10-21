import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  SessionOption,  // Changed from CourseOption
  CourseReportStatisticsResponse,
} from '@/repositories/courseReportsRepositoryFixed';
import { CourseReportsRepositoryFixed } from '@/repositories/courseReportsRepositoryFixed';
import { useCourseReportStatistics } from '@/hooks/useCourseReportStatistics';

export interface UseCourseReportsDataResult {
  summary: CourseReportStatisticsResponse['summary'] | null;
  previousSummary: CourseReportStatisticsResponse['summary'] | null;
  trend: CourseReportStatisticsResponse['trend'];
  instructorStats: CourseReportStatisticsResponse['instructorStats'];
  previousInstructorStats: CourseReportStatisticsResponse['instructorStats'];
  textualResponses: CourseReportStatisticsResponse['textualResponses'];
  availableSessions: SessionOption[];  // Changed from availableCourses
  availableRounds: number[];
  availableInstructors: { id: string; name: string }[];
  loading: boolean;
  isInstructor: boolean;
  instructorId: string | null;
  instructorName: string | null;
  refetch: () => Promise<CourseReportStatisticsResponse | null>;
}

export const useCourseReportsData = (
  selectedYear: number,
  selectedSessionId: string,  // Changed from selectedCourse
  selectedRound: number | null,
  selectedInstructor: string,
  includeTestData = false
): UseCourseReportsDataResult => {
  const { toast } = useToast();
  const { user, userRoles } = useAuth();
  const isPrivileged = userRoles.includes('admin') || userRoles.includes('operator') || userRoles.includes('director');
  const isInstructor = userRoles.includes('instructor') && !isPrivileged;

  const [instructorId, setInstructorId] = useState<string | null>(null);
  const [instructorName, setInstructorName] = useState<string | null>(null);
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
        .select('id, name')
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
        setInstructorName(instructor?.name ?? null);
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
      // selectedSessionId now contains session_id (UUID)
      const sessionIdParam = selectedSessionId || null;

      const current = await fetchStatistics({
        year: selectedYear,
        sessionId: sessionIdParam,  // Changed from courseName
        round: selectedRound ?? null,
        instructorId: instructorFilter,
        includeTestData,
      });

      if (current) {
        try {
          const previous = await CourseReportsRepositoryFixed.fetchStatistics({
            year: selectedYear - 1,
            sessionId: current.summary.sessionId ?? sessionIdParam,  // Changed
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
    isInstructor,
    instructorIdLoaded,
    selectedSessionId,  // Changed from selectedCourse
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
    selectedSessionId,  // Changed from selectedCourse
    selectedRound,
    instructorFilter,
    includeTestData,
    isInstructor,
    instructorId,
    instructorIdLoaded,
  ]);

  const availableSessions = data?.availableSessions ?? [];  // Changed from availableCourses

  const availableRounds = useMemo(() => {
    if (!data) return [];
    // For sessions, we can derive rounds from availableRounds in summary
    return data.summary.availableRounds ?? [];
  }, [data]);

  return {
    summary: data?.summary ?? null,
    previousSummary: previousData?.summary ?? null,
    trend: data?.trend ?? [],
    instructorStats: data?.instructorStats ?? [],
    previousInstructorStats: previousData?.instructorStats ?? [],
    textualResponses: data?.textualResponses ?? [],
    availableSessions,  // Changed from availableCourses
    availableRounds,
    availableInstructors: data?.availableInstructors ?? [],
    loading,
    isInstructor,
    instructorId,
    instructorName: instructorName,
    refetch,
  };
};
