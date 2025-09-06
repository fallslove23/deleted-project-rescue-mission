// src/pages/SystemLogs.tsx
// 안전 구현: 훅을 "항상 같은 순서"로만 호출. 조건부 훅 호출 금지.
// 레거시 import가 남아 있더라도 이 파일 하나로 런타임 크래시를 막습니다.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";

// 로그 레벨 타입(필터)
type LogLevel = "ALL" | "INFO" | "WARN" | "ERROR";

type LogRow = {
  id: string;
  created_at: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  context?: Record<string, any> | null;
};

export default function SystemLogs() {
  // ✅ 훅은 컴포넌트 최상단에서 “항상” 같은 개수/순서로 호출
  const [level, setLevel] = useState<LogLevel>("ALL");
  const [q, setQ] = useState("");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(100);
  const mounted = useRef(true);

  // 쿼리 파라미터는 useMemo로 계산 (훅 아님)
  const filters = useMemo(() => {
    return {
      level,
      q: q.trim(),
      limit,
    };
  }, [level, q, limit]);

  // ✅ 단일 useEffect로 fetch, 조건은 effect 내부에서 if로 가지치기 (훅이 아님)
  useEffect(() => {
    mounted.current = true;

    const fetchLogs = async () => {
      setLoading(true);
      try {
        // 기본 쿼리
        let query = supabase
          .from("system_logs") // 실제 테이블명에 맞게 수정
          .select("*")
          .order("created_at", { ascending: false })
          .limit(filters.limit);

        // 레벨 필터
        if (filters.level !== "ALL") {
          query = query.eq("level", filters.level);
        }

        // 텍스트 검색 (message ILIKE)
        if (filters.q) {
          query = query.ilike("message", `%${filters.q}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (mounted.current) {
          setLogs((data as LogRow[]) || []);
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

  // ✅ 어떤 분기든 훅 호출 순서는 변하지 않습니다.
  return (
    <div className="p-2 md:p-4">
      <Card className="mb-4">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <CardTitle className="text-base md:text-lg">시스템 로그</CardTitle>

          <div className="flex flex-wrap items-center gap-2">
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

            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="메시지 검색"
              className="w-[200px]"
            />

            <Select
              value={String(limit)}
              onValueChange={(v) => setLimit(Number(v))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="개수" />
              </SelectTrigger>
              <SelectContent>
                {[50, 100, 200, 500].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}개</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // 의존성(filters)이 바뀌면 effect가 재실행되므로
                // 강제 새고침은 입력값을 살짝 변경하는 식으로 트리거
                setLimit((x) => (x === 100 ? 101 : 100));
              }}
              title="새로고침"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground py-8">불러오는 중…</div>
          ) : logs.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8">로그가 없습니다.</div>
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
                  {row.context && (
                    <pre className="mt-2 text-[11px] md:text-xs bg-muted/40 p-2 rounded overflow-auto">
{JSON.stringify(row.context, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
