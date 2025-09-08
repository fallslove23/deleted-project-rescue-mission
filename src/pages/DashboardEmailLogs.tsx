import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layouts';
import { Mail, CheckCircle, XCircle, Clock, RefreshCw, Eye, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EmailLog {
  id: string;
  survey_id: string;
  recipients: string[];
  status: string;
  sent_count: number;
  failed_count: number;
  results: any;
  created_at: string;
}

const DashboardEmailLogs = () => {
  const { userRoles } = useAuth();
  const { toast } = useToast();
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  const canViewLogs = userRoles.includes('admin') || userRoles.includes('operator');

  const fetchEmailLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_logs')
        .select(`
          id,
          survey_id,
          recipients,
          status,
          sent_count,
          failed_count,
          results,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setEmailLogs(data || []);
    } catch (error) {
      console.error('Error fetching email logs:', error);
      toast({
        title: "오류",
        description: "이메일 로그를 불러오는데 실패했습니다.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canViewLogs) {
      fetchEmailLogs();
    }
  }, [canViewLogs]);

  if (!canViewLogs) {
    return (
      <DashboardLayout
        title="이메일 로그"
        subtitle="이메일 발송 이력 및 상태 확인"
        icon={<Mail className="h-5 w-5 text-white" />}
      >
        <div className="flex items-center justify-center py-8">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">접근 권한 없음</h3>
              <p className="text-muted-foreground">이메일 로그를 조회할 권한이 없습니다.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const totalStats = {
    totalLogs: emailLogs.length,
    successCount: emailLogs.filter(log => log.status === 'success').length,
    failedCount: emailLogs.filter(log => log.status === 'failed').length,
    pendingCount: emailLogs.filter(log => log.status === 'pending').length
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800">성공</Badge>;
      case 'failed':
        return <Badge variant="destructive">실패</Badge>;
      case 'pending':
        return <Badge variant="secondary">대기</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout
      title="이메일 로그"
      subtitle="이메일 발송 이력 및 상태 확인"
      icon={<Mail className="h-5 w-5 text-white" />}
      loading={loading}
      actions={[
        <Button key="refresh" onClick={fetchEmailLogs} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      ]}
    >
      <div className="space-y-6">
        {/* 통계 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Mail className="h-4 w-4 text-blue-600" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">총 발송 기록</p>
                  <div className="text-2xl font-bold">{totalStats.totalLogs}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">총 성공 발송</p>
                  <div className="text-2xl font-bold">{totalStats.successCount}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <XCircle className="h-4 w-4 text-red-600" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">총 실패 건수</p>
                  <div className="text-2xl font-bold">{totalStats.failedCount}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Clock className="h-4 w-4 text-yellow-600" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">성공률</p>
                  <div className="text-2xl font-bold">
                    {totalStats.totalLogs > 0 ? Math.round((totalStats.successCount / totalStats.totalLogs) * 100) : 0}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 이메일 로그 테이블 */}
        <Card>
          <CardHeader>
            <CardTitle>설문 결과 이메일 발송 기록 및 통계</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>설문 제목</TableHead>
                    <TableHead>수신자 수</TableHead>
                    <TableHead>발송 상태</TableHead>
                    <TableHead>성공/실패</TableHead>
                    <TableHead>발송 시간</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <div className="text-muted-foreground">이메일 발송 기록이 없습니다.</div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    emailLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          설문 ID: {log.survey_id}
                        </TableCell>
                        <TableCell>{log.recipients?.length || 0}명</TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="text-green-600">{log.sent_count || 0}건 성공</span>
                            {log.failed_count > 0 && (
                              <> / <span className="text-red-600">{log.failed_count}건 실패</span></>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(log.created_at).toLocaleString('ko-KR')}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DashboardEmailLogs;
