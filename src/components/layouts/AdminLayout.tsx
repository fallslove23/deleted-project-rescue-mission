import React from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { GlobalNavBar } from "./GlobalNavBar";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  description?: string;
  totalCount?: number;
  actions?: React.ReactNode | React.ReactNode[];
  desktopActions?: React.ReactNode | React.ReactNode[];
  mobileActions?: React.ReactNode | React.ReactNode[];
  loading?: boolean;
  icon?: React.ReactNode;
  hideGlobalNav?: boolean;
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
    loading = false,
    icon,
    hideGlobalNav = false,
  } = props;

  const desktopActionItems = toArray(desktopActions ?? actions);
  const mobileActionItems = toArray(mobileActions);
  const subline = description ?? subtitle;

  const renderSubNavigation = () => {
    if (!desktopActionItems.length) return null;
    
    return (
      <div className="border-b bg-white/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            {desktopActionItems.map((action, index) => (
              <div key={`action-${index}`}>{action}</div>
            ))}
          </div>
        </div>
      </div>
    );
  };


  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />
        
        <main className="flex-1 flex flex-col min-w-0">
          {!hideGlobalNav && (
            <GlobalNavBar
              title={title}
              subtitle={subtitle || description}
              icon={icon}
            />
          )}
          
          {renderSubNavigation()}
          
          <div className="flex-1 overflow-auto">
            <div className="container mx-auto px-4 py-6 max-w-none">
              {(subline || typeof totalCount === "number") && (
                <div className="mb-6">
                  <p className="text-sm text-muted-foreground">
                    {subline}
                    {typeof totalCount === "number" && ` - 전체 ${totalCount}개`}
                  </p>
                </div>
              )}
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}