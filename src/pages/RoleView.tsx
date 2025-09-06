// src/pages/RoleView.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Crown,
  Shield,
  UserCheck,
  UserCog,
  Eye,
  BarChart,
  Users,
  FileText,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  Home,
  BookOpen,
  Mail,
  ScrollText,
  FileSpreadsheet,
  Settings,
} from "lucide-react";

type RoleType = "admin" | "operator" | "instructor" | "director";

interface RoleConfig {
  title: string;
  icon: React.ComponentType<any>;
  color: string;
  description: string;
  permissions: string[];
  availablePages: Array<{
    title: string;
    url: string;
    icon: React.ComponentType<any>;
    description: string;
  }>;
  statistics: Array<{
    title: string;
    description: string;
    visible: boolean;
  }>;
}

const roleConfigs: Record<RoleType, RoleConfig> = {
  admin: {
    title: "관리자",
    icon: Crown,
    color: "text-red-600",
    description: "시스템 전체 관리 권한을 가진 최고 관리자",
    permissions: [
      "전체 설문 관리",
      "사용자 관리",
      "시스템 로그 조회",
      "모든 통계 데이터 접근",
      "시스템 설정 변경",
    ],
    availablePages: [
      { title: "대시보드 개요", url: "/dashboard", icon: Home, description: "시스템 전체 현황" },
      { title: "설문 관리", url: "/surveys-v2", icon: FileText, description: "모든 설문 생성/편집/삭제" },
      { title: "결과 분석", url: "/dashboard/results", icon: BarChart, description: "모든 설문 결과 분석" },
      { title: "결과 보고", url: "/dashboard/course-reports", icon: TrendingUp, description: "과정별 종합 보고서" },
      { title: "강사 관리", url: "/dashboard/instructors", icon: Users, description: "강사 계정 관리" },
      { title: "사용자 관리", url: "/dashboard/users", icon: Users, description: "전체 사용자 관리" },
      { title: "과목 관리", url: "/dashboard/courses", icon: BookOpen, description: "과목 및 커리큘럼 관리" },
      { title: "통계 관리", url: "/dashboard/course-statistics", icon: FileSpreadsheet, description: "과정별 통계 관리" },
      { title: "템플릿 관리", url: "/dashboard/templates", icon: Settings, description: "설문 템플릿 관리" },
      { title: "이메일 로그", url: "/dashboard/email-logs", icon: Mail, description: "시스템 이메일 로그" },
      { title: "시스템 로그", url: "/dashboard/system-logs", icon: ScrollText, description: "시스템 활동 로그" },
    ],
    statistics: [
      { title: "전체 사용자 수", description: "시스템에 등록된 모든 사용자", visible: true },
      { title: "전체 설문 수", description: "생성된 모든 설문조사", visible: true },
      { title: "전체 응답 수", description: "모든 설문의 응답 현황", visible: true },
      { title: "시스템 성능", description: "서버 및 데이터베이스 상태", visible: true },
      { title: "사용자 활동", description: "최근 사용자 접속 및 활동", visible: true },
    ],
  },
  operator: {
    title: "운영자",
    icon: Shield,
    color: "text-blue-600",
    description: "설문 및 과정 운영을 담당하는 관리자",
    permissions: [
      "설문 생성/편집/삭제",
      "과정 관리",
      "강사 관리",
      "결과 분석",
      "보고서 생성",
    ],
    availablePages: [
      { title: "대시보드 개요", url: "/dashboard", icon: Home, description: "운영 현황 대시보드" },
      { title: "설문 관리", url: "/surveys-v2", icon: FileText, description: "설문 생성 및 관리" },
      { title: "결과 분석", url: "/dashboard/results", icon: BarChart, description: "설문 결과 분석" },
      { title: "결과 보고", url: "/dashboard/course-reports", icon: TrendingUp, description: "과정별 보고서" },
      { title: "강사 관리", url: "/dashboard/instructors", icon: Users, description: "강사 정보 관리" },
      { title: "과목 관리", url: "/dashboard/courses", icon: BookOpen, description: "과목 관리" },
      { title: "통계 관리", url: "/dashboard/course-statistics", icon: FileSpreadsheet, description: "과정 통계" },
      { title: "템플릿 관리", url: "/dashboard/templates", icon: Settings, description: "설문 템플릿" },
      { title: "이메일 로그", url: "/dashboard/email-logs", icon: Mail, description: "이메일 발송 로그" },
    ],
    statistics: [
      { title: "담당 설문 수", description: "운영중인 설문조사", visible: true },
      { title: "과정별 진행률", description: "각 과정의 설문 진행 상황", visible: true },
      { title: "응답률 현황", description: "설문별 응답률 통계", visible: true },
      { title: "강사별 현황", description: "강사별 설문 및 응답 현황", visible: true },
      { title: "시스템 성능", description: "서버 상태 (제한적 접근)", visible: false },
    ],
  },
  instructor: {
    title: "강사",
    icon: UserCheck,
    color: "text-green-600",
    description: "개별 강사의 통계 및 설문 결과를 확인",
    permissions: [
      "본인 강의 설문 결과 조회",
      "개인 통계 확인",
      "과정 만족도 조회",
      "개별 통계 다운로드",
    ],
    availablePages: [
      { title: "개인 통계", url: "/dashboard/my-stats", icon: BarChart, description: "개인 강의 통계" },
      { title: "설문 결과", url: "/dashboard/results", icon: TrendingUp, description: "담당 설문 결과 (필터링됨)" },
      { title: "상세 분석", url: "/survey-detailed-analysis", icon: FileSpreadsheet, description: "설문별 상세 분석" },
    ],
    statistics: [
      { title: "담당 과정 수", description: "현재 담당하고 있는 과정", visible: true },
      { title: "설문 참여율", description: "강의별 설문 참여율", visible: true },
      { title: "만족도 평균", description: "전체 강의 만족도 평균", visible: true },
      { title: "개선 포인트", description: "학습자 피드백 요약", visible: true },
      { title: "전체 시스템 통계", description: "다른 강사들의 통계", visible: false },
    ],
  },
  director: {
    title: "조직장",
    icon: UserCog,
    color: "text-purple-600",
    description: "조직 전체의 교육 성과를 관리하는 책임자",
    permissions: [
      "조직 전체 설문 결과 조회",
      "모든 과정 결과 분석",
      "종합 보고서 접근",
      "과정별 비교 분석",
    ],
    availablePages: [
      { title: "개인 통계", url: "/dashboard/my-stats", icon: BarChart, description: "조직장 개인 통계" },
      { title: "설문 결과", url: "/dashboard/results", icon: TrendingUp, description: "조직 전체 설문 결과" },
      { title: "결과 보고", url: "/dashboard/course-reports", icon: FileSpreadsheet, description: "조직별 종합 보고서" },
      { title: "상세 분석", url: "/survey-detailed-analysis", icon: BarChart, description: "과정별 상세 분석" },
    ],
    statistics: [
      { title: "조직 전체 과정 수", description: "관리하는 모든 교육 과정", visible: true },
      { title: "조직 만족도", description: "조직 전체 교육 만족도", visible: true },
      { title: "과정별 성과", description: "각 과정의 성과 비교", visible: true },
      { title: "강사별 성과", description: "소속 강사들의 성과", visible: true },
      { title: "시스템 관리", description: "시스템 설정 및 관리", visible: false },
    ],
  },
};

