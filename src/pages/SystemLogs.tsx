// src/pages/SystemLogs.tsx
// HOTFIX: 훅을 전혀 쓰지 않는 안전한 더미 컴포넌트 (크래시 즉시 차단용)
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function SystemLogs() {
  return (
    <div className="p-2 md:p-4">
      <Card>
        <CardHeader>
          <CardTitle>시스템 로그</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          임시 안전 모드입니다. (훅 미사용)
          <br />
          아래 정상 버전으로 교체하면 기능이 활성화됩니다.
        </CardContent>
      </Card>
    </div>
  );
}
