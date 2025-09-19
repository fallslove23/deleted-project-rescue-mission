import { CSSProperties, ReactNode } from 'react';
import LoadingScreen from '@/components/LoadingScreen';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SkeletonBaseProps {
  className?: string;
  fullScreen?: boolean;
  title?: string;
  description?: string;
  showSpinner?: boolean;
}

const wrapWithLoadingScreen = (
  content: ReactNode,
  { fullScreen, title, description, showSpinner }: SkeletonBaseProps,
) => {
  if (!fullScreen) {
    return content;
  }

  return (
    <LoadingScreen
      title={title}
      description={description}
      showSpinner={showSpinner}
    >
      {content}
    </LoadingScreen>
  );
};

interface ListSkeletonProps extends SkeletonBaseProps {
  items?: number;
  showAvatar?: boolean;
  showAction?: boolean;
}

export const ListSkeleton = ({
  items = 6,
  showAvatar = true,
  showAction = true,
  className,
  ...rest
}: ListSkeletonProps) => {
  const content = (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: items }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card/80 px-4 py-3 shadow-sm backdrop-blur-sm"
        >
          {showAvatar && <Skeleton className="h-12 w-12 rounded-full" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          {showAction && (
            <div className="flex flex-col gap-2 items-end">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return wrapWithLoadingScreen(content, rest);
};

interface CardSkeletonProps extends SkeletonBaseProps {
  cards?: number;
  columns?: number | 'auto';
}

export const CardSkeleton = ({
  cards = 3,
  columns = 'auto',
  className,
  ...rest
}: CardSkeletonProps) => {
  const gridStyle: CSSProperties | undefined =
    columns === 'auto'
      ? undefined
      : { gridTemplateColumns: `repeat(${Math.max(columns, 1)}, minmax(0, 1fr))` };

  const content = (
    <div
      className={cn(
        'grid gap-6',
        columns === 'auto' ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' : undefined,
        className,
      )}
      style={gridStyle}
    >
      {Array.from({ length: cards }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-sm backdrop-blur-sm space-y-4"
        >
          <div className="space-y-2">
            <Skeleton className="h-5 w-1/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="flex items-center justify-between pt-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      ))}
    </div>
  );

  return wrapWithLoadingScreen(content, rest);
};

interface ChartSkeletonProps extends SkeletonBaseProps {
  variant?: 'bar' | 'line' | 'pie';
  height?: number;
}

const BAR_HEIGHTS = [45, 80, 62, 90, 55, 74, 68, 88, 60, 76, 70, 84];

export const ChartSkeleton = ({
  variant = 'bar',
  height = 320,
  className,
  ...rest
}: ChartSkeletonProps) => {
  const content = (
    <div
      className={cn(
        'rounded-2xl border border-border/60 bg-card/80 p-6 shadow-sm backdrop-blur-sm space-y-6',
        className,
      )}
      style={{ minHeight: height }}
    >
      <div className="space-y-2">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      {variant === 'bar' && (
        <div className="grid grid-cols-12 items-end gap-2 h-48">
          {BAR_HEIGHTS.map((value, index) => (
            <Skeleton
              key={index}
              className="w-full rounded-md"
              style={{ height: `${value}%` }}
            />
          ))}
        </div>
      )}
      {variant === 'line' && (
        <div className="h-48 flex items-center justify-center">
          <div className="relative h-32 w-full max-w-3xl">
            <Skeleton className="absolute inset-x-0 bottom-8 h-8" />
            <Skeleton className="absolute inset-x-6 bottom-16 h-10" />
            <Skeleton className="absolute inset-x-12 bottom-4 h-14" />
          </div>
        </div>
      )}
      {variant === 'pie' && (
        <div className="flex items-center justify-center h-48">
          <Skeleton className="h-40 w-40 rounded-full" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );

  return wrapWithLoadingScreen(content, rest);
};
