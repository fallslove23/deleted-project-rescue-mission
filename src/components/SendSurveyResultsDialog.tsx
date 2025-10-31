import { useState, useEffect } from 'react';
import { Mail, Users, Eye, Send, ChevronLeft, ChevronRight, Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { EmailRecipientPresets } from '@/components/EmailRecipientPresets';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SendSurveyResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surveyId: string;
  surveyTitle: string;
  responseCount: number;
  instructorId?: string | null;
  isInstructor?: boolean;
}

interface EmailPreview {
  subject: string;
  htmlContent: string;
  textContent: string;
  recipients: string[];
}

const ROLE_LABELS: Record<string, string> = {
  admin: '관리자',
  operator: '운영자',
  director: '감독자',
  instructor: '강사',
};

export const SendSurveyResultsDialog = ({
  open,
  onOpenChange,
  surveyId,
  surveyTitle,
  responseCount,
  instructorId,
  isInstructor = false,
}: SendSurveyResultsDialogProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Step 1: 수신자 선택
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [additionalEmails, setAdditionalEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  
  // Step 2: 이메일 미리보기
  const [emailPreview, setEmailPreview] = useState<EmailPreview | null>(null);
  const [previewMode, setPreviewMode] = useState<'html' | 'text'>('html');
  
  // Step 3: 전송 결과
  const [sendResult, setSendResult] = useState<any>(null);

  // 다이얼로그가 열릴 때 초기화
  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedRoles(isInstructor ? ['instructor'] : []);
      setAdditionalEmails([]);
      setNewEmail('');
      setEmailPreview(null);
      setSendResult(null);
    }
  }, [open, isInstructor]);

  const handleRoleToggle = (role: string) => {
    // 강사는 자신에게만 전송 가능
    if (isInstructor) {
      if (role === 'instructor') {
        setSelectedRoles(['instructor']);
      }
      return;
    }

    setSelectedRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleAddEmail = () => {
    const trimmed = newEmail.trim();
    if (!trimmed) return;

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      toast({
        title: '오류',
        description: '올바른 이메일 형식이 아닙니다.',
        variant: 'destructive',
      });
      return;
    }

    if (additionalEmails.includes(trimmed)) {
      toast({
        title: '오류',
        description: '이미 추가된 이메일입니다.',
        variant: 'destructive',
      });
      return;
    }

    setAdditionalEmails(prev => [...prev, trimmed]);
    setNewEmail('');
  };

  const handleRemoveEmail = (email: string) => {
    setAdditionalEmails(prev => prev.filter(e => e !== email));
  };

  const handleLoadPreset = (recipients: string[]) => {
    // 프리셋에서 역할과 이메일 분리
    const roles = recipients.filter(r => ['admin', 'operator', 'director', 'instructor'].includes(r));
    const emails = recipients.filter(r => r.includes('@'));
    
    if (isInstructor) {
      setSelectedRoles(['instructor']);
      setAdditionalEmails(emails);
    } else {
      setSelectedRoles(roles);
      setAdditionalEmails(emails);
    }
  };

  const handleNextStep = async () => {
    if (step === 1) {
      // 응답이 없으면 경고
      if (responseCount === 0) {
        toast({
          title: '전송 불가',
          description: '응답이 없는 설문은 이메일을 전송할 수 없습니다.',
          variant: 'destructive',
        });
        return;
      }

      // 수신자가 없으면 경고
      if (selectedRoles.length === 0 && additionalEmails.length === 0) {
        toast({
          title: '오류',
          description: '최소 1명 이상의 수신자를 선택해주세요.',
          variant: 'destructive',
        });
        return;
      }

      // 이메일 미리보기 로드
      setLoading(true);
      try {
        const allRecipients = [...selectedRoles, ...additionalEmails];
        
        const { data, error } = await supabase.functions.invoke('send-survey-results', {
          body: {
            surveyId,
            recipients: allRecipients,
            previewOnly: true,
          },
        });

        if (error) throw error;

        setEmailPreview(data);
        setStep(2);
      } catch (error: any) {
        console.error('Failed to load email preview:', error);
        toast({
          title: '미리보기 로드 실패',
          description: error.message || '이메일 미리보기를 불러오는 중 오류가 발생했습니다.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handlePreviousStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSend = async () => {
    setLoading(true);
    try {
      const allRecipients = [...selectedRoles, ...additionalEmails];
      
      const { data, error } = await supabase.functions.invoke('send-survey-results', {
        body: {
          surveyId,
          recipients: allRecipients,
          force: false,
        },
      });

      if (error) throw error;

      setSendResult(data);
      
      const sentCount = typeof data?.sent === 'number' ? data.sent : Array.isArray(data?.sent) ? data.sent.length : 0;
      const totalCount = typeof data?.total === 'number' ? data.total : (Array.isArray(data?.recipients) ? data.recipients.length : sentCount);

      if (data?.alreadySent) {
        toast({
          title: '이미 발송됨',
          description: `이 설문은 이전에 전송 완료되어 재전송이 건너뛰어졌습니다. (대상: ${totalCount}명)`,
        });
      } else {
        toast({
          title: data?.success ? '전송 완료' : '전송 완료(일부 실패)',
          description: `${sentCount}명에게 이메일이 전송되었습니다${typeof data?.failed === 'number' && data.failed > 0 ? ` (실패 ${data.failed}명)` : ''}.`,
        });
      }

      // 성공 후 다이얼로그 닫기
      setTimeout(() => {
        onOpenChange(false);
      }, 2000);
    } catch (error: any) {
      console.error('Failed to send results:', error);
      toast({
        title: '전송 실패',
        description: error.message || '이메일 전송 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const totalRecipients = selectedRoles.length + additionalEmails.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            설문 결과 이메일 전송
          </DialogTitle>
          <DialogDescription>
            {surveyTitle} · 응답 {responseCount}개
          </DialogDescription>
        </DialogHeader>

        {/* 단계 표시 */}
        <div className="flex items-center justify-center gap-2 py-4">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 1 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>
              1
            </div>
            <span className="text-sm font-medium">수신자 선택</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 2 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>
              2
            </div>
            <span className="text-sm font-medium">미리보기</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 3 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>
              3
            </div>
            <span className="text-sm font-medium">전송 확인</span>
          </div>
        </div>

        {/* 단계별 콘텐츠 */}
        <div className="flex-1 overflow-y-auto px-1">
          {/* Step 1: 수신자 선택 */}
          {step === 1 && (
            <div className="space-y-6">
              {isInstructor && (
                <Alert>
                  <AlertDescription>
                    강사는 본인에게만 결과를 전송할 수 있습니다.
                  </AlertDescription>
                </Alert>
              )}

              {/* 역할 선택 */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">역할별 수신자</Label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(ROLE_LABELS).map(([role, label]) => (
                    <div
                      key={role}
                      className={`flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedRoles.includes(role)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      } ${isInstructor && role !== 'instructor' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => handleRoleToggle(role)}
                    >
                      <Checkbox
                        id={`role-${role}`}
                        checked={selectedRoles.includes(role)}
                        disabled={isInstructor && role !== 'instructor'}
                      />
                      <Label
                        htmlFor={`role-${role}`}
                        className="flex-1 cursor-pointer"
                      >
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* 추가 이메일 */}
              {!isInstructor && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">추가 이메일 주소</Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddEmail();
                        }
                      }}
                    />
                    <Button onClick={handleAddEmail} variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {additionalEmails.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {additionalEmails.map((email) => (
                        <Badge key={email} variant="secondary" className="px-3 py-1">
                          {email}
                          <button
                            onClick={() => handleRemoveEmail(email)}
                            className="ml-2 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 프리셋 */}
              {!isInstructor && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">수신자 프리셋</Label>
                  <EmailRecipientPresets
                    onLoadPreset={handleLoadPreset}
                    currentRecipients={[...selectedRoles, ...additionalEmails]}
                  />
                </div>
              )}

              {/* 선택 요약 */}
              <Alert>
                <Users className="h-4 w-4" />
                <AlertDescription>
                  선택된 수신자: <strong>{totalRecipients}명</strong>
                  {selectedRoles.length > 0 && (
                    <div className="mt-1 text-sm">
                      역할: {selectedRoles.map(r => ROLE_LABELS[r]).join(', ')}
                    </div>
                  )}
                  {additionalEmails.length > 0 && (
                    <div className="mt-1 text-sm">
                      추가 이메일: {additionalEmails.length}개
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Step 2: 이메일 미리보기 */}
          {step === 2 && emailPreview && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">이메일 미리보기</Label>
                <div className="flex gap-2">
                  <Button
                    variant={previewMode === 'html' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPreviewMode('html')}
                  >
                    HTML
                  </Button>
                  <Button
                    variant={previewMode === 'text' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPreviewMode('text')}
                  >
                    텍스트
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm">
                  <strong>제목:</strong> {emailPreview.subject}
                </div>
                <div className="text-sm">
                  <strong>수신자:</strong> {emailPreview.recipients.join(', ')}
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-background max-h-96 overflow-y-auto">
                {previewMode === 'html' ? (
                  <div dangerouslySetInnerHTML={{ __html: emailPreview.htmlContent }} />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm font-mono">
                    {emailPreview.textContent}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* Step 3: 전송 확인 */}
          {step === 3 && (
            <div className="space-y-4">
              <Alert>
                <Send className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">이메일을 전송하시겠습니까?</div>
                  <div className="space-y-1 text-sm">
                    <div>• 설문: {surveyTitle}</div>
                    <div>• 응답 수: {responseCount}개</div>
                    <div>• 수신자: {totalRecipients}명</div>
                    {selectedRoles.length > 0 && (
                      <div>• 역할: {selectedRoles.map(r => ROLE_LABELS[r]).join(', ')}</div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>

              {sendResult && (
                <Alert>
                  <AlertDescription>
                    <div className="space-y-2">
                      <div>✓ 전송 완료: {sendResult.sent?.length || 0}명</div>
                      {sendResult.failed && sendResult.failed.length > 0 && (
                        <div className="text-destructive">
                          ✗ 전송 실패: {sendResult.failed.length}명
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handlePreviousStep}
            disabled={step === 1 || loading}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            이전
          </Button>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
              취소
            </Button>
            
            {step < 3 ? (
              <Button onClick={handleNextStep} disabled={loading || totalRecipients === 0}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    로딩 중...
                  </>
                ) : (
                  <>
                    다음
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleSend} disabled={loading || sendResult}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    전송 중...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    전송
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
