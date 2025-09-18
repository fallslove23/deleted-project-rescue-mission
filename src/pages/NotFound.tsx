import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Home, ArrowLeft, AlertCircle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  const handleGoHome = () => {
    // 관리자 대시보드에서 온 경우 대시보드로, 그 외에는 메인으로
    if (location.pathname.includes('/dashboard')) {
      navigate('/dashboard');
    } else {
      navigate('/');
    }
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4 text-foreground overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-primary/20 opacity-70"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-32 h-[30rem] w-[30rem] rounded-full bg-gradient-primary blur-3xl opacity-20"
        aria-hidden="true"
      />
      <Card className="relative z-10 w-full max-w-md mx-auto shadow-lg border border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <CardContent className="p-8 text-center space-y-6">
          {/* 404 아이콘 */}
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>

          {/* 404 메시지 */}
          <div className="space-y-3">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground font-display">404</h1>
            <h2 className="text-lg md:text-xl font-semibold text-foreground font-display">
              페이지를 찾을 수 없습니다
            </h2>
            <p className="text-sm md:text-base text-muted-foreground font-sans break-words">
              요청하신 페이지가 존재하지 않거나 이동되었습니다.
            </p>
          </div>

          {/* 요청된 경로 표시 */}
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground font-mono break-all">
              경로: {location.pathname}
            </p>
          </div>

          {/* 액션 버튼들 */}
          <div className="space-y-3">
            <Button 
              onClick={handleGoHome}
              className="w-full font-sans"
              size="lg"
            >
              <Home className="w-4 h-4 mr-2" />
              {location.pathname.includes('/dashboard') ? '대시보드로 돌아가기' : '메인 페이지로 이동'}
            </Button>
            
            <Button 
              onClick={handleGoBack}
              variant="outline"
              className="w-full font-sans"
              size="lg"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              이전 페이지로
            </Button>
          </div>

          {/* 도움말 텍스트 */}
          <div className="text-center pt-4 border-t">
            <p className="text-xs text-muted-foreground font-sans">
              문제가 지속되면 관리자에게 문의하세요.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;