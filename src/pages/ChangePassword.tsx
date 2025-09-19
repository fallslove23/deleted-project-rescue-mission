import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const ChangePassword = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCurrentCapsLockOn, setIsCurrentCapsLockOn] = useState(false);
  const [isNewCapsLockOn, setIsNewCapsLockOn] = useState(false);
  const [isConfirmCapsLockOn, setIsConfirmCapsLockOn] = useState(false);

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

  const handleCapsLockEvent = (
    event: React.KeyboardEvent<HTMLInputElement>,
    setState: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (typeof event.getModifierState === 'function') {
      setState(event.getModifierState('CapsLock'));
    }
  };

  const resetCapsLockState = (setState: React.Dispatch<React.SetStateAction<boolean>>) => () => setState(false);

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
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="currentPassword" className="text-sm font-medium">현재 비밀번호</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          aria-label="현재 비밀번호 정책 안내"
                        >
                          입력 안내
                        </button>
                      </TooltipTrigger>
                      <TooltipContent align="end" className="max-w-xs text-xs leading-relaxed">
                        공용 초기 비밀번호를 사용하는 경우 보안을 위해 즉시 변경해주세요.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      onKeyDown={(event) => handleCapsLockEvent(event, setIsCurrentCapsLockOn)}
                      onKeyUp={(event) => handleCapsLockEvent(event, setIsCurrentCapsLockOn)}
                      onBlur={resetCapsLockState(setIsCurrentCapsLockOn)}
                      autoComplete="current-password"
                      placeholder="bsedu123"
                      className="w-full h-12 text-base pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-label={showCurrentPassword ? '현재 비밀번호 숨기기' : '현재 비밀번호 보기'}
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {isCurrentCapsLockOn && (
                    <p className="text-xs text-destructive">Caps Lock이 켜져 있습니다.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="newPassword" className="text-sm font-medium">새 비밀번호</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          aria-label="비밀번호 정책 안내"
                        >
                          비밀번호 정책
                        </button>
                      </TooltipTrigger>
                      <TooltipContent align="end" className="max-w-xs text-xs leading-relaxed">
                        최소 6자 이상이며 영문 대·소문자, 숫자, 특수문자 중 2가지 이상을 조합하면 안전합니다.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      onKeyDown={(event) => handleCapsLockEvent(event, setIsNewCapsLockOn)}
                      onKeyUp={(event) => handleCapsLockEvent(event, setIsNewCapsLockOn)}
                      onBlur={resetCapsLockState(setIsNewCapsLockOn)}
                      autoComplete="new-password"
                      placeholder="최소 6자 이상"
                      className="w-full h-12 text-base pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-label={showNewPassword ? '새 비밀번호 숨기기' : '새 비밀번호 보기'}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">안전한 계정을 위해 다른 서비스와 다른 비밀번호를 사용해주세요.</p>
                  {isNewCapsLockOn && (
                    <p className="text-xs text-destructive">Caps Lock이 켜져 있습니다.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium">새 비밀번호 확인</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          aria-label="비밀번호 확인 안내"
                        >
                          확인 안내
                        </button>
                      </TooltipTrigger>
                      <TooltipContent align="end" className="max-w-xs text-xs leading-relaxed">
                        새 비밀번호와 동일하게 입력해야 비밀번호가 변경됩니다.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onKeyDown={(event) => handleCapsLockEvent(event, setIsConfirmCapsLockOn)}
                      onKeyUp={(event) => handleCapsLockEvent(event, setIsConfirmCapsLockOn)}
                      onBlur={resetCapsLockState(setIsConfirmCapsLockOn)}
                      autoComplete="new-password"
                      placeholder="새 비밀번호를 다시 입력"
                      className="w-full h-12 text-base pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-label={showConfirmPassword ? '비밀번호 확인 숨기기' : '비밀번호 확인 보기'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {isConfirmCapsLockOn && (
                    <p className="text-xs text-destructive">Caps Lock이 켜져 있습니다.</p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 touch-friendly text-base font-medium"
                  disabled={loading}
                >
                  {loading ? '변경 중...' : '비밀번호 변경'}
                </Button>
              </form>

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