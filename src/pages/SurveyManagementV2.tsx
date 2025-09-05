// src/pages/SurveyManagementV2.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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
  XCircle,
  Filter,
  SortAsc,
  SortDesc,
  CheckSquare,
  Copy,
  Trash2,
  Download,
  PlusCircle,
} from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import {
  SurveysRepository,
  SurveyListItem,
  SurveyFilters,
  SortBy,
  SortDir,
  TemplateLite,
} from "@/repositories/surveysRepo";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const TIMEZONE = "Asia/Seoul";
const PAGE_SIZE = 10;
const DEBOUNCE_MS = 300;

const STATUS_CONFIG = {
  draft: { label: "초안", variant: "secondary" as const },
  active: { label: "진행중", variant: "default" as const },
  public: { label: "진행중", variant: "default" as const },
  completed: { label: "완료", variant: "outline" as const },
  scheduled: { label: "시작예정", variant: "secondary" as const },
  expired: { label: "종료", variant: "destructive" as const },
};

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
          <mark key={i} className="px-0.5 rounded bg-yellow-100 dark:bg-yellow-900">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

export default function SurveyManagementV2() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  /* ---------- state ---------- */
  const [surveys, setSurveys] = useState<SurveyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [availableCourseNames, setAvailableCourseNames] = useState<string[]>([]);

  const [filters, setFilters] = useState<SurveyFilters>({
    year: null,
    status: null,
    q: null,
    courseName: null,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [sortBy, setSortBy] = useState<SortBy>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // 검색 인풋(디바운스)
  const [searchText, setSearchText] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // 멀티 선택
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allChecked = useMemo(
    () => surveys.length > 0 && surveys.every((s) => selected.has(s.id)),
    [surveys, selected]
  );

  // 빠른 생성 다이얼로그
  const [openCreate, setOpenCreate] = useState(false);
  const [qcYear, setQcYear] = useState<number>(new Date().getFullYear());
  const [qcRound, setQcRound] = useState<number>(1);
  const [qcDay, setQcDay] = useState<number>(1);
  const [qcCourse, setQcCourse] = useState<string>("");
  const [qcTemplate, setQcTemplate] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateLite[]>([]);
  const [creating, setCreating] = useState(false);

  /* ---------- URL → 상태 초기화 ---------- */
  useEffect(() => {
    const q = searchParams.get("q");
    const year = searchParams.get("year");
    const course = searchParams.get("course");
    const status = searchParams.get("status");
    const page = searchParams.get("page");
    const sby = (searchParams.get("sortBy") as SortBy) || "created_at";
    const sdir = (searchParams.get("sortDir") as SortDir) || "desc";

    setFilters({
      q: q || null,
      year: year ? parseInt(year) : null,
      courseName: course || null,
      status: (status as any) || null,
    });
    setSearchText(q || "");
    setCurrentPage(page ? Math.max(1, parseInt(page)) : 1);
    setSortBy(sby);
    setSortDir(sdir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 최초 1회

  /* ---------- 상태 → URL 동기화 ---------- */
  useEffect(() => {
    const sp = new URLSearchParams();
    if (filters.q) sp.set("q", filters.q);
    if (filters.year !== null) sp.set("year", String(filters.year));
    if (filters.courseName) sp.set("course", filters.courseName);
    if (filters.status) sp.set("status", filters.status);
    if (currentPage > 1) sp.set("page", String(currentPage));
    if (sortBy !== "created_at") sp.set("sortBy", sortBy);
    if (sortDir !== "desc") sp.set("sortDir", sortDir);
    setSearchParams(sp, { replace: true });
  }, [filters, currentPage, sortBy, sortDir, setSearchParams]);

  /* ---------- 데이터 로드 ---------- */
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [result, years] = await Promise.all([
        SurveysRepository.fetchSurveyList(currentPage, PAGE_SIZE, filters, sortBy, sortDir),
        SurveysRepository.getAvailableYears(),
      ]);
      setSurveys(result.data);
      setTotalPages(result.totalPages);
      setTotalCount(result.count);
      setAvailableYears(years);
    } catch (e: any) {
      setError(e.message || "데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, filters.year, filters.status, filters.q, filters.courseName, sortBy, sortDir]);

  // 연도 → 과정명 옵션 로드
  const loadCourseNames = async (year: number | null) => {
    const names = await SurveysRepository.getAvailableCourseNames(year);
    setAvailableCourseNames(names);
    if (filters.courseName && !names.includes(filters.courseName)) {
      setFilters((p) => ({ ...p, courseName: null }));
      setCurrentPage(1);
    }
  };
  useEffect(() => {
    loadCourseNames(filters.year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.year]);

  // 템플릿 목록 (빠른 생성용)
  useEffect(() => {
    (async () => {
      const list = await SurveysRepository.listTemplates();
      setTemplates(list);
    })();
  }, []);

  /* ---------- helpers ---------- */
  const formatSafeDate = (dateString: string | null): string => {
    if (!dateString) return "미설정";
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return "미설정";
      return formatInTimeZone(d, TIMEZONE, "yyyy-MM-dd HH:mm");
    } catch {
      return "미설정";
    }
  };

  const getStatusInfo = (s: SurveyListItem) => {
    const now = new Date();
    const start = s.start_date ? new Date(s.start_date) : null;
    const end = s.end_date ? new Date(s.end_date) : null;
    if (s.status === "draft") return STATUS_CONFIG.draft;
    if (s.status === "completed") return STATUS_CONFIG.completed;
    if (start && now < start) return STATUS_CONFIG.scheduled;
    if (end && now > end) return STATUS_CONFIG.expired;
    if (s.status === "active" || s.status === "public") return STATUS_CONFIG.active;
    return STATUS_CONFIG.draft;
  };

  const handleFilterChange = (key: keyof SurveyFilters, value: string) => {
    const newValue =
      value === "all"
        ? null
        : key === "year"
        ? (value ? parseInt(value) : null)
        : value;
    setFilters((prev) => ({ ...prev, [key]: newValue as any }));
    setCurrentPage(1);
  };

  const handleDebouncedSearch = (val: string) => {
    setSearchText(val);
    const t = setTimeout(() => {
      setFilters((prev) => ({ ...prev, q: val.trim() || null }));
      setCurrentPage(1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  };

  const toggleAll = () => {
    if (allChecked) {
      setSelected(new Set());
    } else {
      const s = new Set(selected);
      surveys.forEach((it) => s.add(it.id));
      setSelected(s);
    }
  };
  const toggleOne = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const handleRefresh = () => loadData();

  /* ---------- CSV export (현재 필터 적용 전체 최대 1000건) ---------- */
  const exportCsv = async () => {
    const res = await SurveysRepository.fetchSurveyList(1, 1000, filters, sortBy, sortDir);
    const rows = res.data;
    const header = [
      "id",
      "title",
      "status",
      "education_year",
      "education_round",
      "education_day",
      "course_name",
      "instructor_name",
      "course_title",
      "creator_email",
      "start_date",
      "end_date",
      "created_at",
    ];
    const escape = (v: any) =>
      `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv =
      header.join(",") +
      "\n" +
      rows
        .map((r) =>
          [
            r.id,
            r.title,
            r.status,
            r.education_year,
            r.education_round,
            r.education_day,
            r.course_name,
            r.instructor_name,
            r.course_title,
            r.creator_email,
            r.start_date,
            r.end_date,
            r.created_at,
          ]
            .map(escape)
            .join(",")
        )
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `surveys_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  /* ---------- 대량 액션 ---------- */
  const bulkChangeStatus = async (status: "draft" | "active" | "public" | "completed") => {
    if (selected.size === 0) return;
    await SurveysRepository.updateStatusMany(Array.from(selected), status);
    setSelected(new Set());
    await loadData();
  };
  const bulkDuplicate = async () => {
    if (selected.size === 0) return;
    await SurveysRepository.duplicateMany(Array.from(selected));
    setSelected(new Set());
    await loadData();
  };
  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size}개 설문을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    await SurveysRepository.deleteMany(Array.from(selected));
    setSelected(new Set());
    await loadData();
  };

  /* ---------- 빠른 생성 ---------- */
  const openQuickCreate = () => {
    setQcYear(filters.year ?? new Date().getFullYear());
    setQcRound(1);
    setQcDay(1);
    setQcCourse(availableCourseNames[0] ?? "");
    setQcTemplate(null);
    setOpenCreate(true);
  };
  const doQuickCreate = async () => {
    if (!qcCourse) return;
    try {
      setCreating(true);
      const created = await SurveysRepository.quickCreateSurvey({
        education_year: qcYear,
        education_round: qcRound,
        education_day: qcDay,
        course_name: qcCourse,
        template_id: qcTemplate,
      });
      setOpenCreate(false);
      // 바로 편집기로 이동
      navigate(`/survey-builder/${created.id}`);
    } finally {
      setCreating(false);
    }
  };

  /* ---------- keyboard shortcuts ---------- */
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

  /* ---------- render ---------- */

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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-2" />
            CSV 내보내기
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
          <Button size="sm" onClick={openQuickCreate}>
            <PlusCircle className="w-4 h-4 mr-2" />
            빠른 생성
          </Button>
        </div>
      </div>

      {/* 검색/필터/정렬 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-4 h-4" /> 검색 / 필터
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 검색 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">검색</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={searchText}
                onChange={(e) => handleDebouncedSearch(e.target.value)}
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
          </div>

          {/* 필터 라인: 연도 → 과정명 → 상태 → 정렬 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 연도 */}
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

            {/* 과정명 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">과정명</label>
              <Select
                value={filters.courseName || "all"}
                onValueChange={(value) => handleFilterChange("courseName", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="모든 과정" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 과정</SelectItem>
                  {availableCourseNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 상태 */}
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

            {/* 정렬 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">정렬</label>
              <div className="flex gap-2">
                <Select value={sortBy} onValueChange={(v: SortBy) => setSortBy(v)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">생성일</SelectItem>
                    <SelectItem value="start_date">시작일</SelectItem>
                    <SelectItem value="end_date">종료일</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  title="정렬 방향"
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                >
                  {sortDir === "asc" ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                </Button>
              </div>
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

      {/* 멀티 선택 바 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Button variant="outline" size="sm" onClick={toggleAll}>
            <CheckSquare className="w-4 h-4 mr-1" />
            {allChecked ? "전체 해제" : "현재 페이지 전체선택"}
          </Button>
          {selected.size > 0 && <span className="text-muted-foreground">선택: {selected.size}개</span>}
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <Select onValueChange={(v) => bulkChangeStatus(v as any)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="상태 변경" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">초안</SelectItem>
                <SelectItem value="active">진행중</SelectItem>
                <SelectItem value="public">공개</SelectItem>
                <SelectItem value="completed">완료</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={bulkDuplicate}>
              <Copy className="w-4 h-4 mr-1" /> 복사
            </Button>
            <Button variant="destructive" onClick={bulkDelete}>
              <Trash2 className="w-4 h-4 mr-1" /> 삭제
            </Button>
          </div>
        )}
      </div>

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
            const checked = selected.has(survey.id);

            return (
              <Card key={survey.id} className={`transition-shadow hover:shadow-md ${checked ? "ring-2 ring-primary/50" : ""}`}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        aria-label="select"
                        className="mt-1"
                        checked={checked}
                        onChange={() => toggleOne(survey.id)}
                      />
                      <div>
                        <h3 className="text-xl font-semibold mb-2">
                          <Highlight text={survey.title ?? ""} query={q} />
                        </h3>
                        {survey.description && (
                          <p className="text-muted-foreground mb-3 line-clamp-2">{survey.description}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">작성자:</span>
                      <span>
                        <Highlight text={survey.creator_email ?? ""} query={filters.q ?? ""} />
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">강사:</span>
                      <span>
                        <Highlight text={survey.instructor_name ?? ""} query={filters.q ?? ""} />
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">과목:</span>
                      <span>
                        <Highlight text={survey.course_title ?? ""} query={filters.q ?? ""} />
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">과정:</span>
                      <span>
                        <Highlight text={survey.course_name ?? ""} query={filters.q ?? ""} />
                      </span>
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

      {/* 빠른 생성 다이얼로그 */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>빠른 설문 생성</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>교육 연도</Label>
                <Select value={String(qcYear)} onValueChange={(v) => setQcYear(parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + 1 - i).map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>차수</Label>
                <Input
                  type="number"
                  min={1}
                  value={qcRound}
                  onChange={(e) => setQcRound(parseInt(e.target.value || "1"))}
                />
              </div>
              <div className="space-y-1">
                <Label>일차</Label>
                <Input
                  type="number"
                  min={1}
                  value={qcDay}
                  onChange={(e) => setQcDay(parseInt(e.target.value || "1"))}
                />
              </div>
              <div className="space-y-1">
                <Label>과정명</Label>
                <Select value={qcCourse} onValueChange={(v) => setQcCourse(v)}>
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    {availableCourseNames.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">해당 연도의 과정이 없습니다.</div>
                    ) : (
                      availableCourseNames.map((n) => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>템플릿(선택)</Label>
              <Select value={qcTemplate ?? "none"} onValueChange={(v) => setQcTemplate(v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="선택 안함" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">선택 안함</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">선택 시 해당 템플릿이 연결된 상태로 생성됩니다.</p>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setOpenCreate(false)}>취소</Button>
            <Button onClick={doQuickCreate} disabled={creating || !qcCourse}>
              생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
