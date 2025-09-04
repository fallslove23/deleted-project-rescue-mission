import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "lucide-react";

type InitialValues = Partial<{
  education_year: number;
  education_round: number;
  education_day: number;
  course_name: string;                // 'BS Basic' | 'BS Advanced'
  expected_participants: number;
  start_date: string;                 // datetime-local
  end_date: string;                   // datetime-local
  is_combined: boolean;
  combined_round_start: number | null;
  combined_round_end: number | null;
  // 과목/강사 선택 (첫 번째 선택만 사용)
  course_id: string | null;
  instructor_id: string | null;
  description: string;
}>;

type Course = { id: string; title: string };
type Instructor = { id: string; name: string };

interface Props {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  /** 편집 모드일 때 초기값 주입 */
  initial?: InitialValues;
}

export default function SurveyCreateForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
  initial,
}: Props) {
  // --- 기본 상태 ------------------------------------------
  const thisYear = new Date().getFullYear();
  const [educationYear, setEducationYear] = React.useState<number>(initial?.education_year ?? thisYear);
  const [courseName, setCourseName] = React.useState<string>(initial?.course_name ?? "");
  const [round, setRound] = React.useState<number>(initial?.education_round ?? 1);
  const [day, setDay] = React.useState<number>(initial?.education_day ?? 1);
  const [participants, setParticipants] = React.useState<number>(initial?.expected_participants ?? 0);
  const [startAt, setStartAt] = React.useState<string>(initial?.start_date ?? "");
  const [endAt, setEndAt] = React.useState<string>(initial?.end_date ?? "");
  const [isCombined, setIsCombined] = React.useState<boolean>(initial?.is_combined ?? false);
  const [combinedStart, setCombinedStart] = React.useState<number | null>(initial?.combined_round_start ?? null);
  const [combinedEnd, setCombinedEnd] = React.useState<number | null>(initial?.combined_round_end ?? null);

  // 과목/강사 선택(간단화: 1개만)
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [instructors, setInstructors] = React.useState<Instructor[]>([]);
  const [selectedCourseId, setSelectedCourseId] = React.useState<string>(initial?.course_id ?? "");
  const [selectedInstructorId, setSelectedInstructorId] = React.useState<string>(initial?.instructor_id ?? "");

  // 제목 프리뷰
  const titlePreview = React.useMemo(() => {
    if (!selectedCourseId) return "제목 미리보기";
    const yy = educationYear.toString().slice(-2);
    const selectedCourse = courses.find(c => c.id === selectedCourseId)?.title ?? "";
    const program = courseName?.includes("-") ? courseName.split("-")[1]?.trim() : courseName;
    const prefix = program
      ? `(${yy}-${round}차 ${program} ${day}일차)`
      : `(${yy}-${round}차 ${day}일차)`;
    return `${prefix} ${selectedCourse}`;
  }, [courses, selectedCourseId, courseName, educationYear, round, day]);

  // --- 데이터 로딩 -----------------------------------------
  React.useEffect(() => {
    // 과목(=courses 테이블) 로드
    (async () => {
      const { data, error } = await supabase.from("courses").select("*").order("title");
      if (!error) setCourses(data ?? []);
    })();
  }, []);

  React.useEffect(() => {
    // 선택한 과목에 연결된 강사만 보여주기
    if (!selectedCourseId) {
      setInstructors([]);
      setSelectedInstructorId("");
      return;
    }
    (async () => {
      // instructor_courses에서 매핑 → instructors
      const { data: mapRows } = await supabase
        .from("instructor_courses")
        .select("instructor_id")
        .eq("course_id", selectedCourseId);

      const ids = (mapRows ?? []).map(r => r.instructor_id);
      if (ids.length === 0) {
        setInstructors([]);
        setSelectedInstructorId("");
        return;
      }
      const { data: instRows } = await supabase
        .from("instructors")
        .select("id, name")
        .in("id", ids)
        .order("name");
      setInstructors(instRows ?? []);
      // 편집 초기화 값 있을 때 유지
      if (initial?.instructor_id && ids.includes(initial.instructor_id)) {
        setSelectedInstructorId(initial.instructor_id);
      } else {
        setSelectedInstructorId("");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId]);

  // --- 제출 -----------------------------------------------
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSubmit({
      education_year: educationYear,
      education_round: round,
      education_day: day,
      course_name: courseName || null,              // 프로그램(과정): BS Basic / BS Advanced
      expected_participants: participants || 0,
      start_date: startAt,
      end_date: endAt,
      is_combined: courseName === "BS Advanced" ? isCombined : false,
      combined_round_start: courseName === "BS Advanced" && isCombined ? combinedStart : null,
      combined_round_end: courseName === "BS Advanced" && isCombined ? combinedEnd : null,
      // 제목/코스/강사
      course_selections: selectedCourseId
        ? [{ courseId: selectedCourseId, instructorId: selectedInstructorId || null }]
        : [],
      // description은 별도 다이얼로그에서 입력/수정하므로 생략
      _title_preview: titlePreview, // 참고용
    });
  };

  // --- UI (컴팩트 레이아웃) -------------------------------
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 상단 요약 카드 */}
      <Card className="border-dashed">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-sm text-muted-foreground">제목(자동 생성 · 프리뷰)</div>
            <div className="text-sm sm:text-base font-medium truncate">{titlePreview}</div>
          </div>
        </CardContent>
      </Card>

      {/* 1행: 연도 / 과정(프로그램) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">교육 연도</Label>
          <Input
            type="number"
            min={2020}
            max={2035}
            value={educationYear}
            onChange={(e) => setEducationYear(parseInt(e.target.value || "0", 10))}
            className="h-9"
          />
        </div>

        <div>
          <Label className="text-xs">과정(프로그램)</Label>
          <Select
            value={courseName || ""}
            onValueChange={(v) => setCourseName(v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="과정 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BS Basic">BS Basic</SelectItem>
              <SelectItem value="BS Advanced">BS Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 2행: 차수 / 일차 / 예상 인원 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">차수</Label>
          <Input
            type="number"
            min={1}
            value={round}
            onChange={(e) => setRound(parseInt(e.target.value || "1", 10))}
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-xs">일차</Label>
          <Input
            type="number"
            min={1}
            value={day}
            onChange={(e) => setDay(parseInt(e.target.value || "1", 10))}
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-xs">예상 설문 인원</Label>
          <Input
            type="number"
            min={0}
            value={participants}
            onChange={(e) => setParticipants(parseInt(e.target.value || "0", 10))}
            className="h-9"
            placeholder="0"
          />
        </div>
      </div>

      {/* 3행: 과목/강사 (간단 모드 1세트) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">과목</Label>
          <Select
            value={selectedCourseId || ""}
            onValueChange={(v) => setSelectedCourseId(v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="과목 선택" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">강사</Label>
          <Select
            value={selectedInstructorId || ""}
            onValueChange={(v) => setSelectedInstructorId(v)}
            disabled={!selectedCourseId || instructors.length === 0}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={selectedCourseId ? "강사 선택" : "먼저 과목을 선택하세요"} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {instructors.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">선택 가능한 강사가 없습니다</div>
              ) : (
                instructors.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 4행: BS Advanced → 합반 옵션 (인라인, 콤팩트) */}
      {courseName === "BS Advanced" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="flex items-center justify-between sm:justify-start gap-3 border rounded-md px-3 py-2">
            <div className="text-sm">합반 여부</div>
            <Switch checked={isCombined} onCheckedChange={setIsCombined} />
          </div>

          <div>
            <Label className="text-xs">합반 시작 차수</Label>
            <Input
              type="number"
              min={1}
              value={combinedStart ?? ""}
              disabled={!isCombined}
              onChange={(e) => setCombinedStart(e.target.value === "" ? null : parseInt(e.target.value, 10))}
              className="h-9"
              placeholder="예: 5"
            />
          </div>
          <div>
            <Label className="text-xs">합반 종료 차수</Label>
            <Input
              type="number"
              min={1}
              value={combinedEnd ?? ""}
              disabled={!isCombined}
              onChange={(e) => setCombinedEnd(e.target.value === "" ? null : parseInt(e.target.value, 10))}
              className="h-9"
              placeholder="예: 7"
            />
          </div>
        </div>
      )}

      {/* 5행: 시작/종료 일시 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs flex items-center gap-1">
            <Calendar className="h-3 w-3" /> 시작일시
          </Label>
          <Input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-xs flex items-center gap-1">
            <Calendar className="h-3 w-3" /> 종료일시
          </Label>
          <Input
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      {/* 액션 */}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} className="h-9">
          취소
        </Button>
        <Button type="submit" disabled={isSubmitting} className="h-9">
          {isSubmitting ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  );
}