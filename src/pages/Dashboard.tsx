// src/pages/Dashboard.tsx
import React from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  BookOpenCheck,
  Users,
  UserCog,
  Settings,
  ClipboardList,
  ClipboardCheck,
  Mail,
  FileText,
  LayoutDashboard,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

type Section = {
  id: string;
  title: string;
  description: string;
  to: string;
  icon: React.ElementType;
};

const sections: Section[] = [
  {
    id: "survey-results",
    title: "Survey Results",
    description: "설문 결과 집계 및 분석 보기",
    to: "/surveys/results",
    icon: BarChart3,
  },
  {
    id: "course-reports",
    title: "Course Reports",
    description: "과정별 리포트와 성과 지표",
    to: "/reports/courses",
    icon: BookOpenCheck,
  },
  {
    id: "instructor-management",
    title: "Instructor Management",
    description: "강사 정보 및 배정 관리",
    to: "/management/instructors",
    icon: Users,
  },
  {
    id: "user-management",
    title: "User Management",
    description: "사용자 계정, 권한, 비밀번호 정책",
    to: "/management/users",
    icon: UserCog,
  },
  {
    id: "course-management",
    title: "Course Management",
    description: "과정 생성/편집, 커리큘럼 관리",
    to: "/management/courses",
    icon: ClipboardList,
  },
  {
    id: "personal-dashboard",
    title: "Personal Dashboard",
    description: "나의 업무 현황과 위젯",
    to: "/me/dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "template-management",
    title: "Template Management",
    description: "설문/이메일/문서 템플릿 관리",
    to: "/management/templates",
    icon: ClipboardCheck,
  },
  {
    id: "email-logs",
    title: "Email Logs",
    description: "이메일 발송 이력 및 실패 로그",
    to: "/logs/emails",
    icon: Mail,
  },
  {
    id: "system-logs",
    title: "System Logs",
    description: "시스템 이벤트 및 오류 로그",
    to: "/logs/system",
    icon: FileText,
  },
];

export default function Dashboard() {
  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            주요 기능으로 빠르게 이동하세요.
          </p>
        </div>
        <Link to="/settings">
          <Button variant="outline" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </Link>
      </div>

      <Separator className="mb-6" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map(({ id, title, description, to, icon: Icon }) => (
          <Link key={id} to={to}>
            <Card className="transition hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">{title}</CardTitle>
                <Icon className="h-5 w-5" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
