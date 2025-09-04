import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CourseReport {
  id: string;
  education_year: number;
  education_round: number;
  course_title: string;
  total_surveys: number;
  total_responses: number;
  avg_instructor_satisfaction: number;
  avg_course_satisfaction: number;
  report_data: any;
  created_at: string;
}

interface InstructorStats {
  instructor_id: string;
  instructor_name: string;
  survey_count: number;
  response_count: number;
  avg_satisfaction: number;
}

interface AvailableCourse {
  year: number;
  round: number;
  course_name: string;
  key: string;
}

export const useCourseReportsData = (
  selectedYear: number, 
  selectedCourse: string, 
  selectedRound: number | null, 
  selectedInstructor: string
) => {
  const [reports, setReports] = useState<CourseReport[]>([]);
  const [instructorStats, setInstructorStats] = useState<InstructorStats[]>([]);
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([]);
  const [availableRounds, setAvailableRounds] = useState<number[]>([]);
  const [availableInstructors, setAvailableInstructors] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAvailableCourses = async () => {
    setLoading(true);
    try {
      console.log('Fetching courses for year:', selectedYear);
      
      const { data: surveys, error } = await supabase
        .from('surveys')
        .select('education_year, education_round, course_name')
        .eq('education_year', selectedYear)
        .in('status', ['completed', 'active']) // active와 completed 둘 다 포함
        .not('course_name', 'is', null);

      if (error) throw error;

      console.log('Fetched surveys:', surveys);

      // 중복 제거 및 과정별 그룹화
      const uniqueCourses = Array.from(
        new Map(
          surveys?.map(s => [s.course_name, s])
        ).values()
      ).map(s => ({
        year: s.education_year,
        round: s.education_round,
        course_name: s.course_name,
        key: s.course_name
      }));

      // 사용 가능한 차수 추출
      const rounds = Array.from(new Set(surveys?.map(s => s.education_round))).sort((a, b) => a - b);
      setAvailableRounds(rounds);

      setAvailableCourses(uniqueCourses);
      console.log('Available courses:', uniqueCourses);

      // 강사 정보도 가져오기
      const { data: instructors, error: instructorError } = await supabase
        .from('instructors')
        .select('id, name')
        .order('name');

      if (!instructorError && instructors) {
        setAvailableInstructors(instructors);
      }
      
    } catch (error) {
      console.error('Error fetching courses:', error);
      toast({
        title: "오류",
        description: "과정 목록을 불러오는 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    if (!selectedCourse && !selectedRound && !selectedInstructor) return;
    
    setLoading(true);
    try {
      console.log('Fetching reports for filters:', selectedYear, selectedCourse, selectedRound, selectedInstructor);
      
      // 설문조사 쿼리 구성
      let query = supabase
        .from('surveys')
        .select(`
          id,
          education_year,
          education_round,
          course_name,
          title,
          course_id,
          instructor_id,
          courses (title),
          instructors (id, name),
          survey_responses (
            id,
            question_answers (
              id,
              answer_value,
              survey_questions (satisfaction_type, question_type)
            )
          )
        `)
        .eq('education_year', selectedYear)
        .in('status', ['completed', 'active']); // active와 completed 둘 다 포함

      // 필터 적용
      if (selectedCourse) {
        query = query.eq('course_name', selectedCourse);
      }
      if (selectedRound) {
        query = query.eq('education_round', selectedRound);
      }
      if (selectedInstructor) {
        query = query.eq('instructor_id', selectedInstructor);
      }

      const { data: surveys, error: surveysError } = await query;

      if (surveysError) throw surveysError;

      console.log('Fetched detailed surveys:', surveys);

      // 데이터 집계
      const instructorStatsMap = new Map();
      let totalSurveys = 0;
      let totalResponses = 0;
      let allInstructorSatisfactions: number[] = [];
      let allCourseSatisfactions: number[] = [];
      let allOperationSatisfactions: number[] = [];

      surveys?.forEach(survey => {
        totalSurveys += 1;
        totalResponses += survey.survey_responses?.length || 0;

        // 강사 정보 처리 개선
        const instructorId = survey.instructor_id;
        const instructorName = survey.instructors?.name || '알 수 없음';
        
        if (instructorId) {
          if (!instructorStatsMap.has(instructorId)) {
            instructorStatsMap.set(instructorId, {
              instructor_id: instructorId,
              instructor_name: instructorName,
              survey_count: 0,
              response_count: 0,
              satisfactions: []
            });
          }
          
          const instructorStat = instructorStatsMap.get(instructorId);
          instructorStat.survey_count += 1;
          instructorStat.response_count += survey.survey_responses?.length || 0;
        }

        // 만족도 점수 계산
        survey.survey_responses?.forEach(response => {
          response.question_answers?.forEach(answer => {
            if (answer.survey_questions?.question_type === 'scale' && answer.answer_value) {
              let score: number;
              
              if (typeof answer.answer_value === 'number') {
                score = answer.answer_value;
              } else if (typeof answer.answer_value === 'string') {
                score = Number(answer.answer_value);
              } else {
                return; // 유효하지 않은 값은 건너뛰기
              }

              // 5점 척도를 10점으로 변환
              if (score <= 5 && score > 0) {
                score = score * 2;
              }
              
              if (answer.survey_questions.satisfaction_type === 'instructor') {
                allInstructorSatisfactions.push(score);
                if (instructorId && instructorStatsMap.has(instructorId)) {
                  instructorStatsMap.get(instructorId).satisfactions.push(score);
                }
              } else if (answer.survey_questions.satisfaction_type === 'course') {
                allCourseSatisfactions.push(score);
              } else if (answer.survey_questions.satisfaction_type === 'operation') {
                allOperationSatisfactions.push(score);
              }
            }
          });
        });
      });

      const finalInstructorStats = Array.from(instructorStatsMap.values()).map(stat => ({
        ...stat,
        avg_satisfaction: stat.satisfactions.length > 0
          ? stat.satisfactions.reduce((a: number, b: number) => a + b, 0) / stat.satisfactions.length
          : 0
      })).filter(stat => stat.survey_count > 0); // 실제 데이터가 있는 강사만 포함

      // 종합 통계 생성
      const courseReport: CourseReport = {
        id: `${selectedYear}-${selectedCourse || 'all'}-${selectedRound || 'all'}-${selectedInstructor || 'all'}`,
        education_year: selectedYear,
        education_round: selectedRound || 0,
        course_title: selectedCourse || '전체 과정',
        total_surveys: totalSurveys,
        total_responses: totalResponses,
        avg_instructor_satisfaction: allInstructorSatisfactions.length > 0 
          ? allInstructorSatisfactions.reduce((a, b) => a + b, 0) / allInstructorSatisfactions.length 
          : 0,
        avg_course_satisfaction: allCourseSatisfactions.length > 0
          ? allCourseSatisfactions.reduce((a, b) => a + b, 0) / allCourseSatisfactions.length
          : 0,
        report_data: {
          operation_satisfaction: allOperationSatisfactions.length > 0
            ? allOperationSatisfactions.reduce((a, b) => a + b, 0) / allOperationSatisfactions.length
            : 0,
          instructor_count: finalInstructorStats.length,
          satisfaction_distribution: {
            instructor: allInstructorSatisfactions,
            course: allCourseSatisfactions,
            operation: allOperationSatisfactions
          }
        },
        created_at: new Date().toISOString()
      };

      console.log('Generated course report:', courseReport);
      console.log('Instructor stats:', finalInstructorStats);

      setReports([courseReport]);
      setInstructorStats(finalInstructorStats);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast({
        title: "오류",
        description: "결과 보고서를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    reports,
    instructorStats,
    availableCourses,
    availableRounds,
    availableInstructors,
    loading,
    fetchAvailableCourses,
    fetchReports
  };
};