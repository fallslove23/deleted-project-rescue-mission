import React from "react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { BarChart3, LogOut } from "lucide-react";


interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export function PageHeader({ title, subtitle, icon }: PageHeaderProps) {
  const { user, signOut } = useAuth();

  return (
    <header className="border-b border-surface-border/50 bg-gradient-soft/90 supports-[backdrop-filter]:bg-gradient-soft/80 backdrop-blur-sm sticky top-0 z-40 shadow-neumorphic-soft transition-colors">
      <div className="container mx-auto px-4 py-3 md:py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="h-9 w-9 rounded-xl shadow-neumorphic-soft hover:shadow-neumorphic bg-sidebar-accent/50 border border-sidebar-border/50" />
          <div className="h-10 w-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-purple-glow">
            {icon || <BarChart3 className="h-5 w-5 text-primary-foreground" />}
          </div>
          <div>
            <h1 className="text-base md:text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs md:text-sm text-sidebar-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-xs md:text-sm text-sidebar-muted-foreground hidden sm:block font-medium">
            {user?.email}
          </span>
          <Button 
            onClick={signOut} 
            variant="outline" 
            size="sm"
            className="rounded-xl shadow-neumorphic-soft border-sidebar-border/50 bg-sidebar-accent/50 hover:bg-sidebar-accent hover:shadow-neumorphic text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4 mr-2" />
            로그아웃
          </Button>
        </div>
      </div>
    </header>
  );
}