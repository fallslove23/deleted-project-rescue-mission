// src/hooks/useCourseReportsData.tsx
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useCourseReportsData = (
  selectedYear: number,
  selectedCourse: string,
  selectedRound: number | null,
  selectedInstructor: string
) => {
  const { user, userRoles } = useAuth();
  const isInstructor = userRoles.includes('instructor');
  const [instructorId, setInstructorId] = useState<string | null>(null);
  
  // ... 기존 state들

  // 강사 ID 찾기
  useEffect(() => {
    const fetchInstructorId = async () => {
      if (isInstructor && user?.email) {
        const { data } = await supabase
          .from('instructors')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
        
        if (data) {
          setInstructorId(data.id);
        }
      }
    };
    
    fetchInstructorId();
  }, [isInstructor, user?.email]);

  const fetchReports = async () => {
    try {
      let query = supabase
        .from('surveys')
        .select(`
          *,
          survey_responses(count),
          survey_questions(*),
          question_answers(*)
        `);

      // 강사인 경우 본인 설문만 필터링
      if (isInstructor && instructorId) {
        query = query.eq('instructor_id', instructorId);
      }

      // 기존 필터들 적용
      if (selectedYear) {
        query = query.eq('education_year', selectedYear);
      }
      if (selectedCourse) {
        query = query.ilike('course_name', `%${selectedCourse}%`);
      }
      if (selectedRound) {
        query = query.eq('education_round', selectedRound);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      
      // 데이터 처리...
      setReports(data || []);
      
    } catch (error) {
      console.error('데이터 조회 오류:', error);
    }
  };

  const fetchAvailableCourses = async () => {
    try {
      let query = supabase
        .from('surveys')
        .select('course_name')
        .eq('education_year', selectedYear);

      // 강사인 경우 본인 과정만
      if (isInstructor && instructorId) {
        query = query.eq('instructor_id', instructorId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      const uniqueCourses = [...new Set(data?.map(s => s.course_name).filter(Boolean))]
        .map(name => ({ key: name, value: name }));
      
      setAvailableCourses(uniqueCourses);
      
    } catch (error) {
      console.error('과정 목록 조회 오류:', error);
    }
  };

  // ... 나머지 기존 함수들

  return {
    reports,
    instructorStats,
    availableCourses,
    // ... 기존 반환값들
    isInstructor, // 추가
    instructorId  // 추가
  };
};