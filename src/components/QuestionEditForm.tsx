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
  sections?: { id: string; name: string }[];
  sessions?: { id: string; session_name: string; course?: { title: string }; instructor?: { name: string } }[];
}

export default function QuestionEditForm({ question, surveyId, onSave, onCancel, sections, sessions }: QuestionEditFormProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    question_text: "",
    question_type: "multiple_choice",
    is_required: true,
    scope: "session" as 'session' | 'operation',
    satisfaction_type: "none",
    section_id: "",
    session_id: "",
    options: [] as string[]
  });

  useEffect(() => {
    if (question) {
      setForm({
        question_text: question.question_text || "",
        question_type: question.question_type || "multiple_choice",
        is_required: question.is_required ?? true,
        scope: question.scope || "session",
        satisfaction_type: question.satisfaction_type || "none",
        section_id: question.section_id || "none",
        session_id: question.session_id || "none",
        options: Array.isArray(question.options) ? question.options : 
                 question.options?.options ? question.options.options : []
      });
    } else {
      setForm({
        question_text: "",
        question_type: "multiple_choice",
        is_required: true,
        scope: "session",
        satisfaction_type: "none",
        section_id: "none",
        session_id: "none",
        options: []
      });
    }
  }, [question]);

  const handleSave = async () => {
    console.log('QuestionEditForm - handleSave called');
    console.log('QuestionEditForm - Current form data:', form);
    console.log('QuestionEditForm - surveyId:', surveyId);
    console.log('QuestionEditForm - Is editing?', !!question);
    
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
        satisfaction_type: form.satisfaction_type === "none" ? null : form.satisfaction_type,
        section_id: form.section_id === "none" ? null : (form.section_id || null),
        session_id: form.session_id === "none" ? null : (form.session_id || null),
        options: form.options.length > 0 ? { options: form.options } : null,
        order_index: question?.order_index ?? 0
      };

      console.log('QuestionEditForm - Question data to save:', questionData);

      if (question?.id) {
        console.log('QuestionEditForm - Updating existing question:', question.id);
        const { error } = await supabase
          .from('survey_questions')
          .update(questionData)
          .eq('id', question.id);
        
        if (error) {
          console.error('QuestionEditForm - Update error:', error);
          throw error;
        }
        toast({ title: "성공", description: "질문이 수정되었습니다." });
      } else {
        console.log('QuestionEditForm - Creating new question');
        const { data, error } = await supabase
          .from('survey_questions')
          .insert(questionData)
          .select('*');
        
        if (error) {
          console.error('QuestionEditForm - Insert error:', error);
          throw error;
        }
        
        console.log('QuestionEditForm - Question created successfully:', data);
        toast({ title: "성공", description: "질문이 추가되었습니다." });
      }

      console.log('QuestionEditForm - Save completed, calling onSave()');
      onSave();
    } catch (error: any) {
      console.error('QuestionEditForm - Save failed:', error);
      toast({ 
        title: "오류", 
        description: error.message || "질문 저장 중 오류가 발생했습니다.", 
        variant: "destructive" 
      });
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

  const renderQuestionPreview = () => {
    if (!form.question_text.trim()) return null;

    return (
      <div className="border rounded-lg p-4 bg-muted/30">
        <div className="text-sm font-medium text-muted-foreground mb-2">미리보기</div>
        <div className="space-y-3">
          <div className="font-medium">
            {form.question_text}
            {form.is_required && <span className="text-red-500 ml-1">*</span>}
          </div>
          
          {form.question_type === 'multiple_choice' && (
            <div className="space-y-2">
              {form.options.map((option, index) => (
                <label key={index} className="flex items-center space-x-2">
                  <input type="checkbox" className="rounded" disabled />
                  <span className="text-sm">{option || `옵션 ${index + 1}`}</span>
                </label>
              ))}
              {form.options.length === 0 && (
                <div className="text-sm text-muted-foreground italic">선택 옵션을 추가해주세요</div>
              )}
            </div>
          )}
          
          {form.question_type === 'single_choice' && (
            <div className="space-y-2">
              {form.options.map((option, index) => (
                <label key={index} className="flex items-center space-x-2">
                  <input type="radio" name="preview" className="rounded-full" disabled />
                  <span className="text-sm">{option || `옵션 ${index + 1}`}</span>
                </label>
              ))}
              {form.options.length === 0 && (
                <div className="text-sm text-muted-foreground italic">선택 옵션을 추가해주세요</div>
              )}
            </div>
          )}
          
          {form.question_type === 'dropdown' && (
            <select className="w-full p-2 border rounded" disabled>
              <option>선택해주세요</option>
              {form.options.map((option, index) => (
                <option key={index}>{option || `옵션 ${index + 1}`}</option>
              ))}
            </select>
          )}
          
          {form.question_type === 'text' && (
            <input type="text" className="w-full p-2 border rounded" placeholder="답변을 입력하세요" disabled />
          )}
          
          {form.question_type === 'textarea' && (
            <textarea className="w-full p-2 border rounded" rows={3} placeholder="답변을 입력하세요" disabled />
          )}
          
          {(form.question_type === 'rating' || form.question_type === 'scale') && (
            <div className="flex space-x-2 flex-wrap">
              {form.question_type === 'rating' 
                ? [1, 2, 3, 4, 5].map((num) => (
                    <label key={num} className="flex items-center space-x-1">
                      <input type="radio" name="rating-preview" disabled />
                      <span className="text-sm">{num}</span>
                    </label>
                  ))
                : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <label key={num} className="flex items-center space-x-1">
                      <input type="radio" name="scale-preview" disabled />
                      <span className="text-sm">{num}</span>
                    </label>
                  ))
              }
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 질문 내용 입력 */}
      <div className="space-y-2">
        <Label htmlFor="question_text" className="text-sm font-medium">
          질문 내용 <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="question_text"
          value={form.question_text}
          onChange={(e) => setForm(prev => ({ ...prev, question_text: e.target.value }))}
          placeholder="질문을 입력하세요"
          rows={3}
          className="resize-none"
        />
      </div>

      {/* 미리보기 */}
      {renderQuestionPreview()}

      {/* 질문 설정 */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="question_type" className="text-sm font-medium">
            답변 방식 <span className="text-red-500">*</span>
          </Label>
          <Select
            value={form.question_type}
            onValueChange={(value) => setForm(prev => ({ ...prev, question_type: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="multiple_choice">☑️ 객관식 (복수선택)</SelectItem>
              <SelectItem value="single_choice">⚪ 객관식 (단일선택)</SelectItem>
              <SelectItem value="dropdown">📋 드롭다운 선택</SelectItem>
              <SelectItem value="text">✏️ 주관식 (한줄)</SelectItem>
              <SelectItem value="textarea">📝 주관식 (여러줄)</SelectItem>
              <SelectItem value="rating">⭐ 평점 (1-5점)</SelectItem>
              <SelectItem value="scale">📊 척도 (1-10점)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 추가 설정 */}
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label htmlFor="satisfaction_type" className="text-sm font-medium">
            만족도 분류 (선택사항)
          </Label>
          <Select
            value={form.satisfaction_type}
            onValueChange={(value) => setForm(prev => ({ ...prev, satisfaction_type: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="선택하세요" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">분류 없음</SelectItem>
              <SelectItem value="instructor">👨‍🏫 강사 만족도</SelectItem>
              <SelectItem value="course">📚 과목 만족도</SelectItem>
              <SelectItem value="operation">⚙️ 운영 만족도</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 세션 선택 (우선) */}
        <div className="space-y-2">
          <Label htmlFor="session_id" className="text-sm font-medium">
            과목 세션 (권장)
          </Label>
          <Select
            value={form.session_id}
            onValueChange={(value) => {
              setForm(prev => ({ 
                ...prev, 
                session_id: value,
                section_id: value === "none" ? prev.section_id : "none" // 세션 선택 시 섹션 해제
              }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="세션을 선택하세요" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="none">🔄 세션 없음</SelectItem>
              {sessions && sessions.map((session) => (
                <SelectItem key={session.id} value={session.id}>
                  📚 {session.session_name}
                  {session.course && ` • ${session.course.title}`}
                  {session.instructor && ` • ${session.instructor.name}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            💡 과목별 세션을 선택하면 해당 과목/강사 그룹에 질문이 추가됩니다.
          </p>
        </div>

        {/* 섹션 선택 (레거시) */}
        <div className="space-y-2">
          <Label htmlFor="section_id" className="text-sm font-medium">
            질문 섹션 (레거시)
          </Label>
          <Select
            value={form.section_id}
            onValueChange={(value) => {
              setForm(prev => ({ 
                ...prev, 
                section_id: value,
                session_id: value === "none" ? prev.session_id : "none" // 섹션 선택 시 세션 해제
              }));
            }}
            disabled={form.session_id !== "none"}
          >
            <SelectTrigger>
              <SelectValue placeholder={form.session_id !== "none" ? "세션이 선택되어 비활성화됨" : "섹션을 선택하세요"} />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="none">📁 미분류</SelectItem>
              {sections && sections.map((section) => (
                <SelectItem key={section.id} value={section.id}>
                  📂 {section.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {form.session_id !== "none" 
              ? "⚠️ 세션이 선택되어 섹션은 비활성화됩니다." 
              : "📝 기존 섹션 방식입니다. 세션 방식을 권장합니다."
            }
          </p>
        </div>
      </div>

      {/* 필수 응답 체크 */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_required"
          checked={form.is_required}
          onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_required: !!checked }))}
        />
        <Label htmlFor="is_required" className="text-sm font-medium">
          필수 응답 질문으로 설정
        </Label>
      </div>

      {/* 선택 옵션 설정 */}
      {needsOptions && (
        <div className="border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <Label className="text-sm font-medium">선택 옵션 설정</Label>
              <p className="text-xs text-muted-foreground mt-1">
                {form.question_type === 'multiple_choice' && '응답자가 여러 개를 선택할 수 있습니다'}
                {form.question_type === 'single_choice' && '응답자가 하나만 선택할 수 있습니다'}
                {form.question_type === 'dropdown' && '드롭다운에서 하나를 선택할 수 있습니다'}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addOption}>
              <Plus className="h-4 w-4 mr-1" />
              옵션 추가
            </Button>
          </div>
          
          {form.options.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-4xl mb-2">📝</div>
              <p>선택 옵션을 추가해주세요</p>
              <p className="text-xs mt-1">최소 2개 이상의 옵션이 필요합니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {form.options.map((option, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <div className="w-6 text-center text-sm text-muted-foreground">
                    {index + 1}.
                  </div>
                  <Input
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    placeholder={`${index + 1}번 옵션을 입력하세요`}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOption(index)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
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