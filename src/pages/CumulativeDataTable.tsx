import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Filter, FileSpreadsheet, Calendar, Users, Star, Target } from 'lucide-react';
import { TestDataToggle } from '@/components/TestDataToggle';
import { useTestDataToggle } from '@/hooks/useTestDataToggle';

interface CumulativeDataRow {
  id: string;
  survey_title: string;
  education_year: number;
  education_round: number;
  course_name: string;
  instructor_name: string;
  response_count: number;
  avg_satisfaction: number;
  submitted_at: string;
  status: string;
}

const CumulativeDataTable = () => {
  const { userRoles } = useAuth();
  const testDataOptions = useTestDataToggle();
  const [data, setData] = useState<CumulativeDataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  const [filterCourse, setFilterCourse] = useState('all');
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [availableCourses, setAvailableCourses] = useState<string[]>([]);

  const isAdmin = userRoles.includes('admin');
  const isOperator = userRoles.includes('operator');
  const isDirector = userRoles.includes('director');
  const canViewAll = isAdmin || isOperator || isDirector;

  useEffect(() => {
    fetchData();
    fetchFilterOptions();
  }, [testDataOptions.includeTestData]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('surveys')
        .select(`
          id,
          title,
          education_year,
          education_round,
          course_name,
          status,
          created_at,
          instructor:instructors(name)
        `)
        .not('course_name', 'is', null);

      // 테스트 데이터 필터링
      if (!testDataOptions.includeTestData) {
        query = query.or('is_test.is.null,is_test.eq.false');
      }

      const { data: surveys, error: surveyError } = await query;

      if (surveyError) throw surveyError;

      // 실제 응답 수와 만족도 계산
      const enrichedData: CumulativeDataRow[] = await Promise.all(
        (surveys || []).map(async (survey) => {
          // 응답 수 계산
          const { count: responseCount } = await supabase
            .from('survey_responses')
            .select('*', { count: 'exact', head: true })
            .eq('survey_id', survey.id);

          // 만족도 계산
          let avgSatisfaction = 0;
          if (responseCount && responseCount > 0) {
            const { data: satisfactionData } = await supabase
              .from('question_answers')
              .select(`
                answer_value,
                survey_questions!inner(question_type, satisfaction_type)
              `)
              .eq('survey_questions.survey_id', survey.id)
              .in('survey_questions.question_type', ['rating', 'scale'])
              .not('answer_value', 'is', null);

            if (satisfactionData && satisfactionData.length > 0) {
              const validScores = satisfactionData
                .map(item => {
                  let score = 0;
                  if (item.answer_value) {
                    if (typeof item.answer_value === 'number') {
                      score = item.answer_value;
                    } else if (typeof item.answer_value === 'string') {
                      const parsed = parseFloat(item.answer_value.replace(/"/g, ''));
                      if (!isNaN(parsed)) score = parsed;
                    }
                  }
                  // 5점 척도면 10점으로 변환
                  return score <= 5 ? score * 2 : score;
                })
                .filter(score => score > 0);

              if (validScores.length > 0) {
                avgSatisfaction = validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
              }
            }
          }

          return {
            id: survey.id,
            survey_title: survey.title,
            education_year: survey.education_year,
            education_round: survey.education_round,
            course_name: survey.course_name,
            instructor_name: (survey.instructor as any)?.name || '',
            response_count: responseCount || 0,
            avg_satisfaction: Math.round(avgSatisfaction * 10) / 10, // 소수점 1자리
            submitted_at: survey.created_at,
            status: survey.status,
          };
        })
      );

      setData(enrichedData);
    } catch (error) {
      console.error('Error fetching cumulative data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      let query = supabase
        .from('surveys')
        .select('education_year, course_name')
        .not('course_name', 'is', null);

      // 테스트 데이터 필터링
      if (!testDataOptions.includeTestData) {
        query = query.or('is_test.is.null,is_test.eq.false');
      }

      const { data: surveys } = await query;

      if (surveys) {
        const years = [...new Set(surveys.map(s => s.education_year))].sort((a, b) => b - a);
        const courses = [...new Set(surveys.map(s => s.course_name))].sort();
        
        setAvailableYears(years);
        setAvailableCourses(courses);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const filteredData = data.filter(item => {
    const matchesSearch = !searchTerm || 
      item.survey_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.course_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.instructor_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesYear = filterYear === 'all' || String(item.education_year) === filterYear;
    const matchesCourse = filterCourse === 'all' || item.course_name === filterCourse;
    
    return matchesSearch && matchesYear && matchesCourse;
  });

  const getStatistics = () => {
    const totalResponses = filteredData.reduce((sum, item) => sum + item.response_count, 0);
    const validItems = filteredData.filter(item => item.avg_satisfaction > 0);
    const avgSatisfaction = totalResponses > 0 && validItems.length > 0
      ? validItems.reduce((sum, item) => sum + (item.avg_satisfaction * item.response_count), 0) / totalResponses
      : 0;
    const participatingInstructors = new Set(filteredData.map(item => item.instructor_name)).size;
    const coursesInProgress = new Set(filteredData.map(item => item.course_name)).size;

    return {
      totalResponses,
      avgSatisfaction: totalResponses > 0 ? Math.round(avgSatisfaction * 10) / 10 : 0,
      participatingInstructors,
      coursesInProgress
    };
  };

  const handleExport = () => {
    const headers = [
      '설문 제목',
      '교육 연도',
      '교육 회차',
      '과정명',
      '담당 강사',
      '응답 수',
      '평균 만족도',
      '상태',
      '제출일'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredData.map(item => [
        `"${item.survey_title}"`,
        item.education_year,
        item.education_round,
        `"${item.course_name}"`,
        `"${item.instructor_name}"`,
        item.response_count,
        item.avg_satisfaction,
        `"${item.status}"`,
        `"${new Date(item.submitted_at).toLocaleDateString()}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `누적데이터_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = getStatistics();

  return (
    <div className="space-y-6">
      {/* Test Data Toggle */}
      {testDataOptions.canToggleTestData && (
        <div className="flex justify-end">
          <TestDataToggle testDataOptions={testDataOptions} />
        </div>
      )}

      {/* 필터 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            데이터 필터
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">검색어</label>
              <Input
                placeholder="설문명, 과정명, 강사명 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">연도</label>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger>
                  <SelectValue placeholder="연도 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={String(year)}>{year}년</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">과정</label>
              <Select value={filterCourse} onValueChange={setFilterCourse}>
                <SelectTrigger>
                  <SelectValue placeholder="과정 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {availableCourses.map(course => (
                    <SelectItem key={course} value={course}>{course}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleExport} variant="outline" className="w-full">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                CSV 내보내기
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">총 응답 수</p>
                <p className="text-2xl font-bold">{stats.totalResponses.toLocaleString()}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">평균 만족도</p>
                <p className="text-2xl font-bold">{stats.avgSatisfaction || 0}</p>
              </div>
              <Star className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">참여 강사</p>
                <p className="text-2xl font-bold">{stats.participatingInstructors}</p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">진행 과정</p>
                <p className="text-2xl font-bold">{stats.coursesInProgress}</p>
              </div>
              <Target className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 누적 데이터 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>누적 데이터 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p>데이터를 불러오는 중...</p>
              </div>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>조건에 맞는 데이터가 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">설문 제목</th>
                    <th className="text-left p-2">연도/회차</th>
                    <th className="text-left p-2">과정명</th>
                    <th className="text-left p-2">담당 강사</th>
                    <th className="text-left p-2">응답 수</th>
                    <th className="text-left p-2">평균 만족도</th>
                    <th className="text-left p-2">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-2">{item.survey_title}</td>
                      <td className="p-2">{item.education_year}년 {item.education_round}차</td>
                      <td className="p-2">{item.course_name}</td>
                      <td className="p-2">{item.instructor_name}</td>
                      <td className="p-2">
                        <Badge variant={item.response_count > 0 ? "default" : "secondary"}>
                          {item.response_count}명
                        </Badge>
                      </td>
                      <td className="p-2">
                        {item.avg_satisfaction > 0 ? (
                          <Badge 
                            variant={item.avg_satisfaction >= 8 ? "default" : item.avg_satisfaction >= 6 ? "secondary" : "destructive"}
                          >
                            {item.avg_satisfaction}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-2">
                        <Badge variant={item.status === 'completed' ? "default" : "outline"}>
                          {item.status === 'completed' ? '완료' : item.status === 'active' ? '진행중' : '준비중'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CumulativeDataTable;