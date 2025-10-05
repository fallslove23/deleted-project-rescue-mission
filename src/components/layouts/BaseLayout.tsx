import React from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { LayoutProvider } from "./LayoutProvider";

interface BaseLayoutProps {
  children: React.ReactNode;
}

export function BaseLayout({ children }: BaseLayoutProps) {
  return (
    <LayoutProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AdminSidebar />
          <main className="flex-1 flex flex-col min-w-0 w-full">
            <div className="w-full h-full overflow-x-hidden">
              {children}
            </div>
          </main>
        </div>
      </SidebarProvider>
    </LayoutProvider>
  );
}