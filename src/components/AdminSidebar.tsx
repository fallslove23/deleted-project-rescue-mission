// src/components/AdminSidebar.tsx
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { 
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, 
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem 
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, BarChart3, Users, UserCheck, BookOpen, FileText, 
  Mail, Settings, Eye, TrendingUp, Award, PieChart, Database, BarChart
} from "lucide-react";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export function AdminSidebar() {
  const { userRoles } = useAuth();
  const location = useLocation();
  
  const isAdmin = userRoles.includes('admin');
  const isInstructor = userRoles.includes('instructor');

  // 관리자 전용 메뉴
  const adminMenuItems = [
    {
      title: "개요",
      items: [
        { title: "대시보드", url: "/dashboard", icon: LayoutDashboard }
      ]
    },
    {
      title: "설문",
      items: [
        { title: "결과분석", url: "/dashboard/survey-results", icon: BarChart3 },
        { title: "과정 리포트", url: "/dashboard/course-reports", icon: TrendingUp },
        { title: "과정 통계", url: "/dashboard/course-statistics", icon: PieChart },
        { title: "템플릿관리", url: "/dashboard/templates", icon: FileText }
      ]
    },
    {
      title: "관리",
      items: [
        { title: "설문관리", url: "/dashboard/survey-management-v2", icon: FileText },
        { title: "강사관리", url: "/dashboard/instructors", icon: UserCheck },
        { title: "사용자관리", url: "/dashboard/users", icon: Users },
        { title: "과목관리", url: "/dashboard/courses", icon: BookOpen }
      ]
    },
    {
      title: "기타",
      items: [
        { title: "이메일 로그", url: "/dashboard/email-logs", icon: Mail },
        { title: "시스템 로그", url: "/dashboard/system-logs", icon: Settings },
        { title: "누적 데이터", url: "/dashboard/cumulative-data", icon: Database }
      ]
    }
  ];

  // 강사 전용 메뉴
  const instructorMenuItems = [
    {
      title: "내 피드백",
      items: [
        { title: "나의 만족도 통계", url: "/dashboard/my-stats", icon: Award },
        { title: "과정별 결과 보고", url: "/dashboard/course-reports", icon: TrendingUp }
      ]
    },
    {
      title: "설문",
      items: [
        { title: "결과분석", url: "/dashboard/survey-results", icon: BarChart3 },
        { title: "템플릿관리", url: "/dashboard/templates", icon: FileText }
      ]
    },
    {
      title: "관리",
      items: [
        { title: "설문관리", url: "/dashboard/survey-management-v2", icon: FileText },
        { title: "강사관리", url: "/dashboard/instructors", icon: UserCheck }
      ]
    }
  ];

  // 현재 사용자에 맞는 메뉴 선택
  const menuItems = isAdmin ? adminMenuItems : instructorMenuItems;

  return (
    <Sidebar>
      <SidebarContent>
        {menuItems.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel className="font-sans">{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent font-sans ${
                            isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                          }`
                        }
                      >
                        <item.icon className="h-4 w-4" />
                        {item.title}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {/* 관리자 전용 - 뷰 테스트 섹션 */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="font-sans">
              뷰 테스트 <span className="text-xs bg-purple-500 text-white px-1 rounded font-sans dev-tag">DEV</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton className="w-full justify-between">
                        <div className="flex items-center gap-3">
                          <Eye className="h-4 w-4" />
                          <span className="font-sans">뷰 선택</span>
                        </div>
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem asChild>
                        <NavLink 
                          to="/role-view/admin" 
                          className="flex items-center gap-2 cursor-pointer font-sans"
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          관리자 뷰
                        </NavLink>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <NavLink 
                          to="/role-view/instructor" 
                          className="flex items-center gap-2 cursor-pointer font-sans"
                        >
                          <UserCheck className="h-4 w-4" />
                          강사 뷰
                        </NavLink>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <NavLink 
                          to="/" 
                          className="flex items-center gap-2 cursor-pointer font-sans"
                        >
                          <Users className="h-4 w-4" />
                          교육생 뷰
                        </NavLink>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}