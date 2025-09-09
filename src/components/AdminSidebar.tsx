// src/components/AdminSidebar.tsx
import { NavLink, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { 
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, 
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem 
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, BarChart3, Users, UserCheck, BookOpen, FileText, 
  Mail, Settings, TrendingUp, Award, PieChart, Database
} from "lucide-react";

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
    <Sidebar className="border-r bg-sidebar">
      <style>
        {`
          [data-sidebar="menu-button"] {
            color: #7c3aed !important;
          }
          [data-sidebar="menu-button"]:hover {
            color: #6d28d9 !important;
            background-color: rgba(124, 58, 237, 0.1) !important;
          }
          [data-sidebar="menu-button"][data-active="true"] {
            background-color: #7c3aed !important;
            color: white !important;
          }
          .sidebar-menu-item {
            color: #7c3aed !important;
          }
          .sidebar-menu-item:hover {
            color: #6d28d9 !important;
          }
          .sidebar-menu-item svg {
            color: inherit !important;
          }
        `}
      </style>
      <SidebarContent className="bg-sidebar">
        {menuItems.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel className="font-light text-xs uppercase tracking-wider px-3 py-2" style={{ color: '#7c3aed' }}>
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
                        className="sidebar-menu-item flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-light transition-colors duration-200"
                        style={{ color: '#7c3aed !important' }}
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        <span className="font-light">{item.title}</span>
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