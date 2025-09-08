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
  onRefresh?: () => void;
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
    onRefresh,
    loading = false,
    icon,
    hideGlobalNav = false,
  } = props;

  const desktopActionItems = toArray(desktopActions ?? actions);
  const mobileActionItems = toArray(mobileActions);
  const subline = description ?? subtitle;

  const renderActions = () => {
    const elements: React.ReactNode[] = [];

    if (onRefresh) {
      elements.push(
        <Button
          key="refresh"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          새로고침
        </Button>
      );
    }

    desktopActionItems.forEach((action, index) => {
      elements.push(<div key={`action-${index}`}>{action}</div>);
    });

    return elements;
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
              actions={renderActions()}
            />
          )}
          
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