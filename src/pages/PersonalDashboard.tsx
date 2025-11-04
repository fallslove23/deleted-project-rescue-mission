import { useNavigate } from 'react-router-dom';
import { Award, BarChart3, RefreshCw, HelpCircle } from 'lucide-react';
import { useMyStats } from '@/hooks/useMyStats';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-full border border-dashed border-border/60 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            NO DATA
          </div>
          <div className="space-y-2">
            <p className="text-lg font-medium">집계된 데이터가 없습니다</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              아직 통계 데이터가 수집되지 않았습니다. 설문이 완료되면 이곳에 표시됩니다.
            </p>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" asChild>
              <a href="mailto:support@example.com">문의하기</a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const navigate = useNavigate();
  
  const isAuthError = message.includes('로그인') || message.includes('세션');

  return (
    <Alert variant="destructive">
      <AlertTitle>오류가 발생했습니다</AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>{message}</p>
        <div className="flex gap-2">
          {isAuthError ? (
            <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>
              로그인하기
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              다시 시도
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

function DisabledFiltersNotice() {
  return (
    <Card className="border-muted">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          조회 조건
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>개인 통계 페이지에서는 필터가 비활성화됩니다.</p>
                <p>본인의 전체 데이터만 조회됩니다.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <CardDescription className="text-xs">
          개인 통계에서는 필터 기능이 제한됩니다
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 opacity-50">
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">연도</p>
            <Select disabled>
              <SelectTrigger>
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">과정</p>
            <Select disabled>
              <SelectTrigger>
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">강사</p>
            <Select disabled>
              <SelectTrigger>
                <SelectValue placeholder="본인" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="self">본인</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PersonalDashboard() {
  const { data, isLoading, error, refetch } = useMyStats();

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <DisabledFiltersNotice />
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DisabledFiltersNotice />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="총 응답 수"
          value={data.response_count}
          icon={<BarChart3 className="h-6 w-6 text-primary" />}
        />
        <StatCard
          label="총 설문 수"
          value={data.survey_count}
          icon={<Award className="h-6 w-6 text-primary" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>강사 정보</CardTitle>
          <CardDescription>현재 로그인한 계정에 연결된 강사 정보입니다</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">강사명:</span>
            <Badge variant="secondary" className="text-sm">
              {data.instructor_name}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-muted bg-muted/20">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center">
            상세한 분석 데이터는 향후 업데이트에서 추가될 예정입니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
