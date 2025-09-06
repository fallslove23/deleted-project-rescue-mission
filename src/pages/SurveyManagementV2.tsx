// src/pages/SurveyManagementV2.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { formatInTimeZone } from "date-fns-tz";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  BookOpen,
  User,
  AlertCircle,
  RefreshCw,
  Settings,
  Eye,
  Share2,
  Trash2,
  BarChart,
  Plus,
  Search,
  SortAsc,
  SortDesc,
  CheckSquare,
  Download,
  Wand2,
} from "lucide-react";

import { DashboardLayout } from "@/components/DashboardLayout";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

import {
  SurveysRepository,
  SurveyListItem,
  SurveyFilters,
  SortBy,
  SortDir,
  TemplateLite,
} from "@/repositories/surveysRepo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import SurveyCreateForm from "@/components/SurveyCreateForm";

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

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function Highlight({ text, query }: { text?: string | null; query: string }) {
  const t = text ?? "";
  if (!query.trim()) return <>{t}</>;
  const re = new RegExp(`(${escapeRegExp(query)})`, "ig");
  return (
    <>
      {t.split(re).map((part, i) =>
        re.test(part) ? (
          <mark key={i} className="px-0.5 rounded bg-yellow-100 dark:bg-yellow-900">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function QuickCreateDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  years: number[];
  courseNames: string[];
  templates: TemplateLite[];
  defaultYear: number;
  onCreate: (p: {
    education_year: number;
    education_round: number;
    education_day: number;
    course_name: string;
    template_id: string | null;
  }) => Promise<void>;
}) {
  const { open, onOpenChange, years, courseNames, templates, defaultYear, onCreate } = props;
  const [year, setYear] = useState<number>(defaultYear);
  const [round, setRound] = useState<number>(1);
  const [day, setDay] = useState<number>(1);
  const [course, setCourse] = useState<string>(courseNames[0] ?? "BS Basic");
  const [templateId, setTemplateId] = useState<string | null>(templates[0]?.id ?? null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => setYear(defaultYear), [defaultYear]);
  useEffect(() => {
    if (courseNames.length && !courseNames.includes(course)) setCourse(courseNames[0]);
  }, [courseNames]);
  useEffect(() => setTemplateId(templates[0]?.id ?? null), [templates]);

  const submit = async () => {
    setSubmitting(true);
    try {
      await onCreate({
        education_year: year,
        education_round: round,
        education_day: day,
        course_name: course,
        template_id: templateId,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>빠른 생성</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">교육 연도</label>
            <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">과정명</label>
            <Select value={course} onValueChange={(v) => setCourse(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {courseNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">차수</label>
              <Input type="number" min={1} value={round}
                onChange={(e) => setRound(parseInt(e.target.value || "1"))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">일차</label>
              <Input type="number" min={1} value={day}
                onChange={(e) => setDay(parseInt(e.target.value || "1"))} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">템플릿</label>
            <Select value={templateId ?? "none"} onValueChange={(v) => setTemplateId(v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">선택 안 함</SelectItem>
                {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "생성 중..." : "생성"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SurveyManagementV2() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [surveys, setSurveys] = useState<SurveyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [availableCourseNames, setAvailableCourseNames] = useState<string[]>([]);
  const [templates, setTemplates] = useState<TemplateLite[]>([]);

  const [filters, setFilters] = useState<SurveyFilters>({
    year: params.get("year") ? parseInt(params.get("year") as string) : null,
    status: (params.get("status") as any) || null,
    courseName: params.get("course") || null,
    q: params.get("q") || null,
  });

  const [sortBy, setSortBy] = useState<SortBy>((params.get("sortBy") as SortBy) || "created_at");
  const [sortDir, setSortDir] = useState<SortDir>((params.get("sortDir") as SortDir) || "desc");
  const [currentPage, setCurrentPage] = useState<number>(params.get("page") ? parseInt(params.get("page") as string) : 1);

  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [searchText, setSearchText] = useState(filters.q ?? "");
  const searchRef = useRef<HTMLInputElement>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allChecked = useMemo(() => surveys.length > 0 && surveys.every((s) => selected.has(s.id)), [surveys, selected]);

  // 상세 시트
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSurvey, setSheetSurvey] = useState<SurveyListItem | null>(null);

  // 다이얼로그들
  const [quickOpen, setQuickOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // URL 동기화
  useEffect(() => {
    const p = new URLSearchParams();
    if (filters.year) p.set("year", String(filters.year));
    if (filters.status) p.set("status", filters.status);
    if (filters.courseName) p.set("course", filters.courseName);
    if (filters.q) p.set("q", filters.q);
    if (sortBy) p.set("sortBy", sortBy);
    if (sortDir) p.set("sortDir", sortDir);
    p.set("page", String(currentPage));
    setParams(p, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sortBy, sortDir, currentPage]);

  // 데이터 로드
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
      setError(e?.message || "데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const loadCourseNames = async (year: number | null) => {
    const names = await SurveysRepository.getAvailableCourseNames();
    setAvailableCourseNames(names);
    if (filters.courseName && !names.includes(filters.courseName)) {
      setFilters((p) => ({ ...p, courseName: null }));
    }
  };

  useEffect(() => { loadData(); }, [currentPage, filters.year, filters.status, filters.q, filters.courseName, sortBy, sortDir]);
  useEffect(() => { loadCourseNames(filters.year); }, [filters.year]);

  useEffect(() => { (async () => setTemplates(await SurveysRepository.listTemplates()))(); }, []);

  // 단축키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const formatSafeDate = (iso: string | null): string => {
    if (!iso) return "미설정";
    try {
      const d = new Date(iso);
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
    const v = value === "all" ? null : key === "year" ? (value ? parseInt(value) : null) : (value as any);
    setFilters((prev) => ({ ...prev, [key]: v }));
    setCurrentPage(1);
    setSelected(new Set());
  };

  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(surveys.map((s) => s.id)));
  };
  const toggleOne = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const exportCsvAll = async () => {
    const res = await SurveysRepository.fetchSurveyList(1, 1000, filters, sortBy, sortDir);
    downloadCsv(res.data);
  };
  const exportCsvSelected = async () => {
    const rows = await SurveysRepository.fetchByIds(Array.from(selected));
    downloadCsv(rows);
  };
  const downloadCsv = (rows: SurveyListItem[]) => {
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
    const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
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

  const runAutoStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("auto-status-update", { body: {} });
      if (error) throw error;
      toast({ title: "상태 동기화 완료", description: `활성:${data?.toActive ?? 0}, 완료:${data?.toCompleted ?? 0}` });
      loadData();
    } catch (e: any) {
      toast({ title: "동기화 실패", description: e?.message || "오류", variant: "destructive" });
    }
  };

  const handleQuickCreate = async (p: {
    education_year: number;
    education_round: number;
    education_day: number;
    course_name: string;
    template_id: string | null;
  }) => {
    const created = await SurveysRepository.quickCreateSurvey(p);
    toast({ title: "설문 생성 완료", description: created.title ?? "" });
    navigate(`/survey-builder/${created.id}`);
  };

  // 로딩 중일 때 DashboardLayout 사용
  if (loading) {
    return (
      <DashboardLayout 
        title="설문 관리" 
        description="설문조사 생성 및 관리"
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
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
      </DashboardLayout>
    );
  }

  const q = filters.q ?? "";

  return (
    <DashboardLayout 
      title="설문 관리" 
      description={`전체 ${totalCount}개의 설문`}
    >
      <div className="space-y-6">
        {/* 액션 버튼들 */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportCsvAll}>
              <Download className="w-4 h-4 mr-2" />
              CSV 내보내기
            </Button>
            <Button variant="outline" size="sm" onClick={runAutoStatus}>
              <Wand2 className="w-4 h-4 mr-2" />
              상태 동기화
            </Button>
            <Button variant="outline" size="sm" onClick={() => loadData()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              새로고침
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              설문 추가
            </Button>
            <Button onClick={() => setQuickOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              빠른 생성
            </Button>
          </div>
        </div>

        {/* 검색/필터 카드 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">검색 / 필터</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">검색</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={searchText}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchText(val);
                    const t = setTimeout(() => {
                      setFilters((p) => ({ ...p, q: val.trim() || null }));
                      setCurrentPage(1);
                    }, DEBOUNCE_MS);
                    return () => clearTimeout(t);
                  }}
                  placeholder="제목, 과정, 강사명으로 검색 (단축키: /)"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">교육 연도</label>
                <Select value={filters.year?.toString() || "all"} onValueChange={(v) => handleFilterChange("year", v)}>
                  <SelectTrigger><SelectValue placeholder="모든 연도" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">모든 연도</SelectItem>
                    {availableYears.map((y) => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">과정명</label>
                <Select value={filters.courseName || "all"} onValueChange={(v) => handleFilterChange("courseName", v)}>
                  <SelectTrigger><SelectValue placeholder="모든 과정" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">모든 과정</SelectItem>
                    {availableCourseNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">상태</label>
                <Select value={filters.status || "all"} onValueChange={(v) => handleFilterChange("status", v)}>
                  <SelectTrigger><SelectValue placeholder="모든 상태" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">모든 상태</SelectItem>
                    <SelectItem value="draft">초안</SelectItem>
                    <SelectItem value="active">진행중</SelectItem>
                    <SelectItem value="public">공개</SelectItem>
                    <SelectItem value="completed">완료</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">정렬</label>
                <div className="flex gap-2">
                  <Select value={sortBy} onValueChange={(v: SortBy) => setSortBy(v)}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">생성일</SelectItem>
                      <SelectItem value="start_date">시작일</SelectItem>
                      <SelectItem value="end_date">종료일</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
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

        {/* 일괄 작업 바 */}
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  <CheckSquare className="w-4 h-4 mr-1" />
                  {allChecked ? "전체 해제" : "현재 페이지 전체선택"}
                </Button>
                <span className="text-sm text-muted-foreground">선택: {selected.size}개</span>
              </div>

              <div className="flex items-center gap-2">
                <Select
                  onValueChange={async (v) => {
                    if (selected.size === 0) return;
                    await SurveysRepository.updateStatusMany(Array.from(selected), v as any);
                    setSelected(new Set());
                    loadData();
                    toast({ title: "상태 변경 완료" });
                  }}
                >
                  <SelectTrigger className="h-9 px-3 w-auto min-w-[100px] text-sm">
                    <SelectValue placeholder="상태 변경" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">초안</SelectItem>
                    <SelectItem value="active">진행중</SelectItem>
                    <SelectItem value="public">공개</SelectItem>
                    <SelectItem value="completed">완료</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" size="sm" onClick={exportCsvSelected} disabled={selected.size === 0}>
                  <Download className="w-4 h-4 mr-1" />
                  CSV(선택)
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    if (selected.size === 0) return;
                    if (!confirm(`${selected.size}개 설문을 삭제할까요?`)) return;
                    await SurveysRepository.deleteMany(Array.from(selected));
                    setSelected(new Set());
                    loadData();
                    toast({ title: "삭제 완료" });
                  }}
                  disabled={selected.size === 0}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  삭제
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 목록 */}
        {surveys.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">조건에 맞는 설문이 없습니다.</p>
              <Button onClick={() => setQuickOpen(true)} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                첫 설문 만들기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {surveys.map((s) => {
              const statusInfo = getStatusInfo(s);
              const checked = selected.has(s.id);

              const openSheet = () => {
                setSheetSurvey(s);
                setSheetOpen(true);
              };

              return (
                <Card
                  key={s.id}
                  className={`transition-all duration-200 hover:shadow-lg ${checked ? "ring-2 ring-primary/50 shadow-md" : ""} cursor-pointer`}
                  onClick={openSheet}
                >
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4 gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={checked}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleOne(s.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-semibold mb-2 line-clamp-2 break-words">
                            <Highlight text={s.title ?? "제목 없음"} query={q} />
                          </h3>
                          {s.description && (
                            <p className="text-muted-foreground mb-3 line-clamp-2 break-words text-sm">
                              {s.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant={statusInfo.variant} className="shrink-0">
                        {statusInfo.label}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <User className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground shrink-0">작성자:</span>
                        <span className="truncate"><Highlight text={s.creator_email ?? "unknown"} query={q} /></span>
                      </div>

                      <div className="flex items-center gap-2 min-w-0">
                        <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground shrink-0">강사:</span>
                        <span className="truncate"><Highlight text={s.instructor_name ?? "Unknown"} query={q} /></span>
                      </div>

                      <div className="flex items-center gap-2 min-w-0">
                        <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground shrink-0">과목:</span>
                        <span className="truncate"><Highlight text={s.course_title ?? s.course_name ?? "Unknown"} query={q} /></span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">예상 참가자:</span>
                        <span>{s.expected_participants ?? "미설정"}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">교육기간:</span>
                        <div className="font-medium">
                          {s.education_year && s.education_round ? `${s.education_year}년 ${s.education_round}기` : "미설정"}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">시작일:</span>
                        <div className="font-medium">{formatSafeDate(s.start_date)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">종료일:</span>
                        <div className="font-medium">{formatSafeDate(s.end_date)}</div>
                      </div>
                    </div>

                    {s.is_test && (
                      <div className="mt-3">
                        <Badge variant="outline" className="text-xs">테스트 설문</Badge>
                      </div>
                    )}

                    {/* 카드 내부 버튼들: 클릭 버블링 막기 */}
                    <div className="mt-4 flex flex-wrap gap-2 border-t pt-4" onClick={(e) => e.stopPropagation()}>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/survey-builder/${s.id}`)}>
                        <Settings className="w-4 h-4 mr-1" /> 편집
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/survey-preview/${s.id}`)}>
                        <Eye className="w-4 h-4 mr-1" /> 미리보기
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/survey-detailed-analysis/${s.id}`)}>
                        <BarChart className="w-4 h-4 mr-1" /> 결과
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const link = `${window.location.origin}/survey/${s.id}`;
                          navigator.clipboard.writeText(link);
                          toast({ title: "링크 복사됨", description: "클립보드에 복사되었습니다." });
                        }}
                      >
                        <Share2 className="w-4 h-4 mr-1" /> 공유
                      </Button>

                      <Select
                        value={s.status ?? "draft"}
                        onValueChange={async (v) => {
                          await SurveysRepository.updateStatus(s.id, v as "draft" | "active" | "public" | "completed");
                          toast({ title: "상태 변경됨", description: `${STATUS_CONFIG[v as keyof typeof STATUS_CONFIG]?.label || v}로 변경되었습니다.` });
                          loadData();
                        }}
                      >
                        <SelectTrigger className="h-9 px-3 w-auto min-w-[100px] text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">초안</SelectItem>
                          <SelectItem value="active">진행중</SelectItem>
                          <SelectItem value="public">공개</SelectItem>
                          <SelectItem value="completed">완료</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 py-6">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={currentPage <= 1} 
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> 이전
            </Button>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {currentPage} / {totalPages} 페이지
              </span>
              <span className="text-xs text-muted-foreground">
                (총 {totalCount}개)
              </span>
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              disabled={currentPage >= totalPages} 
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              다음 <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* 상세 시트 */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader className="pb-4">
              <SheetTitle className="break-words text-left">
                {sheetSurvey?.title || "제목 없음"}
              </SheetTitle>
              <SheetDescription className="break-words text-left">
                {sheetSurvey?.description || "설명 없음"}
              </SheetDescription>
            </SheetHeader>

            {sheetSurvey && (
              <div className="space-y-6 text-sm">
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground font-medium">상태</span>
                    <Badge variant={getStatusInfo(sheetSurvey).variant}>
                      {getStatusInfo(sheetSurvey).label}
                    </Badge>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">교육기간</span>
                      <span className="font-medium">
                        {sheetSurvey.education_year && sheetSurvey.education_round
                          ? `${sheetSurvey.education_year}년 ${sheetSurvey.education_round}기`
                          : "미설정"}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">시작일</span>
                      <span className="font-medium">{formatSafeDate(sheetSurvey.start_date)}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">종료일</span>
                      <span className="font-medium">{formatSafeDate(sheetSurvey.end_date)}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">작성자</span>
                      <span className="font-medium break-all">{sheetSurvey.creator_email || "unknown"}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">강사</span>
                      <span className="font-medium">{sheetSurvey.instructor_name || "Unknown"}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">과목</span>
                      <span className="font-medium">{sheetSurvey.course_title || sheetSurvey.course_name || "Unknown"}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">예상 참가자</span>
                      <span className="font-medium">{sheetSurvey.expected_participants ?? "미설정"}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-2">
                  <h4 className="font-medium text-base mb-3">작업</h4>
                  <div className="grid grid-cols-1 gap-2">
                    <Button variant="outline" onClick={() => navigate(`/survey-builder/${sheetSurvey.id}`)}>
                      <Settings className="w-4 h-4 mr-2" /> 질문 편집
                    </Button>
                    <Button variant="outline" onClick={() => navigate(`/survey-preview/${sheetSurvey.id}`)}>
                      <Eye className="w-4 h-4 mr-2" /> 미리보기
                    </Button>
                    <Button variant="outline" onClick={() => navigate(`/survey-detailed-analysis/${sheetSurvey.id}`)}>
                      <BarChart className="w-4 h-4 mr-2" /> 결과 분석
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const link = `${window.location.origin}/survey/${sheetSurvey.id}`;
                        navigator.clipboard.writeText(link);
                        toast({ title: "링크 복사됨", description: "클립보드에 복사되었습니다." });
                        setSheetOpen(false);
                      }}
                    >
                      <Share2 className="w-4 h-4 mr-2" /> 공유 링크 복사
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* 빠른 생성 모달 */}
        <QuickCreateDialog
          open={quickOpen}
          onOpenChange={setQuickOpen}
          years={availableYears.length ? availableYears : [new Date().getFullYear()]}
          courseNames={availableCourseNames.length ? availableCourseNames : ["BS Basic"]}
          templates={templates}
          defaultYear={filters.year ?? new Date().getFullYear()}
          onCreate={handleQuickCreate}
        />

        {/* 설문 추가(정식) 모달: 기존 SurveyCreateForm 사용 */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>새 설문 추가</DialogTitle>
            </DialogHeader>
            <SurveyCreateForm
              templates={templates.map((t) => ({ id: t.id, name: t.name }))}
              onSuccess={(surveyId: string) => {
                setCreateOpen(false);
                toast({ title: "설문 생성 완료", description: "설문이 성공적으로 생성되었습니다." });
                navigate(`/survey-builder/${surveyId}`);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}