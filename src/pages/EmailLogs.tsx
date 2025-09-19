import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, LineChart, Line, Legend } from 'recharts';
import { Mail, CheckCircle, XCircle, Clock, Calendar as CalendarIcon, Filter, TrendingUp, RefreshCw, Eye, Menu, BarChart3 } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { formatDate, formatDateTime, formatMessage, formatNumber, formatPercent, MESSAGE_KEYS } from '@/utils/formatters';


interface EmailLog {
  id: string;
  survey_id: string;
  recipients: string[];
  status: string;
  sent_count: number;
  failed_count: number;
  results: any;
  error: string;
  created_at: string;
}

interface Survey {
  id: string;
  title: string;
  education_year: number;
  education_round: number;
}

const EmailLogs = () => {
  const { userRoles } = useAuth();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSurvey, setSelectedSurvey] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<Date | undefined>(new Date());
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const { toast } = useToast();

  const isAdmin = userRoles.includes('admin');
  const isOperator = userRoles.includes('operator');
  const isDirector = userRoles.includes('director');
  const canViewLogs = isAdmin || isOperator || isDirector;

  const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#8b5cf6'];

  useEffect(() => {
    if (canViewLogs) {
      fetchEmailLogs();
      fetchSurveys();
    }
  }, [canViewLogs]);

  const fetchEmailLogs = async () => {
    try {
      setLoading(true);

      // 실제 이메일 로그를 DB에서 조회 (RLS: admin/operator/director만 허용)
      const { data, error } = await supabase.rpc('get_email_logs');
      if (error) throw error;

      const rows = (data || []) as any[];
      const normalized: EmailLog[] = rows.map((row) => ({
        id: row.id,
        survey_id: row.survey_id,
        recipients: Array.isArray(row.recipients) ? (row.recipients as string[]) : [],
        status: row.status,
        sent_count: row.sent_count ?? 0,
        failed_count: row.failed_count ?? 0,
        results: row.results ?? null,
        error: row.error ?? '',
        created_at: row.created_at,
      }));

      setLogs(normalized);
    } catch (error) {
      console.error('Error fetching email logs:', error);
      toast({
        title: formatMessage(MESSAGE_KEYS.email.logs.toast.errorTitle),
        description: formatMessage(MESSAGE_KEYS.email.logs.toast.errorDescription),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSurveys = async () => {
    try {
      const { data, error } = await supabase
        .from('surveys')
        .select('id, title, education_year, education_round')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSurveys(data || []);
    } catch (error) {
      console.error('Error fetching surveys:', error);
    }
  };

  const getFilteredLogs = () => {
    let filtered = logs;

    if (selectedSurvey && selectedSurvey !== 'all') {
      filtered = filtered.filter(log => log.survey_id === selectedSurvey);
    }

    if (selectedStatus && selectedStatus !== 'all') {
      filtered = filtered.filter(log => log.status === selectedStatus);
    }

    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.recipients.some(email => email.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (dateRange) {
      const monthStart = startOfMonth(dateRange);
      const monthEnd = endOfMonth(dateRange);
      filtered = filtered.filter(log => {
        const logDate = new Date(log.created_at);
        return logDate >= monthStart && logDate <= monthEnd;
      });
    }

    return filtered;
  };

  const getStatusStats = () => {
    const filtered = getFilteredLogs();
    const statusCounts = filtered.reduce(
      (acc, log) => {
        if (log.status === 'success') acc.success += 1;
        else if (log.status === 'failed') acc.failed += 1;
        else if (log.status === 'partial') acc.partial += 1;
        return acc;
      },
      { success: 0, failed: 0, partial: 0 }
    );

    const total = statusCounts.success + statusCounts.failed + statusCounts.partial;

    return [
      { key: 'success', value: statusCounts.success, color: '#10b981' },
      { key: 'failed', value: statusCounts.failed, color: '#ef4444' },
      { key: 'partial', value: statusCounts.partial, color: '#f59e0b' }
    ].map(item => ({
      ...item,
      name: formatMessage(MESSAGE_KEYS.email.logs.status[item.key as 'success' | 'failed' | 'partial']),
      percentage: total > 0 ? item.value / total : 0
    }));
  };

  const getMonthlyStats = () => {
    const monthKeys: string[] = [];
    const monthlyTotals: Record<string, { sent: number; failed: number; total: number }> = {};

    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const key = formatDate(date, { pattern: 'yyyy-MM' });
      if (!key) continue;
      monthKeys.push(key);
      monthlyTotals[key] = { sent: 0, failed: 0, total: 0 };
    }

    logs.forEach(log => {
      const key = formatDate(new Date(log.created_at), { pattern: 'yyyy-MM' });
      if (key && monthlyTotals[key]) {
        monthlyTotals[key].sent += log.sent_count;
        monthlyTotals[key].failed += log.failed_count;
        monthlyTotals[key].total += 1;
      }
    });

    return monthKeys.map(month => ({
      month: formatDate(new Date(`${month}-01`), { pattern: 'MM월' }) || month,
      ...monthlyTotals[month]
    }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            {formatMessage(MESSAGE_KEYS.email.logs.status.success)}
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            {formatMessage(MESSAGE_KEYS.email.logs.status.failed)}
          </Badge>
        );
      case 'partial':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            {formatMessage(MESSAGE_KEYS.email.logs.status.partial)}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getSurveyTitle = (surveyId: string) => {
    const survey = surveys.find(s => s.id === surveyId);
    if (!survey) {
      return formatMessage(MESSAGE_KEYS.email.logs.noSurveyInfo);
    }

    if (survey.education_year && survey.education_round) {
      return formatMessage(MESSAGE_KEYS.email.logs.surveyWithRound, {
        title: survey.title,
        year: formatNumber(survey.education_year),
        round: formatNumber(survey.education_round)
      });
    }

    return survey.title;
  };

  const totalStats = {
    totalLogs: logs.length,
    totalSent: logs.reduce((sum, log) => sum + log.sent_count, 0),
    totalFailed: logs.reduce((sum, log) => sum + log.failed_count, 0),
    successRate: logs.length > 0 ? logs.filter(log => log.status === 'success').length / logs.length : 0
  };

  // 데스크톱 액션 버튼들
  const DesktopActions = () => (
    <Button onClick={fetchEmailLogs} disabled={loading}>
      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
      {formatMessage(MESSAGE_KEYS.common.refresh)}
    </Button>
  );

  // 모바일 액션 버튼들  
  const MobileActions = () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{formatMessage(MESSAGE_KEYS.email.logs.menuTitle)}</SheetTitle>
        </SheetHeader>
        <div className="py-4 space-y-4">
          <Button
            className="w-full justify-start"
            onClick={fetchEmailLogs}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {formatMessage(MESSAGE_KEYS.common.refresh)}
          </Button>

          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span>
                {formatMessage(MESSAGE_KEYS.email.logs.menuSummaryTotal, {
                  count: formatMessage(MESSAGE_KEYS.common.countWithUnit, {
                    count: formatNumber(totalStats.totalLogs),
                    unit: formatMessage(MESSAGE_KEYS.common.units.case)
                  })
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span>
                {formatMessage(MESSAGE_KEYS.email.logs.menuSummaryRate, {
                  percentage: formatPercent(totalStats.successRate, { maximumFractionDigits: 0 })
                })}
              </span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  if (!canViewLogs) {
    return (
      <div className="flex items-center justify-center py-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">{formatMessage(MESSAGE_KEYS.common.accessDenied)}</h3>
            <p className="text-muted-foreground">{formatMessage(MESSAGE_KEYS.email.logs.noPermissionDescription)}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 액션 버튼들 */}
      <div className="flex justify-end gap-2 mb-4">
        <DesktopActions />
      </div>
      <div className="space-y-6">
        {/* 통계 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Mail className="h-4 w-4 text-blue-600" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {formatMessage(MESSAGE_KEYS.email.logs.totalRecords)}
                  </p>
                  <div className="text-2xl font-bold">{formatNumber(totalStats.totalLogs)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {formatMessage(MESSAGE_KEYS.email.logs.totalSuccess)}
                  </p>
                  <div className="text-2xl font-bold text-green-600">{formatNumber(totalStats.totalSent)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <XCircle className="h-4 w-4 text-red-600" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {formatMessage(MESSAGE_KEYS.email.logs.totalFailure)}
                  </p>
                  <div className="text-2xl font-bold text-red-600">{formatNumber(totalStats.totalFailed)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {formatMessage(MESSAGE_KEYS.email.logs.successRate)}
                  </p>
                  <div className="text-2xl font-bold text-purple-600">
                    {formatPercent(totalStats.successRate, { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 차트 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{formatMessage(MESSAGE_KEYS.email.logs.statusDistribution)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getStatusStats()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value, percent }) =>
                        `${name}: ${formatNumber(value)} (${formatPercent(percent, { maximumFractionDigits: 0 })})`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {getStatusStats().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{formatMessage(MESSAGE_KEYS.email.logs.monthlyStats)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getMonthlyStats()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="sent"
                      stroke="#10b981"
                      name={formatMessage(MESSAGE_KEYS.email.logs.status.success)}
                    />
                    <Line
                      type="monotone"
                      dataKey="failed"
                      stroke="#ef4444"
                      name={formatMessage(MESSAGE_KEYS.email.logs.status.failed)}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 필터 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              {formatMessage(MESSAGE_KEYS.email.logs.filterTitle)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {formatMessage(MESSAGE_KEYS.email.logs.filterSurveyLabel)}
                </label>
                <Select value={selectedSurvey} onValueChange={setSelectedSurvey}>
                  <SelectTrigger>
                    <SelectValue placeholder={formatMessage(MESSAGE_KEYS.email.logs.filterSurveyAll)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {formatMessage(MESSAGE_KEYS.email.logs.filterSurveyAll)}
                    </SelectItem>
                    {surveys.map(survey => (
                      <SelectItem key={survey.id} value={survey.id}>
                        {getSurveyTitle(survey.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  {formatMessage(MESSAGE_KEYS.email.logs.filterStatusLabel)}
                </label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder={formatMessage(MESSAGE_KEYS.email.logs.filterStatusAll)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {formatMessage(MESSAGE_KEYS.email.logs.filterStatusAll)}
                    </SelectItem>
                    <SelectItem value="success">
                      {formatMessage(MESSAGE_KEYS.email.logs.status.success)}
                    </SelectItem>
                    <SelectItem value="failed">
                      {formatMessage(MESSAGE_KEYS.email.logs.status.failed)}
                    </SelectItem>
                    <SelectItem value="partial">
                      {formatMessage(MESSAGE_KEYS.email.logs.status.partial)}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  {formatMessage(MESSAGE_KEYS.email.logs.filterPeriodLabel)}
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange
                        ? formatDate(dateRange, { pattern: 'yyyy년 MM월' })
                        : formatMessage(MESSAGE_KEYS.email.logs.filterPeriodAll)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateRange}
                      onSelect={setDateRange}
                      disabled={(date) => date > new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  {formatMessage(MESSAGE_KEYS.email.logs.searchLabel)}
                </label>
                <Input
                  placeholder={formatMessage(MESSAGE_KEYS.email.logs.searchPlaceholder)}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 로그 테이블 */}
        <Card>
          <CardHeader>
            <CardTitle>
              {formatMessage(MESSAGE_KEYS.email.logs.tableTitle, {
                count: formatMessage(MESSAGE_KEYS.common.countWithUnit, {
                  count: formatNumber(getFilteredLogs().length),
                  unit: formatMessage(MESSAGE_KEYS.common.units.case)
                })
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{formatMessage(MESSAGE_KEYS.email.logs.table.survey)}</TableHead>
                    <TableHead>{formatMessage(MESSAGE_KEYS.email.logs.table.status)}</TableHead>
                    <TableHead>{formatMessage(MESSAGE_KEYS.email.logs.table.recipients)}</TableHead>
                    <TableHead>{formatMessage(MESSAGE_KEYS.email.logs.table.result)}</TableHead>
                    <TableHead>{formatMessage(MESSAGE_KEYS.email.logs.table.sentAt)}</TableHead>
                    <TableHead>{formatMessage(MESSAGE_KEYS.email.logs.table.details)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        {formatMessage(MESSAGE_KEYS.common.loading)}
                      </TableCell>
                    </TableRow>
                  ) : getFilteredLogs().length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {formatMessage(MESSAGE_KEYS.email.logs.empty)}
                      </TableCell>
                    </TableRow>
                  ) : (
                    getFilteredLogs().map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="max-w-xs">
                          <div className="truncate">{getSurveyTitle(log.survey_id)}</div>
                        </TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell className="max-w-xs">
                          <div className="space-y-1">
                            {log.recipients.length > 0 ? (
                              <>
                                <div className="text-sm font-medium">
                                  {formatMessage(MESSAGE_KEYS.common.countWithUnit, {
                                    count: formatNumber(log.recipients.length),
                                    unit: formatMessage(MESSAGE_KEYS.common.units.person)
                                  })}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {log.recipients.slice(0, 2).join(', ')}
                                  {log.recipients.length > 2 &&
                                    ` ${formatMessage(MESSAGE_KEYS.email.logs.additionalRecipients, {
                                      count: formatMessage(MESSAGE_KEYS.common.countWithUnit, {
                                        count: formatNumber(log.recipients.length - 2),
                                        unit: formatMessage(MESSAGE_KEYS.common.units.person)
                                      })
                                    })}`}
                                </div>
                              </>
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                {formatMessage(MESSAGE_KEYS.common.none)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="text-green-600 font-medium">{formatNumber(log.sent_count)}</span>
                            {log.failed_count > 0 && (
                              <>
                                <span className="text-muted-foreground"> / </span>
                                <span className="text-red-600 font-medium">{formatNumber(log.failed_count)}</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatDateTime(log.created_at, { pattern: 'yyyy-MM-dd HH:mm' })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setSelectedLog(log)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>{formatMessage(MESSAGE_KEYS.email.logs.dialogTitle)}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <h4 className="font-medium mb-2">
                                    {formatMessage(MESSAGE_KEYS.email.logs.basicInfo)}
                                  </h4>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">
                                        {formatMessage(MESSAGE_KEYS.email.logs.field.survey)}:
                                      </span>
                                      <div>{getSurveyTitle(log.survey_id)}</div>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">
                                        {formatMessage(MESSAGE_KEYS.email.logs.field.status)}:
                                      </span>
                                      <div>{getStatusBadge(log.status)}</div>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">
                                        {formatMessage(MESSAGE_KEYS.email.logs.field.sentAt)}:
                                      </span>
                                      <div>{formatDateTime(log.created_at, { pattern: 'yyyy-MM-dd HH:mm:ss' })}</div>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">
                                        {formatMessage(MESSAGE_KEYS.email.logs.field.result)}:
                                      </span>
                                      <div>
                                        {formatNumber(log.sent_count)} / {formatNumber(log.failed_count)}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                 <div>
                                   <h4 className="font-medium mb-2">
                                     {formatMessage(MESSAGE_KEYS.email.logs.recipients, {
                                       count: formatMessage(MESSAGE_KEYS.common.countWithUnit, {
                                         count: formatNumber(log.recipients.length),
                                         unit: formatMessage(MESSAGE_KEYS.common.units.person)
                                       })
                                     })}
                                   </h4>
                                   <div className="max-h-32 overflow-y-auto bg-muted/30 p-3 rounded text-sm space-y-1">
                                     {log.recipients.map((email, index) => (
                                       <div key={index} className="py-1 px-2 bg-background rounded border text-sm">
                                         {email}
                                       </div>
                                     ))}
                                   </div>
                                 </div>

                                {log.error && (
                                  <div>
                                    <h4 className="font-medium mb-2 text-red-600">
                                      {formatMessage(MESSAGE_KEYS.email.logs.errorInfo)}
                                    </h4>
                                    <div className="bg-red-50 border border-red-200 p-3 rounded text-sm text-red-800">
                                      {log.error}
                                    </div>
                                  </div>
                                )}

                                {log.results && (
                                  <div>
                                    <h4 className="font-medium mb-2">
                                      {formatMessage(MESSAGE_KEYS.email.logs.resultDetails)}
                                    </h4>
                                    <div className="max-h-40 overflow-y-auto bg-muted/30 p-3 rounded text-sm">
                                      <pre className="whitespace-pre-wrap">
                                        {JSON.stringify(log.results, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
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
    </div>
  );
};

export default EmailLogs;
