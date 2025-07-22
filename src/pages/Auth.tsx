import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const Auth = () => {
  const navigate = useNavigate();
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      if (data.user) {
        // Check if this is first login for instructor
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('first_login')
          .eq('id', data.user.id)
          .single();

        if (!profileError && profile?.first_login) {
          // First login - redirect to password change
          navigate('/change-password');
          toast({
            title: "첫 로그인",
            description: "비밀번호를 변경해주세요.",
          });
        } else {
          // Normal login
          navigate('/dashboard');
          toast({
            title: "로그인 성공",
            description: "대시보드로 이동합니다.",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "오류",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/change-password`
      });
      
      if (error) throw error;
      
      toast({
        title: "비밀번호 재설정 이메일 발송",
        description: "이메일을 확인하여 비밀번호를 재설정해주세요.",
      });
      
      setIsResetPassword(false);
    } catch (error: any) {
      toast({
        title: "오류",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header with back button */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center">
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            size="sm"
            className="mr-3"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            메인으로
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-primary">관리자/강사 로그인</h1>
            <p className="text-xs text-muted-foreground">설문 결과 조회 및 관리</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">
              {isResetPassword ? '비밀번호 찾기' : '로그인'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={isResetPassword ? handleResetPassword : handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {!isResetPassword && (
                <div className="space-y-2">
                  <Label htmlFor="password">비밀번호</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '처리중...' : (isResetPassword ? '비밀번호 재설정 이메일 발송' : '로그인')}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <Button
                variant="link"
                onClick={() => setIsResetPassword(!isResetPassword)}
              >
                {isResetPassword ? '로그인으로 돌아가기' : '비밀번호를 잊으셨나요?'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;