import React from "react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { BarChart3, ChevronDown, LogOut, SlidersHorizontal } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  filtersSummary?: string;
}

export function PageHeader({ title, subtitle, icon, filtersSummary }: PageHeaderProps) {
  const { user, signOut } = useAuth();
  const [isMobileSummaryOpen, setIsMobileSummaryOpen] = React.useState(false);
  const hasFiltersSummary = Boolean(filtersSummary?.trim());

  return (
    <header className="border-b border-surface-border bg-surface/90 supports-[backdrop-filter]:bg-surface/80 backdrop-blur-sm sticky top-0 z-40 shadow-sm transition-colors">
      <div className="container mx-auto px-4 py-3 md:py-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="h-9 w-9" />
            <div className="h-10 w-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg">
              {icon || <BarChart3 className="h-5 w-5 text-primary-foreground" />}
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

          <div className="flex items-center gap-2 md:justify-end">
            <span className="text-xs md:text-sm text-muted-foreground hidden sm:block">
              환영합니다, {user?.email}
            </span>
            <Button onClick={signOut} variant="outline" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              로그아웃
            </Button>
          </div>
        </div>
        {hasFiltersSummary && (
          <>
            <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <span className="leading-tight">{filtersSummary}</span>
            </div>
            <Collapsible
              open={isMobileSummaryOpen}
              onOpenChange={setIsMobileSummaryOpen}
              className="md:hidden"
            >
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-between text-xs"
                >
                  <span className="font-medium text-muted-foreground">현재 필터 요약</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      isMobileSummaryOpen ? "rotate-180" : ""
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 text-xs text-muted-foreground leading-relaxed">
                {filtersSummary}
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </div>
    </header>
  );
}
