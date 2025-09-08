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
  const debounceTimer = useRef<number | null>(null);

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
    const names = await SurveysRepository.getAvailableCourseNames(year);
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

  // 검색 디바운스: onChange 내 return(cleanup)이 무시되는 문제를 해결
  useEffect(() => {
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      setFilters((p) => ({ ...p, q: searchText.trim() || null }));
      setCurrentPage(1);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
  }, [searchText]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const created = await SurveysRepository.quickCreateSurvey({
      ...p,
      program_name: p.course_name // course_name을 program_name으로 매핑
    });
    toast({ title: "설문 생성 완료", description: created.title ?? "" });
    navigate(`/survey-builder/${created.id}`);
  };

  // 로딩 UI
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">설문 관리</h1>
              <p className="text-muted-foreground">설문 생성 및 관리</p>
            </div>
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
      </div>
    );
  }

  const q = filters.q ?? "";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Plus className="h-6 w-6" />
                설문 관리
              </h1>
              <p className="text-gray-600 mt-1">
                전체 설문 결과 관리 및 통계 확인할 수 있습니다
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full px-3"
                onClick={exportCsvAll}
              >
                <Download className="w-4 h-4 mr-1.5" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full px-3"
                onClick={runAutoStatus}
              >
                <Wand2 className="w-4 h-4 mr-1.5" />
                상태 동기화
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full px-3"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                설문 추가
              </Button>
              <Button
                size="sm"
                className="rounded-full px-3"
                onClick={() => setQuickOpen(true)}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                빠른 생성
              </Button>
            </div>
          </div>
        </div>

        {/* 검색/필터 카드 */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">검색 / 필터</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">검색</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="제목 / 과정 / 강사 검색"
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
                    <SelectItem value="completed">완료</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">정렬</label>
                <div className="flex gap-2">
                  <Select value={sortBy} onValueChange={(v: SortBy) => setSortBy(v)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">생성일</SelectItem>
                      <SelectItem value="title">제목</SelectItem>
                      <SelectItem value="education_year">연도</SelectItem>
                      <SelectItem value="status">상태</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
                    className="px-3"
                  >
                    {sortDir === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* 선택된 항목들 액션 */}
        {selected.size > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{selected.size}개 선택됨</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                  선택 해제
                </Button>
                <Button variant="outline" size="sm" onClick={exportCsvSelected}>
                  <Download className="w-4 h-4 mr-1.5" />
                  선택 항목 CSV
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 설문 목록 */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="p-4 text-left">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </th>
                  <th className="p-4 text-left font-medium">제목</th>
                  <th className="p-4 text-left font-medium">상태</th>
                  <th className="p-4 text-left font-medium">연도/차수</th>
                  <th className="p-4 text-left font-medium">과정</th>
                  <th className="p-4 text-left font-medium">강사</th>
                  <th className="p-4 text-left font-medium">기간</th>
                  <th className="p-4 text-left font-medium">작업</th>
                </tr>
              </thead>
              <tbody>
                {surveys.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle className="h-8 w-8 opacity-50" />
                        <p>조건에 맞는 설문이 없습니다.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  surveys.map((survey) => {
                    const statusInfo = getStatusInfo(survey);
                    return (
                      <tr key={survey.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={selected.has(survey.id)}
                            onChange={() => toggleOne(survey.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="p-4">
                          <div className="font-medium">
                            <Highlight text={survey.title} query={q} />
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <Highlight text={survey.course_title} query={q} />
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        </td>
                        <td className="p-4">
                          <div className="text-sm">
                            {survey.education_year}년 {survey.education_round}차
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {survey.education_day}일차
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm">
                            <Highlight text={survey.course_name} query={q} />
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm">
                            <Highlight text={survey.instructor_name} query={q} />
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-xs text-muted-foreground">
                            <div>{formatSafeDate(survey.start_date)}</div>
                            <div>~ {formatSafeDate(survey.end_date)}</div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSheetSurvey(survey);
                                setSheetOpen(true);
                              }}
                              title="상세 보기"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/survey-builder/${survey.id}`)}
                              title="편집"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/survey/${survey.id}`)}
                              title="미리보기"
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/dashboard/detailed-analysis/${survey.id}`)}
                              title="분석"
                            >
                              <BarChart className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-muted-foreground">
              총 {totalCount}개 항목 중 {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, totalCount)}번째
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                  return (
                    <Button
                      key={page}
                      variant={page === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-10"
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* 다이얼로그들 */}
        <QuickCreateDialog
          open={quickOpen}
          onOpenChange={setQuickOpen}
          years={availableYears}
          courseNames={availableCourseNames}
          templates={templates}
          defaultYear={new Date().getFullYear()}
          onCreate={handleQuickCreate}
        />

        {/* 설문 생성 다이얼로그 */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>새 설문 생성</DialogTitle>
            </DialogHeader>
            <SurveyCreateForm 
              onSuccess={(surveyId) => {
                setCreateOpen(false);
                navigate(`/survey-builder/${surveyId}`);
              }}
              templates={templates}
            />
          </DialogContent>
        </Dialog>

        {/* 상세 정보 시트 */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="right" className="w-[600px] sm:max-w-[600px]">
            <SheetHeader>
              <SheetTitle>{sheetSurvey?.title}</SheetTitle>
              <SheetDescription>설문 상세 정보</SheetDescription>
            </SheetHeader>
            {sheetSurvey && (
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">상태</label>
                    <div className="mt-1">
                      <Badge variant={getStatusInfo(sheetSurvey).variant}>
                        {getStatusInfo(sheetSurvey).label}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">교육 정보</label>
                    <div className="mt-1 text-sm">
                      {sheetSurvey.education_year}년 {sheetSurvey.education_round}차 {sheetSurvey.education_day}일차
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">과정명</label>
                  <div className="mt-1 text-sm">{sheetSurvey.course_name}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">과정 제목</label>
                  <div className="mt-1 text-sm">{sheetSurvey.course_title}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">강사</label>
                  <div className="mt-1 text-sm">{sheetSurvey.instructor_name}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">설문 기간</label>
                  <div className="mt-1 text-sm">
                    <div>{formatSafeDate(sheetSurvey.start_date)}</div>
                    <div>~ {formatSafeDate(sheetSurvey.end_date)}</div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">생성자</label>
                  <div className="mt-1 text-sm">{sheetSurvey.creator_email}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">생성일</label>
                  <div className="mt-1 text-sm">{formatSafeDate(sheetSurvey.created_at)}</div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => navigate(`/survey-builder/${sheetSurvey.id}`)}
                    className="flex-1"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    편집
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/survey/${sheetSurvey.id}`)}
                    className="flex-1"
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    미리보기
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}