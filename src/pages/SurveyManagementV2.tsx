// src/pages/SurveyManagementV2.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Users, 
  BookOpen, 
  User,
  AlertCircle,
  RefreshCw,
  Search,
  XCircle
} from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { SurveysRepository, SurveyListItem, SurveyFilters, PaginatedSurveyResult } from "@/repositories/surveysRepo";

const STATUS_CONFIG = {
  draft: { label: "초안", variant: "secondary" as const, color: "hsl(var(--muted-foreground))" },
  active: { label: "진행중", variant: "default" as const, color: "hsl(var(--primary))" },
  public: { label: "진행중", variant: "default" as const, color: "hsl(var(--primary))" },
  completed: { label: "완료", variant: "outline" as const, color: "hsl(var(--success))" },
  scheduled: { label: "시작예정", variant: "secondary" as const, color: "hsl(var(--warning))" },
  expired: { label: "종료", variant: "destructive" as const, color: "hsl(var(--destructive))" },
};

const TIMEZONE = "Asia/Seoul";
const PAGE_SIZE = 10;
const DEBOUNCE_MS = 300;

/** 검색어 하이라이트 */
function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function Highlight({ text, query }: { text?: string | null; query: string }) {
  const t = text ?? "";
  if (!query.trim()) return <>{t}</>;
  const re = new RegExp(`(${escapeRegExp(query)})`, "ig");
  const parts = t.split(re);
  return (
    <>
      {parts.map((p, i) =>
        re.test(p) ? (
          <mark key={i} className="px-0.5 rounded bg-yellow-100 dark:bg-yellow-900">{p}</mark>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

export default function SurveyManagementV2() {
  const [surveys, setSurveys] = useState<SurveyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // 필터 + 검색
  const [filters, setFilters] = useState<SurveyFilters>({ year: null, status: null, q: null });
  const [searchText, setSearchText] = useState(""); // 입력 박스용 (디바운스)
  const searchRef = useRef<HTMLInputElement>(null);

  // 디바운스 적용
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((prev) => ({ ...prev, q: searchText.trim() || null }));
      setCurrentPage(1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchText]);

  // 데이터 로드
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [result, years] = await Promise.all([
        SurveysRepository.fetchSurveyList(currentPage, PAGE_SIZE, filters),
        SurveysRepository.getAvailableYears(),
      ]);

      setSurveys(result.data);
      setTotalPages(result.totalPages);
      setTotalCount(result.count);
      setAvailableYears(years);
    } catch (err) {
      console.error("Data loading error:", err);
      setError(err instanceof Error ? err.message : "데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, filters.year, filters.status, filters.q]);

  // 안전한 날짜 포맷팅
  const formatSafeDate = (dateString: string | null): string => {
    if (!dateString) return "미설정";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "미설정";
      return formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd HH:mm");
    } catch {
      return "미설정";
    }
  };

  // 상태 결정
  const getStatusInfo = (survey: SurveyListItem) => {
    const now = new Date();
    const startDate = survey.start_date ? new Date(survey.start_date) : null;
    const endDate = survey.end_date ? new Date(survey.end_date) : null;

    if (survey.status === "draft") return STATUS_CONFIG.draft;
    if (survey.status === "completed") return STATUS_CONFIG.completed;
    if (startDate && now < startDate) return STATUS_CONFIG.scheduled;
    if (endDate && now > endDate) return STATUS_CONFIG.expired;
    if (survey.status === "active" || survey.status === "public") return STATUS_CONFIG.active;
    return STATUS_CONFIG.draft;
  };

  // 필터 변경
  const handleFilterChange = (key: keyof SurveyFilters, value: string) => {
    const newValue =
      value === "all" ? null : key === "year" ? (value ? parseInt(value) : null) : value;
    setFilters((prev) => ({ ...prev, [key]: newValue }));
    setCurrentPage(1);
  };

  // 새로고침
  const handleRefresh = () => loadData();

  // 단축키: "/" 또는 Cmd/Ctrl+K 로 검색칸 포커스
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ----------------------- Render ----------------------- */

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-4" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">설문 관리 V2</h1>
          <p className="text-muted-foreground">전체 {totalCount}개의 설문</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* 검색 + 필터 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">검색 / 필터</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 🔍 검색 박스 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">검색</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="제목 / 과정 / 강사 검색"
                className="pl-9 pr-9"
              />
              {searchText && (
                <button
                  aria-label="검색어 지우기"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchText("")}
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: <kbd className="px-1 py-0.5 rounded bg-muted">/</kbd> 또는{" "}
              <kbd className="px-1 py-0.5 rounded bg-muted">⌘/Ctrl</kbd>+<kbd className="px-1 py-0.5 rounded bg-muted">K</kbd>{" "}
              로 검색창에 바로 포커스하기
            </p>
          </div>

          {/* 필터 라인 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">교육 연도</label>
              <Select
                value={filters.year?.toString() || "all"}
                onValueChange={(value) => handleFilterChange("year", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="모든 연도" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 연도</SelectItem>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">상태</label>
              <Select
                value={filters.status || "all"}
                onValueChange={(value) => handleFilterChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="모든 상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 상태</SelectItem>
                  <SelectItem value="draft">초안</SelectItem>
                  <SelectItem value="active">진행중</SelectItem>
                  <SelectItem value="public">공개</SelectItem>
                  <SelectItem value="completed">완료</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 에러 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 목록 */}
      {surveys.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">조건에 맞는 설문이 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {surveys.map((survey) => {
            const statusInfo = getStatusInfo(survey);
            const q = filters.q ?? "";
            return (
              <Card key={survey.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">
                        <Highlight text={survey.title ?? ""} query={q} />
                      </h3>
                      {survey.description && (
                        <p className="text-muted-foreground mb-3 line-clamp-2">
                          {survey.description}
                        </p>
                      )}
                    </div>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">작성자:</span>
                      <span><Highlight text={survey.creator_email ?? ""} query={q} /></span>
                    </div>

                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">강사:</span>
                      <span><Highlight text={survey.instructor_name ?? ""} query={q} /></span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">과목:</span>
                      <span><Highlight text={survey.course_title ?? ""} query={q} /></span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">과정:</span>
                      <span><Highlight text={survey.course_name ?? ""} query={q} /></span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">교육기간:</span>
                      <div className="font-medium">
                        {survey.education_year && survey.education_round
                          ? `${survey.education_year}년 ${survey.education_round}기`
                          : "미설정"}
                      </div>
                    </div>

                    <div>
                      <span className="text-muted-foreground">시작일:</span>
                      <div className="font-medium">{formatSafeDate(survey.start_date)}</div>
                    </div>

                    <div>
                      <span className="text-muted-foreground">종료일:</span>
                      <div className="font-medium">{formatSafeDate(survey.end_date)}</div>
                    </div>
                  </div>

                  {survey.is_test && (
                    <div className="mt-2">
                      <Badge variant="outline" className="text-xs">
                        테스트 설문
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            이전
          </Button>

          <span className="text-sm text-muted-foreground px-4">
            {currentPage} / {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            다음
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
