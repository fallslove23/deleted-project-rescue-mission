import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ArrowLeft, Plus, Edit, Trash2, Copy, FileText, CheckCircle2, AlertTriangle, RotateCcw, Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Template {
  id: string;
  name: string;
  description?: string;
  is_course_evaluation: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplateQuestion {
  id: string;
  template_id: string;
  question_text: string;
  question_type: string;
  options?: any;
  is_required: boolean;
  order_index: number;
  section_id?: string | null;
  satisfaction_type?: string | null;
}

interface TemplateSection {
  id: string;
  template_id: string;
  name: string;
  description?: string | null;
  order_index: number;
}

interface DuplicateResultState {
  status: 'success' | 'error';
  originalTemplate: Template;
  newTemplate?: Template;
  logs: string[];
  errorMessage?: string;
  questionCount?: number;
  sectionCount?: number;
}

const TemplateManagement = ({ showPageHeader = true }: { showPageHeader?: boolean }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    is_course_evaluation: false
  });

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicatingTemplateId, setDuplicatingTemplateId] = useState<string | null>(null);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateResultState | null>(null);
  const [showDuplicateLogs, setShowDuplicateLogs] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('survey_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: "오류",
        description: "템플릿을 불러오는 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetTemplateForm = () => {
    setTemplateForm({
      name: '',
      description: '',
      is_course_evaluation: false
    });
    setEditingTemplate(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from('survey_templates')
          .update({
            name: templateForm.name,
            description: templateForm.description,
            is_course_evaluation: templateForm.is_course_evaluation,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;

        toast({
          title: "성공",
          description: "템플릿이 수정되었습니다."
        });
      } else {
        const { error } = await supabase
          .from('survey_templates')
          .insert([templateForm]);

        if (error) throw error;

        toast({
          title: "성공",
          description: "템플릿이 생성되었습니다."
        });
      }

      setIsDialogOpen(false);
      resetTemplateForm();
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "오류",
        description: "템플릿 저장 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      description: template.description || '',
      is_course_evaluation: template.is_course_evaluation
    });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (template: Template) => {
    setTemplateToDelete(template);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!templateToDelete) {
      return;
    }

    const templateId = templateToDelete.id;

    try {
      setIsDeleting(true);

      const { error: questionsError } = await supabase
        .from('template_questions')
        .delete()
        .eq('template_id', templateId);

      if (questionsError) throw questionsError;

      const { error: sectionsError } = await supabase
        .from('template_sections')
        .delete()
        .eq('template_id', templateId);

      if (sectionsError) throw sectionsError;

      const { error } = await supabase
        .from('survey_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: "성공",
        description: "템플릿이 삭제되었습니다."
      });

      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "오류",
        description: "템플릿 삭제 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  const duplicateTemplate = async (template: Template) => {
    const formatLog = (message: string) => `${new Date().toLocaleTimeString()} - ${message}`;
    const logs: string[] = [formatLog(`'${template.name}' 템플릿 복제를 시작합니다.`)];

    setIsDuplicating(true);
    setDuplicatingTemplateId(template.id);
    setDuplicateModalOpen(false);
    setDuplicateResult(null);
    setShowDuplicateLogs(false);

    let sections: TemplateSection[] = [];
    let questions: TemplateQuestion[] = [];

    try {
      const { data: newTemplate, error: templateError } = await supabase
        .from('survey_templates')
        .insert([{
          name: `${template.name} (복사본)`,
          description: template.description,
          is_course_evaluation: template.is_course_evaluation
        }])
        .select()
        .single();

      if (templateError) throw templateError;

      logs.push(formatLog(`새 템플릿 생성 완료 (ID: ${newTemplate.id})`));

      const { data: sectionsData, error: sectionsError } = await supabase
        .from('template_sections')
        .select('*')
        .eq('template_id', template.id)
        .order('order_index');

      if (sectionsError) throw sectionsError;

      sections = (sectionsData as TemplateSection[] | null) ?? [];
      logs.push(formatLog(`섹션 ${sections.length}개를 불러왔습니다.`));

      const sectionIdMap: Record<string, string> = {};
      if (sections.length > 0) {
        logs.push(formatLog('섹션 복제를 시작합니다.'));
        const sectionPayload = sections.map(section => ({
          template_id: newTemplate.id,
          name: section.name,
          description: section.description ?? null,
          order_index: section.order_index
        }));

        const { data: insertedSections, error: insertSectionsError } = await supabase
          .from('template_sections')
          .insert(sectionPayload)
          .select();

        if (insertSectionsError) throw insertSectionsError;

        ((insertedSections as TemplateSection[] | null) ?? []).forEach((newSection, index) => {
          const originalSection = sections[index];
          if (originalSection) {
            sectionIdMap[originalSection.id] = newSection.id;
          }
        });

        logs.push(formatLog(`섹션 ${sections.length}개 복제를 완료했습니다.`));
      } else {
        logs.push(formatLog('복제할 섹션이 없습니다.'));
      }

      const { data: questionsData, error: questionsError } = await supabase
        .from('template_questions')
        .select('*')
        .eq('template_id', template.id)
        .order('order_index');

      if (questionsError) throw questionsError;

      questions = (questionsData as TemplateQuestion[] | null) ?? [];
      logs.push(formatLog(`질문 ${questions.length}개를 불러왔습니다.`));

      if (questions.length > 0) {
        logs.push(formatLog('질문 복제를 시작합니다.'));
        const questionPayload = questions.map(q => ({
          template_id: newTemplate.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options,
          is_required: q.is_required,
          order_index: q.order_index,
          section_id: q.section_id ? sectionIdMap[q.section_id] ?? null : null,
          satisfaction_type: q.satisfaction_type ?? null
        }));

        const { error: insertQuestionsError } = await supabase
          .from('template_questions')
          .insert(questionPayload);

        if (insertQuestionsError) throw insertQuestionsError;

        logs.push(formatLog(`질문 ${questions.length}개 복제를 완료했습니다.`));
      } else {
        logs.push(formatLog('복제할 질문이 없습니다.'));
      }

      logs.push(formatLog('템플릿 복제 작업이 완료되었습니다.'));

      toast({
        title: "성공",
        description: "템플릿이 복제되었습니다."
      });

      setDuplicateResult({
        status: 'success',
        originalTemplate: template,
        newTemplate,
        logs,
        questionCount: questions.length,
        sectionCount: sections.length
      });
      setDuplicateModalOpen(true);
      fetchTemplates();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      logs.push(formatLog(`오류 발생: ${errorMessage}`));
      console.error('Error duplicating template:', error);
      toast({
        title: "오류",
        description: "템플릿 복제 중 오류가 발생했습니다.",
        variant: "destructive"
      });
      setDuplicateResult({
        status: 'error',
        originalTemplate: template,
        logs,
        errorMessage
      });
      setDuplicateModalOpen(true);
    } finally {
      setIsDuplicating(false);
      setDuplicatingTemplateId(null);
    }
  };

  const handleDuplicate = (template: Template) => {
    if (isDuplicating) {
      return;
    }
    void duplicateTemplate(template);
  };

  const handleRetryDuplicate = async () => {
    if (!duplicateResult?.originalTemplate || isDuplicating) {
      return;
    }
    const templateToRetry = duplicateResult.originalTemplate;
    setDuplicateModalOpen(false);
    setDuplicateResult(null);
    setShowDuplicateLogs(false);
    await duplicateTemplate(templateToRetry);
  };

  const handleStartEditing = () => {
    if (!duplicateResult?.newTemplate?.id) {
      return;
    }
    const templateId = duplicateResult.newTemplate.id;
    setDuplicateModalOpen(false);
    setDuplicateResult(null);
    setShowDuplicateLogs(false);
    navigate(`/template-builder/${templateId}`);
  };

  const handleEditQuestions = (templateId: string) => {
    navigate(`/template-builder/${templateId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div>로딩중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {showPageHeader && (
        <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
          <div className="container mx-auto px-4 py-3 flex items-center relative">
            <Button
              onClick={() => navigate('/dashboard')}
              variant="ghost"
              size="sm"
              className="touch-friendly"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">대시보드</span>
            </Button>
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <h1 className="text-sm sm:text-lg font-semibold text-primary text-center">템플릿 관리</h1>
              <p className="text-xs text-muted-foreground text-center break-words">설문조사 템플릿 생성 및 관리</p>
            </div>
          </div>
        </header>
      )}

      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-lg sm:text-xl font-bold break-words">템플릿 목록</h2>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetTemplateForm();
            }}>
              <DialogTrigger asChild>
                <Button className="touch-friendly w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  새 템플릿
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingTemplate ? '템플릿 수정' : '새 템플릿 만들기'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">템플릿 이름</Label>
                    <Input
                      id="name"
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="템플릿 이름을 입력하세요"
                      required
                      className="touch-friendly"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">설명</Label>
                    <Textarea
                      id="description"
                      value={templateForm.description}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="템플릿 설명을 입력하세요 (선택사항)"
                      rows={3}
                      className="touch-friendly"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_course_evaluation"
                      checked={templateForm.is_course_evaluation}
                      onCheckedChange={(checked) => setTemplateForm(prev => ({ ...prev, is_course_evaluation: checked }))}
                    />
                    <Label htmlFor="is_course_evaluation" className="break-words">강의평가용 템플릿</Label>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="touch-friendly">
                      취소
                    </Button>
                    <Button type="submit" className="touch-friendly">
                      {editingTemplate ? '수정' : '생성'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader className="p-4 sm:p-6">
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                          <CardTitle className="text-base sm:text-lg break-words line-clamp-2">{template.name}</CardTitle>
                          {template.is_course_evaluation && (
                            <Badge>강의평가</Badge>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-sm text-muted-foreground break-words line-clamp-2">
                            {template.description}
                          </p>
                        )}
                      </div>
                    </div>
                    
                     <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => handleEditQuestions(template.id)}
                         className="touch-friendly text-xs h-9 px-2 flex-1 min-w-0"
                       >
                         <FileText className="h-3 w-3 sm:mr-1 flex-shrink-0" />
                         <span className="hidden sm:inline truncate">편집</span>
                       </Button>
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => handleDuplicate(template)}
                         className="touch-friendly text-xs h-9 px-2 flex-1 min-w-0"
                         disabled={isDuplicating}
                         aria-label="템플릿 복사"
                       >
                         <Copy className="h-3 w-3 sm:mr-1 flex-shrink-0" />
                         <span className="hidden sm:inline truncate">
                           {isDuplicating && duplicatingTemplateId === template.id ? '복사 중...' : '복사'}
                         </span>
                       </Button>
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => handleEdit(template)}
                         className="touch-friendly text-xs h-9 px-2 flex-1 min-w-0"
                       >
                         <Edit className="h-3 w-3 sm:mr-1 flex-shrink-0" />
                         <span className="hidden sm:inline truncate">수정</span>
                       </Button>
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => handleDeleteClick(template)}
                         disabled={isDeleting}
                         className="touch-friendly text-xs h-9 px-2 flex-1 min-w-0"
                       >
                         <Trash2 className="h-3 w-3 sm:mr-1 flex-shrink-0" />
                         <span className="hidden sm:inline truncate">삭제</span>
                       </Button>
                     </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="text-xs sm:text-sm text-muted-foreground break-words">
                    생성일: {new Date(template.created_at).toLocaleDateString()}
                    {template.updated_at !== template.created_at && (
                      <span className="block sm:inline sm:ml-4">
                        수정일: {new Date(template.updated_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {templates.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              아직 템플릿이 없습니다. 첫 번째 템플릿을 만들어보세요.
            </div>
          )}
        </div>
      </main>
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) {
            setTemplateToDelete(null);
            setIsDeleting(false);
          }
        }}
        title="템플릿 삭제"
        description={
          <>
            <p>선택한 템플릿과 연결된 모든 질문과 섹션이 삭제됩니다.</p>
            {templateToDelete && (
              <p className="rounded-md bg-muted px-3 py-2 font-medium text-foreground">
                {templateToDelete.name}
              </p>
            )}
            <p className="font-semibold text-destructive">이 작업은 되돌릴 수 없습니다.</p>
          </>
        }
        primaryAction={{
          label: isDeleting ? '삭제 중...' : '삭제',
          variant: 'destructive',
          disabled: isDeleting,
          onClick: () => {
            void handleDelete();
          },
        }}
      />
      <Dialog
        open={duplicateModalOpen}
        onOpenChange={(open) => {
          setDuplicateModalOpen(open);
          if (!open) {
            setDuplicateResult(null);
            setShowDuplicateLogs(false);
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>템플릿 복제 결과</DialogTitle>
          </DialogHeader>
          {duplicateResult ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                {duplicateResult.status === 'success' ? (
                  <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-500" />
                ) : (
                  <AlertTriangle className="mt-1 h-5 w-5 text-destructive" />
                )}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {duplicateResult.status === 'success'
                      ? `"${duplicateResult.originalTemplate.name}" 템플릿이 성공적으로 복제되었습니다.`
                      : `"${duplicateResult.originalTemplate.name}" 템플릿 복제에 실패했습니다.`}
                  </p>
                  {duplicateResult.status === 'success' && duplicateResult.newTemplate && (
                    <div className="rounded-md border bg-muted/40 p-3 text-sm">
                      <p className="font-medium text-foreground">새 템플릿 정보</p>
                      <div className="mt-2 space-y-1 text-muted-foreground">
                        <p>
                          템플릿 ID:{' '}
                          <span className="font-mono text-xs sm:text-sm break-all">
                            {duplicateResult.newTemplate.id}
                          </span>
                        </p>
                        <p>질문 수: {duplicateResult.questionCount ?? 0}</p>
                        <p>섹션 수: {duplicateResult.sectionCount ?? 0}</p>
                      </div>
                    </div>
                  )}
                  {duplicateResult.status === 'error' && (
                    <p className="text-sm text-destructive">{duplicateResult.errorMessage}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDuplicateLogs(prev => !prev)}
                  className="touch-friendly"
                >
                  <Terminal className="h-4 w-4 mr-2" />
                  {showDuplicateLogs ? '로그 숨기기' : '로그 보기'}
                </Button>
                {duplicateResult.status === 'error' && (
                  <Button
                    type="button"
                    onClick={handleRetryDuplicate}
                    disabled={isDuplicating}
                    className="touch-friendly"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {isDuplicating ? '재시도 중...' : '재시도'}
                  </Button>
                )}
                {duplicateResult.status === 'success' && duplicateResult.newTemplate && (
                  <Button onClick={handleStartEditing} className="touch-friendly">
                    <Edit className="h-4 w-4 mr-2" />
                    편집 시작
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setDuplicateModalOpen(false);
                    setDuplicateResult(null);
                    setShowDuplicateLogs(false);
                  }}
                  className="touch-friendly"
                >
                  닫기
                </Button>
              </div>

              {showDuplicateLogs && (
                <ScrollArea className="max-h-48 rounded-md border p-3">
                  <div className="space-y-2 text-xs font-mono text-muted-foreground">
                    {duplicateResult.logs.map((log, index) => (
                      <div key={index}>{log}</div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">복제 결과 정보를 찾을 수 없습니다.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TemplateManagement;