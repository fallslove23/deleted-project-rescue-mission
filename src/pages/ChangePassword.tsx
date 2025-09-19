import { useEffect, useRef, useState } from 'react';
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
  const [supportText, setSupportText] = useState('');
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    setSupportText('');

    if (!user?.email) {
      toast({
        title: "오류",
        description: "사용자 정보를 불러오지 못했습니다. 다시 로그인 후 시도해주세요.",
        variant: "destructive"
      });
      return;
    }

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
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });

      if (reauthError) {
        setSupportText(
          '비밀번호가 기억나지 않으신가요? 계정 복구를 위해 support@example.com 으로 문의하시거나 02-1234-5678 고객센터로 연락해주세요.'
        );
        throw new Error('현재 비밀번호가 올바르지 않습니다.');
      }

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
        description: "비밀번호가 변경되었습니다. 3초 후 대시보드로 이동합니다."
      });

      redirectTimeoutRef.current = window.setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
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
    <div className="relative min-h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/10 to-primary/25 opacity-70"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-56 -left-32 h-[34rem] w-[34rem] rounded-full bg-gradient-primary blur-3xl opacity-25"
        aria-hidden="true"
      />
      {/* Header */}
      <header className="relative z-10 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 shadow-sm">
        <div className="w-full max-w-7xl mx-auto px-4 py-3 flex items-center">
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
          <div className="min-w-0 flex-1 text-center">
            <h1 className="text-lg sm:text-2xl font-bold text-primary">비밀번호 변경</h1>
            <p className="text-sm text-muted-foreground">첫 로그인 시 비밀번호를 변경해주세요</p>
          </div>
        </div>
      </header>

      {/* Main content - 개선된 반응형 중앙 정렬 */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg xl:max-w-xl mx-auto">
          <Card className="w-full shadow-xl border border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <CardHeader className="text-center pb-6 px-6 sm:px-8 lg:px-10 pt-8">
              <CardTitle className="text-xl sm:text-2xl lg:text-3xl font-bold">비밀번호 변경</CardTitle>
            </CardHeader>
            <CardContent className="px-6 sm:px-8 lg:px-10 pb-8">
              <form onSubmit={handleChangePassword} className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="currentPassword" className="text-sm font-medium">현재 비밀번호</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="bsedu123"
                    className="w-full h-12 text-base"
                    required
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="newPassword" className="text-sm font-medium">새 비밀번호</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="최소 6자 이상"
                    className="w-full h-12 text-base"
                    required
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">새 비밀번호 확인</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="새 비밀번호를 다시 입력"
                    className="w-full h-12 text-base"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 touch-friendly text-base font-medium"
                  disabled={loading}
                >
                  {loading ? '변경 중...' : '비밀번호 변경'}
                </Button>
              </form>

              {supportText && (
                <div className="mt-4 rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                  {supportText}
                </div>
              )}

              <div className="mt-8 p-4 sm:p-6 rounded-lg border border-primary/30 bg-primary/10">
                <p className="text-sm sm:text-base text-primary">
                  <strong className="font-semibold">알림:</strong> 비밀번호 변경 후 대시보드로 이동됩니다.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;