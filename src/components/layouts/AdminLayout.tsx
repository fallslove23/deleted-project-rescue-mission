// src/components/layouts/AdminLayout.tsx
import { PropsWithChildren, ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface AdminLayoutProps {
  children: ReactNode;
  // 헤더 관련 props
  title?: string;
  subtitle?: string;
  totalCount?: number;
  // 액션 버튼들
  actions?: ReactNode[];
  mobileActions?: ReactNode[];
  // 새로고침 기능
  onRefresh?: () => void;
  loading?: boolean;
  // 기존 topbar prop (하위 호환성)
  topbar?: ReactNode;
  // 헤더 숨김 여부
  hideHeader?: boolean;
}

/**
 * 관리자 페이지 공용 레이아웃 (SurveyManagementV2 스타일)
 * - SidebarProvider 포함
 * - 좌측 AdminSidebar + 우측 페이지 내용
 * - Sticky 헤더 + 액션 버튼들
 * - 반응형 디자인
 */
export default function AdminLayout({
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
}: PropsWithChildren<AdminLayoutProps>) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />
        
        <main className="flex-1 min-w-0">
          {/* 기존 topbar 방식 (하위 호환성) */}
          {topbar && (
            <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
              <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-14 flex items-center">
                {topbar}
              </div>
            </div>
          )}

          {/* 새로운 Modern 헤더 (SurveyManagementV2 스타일) */}
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

                {/* 데스크톱 액션 버튼들 */}
                <div className="hidden md:flex items-center gap-2">
                  {onRefresh && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-full px-3" 
                      onClick={onRefresh}
                      disabled={loading}
                    >
                      <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                      새로고침
                    </Button>
                  )}
                  {actions.map((action, index) => (
                    <div key={index}>{action}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 메인 콘텐츠 영역 */}
          <div className={hideHeader && !topbar ? "h-full" : ""}>
            {!hideHeader && !topbar && title && (
              <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  {/* 데스크톱에서만 표시되는 서브타이틀 */}
                  {(subtitle || totalCount !== undefined) && (
                    <p className="hidden md:block text-sm text-muted-foreground">
                      {subtitle}
                      {totalCount !== undefined && ` - 전체 ${totalCount}개`}
                    </p>
                  )}

                  {/* 모바일 액션 버튼들 */}
                  {(mobileActions.length > 0 || onRefresh) && (
                    <div className="flex md:hidden items-center gap-2">
                      {onRefresh && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="rounded-full" 
                          onClick={onRefresh}
                          disabled={loading}
                        >
                          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                      )}
                      {mobileActions.map((action, index) => (
                        <div key={index}>{action}</div>
                      ))}
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