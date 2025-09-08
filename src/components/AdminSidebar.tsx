// src/components/AdminSidebar.tsx
import { NavLink, useLocation, useSearchParams } from "react-router-dom";
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
  const [searchParams] = useSearchParams();
  
  const viewMode = searchParams.get('view'); // URL에서 view 파라미터 읽기
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
        { title: "과정 결과 보고", url: "/dashboard/course-reports", icon: TrendingUp, exact: false },
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
    }
  ];

  // 교육생 뷰 메뉴 (오늘의 설문만)
  const studentMenuItems = [
    {
      title: "설문",
      items: [
        { title: "오늘의 설문", url: "/", icon: FileText, exact: true }
      ]
    }
  ];

  // 강사 뷰 메뉴 (결과 분석 및 과정 통계)
  const instructorViewMenuItems = [
    {
      title: "설문 분석",
      items: [
        { title: "결과분석", url: "/dashboard/results", icon: BarChart3, exact: false },
        { title: "과정 통계", url: "/dashboard/course-statistics", icon: PieChart, exact: false }
      ]
    }
  ];

  // view 모드에 따른 메뉴 선택
  let menuItems;
  if (viewMode === 'student') {
    menuItems = studentMenuItems;
  } else if (viewMode === 'instructor') {
    menuItems = instructorViewMenuItems;
  } else if (viewMode === 'admin') {
    menuItems = adminMenuItems;
  } else {
    // 기본: 사용자 역할에 따른 메뉴
    menuItems = isAdmin ? adminMenuItems : instructorMenuItems;
  }

  return (
    <Sidebar 
      className="border-r"
      style={{ backgroundColor: 'rgba(243, 232, 255, 0.5)' }}
    >
      <SidebarContent style={{ backgroundColor: 'rgba(243, 232, 255, 0.5)' }}>
        {menuItems.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel 
              className="font-semibold text-xs uppercase tracking-wider px-3 py-2"
              style={{ color: '#581c87' }}
            >
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
                          `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                            isActive 
                              ? 'bg-primary text-primary-foreground shadow-sm' 
                              : 'hover:bg-purple-100'
                          }`
                        }
                        style={({ isActive }) => ({
                          color: isActive ? undefined : '#374151',
                        })}
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        <span className="font-semibold">{item.title}</span>
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
            <SidebarGroupLabel 
              className="font-semibold text-xs uppercase tracking-wider px-3 py-2"
              style={{ color: '#581c87' }}
            >
              뷰 테스트 <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded">DEV</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton 
                        className="w-full justify-between hover:bg-purple-100 transition-colors duration-200"
                        style={{ color: '#374151' }}
                      >
                        <div className="flex items-center gap-3">
                          <Eye className="h-4 w-4 flex-shrink-0" />
                          <span className="font-semibold">뷰 선택</span>
                        </div>
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-popover border shadow-lg">
                      <DropdownMenuItem asChild>
                        <NavLink 
                          to="/dashboard?view=admin" 
                          className="flex items-center gap-2 cursor-pointer hover:bg-accent px-2 py-1.5 rounded-sm transition-colors"
                          style={{ color: '#374151' }}
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          관리자 뷰
                        </NavLink>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <NavLink 
                          to="/dashboard/results?view=instructor" 
                          className="flex items-center gap-2 cursor-pointer hover:bg-accent px-2 py-1.5 rounded-sm transition-colors"
                          style={{ color: '#374151' }}
                        >
                          <UserCheck className="h-4 w-4" />
                          강사 뷰
                        </NavLink>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <NavLink 
                          to="/?view=student" 
                          className="flex items-center gap-2 cursor-pointer hover:bg-accent px-2 py-1.5 rounded-sm transition-colors"
                          style={{ color: '#374151' }}
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