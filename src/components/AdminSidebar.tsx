// src/components/AdminSidebar.tsx
import { NavLink, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  UserCheck,
  BookOpen,
  FileText,
  Mail,
  Settings,
  TrendingUp,
  Award,
  PieChart,
  Database,
  Code,
  Shield,
  Building2,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleSwitcher } from "./RoleSwitcher";
import { Badge } from "@/components/ui/badge";

export function AdminSidebar() {
  const { userRoles, user } = useAuth();
  const [searchParams] = useSearchParams();

  const viewMode = searchParams.get('view'); // URL에서 view 파라미터 읽기
  const isAdmin = userRoles.includes('admin');
  const isInstructor = userRoles.includes('instructor');
  const isOperator = userRoles.includes('operator');
  const isDeveloper = user?.email === 'sethetrend87@osstem.com';

  type MenuItem = {
    title: string;
    url: string;
    icon: LucideIcon;
    exact: boolean;
    badge?: string;
  };

  type MenuSection = {
    title: string;
    items: MenuItem[];
  };

  // 새로운 메뉴 구조 - 요구사항에 따라 재구성
  const getMenuItems = () => {
    // Admin/Director 메뉴 구조
    const adminMenuItems: MenuSection[] = [
      {
        title: "조직 개요",
        items: [
          { title: "대시보드", url: "/dashboard", icon: Building2, exact: true }
        ]
      },
      {
        title: "조직 분석", 
        items: [
          { title: "결과분석", url: "/dashboard/results", icon: BarChart3, exact: false },
          { title: "과정별 결과 보고", url: "/dashboard/course-reports", icon: TrendingUp, exact: false },
          { title: "과정 전체 통계", url: "/dashboard/course-statistics", icon: PieChart, exact: false },
          { title: "누적 데이터", url: "/dashboard/cumulative-data", icon: Database, exact: false }
        ]
      },
      {
        title: "운영 관리",
        items: [
          { title: "설문관리", url: "/surveys-v2", icon: FileText, exact: false },
          { title: "템플릿관리", url: "/dashboard/templates", icon: FileText, exact: false },
          { title: "강사관리", url: "/dashboard/instructors", icon: UserCheck, exact: false },
          { title: "사용자관리", url: "/dashboard/users", icon: Users, exact: false },
          { title: "과정관리", url: "/dashboard/courses", icon: BookOpen, exact: false }
        ]
      },
      {
        title: "감사 로그",
        items: [
          { title: "이메일 로그", url: "/dashboard/email-logs", icon: Mail, exact: false },
          { title: "시스템 로그", url: "/dashboard/system-logs", icon: Settings, exact: false },
          { title: "정책 관리", url: "/dashboard/policy-management", icon: Shield, exact: false }
        ]
      }
    ];

    // Instructor 메뉴 구조
    const instructorMenuItems: MenuSection[] = [
      {
        title: "나의 분석",
        items: [
          { title: "나의 만족도 통계", url: "/dashboard/my-stats", icon: Award, exact: false },
          { title: "과정별 내 결과", url: "/dashboard/course-reports", icon: TrendingUp, exact: false, badge: "내 데이터만" },
          { title: "과정 전체 통계", url: "/dashboard/course-statistics", icon: PieChart, exact: false, badge: "요약만" }
        ]
      }
    ];

    return { adminMenuItems, instructorMenuItems };
  };

  const { adminMenuItems, instructorMenuItems } = getMenuItems();

  // view 모드에 따른 메뉴 선택
  let menuItems: MenuSection[];
  if (viewMode === 'instructor') {
    menuItems = instructorMenuItems;
  } else if (viewMode === 'admin' || isAdmin) {
    menuItems = adminMenuItems;
  } else {
    // 기본: 강사 메뉴
    menuItems = instructorMenuItems;
  }

  const renderMenuItem = (
    item: MenuItem,
    options: { variant?: "default" | "developer" } = {}
  ) => {
    const { variant = "default" } = options;
    
    return (
      <SidebarMenuItem key={item.url}>
        <NavLink to={item.url} end={item.exact} className="block">
          {({ isActive }) => (
            <SidebarMenuButton
              asChild
              isActive={isActive}
              className={cn(
                "group/menu-button relative overflow-hidden rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                variant === "developer"
                  ? "text-destructive hover:bg-destructive/10 hover:text-destructive data-[active=true]:bg-destructive data-[active=true]:text-destructive-foreground shadow-neumorphic-soft"
                  : isActive
                  ? "bg-gradient-primary text-sidebar-primary-foreground shadow-purple-glow"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground hover:shadow-neumorphic-soft"
              )}
            >
              <span className="flex w-full items-center gap-3 relative z-10">
                <item.icon
                  className={cn(
                    "h-4 w-4 flex-shrink-0 transition-all duration-200",
                    isActive ? "text-white drop-shadow-sm" : "text-sidebar-foreground/70"
                  )}
                />
                <span className={cn(
                  "truncate leading-5 flex-1 font-medium",
                  isActive ? "text-white drop-shadow-sm font-semibold" : ""
                )}>{item.title}</span>
                {item.badge && (
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "text-[0.6rem] h-4 px-1.5 ml-auto font-medium",
                      isActive 
                        ? "bg-white/25 text-white border-0 drop-shadow-sm font-semibold" 
                        : "bg-sidebar-primary/10 text-sidebar-primary border-sidebar-primary/20"
                    )}
                  >
                    {item.badge}
                  </Badge>
                )}
              </span>
            </SidebarMenuButton>
          )}
        </NavLink>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar className="border-r border-sidebar-border/50 bg-sidebar shadow-neumorphic">
      <SidebarContent className="bg-gradient-soft px-3 py-6 text-sidebar-foreground sidebar-scroll">
        <div className="space-y-6">
          {menuItems.map((section) => (
            <SidebarGroup key={section.title} className="space-y-3">
              <SidebarGroupLabel className="px-3 text-[0.7rem] font-semibold uppercase tracking-widest text-sidebar-muted-foreground/80">
                {section.title}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {section.items.map((item) => renderMenuItem(item))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}

          {/* 개발자 전용 섹션 */}
          {isDeveloper && (
            <SidebarGroup className="space-y-3 border-t border-sidebar-border/50 pt-6">
              <SidebarGroupLabel className="px-3 text-[0.7rem] font-semibold uppercase tracking-widest text-destructive/80">
                개발자 도구
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {renderMenuItem(
                    {
                      title: "테스트 화면",
                      url: "/developer-test",
                      icon: Code,
                      exact: false,
                    },
                    { variant: "developer" }
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </div>
      </SidebarContent>
      
      <SidebarFooter className="p-0 border-t border-sidebar-border/30">
        <RoleSwitcher />
      </SidebarFooter>
    </Sidebar>
  );
}