// src/pages/SurveyManagementV2.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  QrCode,
  Copy,
  Link,
  Play,
  Pause,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import { getSurveyUrl } from '@/lib/utils';

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
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { ToastAction } from "@/components/ui/toast";

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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const CSV_URL_TTL = 60_000;

type CsvDownloadHandle = {
  url: string;
  fileName: string;
  timeoutId: number | null;
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatFileSize = (bytes: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, exponent);
  return `${size >= 10 || exponent === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[exponent]}`;
};

const errorToString = (error: unknown) => {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
};
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingSurveyId, setDeletingSurveyId] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrSurveyId, setQrSurveyId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSurveyId, setShareSurveyId] = useState<string | null>(null);

  const [csvExporting, setCsvExporting] = useState(false);
  const [duplicateInProgressId, setDuplicateInProgressId] = useState<string | null>(null);
  const [logDialogData, setLogDialogData] = useState<{ title: string; message: string } | null>(null);
  const csvDownloadRef = useRef<CsvDownloadHandle | null>(null);

  const releaseCsvUrl = useCallback(() => {
    if (!csvDownloadRef.current) return;
    URL.revokeObjectURL(csvDownloadRef.current.url);
    if (csvDownloadRef.current.timeoutId) {
      window.clearTimeout(csvDownloadRef.current.timeoutId);
    }
    csvDownloadRef.current = null;
  }, []);

  const createRevokeTimer = useCallback((url: string) => {
    return window.setTimeout(() => {
      URL.revokeObjectURL(url);
      if (csvDownloadRef.current?.url === url) {
        csvDownloadRef.current = null;
      }
    }, CSV_URL_TTL);
  }, []);

  const registerCsvDownload = useCallback(
    (url: string, fileName: string) => {
      releaseCsvUrl();
      const timeoutId = createRevokeTimer(url);
      csvDownloadRef.current = { url, fileName, timeoutId };
    },
    [createRevokeTimer, releaseCsvUrl]
  );

  const extendCsvUrlLifetime = useCallback(
    (url: string) => {
      if (csvDownloadRef.current?.url !== url) return;
      if (csvDownloadRef.current.timeoutId) {
        window.clearTimeout(csvDownloadRef.current.timeoutId);
      }
      csvDownloadRef.current.timeoutId = createRevokeTimer(url);
    },
    [createRevokeTimer]
  );

  const triggerCsvDownload = useCallback(
    (url: string, fileName: string) => {
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      extendCsvUrlLifetime(url);
    },
    [extendCsvUrlLifetime]
  );

  useEffect(() => {
    return () => {
      releaseCsvUrl();
    };
  }, [releaseCsvUrl]);

  const handleCsvExportSuccess = useCallback(
    (rows: SurveyListItem[], info: { url: string; blob: Blob; fileName: string }) => {
      toast({
        title: "CSV 내보내기 완료",
        description: (
          <div className="space-y-1">
            <p>총 {rows.length}개의 응답을 내보냈습니다.</p>
            <p>파일 크기: {formatFileSize(info.blob.size)}</p>
          </div>
        ),
        action: (
          <ToastAction altText="CSV 다시 다운로드" onClick={() => triggerCsvDownload(info.url, info.fileName)}>
            다시 다운로드
          </ToastAction>
        ),
      });
    },
    [toast, triggerCsvDownload]
  );

  const showCsvErrorToast = useCallback(
    (message: string, errorDetails: string, retry: () => void) => {
      toast({
        variant: "destructive",
        title: "CSV 내보내기 실패",
        description: (
          <div className="space-y-3">
            <p>{message}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" type="button" onClick={retry} className="h-8">
                재시도
              </Button>
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={() =>
                  setLogDialogData({
                    title: "CSV 내보내기 실패 로그",
                    message: errorDetails,
                  })
                }
                className="h-8"
              >
                로그 보기
              </Button>
            </div>
          </div>
        ),
      });
    },
    [setLogDialogData, toast]
  );

  const showDuplicateErrorToast = useCallback(
    (errorDetails: string, retry: () => void) => {
      toast({
        variant: "destructive",
        title: "복제 실패",
        description: (
          <div className="space-y-3">
            <p>설문 복제 중 오류가 발생했습니다.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" type="button" onClick={retry} className="h-8">
                재시도
              </Button>
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={() =>
                  setLogDialogData({
                    title: "복제 실패 로그",
                    message: errorDetails,
                  })
                }
                className="h-8"
              >
                로그 보기
              </Button>
            </div>
          </div>
        ),
      });
    },
    [setLogDialogData, toast]
  );

  // QR 코드 다운로드 함수
  const handleDownloadQR = async (surveyId: string) => {
    try {
      const url = getSurveyUrl(surveyId);
      const response = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`);
      const blob = await response.blob();
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `survey-qr-${surveyId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      
      toast({
        title: "QR 코드 다운로드 완료",
        description: "QR 코드가 성공적으로 다운로드되었습니다.",
      });
    } catch (error) {
      toast({
        title: "다운로드 실패",
        description: "QR 코드 다운로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

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

  // 검색 디바운스
  useEffect(() => {
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      setFilters((p) => ({ ...p, q: searchText.trim() || null }));
      setCurrentPage(1);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
  }, [searchText]);

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
    // DB의 실제 상태를 우선 사용 - 시간 계산은 보조적으로만 사용
    if (s.status === "draft") return STATUS_CONFIG.draft;
    if (s.status === "completed") return STATUS_CONFIG.completed;
    
    // active/public 상태에서만 시간 기반 세부 상태 체크
    if (s.status === "active" || s.status === "public") {
      const now = new Date();
      const start = s.start_date ? new Date(s.start_date) : null;
      const end = s.end_date ? new Date(s.end_date) : null;
      
      // 시작 전
      if (start && now < start) return STATUS_CONFIG.scheduled;
      // 종료 후
      if (end && now > end) return STATUS_CONFIG.expired;
      // 진행 중
      return STATUS_CONFIG.active;
    }
    
    // 기본값
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
    if (csvExporting) return;
    setCsvExporting(true);
    try {
      const res = await SurveysRepository.fetchSurveyList(1, 1000, filters, sortBy, sortDir);
      const info = downloadCsv(res.data);
      handleCsvExportSuccess(res.data, info);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      const details = errorToString(error);
      showCsvErrorToast('설문 데이터를 내보내는 중 오류가 발생했습니다.', details, exportCsvAll);
    } finally {
      setCsvExporting(false);
    }
  };
  const exportCsvSelected = async () => {
    if (csvExporting || selected.size === 0) return;
    setCsvExporting(true);
    try {
      const rows = await SurveysRepository.fetchByIds(Array.from(selected));
      const info = downloadCsv(rows);
      handleCsvExportSuccess(rows, info);
    } catch (error) {
      console.error('Error exporting selected CSV:', error);
      const details = errorToString(error);
      showCsvErrorToast('선택한 설문을 내보내는 중 오류가 발생했습니다.', details, exportCsvSelected);
    } finally {
      setCsvExporting(false);
    }
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
    const fileName = `surveys_${Date.now()}.csv`;
    registerCsvDownload(url, fileName);
    triggerCsvDownload(url, fileName);
    return { url, blob, fileName };
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

  const handleDeleteSurvey = async () => {
    if (!deletingSurveyId) return;
    
    try {
      // 단일 설문 삭제 또는 다중 설문 삭제 처리
      const isMultiple = deletingSurveyId.includes(',');
      const surveyIds = isMultiple ? deletingSurveyId.split(',') : [deletingSurveyId];
      
      const { error } = await supabase
        .from('surveys')
        .delete()
        .in('id', surveyIds);
      
      if (error) throw error;
      
      toast({
        title: "삭제 완료",
        description: `${surveyIds.length}개 설문이 성공적으로 삭제되었습니다.`
      });
      
      setDeleteOpen(false);
      setDeletingSurveyId(null);
      setSelected(new Set()); // 선택 해제
      loadData();
    } catch (error) {
      console.error('Error deleting survey:', error);
      toast({
        title: "삭제 실패",
        description: "설문 삭제 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const handleStatusToggle = async (surveyId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'draft' : 'active';
    
    try {
      const { error } = await supabase
        .from('surveys')
        .update({ status: newStatus })
        .eq('id', surveyId);
      
      if (error) throw error;
      
      toast({
        title: "상태 변경 완료",
        description: `설문이 ${newStatus === 'active' ? '활성화' : '비활성화'}되었습니다.`
      });
      
      loadData();
    } catch (error) {
      console.error('Error updating survey status:', error);
      toast({
        title: "상태 변경 실패",
        description: "설문 상태 변경 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const handleCopyLink = (surveyId: string) => {
    const link = getSurveyUrl(surveyId);
    navigator.clipboard.writeText(link);
    toast({
      title: "링크 복사됨",
      description: "설문 링크가 클립보드에 복사되었습니다."
    });
  };


  const handleBulkStatusChange = async (surveyIds: string[], newStatus: string) => {
    try {
      const { error } = await supabase
        .from('surveys')
        .update({ status: newStatus })
        .in('id', surveyIds);
      
      if (error) throw error;
      
      toast({
        title: "일괄 상태 변경 완료",
        description: `${surveyIds.length}개 설문이 ${newStatus === 'active' ? '활성화' : '비활성화'}되었습니다.`
      });
      
      setSelected(new Set());
      loadData();
    } catch (error) {
      console.error('Error bulk updating survey status:', error);
      toast({
        title: "상태 변경 실패",
        description: "설문 상태 변경 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const handleDuplicateSurvey = async (surveyId: string) => {
    if (duplicateInProgressId) return;
    setDuplicateInProgressId(surveyId);
    try {
      // 원본 설문 정보 가져오기
      const { data: originalSurvey, error: surveyError } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', surveyId)
        .single();

      if (surveyError) throw surveyError;

      // 새 설문 생성
      const { data: newSurvey, error: createError } = await supabase
        .from('surveys')
        .insert({
          ...originalSurvey,
          id: undefined, // 새 ID 생성
          title: `${originalSurvey.title} (복사본)`,
          status: 'draft',
          created_at: undefined,
          updated_at: undefined
        })
        .select()
        .single();

      if (createError) throw createError;

      toast({
        title: "복제 완료",
        description: "설문이 성공적으로 복제되었습니다."
      });

      navigate(`/survey-builder/${newSurvey.id}`);
    } catch (error) {
      console.error('Error duplicating survey:', error);
      const details = errorToString(error);
      showDuplicateErrorToast(details, () => handleDuplicateSurvey(surveyId));
    } finally {
      setDuplicateInProgressId(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout 
        title="설문 관리"
        description="전체 설문 생성 및 관리 그리고 통계 확인할 수 있습니다"
        loading={true}
      >
        <div className="space-y-4">
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
      </DashboardLayout>
    );
  }

  const q = filters.q ?? "";

  return (
    <DashboardLayout 
      title="설문 관리"
      description="전체 설문 생성 및 관리 그리고 통계 확인할 수 있습니다"
      icon={<Plus className="h-5 w-5" />}
      totalCount={totalCount}
      actions={[
        <Button
          key="csv"
          variant="outline"
          size="sm"
          onClick={exportCsvAll}
          disabled={csvExporting}
        >
          {csvExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {csvExporting ? "내보내는 중..." : "CSV"}
        </Button>,
        <Button
          key="quick"
          variant="outline"
          size="sm"
          onClick={() => setQuickOpen(true)}
          disabled={!availableYears.length || !availableCourseNames.length}
        >
          <Wand2 className="h-4 w-4 mr-2" />
          빠른 생성
        </Button>,
        <Button
          key="create"
          size="sm"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          새로 생성
        </Button>
      ]}
    >
      <div className="space-y-6">
        {/* 검색 및 필터 */}
        <Card>
          <CardHeader>
            <CardTitle>검색 / 필터</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 검색 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">검색</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  ref={searchRef}
                  placeholder="제목 / 과정 / 강사 검색"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* 필터 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">교육 연도</label>
                <Select value={filters.year ? String(filters.year) : "all"} onValueChange={(v) => handleFilterChange("year", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">모든 연도</SelectItem>
                    {availableYears.map((y) => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">과정명</label>
                <Select value={filters.courseName || "all"} onValueChange={(v) => handleFilterChange("courseName", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">모든 과정</SelectItem>
                    {availableCourseNames.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">상태</label>
                <Select value={filters.status || "all"} onValueChange={(v) => handleFilterChange("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">모든 상태</SelectItem>
                    <SelectItem value="draft">초안</SelectItem>
                    <SelectItem value="active">진행중</SelectItem>
                    <SelectItem value="public">공개중</SelectItem>
                    <SelectItem value="completed">완료</SelectItem>
                    <SelectItem value="scheduled">시작예정</SelectItem>
                    <SelectItem value="expired">종료</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">정렬</label>
                <Select value={`${sortBy}_${sortDir}`} onValueChange={(v) => {
                  const [by, dir] = v.split("_");
                  setSortBy(by as SortBy);
                  setSortDir(dir as SortDir);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at_desc">생성일 ↓</SelectItem>
                    <SelectItem value="created_at_asc">생성일 ↑</SelectItem>
                    <SelectItem value="start_date_desc">시작일 ↓</SelectItem>
                    <SelectItem value="start_date_asc">시작일 ↑</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 오류 표시 */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 멀티 선택 플로팅 액션바 */}
        {selected.size > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
            <Card className="shadow-lg border-2 border-primary/20 bg-background/95 backdrop-blur-sm">
              <CardContent className="px-4 py-3">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{selected.size}개 선택됨</span>
                  </div>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportCsvSelected}
                      disabled={selected.size === 0 || csvExporting}
                    >
                      {csvExporting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-1" />
                      )}
                      {csvExporting ? "내보내는 중..." : "내보내기"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const selectedSurveys = surveys.filter(s => selected.has(s.id));
                        const activeCount = selectedSurveys.filter(s => s.status === 'active').length;
                        const inactiveCount = selectedSurveys.length - activeCount;
                        
                        // 대부분이 활성화된 경우 비활성화, 그렇지 않으면 활성화
                        const newStatus = activeCount > inactiveCount ? 'draft' : 'active';
                        handleBulkStatusChange(Array.from(selected), newStatus);
                      }}
                    >
                      {surveys.filter(s => selected.has(s.id) && s.status === 'active').length > 
                       surveys.filter(s => selected.has(s.id) && s.status !== 'active').length ? (
                        <>
                          <Pause className="h-4 w-4 mr-1" />
                          일괄 비활성화
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-1" />
                          일괄 활성화
                        </>
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setDeletingSurveyId(Array.from(selected).join(','));
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      삭제
                    </Button>
                  </div>
                  <div className="h-4 w-px bg-border" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected(new Set())}
                  >
                    선택 해제
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 설문 목록 */}
        <Card>
          <CardContent className="p-6">
            {/* 전체 선택 헤더 */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAll}
                  className="h-8 w-8 p-0"
                >
                  <CheckSquare className={`h-4 w-4 ${allChecked ? 'text-primary' : 'text-muted-foreground'}`} />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selected.size > 0 ? `${selected.size}개 선택됨` : '전체 선택'}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                총 {surveys.length}개 설문
              </div>
            </div>

            <div className="space-y-4">
              {surveys.map((survey) => (
                <div key={survey.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleOne(survey.id)}
                    className="h-8 w-8 p-0 flex-shrink-0"
                  >
                    <CheckSquare className={`h-4 w-4 ${selected.has(survey.id) ? 'text-primary' : 'text-muted-foreground'}`} />
                  </Button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium">{survey.title}</h3>
                      <Badge variant={getStatusInfo(survey).variant}>
                        {getStatusInfo(survey).label}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>과정: {survey.course_name} - {survey.education_year}년 {survey.education_round}차 {survey.education_day}일차</div>
                      {survey.instructor_name && (
                        <div>강사: {survey.instructor_name}</div>
                      )}
                      <div>생성일: {formatSafeDate(survey.created_at)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/survey-preview/${survey.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      미리보기
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/survey-detailed-analysis/${survey.id}`, { 
                        state: { from: 'survey-management' } 
                      })}
                    >
                      <BarChart className="h-4 w-4 mr-1" />
                      분석
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>작업</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate(`/survey-builder/${survey.id}`)}>
                          <Settings className="h-4 w-4 mr-2" />
                          편집
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setQrSurveyId(survey.id);
                          setQrOpen(true);
                        }}>
                          <QrCode className="h-4 w-4 mr-2" />
                          QR 코드
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          const surveyUrl = getSurveyUrl(survey.id);
                          navigator.clipboard.writeText(surveyUrl);
                          toast({
                            title: "링크 복사 완료",
                            description: "설문 링크가 클립보드에 복사되었습니다.",
                          });
                        }}>
                          <Link className="h-4 w-4 mr-2" />
                          링크 복사
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDuplicateSurvey(survey.id)}
                          disabled={!!duplicateInProgressId}
                        >
                          {duplicateInProgressId === survey.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              복제 중...
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-2" />
                              복제
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusToggle(survey.id, survey.status)}>
                          {survey.status === 'active' ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                          {survey.status === 'active' ? '비활성화' : '활성화'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => {
                            setDeletingSurveyId(survey.id);
                            setDeleteOpen(true);
                          }}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>

            {/* 페이지네이션 */}
            <div className="flex items-center justify-between mt-6">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                이전
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                다음
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 빠른 생성 다이얼로그 */}
        <QuickCreateDialog
          open={quickOpen}
          onOpenChange={setQuickOpen}
          years={availableYears}
          courseNames={availableCourseNames}
          templates={templates}
          defaultYear={new Date().getFullYear()}
          onCreate={handleQuickCreate}
        />

        {/* 설문 생성 시트 */}
        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetContent 
            side="right" 
            className="w-full sm:max-w-2xl overflow-y-auto"
            style={{ maxHeight: '100vh' }}
          >
            <SheetHeader>
              <SheetTitle>새 설문 생성</SheetTitle>
              <SheetDescription>
                새로운 설문을 생성합니다.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 pb-6">
              <SurveyCreateForm
                onSuccess={(surveyId) => {
                  setCreateOpen(false);
                  navigate(`/survey-builder/${surveyId}`);
                }}
                templates={templates}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* 삭제 확인 다이얼로그 */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>설문 삭제</DialogTitle>
              <DialogDescription>
                {deletingSurveyId?.includes(',') 
                  ? `선택한 ${deletingSurveyId.split(',').length}개 설문을 삭제하시겠습니까?`
                  : '정말로 이 설문을 삭제하시겠습니까?'
                } 이 작업은 되돌릴 수 없습니다.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                취소
              </Button>
              <Button variant="destructive" onClick={handleDeleteSurvey}>
                삭제
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* QR 코드 다이얼로그 */}
        <Dialog open={qrOpen} onOpenChange={setQrOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>QR 코드</DialogTitle>
              <DialogDescription>
                설문 참여용 QR 코드입니다.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-4">
              {qrSurveyId && (
                <div className="p-4 bg-white rounded-lg border">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getSurveyUrl(qrSurveyId))}`}
                    alt="QR Code"
                    className="w-48 h-48"
                  />
                </div>
              )}
              <div className="text-sm text-center space-y-2">
                <p>참여자가 이 QR 코드를 스캔하여 설문에 참여할 수 있습니다.</p>
                <p className="text-muted-foreground break-all">
                  {getSurveyUrl(qrSurveyId!)}
                </p>
              </div>
              <div className="flex space-x-2 w-full">
                <Button 
                  onClick={() => handleCopyLink(qrSurveyId!)}
                  variant="outline"
                  className="flex-1"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  링크 복사
                </Button>
                <Button 
                  onClick={() => handleDownloadQR(qrSurveyId!)}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  QR 다운로드
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!logDialogData} onOpenChange={(open) => !open && setLogDialogData(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{logDialogData?.title ?? '상세 로그'}</DialogTitle>
              <DialogDescription>
                문제 해결을 위해 아래 로그를 확인하세요.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto rounded border bg-muted/50 p-4">
              <pre className="whitespace-pre-wrap break-words text-sm">
                {logDialogData?.message}
              </pre>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLogDialogData(null)}>
                닫기
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}