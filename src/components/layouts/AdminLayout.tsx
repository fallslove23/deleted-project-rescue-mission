import React from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  description?: string;
  totalCount?: number;
  actions?: React.ReactNode | React.ReactNode[];
  desktopActions?: React.ReactNode | React.ReactNode[];
  mobileActions?: React.ReactNode | React.ReactNode[];
  onRefresh?: () => void;
  loading?: boolean;
  topbar?: React.ReactNode;
  hideHeader?: boolean;
}

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
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />

      <main className="flex-1 min-w-0 flex flex-col">
        {topbar && (
          <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
            <div className="px-4 md:px-6 lg:px-8 h-14 flex items-center">
              {topbar}
            </div>
          </div>
        )}

        {!hideHeader && !topbar && title && (
          <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
            <div className="px-4 md:px-6 lg:px-8 h-auto min-h-[64px] md:min-h-[72px] py-2 flex items-center justify-between">
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

        {/* 메인 콘텐츠 - 전체 너비 사용 */}
        <div className="flex-1 overflow-auto">
          {!hideHeader && !topbar && title ? (
            <div className="w-full px-4 md:px-6 lg:px-8 py-6">
              <div className="flex items-center justify-between mb-6">
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
            <div className="w-full px-4 md:px-6 lg:px-8 py-6">
              {children}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}