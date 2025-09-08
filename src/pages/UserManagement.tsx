import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Users, Edit, Search, UserX, Shield, Key, Menu } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';


interface UserProfile {
  id: string;
  email: string;
  role: string;
  instructor_id?: string;
  first_login: boolean;
  created_at: string;
  updated_at: string;
}

interface UserRole {
  role: string;
}

interface Instructor {
  id: string;
  name: string;
  email?: string;
  photo_url?: string;
}

const UserManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const availableRoles = ['admin', 'operator', 'instructor', 'director'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, instructorsRes] = await Promise.all([
        supabase.rpc('get_all_profiles_for_admin', { requesting_user_id: user?.id || '' }),
        supabase.from('instructors').select('id, name, email, photo_url')
      ]);

      if (usersRes.error) throw usersRes.error;
      if (instructorsRes.error) throw instructorsRes.error;

      setUsers(usersRes.data || []);
      setInstructors(instructorsRes.data || []);

      await fetchUserRoles();
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "오류",
        description: "데이터를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRoles = async () => {
    try {
      const { data: userRolesData, error } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (error) throw error;

      const rolesByUser: Record<string, string[]> = {};
      userRolesData?.forEach(ur => {
        if (!rolesByUser[ur.user_id]) {
          rolesByUser[ur.user_id] = [];
        }
        rolesByUser[ur.user_id].push(ur.role);
      });

      setUserRoles(rolesByUser);
    } catch (error) {
      console.error('Error fetching user roles:', error);
    }
  };

  const getUserInstructor = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user?.instructor_id) return null;
    return instructors.find(i => i.id === user.instructor_id);
  };

  const handleEditRoles = (user: UserProfile) => {
    setEditingUser(user);
    setSelectedRoles(userRoles[user.id] || []);
    setIsDialogOpen(true);
  };

  const handleRoleChange = (role: string, checked: boolean) => {
    if (checked) {
      setSelectedRoles(prev => [...prev, role]);
    } else {
      setSelectedRoles(prev => prev.filter(r => r !== role));
    }
  };

  const handleSaveRoles = async () => {
    if (!editingUser) return;

    try {
      const { error } = await supabase.rpc('admin_set_user_roles_safe', {
        target_user_id: editingUser.id,
        roles: selectedRoles as unknown as ('operator' | 'instructor' | 'admin' | 'director')[]
      });

      if (error) throw error;

      await fetchUserRoles();

      toast({
        title: "성공",
        description: "사용자 역할이 업데이트되었습니다."
      });

      setIsDialogOpen(false);
      setEditingUser(null);
    } catch (error) {
      console.error('Error updating roles:', error);
      toast({
        title: "오류",
        description: "역할 업데이트 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const handleResetPassword = async (user: UserProfile) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/change-password`
      });

      if (error) throw error;

      toast({
        title: "성공",
        description: `${user.email}에 비밀번호 재설정 이메일을 발송했습니다.`
      });
    } catch (error) {
      console.error('Error sending password reset:', error);
      toast({
        title: "오류",
        description: "비밀번호 재설정 이메일 발송 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    const instructor = getUserInstructor(user.id);
    const roles = userRoles[user.id] || [];
    
    return (
      user.email?.toLowerCase().includes(searchLower) ||
      instructor?.name.toLowerCase().includes(searchLower) ||
      roles.some(role => role.toLowerCase().includes(searchLower))
    );
  });

  // 데스크톱 액션 버튼들
  const DesktopActions = () => (
    <div className="flex items-center gap-2">
      <Users className="h-5 w-5" />
      <span className="font-medium">{users.length}명</span>
    </div>
  );

  // 모바일 액션 버튼들  
  const MobileActions = () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>사용자 관리 메뉴</SheetTitle>
        </SheetHeader>
        <div className="py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>총 {users.length}명의 사용자</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="space-y-6">
      {/* 액션 버튼들 */}
      <div className="flex justify-end gap-2 mb-4">
        <DesktopActions />
      </div>
      <div className="space-y-6">
        {/* 검색 */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="이메일, 이름, 역할로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* 사용자 목록 */}
        <div className="grid gap-4">
          {filteredUsers.map((user) => {
            const instructor = getUserInstructor(user.id);
            const roles = userRoles[user.id] || [];
            
            return (
              <Card key={user.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={instructor?.photo_url} />
                        <AvatarFallback>
                          {instructor ? instructor.name.charAt(0) : user.email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {instructor ? instructor.name : user.email}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {user.email}
                        </div>
                        <div className="flex gap-1 mt-1">
                          {roles.length > 0 ? (
                            roles.map(role => (
                              <Badge key={role} variant="secondary" className="text-xs">
                                {role}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              권한 없음
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.first_login && (
                        <Badge variant="outline" className="text-xs">
                          첫 로그인 대기
                        </Badge>
                      )}
                      <div className="hidden sm:flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResetPassword(user)}
                        >
                          <Key className="h-4 w-4 mr-1" />
                          비밀번호 초기화
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditRoles(user)}
                        >
                          <Shield className="h-4 w-4 mr-1" />
                          권한 편집
                        </Button>
                      </div>
                      
                      {/* 모바일 액션 버튼 */}
                      <div className="sm:hidden">
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </SheetTrigger>
                          <SheetContent>
                            <SheetHeader>
                              <SheetTitle>사용자 관리</SheetTitle>
                            </SheetHeader>
                            <div className="py-4 space-y-4">
                              <div className="p-4 bg-muted rounded-lg">
                                <div className="font-medium">
                                  {instructor ? instructor.name : user.email}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {user.email}
                                </div>
                              </div>
                              <Button
                                className="w-full justify-start"
                                variant="outline"
                                onClick={() => handleResetPassword(user)}
                              >
                                <Key className="h-4 w-4 mr-2" />
                                비밀번호 초기화
                              </Button>
                              <Button
                                className="w-full justify-start"
                                variant="outline"
                                onClick={() => handleEditRoles(user)}
                              >
                                <Shield className="h-4 w-4 mr-2" />
                                권한 편집
                              </Button>
                            </div>
                          </SheetContent>
                        </Sheet>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 검색 결과 없음 */}
        {filteredUsers.length === 0 && (
          <div className="text-center py-8">
            <UserX className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">검색 결과가 없습니다</h3>
            <p className="text-muted-foreground">
              다른 검색어를 시도해보세요.
            </p>
          </div>
        )}

        {/* 역할 편집 다이얼로그 */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>사용자 권한 편집</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {editingUser && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="font-medium">{editingUser.email}</div>
                  <div className="text-sm text-muted-foreground">
                    {getUserInstructor(editingUser.id)?.name || '일반 사용자'}
                  </div>
                </div>
              )}
              
              <div className="space-y-3">
                <div className="font-medium">권한 설정</div>
                {availableRoles.map(role => (
                  <div key={role} className="flex items-center space-x-2">
                    <Checkbox
                      id={role}
                      checked={selectedRoles.includes(role)}
                      onCheckedChange={(checked) => handleRoleChange(role, checked as boolean)}
                    />
                    <label htmlFor={role} className="text-sm font-medium">
                      {role}
                    </label>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  취소
                </Button>
                <Button onClick={handleSaveRoles}>
                  저장
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default UserManagement;
