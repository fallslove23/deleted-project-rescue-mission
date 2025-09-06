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

type Role = "admin" | "operator";

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

        {/* 역할별 뷰 테스트 섹션 - 관리자만, 컴팩트 버전 */}
        {effectiveRoles.includes("admin") && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">
              {state === "expanded" && (
                <div className="flex items-center gap-2">
                  <Eye className="h-3 w-3" />
                  <span>뷰 테스트</span>
                </div>
              )}
            </SidebarGroupLabel>

            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/role-view/admin")}
                    className={state === "expanded" ? "pl-8" : ""}
                  >
                    <NavLink to="/role-view/admin" className="flex items-center">
                      <Crown className="h-4 w-4" />
                      {state === "expanded" && (
                        <div className="ml-2 flex items-center gap-2">
                          <span className="text-sm">관리자</span>
                          <Badge variant="outline" className="text-xs px-1 py-0 h-4">DEV</Badge>
                        </div>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/role-view/operator")}
                    className={state === "expanded" ? "pl-8" : ""}
                  >
                    <NavLink to="/role-view/operator" className="flex items-center">
                      <Shield className="h-4 w-4" />
                      {state === "expanded" && (
                        <div className="ml-2 flex items-center gap-2">
                          <span className="text-sm">운영자</span>
                          <Badge variant="outline" className="text-xs px-1 py-0 h-4">DEV</Badge>
                        </div>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/role-view/instructor")}
                    className={state === "expanded" ? "pl-8" : ""}
                  >
                    <NavLink to="/role-view/instructor" className="flex items-center">
                      <UserCheck className="h-4 w-4" />
                      {state === "expanded" && (
                        <div className="ml-2 flex items-center gap-2">
                          <span className="text-sm">강사</span>
                          <Badge variant="outline" className="text-xs px-1 py-0 h-4">DEV</Badge>
                        </div>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/role-view/director")}
                    className={state === "expanded" ? "pl-8" : ""}
                  >
                    <NavLink to="/role-view/director" className="flex items-center">
                      <UserCog className="h-4 w-4" />
                      {state === "expanded" && (
                        <div className="ml-2 flex items-center gap-2">
                          <span className="text-sm">조직장</span>
                          <Badge variant="outline" className="text-xs px-1 py-0 h-4">DEV</Badge>
                        </div>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

export default AdminSidebar;