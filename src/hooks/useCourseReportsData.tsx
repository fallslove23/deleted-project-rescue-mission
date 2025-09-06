import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface CourseStatistics {
  id: string;
  year: number;
  round: number;
  course_days: number;
  course_start_date: string;
  course_end_date: string;
  status: string;
  enrolled_count: number;
  cumulative_count: number;
  total_satisfaction: number | null;
  course_satisfaction: number | null;
  instructor_satisfaction: number | null;
  operation_satisfaction: number | null;
  education_hours: number | null;
  education_days: number | null;
  course_name: string | null;
}

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
  const { user, userRoles } = useAuth();
  const isInstructor = userRoles.includes('instructor');
  const [instructorId, setInstructorId] = useState<string | null>(null);
  
  const [reports, setReports] = useState<CourseReport[]>([]);
  const [previousReports, setPreviousReports] = useState<CourseReport[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [instructorStats, setInstructorStats] = useState<InstructorStats[]>([]);
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([]);
  const [availableRounds, setAvailableRounds] = useState<number[]>([]);
  const [availableInstructors, setAvailableInstructors] = useState<{id: string, name: string}[]>([]);
  const [textualResponses, setTextualResponses] = useState<string[]>([]);
  const [courseStatistics, setCourseStatistics] = useState<CourseStatistics[]>([]);
  const [yearlyComparison, setYearlyComparison] = useState<{
    current: CourseStatistics[];
    previous: CourseStatistics[];
  }>({ current: [], previous: [] });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // 강사 ID 찾기
  useEffect(() => {
    const fetchInstructorId = async () => {
      if (isInstructor && user?.email) {
        try {
          const { data } = await supabase
            .from('instructors')
            .select('id')
            .eq('email', user.email)
            .maybeSingle();
          
          if (data) {
            setInstructorId(data.id);
          }
        } catch (error) {
          console.error('강사 ID 조회 오류:', error);
        }
      }
    };
    
    fetchInstructorId();
  }, [isInstructor, user?.email]);

  const fetchAvailableCourses = async () => {
    setLoading(true);
    try {
      console.log('Fetching courses for year:', selectedYear);
      
      let query = supabase
        .from('surveys')
        .select('education_year, education_round, course_name')
        .eq('education_year', selectedYear)
        .in('status', ['completed', 'active'])
        .not('course_name', 'is', null);

      // 강사인 경우 본인 설문만 필터링
      if (isInstructor && instructorId) {
        query = query.eq('instructor_id', instructorId);
      }

      const { data: surveys, error } = await query;

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

      // 강사 정보 - 관리자만 가져오기
      if (!isInstructor) {
        const { data: instructors, error: instructorError } = await supabase
          .from('instructors')
          .select('id, name')
          .order('name');

        if (!instructorError && instructors) {
          setAvailableInstructors(instructors);
        }
      } else {
        setAvailableInstructors([]); // 강사는 강사 필터 숨김
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
        .in('status', ['completed', 'active']);

      // 강사인 경우 본인 설문만 필터링
      if (isInstructor && instructorId) {
        query = query.eq('instructor_id', instructorId);
      }

      // 필터 적용
      if (selectedCourse) {
        query = query.eq('course_name', selectedCourse);
      }
      if (selectedRound) {
        query = query.eq('education_round', selectedRound);
      }
      if (selectedInstructor && !isInstructor) { // 관리자만 강사 필터 적용
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
        course_title: selectedCourse || (isInstructor ? '내 담당 과정' : '전체 과정'),
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

      // 이전 차수 데이터 가져오기
      await fetchPreviousReports(selectedYear, selectedCourse, selectedRound);
      
      // 트렌드 데이터 가져오기 (최근 5개 차수)
      await fetchTrendData(selectedYear, selectedCourse);

      // 서술형 응답 가져오기
      await fetchTextualResponses(surveys);

      // 전년도 대비 통계 가져오기
      await fetchYearlyComparison(selectedYear, selectedYear - 1);

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

  const fetchPreviousReports = async (year: number, course: string, round: number | null) => {
    try {
      const previousRound = round ? round - 1 : null;
      if (!previousRound || previousRound < 1) return;

      let query = supabase
        .from('surveys')
        .select(`
          id,
          education_year,
          education_round,
          course_name,
          survey_responses (
            id,
            question_answers (
              id,
              answer_value,
              survey_questions (satisfaction_type, question_type)
            )
          )
        `)
        .eq('education_year', year)
        .eq('education_round', previousRound)
        .in('status', ['completed', 'active']);

      // 강사 필터링 적용
      if (isInstructor && instructorId) {
        query = query.eq('instructor_id', instructorId);
      }

      if (course) {
        query = query.eq('course_name', course);
      }

      const { data: prevSurveys } = await query;
      
      if (prevSurveys) {
        // 이전 차수 통계 계산 (현재 로직과 동일)
        let prevInstructorSatisfactions: number[] = [];
        let prevCourseSatisfactions: number[] = [];
        let prevOperationSatisfactions: number[] = [];
        let prevTotalResponses = 0;

        prevSurveys.forEach(survey => {
          prevTotalResponses += survey.survey_responses?.length || 0;
          
          survey.survey_responses?.forEach(response => {
            response.question_answers?.forEach(answer => {
              if (answer.survey_questions?.question_type === 'scale' && answer.answer_value) {
                let score = typeof answer.answer_value === 'number' ? answer.answer_value : Number(answer.answer_value);
                if (score <= 5 && score > 0) score = score * 2;
                
                if (answer.survey_questions.satisfaction_type === 'instructor') {
                  prevInstructorSatisfactions.push(score);
                } else if (answer.survey_questions.satisfaction_type === 'course') {
                  prevCourseSatisfactions.push(score);
                } else if (answer.survey_questions.satisfaction_type === 'operation') {
                  prevOperationSatisfactions.push(score);
                }
              }
            });
          });
        });

        const prevReport: CourseReport = {
          id: `prev-${year}-${course || 'all'}-${previousRound}`,
          education_year: year,
          education_round: previousRound,
          course_title: course || (isInstructor ? '내 담당 과정' : '전체 과정'),
          total_surveys: prevSurveys.length,
          total_responses: prevTotalResponses,
          avg_instructor_satisfaction: prevInstructorSatisfactions.length > 0 
            ? prevInstructorSatisfactions.reduce((a, b) => a + b, 0) / prevInstructorSatisfactions.length 
            : 0,
          avg_course_satisfaction: prevCourseSatisfactions.length > 0
            ? prevCourseSatisfactions.reduce((a, b) => a + b, 0) / prevCourseSatisfactions.length
            : 0,
          report_data: {
            operation_satisfaction: prevOperationSatisfactions.length > 0
              ? prevOperationSatisfactions.reduce((a, b) => a + b, 0) / prevOperationSatisfactions.length
              : 0
          },
          created_at: new Date().toISOString()
        };

        setPreviousReports([prevReport]);
      }
    } catch (error) {
      console.error('Error fetching previous reports:', error);
    }
  };

  const fetchTrendData = async (year: number, course: string) => {
    try {
      // 최근 5개 차수의 데이터 가져오기
      let query = supabase
        .from('surveys')
        .select(`
          education_year,
          education_round,
          course_name,
          survey_responses (
            id,
            question_answers (
              answer_value,
              survey_questions (satisfaction_type, question_type)
            )
          )
        `)
        .eq('education_year', year)
        .in('status', ['completed', 'active'])
        .order('education_round', { ascending: true });

      // 강사 필터링 적용
      if (isInstructor && instructorId) {
        query = query.eq('instructor_id', instructorId);
      }

      if (course) {
        query = query.eq('course_name', course);
      }

      const { data: trendSurveys } = await query;
      
      if (trendSurveys) {
        const trendMap = new Map();
        
        trendSurveys.forEach(survey => {
          const round = survey.education_round;
          if (!trendMap.has(round)) {
            trendMap.set(round, {
              round,
              instructor: [],
              course: [],
              operation: []
            });
          }
          
          const roundData = trendMap.get(round);
          
          survey.survey_responses?.forEach(response => {
            response.question_answers?.forEach(answer => {
              if (answer.survey_questions?.question_type === 'scale' && answer.answer_value) {
                let score = typeof answer.answer_value === 'number' ? answer.answer_value : Number(answer.answer_value);
                if (score <= 5 && score > 0) score = score * 2;
                
                if (answer.survey_questions.satisfaction_type === 'instructor') {
                  roundData.instructor.push(score);
                } else if (answer.survey_questions.satisfaction_type === 'course') {
                  roundData.course.push(score);
                } else if (answer.survey_questions.satisfaction_type === 'operation') {
                  roundData.operation.push(score);
                }
              }
            });
          });
        });

        const trendArray = Array.from(trendMap.values()).map(data => ({
          round: `${data.round}차`,
          강사만족도: data.instructor.length > 0 ? 
            Number((data.instructor.reduce((a, b) => a + b, 0) / data.instructor.length).toFixed(1)) : 0,
          과정만족도: data.course.length > 0 ? 
            Number((data.course.reduce((a, b) => a + b, 0) / data.course.length).toFixed(1)) : 0,
          운영만족도: data.operation.length > 0 ? 
            Number((data.operation.reduce((a, b) => a + b, 0) / data.operation.length).toFixed(1)) : 0
        })).slice(-5); // 최근 5개만

        setTrendData(trendArray);
      }
    } catch (error) {
      console.error('Error fetching trend data:', error);
    }
  };

  const fetchTextualResponses = async (surveys: any[]) => {
    try {
      const textResponses: string[] = [];
      
      surveys?.forEach(survey => {
        survey.survey_responses?.forEach(response => {
          response.question_answers?.forEach(answer => {
            if (answer.survey_questions?.question_type === 'text' && answer.answer_value) {
              const text = typeof answer.answer_value === 'string' ? answer.answer_value : String(answer.answer_value);
              if (text.trim().length > 0) {
                textResponses.push(text.trim());
              }
            }
          });
        });
      });

      setTextualResponses(textResponses);
    } catch (error) {
      console.error('Error fetching textual responses:', error);
    }
  };

  const fetchCourseStatistics = async (year: number) => {
    try {
      let query = supabase
        .from('course_statistics')
        .select('*')
        .eq('year', year)
        .order('round', { ascending: true });

      // 강사 필터링은 course_statistics 테이블 구조에 따라 달라질 수 있음
      // 필요시 instructor_id 필드가 있다면 추가

      const { data: statistics, error } = await query;

      if (error) throw error;

      setCourseStatistics(statistics || []);
      return statistics || [];
    } catch (error) {
      console.error('Error fetching course statistics:', error);
      return [];
    }
  };

  const fetchYearlyComparison = async (currentYear: number, previousYear: number) => {
    try {
      const [currentStats, previousStats] = await Promise.all([
        fetchCourseStatistics(currentYear),
        fetchCourseStatistics(previousYear)
      ]);

      setYearlyComparison({
        current: currentStats,
        previous: previousStats
      });
    } catch (error) {
      console.error('Error fetching yearly comparison:', error);
    }
  };

  return {
    reports,
    previousReports,
    trendData,
    instructorStats,
    availableCourses,
    availableRounds,
    availableInstructors,
    textualResponses,
    courseStatistics,
    yearlyComparison,
    loading,
    fetchAvailableCourses,
    fetchReports,
    fetchCourseStatistics,
    fetchYearlyComparison,
    isInstructor,
    instructorId
  };
};