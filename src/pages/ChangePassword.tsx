import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft } from 'lucide-react';

const ChangePassword = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "오류",
        description: "새 비밀번호가 일치하지 않습니다.",
        variant: "destructive"
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "오류", 
        description: "비밀번호는 최소 6자 이상이어야 합니다.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      // Update first_login flag
      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ first_login: false })
          .eq('id', user.id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
        }
      }

      toast({
        title: "성공",
        description: "비밀번호가 변경되었습니다."
      });

      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: "오류",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center">
          <Button
            onClick={() => navigate('/auth')}
            variant="ghost"
            size="sm"
            className="mr-3 touch-friendly"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">로그인으로</span>
            <span className="sm:hidden">로그인</span>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm sm:text-lg font-semibold text-primary break-words">비밀번호 변경</h1>
            <p className="text-xs text-muted-foreground break-words hyphens-auto">첫 로그인 시 비밀번호를 변경해주세요</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-lg sm:text-xl break-words">비밀번호 변경</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">현재 비밀번호</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="bsedu123"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">새 비밀번호</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="최소 6자 이상"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">새 비밀번호 확인</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="새 비밀번호를 다시 입력"
                  required
                />
              </div>
              <Button type="submit" className="w-full touch-friendly" disabled={loading}>
                {loading ? '변경 중...' : '비밀번호 변경'}
              </Button>
            </form>
            
            <div className="mt-4 p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground break-words hyphens-auto">
                <strong>알림:</strong> 비밀번호 변경 후 대시보드로 이동됩니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ChangePassword;