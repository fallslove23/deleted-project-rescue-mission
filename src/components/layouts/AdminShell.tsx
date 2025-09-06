// src/components/layouts/AdminShell.tsx
import { PropsWithChildren } from "react";
import { Outlet } from "react-router-dom";
import { AdminSidebar } from "@/components/AdminSidebar";

/**
 * 관리자 공용 레이아웃 (SidebarProvider 없음!)
 * - 좌측 AdminSidebar + 우측 컨텐츠(Outlet)
 * - App.tsx 최상단에서 SidebarProvider로 감싸고 있으므로
 *   여기서는 SidebarProvider를 다시 쓰지 않습니다.
 */
export default function AdminShell({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1">
          {children ?? <Outlet />}
        </div>
      </main>
    </div>
  );
}
