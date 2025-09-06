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
} from "lucide-react";

type Role = "admin" | "operator";

const allItems = [
  { title: "개요", url: "/dashboard", icon: Home, roles: ["admin", "operator"] as Role[] },
  { title: "결과분석", url: "/dashboard/results", icon: BarChart, roles: ["admin", "operator"] as Role[] },
  { title: "결과보고", url: "/dashboard/course-reports", icon: TrendingUp, roles: ["admin", "operator"] as Role[] },

  // ⬇️ v2로 교체: 설문관리(V2)
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
    return currentPath.startsWith(path);
  };

  const sections = [
    { label: "대시보드", keys: ["/dashboard", "/dashboard/course-reports"] },
    { label: "설문", keys: ["/surveys-v2", "/dashboard/results"] }, // ⬅️ v2 반영
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
      </SidebarContent>
    </Sidebar>
  );
}

export default AdminSidebar;
