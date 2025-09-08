import React from "react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { BarChart3, LogOut } from "lucide-react";

interface GlobalNavBarProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export function GlobalNavBar({ title, subtitle, icon }: GlobalNavBarProps) {
  const { user, signOut } = useAuth();

  return (
    <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-40 shadow-sm">
      <div className="container mx-auto px-4 py-3 md:py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <div className="h-10 w-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg">
            {icon || <BarChart3 className="h-5 w-5 text-white" />}
          </div>
          <div>
            <h1 className="text-base md:text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs md:text-sm text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs md:text-sm text-muted-foreground hidden sm:block">
            환영합니다, {user?.email}
          </span>
          <Button onClick={signOut} variant="outline" size="sm">
            <LogOut className="h-4 w-4 mr-2" />
            로그아웃
          </Button>
        </div>
      </div>
    </header>
  );
}