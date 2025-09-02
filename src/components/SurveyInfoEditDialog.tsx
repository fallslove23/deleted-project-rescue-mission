import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit } from 'lucide-react';

interface SurveyForm {
  title: string;
  description: string;
  education_year: number;
  education_round: number;
  course_name: string;
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
  triggerButton
}) => {
  const defaultTriggerButton = (
    <Button variant="outline" size="sm" className="flex-shrink-0">
      <Edit className="h-4 w-4 mr-2" />
      설문정보 수정
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {triggerButton || defaultTriggerButton}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>설문조사 정보 수정</DialogTitle>
          <DialogDescription>
            설문조사의 기본 정보를 수정할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="survey_title">설문 제목</Label>
            <Input
              id="survey_title"
              value={surveyForm.title}
              onChange={(e) => setSurveyForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="설문 제목을 입력하세요"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="survey_description">설문 설명</Label>
            <Textarea
              id="survey_description"
              value={surveyForm.description}
              onChange={(e) => setSurveyForm(prev => ({ ...prev, description: e.target.value }))}
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
                onChange={(e) => setSurveyForm(prev => ({ ...prev, education_year: parseInt(e.target.value) }))}
                min="2020"
                max="2030"
              />
            </div>
            <div>
              <Label htmlFor="education_round">차수</Label>
              <Input
                id="education_round"
                type="number"
                value={surveyForm.education_round}
                onChange={(e) => setSurveyForm(prev => ({ ...prev, education_round: parseInt(e.target.value) }))}
                min="1"
                max="10"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="course_name">과정명</Label>
            <Input
              id="course_name"
              value={surveyForm.course_name}
              onChange={(e) => setSurveyForm(prev => ({ ...prev, course_name: e.target.value }))}
              placeholder="예: BS SW 업무 과정"
            />
          </div>

          <div>
            <Label htmlFor="survey_status">상태</Label>
            <Select 
              value={surveyForm.status} 
              onValueChange={(value) => setSurveyForm(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
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
                onChange={(e) => setSurveyForm(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="end_date">종료일시</Label>
              <Input
                id="end_date"
                type="datetime-local"
                value={surveyForm.end_date}
                onChange={(e) => setSurveyForm(prev => ({ ...prev, end_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit">
              수정 완료
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};