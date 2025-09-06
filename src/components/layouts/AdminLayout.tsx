import { PropsWithChildren, ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";

/**
 * 관리자 페이지 공용 레이아웃
 * - SidebarProvider 필수
 * - 좌측 AdminSidebar + 우측 페이지 내용
 * - 페이지 내부에서 SidebarTrigger를 자유롭게 사용 가능
 */
export default function AdminLayout({
  children,
  topbar,
}: PropsWithChildren<{ topbar?: ReactNode }>) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />
        <main className="flex-1 min-w-0 flex flex-col">
          {/* 필요한 경우 상단 공용 Topbar 영역 */}
          {topbar ? (
            <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
              <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-14 flex items-center">
                {topbar}
              </div>
            </div>
          ) : null}
          {/* 실제 페이지 콘텐츠 */}
          <div className="flex-1">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
