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

// 코스명 정규화: '홀수조/짝수조', '숫자조/숫자반' 등 분반 표기를 제거
const normalizeCourseName = (name?: string | null) => {
  if (!name) return '';
  let n = String(name);
  // 괄호 안의 '홀수조'/'짝수조' 제거
  n = n.replace(/\((?:홀수조|짝수조)\)/g, '');
  // '11/12조' 같은 표기 제거
  n = n.replace(/\b\d{1,2}\/\d{1,2}조\b/g, '');
  // 차수 뒤에 위치한 '숫자조', '홀수조', '짝수조' 제거 (새로운 형식)
  n = n.replace(/(\d+차-\d+일차)\s+\d{1,2}조/g, '$1');
  n = n.replace(/(\d+차-\d+일차)\s+(?:홀수조|짝수조)/g, '$1');
  // 끝이나 공백 앞의 '숫자조' 또는 '숫자반' 제거 (기존 형식)
  n = n.replace(/\b\d{1,2}\s*(?:조|반)\b/g, '');
  // '홀수조-', '짝수조-' 같은 형식 제거
  n = n.replace(/(?:홀수조|짝수조)-/g, '');
  // 여분 공백과 하이픈 정리
  n = n.replace(/\s{2,}/g, ' ').replace(/-{2,}/g, '-').trim();
  return n;
};

