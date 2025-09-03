import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

type SurveyEditable = {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  education_year: number;
  education_round: number;
  education_day: number | null;
  course_id: string | null;
  course_name: string | null; // "BS Basic" | "BS Advanced"

  is_combined: boolean | null;
  combined_round_start: number | null;
  combined_round_end: number | null;
  round_label: string | null;
};

type Course = { id: string; title: string };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  survey: SurveyEditable | null;
  courses: Course[];
  onSaved?: () => void;
}

export default function SurveyInfoEditDialog({ open, onOpenChange, survey, courses, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);

  const [form, setForm] = React.useState<Partial<SurveyEditable>>({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    education_year: new Date().getFullYear(),
    education_round: 1,
    education_day: 1,
    course_id: "",
    course_name: "",
    is_combined: false,
    combined_round_start: null,
    combined_round_end: null,
    round_label: "",
  });

  React.useEffect(() => {
    if (!survey) return;
    setForm({
      ...survey,
      start_date: survey.start_date ? new Date(survey.start_date).toISOString().slice(0, 16) : "",
      end_date: survey.end_date ? new Date(survey.end_date).toISOString().slice(0, 16) : "",
    });
  }, [survey]);

  // 제목 자동 생성
  const courseTitle = React.useMemo(
    () => courses.find((c) => c.id === form.course_id)?.title ?? "",
    [courses, form.course_id]
  );

  React.useEffect(() => {
    const yy = String(form.education_year ?? "").slice(-2);
    const r = form.education_round ?? 1;
    const d = form.education_day ?? 1;
    const prog = form.course_name || "";
    if (yy && r && d && prog && courseTitle) {
      const prefix = `(${yy}-${r}차 ${prog} ${d}일차)`;
      setForm((prev) => ({ ...prev, title: `${prefix} ${courseTitle}` }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.education_year, form.education_round, form.education_day, form.course_name, form.course_id, courseTitle]);

  // 합반 라벨 자동
  React.useEffect(() => {
    if (form.course_name !== "BS Advanced" || !form.is_combined) return;
    const year = form.education_year;
    const s = form.combined_round_start;
    const e = form.combined_round_end;
    if (year && s && e && s > 0 && e >= s) {
      const auto = `${year}년 ${s}∼${e}차 - BS Advanced`;
      setForm((prev) => ({ ...prev, round_label: prev.round_label?.trim() ? prev.round_label : auto }));
    }
  }, [form.course_name, form.is_combined, form.education_year, form.combined_round_start, form.combined_round_end]);

  const onChange = <K extends keyof SurveyEditable>(k: K, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!survey) return;
    setSaving(true);
    try {
      if (form.course_name === "BS Advanced" && form.is_combined) {
        if (!form.combined_round_start || !form.combined_round_end) {
          throw new Error("합반 시작/종료 차수를 입력하세요.");
        }
        if (Number(form.combined_round_start) > Number(form.combined_round_end)) {
          throw new Error("합반 차수의 시작은 종료보다 클 수 없습니다.");
        }
      }

      let round_label = (form.round_label ?? "").trim();
      if (form.course_name === "BS Advanced" && form.is_combined && !round_label) {
        round_label = `${form.education_year}년 ${form.combined_round_start}∼${form.combined_round_end}차 - BS Advanced`;
      }

      const payload = {
        title: form.title,
        description: form.description ?? "",
        start_date: form.start_date ? new Date(String(form.start_date) + ":00+09:00").toISOString() : null,
        end_date: form.end_date ? new Date(String(form.end_date) + ":00+09:00").toISOString() : null,
        education_year: Number(form.education_year),
        education_round: Number(form.education_round),
        education_day: Number(form.education_day) || 1,
        course_id: form.course_id || null,
        course_name: form.course_name || null,

        is_combined: !!form.is_combined,
        combined_round_start: form.is_combined ? Number(form.combined_round_start) : null,
        combined_round_end: form.is_combined ? Number(form.combined_round_end) : null,
        round_label: form.is_combined ? round_label : null,
      };

      const { error } = await supabase.from("surveys").update(payload).eq("id", survey.id);
      if (error) throw error;

      toast({ title: "수정 완료", description: "설문 정보가 업데이트되었습니다." });
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast({ title: "저장 실패", description: e.message || "정보 저장 중 오류", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>설문 정보 수정</DialogTitle></DialogHeader>

        {!survey ? (
          <div className="p-4 text-sm text-muted-foreground">설문을 선택하세요.</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>과목</Label>
                <Select value={String(form.course_id || "")} onValueChange={(v) => onChange("course_id", v)}>
                  <SelectTrigger><SelectValue placeholder="과목 선택" /></SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>과정 (프로그램)</Label>
                <Select value={String(form.course_name || "")} onValueChange={(v) => onChange("course_name", v)}>
                  <SelectTrigger><SelectValue placeholder="과정 선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BS Basic">BS Basic</SelectItem>
                    <SelectItem value="BS Advanced">BS Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>교육 연도</Label>
                <Input type="number" value={form.education_year ?? ""} onChange={(e) => onChange("education_year", Number(e.target.value))} />
              </div>
              <div>
                <Label>차수</Label>
                <Input type="number" value={form.education_round ?? 1} onChange={(e) => onChange("education_round", Number(e.target.value))} />
              </div>
              <div>
                <Label>일차</Label>
                <Input type="number" value={form.education_day ?? 1} onChange={(e) => onChange("education_day", Number(e.target.value))} />
              </div>
              <div>
                <Label>제목 (자동)</Label>
                <Input value={form.title ?? ""} readOnly />
              </div>
            </div>

            {/* ✅ 합반 입력 (BS Advanced 전용) */}
            {form.course_name === "BS Advanced" && (
              <div className="space-y-3 border rounded-md p-3">
                <div className="flex items-center gap-2">
                  <input
                    id="is_combined_edit"
                    type="checkbox"
                    className="h-4 w-4"
                    checked={!!form.is_combined}
                    onChange={(e) => onChange("is_combined", e.target.checked)}
                  />
                  <Label htmlFor="is_combined_edit">합반(여러 차수를 묶어 동일 설문으로 운영)</Label>
                </div>

                {form.is_combined && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>시작 차수</Label>
                      <Input
                        type="number"
                        min={1}
                        value={form.combined_round_start ?? ""}
                        onChange={(e) => onChange("combined_round_start", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label>종료 차수</Label>
                      <Input
                        type="number"
                        min={form.combined_round_start ?? 1}
                        value={form.combined_round_end ?? ""}
                        onChange={(e) => onChange("combined_round_end", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label>합반 라벨(선택)</Label>
                      <Input
                        placeholder="미입력 시 자동 생성"
                        value={form.round_label ?? ""}
                        onChange={(e) => onChange("round_label", e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>시작일시</Label>
                <Input type="datetime-local" value={String(form.start_date || "")} onChange={(e) => onChange("start_date", e.target.value)} />
              </div>
              <div>
                <Label>종료일시</Label>
                <Input type="datetime-local" value={String(form.end_date || "")} onChange={(e) => onChange("end_date", e.target.value)} />
              </div>
            </div>

            <div>
              <Label>설명</Label>
              <Textarea value={form.description ?? ""} onChange={(e) => onChange("description", e.target.value)} rows={3} />
            </div>

            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "저장 중…" : "수정 완료"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}