import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

/**
 * 관리자/강사 로그인 페이지
 * - container 사용하지 않아 폭이 과도하게 줄어드는 현상 방지
 * - 페이지 래퍼: max-w-7xl + side padding
 * - 로그인 카드: 적절한 max-width로 가독성 유지
 */
export default function AuthPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // 로그인 후 이동할 경로 (쿼리 ?redirect=/surveys-v2 지원)
  const redirect = params.get("redirect") || "/surveys-v2";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "입력 확인",
        description: "이메일과 비밀번호를 입력해 주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      toast({ title: "로그인 성공" });
      navigate(redirect);
    } catch (err: any) {
      toast({
        title: "로그인 실패",
        description: err?.message || "다시 시도해 주세요.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const onForgotPassword = async () => {
    if (!email) {
      toast({
        title: "이메일 필요",
        description: "비밀번호 재설정 링크를 받으려면 이메일을 입력해 주세요.",
      });
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: "메일 발송",
        description: "입력하신 주소로 비밀번호 재설정 메일을 보냈습니다.",
      });
    } catch (err: any) {
      toast({
        title: "실패",
        description: err?.message || "메일 발송에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* 상단 헤더 */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex items-center gap-3 h-16">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            메인으로
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-primary">
              관리자/강사 로그인
            </h1>
            <p className="text-sm text-muted-foreground">
              설문 결과 조회 및 관리
            </p>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6">
        <div className="flex">
          <Card className="w-full max-w-[520px] md:max-w-[560px] shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl tracking-tight">로그인</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">비밀번호</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 text-base"
                  disabled={loading}
                >
                  {loading ? "로그인 중..." : "로그인"}
                </Button>

                <div className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    className="text-primary"
                    onClick={onForgotPassword}
                    disabled={loading}
                  >
                    비밀번호를 잊으셨나요?
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
