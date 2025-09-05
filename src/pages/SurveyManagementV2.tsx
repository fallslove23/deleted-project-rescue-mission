// src/pages/SurveyManagementV2.tsx
import React, { useEffect, useState } from "react";
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
  Copy,
  Share2,
  Trash2,
  BarChart,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

import {
  SurveysRepository,
  SurveyListItem,
  SurveyFilters,
} from "@/repositories/surveysRepo";

const TIMEZONE = "Asia/Seoul";
const PAGE_SIZE = 10;

const STATUS_CONFIG = {
  draft: { label: "초안", variant: "secondary" as const },
  active: { label: "진행중", variant: "default" as const },
  public: { label: "진행중", variant: "default" as const },
  completed: { label: "완료", variant: "outline" as const },
  scheduled: { label: "시작예정", variant: "secondary" as const },
  expired: { label: "종료", variant: "destructive" as const },
};

export default function SurveyManagementV2() {
  const { toast } = useToast();
  const [surveys, setSurveys] = useState<SurveyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [courseKeys, setCourseKeys] = useState<
    { year: number; round: number; course_name: string }[]
  >([]);
  const [selectedCourseKey, setSelectedCourseKey] = useState<string>("all");

  const [filters, setFilters] = useState<SurveyFilters>({
    year: null,
    status: null,
  });

  // 안전한 날짜 포맷팅
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

  // 상태 뱃지 계산
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

  // 필터 변경
  const handleFilterChange = (key: keyof SurveyFilters, value: string) => {
    const v =
      value === "all"
        ? null
        : key === "year"
        ? (value ? parseInt(value) : null)
        : (value as any);
    setFilters((prev) => ({ ...prev, [key]: v }));
    setSelectedCourseKey("all");
    setCurrentPage(1);
  };

  // 데이터 로드
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [result, years, courses] = await Promise.all([
        SurveysRepository.fetchSurveyList(currentPage, PAGE_SIZE, filters),
        SurveysRepository.getAvailableYears(),
        SurveysRepository.getAvailableCourseKeys(filters.year ?? undefined),
      ]);

      const filteredByCourse =
        selectedCourseKey === "all"
          ? result.data
          : result.data.filter((s) => {
              const [y, r, ...rest] = selectedCourseKey.split("::");
              const name = rest.join("::");
              return (
                String(s.education_year) === y &&
                String(s.education_round) === r &&
                (s.course_name ?? "") === name
              );
            });

      setSurveys(filteredByCourse);
      setTotalPages(result.totalPages);
      setTotalCount(result.count);
      setAvailableYears(years);
      setCourseKeys(courses);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, filters.year, filters.status, selectedCourseKey]);

  useEffect(() => {
    // 연도 바뀌면 과정 선택 초기화 및 페이지 첫페이지
    setSelectedCourseKey("all");
    setCurrentPage(1);
  }, [filters.year]);

  const handleRefresh = () => loadData();

  // 로딩 UI
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">설문 관리 V2</h1>
          <p className="text-muted-foreground">전체 {totalCount}개의 설문</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* 필터 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">필터</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 연도 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">교육 연도</label>
              <Select
                value={filters.year?.toString() || "all"}
                onValueChange={(v) => handleFilterChange("year", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="모든 연도" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 연도</SelectItem>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}년
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
                onValueChange={(v) => handleFilterChange("status", v)}
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

            {/* 과정 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">과정</label>
              <Select
                value={selectedCourseKey}
                onValueChange={(v) => {
                  setSelectedCourseKey(v);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="전체 과정" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 과정</SelectItem>
                  {courseKeys.map((k) => {
                    const key = `${k.year}::${k.round}::${k.course_name}`;
                    return (
                      <SelectItem key={key} value={key}>
                        {k.year}년 {k.round}기 - {k.course_name}
                      </SelectItem>
                    );
                  })}
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
          {surveys.map((s) => {
            const statusInfo = getStatusInfo(s);
            return (
              <Card key={s.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  {/* 타이틀/상태 */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-semibold mb-2 break-words">
                        {s.title ?? "제목 없음"}
                      </h3>
                      {s.description && (
                        <p className="text-muted-foreground mb-3 line-clamp-2 break-words">
                          {s.description}
                        </p>
                      )}
                    </div>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </div>

                  {/* 요약 정보 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <User className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground shrink-0">
                        작성자:
                      </span>
                      <span className="truncate">
                        {s.creator_email ?? "unknown"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground shrink-0">
                        강사:
                      </span>
                      <span className="truncate">
                        {s.instructor_name ?? "Unknown"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground shrink-0">
                        과목:
                      </span>
                      <span className="truncate">
                        {s.course_title ?? s.course_name ?? "Unknown"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">예상 참가자:</span>
                      <span>{s.expected_participants ?? "미설정"}</span>
                    </div>
                  </div>

                  {/* 기간 */}
                  <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">교육기간:</span>
                      <div className="font-medium">
                        {s.education_year && s.education_round
                          ? `${s.education_year}년 ${s.education_round}기`
                          : "미설정"}
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
                    <div className="mt-2">
                      <Badge variant="outline" className="text-xs">
                        테스트 설문
                      </Badge>
                    </div>
                  )}

                  {/* 액션 */}
                  <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(`/survey-builder/${s.id}`, "_self")
                      }
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      질문수정
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(`/survey-preview/${s.id}`, "_self")
                      }
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      미리보기
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(`/survey-results/${s.id}`, "_self")
                      }
                    >
                      <BarChart className="w-4 h-4 mr-1" />
                      결과
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const created = await SurveysRepository.duplicateSurvey(
                            s.id
                          );
                          toast({
                            title: "복사 완료",
                            description: created?.title ?? "새 설문이 생성되었습니다.",
                          });
                          loadData();
                        } catch (e: any) {
                          toast({
                            title: "복사 실패",
                            description: e.message,
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      복사
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const link = `${window.location.origin}/survey/${s.id}`;
                        navigator.clipboard.writeText(link);
                        toast({ title: "링크 복사", description: link });
                      }}
                    >
                      <Share2 className="w-4 h-4 mr-1" />
                      공유
                    </Button>

                    <Select
                      value={s.status ?? "draft"}
                      onValueChange={async (v) => {
                        try {
                          await SurveysRepository.updateStatus(
                            s.id,
                            v as "draft" | "active" | "public" | "completed"
                          );
                          toast({
                            title: "상태 변경",
                            description: `상태가 ${v}로 변경되었습니다.`,
                          });
                          loadData();
                        } catch (e: any) {
                          toast({
                            title: "상태 변경 실패",
                            description: e.message,
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="w-28 h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">초안</SelectItem>
                        <SelectItem value="active">진행중</SelectItem>
                        <SelectItem value="public">공개</SelectItem>
                        <SelectItem value="completed">완료</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={async () => {
                        if (!confirm("정말 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) return;
                        try {
                          await SurveysRepository.deleteSurvey(s.id);
                          toast({ title: "삭제 완료" });
                          loadData();
                        } catch (e: any) {
                          toast({
                            title: "삭제 실패",
                            description: e.message,
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      삭제
                    </Button>
                  </div>
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
            onClick={() =>
              setCurrentPage((p) => Math.min(totalPages, p + 1))
            }
          >
            다음
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
