import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { DataTable } from '@/components/data-table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Database, BarChart } from 'lucide-react';
import { SidebarProvider } from '@/components/ui/sidebar';
import AdminLayout from '@/components/layouts/AdminLayout';

interface CumulativeData {
  survey_id: string;
  survey_title: string;
  education_year: number;
  education_round: number;
  course_name: string;
  instructor_name: string;
  total_responses: number;
  avg_satisfaction: number;
  completion_rate: number;
  created_at: string;
  status: string;
}

const CumulativeDataTable = () => {
  const { userRoles, user, signOut } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<CumulativeData[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = userRoles.includes('admin');
  const isOperator = userRoles.includes('operator');
  const isDirector = userRoles.includes('director');
  const canViewAll = isAdmin || isOperator || isDirector;

  useEffect(() => {
    if (canViewAll) {
      fetchCumulativeData();
    }
  }, [canViewAll]);

  const fetchCumulativeData = async () => {
    try {
      setLoading(true);
      
      // 설문 기본 정보와 통계를 한 번에 조회 (성능 최적화)
      const { data: surveysData, error: surveysError } = await supabase
        .from('surveys')
        .select(`
          id,
          title,
          education_year,
          education_round,
          course_name,
          status,
          created_at,
          instructors (name),
          survey_responses (
            id,
            survey_id
          )
        `)
        .order('education_year', { ascending: false })
        .order('education_round', { ascending: false })
        .limit(500); // 확장성을 위한 제한

      if (surveysError) throw surveysError;

      // 각 설문의 만족도 점수 계산
      const cumulativeData: CumulativeData[] = [];
      
      for (const survey of surveysData || []) {
        const responseCount = survey.survey_responses?.length || 0;
        
        // 만족도 점수 계산 (rating/scale 질문만)
        let avgSatisfaction = 0;
        if (responseCount > 0) {
          const { data: satisfactionData } = await supabase
            .from('question_answers')
            .select(`
              answer_value,
              survey_questions!inner (
                question_type,
                satisfaction_type
              )
            `)
            .in('response_id', survey.survey_responses.map(r => r.id))
            .in('survey_questions.question_type', ['rating', 'scale']);

          if (satisfactionData && satisfactionData.length > 0) {
            const scores = satisfactionData
              .map(a => {
                const value = typeof a.answer_value === 'number' ? a.answer_value : 
                             typeof a.answer_value === 'string' ? Number(a.answer_value) : 0;
                return value <= 5 ? value * 2 : value; // 5점 척도를 10점으로 변환
              })
              .filter(score => score > 0);
            
            avgSatisfaction = scores.length > 0 
              ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
              : 0;
          }
        }

        cumulativeData.push({
          survey_id: survey.id,
          survey_title: survey.title,
          education_year: survey.education_year,
          education_round: survey.education_round,
          course_name: survey.course_name || '미지정',
          instructor_name: survey.instructors?.name || '미지정',
          total_responses: responseCount,
          avg_satisfaction: Math.round(avgSatisfaction * 10) / 10,
          completion_rate: 0, // 완료율은 별도 계산 필요
          created_at: survey.created_at,
          status: survey.status
        });
      }

      setData(cumulativeData);
    } catch (error) {
      console.error('Error fetching cumulative data:', error);
      toast({
        title: "오류",
        description: "누적 데이터를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportData = () => {
    try {
      const csvContent = generateCSV();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `누적_설문데이터_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "성공",
        description: "누적 데이터가 CSV 파일로 다운로드되었습니다."
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "오류",
        description: "내보내기 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const generateCSV = () => {
    let csvContent = '\uFEFF'; // BOM for Excel
    
    // 헤더
    csvContent += '설문ID,설문제목,교육연도,교육차수,과정명,강사명,총응답수,평균만족도,상태,생성일\n';
    
    // 데이터
    data.forEach(row => {
      csvContent += `"${row.survey_id}","${row.survey_title}",${row.education_year},${row.education_round},"${row.course_name}","${row.instructor_name}",${row.total_responses},${row.avg_satisfaction},"${row.status}","${new Date(row.created_at).toLocaleDateString()}"\n`;
    });
    
    return csvContent;
  };

  const columns = [
    {
      key: 'survey_title',
      label: '설문명',
      sortable: true,
      filterable: false,
      render: (value: string, row: CumulativeData) => (
        <div className="max-w-xs">
          <div className="font-medium truncate">{value}</div>
          <div className="text-xs text-muted-foreground">
            {row.education_year}년 {row.education_round}차
          </div>
        </div>
      )
    },
    {
      key: 'course_name',
      label: '과정명',
      sortable: true,
      filterable: true,
      render: (value: string) => (
        <div className="max-w-32 truncate" title={value}>
          {value}
        </div>
      )
    },
    {
      key: 'instructor_name',
      label: '강사명',
      sortable: true,
      filterable: true
    },
    {
      key: 'total_responses',
      label: '응답수',
      sortable: true,
      render: (value: number) => (
        <div className="text-center font-mono">
          {value.toLocaleString()}
        </div>
      )
    },
    {
      key: 'avg_satisfaction',
      label: '평균만족도',
      sortable: true,
      render: (value: number) => (
        <div className="text-center">
          <div className="font-mono">{value.toFixed(1)}점</div>
          <div className="text-xs text-muted-foreground">
            {Math.round(value * 10)}%
          </div>
        </div>
      )
    },
    {
      key: 'status',
      label: '상태',
      sortable: true,
      filterable: true,
      render: (value: string) => (
        <Badge variant={
          value === 'completed' ? 'default' : 
          value === 'active' ? 'secondary' : 
          'outline'
        }>
          {value === 'completed' ? '완료' : 
           value === 'active' ? '진행중' : 
           value === 'draft' ? '초안' : value}
        </Badge>
      )
    },
    {
      key: 'created_at',
      label: '생성일',
      sortable: true,
      render: (value: string) => (
        <div className="text-sm">
          {new Date(value).toLocaleDateString()}
        </div>
      )
    }
  ];

  if (!canViewAll) {
    return (
      <SidebarProvider>
        <AdminLayout title="누적 데이터" description="전체 설문 데이터 조회">
          <Card>
            <CardContent className="py-8 text-center">
              <div className="text-muted-foreground">
                이 기능을 사용하려면 관리자 권한이 필요합니다.
              </div>
            </CardContent>
          </Card>
        </AdminLayout>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AdminLayout 
        title="누적 데이터" 
        description="전체 설문 데이터 조회"
        actions={
          <Button onClick={exportToCSV} disabled={data.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            CSV 다운로드
          </Button>
        }
      >
        <div className="container mx-auto px-4 py-6 space-y-6">
            <div className="container mx-auto px-4 py-3 md:py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div className="h-10 w-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-neon">
                  <Database className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-base md:text-2xl font-bold bg-gradient-accent bg-clip-text text-transparent">누적 데이터</h1>
                  <p className="text-xs md:text-sm text-muted-foreground">전체 설문 데이터 조회 및 분석</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs md:text-sm hidden sm:block">환영합니다, {user?.email}</span>
                <Button onClick={signOut} variant="outline" size="sm">로그아웃</Button>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 container mx-auto px-4 py-6">
            {loading ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <div className="text-muted-foreground">
                    데이터를 불러오는 중...
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* 요약 통계 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold">{data.length}</div>
                      <div className="text-sm text-muted-foreground">총 설문수</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold">
                        {data.reduce((sum, d) => sum + d.total_responses, 0).toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">총 응답수</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold">
                        {data.length > 0 
                          ? (data.reduce((sum, d) => sum + d.avg_satisfaction, 0) / data.length).toFixed(1)
                          : '0.0'
                        }
                      </div>
                      <div className="text-sm text-muted-foreground">전체 평균만족도</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold">
                        {[...new Set(data.map(d => d.course_name))].length}
                      </div>
                      <div className="text-sm text-muted-foreground">총 과정수</div>
                    </CardContent>
                  </Card>
                </div>

                {/* 데이터 테이블 */}
                <DataTable
                  title="전체 누적 설문 데이터"
                  data={data}
                  columns={columns}
                  searchable={true}
                  exportable={true}
                  pageSize={25}
                  onExport={exportData}
                />
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </SidebarProvider>
  );
};

export default CumulativeDataTable;
