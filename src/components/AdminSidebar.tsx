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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminSidebar() {
  const { userRoles, user } = useAuth();
  const [searchParams] = useSearchParams();

  const viewMode = searchParams.get('view'); // URL에서 view 파라미터 읽기
  const isAdmin = userRoles.includes('admin');
  const isInstructor = userRoles.includes('instructor');
  const isDeveloper = user?.email === 'sethetrend87@osstem.com';

  type MenuItem = {
    title: string;
    url: string;
    icon: LucideIcon;
    exact: boolean;
  };

  type MenuSection = {
    title: string;
    items: MenuItem[];
  };

  // 메뉴 구성 함수
  const getMenuItems = () => {
    const baseAdminMenuItems: MenuSection[] = [
      {
        title: "개요",
        items: [
          { title: "대시보드", url: "/dashboard", icon: LayoutDashboard, exact: true }
        ]
      },
      {
        title: "분석",
        items: [
          { title: "결과분석", url: "/dashboard/results", icon: BarChart3, exact: false },
          ...(isInstructor ? [{ title: "나의 만족도 통계", url: "/dashboard/my-stats", icon: Award, exact: false }] : []),
          { title: "과정별 결과 보고", url: "/dashboard/course-reports", icon: TrendingUp, exact: false },
          { title: "과정 통계", url: "/dashboard/course-statistics", icon: PieChart, exact: false }
        ]
      },
      {
        title: "관리",
        items: [
          { title: "설문관리", url: "/surveys-v2", icon: FileText, exact: false },
          { title: "템플릿관리", url: "/dashboard/templates", icon: FileText, exact: false },
          { title: "강사관리", url: "/dashboard/instructors", icon: UserCheck, exact: false },
          { title: "사용자관리", url: "/dashboard/users", icon: Users, exact: false },
          { title: "과목관리", url: "/dashboard/courses", icon: BookOpen, exact: false }
        ]
      },
      {
        title: "기타",
        items: [
          { title: "이메일 로그", url: "/dashboard/email-logs", icon: Mail, exact: false },
          { title: "시스템 로그", url: "/dashboard/system-logs", icon: Settings, exact: false },
          { title: "정책 관리", url: "/dashboard/policy-management", icon: Shield, exact: false },
          { title: "누적 데이터", url: "/dashboard/cumulative-data", icon: Database, exact: false }
        ]
      }
    ];

    const baseInstructorMenuItems: MenuSection[] = [
      {
        title: "분석",
        items: [
          { title: "결과분석", url: "/dashboard/results", icon: BarChart3, exact: false },
          { title: "나의 만족도 통계", url: "/dashboard/my-stats", icon: Award, exact: false }
        ]
      }
    ];

    return { baseAdminMenuItems, baseInstructorMenuItems };
  };

  const { baseAdminMenuItems, baseInstructorMenuItems } = getMenuItems();


  // 교육생 뷰 메뉴 (오늘의 설문만)
  const studentMenuItems: MenuSection[] = [
    {
      title: "설문",
      items: [
        { title: "오늘의 설문", url: "/", icon: FileText, exact: true }
      ]
    }
  ];

  // 강사 뷰 메뉴 (결과 분석 및 과정 통계)
  const instructorViewMenuItems: MenuSection[] = [
    {
      title: "설문 분석",
      items: [
        { title: "결과분석", url: "/dashboard/results", icon: BarChart3, exact: false },
        { title: "과정 통계", url: "/dashboard/course-statistics", icon: PieChart, exact: false }
      ]
    }
  ];

  // view 모드에 따른 메뉴 선택
  let menuItems: MenuSection[];
  if (viewMode === 'student') {
    menuItems = studentMenuItems;
  } else if (viewMode === 'instructor') {
    menuItems = instructorViewMenuItems;
  } else if (viewMode === 'admin') {
    menuItems = baseAdminMenuItems;
  } else {
    // 기본: 사용자 역할에 따른 메뉴 (관리자 권한이 있으면 관리자 메뉴, 없으면 강사 메뉴)
    menuItems = isAdmin ? baseAdminMenuItems : baseInstructorMenuItems;
  }

  const renderMenuItem = (
    item: MenuItem,
    options: { variant?: "default" | "developer" } = {}
  ) => {
    const { variant = "default" } = options;
    const iconClass =
      variant === "developer"
        ? "text-destructive group-data-[active=true]/menu-button:text-destructive-foreground"
        : "text-sidebar-foreground/55 group-data-[active=true]/menu-button:text-sidebar-primary-foreground";

    return (
      <SidebarMenuItem key={item.url}>
        <NavLink to={item.url} end={item.exact} className="block">
          {({ isActive }) => (
            <SidebarMenuButton
              asChild
              isActive={isActive}
              className={cn(
                "group/menu-button rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                variant === "developer"
                  ? "text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/40 data-[active=true]:bg-destructive data-[active=true]:text-destructive-foreground"
                  : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-sidebar-ring/40 data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-sm"
              )}
            >
              <span className="flex w-full items-center gap-3">
                <item.icon
                  className={cn(
                    "h-4 w-4 flex-shrink-0 transition-colors",
                    iconClass
                  )}
                />
                <span className="truncate leading-5">{item.title}</span>
              </span>
            </SidebarMenuButton>
          )}
        </NavLink>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar">
      <SidebarContent className="bg-sidebar px-3 py-5 text-sidebar-foreground">
        <div className="space-y-6">
          {menuItems.map((section) => (
            <SidebarGroup key={section.title} className="space-y-2">
              <SidebarGroupLabel className="px-3 text-[0.7rem] font-semibold uppercase tracking-widest text-sidebar-foreground/60">
                {section.title}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => renderMenuItem(item))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}

          {/* 개발자 전용 섹션 */}
          {isDeveloper && (
            <SidebarGroup className="space-y-2 border-t border-sidebar-border pt-4">
              <SidebarGroupLabel className="px-3 text-[0.7rem] font-semibold uppercase tracking-widest text-destructive">
                개발자 도구
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
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
    </Sidebar>
  );
}