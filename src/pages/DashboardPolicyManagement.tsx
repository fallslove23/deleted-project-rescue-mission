import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layouts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Users, Database, Eye, EyeOff, AlertTriangle, CheckCircle, Settings, UserCog } from 'lucide-react';
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
  is_enabled: boolean;
}

interface UserPermission {
  id: string;
  email: string;
  roles: string[];
  created_at: string;
}

const DashboardPolicyManagement = () => {
  const { userRoles, user } = useAuth();
  const { toast } = useToast();
  const [policies, setPolicies] = useState<PolicyInfo[]>([]);
  const [users, setUsers] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);

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

  // RLS 정책 정보 조회 (DB 함수 호출)
  const fetchPolicies = async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_rls_policies');
      if (error) throw error;
      setPolicies((data || []) as PolicyInfo[]);
    } catch (e: any) {
      console.error('Failed to load RLS policies', e);
      toast({
        title: '정책 조회 실패',
        description: e.message || '오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // 전체 사용자 권한 정보 조회
  const fetchUsers = async () => {
    if (!isAdmin) {
      setUsersLoading(false);
      return;
    }

    try {
      setUsersLoading(true);
      
      // 먼저 모든 프로필을 가져옴
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // 각 사용자의 역할을 별도로 조회
      const usersWithRoles = await Promise.all(
        (profilesData || []).map(async (profile) => {
          const { data: rolesData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id);

          return {
            id: profile.id,
            email: profile.email || '',
            roles: rolesData?.map(r => r.role) || [],
            created_at: profile.created_at
          };
        })
      );

      setUsers(usersWithRoles);
    } catch (e: any) {
      console.error('Failed to load users', e);
      toast({
        title: '사용자 조회 실패',
        description: e.message || '오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
    fetchUsers();
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

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users" disabled={!isAdmin}>
              사용자 권한 {!isAdmin && '(관리자 전용)'}
            </TabsTrigger>
            <TabsTrigger value="permissions">페이지 권한</TabsTrigger>
            <TabsTrigger value="policies" disabled={!isAdmin}>
              RLS 정책 {!isAdmin && '(관리자 전용)'}
            </TabsTrigger>
          </TabsList>

          {/* 사용자 권한 관리 탭 (관리자 전용) */}
          <TabsContent value="users" className="space-y-4">
            {isAdmin ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCog className="h-5 w-5" />
                    전체 사용자 권한 관리
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {usersLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      <p className="text-muted-foreground mt-2">사용자 정보를 불러오는 중...</p>
                    </div>
                  ) : users.length === 0 ? (
                    <Alert>
                      <Users className="h-4 w-4" />
                      <AlertDescription>
                        등록된 사용자가 없습니다.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-muted-foreground">총 {users.length}명의 사용자</p>
                        <Button variant="outline" size="sm" onClick={fetchUsers}>새로고침</Button>
                      </div>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>이메일</TableHead>
                              <TableHead>보유 역할</TableHead>
                              <TableHead>가입일</TableHead>
                              <TableHead>접근 가능 페이지</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {users.map((u) => {
                              const userAccessiblePages = pagePermissions.filter(page => 
                                page.requiredRoles.some(role => u.roles.includes(role))
                              );
                              return (
                                <TableRow key={u.id}>
                                  <TableCell className="font-medium">{u.email}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                      {u.roles.length > 0 ? u.roles.map((role) => (
                                        <Badge key={role} className={getRoleColor(role)}>
                                          {role}
                                        </Badge>
                                      )) : (
                                        <Badge variant="outline">역할 없음</Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {new Date(u.created_at).toLocaleDateString('ko-KR')}
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-sm">
                                      {userAccessiblePages.length}개 페이지
                                    </span>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      사용자 권한 관리는 관리자 권한이 필요합니다.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}
          </TabsContent>

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
                  ) : policies.length === 0 ? (
                    <Alert>
                      <Settings className="h-4 w-4" />
                      <AlertDescription>
                        등록된 RLS 정책이 없거나 조회 결과가 비어 있습니다.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-muted-foreground">총 {policies.length}개 정책</p>
                        <div className="flex items-center gap-2">
                          <a
                            href="https://supabase.com/dashboard/project/zxjiugmqfzqluviuwztr/sql/new"
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm underline text-primary"
                          >
                            SQL 에디터 열기
                          </a>
                          <Button variant="outline" size="sm" onClick={fetchPolicies}>새로고침</Button>
                        </div>
                      </div>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>테이블</TableHead>
                              <TableHead>정책명</TableHead>
                              <TableHead>명령</TableHead>
                              <TableHead>역할</TableHead>
                              <TableHead>USING</TableHead>
                              <TableHead>WITH CHECK</TableHead>
                              <TableHead>모드</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {policies.map((p) => (
                              <TableRow key={`${p.table_name}-${p.policy_name}-${p.command}`}>
                                <TableCell className="font-medium">{p.table_name}</TableCell>
                                <TableCell>{p.policy_name}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{p.command}</Badge>
                                </TableCell>
                                <TableCell>
                                  <code className="text-xs">{p.roles}</code>
                                </TableCell>
                                <TableCell className="max-w-[320px]">
                                  <code className="text-xs break-words">{p.using_expression}</code>
                                </TableCell>
                                <TableCell className="max-w-[320px]">
                                  <code className="text-xs break-words">{p.with_check}</code>
                                </TableCell>
                                <TableCell>
                                  <Badge className={p.is_enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                                    {p.is_enabled ? 'PERMISSIVE' : 'RESTRICTIVE'}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
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