import { Users, FileText, BarChart, BookOpen, Home, Star, Mail, ScrollText, UserCheck } from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { useState } from "react"

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
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

const allItems = [
  { title: "개요", url: "/dashboard", icon: Home, roles: ["admin", "operator", "director"] },
  { title: "피드백", url: "/dashboard/my-stats", icon: Star, roles: ["instructor", "admin", "operator", "director"] },
  { title: "결과분석", url: "/dashboard/results", icon: BarChart, roles: ["admin", "operator", "instructor", "director"] },
  { title: "설문관리", url: "/dashboard/surveys", icon: FileText, roles: ["admin", "operator"] },
  { title: "강사관리", url: "/dashboard/instructors", icon: Users, roles: ["admin", "operator"] },
  { title: "사용자관리", url: "/dashboard/users", icon: Users, roles: ["admin"] },
  { title: "과목관리", url: "/dashboard/courses", icon: BookOpen, roles: ["admin", "operator"] },
  { title: "템플릿관리", url: "/dashboard/templates", icon: BookOpen, roles: ["admin", "operator"] },
  { title: "이메일 로그", url: "/dashboard/email-logs", icon: Mail, roles: ["admin", "operator"] },
  { title: "시스템 로그", url: "/dashboard/system-logs", icon: ScrollText, roles: ["admin"] },
]

export function AdminSidebar() {
  const { state } = useSidebar()
  const { userRoles } = useAuth()
  const location = useLocation()
  const currentPath = location.pathname
  const [viewAsRole, setViewAsRole] = useState<string | null>(null)

  // 사용자 역할에 따라 필터링된 메뉴 항목 (권한별 뷰가 활성화된 경우 해당 권한으로 필터링)
  const effectiveRoles = viewAsRole ? [viewAsRole] : userRoles
  const items = allItems.filter((item) =>
    item.roles.some((role) => effectiveRoles.includes(role))
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
  { label: "관리", keys: ["/dashboard/surveys", "/dashboard/instructors", "/dashboard/users", "/dashboard/courses", "/dashboard/templates"] },
  { label: "기록", keys: ["/dashboard/email-logs", "/dashboard/system-logs"] },
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
      
      {userRoles.includes('admin') && (
        <SidebarFooter className="p-2 border-t border-border/50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-between"
              >
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  {state === "expanded" && (
                    <span className="text-xs">
                      {viewAsRole ? `${viewAsRole} 권한으로 보기` : "관리자 뷰"}
                    </span>
                  )}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem 
                onClick={() => setViewAsRole(null)}
                className={!viewAsRole ? "bg-accent" : ""}
              >
                관리자 (기본)
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setViewAsRole('operator')}
                className={viewAsRole === 'operator' ? "bg-accent" : ""}
              >
                운영자 권한으로 보기
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setViewAsRole('instructor')}
                className={viewAsRole === 'instructor' ? "bg-accent" : ""}
              >
                강사 권한으로 보기
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setViewAsRole('director')}
                className={viewAsRole === 'director' ? "bg-accent" : ""}
              >
                책임자 권한으로 보기
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  )
}
