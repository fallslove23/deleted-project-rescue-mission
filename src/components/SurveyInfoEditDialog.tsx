import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";

type Course = { id: string; title: string };
type Instructor = { id: string; name: string };
type InstructorCourse = { instructor_id: string; course_id: string };

type CourseSelection = { courseId: string; instructorId: string };

type Props = {
  /** 저장 버튼 클릭 시 상위에서 처리 */
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  /** 다이얼로그 래퍼에서 필요시 전달 */
  initial?: Partial<{
    education_year: number;
    education_round: number;
    education_day: number;
    course_name: string;
    description: string;
    start_date: string;
    end_date: string;
    expected_participants: number;
    is_combined: boolean;
    combined_round_start: number | null;
    combined_round_end: number | null;
    course_selections: CourseSelection[];
  }>;
};

/** 간결한 레이블/필드 수직 스택 */
const Field = ({ label, children }: React.PropsWithChildren<{ label: string }>) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    {children}
  </div>
);

export default function SurveyCreateForm({ onSubmit, onCancel, isSubmitting, initial }: Props) {
  // 기본값
  const [education_year, setEducationYear] = useState(initial?.education_year ?? new Date().getFullYear());
  const [education_round, setEducationRound] = useState(initial?.education_round ?? 1);
  const [education_day, setEducationDay] = useState(initial?.education_day ?? 1);
  const [course_name, setCourseName] = useState(initial?.course_name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [start_date, setStartDate] = useState(initial?.start_date ?? "");
  const [end_date, setEndDate] = useState(initial?.end_date ?? "");
  const [expected_participants, setExpectedParticipants] = useState<number | "">(
    initial?.expected_participants ?? ""
  );

  // 합반 필드
  const [is_combined, setIsCombined] = useState(!!initial?.is_combined);
  const [combined_round_start, setCombinedStart] = useState<number | "">(initial?.combined_round_start ?? "");
  const [combined_round_end, setCombinedEnd] = useState<number | "">(initial?.combined_round_end ?? "");

  // 과목/강사
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [instructorCourses, setInstructorCourses] = useState<InstructorCourse[]>([]);
  const [courseSelections, setCourseSelections] = useState<CourseSelection[]>(
    initial?.course_selections && initial.course_selections.length > 0
      ? initial.course_selections
      : [{ courseId: "", instructorId: "" }]
  );

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: i }, { data: ic }] = await Promise.all([
        supabase.from("courses").select("*").order("title"),
        supabase.from("instructors").select("*").order("name"),
        supabase.from("instructor_courses").select("instructor_id, course_id"),
      ]);
      setCourses(c || []);
      setInstructors(i || []);
      setInstructorCourses(ic || []);
    })();
  }, []);

  // 선택한 과목에 맞춰 강사 옵션 필터
  const getInstructorsForCourse = (courseId: string) => {
    if (!courseId) return [];
    const allowed = new Set(
      instructorCourses.filter((x) => x.course_id === courseId).map((x) => x.instructor_id)
    );
    return instructors.filter((i) => allowed.has(i.id));
  };

  // 미리보기용 자동 제목
  const titlePreview = useMemo(() => {
    const yy = String(education_year).slice(-2);
    const program = course_name?.includes("-") ? course_name.split("-")[1]?.trim() : course_name?.trim();
    const mainCourseTitle = courses.find((c) => c.id === courseSelections[0]?.courseId)?.title || "";
    const prefix = program
      ? `(${yy}-${education_round}차 ${program} ${education_day}일차)`
      : `(${yy}-${education_round}차 ${education_day}일차)`;
    return mainCourseTitle ? `${prefix} ${mainCourseTitle}` : prefix;
  }, [education_year, education_round, education_day, course_name, courseSelections, courses]);

  const showCombined = (course_name || "").toLowerCase().includes("advanced");

  const addCourseRow = () => setCourseSelections((prev) => [...prev, { courseId: "", instructorId: "" }]);
  const removeCourseRow = (idx: number) =>
    setCourseSelections((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));

  const updateCourseRow = (idx: number, patch: Partial<CourseSelection>) =>
    setCourseSelections((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      education_year,
      education_round,
      education_day,
      course_name,
      description,
      start_date,
      end_date,
      expected_participants: expected_participants === "" ? 0 : Number(expected_participants),
      is_combined: showCombined ? is_combined : false,
      combined_round_start: showCombined && is_combined ? Number(combined_round_start) || null : null,
      combined_round_end: showCombined && is_combined ? Number(combined_round_end) || null : null,
      course_selections: courseSelections,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 상단 요약 바 */}
      <Card>
        <CardContent className="p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-sm">
            <div className="text-muted-foreground">자동 생성 제목 미리보기</div>
            <div className="font-medium truncate">{titlePreview}</div>
          </div>
          <div className="text-xs text-muted-foreground">
            필수 항목을 간결하게 배치했어요. 모바일에선 1열, 데스크탑에선 2열로 정렬됩니다.
          </div>
        </CardContent>
      </Card>

      {/* 기본 정보 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="교육 연도">
          <Input
            inputMode="numeric"
            type="number"
            value={education_year}
            onChange={(e) => setEducationYear(parseInt(e.target.value || "0", 10))}
            className="h-9"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="차수">
            <Input
              inputMode="numeric"
              type="number"
              min={1}
              value={education_round}
              onChange={(e) => setEducationRound(parseInt(e.target.value || "1", 10))}
              className="h-9"
            />
          </Field>
          <Field label="일차 (예: 1일차)">
            <Input
              inputMode="numeric"
              type="number"
              min={1}
              value={education_day}
              onChange={(e) => setEducationDay(parseInt(e.target.value || "1", 10))}
              className="h-9"
            />
          </Field>
        </div>

        <Field label="과정 (프로그램)">
          <Select value={course_name} onValueChange={setCourseName}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="과정 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BS Basic">BS Basic</SelectItem>
              <SelectItem value="BS Advanced">BS Advanced</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="예상 설문 인원">
          <Input
            inputMode="numeric"
            type="number"
            min={1}
            value={expected_participants}
            onChange={(e) => setExpectedParticipants(e.target.value === "" ? "" : Number(e.target.value))}
            onFocus={(e) => (e.target as HTMLInputElement).select()}
            placeholder="예: 30"
            className="h-9"
          />
        </Field>
      </div>

      {/* 일정 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="시작일시">
          <Input type="datetime-local" value={start_date} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
        </Field>
        <Field label="종료일시">
          <Input type="datetime-local" value={end_date} onChange={(e) => setEndDate(e.target.value)} className="h-9" />
        </Field>
      </div>

      {/* 과목/강사 선택 - 콤팩트 반복영역 */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">과목/강사 선택</div>
            <Button type="button" variant="outline" size="sm" onClick={addCourseRow}>
              <Plus className="h-4 w-4 mr-1" />
              과목 추가
            </Button>
          </div>

          {courseSelections.map((row, idx) => {
            const course = courses.find((c) => c.id === row.courseId);
            const teacherOptions = getInstructorsForCourse(row.courseId);
            return (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label={`과목 ${idx + 1}`}>
                  <Select
                    value={row.courseId}
                    onValueChange={(v) => updateCourseRow(idx, { courseId: v, instructorId: "" })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="과목 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                  <Field label="강사">
                    <Select
                      value={row.instructorId}
                      onValueChange={(v) => updateCourseRow(idx, { instructorId: v })}
                      disabled={!row.courseId}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={row.courseId ? "강사 선택" : "먼저 과목 선택"} />
                      </SelectTrigger>
                      <SelectContent>
                        {teacherOptions.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">연결된 강사 없음</div>
                        ) : (
                          teacherOptions.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => removeCourseRow(idx)}
                    disabled={courseSelections.length === 1}
                    aria-label="과목행 삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 합반 옵션 (BS Advanced에서만 표시) */}
      {showCombined && (
        <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-[auto_1fr_1fr] items-center gap-4">
            <div className="flex items-center gap-3">
              <Switch checked={is_combined} onCheckedChange={setIsCombined} />
              <span className="text-sm">합반 설정</span>
            </div>
            <Field label="합반 시작 차수">
              <Input
                type="number"
                min={1}
                disabled={!is_combined}
                value={combined_round_start}
                onChange={(e) => setCombinedStart(e.target.value === "" ? "" : Number(e.target.value))}
                className="h-9"
              />
            </Field>
            <Field label="합반 종료 차수">
              <Input
                type="number"
                min={1}
                disabled={!is_combined}
                value={combined_round_end}
                onChange={(e) => setCombinedEnd(e.target.value === "" ? "" : Number(e.target.value))}
                className="h-9"
              />
            </Field>
          </CardContent>
        </Card>
      )}

      {/* 설명 */}
      <Field label="설명 (선택)">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="resize-y"
          placeholder="교육생 안내 문구 등"
        />
      </Field>

      {/* 액션 */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  );
}