// 점수 파싱 유틸: answer_value 또는 answer_text에서 숫자 추출
const parseScore = (val: any): number | null => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/"/g, '').trim();
    const n = Number(cleaned);
    return isNaN(n) ? null : n;
  }
  // JSON 문자열 같은 경우 처리
  try {
    const parsed = JSON.parse(val);
    return typeof parsed === 'number' && isFinite(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
};

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
  const [previousInstructorStats, setPreviousInstructorStats] = useState<InstructorStats[]>([]);
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

      console.log('Fetched surveys for course selection:', surveys);

      // 중복 제거 및 과정별 그룹화
      // 코스명 정규화 기준으로 중복 제거 (분반/조 표기 제거 후 그룹화)
      const courseGroups = new Map<string, any[]>();
      (surveys || []).forEach((s: any) => {
        const key = normalizeCourseName(s.course_name);
        if (!courseGroups.has(key)) courseGroups.set(key, []);
        courseGroups.get(key)!.push(s);
      });

      const uniqueCourses = Array.from(courseGroups.keys()).map((key) => {
        const any = courseGroups.get(key)![0];
        return {
          year: any.education_year,
          round: any.education_round,
          course_name: key,
          key,
        };
      });

      // 사용 가능한 차수 추출
      const rounds = Array.from(new Set(surveys?.map(s => s.education_round))).sort((a, b) => a - b);
      setAvailableRounds(rounds);

      setAvailableCourses(uniqueCourses);
      console.log('Available courses:', uniqueCourses);
      console.log('Available rounds:', rounds);

      // 강사 정보 - 관리자만 가져오기 (모든 강사)
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
    }
  };

  const fetchReports = async () => {
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
          survey_instructors (
            instructor_id,
            instructors (id, name)
          ),
          survey_sessions!survey_sessions_survey_id_fkey (
            id,
            instructor_id
          ),
          survey_responses (
            id,
          question_answers (
            id,
            answer_value,
            answer_text,
            survey_questions (satisfaction_type, question_type, session_id)
          )
          )
        `)
        .eq('education_year', selectedYear)
        .in('status', ['completed', 'active']);

      // 다중 강사 정보를 가져오는 함수
      const getInstructorNames = (survey: any) => {
        // 1. survey_instructors 테이블 확인
        if (survey.survey_instructors && survey.survey_instructors.length > 0) {
          const names = survey.survey_instructors
            .map((si: any) => si.instructors?.name)
            .filter(Boolean);
          if (names.length > 0) return names.join(', ');
        }
        
        // 2. 개별 instructor_id 확인
        if (survey.instructors?.name) {
          return survey.instructors.name;
        }
        
        // 3. 과정명 사용
        return survey.course_name || '강사 정보 없음';
      };

      // 강사인 경우 본인 설문만 필터링
      if (isInstructor && instructorId) {
        query = query.eq('instructor_id', instructorId);
      }

      // 필터 적용 (과정명은 정규화 비교 위해 서버 필터 제외하고 클라이언트에서 필터)
      if (selectedRound) {
        query = query.eq('education_round', selectedRound);
      }
      if (selectedInstructor) { // 강사가 선택되면 OR 조건으로 포함 (단일/다중/세션 강사 모두)
        query = query.or(
          `instructor_id.eq.${selectedInstructor},survey_instructors.instructor_id.eq.${selectedInstructor},survey_sessions!survey_sessions_survey_id_fkey.instructor_id.eq.${selectedInstructor}`
        );
      }

      const { data: surveys, error: surveysError } = await query;

      if (surveysError) throw surveysError;

      console.log('Fetched detailed surveys:', surveys);
      console.log('Selected instructor:', selectedInstructor);
      console.log('Selected course (normalized):', selectedCourse);
      console.log('Selected round:', selectedRound);
      console.log('Total surveys before filtering:', surveys?.length || 0);

      // 정규화된 과정명으로 클라이언트 측 필터링 (분반/조 통합)
      const filteredSurveys = (surveys || []).filter((s: any) => {
        if (selectedCourse) {
          return normalizeCourseName(s.course_name) === selectedCourse;
        }
        return true;
      });

      console.log('Surveys after course filtering:', filteredSurveys.length);
      // 데이터 집계
      const instructorStatsMap = new Map();
      let totalSurveys = 0;
      let totalResponses = 0;
      let allInstructorSatisfactions: number[] = [];
      let allCourseSatisfactions: number[] = [];
      let allOperationSatisfactions: number[] = [];

      filteredSurveys.forEach(survey => {
        console.log('Processing survey:', survey.id, 'instructor_id:', survey.instructor_id, 'responses:', survey.survey_responses?.length);
        
        totalSurveys += 1;
        totalResponses += survey.survey_responses?.length || 0;

        // 강사 정보 처리 개선
        const instructorId = survey.instructor_id;
        const instructorName = (() => {
          // survey_instructors 확인
          if ((survey as any).survey_instructors && (survey as any).survey_instructors.length > 0) {
            const names = (survey as any).survey_instructors
              .map((si: any) => si.instructors?.name)
              .filter(Boolean);
            if (names.length > 0) return names.join(', ');
          }
          // 개별 instructor 확인
          if ((survey as any).instructors?.name) return (survey as any).instructors.name;
          // 과정명 사용
          return (survey as any).course_name || '강사 정보 없음';
        })();
        
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
        const selectedSessionIds = selectedInstructor
          ? new Set((survey as any).survey_sessions?.filter((ss: any) => ss.instructor_id === selectedInstructor).map((ss: any) => ss.id))
          : null;

        survey.survey_responses?.forEach((response: any) => {
          response.question_answers?.forEach((answer: any) => {
            // 선택된 강사에 해당하는 세션/설문만 포함
            if (selectedInstructor) {
              const sid = answer.survey_questions?.session_id as string | undefined;
              const isOwner = survey.instructor_id === selectedInstructor;
              const sessionMatch = sid && selectedSessionIds?.has(sid);
              if (!isOwner && !sessionMatch) return;
            }

            if (answer.survey_questions?.question_type === 'scale' && (answer.answer_value != null || answer.answer_text != null)) {
              let scoreRaw = parseScore((answer as any).answer_value ?? (answer as any).answer_text);
              if (scoreRaw === null) return;
              let score = scoreRaw;

              // 유효성 검사 - NaN과 무효한 값 필터링
              if (isNaN(score) || score <= 0 || !isFinite(score)) {
                return;
              }

              // 5점 척도를 10점으로 변환 (10점 척도는 그대로 유지)
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

      const finalInstructorStats = Array.from(instructorStatsMap.values()).map(stat => {
        const validSatisfactions = stat.satisfactions.filter(s => !isNaN(s) && isFinite(s));
        const avgSatisfaction = validSatisfactions.length > 0
          ? validSatisfactions.reduce((a: number, b: number) => a + b, 0) / validSatisfactions.length
          : 0;
        
        return {
          ...stat,
          avg_satisfaction: isNaN(avgSatisfaction) || !isFinite(avgSatisfaction) ? 0 : Number(avgSatisfaction.toFixed(1))
        };
      }).filter(stat => stat.survey_count > 0); // 실제 데이터가 있는 강사만 포함

      // 유효한 만족도 점수만 필터링
      const validInstructorSatisfactions = allInstructorSatisfactions.filter(s => !isNaN(s) && isFinite(s));
      const validCourseSatisfactions = allCourseSatisfactions.filter(s => !isNaN(s) && isFinite(s));
      const validOperationSatisfactions = allOperationSatisfactions.filter(s => !isNaN(s) && isFinite(s));

      // 평균 계산 함수
      const calculateAverage = (scores: number[]) => {
        if (scores.length === 0) return 0;
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        return isNaN(avg) || !isFinite(avg) ? 0 : Number(avg.toFixed(1));
      };

      // 종합 통계 생성
      const courseReport: CourseReport = {
        id: `${selectedYear}-${selectedCourse || 'all'}-${selectedRound || 'all'}-${selectedInstructor || 'all'}`,
        education_year: selectedYear,
        education_round: selectedRound || 0,
        course_title: selectedCourse || (isInstructor ? '내 담당 과정' : '전체 과정'),
        total_surveys: totalSurveys,
        total_responses: totalResponses,
        avg_instructor_satisfaction: calculateAverage(validInstructorSatisfactions),
        avg_course_satisfaction: calculateAverage(validCourseSatisfactions),
        report_data: {
          operation_satisfaction: calculateAverage(validOperationSatisfactions),
          instructor_count: finalInstructorStats.length,
          satisfaction_distribution: {
            instructor: validInstructorSatisfactions,
            course: validCourseSatisfactions,
            operation: validOperationSatisfactions
          }
        },
        created_at: new Date().toISOString()
      };

      console.log('Generated course report:', courseReport);
      console.log('Instructor stats:', finalInstructorStats);
      console.log('Generated course report:', courseReport);
      console.log('Final instructor stats:', finalInstructorStats);
      setReports([courseReport]);
      setInstructorStats(finalInstructorStats);

      // 이전 차수 데이터 가져오기
      await fetchPreviousReports(selectedYear, selectedCourse, selectedRound);
      
      // 트렌드 데이터 가져오기 (최근 5개 차수)
      await fetchTrendData(selectedYear, selectedCourse);

      // 서술형 응답 가져오기
      await fetchTextualResponses(filteredSurveys);

      // 과정별 통계 가져오기
      await fetchCourseStatistics(selectedYear);

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
          instructor_id,
          instructors (
            id,
            name
          ),
          survey_responses (
            id,
          question_answers (
            id,
            answer_value,
            answer_text,
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
            if (answer.survey_questions?.question_type === 'scale' && (answer.answer_value != null || answer.answer_text != null)) {
              let scoreRaw = parseScore((answer as any).answer_value ?? (answer as any).answer_text);
              if (scoreRaw === null) return;
              let score = scoreRaw;
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
        
        // 이전 차수 강사별 통계도 계산
        const prevInstructorStatsMap = new Map<string, {
          survey_count: number;
          response_count: number;
          instructor_satisfactions: number[];
          instructor_name: string;
        }>();

        prevSurveys.forEach(survey => {
          if (survey.instructor_id) {
            const existingStat = prevInstructorStatsMap.get(survey.instructor_id) || {
              survey_count: 0,
              response_count: 0,
              instructor_satisfactions: [],
              instructor_name: (() => {
                // survey_instructors 확인
                if ((survey as any).survey_instructors && (survey as any).survey_instructors.length > 0) {
                  const names = (survey as any).survey_instructors
                    .map((si: any) => si.instructors?.name)
                    .filter(Boolean);
                  if (names.length > 0) return names.join(', ');
                }
                // 개별 instructor 확인
                if ((survey as any).instructors?.name) return (survey as any).instructors.name;
                // 과정명 사용
                return (survey as any).course_name || '강사 정보 없음';
              })()
            };

            existingStat.survey_count += 1;
            existingStat.response_count += survey.survey_responses?.length || 0;

            survey.survey_responses?.forEach(response => {
              response.question_answers?.forEach(answer => {
                if (answer.survey_questions?.satisfaction_type === 'instructor' && 
                    answer.survey_questions?.question_type === 'scale' && 
                    (answer.answer_value != null || answer.answer_text != null)) {
                  let scoreRaw = parseScore((answer as any).answer_value ?? (answer as any).answer_text);
                  if (scoreRaw === null) return;
                  let score = scoreRaw;
                  if (score <= 5 && score > 0) score = score * 2;
                  existingStat.instructor_satisfactions.push(score);
                }
              });
            });

            prevInstructorStatsMap.set(survey.instructor_id, existingStat);
          }
        });

        const prevInstructorStats: InstructorStats[] = Array.from(prevInstructorStatsMap.entries()).map(([id, stat]) => ({
          instructor_id: id,
          instructor_name: stat.instructor_name,
          survey_count: stat.survey_count,
          response_count: stat.response_count,
          avg_satisfaction: stat.instructor_satisfactions.length > 0 
            ? stat.instructor_satisfactions.reduce((a, b) => a + b, 0) / stat.instructor_satisfactions.length 
            : 0
        }));

        setPreviousInstructorStats(prevInstructorStats);
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
          instructor_id,
          survey_sessions (
            id,
            instructor_id
          ),
          survey_responses (
            id,
          question_answers (
            answer_value,
            answer_text,
            survey_questions (satisfaction_type, question_type, session_id)
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

      // 과정명은 정규화 후 클라이언트에서 필터링

      const { data: trendSurveys } = await query;
      
      const filteredTrendSurveys = (trendSurveys || []).filter((s: any) => {
        if (course) return normalizeCourseName(s.course_name) === course;
        return true;
      });
      
      if (filteredTrendSurveys) {
        const trendMap = new Map();
        
        filteredTrendSurveys.forEach((survey: any) => {
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
          
          survey.survey_responses?.forEach((response: any) => {
          response.question_answers?.forEach((answer: any) => {
            if (answer.survey_questions?.question_type === 'scale' && (answer.answer_value != null || answer.answer_text != null)) {
              let scoreRaw = parseScore((answer as any).answer_value ?? (answer as any).answer_text);
              if (scoreRaw === null) return;
              let score = scoreRaw;
              
              // NaN 및 무효한 값 검증
              if (isNaN(score) || !isFinite(score) || score <= 0) {
                return; // 유효하지 않은 값은 건너뛰기
              }
              
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

        const trendArray = Array.from(trendMap.values())
          .map(data => {
            // 안전한 평균 계산 함수
            const safeAverage = (arr: number[]) => {
              if (!arr || arr.length === 0) return 0;
              const validScores = arr.filter(score => !isNaN(score) && isFinite(score));
              if (validScores.length === 0) return 0;
              const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
              return isNaN(avg) || !isFinite(avg) ? 0 : Number(avg.toFixed(1));
            };

            return {
              round: `${data.round}차`,
              강사만족도: safeAverage(data.instructor),
              과정만족도: safeAverage(data.course),
              운영만족도: safeAverage(data.operation)
            };
          })
          .filter(item => item.강사만족도 > 0 || item.과정만족도 > 0 || item.운영만족도 > 0)
          .slice(-5); // 최근 5개만

        console.log('Trend data calculated:', trendArray);
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
      // surveys 테이블에서 직접 과정별 통계 계산
      let query = supabase
        .from('surveys')
        .select(`
          id,
          education_year,
          education_round,
          course_name,
          instructor_id,
          instructors (name),
          survey_responses (
            id,
          question_answers (
            answer_value,
            answer_text,
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

      const { data: surveys, error } = await query;

      if (error) throw error;

      // 과정별로 데이터 집계
      const courseMap = new Map();

      surveys?.forEach(survey => {
        const courseKey = normalizeCourseName(survey.course_name);
        if (!courseMap.has(courseKey)) {
          courseMap.set(courseKey, {
            course_name: courseKey,
            year: survey.education_year,
            round: survey.education_round,
            enrolled_count: 0,
            total_responses: 0,
            instructor_satisfactions: [],
            course_satisfactions: [],
            operation_satisfactions: []
          });
        }

        const courseData = courseMap.get(courseKey);
        courseData.enrolled_count += 1;
        courseData.total_responses += survey.survey_responses?.length || 0;

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
                return;
              }

              if (isNaN(score) || score <= 0 || !isFinite(score)) return;

              // 5점 척도를 10점으로 변환
              if (score <= 5 && score > 0) {
                score = score * 2;
              }
              
              if (answer.survey_questions.satisfaction_type === 'instructor') {
                courseData.instructor_satisfactions.push(score);
              } else if (answer.survey_questions.satisfaction_type === 'course') {
                courseData.course_satisfactions.push(score);
              } else if (answer.survey_questions.satisfaction_type === 'operation') {
                courseData.operation_satisfactions.push(score);
              }
            }
          });
        });
      });

      // 안전한 평균 계산 함수
      const safeAverage = (arr: number[]) => {
        if (!arr || arr.length === 0) return 0;
        const validScores = arr.filter(score => !isNaN(score) && isFinite(score));
        if (validScores.length === 0) return 0;
        const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
        return isNaN(avg) || !isFinite(avg) ? 0 : Number(avg.toFixed(1));
      };

      // 최종 통계 계산
      const statistics = Array.from(courseMap.values()).map(course => {
        const instructorAvg = safeAverage(course.instructor_satisfactions);
        const courseAvg = safeAverage(course.course_satisfactions);
        const operationAvg = safeAverage(course.operation_satisfactions);
        
        // 전체 만족도는 모든 항목이 있을 때만 계산
        const totalSatisfaction = instructorAvg > 0 && courseAvg > 0 && operationAvg > 0
          ? Number(((instructorAvg + courseAvg + operationAvg) / 3).toFixed(1))
          : 0;

        return {
          id: `${course.course_name}-${course.year}`,
          year: course.year,
          round: course.round,
          course_name: course.course_name,
          enrolled_count: course.enrolled_count,
          cumulative_count: course.total_responses,
          instructor_satisfaction: instructorAvg || 0,
          course_satisfaction: courseAvg || 0,
          operation_satisfaction: operationAvg || 0,
          total_satisfaction: totalSatisfaction,
          course_days: 5, // 기본값
          course_start_date: new Date().toISOString().split('T')[0],
          course_end_date: new Date().toISOString().split('T')[0],
          status: 'completed',
          education_hours: null,
          education_days: null
        };
      });

      setCourseStatistics(statistics);
      console.log('Course statistics calculated:', statistics);
      return statistics;
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
    previousInstructorStats,
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