// src/components/AdminSidebar.tsx
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { 
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, 
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem 
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, BarChart3, Users, UserCheck, BookOpen, FileText, 
  Mail, Settings, Eye, TrendingUp, Award, PieChart, Database
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
        { title: "대시보드", url: "/dashboard", icon: LayoutDashboard, exact: true }
      ]
    },
    {
      title: "설문",
      items: [
        { title: "결과분석", url: "/dashboard/results", icon: BarChart3, exact: false },
        { title: "과정 리포트", url: "/dashboard/course-reports", icon: TrendingUp, exact: false },
        { title: "과정 통계", url: "/dashboard/course-statistics", icon: PieChart, exact: false },
        { title: "템플릿관리", url: "/dashboard/templates", icon: FileText, exact: false }
      ]
    },
    {
      title: "관리",
      items: [
        { title: "설문관리", url: "/surveys-v2", icon: FileText, exact: false },
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
        { title: "누적 데이터", url: "/dashboard/cumulative-data", icon: Database, exact: false }
      ]
    }
  ];

  // 강사 전용 메뉴
  const instructorMenuItems = [
    {
      title: "내 피드백",
      items: [
        { title: "나의 만족도 통계", url: "/dashboard/my-stats", icon: Award, exact: false },
        { title: "과정별 결과 보고", url: "/dashboard/course-reports", icon: TrendingUp, exact: false }
      ]
    },
    {
      title: "설문",
      items: [
        { title: "결과분석", url: "/dashboard/results", icon: BarChart3, exact: false },
        { title: "템플릿관리", url: "/dashboard/templates", icon: FileText, exact: false }
      ]
    },
    {
      title: "관리",
      items: [
        { title: "설문관리", url: "/surveys-v2", icon: FileText, exact: false },
        { title: "강사관리", url: "/dashboard/instructors", icon: UserCheck, exact: false }
      ]
    }
  ];

  // 현재 사용자에 맞는 메뉴 선택
  const menuItems = isAdmin ? adminMenuItems : instructorMenuItems;

  return (
    <Sidebar className="bg-purple-100 border-r border-purple-200">
      <SidebarContent className="bg-purple-100">
        {menuItems.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel className="font-sans text-purple-900 font-semibold">
              {section.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.exact}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all font-sans ${
                            isActive 
                              ? 'bg-purple-600 text-white' 
                              : 'text-purple-900 hover:bg-purple-500 hover:text-white'
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
            <SidebarGroupLabel className="font-sans text-purple-900 font-semibold">
              뷰 테스트 <span className="text-xs bg-purple-600 text-white px-1 rounded font-sans dev-tag">DEV</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton className="w-full justify-between text-purple-800 hover:bg-purple-500 hover:text-white">
                        <div className="flex items-center gap-3">
                          <Eye className="h-4 w-4" />
                          <span className="font-sans">뷰 선택</span>
                        </div>
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-white border-purple-200">
                      <DropdownMenuItem asChild>
                        <NavLink 
                          to="/role-view/admin" 
                          className="flex items-center gap-2 cursor-pointer font-sans hover:bg-purple-100"
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          관리자 뷰
                        </NavLink>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <NavLink 
                          to="/role-view/instructor" 
                          className="flex items-center gap-2 cursor-pointer font-sans hover:bg-purple-100"
                        >
                          <UserCheck className="h-4 w-4" />
                          강사 뷰
                        </NavLink>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <NavLink 
                          to="/" 
                          className="flex items-center gap-2 cursor-pointer font-sans hover:bg-purple-100"
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