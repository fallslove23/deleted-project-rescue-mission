import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layouts';
import { Mail, CheckCircle, XCircle, Clock, RefreshCw, Clipboard, Download, ListChecks } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDateTime, formatMessage, formatNumber, MESSAGE_KEYS } from '@/utils/formatters';

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

interface SurveyDetails {
  id: string;
  title: string;
  education_year: number | null;
  education_round: number | null;
}

const DashboardEmailLogs = () => {
  const { userRoles } = useAuth();
  const { toast } = useToast();
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowlistOpen, setAllowlistOpen] = useState(false);
  const [allowlistLoading, setAllowlistLoading] = useState(false);
  const [allowlistEmails, setAllowlistEmails] = useState<string[]>([]);
  const [surveyDetails, setSurveyDetails] = useState<Record<string, SurveyDetails>>({});

  const canViewLogs = userRoles.includes('admin') || userRoles.includes('operator');

  const fetchSurveyDetails = async (logs: EmailLog[]) => {
    const surveyIds = Array.from(
      new Set(
        logs
          .map((log) => log.survey_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    if (surveyIds.length === 0) {
      setSurveyDetails({});
      return;
    }

    try {
      const { data, error } = await supabase
        .from('surveys')
        .select('id, title, education_year, education_round')
        .in('id', surveyIds);

      if (error) throw error;

      const details = (data || []).reduce<Record<string, SurveyDetails>>((acc, survey) => {
        acc[survey.id] = {
          id: survey.id,
          title: survey.title,
          education_year: survey.education_year ?? null,
          education_round: survey.education_round ?? null,
        };
        return acc;
      }, {});

      setSurveyDetails(details);
    } catch (error) {
      console.error('Error fetching survey details:', error);
    }
  };

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
      const normalizedLogs = (data || []) as EmailLog[];
      setEmailLogs(normalizedLogs);
      await fetchSurveyDetails(normalizedLogs);
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

  const fetchAllowlistEmails = async () => {
    try {
      setAllowlistLoading(true);
      // 병렬로 수집: 강사 이메일 + 역할 기반 프로필 이메일 + 최근 로그 수신자
      const [instructorsRes, rolesRes] = await Promise.all([
        supabase.from('instructors').select('email').not('email', 'is', null),
        supabase.from('user_roles').select('user_id, role').in('role', ['admin','operator','director','instructor'] as any)
      ]);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const set = new Set<string>();

      instructorsRes.data?.forEach((i: any) => {
        if (i?.email && emailRegex.test(i.email)) set.add(i.email.toLowerCase());
      });

      const ids = Array.from(new Set((rolesRes.data || []).map((r: any) => r.user_id)));
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id,email').in('id', ids);
        profiles?.forEach((p: any) => {
          if (p?.email && emailRegex.test(p.email)) set.add(p.email.toLowerCase());
        });
      }

      // 최근 이메일 로그에 있는 수신자까지 포함
      emailLogs.forEach((log) => (log.recipients || []).forEach((e) => {
        if (e && emailRegex.test(e)) set.add(String(e).toLowerCase());
      }));

      const list = Array.from(set).sort();
      setAllowlistEmails(list);
      setAllowlistOpen(true);
      toast({ title: '허용 목록 추출 완료', description: `${list.length}개의 이메일이 수집되었습니다.` });
    } catch (err) {
      console.error('allowlist build error', err);
      toast({ title: '오류', description: '허용 목록용 이메일을 수집하지 못했습니다.', variant: 'destructive' });
    } finally {
      setAllowlistLoading(false);
    }
  };

  const copyAllowlist = async () => {
    await navigator.clipboard.writeText(allowlistEmails.join(', '));
    toast({ title: '복사 완료', description: '이메일이 클립보드에 복사되었습니다.' });
  };

  const downloadAllowlistCsv = () => {
    const blob = new Blob([allowlistEmails.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resend-allowlist-emails.csv';
    a.click();
    URL.revokeObjectURL(url);
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

  const getSurveyInfo = (surveyId: string) => {
    const info = surveyDetails[surveyId];

    if (!info) {
      return {
        title: '설문 정보 없음',
        meta: undefined,
      };
    }

    const segments: string[] = [];
    if (info.education_year) {
      segments.push(`${info.education_year}년`);
    }
    if (info.education_round) {
      segments.push(`${info.education_round}차`);
    }

    return {
      title: info.title,
      meta: segments.length > 0 ? segments.join(' ') : undefined,
    };
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
        </Button>,
        <Button key="allowlist" onClick={fetchAllowlistEmails} variant="default" size="sm" disabled={allowlistLoading}>
          <ListChecks className="h-4 w-4 mr-2" />
          허용목록용 이메일 추출
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
                        <div className="text-muted-foreground">{formatMessage(MESSAGE_KEYS.common.noEmailLogs)}</div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    emailLogs.map((log) => {
                      const surveyInfo = getSurveyInfo(log.survey_id);

                      return (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium min-w-[220px]">
                            <div className="flex flex-col gap-1">
                              <span>{surveyInfo.title}</span>
                              {surveyInfo.meta && (
                                <span className="text-xs text-muted-foreground">
                                  {surveyInfo.meta}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground break-all">
                                ID: {log.survey_id}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {formatMessage(MESSAGE_KEYS.email.logs.recipientCount, {
                              count: formatNumber(log.recipients?.length || 0),
                            })}
                          </TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <span className="text-green-600">
                                {formatMessage(MESSAGE_KEYS.email.logs.successCount, {
                                  count: formatNumber(log.sent_count || 0),
                                })}
                              </span>
                              {log.failed_count > 0 && (
                                <>
                                  {' '}/{' '}
                                  <span className="text-red-600">
                                    {formatMessage(MESSAGE_KEYS.email.logs.failureCount, {
                                      count: formatNumber(log.failed_count),
                                    })}
                                  </span>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDateTime(log.created_at)}
                          </TableCell>
                        </TableRow>
                      );
                     })
                   )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={allowlistOpen} onOpenChange={setAllowlistOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Resend 허용 목록용 이메일</DialogTitle>
            <DialogDescription>
              onboarding@resend.dev 사용 시, 아래 이메일을 Resend &gt; Settings &gt; Test Emails에 추가해야 발송됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between py-2">
            <div className="text-sm text-muted-foreground">
              {formatMessage(MESSAGE_KEYS.common.allowlistTotal, {
                count: formatNumber(allowlistEmails.length),
              })}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyAllowlist} disabled={allowlistEmails.length === 0}>
                <Clipboard className="h-4 w-4 mr-1" /> 복사
              </Button>
              <Button size="sm" variant="secondary" onClick={downloadAllowlistCsv} disabled={allowlistEmails.length === 0}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            </div>
          </div>

          <ScrollArea className="h-72 rounded-md border p-3">
            <pre className="whitespace-pre-wrap text-sm leading-6">{allowlistEmails.join('\n')}</pre>
          </ScrollArea>

          <div className="text-xs text-muted-foreground pt-2">
            참고: Resend Test Emails는 도메인 검증 없이 허용 목록에 추가된 주소만 수신 가능합니다.
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default DashboardEmailLogs;
