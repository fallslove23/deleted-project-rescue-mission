import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface SurveyForm {
  title: string;
  description: string;
  education_year: number;
  education_round: number;
  course_name: string;
  // 새 필드
  is_combined: boolean;
  combined_round_start: number | null;
  combined_round_end: number | null;
  round_label: string; // 저장 시 자동 세팅되지만 미리보기를 위해 유지
  start_date: string;
  end_date: string;
  status: string;
}

interface SurveyInfoEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  surveyForm: SurveyForm;
  setSurveyForm: React.Dispatch<React.SetStateAction<SurveyForm>>;
  onSubmit: (e: React.FormEvent) => void;
  triggerButton?: React.ReactNode;
}

export const SurveyInfoEditDialog: React.FC<SurveyInfoEditDialogProps> = ({
  isOpen,
  onOpenChange,
  surveyForm,
  setSurveyForm,
  onSubmit,
  triggerButton,
}) => {
  const defaultTriggerButton = (
    <Button variant="outline" size="sm" className="flex-shrink-0">
      <Edit className="h-4 w-4 mr-2" />
      설문정보 수정
    </Button>
  );

  // 라벨 미리보기(메모)
  const computedLabel = useMemo(() => {
    const isCombined = surveyForm.is_combined && surveyForm.combined_round_start && surveyForm.combined_round_end;
    const roundPart = isCombined
      ? `${surveyForm.combined_round_start}∼${surveyForm.combined_round_end}`
      : surveyForm.education_round;
    return `${surveyForm.education_year}년 ${roundPart}차 - ${surveyForm.course_name || '과정'}`.trim();
  }, [surveyForm.is_combined, surveyForm.combined_round_start, surveyForm.combined_round_end, surveyForm.education_year, surveyForm.education_round, surveyForm.course_name]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{triggerButton || defaultTriggerButton}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>설문조사 정보 수정</DialogTitle>
          <DialogDescription>설문조사의 기본 정보를 수정할 수 있습니다.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="survey_title">설문 제목</Label>
            <Input
              id="survey_title"
              value={surveyForm.title}
              onChange={(e) => setSurveyForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="설문 제목을 입력하세요"
            />
            <p className="text-xs text-muted-foreground mt-1">저장 시 라벨/과목 정보로 자동 보정될 수 있습니다.</p>
          </div>

          <div>
            <Label htmlFor="survey_description">설문 설명</Label>
            <Textarea
              id="survey_description"
              value={surveyForm.description}
              onChange={(e) => setSurveyForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="설문 설명을 입력하세요"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="education_year">교육년도</Label>
              <Input
                id="education_year"
                type="number"
                value={surveyForm.education_year}
                onChange={(e) => setSurveyForm((p) => ({ ...p, education_year: parseInt(e.target.value || '0') }))}
                min={2020}
                max={2035}
              />
            </div>
            <div>
              <Label htmlFor="education_round">차수(기본)</Label>
              <Input
                id="education_round"
                type="number"
                value={surveyForm.education_round}
                onChange={(e) => setSurveyForm((p) => ({ ...p, education_round: parseInt(e.target.value || '1') }))}
                min={1}
                max={100}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="course_name">과정명</Label>
            <Input
              id="course_name"
              value={surveyForm.course_name}
              onChange={(e) => setSurveyForm((p) => ({ ...p, course_name: e.target.value }))}
              placeholder="예: BS Basic / BS Advanced …"
            />
          </div>

          {/* 합반 설정 */}
          <div className="border rounded-md p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="font-medium">합반(범위 차수) 사용</Label>
              <Switch
                checked={!!surveyForm.is_combined}
                onCheckedChange={(v) => setSurveyForm((p) => ({
                  ...p,
                  is_combined: v,
                  combined_round_start: v ? (p.combined_round_start ?? p.education_round) : null,
                  combined_round_end: v ? (p.combined_round_end ?? p.education_round) : null,
                }))}
              />
            </div>

            {surveyForm.is_combined && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="combined_round_start">시작 차수</Label>
                  <Input
                    id="combined_round_start"
                    type="number"
                    min={1}
                    value={surveyForm.combined_round_start ?? ''}
                    onChange={(e) =>
                      setSurveyForm((p) => ({ ...p, combined_round_start: parseInt(e.target.value || '0') }))
                    }
                    placeholder="예: 6"
                  />
                </div>
                <div>
                  <Label htmlFor="combined_round_end">종료 차수</Label>
                  <Input
                    id="combined_round_end"
                    type="number"
                    min={surveyForm.combined_round_start ?? 1}
                    value={surveyForm.combined_round_end ?? ''}
                    onChange={(e) =>
                      setSurveyForm((p) => ({ ...p, combined_round_end: parseInt(e.target.value || '0') }))
                    }
                    placeholder="예: 9"
                  />
                </div>
              </div>
            )}

            <div>
              <Label>라벨 미리보기</Label>
              <Input value={computedLabel} readOnly className="bg-muted" />
              <p className="text-xs text-muted-foreground mt-1">
                저장 시 <strong>round_label</strong> 컬럼으로 기록됩니다. (예: “2025년 7차 - BS Basic”, “2025년 6∼9차 - BS Advanced”)
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="survey_status">상태</Label>
            <Select value={surveyForm.status} onValueChange={(v) => setSurveyForm((p) => ({ ...p, status: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="상태 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">초안</SelectItem>
                <SelectItem value="active">진행중</SelectItem>
                <SelectItem value="completed">완료</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">시작일시</Label>
              <Input
                id="start_date"
                type="datetime-local"
                value={surveyForm.start_date}
                onChange={(e) => setSurveyForm((p) => ({ ...p, start_date: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="end_date">종료일시</Label>
              <Input
                id="end_date"
                type="datetime-local"
                value={surveyForm.end_date}
                onChange={(e) => setSurveyForm((p) => ({ ...p, end_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit">수정 완료</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};