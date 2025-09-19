// src/components/AdminSidebar.tsx
import { NavLink, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { 
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, 
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem 
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, BarChart3, Users, UserCheck, BookOpen, FileText, 
  Mail, Settings, TrendingUp, Award, PieChart, Database, Code, Shield
} from "lucide-react";

export function AdminSidebar() {
  const { userRoles, user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const viewMode = searchParams.get('view'); // URL에서 view 파라미터 읽기
  const isAdmin = userRoles.includes('admin');
  const isInstructor = userRoles.includes('instructor');
  const isDeveloper = user?.email === 'sethetrend87@osstem.com';

  // 메뉴 구성 함수
  const getMenuItems = () => {
    const baseAdminMenuItems = [
      {
        title: "개요",
        items: [
          { title: "대시보드", url: "/dashboard", icon: LayoutDashboard, exact: true }
        ]
      },
      {
        title: "분석",
        items: [
          { title: "결과분석", url: "/dashboard/results", icon: BarChart3, exact: false },
          ...(isInstructor ? [{ title: "나의 만족도 통계", url: "/dashboard/my-stats", icon: Award, exact: false }] : []),
          { title: "과정별 결과 보고", url: "/dashboard/course-reports", icon: TrendingUp, exact: false },
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
          { title: "정책 관리", url: "/dashboard/policy-management", icon: Shield, exact: false },
          { title: "누적 데이터", url: "/dashboard/cumulative-data", icon: Database, exact: false }
        ]
      }
    ];

    const baseInstructorMenuItems = [
      {
        title: "분석",
        items: [
          { title: "결과분석", url: "/dashboard/results", icon: BarChart3, exact: false },
          { title: "나의 만족도 통계", url: "/dashboard/my-stats", icon: Award, exact: false }
        ]
      }
    ];

    return { baseAdminMenuItems, baseInstructorMenuItems };
  };

  const { baseAdminMenuItems, baseInstructorMenuItems } = getMenuItems();


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
    menuItems = baseAdminMenuItems;
  } else {
    // 기본: 사용자 역할에 따른 메뉴 (관리자 권한이 있으면 관리자 메뉴, 없으면 강사 메뉴)
    menuItems = isAdmin ? baseAdminMenuItems : baseInstructorMenuItems;
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
          /* 개발자 도구 스타일 */
          .sidebar-menu-item[style*="ef4444"] {
            color: #ef4444 !important;
          }
          .sidebar-menu-item[style*="ef4444"]:hover {
            color: #dc2626 !important;
            background-color: rgba(239, 68, 68, 0.1) !important;
          }
          .sidebar-menu-item[style*="ef4444"].active {
            background-color: #ef4444 !important;
            color: white !important;
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
                    <NavLink to={item.url} end={item.exact}>
                      {({ isActive }) => (
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className="sidebar-menu-item flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-light transition-colors duration-200"
                          style={{ color: '#7c3aed !important' }}
                        >
                          <span className="flex items-center gap-3">
                            <item.icon className="h-4 w-4 flex-shrink-0" />
                            <span className="font-light">{item.title}</span>
                          </span>
                        </SidebarMenuButton>
                      )}
                    </NavLink>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        
        {/* 개발자 전용 섹션 */}
        {isDeveloper && (
          <SidebarGroup className="mt-auto border-t pt-4">
            <SidebarGroupLabel className="font-light text-xs uppercase tracking-wider px-3 py-2" style={{ color: '#ef4444' }}>
              개발자 도구
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <NavLink to="/developer-test">
                    {({ isActive }) => (
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className="sidebar-menu-item flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-light transition-colors duration-200"
                        style={{ color: '#ef4444 !important' }}
                      >
                        <span className="flex items-center gap-3">
                          <Code className="h-4 w-4 flex-shrink-0" />
                          <span className="font-light">테스트 화면</span>
                        </span>
                      </SidebarMenuButton>
                    )}
                  </NavLink>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}