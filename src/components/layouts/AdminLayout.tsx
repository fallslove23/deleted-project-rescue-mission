import React from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  totalCount?: number;
  actions?: React.ReactNode[];
  mobileActions?: React.ReactNode[];
  onRefresh?: () => void;
  loading?: boolean;
  topbar?: React.ReactNode;
  hideHeader?: boolean;
}

export default function AdminLayout(props: AdminLayoutProps) {
  const {
    children,
    title,
    subtitle,
    totalCount,
    actions = [],
    mobileActions = [],
    onRefresh,
    loading = false,
    topbar,
    hideHeader = false,
  } = props;

  const renderDesktopActions = () => {
    const elements = [];
    
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
    
    actions.forEach((action, index) => {
      elements.push(<div key={`action-${index}`}>{action}</div>);
    });
    
    return elements;
  };

  const renderMobileActions = () => {
    const elements = [];
    
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
    
    mobileActions.forEach((action, index) => {
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
                    {subtitle && (
                      <p className="text-xs text-muted-foreground md:hidden mt-0.5">
                        {subtitle}
                      </p>
                    )}
                    {totalCount !== undefined && (
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
                  {(subtitle || totalCount !== undefined) && (
                    <p className="hidden md:block text-sm text-muted-foreground">
                      {subtitle}
                      {totalCount !== undefined && ` - 전체 ${totalCount}개`}
                    </p>
                  )}

                  {(mobileActions.length > 0 || onRefresh) && (
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