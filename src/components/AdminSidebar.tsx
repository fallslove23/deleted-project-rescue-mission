import { Users, FileText, BarChart, BookOpen, Home, Star, Mail } from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"

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
} from "@/components/ui/sidebar"

const allItems = [
  { title: "개요", url: "/dashboard", icon: Home, roles: ["admin", "operator"] },
  { title: "내 피드백", url: "/dashboard/my-stats", icon: Star, roles: ["instructor", "admin", "operator", "director"] },
  { title: "결과분석", url: "/dashboard/results", icon: BarChart, roles: ["admin", "operator", "instructor", "director"] },
  { title: "설문관리", url: "/dashboard/surveys", icon: FileText, roles: ["admin", "operator"] },
  { title: "강사관리", url: "/dashboard/instructors", icon: Users, roles: ["admin", "operator"] },
  { title: "과목관리", url: "/dashboard/courses", icon: BookOpen, roles: ["admin", "operator"] },
  { title: "템플릿관리", url: "/dashboard/templates", icon: BookOpen, roles: ["admin", "operator"] },
  { title: "이메일 로그", url: "/dashboard/email-logs", icon: Mail, roles: ["admin", "operator", "director"] },
]

export function AdminSidebar() {
  const { state } = useSidebar()
  const { userRoles } = useAuth()
  const location = useLocation()
  const currentPath = location.pathname

  // 사용자 역할에 따라 필터링된 메뉴 항목
  const items = allItems.filter((item) =>
    item.roles.some((role) => userRoles.includes(role))
  )

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return currentPath === "/dashboard"
    }
    return currentPath.startsWith(path)
  }

const sections = [
  { label: "대시보드", keys: ["/dashboard"] },
  { label: "설문", keys: ["/dashboard/results", "/dashboard/my-stats"] },
  { label: "관리", keys: ["/dashboard/surveys", "/dashboard/instructors", "/dashboard/courses", "/dashboard/templates", "/dashboard/email-logs"] },
]


  const sectionItems = sections
    .map((section) => ({
      ...section,
      items: items.filter((i) => section.keys.includes(i.url)),
    }))
    .filter((sec) => sec.items.length > 0)

  return (
    <Sidebar className={state === "collapsed" ? "w-14" : "w-60"}>
      <SidebarContent className="bg-gradient-to-b from-primary/5 to-primary/10">
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
                      <NavLink
                        to={item.url}
                        end={item.url === "/dashboard"}
                        className="flex items-center"
                      >
                        <item.icon className="h-4 w-4" />
                        {state === "expanded" && (
                          <span className="ml-2">{item.title}</span>
                        )}
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
  )
}
