import { useState } from "react"
import { Users, FileText, BarChart, BookOpen, Home, Menu } from "lucide-react"
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
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"

const allItems = [
  { title: "개요", url: "/dashboard", icon: Home, roles: ["admin", "operator"] },
  { title: "설문관리", url: "/dashboard/surveys", icon: FileText, roles: ["admin", "operator"] },
  { title: "결과분석", url: "/dashboard/results", icon: BarChart, roles: ["admin", "operator", "instructor", "director"] },
  { title: "강사관리", url: "/dashboard/instructors", icon: Users, roles: ["admin", "operator"] },
  { title: "템플릿관리", url: "/dashboard/templates", icon: BookOpen, roles: ["admin", "operator"] },
]

export function AdminSidebar() {
  const { state } = useSidebar()
  const { userRoles } = useAuth()
  const location = useLocation()
  const currentPath = location.pathname

  // 사용자 역할에 따라 필터링된 메뉴 항목
  const items = allItems.filter(item => 
    item.roles.some(role => userRoles.includes(role))
  )

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return currentPath === '/dashboard'
    }
    return currentPath.startsWith(path)
  }

  const isExpanded = items.some((i) => isActive(i.url))

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-white text-primary font-medium shadow-sm" : "hover:bg-white/50 text-muted-foreground"

  return (
    <Sidebar
      className={state === "collapsed" ? "w-14" : "w-60"}
    >
      <SidebarContent className="bg-gradient-to-b from-primary/5 to-primary/10">
        <SidebarGroup>
          <SidebarGroupLabel className="text-primary font-semibold">
            {state === "expanded" && "관리자 메뉴"}
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end={item.url === '/dashboard'}
                      className={({ isActive }) => `${getNavCls({ isActive })} rounded-lg transition-all duration-200 flex items-center justify-start px-3 py-2`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {state === "expanded" && <span className="ml-3">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}