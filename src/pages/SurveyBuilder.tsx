// src/pages/SurveyBuilder.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Pencil, Trash2, Plus, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CourseNamesRepo, CourseName } from "@/repositories/surveysRepo";

// ---------- helpers ----------
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * cross-browser safe: 'YYYY-MM-DDTHH:mm' -> Date (local)
 * 사파리 등 일부 브라우저는 new Date('YYYY-MM-DDTHH:mm') 파싱이 불안정할 수 있어 직접 파싱합니다.
 */
function parseLocalDateTime(s: string): Date | null {
  if (!s) return null;
  // expected: 2025-09-06T09:00
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!m) return null;
  const [_, yy, MM, dd, hh, mm, ss] = m;
  const y = Number(yy);
  const M = Number(MM) - 1;
  const d = Number(dd);
  const H = Number(hh);
  const mnt = Number(mm);
  const sec = ss ? Number(ss) : 0;
  const dt = new Date(y, M, d, H, mnt, sec, 0);
  if (isNaN(dt.getTime())) return null;
  return dt;
}

/** Date -> 'YYYY-MM-DDTHH:mm' (local) */
function formatLocalDateTime(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** 'YYYY-MM-DDTHH:mm' (브라우저 로컬 기준) */
function toLocalInputStr(d: Date) {
  return formatLocalDateTime(d);
}

/** 기본값: 작성 시점 기준 다음날 09:00/19:00 (로컬) */
function getDefaultStartEndLocal() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const start = new Date(next);
  start.setHours(9, 0, 0, 0);
  const end = new Date(next);
  end.setHours(19, 0, 0, 0);
  return { startLocal: toLocalInputStr(start), endLocal: toLocalInputStr(end) };
}

/** ISO -> 'YYYY-MM-DDTHH:mm' (로컬 인풋용) */
function toLocalDateTime(iso: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return toLocalInputStr(d);
  } catch {
    return "";
  }
}

