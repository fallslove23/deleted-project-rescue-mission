import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layouts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Users, Database, Eye, EyeOff, AlertTriangle, CheckCircle, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PagePermission {
  path: string;
  title: string;
  description: string;
  requiredRoles: string[];
  category: 'analytics' | 'management' | 'system';
}

interface PolicyInfo {
  table_name: string;
  policy_name: string;
  command: string;
  roles: string;
  using_expression: string;
  with_check: string;
}

const DashboardPolicyManagement = () => {
  const { userRoles, user } = useAuth();
  const { toast } = useToast();
  const [policies, setPolicies] = useState<PolicyInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = userRoles.includes('admin');

  // 페이지별 권한 설정
  const pagePermissions: PagePermission[] = [
    {
      path: '/dashboard/results',
      title: '결과 분석',
      description: '설문 결과 분석 및 통계 조회',
      requiredRoles: ['admin', 'operator', 'director', 'instructor'],
      category: 'analytics'
    },
    {
      path: '/dashboard/course-reports',
      title: '과정별 결과 보고',
      description: '과정별 상세 분석 리포트',
      requiredRoles: ['admin', 'operator', 'director'],
      category: 'analytics'
    },
    {
      path: '/dashboard/course-statistics',
      title: '과정 통계',
      description: '과정별 통계 및 트렌드 분석',
      requiredRoles: ['admin', 'operator', 'director'],
      category: 'analytics'
    },
    {
      path: '/dashboard/my-stats',
      title: '나의 만족도 통계',
      description: '강사 개인 만족도 통계',
      requiredRoles: ['instructor'],
      category: 'analytics'
    },
    {
      path: '/dashboard/surveys',
      title: '설문 관리',
      description: '설문 생성, 수정, 삭제 및 관리',
      requiredRoles: ['admin', 'operator'],
      category: 'management'
    },
    {
      path: '/dashboard/instructors',
      title: '강사 관리',
      description: '강사 정보 관리 및 계정 연결',
      requiredRoles: ['admin', 'operator'],
      category: 'management'
    },
    {
      path: '/dashboard/users',
      title: '사용자 관리',
      description: '시스템 사용자 및 역할 관리',
      requiredRoles: ['admin'],
      category: 'management'
    },
    {
      path: '/dashboard/courses',
      title: '과목 관리',
      description: '과목 및 프로그램 관리',
      requiredRoles: ['admin', 'operator'],
      category: 'management'
    },
    {
      path: '/dashboard/templates',
      title: '템플릿 관리',
      description: '설문 템플릿 생성 및 관리',
      requiredRoles: ['admin', 'operator'],
      category: 'management'
    },
    {
      path: '/dashboard/email-logs',
      title: '이메일 로그',
      description: '이메일 발송 기록 조회',
      requiredRoles: ['admin', 'operator', 'director'],
      category: 'system'
    },
    {
      path: '/dashboard/system-logs',
      title: '시스템 로그',
      description: '시스템 활동 로그 조회',
      requiredRoles: ['admin'],
      category: 'system'
    },
    {
      path: '/dashboard/cumulative-data',
      title: '누적 데이터',
      description: '누적 통계 데이터 조회',
      requiredRoles: ['admin', 'operator', 'director'],
      category: 'system'
    },
    {
      path: '/dashboard/policy-management',
      title: '정책 관리',
      description: 'RLS 정책 및 권한 관리',
      requiredRoles: ['admin'],
      category: 'system'
    }
  ];

  // 사용자가 접근 가능한 페이지 필터링
  const getAccessiblePages = () => {
    return pagePermissions.filter(page => 
      page.requiredRoles.some(role => userRoles.includes(role))
    );
  };

  // 사용자가 접근 불가능한 페이지 필터링
  const getInaccessiblePages = () => {
    return pagePermissions.filter(page => 
      !page.requiredRoles.some(role => userRoles.includes(role))
    );
  };

  // RLS 정책 정보 (정적 데이터로 우선 구성)
  const fetchPolicies = async () => {
    if (!isAdmin) return;

    // 실제 RLS 정책 정보 (하드코딩으로 우선 구성)
    const staticPolicies: PolicyInfo[] = [
      {
        table_name: 'surveys',
        policy_name: 'Admins and operators manage surveys',
        command: 'ALL',
        roles: 'admin, operator',
        using_expression: 'is_admin() OR is_operator()',
        with_check: 'is_admin() OR is_operator()'
      },
      {
        table_name: 'survey_responses',
        policy_name: 'Instructors can view responses to their surveys',
        command: 'SELECT',
        roles: 'instructor, admin, operator, director',
        using_expression: 'instructor access or privileged roles',
        with_check: ''
      },
      {
        table_name: 'profiles',
        policy_name: 'Allow users to view own profile',
        command: 'SELECT',
        roles: 'authenticated',
        using_expression: 'auth.uid() = id',
        with_check: ''
      },
      {
        table_name: 'user_roles',
        policy_name: 'Admins can manage user roles',
        command: 'ALL',
        roles: 'admin',
        using_expression: 'is_admin()',
        with_check: 'is_admin()'
      },
      {
        table_name: 'instructors',
        policy_name: 'Authenticated users can view instructors',
        command: 'SELECT',
        roles: 'authenticated',
        using_expression: 'true',
        with_check: ''
      }
    ];

    setPolicies(staticPolicies);
    setLoading(false);
  };

  useEffect(() => {
    fetchPolicies();
  }, [isAdmin]);

  // 역할별 색상
  const getRoleColor = (role: string) => {
    const colors = {
      admin: 'bg-red-100 text-red-800',
      operator: 'bg-blue-100 text-blue-800',
      director: 'bg-purple-100 text-purple-800',
      instructor: 'bg-green-100 text-green-800'
    };
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // 카테고리별 색상
  const getCategoryColor = (category: string) => {
    const colors = {
      analytics: 'border-l-blue-500',
      management: 'border-l-green-500',
      system: 'border-l-red-500'
    };
    return colors[category as keyof typeof colors] || 'border-l-gray-500';
  };

  const accessiblePages = getAccessiblePages();
  const inaccessiblePages = getInaccessiblePages();

  return (
    <DashboardLayout
      title="정책 관리"
      subtitle="역할별 권한 및 RLS 정책 관리"
      icon={<Shield className="h-5 w-5 text-white" />}
    >
      <div className="space-y-6">
        {/* 현재 사용자 권한 요약 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              내 권한 정보
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-sm text-muted-foreground">보유 역할:</span>
              {userRoles.map((role) => (
                <Badge key={role} className={getRoleColor(role)}>
                  {role}
                </Badge>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-green-600">접근 가능:</span>
                <span className="ml-2">{accessiblePages.length}개 페이지</span>
              </div>
              <div>
                <span className="font-medium text-red-600">접근 제한:</span>
                <span className="ml-2">{inaccessiblePages.length}개 페이지</span>
              </div>
              <div>
                <span className="font-medium text-blue-600">전체:</span>
                <span className="ml-2">{pagePermissions.length}개 페이지</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="permissions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="permissions">페이지 권한</TabsTrigger>
            <TabsTrigger value="policies" disabled={!isAdmin}>
              RLS 정책 {!isAdmin && '(관리자 전용)'}
            </TabsTrigger>
          </TabsList>

          {/* 페이지 권한 탭 */}
          <TabsContent value="permissions" className="space-y-4">
            {/* 접근 가능한 페이지 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <Eye className="h-5 w-5" />
                  접근 가능한 페이지 ({accessiblePages.length}개)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {accessiblePages.map((page) => (
                    <div 
                      key={page.path}
                      className={`border-l-4 ${getCategoryColor(page.category)} bg-green-50 p-3 rounded-r-lg`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{page.title}</h4>
                          <p className="text-sm text-muted-foreground">{page.description}</p>
                          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded mt-1 inline-block">
                            {page.path}
                          </code>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {page.requiredRoles.map((role) => (
                            <Badge
                              key={role}
                              variant={userRoles.includes(role) ? 'default' : 'secondary'}
                              className={userRoles.includes(role) ? getRoleColor(role) : 'opacity-50'}
                            >
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 접근 제한된 페이지 */}
            {inaccessiblePages.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <EyeOff className="h-5 w-5" />
                    접근 제한된 페이지 ({inaccessiblePages.length}개)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {inaccessiblePages.map((page) => (
                      <div 
                        key={page.path}
                        className={`border-l-4 ${getCategoryColor(page.category)} bg-red-50 p-3 rounded-r-lg opacity-75`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-600">{page.title}</h4>
                            <p className="text-sm text-muted-foreground">{page.description}</p>
                            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded mt-1 inline-block">
                              {page.path}
                            </code>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {page.requiredRoles.map((role) => (
                              <Badge key={role} variant="secondary" className="opacity-50">
                                {role}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* RLS 정책 탭 (관리자 전용) */}
          <TabsContent value="policies" className="space-y-4">
            {isAdmin ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    RLS 정책 현황
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      <p className="text-muted-foreground mt-2">정책 정보를 불러오는 중...</p>
                    </div>
                  ) : (
                    <Alert>
                      <Settings className="h-4 w-4" />
                      <AlertDescription>
                        RLS 정책 조회 기능은 데이터베이스 함수가 필요합니다. 
                        현재는 수동으로 Supabase 대시보드에서 확인해 주세요.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      RLS 정책 관리는 관리자 권한이 필요합니다.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default DashboardPolicyManagement;