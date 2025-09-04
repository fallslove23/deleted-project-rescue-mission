import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { X, Plus } from "lucide-react";

type SurveyQuestion = {
  id: string;
  question_text: string;
  question_type: string;
  options: any;
  is_required: boolean;
  order_index: number;
  section_id?: string | null;
  session_id?: string | null;
  scope: 'session' | 'operation';
  satisfaction_type?: string | null;
};

interface QuestionEditFormProps {
  question?: SurveyQuestion | null;
  surveyId: string;
  onSave: () => void;
  onCancel: () => void;
}

export default function QuestionEditForm({ question, surveyId, onSave, onCancel }: QuestionEditFormProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    question_text: "",
    question_type: "multiple_choice",
    is_required: true,
    scope: "session" as 'session' | 'operation',
    satisfaction_type: "",
    options: [] as string[]
  });

  useEffect(() => {
    if (question) {
      setForm({
        question_text: question.question_text || "",
        question_type: question.question_type || "multiple_choice",
        is_required: question.is_required ?? true,
        scope: question.scope || "session",
        satisfaction_type: question.satisfaction_type || "",
        options: Array.isArray(question.options) ? question.options : 
                 question.options?.options ? question.options.options : []
      });
    } else {
      setForm({
        question_text: "",
        question_type: "multiple_choice",
        is_required: true,
        scope: "session",
        satisfaction_type: "",
        options: []
      });
    }
  }, [question]);

  const handleSave = async () => {
    if (!form.question_text.trim()) {
      toast({ title: "오류", description: "질문 내용을 입력해주세요.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const questionData = {
        survey_id: surveyId,
        question_text: form.question_text,
        question_type: form.question_type,
        is_required: form.is_required,
        scope: form.scope,
        satisfaction_type: form.satisfaction_type || null,
        options: form.options.length > 0 ? { options: form.options } : null,
        order_index: question?.order_index ?? 0
      };

      if (question?.id) {
        const { error } = await supabase
          .from('survey_questions')
          .update(questionData)
          .eq('id', question.id);
        
        if (error) throw error;
        toast({ title: "성공", description: "질문이 수정되었습니다." });
      } else {
        const { error } = await supabase
          .from('survey_questions')
          .insert(questionData);
        
        if (error) throw error;
        toast({ title: "성공", description: "질문이 추가되었습니다." });
      }

      onSave();
    } catch (error: any) {
      console.error(error);
      toast({ title: "오류", description: error.message || "질문 저장 중 오류가 발생했습니다.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addOption = () => {
    setForm(prev => ({ ...prev, options: [...prev.options, ""] }));
  };

  const updateOption = (index: number, value: string) => {
    setForm(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? value : opt)
    }));
  };

  const removeOption = (index: number) => {
    setForm(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const needsOptions = ['multiple_choice', 'single_choice', 'dropdown'].includes(form.question_type);

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="question_text">질문 내용</Label>
        <Textarea
          id="question_text"
          value={form.question_text}
          onChange={(e) => setForm(prev => ({ ...prev, question_text: e.target.value }))}
          placeholder="질문을 입력하세요"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="question_type">질문 유형</Label>
          <Select
            value={form.question_type}
            onValueChange={(value) => setForm(prev => ({ ...prev, question_type: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="multiple_choice">객관식 (다중선택)</SelectItem>
              <SelectItem value="single_choice">객관식 (단일선택)</SelectItem>
              <SelectItem value="text">주관식</SelectItem>
              <SelectItem value="textarea">장문형</SelectItem>
              <SelectItem value="rating">평점</SelectItem>
              <SelectItem value="scale">척도</SelectItem>
              <SelectItem value="dropdown">드롭다운</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="scope">범위</Label>
          <Select
            value={form.scope}
            onValueChange={(value: 'session' | 'operation') => setForm(prev => ({ ...prev, scope: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="session">세션</SelectItem>
              <SelectItem value="operation">운영</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="satisfaction_type">만족도 유형 (선택사항)</Label>
        <Select
          value={form.satisfaction_type}
          onValueChange={(value) => setForm(prev => ({ ...prev, satisfaction_type: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="선택하세요" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">없음</SelectItem>
            <SelectItem value="instructor">강사</SelectItem>
            <SelectItem value="course">과목</SelectItem>
            <SelectItem value="facility">시설</SelectItem>
            <SelectItem value="overall">전반적</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_required"
          checked={form.is_required}
          onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_required: !!checked }))}
        />
        <Label htmlFor="is_required">필수 응답</Label>
      </div>

      {needsOptions && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>선택 옵션</Label>
            <Button type="button" variant="outline" size="sm" onClick={addOption}>
              <Plus className="h-4 w-4 mr-1" />
              옵션 추가
            </Button>
          </div>
          <div className="space-y-2">
            {form.options.map((option, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`옵션 ${index + 1}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeOption(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {form.options.length === 0 && (
              <p className="text-sm text-muted-foreground">옵션을 추가해주세요.</p>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          취소
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "저장 중..." : (question ? "수정" : "추가")}
        </Button>
      </div>
    </div>
  );
}