/** 'YYYY-MM-DDTHH:mm' -> ISO (UTC) 안전 변환 */
function toSafeISOString(local: string | null) {
  if (!local) return null;
  try {
    const d = parseLocalDateTime(local);
    if (!d) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

function buildTitle(
  year: number | null,
  round: number | null,
  day: number | null,
  courseName: string | null
) {
  if (!year || !round || !day || !courseName) return "";
  return `${year}-${courseName}-${round}차-${day}일차 설문`;
}

// ---------- types ----------
type Survey = {
  id: string;
  title: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  education_year: number | null;
  education_round: number | null;
  education_day: number | null;
  course_name: string | null;
  expected_participants: number | null;
  is_test: boolean | null;
  status: "draft" | "active" | "public" | "completed" | null;
  created_at: string | null;
  updated_at: string | null;
};

export default function SurveyBuilder() {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [survey, setSurvey] = useState<Survey | null>(null);

  // ⬇️ 과목 필드 삭제, 4가지만 유지
  const [educationYear, setEducationYear] = useState<number>(
    new Date().getFullYear()
  );
  const [educationRound, setEducationRound] = useState<number>(1);
  const [educationDay, setEducationDay] = useState<number>(1);
  const [courseName, setCourseName] = useState<string>("");

  // 날짜/설명은 상태값과 바인딩
  const [startAt, setStartAt] = useState<string>("");
  const [endAt, setEndAt] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  // 과정명 관리
  const [courseNames, setCourseNames] = useState<CourseName[]>([]);
  const [courseMgrOpen, setCourseMgrOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [editRow, setEditRow] = useState<{ id: string; name: string } | null>(
    null
  );

  const title = useMemo(
    () => buildTitle(educationYear, educationRound, educationDay, courseName),
    [educationYear, educationRound, educationDay, courseName]
  );

  const loadCourseNames = async () => {
    try {
      const list = await CourseNamesRepo.list();
      setCourseNames(list);
    } catch (e: any) {
      toast({
        title: "과정명 목록 로드 실패",
        description: e.message ?? "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    }
  };

  const loadSurvey = async () => {
    if (!surveyId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("surveys")
        .select("*")
        .eq("id", surveyId)
        .single();
      if (error) throw error;

      const s = data as Survey;
      setSurvey(s);

      // 기본정보
      setEducationYear(s.education_year ?? new Date().getFullYear());
      setEducationRound(s.education_round ?? 1);
      setEducationDay(s.education_day ?? 1);
      setCourseName(s.course_name ?? "");

      // 시작/종료: 없으면 다음날 09:00/19:00 기본값
      const { startLocal, endLocal } = getDefaultStartEndLocal();
      const start = toLocalDateTime(s.start_date) || startLocal;
      const end = toLocalDateTime(s.end_date) || endLocal;
      setStartAt(start);
      setEndAt(end);

      setDescription(
        s.description ??
          "본 설문은 과목과 강사 만족도를 평가하기 위한 것입니다. 교육 품질 향상을 위해 모든 교육생께서 반드시 참여해 주시길 부탁드립니다."
      );
    } catch (e: any) {
      toast({
        title: "설문 로드 실패",
        description: e.message ?? "데이터를 불러오지 못했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const validateBasic = () => {
    if (!educationYear || !educationRound || !educationDay || !courseName) {
      toast({
        title: "필수값 누락",
        description: "교육연도, 차수, 일차, 과정명은 필수입니다.",
        variant: "destructive",
      });
      return false;
    }
    // 날짜 검증
    const start = startAt ? parseLocalDateTime(startAt) : null;
    const end = endAt ? parseLocalDateTime(endAt) : null;
    if (!start || !end) {
      toast({
        title: "날짜 형식 오류",
        description: "시작/종료일시가 올바르지 않습니다.",
        variant: "destructive",
      });
      return false;
    }
    if (start.getTime() >= end.getTime()) {
      toast({
        title: "기간 오류",
        description: "종료일시는 시작일시보다 뒤여야 합니다.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const saveBasic = async () => {
    if (!surveyId) return;
    try {
      // 값 검증
      if (!validateBasic()) return;

      setSaving(true);

      // 저장 시 비어있으면 기본값을 적용해 저장 (실수 방지)
      const { startLocal, endLocal } = getDefaultStartEndLocal();
      const startISO = toSafeISOString(startAt || startLocal);
      const endISO = toSafeISOString(endAt || endLocal);

      const payload = {
        education_year: educationYear,
        education_round: educationRound,
        education_day: educationDay,
        course_name: courseName,
        title,
        start_date: startISO,
        end_date: endISO,
        description,
      };

      const { error } = await supabase
        .from("surveys")
        .update(payload)
        .eq("id", surveyId);

      if (error) throw error;

      toast({ title: "기본 정보 저장", description: "저장되었습니다." });
      await loadSurvey();
    } catch (e: any) {
      toast({
        title: "저장 실패",
        description: e.message ?? "다시 시도해 주세요.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // 과정명 관리 액션
  const handleCreateCourseName = async () => {
    const name = newCourseName.trim();
    if (!name) return;
    try {
      // 중복 방지
      if (courseNames.some((c) => c.name === name)) {
        toast({
          title: "중복된 과정명",
          description: `"${name}"은(는) 이미 존재합니다.`,
          variant: "destructive",
        });
        return;
      }
      await CourseNamesRepo.create(name);
      setNewCourseName("");
      await loadCourseNames();
      toast({ title: "과정명 추가", description: `"${name}" 추가됨` });
    } catch (e: any) {
      toast({ title: "추가 실패", description: e.message, variant: "destructive" });
    }
  };

  const handleRenameCourseName = async () => {
    if (!editRow) return;
    const newName = editRow.name.trim();
    if (!newName) return;
    try {
      const old = courseNames.find((c) => c.id === editRow.id)?.name || "";
      if (!old) return;
      if (old === newName) {
        setEditRow(null);
        return;
      }
      // 중복 방지
      if (courseNames.some((c) => c.name === newName)) {
        toast({
          title: "중복된 과정명",
          description: `"${newName}"은(는) 이미 존재합니다.`,
          variant: "destructive",
        });
        return;
      }
      await CourseNamesRepo.rename(editRow.id, old, newName);
      setEditRow(null);
      await loadCourseNames();
      if (courseName === old) setCourseName(newName); // 폼 동기화
      toast({ title: "과정명 변경", description: `"${old}" → "${newName}"` });
    } catch (e: any) {
      toast({ title: "변경 실패", description: e.message, variant: "destructive" });
    }
  };

  const handleDeleteCourseName = async (id: string) => {
    const target = courseNames.find((c) => c.id === id);
    if (!target) return;
    if (
      !confirm(
        `"${target.name}" 과정을 목록에서 삭제할까요? (기존 설문에는 영향 없습니다)`
      )
    )
      return;
    try {
      await CourseNamesRepo.remove(id);
      await loadCourseNames();
      // 현재 폼의 과정명이 삭제된 경우 초기화
      if (courseName === target.name) {
        setCourseName("");
      }
      toast({ title: "삭제 완료", description: `"${target.name}" 삭제됨` });
    } catch (e: any) {
      toast({ title: "삭제 실패", description: e.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    loadSurvey();
    loadCourseNames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  if (loading || !survey) {
    return (
      <div className="container mx-auto p-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          뒤로
        </Button>
        <div className="mt-6">로딩 중...</div>
      </div>
    );
  }

  const years = useMemo(() => {
    // 올해+1부터 과거 5년까지 총 6개
    return Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + 1 - i);
  }, []);

  // 숫자 입력 핸들러(빈 값/NaN 방지)
  const handleRoundChange = (v: string) => {
    const n = parseInt(v, 10);
    setEducationRound(Number.isFinite(n) && n > 0 ? n : 1);
  };
  const handleDayChange = (v: string) => {
    const n = parseInt(v, 10);
    setEducationDay(Number.isFinite(n) && n > 0 ? n : 1);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          뒤로
        </Button>
        <div className="text-xl font-semibold">설문 편집</div>
        <div />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 과정명 + 관리 */}
            <div className="space-y-2">
              <Label>과정명</Label>
              <div className="flex gap-2">
                <Select
                  value={courseName || ""}
                  onValueChange={(v) => setCourseName(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="과정명을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {courseNames.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => setCourseMgrOpen(true)}>
                  <Settings className="w-4 h-4 mr-1" />
                  관리
                </Button>
              </div>
            </div>

            {/* 교육 연도 */}
            <div className="space-y-2">
              <Label>교육 연도</Label>
              <Select
                value={String(educationYear)}
                onValueChange={(v) => setEducationYear(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="연도 선택" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 차수 */}
            <div className="space-y-2">
              <Label>차수</Label>
              <Input
                inputMode="numeric"
                type="number"
                min={1}
                value={educationRound}
                onChange={(e) => handleRoundChange(e.target.value)}
              />
            </div>

            {/* 일차 */}
            <div className="space-y-2">
              <Label>일차</Label>
              <Input
                inputMode="numeric"
                type="number"
                min={1}
                value={educationDay}
                onChange={(e) => handleDayChange(e.target.value)}
              />
            </div>

            {/* 자동 제목 */}
            <div className="space-y-2 md:col-span-2">
              <Label>제목 (자동)</Label>
              <Input value={title} readOnly />
            </div>

            {/* 시작/종료일시 (상태값과 바인딩) */}
            <div className="space-y-2">
              <Label>시작일시</Label>
              <Input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>종료일시</Label>
              <Input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>

            {/* 설명 */}
            <div className="space-y-2 md:col-span-2">
              <Label>설명</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveBasic} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              기본 정보 저장
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 과정명 관리 다이얼로그 */}
      <Dialog open={courseMgrOpen} onOpenChange={setCourseMgrOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>과정명 관리</DialogTitle>
            <DialogDescription>
              과정명은 설문 제목 자동생성과 목록 필터에 사용됩니다. 이름 변경 시 기존 설문들의 과정명도 함께 업데이트됩니다.
            </DialogDescription>
          </DialogHeader>

          {/* 추가 */}
          <div className="flex gap-2">
            <Input
              placeholder="새 과정명 입력"
              value={newCourseName}
              onChange={(e) => setNewCourseName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateCourseName()}
            />
            <Button onClick={handleCreateCourseName}>
              <Plus className="w-4 h-4 mr-1" />
              추가
            </Button>
          </div>

          <Separator className="my-3" />

          {/* 목록 */}
          <div className="space-y-2 max-h-80 overflow-auto">
            {courseNames.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                등록된 과정명이 없습니다.
              </div>
            ) : (
              courseNames.map((c) => {
                const isEditing = editRow?.id === c.id;
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 border rounded-md p-2"
                  >
                    {isEditing ? (
                      <Input
                        value={editRow!.name}
                        onChange={(e) =>
                          setEditRow({ ...editRow!, name: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameCourseName();
                          if (e.key === "Escape") setEditRow(null);
                        }}
                      />
                    ) : (
                      <div className="font-medium">{c.name}</div>
                    )}

                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <Button size="sm" onClick={handleRenameCourseName}>
                            변경
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditRow(null)}
                          >
                            취소
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setEditRow({ id: c.id, name: c.name })
                            }
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            이름변경
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteCourseName(c.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            삭제
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCourseMgrOpen(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
