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

import AdminLayout from "@/components/layouts/AdminLayout";
import { SidebarTrigger } from "@/components/ui/sidebar";
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
          <mark
            key={i}
            className="px-0.5 rounded bg-yellow-100 dark:bg-yellow-900"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
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
  const [availableCourseNames, setAvailableCourseNames] = useState<string[]>(
    []
  );
  const [templates, setTemplates] = useState<TemplateLite[]>([]);

  const [filters, setFilters] = useState<SurveyFilters>({
    year: params.get("year") ? parseInt(params.get("year") as string) : null,
    status: (params.get("status") as any) || null,
    courseName: params.get("course") || null,
    q: params.get("q") || null,
  });

  const [sortBy, setSortBy] = useState<SortBy>(
    (params.get("sortBy") as SortBy) || "created_at"
  );
  const [sortDir, setSortDir] = useState<SortDir>(
    (params.get("sortDir") as SortDir) || "desc"
  );
  const [currentPage, setCurrentPage] = useState<number>(
    params.get("page") ? parseInt(params.get("page") as string) : 1
  );

  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [searchText, setSearchText] = useState(filters.q ?? "");
  const searchRef = useRef<HTMLInputElement>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allChecked = useMemo(
    () => surveys.length > 0 && surveys.every((s) => selected.has(s.id)),
    [surveys, selected]
  );

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
        SurveysRepository.fetchSurveyList(
          currentPage,
          PAGE_SIZE,
          filters,
          sortBy,
          sortDir
        ),
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

  useEffect(() => {
    loadData();
  }, [
    currentPage,
    filters.year,
    filters.status,
    filters.q,
    filters.courseName,
    sortBy,
    sortDir,
  ]);
  useEffect(() => {
    loadCourseNames(filters.year);
  }, [filters.year]);

  useEffect(() => {
    (async () => setTemplates(await SurveysRepository.listTemplates()))();
  }, []);

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
    if (s.status === "active" || s.status === "public")
      return STATUS_CONFIG.active;
    return STATUS_CONFIG.draft;
  };

  const handleFilterChange = (key: keyof SurveyFilters, value: string) => {
    const v =
      value === "all"
        ? null
        : key === "year"
        ? value
          ? parseInt(value)
          : null
        : (value as any);
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
    const res = await SurveysRepository.fetchSurveyList(
      1,
      1000,
      filters,
      sortBy,
      sortDir
    );
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
      const { data, error } = await supabase.functions.invoke(
        "auto-status-update",
        { body: {} }
      );
      if (error) throw error;
      toast({
        title: "상태 동기화 완료",
        description: `활성:${data?.toActive ?? 0}, 완료:${
          data?.toCompleted ?? 0
        }`,
      });
      loadData();
    } catch (e: any) {
      toast({
        title: "동기화 실패",
        description: e?.message || "오류",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <main className="flex-1 max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <Skeleton className="h-8 w-48" />
            </div>
            <Skeleton className="h-10 w-24" />
          </div>
        </main>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <main className="flex-1 min-w-0">
        {/* 상단 Sticky 헤더 */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  설문 관리
                </h1>
                <p className="text-xs text-muted-foreground md:hidden">
                  전체 {totalCount}개의 설문
                </p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportCsvAll}>
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={runAutoStatus}>
                <Wand2 className="w-4 h-4 mr-2" />
                상태 동기화
              </Button>
              <Button variant="outline" size="sm" onClick={() => loadData()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                새로고침
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                설문 추가
              </Button>
            </div>
          </div>
        </div>

        {/* 이하 기존 목록/필터/카드 영역 그대로 유지 */}
      </main>
    </AdminLayout>
  );
}
