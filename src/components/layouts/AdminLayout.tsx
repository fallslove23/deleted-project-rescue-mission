import React from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  /** 페이지 부제목 */
  subtitle?: string;
  /** 일부 페이지에서 description으로 넘기는 걸 지원 (subtitle과 동일 의미) */
  description?: string;
  totalCount?: number;

  /** 데스크톱 액션(단일/배열 모두 허용) — 기존 actions와 병행 지원 */
  actions?: React.ReactNode | React.ReactNode[];
  desktopActions?: React.ReactNode | React.ReactNode[];

  /** 모바일 액션(단일/배열 모두 허용) */
  mobileActions?: React.ReactNode | React.ReactNode[];

  onRefresh?: () => void;
  loading?: boolean;
  topbar?: React.ReactNode;
  hideHeader?: boolean;
}

/** 단일/배열을 항상 배열로 정규화 */
function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

export default function AdminLayout(props: AdminLayoutProps) {
  const {
    children,
    title,
    subtitle,
    description,
    totalCount,

    actions,
    desktopActions,
    mobileActions,

    onRefresh,
    loading = false,
    topbar,
    hideHeader = false,
  } = props;

  // actions 우선순위: desktopActions > actions (하위호환)
  const desktopActionItems = toArray(desktopActions ?? actions);
  const mobileActionItems = toArray(mobileActions);

  const subline = description ?? subtitle;

  const renderDesktopActions = () => {
    const elements: React.ReactNode[] = [];

    if (onRefresh) {
      elements.push(
        <Button
          key="refresh"
          variant="outline"
          size="sm"
          className="rounded-full px-3"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          새로고침
        </Button>
      );
    }

    desktopActionItems.forEach((action, index) => {
      elements.push(<div key={`action-${index}`}>{action}</div>);
    });

    return elements;
  };

  const renderMobileActions = () => {
    const elements: React.ReactNode[] = [];

    if (onRefresh) {
      elements.push(
        <Button
          key="refresh-mobile"
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      );
    }

    mobileActionItems.forEach((action, index) => {
      elements.push(<div key={`mobile-${index}`}>{action}</div>);
    });

    return elements;
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />

        <main className="flex-1 min-w-0">
          {topbar && (
            <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
              <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-14 flex items-center">
                {topbar}
              </div>
            </div>
          )}

          {!hideHeader && !topbar && title && (
            <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
              <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-auto min-h-[64px] md:min-h-[72px] py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <SidebarTrigger className="-ml-1" />
                  <div className="leading-tight md:leading-snug">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight whitespace-nowrap">
                      {title}
                    </h1>

                    {subline && (
                      <p className="text-xs text-muted-foreground md:hidden mt-0.5">
                        {subline}
                      </p>
                    )}

                    {typeof totalCount === "number" && (
                      <p className="text-xs text-muted-foreground md:hidden mt-0.5">
                        전체 {totalCount}개
                      </p>
                    )}
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-2">
                  {renderDesktopActions()}
                </div>
              </div>
            </div>
          )}

          <div className={hideHeader && !topbar ? "h-full" : ""}>
            {!hideHeader && !topbar && title ? (
              <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  {(subline || typeof totalCount === "number") && (
                    <p className="hidden md:block text-sm text-muted-foreground">
                      {subline}
                      {typeof totalCount === "number" && ` - 전체 ${totalCount}개`}
                    </p>
                  )}

                  {(mobileActionItems.length > 0 || onRefresh) && (
                    <div className="flex md:hidden items-center gap-2">
                      {renderMobileActions()}
                    </div>
                  )}
                </div>

                {children}
              </div>
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
