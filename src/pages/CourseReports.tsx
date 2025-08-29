import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { GaugeChart } from '@/components/charts/GaugeChart';
import { AreaChart } from '@/components/charts/AreaChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { HeatmapChart } from '@/components/charts/HeatmapChart';
import { RadarChart } from '@/components/charts/RadarChart';
import { ChevronRight, TrendingUp, Users, Star, BookOpen, Target, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

const CourseReports = () => {
  const [reports, setReports] = useState<CourseReport[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [instructorStats, setInstructorStats] = useState<InstructorStats[]>([]);
  const [availableCourses, setAvailableCourses] = useState<{year: number, round: number, course_name: string, key: string}[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAvailableCourses();
  }, [selectedYear]);

  useEffect(() => {
    if (selectedCourse) {
      fetchReports();
    }
  }, [selectedCourse]);

  const fetchAvailableCourses = async () => {
    setLoading(true);
    try {
      const { data: surveys, error } = await supabase
        .from('surveys')
        .select('education_year, education_round, course_name')
        .eq('education_year', selectedYear)
        .eq('status', 'completed')
        .not('course_name', 'is', null);

      if (error) throw error;

      // 중복 제거 및 과정별 그룹화
      const uniqueCourses = Array.from(
        new Map(
          surveys?.map(s => [`${s.education_year}-${s.education_round}-${s.course_name}`, s])
        ).values()
      ).map(s => ({
        year: s.education_year,
        round: s.education_round,
        course_name: s.course_name,
        key: `${s.education_year}-${s.education_round}-${s.course_name}`
      }));

      setAvailableCourses(uniqueCourses);
      
      // 첫 번째 과정을 자동 선택
      if (uniqueCourses.length > 0 && !selectedCourse) {
        setSelectedCourse(uniqueCourses[0].key);
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
    if (!selectedCourse) return;
    
    const [year, round, courseName] = selectedCourse.split('-');
    
    setLoading(true);
    try {
      // 선택된 과정의 모든 설문조사 데이터 조회
      const { data: surveys, error: surveysError } = await supabase
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
          instructors (name),
          survey_responses (
            id,
            question_answers (
              id,
              answer_value,
              survey_questions (satisfaction_type, question_type)
            )
          )
        `)
        .eq('education_year', parseInt(year))
        .eq('education_round', parseInt(round))
        .eq('course_name', courseName)
        .eq('status', 'completed');

      if (surveysError) throw surveysError;

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

        if (survey.instructor_id) {
          if (!instructorStatsMap.has(survey.instructor_id)) {
            instructorStatsMap.set(survey.instructor_id, {
              instructor_id: survey.instructor_id,
              instructor_name: survey.instructors?.name || '알 수 없음',
              survey_count: 0,
              response_count: 0,
              satisfactions: []
            });
          }
          
          const instructorStat = instructorStatsMap.get(survey.instructor_id);
          instructorStat.survey_count += 1;
          instructorStat.response_count += survey.survey_responses?.length || 0;
        }

        // 만족도 점수 계산
        survey.survey_responses?.forEach(response => {
          response.question_answers?.forEach(answer => {
            if (answer.survey_questions?.question_type === 'scale' && answer.answer_value) {
              const score = typeof answer.answer_value === 'number' ? answer.answer_value : 
                           Number(answer.answer_value);
              
              if (answer.survey_questions.satisfaction_type === 'instructor') {
                allInstructorSatisfactions.push(score);
                if (survey.instructor_id) {
                  instructorStatsMap.get(survey.instructor_id).satisfactions.push(score);
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
      }));

      // 종합 통계 생성
      const courseReport: CourseReport = {
        id: selectedCourse,
        education_year: parseInt(year),
        education_round: parseInt(round),
        course_title: courseName,
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

  const handleInstructorClick = (instructorId: string) => {
    navigate(`/dashboard/instructor-details/${instructorId}?year=${selectedYear}`);
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  
  const currentReport = reports[0];

  // 차트 데이터 준비
  const satisfactionChartData = currentReport ? [
    { name: '강사 만족도', value: currentReport.avg_instructor_satisfaction, color: '#8884d8' },
    { name: '과목 만족도', value: currentReport.avg_course_satisfaction, color: '#82ca9d' },
    { name: '운영 만족도', value: currentReport.report_data?.operation_satisfaction || 0, color: '#ffc658' }
  ] : [];

  const instructorComparisonData = instructorStats.map((stat, index) => ({
    name: stat.instructor_name,
    satisfaction: stat.avg_satisfaction,
    responseCount: stat.response_count
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">과정 운영 결과 보고</h1>
        <p className="text-muted-foreground mt-2">
          과정별 종합적인 만족도 조사 결과와 강사별 통계를 확인할 수 있습니다.
        </p>
      </div>

      {/* 필터 */}
      <Card>
        <CardHeader>
          <CardTitle>과정 선택</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div>
            <label className="text-sm font-medium">교육 연도</label>
            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(Number(value))}>
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
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
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

      {currentReport && (
        <>
          {/* 전체 통계 요약 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 설문 수</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentReport.total_surveys}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 응답 수</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentReport.total_responses}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">참여 강사 수</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentReport.report_data?.instructor_count || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">전체 평균 만족도</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {((currentReport.avg_instructor_satisfaction + currentReport.avg_course_satisfaction + (currentReport.report_data?.operation_satisfaction || 0)) / 3).toFixed(1)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 만족도 차트 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>영역별 만족도</CardTitle>
                <CardDescription>강사, 과목, 운영 만족도 비교</CardDescription>
              </CardHeader>
              <CardContent>
                <DonutChart data={satisfactionChartData} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>만족도 점수 분포</CardTitle>
                <CardDescription>각 영역별 세부 점수</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {satisfactionChartData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{item.value.toFixed(1)}</span>
                        <span className="text-sm text-muted-foreground">/ 5.0</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 강사별 통계 */}
          {instructorStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>강사별 만족도 통계</CardTitle>
                <CardDescription>
                  각 강사별 평균 만족도와 응답 수를 확인할 수 있습니다. 클릭하면 상세 정보를 볼 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 mb-6">
                  {instructorStats.map((stat) => (
                    <div 
                      key={stat.instructor_id}
                      className="flex justify-between items-center p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleInstructorClick(stat.instructor_id)}
                    >
                      <div>
                        <h4 className="font-medium">{stat.instructor_name}</h4>
                        <div className="text-sm text-muted-foreground">
                          설문 {stat.survey_count}개 · 응답 {stat.response_count}개
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="text-xl font-bold">{stat.avg_satisfaction.toFixed(1)}</div>
                          <div className="text-xs text-muted-foreground">평균 만족도</div>
                        </div>
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                  ))}
                </div>

                {instructorStats.length > 1 && (
                  <div>
                    <h4 className="font-medium mb-4">강사별 만족도 비교</h4>
                    <AreaChart 
                      data={instructorComparisonData}
                      dataKeys={[
                        { key: 'satisfaction', label: '만족도', color: 'hsl(var(--primary))' }
                      ]}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 과정 요약 */}
          <Card>
            <CardHeader>
              <CardTitle>과정 요약</CardTitle>
              <CardDescription>
                {currentReport.education_year}년 {currentReport.education_round}차 {currentReport.course_title} 결과 요약
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">주요 지표</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>총 설문조사:</span>
                      <span className="font-medium">{currentReport.total_surveys}개</span>
                    </div>
                    <div className="flex justify-between">
                      <span>총 응답자:</span>
                      <span className="font-medium">{currentReport.total_responses}명</span>
                    </div>
                    <div className="flex justify-between">
                      <span>참여 강사:</span>
                      <span className="font-medium">{currentReport.report_data?.instructor_count || 0}명</span>
                    </div>
                    <div className="flex justify-between">
                      <span>평균 응답률:</span>
                      <span className="font-medium">
                        {currentReport.total_surveys > 0 
                          ? Math.round((currentReport.total_responses / currentReport.total_surveys) * 100) / 100
                          : 0}명/설문
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">만족도 평가</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>강사 만족도:</span>
                      <span className="font-medium">{currentReport.avg_instructor_satisfaction.toFixed(1)}/5.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span>과목 만족도:</span>
                      <span className="font-medium">{currentReport.avg_course_satisfaction.toFixed(1)}/5.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span>운영 만족도:</span>
                      <span className="font-medium">{(currentReport.report_data?.operation_satisfaction || 0).toFixed(1)}/5.0</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-medium">종합 만족도:</span>
                      <span className="font-bold text-primary">
                        {((currentReport.avg_instructor_satisfaction + currentReport.avg_course_satisfaction + (currentReport.report_data?.operation_satisfaction || 0)) / 3).toFixed(1)}/5.0
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default CourseReports;