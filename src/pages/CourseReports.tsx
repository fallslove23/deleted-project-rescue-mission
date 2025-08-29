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
  const [showSampleData, setShowSampleData] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // 샘플 데이터
  const sampleReport: CourseReport = {
    id: 'sample-2025-7',
    education_year: 2025,
    education_round: 7,
    course_title: 'BS Basic 교육 과정',
    total_surveys: 12,
    total_responses: 178,
    avg_instructor_satisfaction: 9.6,
    avg_course_satisfaction: 9.3,
    report_data: {
      operation_satisfaction: 9.7,
      instructor_count: 8,
      satisfaction_distribution: {
        instructor: [9.5, 9.6, 9.7, 9.4, 9.8, 9.3, 9.6, 9.5],
        course: [9.2, 9.3, 9.4, 9.1, 9.5, 9.2, 9.3, 9.4],
        operation: [9.6, 9.7, 9.8, 9.5, 9.9, 9.4, 9.7, 9.6]
      },
      trend_data: [
        { period: '24-9차', instructor: 9.4, course: 9.1, operation: 9.5 },
        { period: '24-10차', instructor: 9.5, course: 9.2, operation: 9.6 },
        { period: '24-11차', instructor: 9.3, course: 9.0, operation: 9.4 },
        { period: '25-1차', instructor: 9.7, course: 9.3, operation: 9.8 },
        { period: '25-2차', instructor: 9.6, course: 9.2, operation: 9.7 },
        { period: '25-3차', instructor: 9.5, course: 9.4, operation: 9.6 },
        { period: '25-4차', instructor: 9.6, course: 9.3, operation: 9.7 },
        { period: '25-5차', instructor: 9.7, course: 9.2, operation: 9.8 },
        { period: '25-6차', instructor: 9.6, course: 9.3, operation: 9.7 },
        { period: '25-7차', instructor: 9.6, course: 9.3, operation: 9.7 }
      ],
      improvement_suggestions: [
        "강의실의 더 나은 음향설비",
        "SM7 명령어 교육확대요망",
        "OneIct DLP 실습을 1회 정도 늘려줌",
        "교재 인쇄 품질이 더 좋았으면 합니다",
        "실습 시간이 조금 더 길면 좋겠어요",
        "최신 기술 트렌드 관련 추가 내용"
      ]
    },
    created_at: new Date().toISOString()
  };

  const sampleInstructorStats: InstructorStats[] = [
    { instructor_id: '1', instructor_name: '김영희 강사', survey_count: 2, response_count: 24, avg_satisfaction: 9.6 },
    { instructor_id: '2', instructor_name: '박철수 강사', survey_count: 2, response_count: 22, avg_satisfaction: 9.5 },
    { instructor_id: '3', instructor_name: '이정민 강사', survey_count: 1, response_count: 18, avg_satisfaction: 9.4 },
    { instructor_id: '4', instructor_name: '최영수 강사', survey_count: 2, response_count: 26, avg_satisfaction: 9.6 },
    { instructor_id: '5', instructor_name: '이태윤 강사', survey_count: 1, response_count: 20, avg_satisfaction: 9.5 },
    { instructor_id: '6', instructor_name: '최영일 강사', survey_count: 2, response_count: 24, avg_satisfaction: 9.4 },
    { instructor_id: '7', instructor_name: '김기현 강사', survey_count: 1, response_count: 22, avg_satisfaction: 9.3 },
    { instructor_id: '8', instructor_name: '송준기 강사', survey_count: 1, response_count: 22, avg_satisfaction: 9.5 }
  ];

  useEffect(() => {
    fetchAvailableCourses();
  }, [selectedYear]);

  useEffect(() => {
    if (selectedCourse) {
      fetchReports();
    } else if (showSampleData) {
      // 샘플 데이터 표시
      setReports([sampleReport]);
      setInstructorStats(sampleInstructorStats);
      setLoading(false);
    }
  }, [selectedCourse, showSampleData]);

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
      
      // 데이터가 없으면 샘플 데이터 옵션 표시
      if (uniqueCourses.length === 0) {
        setShowSampleData(true);
        setSelectedCourse('sample-2025-7');
      } else if (uniqueCourses.length > 0 && !selectedCourse) {
        setSelectedCourse(uniqueCourses[0].key);
        setShowSampleData(false);
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
    if (!selectedCourse || selectedCourse === 'sample-2025-7') return;
    
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
  
  const currentReport = showSampleData ? sampleReport : reports[0];

  // 차트 데이터 준비 - 통일된 색상 테마
  const satisfactionChartData = currentReport ? [
    { name: '강사 만족도', value: currentReport.avg_instructor_satisfaction, color: 'hsl(var(--primary))', fill: 'hsl(var(--primary))' },
    { name: '과목 만족도', value: currentReport.avg_course_satisfaction, color: 'hsl(var(--primary) / 0.8)', fill: 'hsl(var(--primary) / 0.8)' },
    { name: '운영 만족도', value: currentReport.report_data?.operation_satisfaction || 0, color: 'hsl(var(--primary) / 0.6)', fill: 'hsl(var(--primary) / 0.6)' }
  ] : [];

  // 트렌드 차트 데이터
  const trendChartData = currentReport?.report_data?.trend_data || [];

  // 강사별 차트 데이터
  const instructorComparisonData = (showSampleData ? sampleInstructorStats : instructorStats).map((stat, index) => ({
    name: stat.instructor_name,
    satisfaction: stat.avg_satisfaction,
    responseCount: stat.response_count,
    fill: `hsl(${200 + index * 20}, 70%, 60%)`
  }));

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-primary/5 via-primary/10 to-secondary/5 rounded-xl p-6 border border-primary/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            과정 운영 결과 보고
          </h1>
        </div>
        <p className="text-muted-foreground">
          과정별 종합적인 만족도 조사 결과와 강사별 통계를 확인할 수 있습니다.
        </p>
      </div>

      {/* 필터 */}
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
                {showSampleData && (
                  <SelectItem value="sample-2025-7">
                    🎯 2025년 7차 - BS Basic 교육 과정 (샘플 데이터)
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {currentReport && (
        <>
          {/* 전체 통계 요약 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-primary">총 설문 수</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{currentReport.total_surveys}</div>
                <p className="text-xs text-muted-foreground mt-1">개의 설문 진행</p>
              </CardContent>
            </Card>
            
            <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-primary">총 응답 수</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{currentReport.total_responses}</div>
                <p className="text-xs text-muted-foreground mt-1">명이 응답 참여</p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-primary">참여 강사 수</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{currentReport.report_data?.instructor_count || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">명의 강사 참여</p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-primary">전체 평균 만족도</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Star className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  {((currentReport.avg_instructor_satisfaction + currentReport.avg_course_satisfaction + (currentReport.report_data?.operation_satisfaction || 0)) / 3).toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">점 / 10점 만점</p>
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
                        <span className="text-sm text-muted-foreground">/ 10.0</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 차수별 트렌드 분석 */}
          {trendChartData.length > 0 && (
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  차수별 전체 평균 만족도 변화 추이
                </CardTitle>
                <CardDescription>
                  최근 차수별 만족도 변화를 확인할 수 있습니다 (10점 만점)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AreaChart 
                  data={trendChartData}
                  dataKeys={[
                    { key: 'instructor', label: '강사 만족도', color: 'hsl(var(--primary))' },
                    { key: 'course', label: '과목 만족도', color: 'hsl(var(--primary) / 0.8)' },
                    { key: 'operation', label: '운영 만족도', color: 'hsl(var(--primary) / 0.6)' }
                  ]}
                />
              </CardContent>
            </Card>
          )}

          {/* 설문 개선사항 */}
          {currentReport.report_data?.improvement_suggestions && (
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  설문 개선사항 (열린 주관식 의견)
                </CardTitle>
                <CardDescription>
                  교육 참여자들이 제안한 개선사항을 확인할 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {currentReport.report_data.improvement_suggestions.map((suggestion: string, index: number) => (
                    <div 
                      key={index} 
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <p className="text-sm leading-relaxed">{suggestion}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 강사별 통계 */}
          {(showSampleData ? sampleInstructorStats : instructorStats).length > 0 && (
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  강사별 만족도 통계 (10점 만점)
                </CardTitle>
                <CardDescription>
                  각 강사별 평균 만족도와 응답 수를 확인할 수 있습니다. 클릭하면 상세 정보를 볼 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {(showSampleData ? sampleInstructorStats : instructorStats).map((stat, index) => (
                    <div 
                      key={stat.instructor_id}
                      className="flex justify-between items-center p-3 rounded-lg border hover:bg-muted/30 cursor-pointer transition-all duration-200 group"
                      onClick={() => !showSampleData && handleInstructorClick(stat.instructor_id)}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm bg-primary"
                        >
                          {stat.instructor_name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-medium text-sm">{stat.instructor_name}</h4>
                          <div className="text-xs text-muted-foreground">
                            설문 {stat.survey_count}개 · 응답 {stat.response_count}개
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="text-lg font-bold text-primary">{stat.avg_satisfaction.toFixed(1)}</div>
                          <div className="text-xs text-muted-foreground">만족도</div>
                        </div>
                        {!showSampleData && <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />}
                      </div>
                    </div>
                  ))}
                </div>

                {(showSampleData ? sampleInstructorStats : instructorStats).length > 1 && (
                  <div className="border-t pt-6">
                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      강사별 만족도 비교
                    </h4>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-lg border-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/20 dark:to-slate-800/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  {currentReport.education_year}년 {currentReport.education_round}차 주요 지표
                </CardTitle>
                <CardDescription>
                  {currentReport.course_title} 기본 통계
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-white/5 rounded-lg">
                    <span className="font-medium">총 설문조사</span>
                    <span className="text-xl font-bold text-primary">{currentReport.total_surveys}개</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-white/5 rounded-lg">
                    <span className="font-medium">총 응답자</span>
                    <span className="text-xl font-bold text-green-600">{currentReport.total_responses}명</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-white/5 rounded-lg">
                    <span className="font-medium">참여 강사</span>
                    <span className="text-xl font-bold text-purple-600">{currentReport.report_data?.instructor_count || 0}명</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-white/5 rounded-lg">
                    <span className="font-medium">평균 응답률</span>
                    <span className="text-xl font-bold text-amber-600">
                      {currentReport.total_surveys > 0 
                        ? Math.round((currentReport.total_responses / currentReport.total_surveys) * 100) / 100
                        : 0}명/설문
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-primary" />
                  만족도 종합 평가
                </CardTitle>
                <CardDescription>
                  영역별 세부 만족도 점수 (10점 만점)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-white/5 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="font-medium">강사 만족도</span>
                    </div>
                    <span className="text-xl font-bold text-blue-600">{currentReport.avg_instructor_satisfaction.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-white/5 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="font-medium">과목 만족도</span>
                    </div>
                    <span className="text-xl font-bold text-green-600">{currentReport.avg_course_satisfaction.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-white/5 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                      <span className="font-medium">운영 만족도</span>
                    </div>
                    <span className="text-xl font-bold text-amber-600">{(currentReport.report_data?.operation_satisfaction || 0).toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg border-2 border-primary/20">
                    <span className="font-bold text-lg">종합 만족도</span>
                    <span className="text-2xl font-bold text-primary">
                      {((currentReport.avg_instructor_satisfaction + currentReport.avg_course_satisfaction + (currentReport.report_data?.operation_satisfaction || 0)) / 3).toFixed(1)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default CourseReports;