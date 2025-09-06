// src/pages/SystemLogs.tsx
// ✅ 훅을 항상 같은 순서/같은 개수로만 호출하는 안전 구현
//   - 조건문 안에서 useState/useEffect/useMemo/useRef 호출 금지
//   - 조기 return 전에 훅 호출 금지 (렌더 경로가 달라지면 훅 순서가 바뀜)

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";

type LogLevel = "ALL" | "INFO" | "WARN" | "ERROR";

type LogRow = {
  id: string;
  created_at: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  context?: Record<string, any> | null;
};

export default function SystemLogs() {
  // ✅ 모든 훅은 컴포넌트 최상단에서 한 번씩 고정 호출
  const [level, setLevel] = useState<LogLevel>("ALL");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState<number>(100);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const mounted = useRef<boolean>(true);

  // 쿼리 파라미터 계산은 훅이 아님(useMemo는 훅이지만 호출 순서 고정)
  const filters = useMemo(
    () => ({
      level,
      q: q.trim(),
      limit,
    }),
    [level, q, limit]
  );

  // ✅ 단일 effect로 fetch 실행 (조건은 effect "내부에서" 처리)
  useEffect(() => {
    mounted.current = true;

    const fetchLogs = async () => {
      setLoading(true);
      try {
        // 실제 테이블명을 확인해 맞춰주세요: "system_logs" 가 기본 가정
        let query = supabase
          .from("system_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(filters.limit);

        if (filters.level !== "ALL") {
          query = query.eq("level", filters.level);
        }
        if (filters.q) {
          query = query.ilike("message", `%${filters.q}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (mounted.current) {
          setLogs((data as LogRow[]) ?? []);
        }
      } catch (err) {
        console.error("[SystemLogs] fetch error:", err);
        if (mounted.current) setLogs([]);
      } finally {
        if (mounted.current) setLoading(false);
      }
    };

    fetchLogs();

    return () => {
      mounted.current = false;
    };
  }, [filters]);

  // ✅ 렌더 분기는 훅 호출 이후에만(훅 개수/순서 불변)
  return (
    <div className="p-2 md:p-4">
      <Card className="mb-4">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <CardTitle className="text-base md:text-lg">시스템 로그</CardTitle>

          <div className="flex flex-wrap items-center gap-2">
            {/* 레벨 선택 */}
            <Select value={level} onValueChange={(v) => setLevel(v as LogLevel)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="레벨" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">전체</SelectItem>
                <SelectItem value="INFO">INFO</SelectItem>
                <SelectItem value="WARN">WARN</SelectItem>
                <SelectItem value="ERROR">ERROR</SelectItem>
              </SelectContent>
            </Select>

            {/* 메시지 검색 */}
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="메시지 검색"
              className="w-[200px]"
            />

            {/* 개수 */}
            <Select
              value={String(limit)}
              onValueChange={(v) => setLimit(Number(v))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="개수" />
              </SelectTrigger>
              <SelectContent>
                {[50, 100, 200, 500].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}개
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 새로고침: 의존성 변경으로 effect 재실행 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLimit((x) => (x === 100 ? 101 : 100))}
              title="새로고침"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground py-8">
              불러오는 중…
            </div>
          ) : logs.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8">
              로그가 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((row) => (
                <div
                  key={row.id}
                  className="rounded-md border p-3 text-sm bg-card/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString("ko-KR")}
                    </div>
                    <Badge
                      variant={
                        row.level === "ERROR"
                          ? "destructive"
                          : row.level === "WARN"
                          ? "secondary"
                          : "outline"
                      }
                      className="shrink-0"
                    >
                      {row.level}
                    </Badge>
                  </div>

                  <div className="mt-1 whitespace-pre-wrap break-words">
                    {row.message}
                  </div>

                  {row.context ? (
                    <pre className="mt-2 text-[11px] md:text-xs bg-muted/40 p-2 rounded overflow-auto">
{JSON.stringify(row.context, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
