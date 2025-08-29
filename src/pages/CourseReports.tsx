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
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [instructorStats, setInstructorStats] = useState<InstructorStats[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchReports();
  }, [selectedYear]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      // 과정별 요약 데이터 조회
      const { data: surveys, error: surveysError } = await supabase
        .from('surveys')
        .select(`
          id,
          education_year,
          education_round,
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
        .eq('education_year', selectedYear)
        .eq('status', 'completed');

      if (surveysError) throw surveysError;

      // 데이터 집계
      const reportsMap = new Map();
      const instructorStatsMap = new Map();

      surveys?.forEach(survey => {
        const key = `${survey.education_year}-${survey.education_round}`;
        
        if (!reportsMap.has(key)) {
          reportsMap.set(key, {
            id: key,
            education_year: survey.education_year,
            education_round: survey.education_round,
            course_title: survey.courses?.title || survey.title,
            total_surveys: 0,
            total_responses: 0,
            instructor_satisfactions: [],
            course_satisfactions: [],
            instructors: new Set()
          });
        }

        const report = reportsMap.get(key);
        report.total_surveys += 1;
        report.total_responses += survey.survey_responses?.length || 0;

        if (survey.instructor_id) {
          report.instructors.add(survey.instructor_id);
          
          // 강사별 통계 수집
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
                report.instructor_satisfactions.push(score);
                if (survey.instructor_id) {
                  instructorStatsMap.get(survey.instructor_id).satisfactions.push(score);
                }
              } else if (answer.survey_questions.satisfaction_type === 'course') {
                report.course_satisfactions.push(score);
              }
            }
          });
        });
      });

      // 평균 계산 및 최종 데이터 변환
      const finalReports = Array.from(reportsMap.values()).map(report => ({
        ...report,
        avg_instructor_satisfaction: report.instructor_satisfactions.length > 0 
          ? report.instructor_satisfactions.reduce((a, b) => a + b, 0) / report.instructor_satisfactions.length
          : 0,
        avg_course_satisfaction: report.course_satisfactions.length > 0
          ? report.course_satisfactions.reduce((a, b) => a + b, 0) / report.course_satisfactions.length
          : 0,
        instructor_count: report.instructors.size
      }));

      const finalInstructorStats = Array.from(instructorStatsMap.values()).map(stat => ({
        ...stat,
        avg_satisfaction: stat.satisfactions.length > 0
          ? stat.satisfactions.reduce((a, b) => a + b, 0) / stat.satisfactions.length
          : 0
      }));

      setReports(finalReports);
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
  const rounds = [...new Set(reports.map(r => r.education_round))].sort((a, b) => a - b);

  const filteredReports = selectedRound 
    ? reports.filter(r => r.education_round === selectedRound)
    : reports;

  const totalSurveys = filteredReports.reduce((sum, r) => sum + r.total_surveys, 0);
  const totalResponses = filteredReports.reduce((sum, r) => sum + r.total_responses, 0);
  const avgInstructorSatisfaction = filteredReports.length > 0
    ? filteredReports.reduce((sum, r) => sum + r.avg_instructor_satisfaction, 0) / filteredReports.length
    : 0;
  const avgCourseSatisfaction = filteredReports.length > 0
    ? filteredReports.reduce((sum, r) => sum + r.avg_course_satisfaction, 0) / filteredReports.length
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">과정별 결과 보고</h1>
        <p className="text-muted-foreground mt-2">
          교육 과정별 만족도 조사 결과를 확인하고 분석할 수 있습니다.
        </p>
      </div>

      {/* 필터 */}
      <Card>
        <CardHeader>
          <CardTitle>필터</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div>
            <label className="text-sm font-medium">교육 연도</label>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="ml-2 p-2 border rounded"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}년</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">차수</label>
            <select 
              value={selectedRound || ''} 
              onChange={(e) => setSelectedRound(e.target.value ? Number(e.target.value) : null)}
              className="ml-2 p-2 border rounded"
            >
              <option value="">전체</option>
              {rounds.map(round => (
                <option key={round} value={round}>{round}차</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* 전체 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 설문 수</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSurveys}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 응답 수</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalResponses}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">강사 평균 만족도</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgInstructorSatisfaction.toFixed(1)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">과정 평균 만족도</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgCourseSatisfaction.toFixed(1)}</div>
          </CardContent>
        </Card>
      </div>

      {/* 차수별 결과 */}
      <Card>
        <CardHeader>
          <CardTitle>차수별 결과</CardTitle>
          <CardDescription>
            각 차수별 설문조사 결과를 확인할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredReports.map((report) => (
              <div key={report.id} className="border rounded-lg p-4 hover:bg-muted/50">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {report.education_year}년 {report.education_round}차 - {report.course_title}
                    </h3>
                    <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                      <span>설문 수: {report.total_surveys}</span>
                      <span>응답 수: {report.total_responses}</span>
                      <span>강사 만족도: {report.avg_instructor_satisfaction.toFixed(1)}</span>
                      <span>과정 만족도: {report.avg_course_satisfaction.toFixed(1)}</span>
                    </div>
                  </div>
                  <Badge variant="outline">
                    {report.education_round}차
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 강사별 통계 */}
      <Card>
        <CardHeader>
          <CardTitle>강사별 통계</CardTitle>
          <CardDescription>
            강사별 만족도 및 진행 현황을 확인할 수 있습니다. 클릭하면 상세 정보를 볼 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {instructorStats.map((stat) => (
              <div 
                key={stat.instructor_id}
                className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                onClick={() => handleInstructorClick(stat.instructor_id)}
              >
                <div>
                  <h4 className="font-medium">{stat.instructor_name}</h4>
                  <div className="text-sm text-muted-foreground">
                    설문 {stat.survey_count}개 · 응답 {stat.response_count}개 · 
                    평균 만족도 {stat.avg_satisfaction.toFixed(1)}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CourseReports;