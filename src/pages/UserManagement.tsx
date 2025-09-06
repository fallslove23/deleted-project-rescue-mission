import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, Edit, Search, UserX, Shield, Key } from 'lucide-react';
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

const UserManagement = ({ showPageHeader = true }: { showPageHeader?: boolean }) => {
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

  if (loading) {
    return (
      <div className="w-full">
        {showPageHeader && (
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold">사용자 관리</h1>
            <p className="text-muted-foreground">시스템 사용자 및 권한 관리</p>
          </div>
        )}
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">로딩중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {showPageHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">사용자 관리</h1>
            <p className="text-muted-foreground">시스템 사용자 및 권한 관리</p>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span className="font-medium">{users.length}명</span>
          </div>
        </div>
      )}

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
      <div className="grid gap-3 sm:gap-4">
        {filteredUsers.map((user) => {
          const instructor = getUserInstructor(user.id);
          const roles = userRoles[user.id] || [];
          
          return (
            <Card key={user.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <Avatar className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
                      <AvatarImage src={instructor?.photo_url} />
                      <AvatarFallback>
                        {instructor ? instructor.name.charAt(0) : user.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm sm:text-base truncate">
                        {instructor ? instructor.name : user.email}
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground truncate">
                        {user.email}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
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
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {user.first_login && (
                      <Badge variant="outline" className="text-xs">
                        첫 로그인 대기
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResetPassword(user)}
                      className="text-xs min-w-0"
                    >
                      <Key className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                      <span className="hidden sm:inline">비밀번호 초기화</span>
                      <span className="sm:hidden">초기화</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditRoles(user)}
                      className="text-xs min-w-0"
                    >
                      <Shield className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                      <span className="hidden sm:inline">권한 편집</span>
                      <span className="sm:hidden">권한</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
  );
};

export default UserManagement;