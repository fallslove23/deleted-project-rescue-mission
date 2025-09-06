import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { translateAuthError } from '@/utils/authErrorTranslator';

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
          // Normal login - force page reload to ensure proper redirect
          window.location.href = '/default-redirect';
          toast({
            title: "로그인 성공",
            description: "대시보드로 이동합니다.",
          });
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: "로그인 실패",
        description: translateAuthError(error.message || '알 수 없는 오류가 발생했습니다.'),
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
      console.error('Password reset error:', error);
      toast({
        title: "비밀번호 재설정 오류",
        description: translateAuthError(error.message || '비밀번호 재설정 중 오류가 발생했습니다.'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header with back button */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="w-full max-w-7xl mx-auto px-4 py-3 flex items-center">
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            size="sm"
            className="mr-3 touch-friendly"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">메인으로</span>
            <span className="sm:hidden">메인</span>
          </Button>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="text-lg sm:text-2xl font-bold text-primary">관리자/강사 로그인</h1>
            <p className="text-sm text-muted-foreground">설문 결과 조회 및 관리</p>
          </div>
        </div>
      </header>

      {/* Main content - 중앙 정렬 및 최대 너비 설정 */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto">
          <Card className="w-full shadow-xl border-0 bg-white/95 backdrop-blur-sm">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-xl font-bold">
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
                    placeholder="이메일을 입력하세요"
                    className="w-full"
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
                      placeholder="비밀번호를 입력하세요"
                      className="w-full"
                      required
                    />
                  </div>
                )}
                <Button 
                  type="submit" 
                  className="w-full touch-friendly bg-purple-600 hover:bg-purple-700 text-white py-2.5" 
                  disabled={loading}
                >
                  {loading ? '처리중...' : (isResetPassword ? '비밀번호 재설정 이메일 발송' : '로그인')}
                </Button>
              </form>
              
              <div className="mt-6 text-center">
                <Button
                  variant="link"
                  className="touch-friendly text-purple-600 hover:text-purple-800"
                  onClick={() => setIsResetPassword(!isResetPassword)}
                >
                  {isResetPassword ? '로그인으로 돌아가기' : '비밀번호를 잊으셨나요?'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;