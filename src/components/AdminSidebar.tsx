// src/components/AdminSidebar.tsx
import { NavLink, useLocation } from "react-router-dom";
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
  useSidebar,
} from "@/components/ui/sidebar";

import {
  Home,
  BarChart,
  TrendingUp,
  FileText,
  Users,
  BookOpen,
  FileSpreadsheet,
  Mail,
  ScrollText,
  Eye,
  UserCheck,
  UserCog,
  Crown,
  Shield,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Role = "admin" | "operator" | "instructor" | "director";

const allItems = [
  { title: "개요", url: "/dashboard", icon: Home, roles: ["admin", "operator"] as Role[] },
  { title: "결과분석", url: "/dashboard/results", icon: BarChart, roles: ["admin", "operator"] as Role[] },
  { title: "결과보고", url: "/dashboard/course-reports", icon: TrendingUp, roles: ["admin", "operator"] as Role[] },
  { title: "설문관리", url: "/surveys-v2", icon: FileText, roles: ["admin", "operator"] as Role[] },
  { title: "강사관리", url: "/dashboard/instructors", icon: Users, roles: ["admin", "operator"] as Role[] },
  { title: "사용자관리", url: "/dashboard/users", icon: Users, roles: ["admin"] as Role[] },
  { title: "과목관리", url: "/dashboard/courses", icon: BookOpen, roles: ["admin", "operator"] as Role[] },
  { title: "통계관리", url: "/dashboard/course-statistics", icon: FileSpreadsheet, roles: ["admin", "operator"] as Role[] },
  { title: "템플릿관리", url: "/dashboard/templates", icon: BookOpen, roles: ["admin", "operator"] as Role[] },
  { title: "이메일 로그", url: "/dashboard/email-logs", icon: Mail, roles: ["admin", "operator"] as Role[] },
  { title: "시스템 로그", url: "/dashboard/system-logs", icon: ScrollText, roles: ["admin"] as Role[] },
];

// 역할별 뷰 테스트 메뉴
const roleViewItems = [
  { 
    title: "관리자 뷰", 
    url: "/role-view/admin", 
    icon: Crown, 
    role: "admin",
    description: "전체 시스템 관리" 
  },
  { 
    title: "운영자 뷰", 
    url: "/role-view/operator", 
    icon: Shield, 
    role: "operator",
    description: "설문 및 과정 관리" 
  },
  { 
    title: "강사 뷰", 
    url: "/role-view/instructor", 
    icon: UserCheck, 
    role: "instructor",
    description: "개별 통계 및 결과" 
  },
  { 
    title: "조직장 뷰", 
    url: "/role-view/director", 
    icon: UserCog, 
    role: "director",
    description: "전체 과정 결과" 
  },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const { userRoles } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;

  // 운영/관리자만 보이게 필터
  const effectiveRoles = (userRoles as Role[]).filter((r) => r === "admin" || r === "operator");
  const items = allItems.filter((item) =>
    item.roles.some((role) => effectiveRoles.includes(role))
  );

  const isActive = (path: string) => {
    if (path === "/dashboard") return currentPath === "/dashboard";
    if (path.startsWith("/role-view")) return currentPath === path;
    return currentPath.startsWith(path);
  };

  const sections = [
    { label: "대시보드", keys: ["/dashboard", "/dashboard/course-reports"] },
    { label: "설문", keys: ["/surveys-v2", "/dashboard/results"] },
    {
      label: "관리",
      keys: [
        "/dashboard/instructors",
        "/dashboard/users",
        "/dashboard/courses",
        "/dashboard/course-statistics",
        "/dashboard/templates",
      ],
    },
    { label: "기록", keys: ["/dashboard/email-logs", "/dashboard/system-logs"] },
  ];

  const sectionItems = sections
    .map((section) => ({
      ...section,
      items: items.filter((i) => section.keys.includes(i.url)),
    }))
    .filter((sec) => sec.items.length > 0);

  return (
    <Sidebar className={`${state === "collapsed" ? "w-14" : "w-60"} touch-scroll mobile-scroll`}>
      <SidebarContent className="bg-gradient-to-b from-primary/5 to-primary/10 scrollable-y">
        {/* 기존 메뉴들 */}
        {sectionItems.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">
              {state === "expanded" && section.label}
            </SidebarGroupLabel>

            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      className={state === "expanded" ? "pl-8" : ""}
                    >
                      <NavLink to={item.url} end={item.url === "/dashboard"} className="flex items-center">
                        <item.icon className="h-4 w-4" />
                        {state === "expanded" && <span className="ml-2">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {/* 역할별 뷰 테스트 섹션 - 관리자만 */}
        {effectiveRoles.includes("admin") && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">
              {state === "expanded" && (
                <div className="flex items-center gap-2">
                  <Eye className="h-3 w-3" />
                  <span>역할별 뷰 테스트</span>
                </div>
              )}
            </SidebarGroupLabel>

            <SidebarGroupContent>
              <SidebarMenu>
                {roleViewItems.map((item) => (
                  <SidebarMenuItem key={item.role}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      className={state === "expanded" ? "pl-8" : ""}
                    >
                      <NavLink to={item.url} className="flex items-center">
                        <item.icon className="h-4 w-4" />
                        {state === "expanded" && (
                          <div className="ml-2 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{item.title}</span>
                              <Badge variant="outline" className="text-xs px-1 py-0">
                                DEV
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {item.description}
                            </div>
                          </div>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

export default AdminSidebar;