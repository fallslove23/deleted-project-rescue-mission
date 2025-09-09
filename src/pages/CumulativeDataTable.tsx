import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, Filter, Calendar, User, BookOpen } from 'lucide-react';
import { useTestDataToggle } from '@/hooks/useTestDataToggle';
import { TestDataToggle } from '@/components/TestDataToggle';

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
      
      const { data: surveys, error: surveyError } = await supabase
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

      if (surveyError) throw surveyError;

      const enrichedData: CumulativeDataRow[] = (surveys || []).map(survey => ({
        id: survey.id,
        survey_title: survey.title,
        education_year: survey.education_year,
        education_round: survey.education_round,
        course_name: survey.course_name,
        instructor_name: (survey.instructor as any)?.name || '미지정',
        response_count: 0, // 임시값
        avg_satisfaction: 0, // 임시값
        submitted_at: survey.created_at,
        status: survey.status,
      }));

      setData(enrichedData);
    } catch (error) {
      console.error('Error fetching cumulative data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const { data: surveys } = await supabase
        .from('surveys')
        .select('education_year, course_name')
        .not('course_name', 'is', null);

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
    const avgSatisfaction = filteredData.length > 0 
      ? filteredData.reduce((sum, item) => sum + (item.avg_satisfaction * item.response_count), 0) / totalResponses
      : 0;
    const participatingInstructors = new Set(filteredData.map(item => item.instructor_name)).size;
    const coursesInProgress = new Set(filteredData.map(item => item.course_name)).size;

    return {
      totalResponses,
      avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
      participatingInstructors,
      coursesInProgress,
    };
  };

  const handleExport = () => {
    // CSV 내보내기 로직
    const headers = ['설문명', '연도', '회차', '과정명', '강사명', '응답수', '평균만족도', '상태'];
    const csvData = filteredData.map(item => [
      item.survey_title,
      item.education_year,
      item.education_round,
      item.course_name,
      item.instructor_name,
      item.response_count,
      item.avg_satisfaction,
      item.status,
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cumulative_data_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const stats = getStatistics();

  return (
    <div className="space-y-6">
      {/* Test Data Toggle */}
      {canViewAll && (
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
              <Button onClick={handleExport} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                CSV 내보내기
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 통계 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">총 응답 수</p>
                <p className="text-2xl font-bold">{stats.totalResponses.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">평균 만족도</p>
                <p className="text-2xl font-bold">{stats.avgSatisfaction}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-green-600 font-bold text-xl">★</span>
              </div>
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
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <User className="h-6 w-6 text-purple-600" />
              </div>
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
              <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 데이터 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>누적 데이터 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="p-4 text-left font-medium">설문명</th>
                    <th className="p-4 text-left font-medium">연도</th>
                    <th className="p-4 text-left font-medium">회차</th>
                    <th className="p-4 text-left font-medium">과정명</th>
                    <th className="p-4 text-left font-medium">강사명</th>
                    <th className="p-4 text-left font-medium">응답수</th>
                    <th className="p-4 text-left font-medium">평균만족도</th>
                    <th className="p-4 text-left font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        데이터를 불러오는 중...
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        데이터가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-muted/50">
                        <td className="p-4 font-medium">{item.survey_title}</td>
                        <td className="p-4">{item.education_year}</td>
                        <td className="p-4">{item.education_round}</td>
                        <td className="p-4">{item.course_name}</td>
                        <td className="p-4">{item.instructor_name}</td>
                        <td className="p-4">
                          <Badge variant="outline">{item.response_count}</Badge>
                        </td>
                        <td className="p-4">
                          <Badge 
                            variant={
                              item.avg_satisfaction >= 8 
                                ? 'default' 
                                : item.avg_satisfaction >= 6 
                                  ? 'secondary' 
                                  : 'destructive'
                            }
                          >
                            {item.avg_satisfaction.toFixed(1)}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge 
                            variant={
                              item.status === 'completed' 
                                ? 'default' 
                                : item.status === 'active' 
                                  ? 'secondary' 
                                  : 'outline'
                            }
                          >
                            {item.status === 'completed' ? '완료' : item.status === 'active' ? '진행중' : '초안'}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CumulativeDataTable;