export default function RoleView() {
  const { role } = useParams<{ role: RoleType }>();
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState("overview");

  const config = role ? roleConfigs[role] : null;

  if (!config) {
    return (
      <DashboardLayout title="역할별 뷰" description="잘못된 역할입니다">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            유효하지 않은 역할입니다. 올바른 역할을 선택해주세요.
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  const IconComponent = config.icon;

  return (
    <DashboardLayout 
      title={`${config.title} 뷰 테스트`} 
      description="개발자용 역할별 화면 확인"
    >
      <div className="space-y-6">
        {/* 역할 정보 헤더 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg bg-gray-100 ${config.color}`}>
                <IconComponent className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <CardTitle className="text-2xl">{config.title} 역할</CardTitle>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    <Eye className="h-3 w-3 mr-1" />
                    테스트 모드
                  </Badge>
                </div>
                <p className="text-muted-foreground">{config.description}</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Tabs value={currentTab} onValueChange={setCurrentTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">개요</TabsTrigger>
            <TabsTrigger value="pages">접근 가능 페이지</TabsTrigger>
            <TabsTrigger value="statistics">통계 권한</TabsTrigger>
            <TabsTrigger value="permissions">권한 목록</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">접근 가능 페이지</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{config.availablePages.length}개</div>
                  <p className="text-xs text-muted-foreground">이 역할로 접근할 수 있는 페이지 수</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">보이는 통계</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {config.statistics.filter(s => s.visible).length}/{config.statistics.length}개
                  </div>
                  <p className="text-xs text-muted-foreground">접근 가능한 통계 데이터</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">권한 수</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{config.permissions.length}개</div>
                  <p className="text-xs text-muted-foreground">부여된 권한 항목</p>
                </CardContent>
              </Card>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                이 화면은 개발자가 각 역할별로 어떤 화면과 기능에 접근할 수 있는지 테스트하기 위한 페이지입니다.
                실제 사용자에게는 보이지 않습니다.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="pages" className="space-y-4">
            <div className="grid gap-4">
              <h3 className="text-lg font-semibold">접근 가능한 페이지 목록</h3>
              {config.availablePages.map((page, index) => {
                const PageIcon = page.icon;
                return (
                  <Card key={index} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <PageIcon className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <h4 className="font-medium">{page.title}</h4>
                            <p className="text-sm text-muted-foreground">{page.description}</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(page.url)}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          열기
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="statistics" className="space-y-4">
            <div className="grid gap-4">
              <h3 className="text-lg font-semibold">통계 데이터 접근 권한</h3>
              {config.statistics.map((stat, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{stat.title}</h4>
                          <Badge variant={stat.visible ? "default" : "secondary"}>
                            {stat.visible ? "접근 가능" : "접근 제한"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{stat.description}</p>
                      </div>
                      <div className="ml-4">
                        {stat.visible ? (
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        ) : (
                          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4">
            <div className="grid gap-4">
              <h3 className="text-lg font-semibold">부여된 권한 목록</h3>
              <div className="grid gap-2">
                {config.permissions.map((permission, index) => (
                  <Card key={index}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm">{permission}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* 빠른 테스트 링크 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">빠른 테스트</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {config.availablePages.slice(0, 4).map((page, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(page.url)}
                  className="justify-start"
                >
                  <page.icon className="h-4 w-4 mr-2" />
                  {page.title}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}