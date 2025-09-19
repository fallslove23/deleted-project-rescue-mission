import { ReactNode, useState } from 'react';
import { AlertTriangle, LifeBuoy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void | Promise<void>;
  retryLabel?: string;
  contactLabel?: string;
  contactHref?: string;
  lastUpdatedAt?: Date | string | null;
  className?: string;
  children?: ReactNode;
}

const DEFAULT_CONTACT = 'mailto:bs-feedback@bespinglobal.com';

const formatLastUpdated = (value?: Date | string | null) => {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export const ErrorState = ({
  title = '데이터를 불러오는 중 문제가 발생했습니다.',
  description = '잠시 후 다시 시도하거나 관리자에게 문의해 주세요.',
  onRetry,
  retryLabel = '다시 시도',
  contactLabel = '문의하기',
  contactHref = DEFAULT_CONTACT,
  lastUpdatedAt,
  className,
  children,
}: ErrorStateProps) => {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (!onRetry) return;
    try {
      setRetrying(true);
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  const formattedLastUpdated = formatLastUpdated(lastUpdatedAt);

  return (
    <div
      className={cn(
        'rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-destructive-foreground shadow-sm backdrop-blur-sm',
        'flex flex-col items-center justify-center gap-4 text-center',
        className,
      )}
    >
      <div className="flex items-center justify-center rounded-full bg-destructive/10 p-3">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        {formattedLastUpdated && (
          <p className="text-xs text-muted-foreground/80">
            마지막 성공 갱신: <span className="font-medium text-foreground">{formattedLastUpdated}</span>
          </p>
        )}
      </div>
      {children && <div className="w-full text-sm text-left text-muted-foreground">{children}</div>}
      <div className="flex flex-col gap-2 sm:flex-row">
        {onRetry && (
          <Button onClick={handleRetry} disabled={retrying} className="min-w-[140px]">
            <RefreshCw className="h-4 w-4" />
            {retrying ? '재시도 중...' : retryLabel}
          </Button>
        )}
        {contactHref && (
          <Button asChild variant="outline" className="min-w-[140px]">
            <a href={contactHref} target="_blank" rel="noreferrer">
              <LifeBuoy className="h-4 w-4" />
              {contactLabel}
            </a>
          </Button>
        )}
      </div>
    </div>
  );
};
