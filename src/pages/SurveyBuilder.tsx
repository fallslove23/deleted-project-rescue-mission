import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Pencil,
  Trash2,
  Plus,
  Settings,
  Edit,
  RefreshCcw,
  CheckSquare,
  Square,
  AlertTriangle,
  ClipboardCheck,
  CheckCircle2,
  BellRing,
  Mail,
  ExternalLink,
  LayoutDashboard,
  AlertCircle,
} from "lucide-react";


import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import QuestionEditForm from "@/components/QuestionEditForm";
import { SessionManager, SurveySession } from "@/components/SessionManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

/* ───────────────────────────────── helpers ───────────────────────────────── */
const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInputStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
function getDefaultStartEndLocal() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const start = new Date(next); start.setHours(9, 0, 0, 0);
  const end = new Date(next); end.setHours(19, 0, 0, 0);
  return { startLocal: toLocalInputStr(start), endLocal: toLocalInputStr(end) };
}
const toLocalDateTime = (iso: string | null) => {
  if (!iso) return ""; const d = new Date(iso); return isNaN(d.getTime()) ? "" : toLocalInputStr(d);
};
const toSafeISOString = (local: string | null) => {
  if (!local) return null; const d = new Date(local); return isNaN(d.getTime()) ? null : d.toISOString();
};
const buildTitle = (year: number | null, round: number | null, day: number | null, courseName: string | null, isGrouped?: boolean, groupNumber?: number | null, isFinalSurvey?: boolean) => {
  if (!year || !round || !day || !courseName) return "";
  let title = `${year}-${courseName}-${round}차-${day}일차`;
  
  // 분반 설정이 있으면 조 번호 추가 (차수 뒤)
  if (isGrouped && groupNumber) {
    title += ` ${groupNumber}조`;
  }
  
  title += ' 설문';
  
  // 종료 설문이면 태그 추가
  if (isFinalSurvey) {
    title = `[종료 설문] ${title}`;
  }
  
  return title;
};

/* ───────────────────────────────── types ───────────────────────────────── */
type Survey = {
  id: string; title: string | null; description: string | null;
  start_date: string | null; end_date: string | null;
  education_year: number | null; education_round: number | null; education_day: number | null;
  course_name: string | null; expected_participants: number | null; is_test: boolean | null;
  status: "draft" | "active" | "public" | "completed" | "review_requested" | "deployed" | null;
  created_at: string | null; updated_at: string | null; created_by?: string | null;
  is_final_survey?: boolean | null;

  // 분반 관련 필드
  is_grouped?: boolean | null;
  group_type?: string | null;
  group_number?: number | null;
};
type SurveyQuestion = {
  id: string; question_text: string; question_type: string; options: any; is_required: boolean;
  order_index: number; section_id?: string | null; session_id?: string | null;
  scope: 'session' | 'operation'; satisfaction_type?: string | null;
};
type Section = { id: string; name: string; description?: string };
type Course = { id: string; title: string };
type Instructor = { id: string; name: string };

type SurveyWorkflowStatus = "draft" | "review_requested" | "deployed";

const STATUS_FLOW: SurveyWorkflowStatus[] = ["draft", "review_requested", "deployed"];

const STATUS_META: Record<SurveyWorkflowStatus, { label: string; description: string }> = {
  draft: {
    label: "초안",
    description: "설문을 편집 중입니다. 검수 요청 전에 필수 항목을 확인하세요.",
  },
  review_requested: {
    label: "검수 요청",
    description: "담당자 검수 대기 중입니다. 수정 사항이 있다면 초안으로 되돌려 편집하세요.",
  },
  deployed: {
    label: "배포",
    description: "설문이 배포되어 응답 수집을 시작했습니다. 후속 조치를 진행하세요.",
  },
};

const REVIEW_CHECKLIST = [
  {
    id: "content",
    label: "질문, 응답 옵션, 안내문을 최신 교육 내용과 비교하여 검토했습니다.",
    description: "복수 선택 문항과 필수 여부까지 다시 한 번 확인해주세요.",
  },
  {
    id: "schedule",
    label: "시작/종료 일시와 교육 일정이 일치합니다.",
    description: "배포 전 일정이 확정되었는지 담당자와 공유했는지 확인합니다.",
  },
  {
    id: "preview",
    label: "미리보기로 설문 흐름을 검토했습니다.",
    description: "모든 섹션과 분기 로직이 의도대로 노출되는지 확인합니다.",
  },
];

const DEPLOY_CHECKLIST = [
  {
    id: "required-fields",
    label: "필수 입력 항목(과정명, 일정, 질문 등)이 모두 채워져 있습니다.",
    description: "세션별 최소 한 개의 질문이 있는지 다시 한 번 확인하세요.",
  },
  {
    id: "communication",
    label: "배포 대상과 수집 기간을 담당자와 공유했습니다.",
    description: "메일, 메신저 등으로 공지 초안과 함께 전달했는지 점검합니다.",
  },
  {
    id: "backup",
    label: "배포 후 모니터링 계획과 응답 수집 마감 일정이 준비되었습니다.",
    description: "필요 시 취소/수정 프로세스도 마련되어 있는지 확인하세요.",
  },
];

/* ─────────────────────────────── component ─────────────────────────────── */
export default function SurveyBuilder() {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [survey, setSurvey] = useState<Survey | null>(null);

  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [sessions, setSessions] = useState<SurveySession[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);

  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<SurveyQuestion | null>(null);
  
  // 멀티 셀렉션 상태
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  
  // 템플릿 선택 관련 상태
  const [templateSelections, setTemplateSelections] = useState<Record<string, string>>({});

  const [educationYear, setEducationYear] = useState<number>(new Date().getFullYear());
  const [educationRound, setEducationRound] = useState<number>(1);
  const [educationDay, setEducationDay] = useState<number>(1);
  const [courseName, setCourseName] = useState<string>("");

  // 분반 관련 상태
  const [isGrouped, setIsGrouped] = useState<boolean>(false);
  const [groupType, setGroupType] = useState<string>("");
  const [groupNumber, setGroupNumber] = useState<number | null>(null);
  const [isFinalSurvey, setIsFinalSurvey] = useState<boolean>(false);

  const [startAt, setStartAt] = useState<string>("");
  const [endAt, setEndAt] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  const [courseNames, setCourseNames] = useState<{id: string; name: string}[]>([]);
  const [courseMgrOpen, setCourseMgrOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [editRow, setEditRow] = useState<{ id: string; name: string } | null>(null);

  const [templates, setTemplates] = useState<{id: string; name: string; is_course_evaluation?: boolean}[]>([]);
  const [templateSelectOpen, setTemplateSelectOpen] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [sectionForm, setSectionForm] = useState({ name: "", description: "" });

  const [statusChecklistOpen, setStatusChecklistOpen] = useState(false);
  const [checklistContext, setChecklistContext] = useState<"review" | "deploy" | null>(null);
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({});
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deploymentWarnings, setDeploymentWarnings] = useState<string[]>([]);
  const [postDeployDialogOpen, setPostDeployDialogOpen] = useState(false);
  const [creatorEmail, setCreatorEmail] = useState<string | null>(null);
  const [notificationEmail, setNotificationEmail] = useState<string>("");

  const title = useMemo(
    () => buildTitle(educationYear, educationRound, educationDay, courseName, isGrouped, groupNumber, isFinalSurvey),
    [educationYear, educationRound, educationDay, courseName, isGrouped, groupNumber, isFinalSurvey]
  );

  const currentWorkflowStatus: SurveyWorkflowStatus = useMemo(() => {
    const raw = survey?.status;
    if (raw === "review_requested") return "review_requested";
    if (raw === "deployed") return "deployed";
    if (raw === "public" || raw === "active") return "deployed";
    return "draft";
  }, [survey?.status]);

  const statusStepIndex = STATUS_FLOW.indexOf(currentWorkflowStatus);
  const activeChecklist = checklistContext === "review" ? REVIEW_CHECKLIST : DEPLOY_CHECKLIST;
  const allChecklistChecked = activeChecklist.every((item) => checklistState[item.id]);

  /* ───────────────────────────── data loaders ───────────────────────────── */
  const loadSurvey = useCallback(async () => {
    if (!surveyId) return;
    try {
      setLoading(true);
      console.log('Loading survey with ID:', surveyId);
      const { data, error } = await supabase.from("surveys").select("*").eq("id", surveyId).single();
      console.log('Survey data loaded:', data);
      console.log('Survey error:', error);
      if (error) throw error;
      const s = data as Survey;
      setSurvey(s);
      setEducationYear(s.education_year ?? new Date().getFullYear());
      setEducationRound(s.education_round ?? 1);
      setEducationDay(s.education_day ?? 1);
      setCourseName(s.course_name ?? "");
      setCreatorEmail(null);
      if (s.created_by) {
        const { data: ownerProfile, error: ownerError } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', s.created_by)
          .single();
        if (!ownerError && ownerProfile?.email) {
          setCreatorEmail(ownerProfile.email);
        }
      }

      // 분반 정보 로드
      setIsGrouped(s.is_grouped ?? false);
      setGroupType(s.group_type ?? "");
      setGroupNumber(s.group_number ?? null);
      setIsFinalSurvey(s.is_final_survey ?? false);
      const { startLocal, endLocal } = getDefaultStartEndLocal();
      setStartAt(toLocalDateTime(s.start_date) || startLocal);
      setEndAt(toLocalDateTime(s.end_date) || endLocal);
      setDescription(
        s.description ??
          "본 설문은 과목과 강사 만족도를 평가하기 위한 것입니다. 교육 품질 향상을 위해 모든 교육생께서 반드시 참여해 주시길 부탁드립니다."
      );
      console.log('Survey state updated with:', {
        educationYear: s.education_year,
        educationRound: s.education_round,
        educationDay: s.education_day,
        courseName: s.course_name,
        title: s.title,
        description: s.description
      });
    } catch (e: any) {
      console.error('Survey load error:', e);
      toast({ title: "설문 로드 실패", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [surveyId, toast]);

  const loadQuestions = useCallback(async () => {
    if (!surveyId) return;
    console.log('Loading questions for survey:', surveyId);
    const { data, error } = await supabase
      .from('survey_questions').select('*').eq('survey_id', surveyId).order('order_index');
    console.log('Questions query result:', { data, error, count: data?.length });
    if (error) { 
      console.error('Questions load error:', error);
      toast({ title: "질문 로드 실패", description: error.message, variant: "destructive" }); 
      return; 
    }
    setQuestions((data || []) as any[]);
    console.log('Questions state updated, count:', (data || []).length);
  }, [surveyId, toast]);

  const loadSections = useCallback(async () => {
    if (!surveyId) return;
    const { data, error } = await supabase
      .from('survey_sections').select('*').eq('survey_id', surveyId).order('order_index');
    if (error) { toast({ title: "섹션 로드 실패", description: error.message, variant: "destructive" }); return; }
    setSections((data || []) as any[]);
  }, [surveyId, toast]);

  const loadSessions = useCallback(async () => {
    if (!surveyId) return;
    const { data, error } = await supabase
      .from('survey_sessions')
      .select(`
        *,
        course:courses(id,title),
        instructor:instructors(id,name)
      `)
      .eq('survey_id', surveyId)
      .order('session_order');
    if (error) { toast({ title: "세션 로드 실패", description: error.message, variant: "destructive" }); return; }
    setSessions((data || []) as any[]);
  }, [surveyId, toast]);

  const loadCourses = useCallback(async () => {
    const { data, error } = await supabase.from('courses').select('id,title').order('title');
    if (!error && data) setCourses(data as any[]);
  }, []);

  const loadInstructors = useCallback(async () => {
    const { data, error } = await supabase.from('instructors').select('id,name').order('name');
    if (!error && data) setInstructors(data as any[]);
  }, []);

  const loadTemplates = useCallback(async () => {
    const { data, error } = await supabase.from('survey_templates').select('id,name,is_course_evaluation').order('name');
    if (error) { toast({ title: "템플릿 로드 실패", description: error.message, variant: "destructive" }); return; }
    setTemplates((data || []) as any[]);
  }, [toast]);

  const loadCourseNames = useCallback(async () => {
    const { data, error } = await supabase.from("course_names").select("*").order("name");
    if (error) { toast({ title: "과정명 목록 로드 실패", description: error.message, variant: "destructive" }); return; }
    setCourseNames((data || []) as any[]);
  }, [toast]);

  const reloadAll = useCallback(async () => {
    await Promise.all([
      loadSurvey(),
      loadCourseNames(),
      loadQuestions(),
      loadSections(),
      loadSessions(),
      loadCourses(),
      loadInstructors(),
      loadTemplates(),
    ]);
  }, [loadSurvey, loadCourseNames, loadQuestions, loadSections, loadSessions, loadCourses, loadInstructors, loadTemplates]);

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  useEffect(() => {
    setNotificationEmail(creatorEmail ?? "");
  }, [creatorEmail]);

  /* ─────────────────────────────── save/basic ────────────────────────────── */
  const validateBeforeDeploy = useCallback(() => {
    const errors: string[] = [];
    const trimmedCourseName = courseName.trim();
    const trimmedDescription = description.trim();
    const trimmedTitle = (title ?? "").trim();

    if (!trimmedCourseName) {
      errors.push("과정명이 입력되지 않았습니다.");
    }
    if (!trimmedTitle) {
      errors.push("설문 제목을 생성할 수 없습니다. 기본 정보를 다시 저장해 주세요.");
    }

    const startDate = startAt ? new Date(startAt) : null;
    const endDate = endAt ? new Date(endAt) : null;
    if (!startDate || isNaN(startDate.getTime())) {
      errors.push("시작 일시가 올바르지 않습니다.");
    }
    if (!endDate || isNaN(endDate.getTime())) {
      errors.push("종료 일시가 올바르지 않습니다.");
    }
    if (startDate && endDate && startDate >= endDate) {
      errors.push("종료 일시는 시작 일시 이후여야 합니다.");
    }

    if (!trimmedDescription) {
      errors.push("설문 설명을 입력해 주세요.");
    }

    if (sessions.length === 0) {
      errors.push("최소 1개의 교육 세션이 필요합니다.");
    }

    if (questions.length === 0) {
      errors.push("등록된 설문 질문이 없습니다.");
    }

    const sessionsWithoutQuestions = sessions.filter((session) =>
      !questions.some((q: any) => q.scope === 'session' && q.session_id === session.id)
    );
    if (sessionsWithoutQuestions.length > 0) {
      const names = sessionsWithoutQuestions
        .map((session) => session.course?.title || session.session_name)
        .filter(Boolean)
        .join(', ');
      errors.push(`질문이 없는 세션이 있습니다: ${names || '이름 없는 세션'}`);
    }

    return { valid: errors.length === 0, errors };
  }, [courseName, title, startAt, endAt, description, sessions, questions]);

  const resetChecklistState = useCallback((context: "review" | "deploy") => {
    const source = context === "review" ? REVIEW_CHECKLIST : DEPLOY_CHECKLIST;
    const initial: Record<string, boolean> = {};
    source.forEach((item) => {
      initial[item.id] = false;
    });
    setChecklistState(initial);
  }, []);

  const handleChecklistOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setChecklistContext(null);
        setChecklistState({});
        setChecklistError(null);
      }
      setStatusChecklistOpen(open);
    },
    []
  );

  const openChecklist = useCallback(
    (context: "review" | "deploy") => {
      setChecklistContext(context);
      resetChecklistState(context);
      setChecklistError(null);
      setStatusChecklistOpen(true);
    },
    [resetChecklistState]
  );

  const updateSurveyStatus = useCallback(
    async (next: SurveyWorkflowStatus) => {
      if (!surveyId) return;
      setStatusUpdating(true);
      const dbStatus = next === "deployed" ? "public" : next;
      try {
        const { error } = await supabase.from("surveys").update({ status: dbStatus }).eq("id", surveyId);
        if (error) throw error;
        setSurvey((prev) => (prev ? { ...prev, status: dbStatus } : prev));
        await loadSurvey();

        if (next === "review_requested") {
          toast({ title: "검수 요청 완료", description: "담당자에게 검수 요청을 전달했습니다." });
        } else if (next === "deployed") {
          toast({ title: "배포 완료", description: "설문이 배포되었습니다. 후속 안내를 진행하세요." });
          setDeploymentWarnings([]);
          setPostDeployDialogOpen(true);
        } else {
          toast({ title: "초안으로 변경", description: "설문이 다시 편집 가능한 상태가 되었습니다." });
        }
      } catch (e: any) {
        console.error("Status update error:", e);
        toast({
          title: "상태 변경 실패",
          description: e?.message ?? "상태 변경 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      } finally {
        setStatusUpdating(false);
      }
    },
    [surveyId, loadSurvey, toast]
  );

  const handleOpenReviewChecklist = useCallback(() => {
    openChecklist("review");
  }, [openChecklist]);

  const handleOpenDeployChecklist = useCallback(() => {
    const { valid, errors } = validateBeforeDeploy();
    setDeploymentWarnings(errors);
    if (!valid) {
      toast({
        title: "배포 전 확인 필요",
        description: "배포 요건을 충족한 뒤 다시 시도해 주세요.",
        variant: "destructive",
      });
      return;
    }
    openChecklist("deploy");
  }, [openChecklist, toast, validateBeforeDeploy]);

  const handleRunValidation = useCallback(() => {
    const { valid, errors } = validateBeforeDeploy();
    setDeploymentWarnings(errors);
    if (valid) {
      toast({ title: "배포 전 점검 완료", description: "배포 요건을 모두 충족했습니다." });
    } else {
      toast({ title: "점검 필요", description: "배포 전 확인해야 할 항목이 있습니다.", variant: "destructive" });
    }
  }, [toast, validateBeforeDeploy]);

  const handleReturnToDraft = useCallback(() => {
    if (statusUpdating) return;
    if (!confirm("설문을 초안 상태로 되돌릴까요? 현재 검수 요청/배포 상태가 초기화됩니다.")) return;
    updateSurveyStatus("draft");
  }, [statusUpdating, updateSurveyStatus]);

  const handleChecklistConfirm = useCallback(async () => {
    if (!checklistContext) return;
    if (!allChecklistChecked) {
      setChecklistError("모든 확인 항목에 동의해야 진행할 수 있습니다.");
      return;
    }
    if (checklistContext === "review") {
      await updateSurveyStatus("review_requested");
    } else if (checklistContext === "deploy") {
      await updateSurveyStatus("deployed");
    }
    handleChecklistOpenChange(false);
  }, [allChecklistChecked, checklistContext, handleChecklistOpenChange, updateSurveyStatus]);

  const handleChecklistToggle = useCallback((id: string, value: boolean) => {
    setChecklistState((prev) => ({ ...prev, [id]: value }));
    setChecklistError(null);
  }, []);

  const handleCopyPreviewLink = useCallback(async () => {
    if (!surveyId) return;
    const previewUrl = `${window.location.origin}/survey-preview/${surveyId}`;
    try {
      await navigator.clipboard.writeText(previewUrl);
      toast({ title: "링크 복사 완료", description: "설문 미리보기 링크가 복사되었습니다." });
    } catch (error) {
      console.error("Copy preview link error:", error);
      toast({
        title: "복사 실패",
        description: "브라우저에서 복사를 허용하지 않았습니다. 직접 복사해 주세요.",
        variant: "destructive",
      });
    }
  }, [surveyId, toast]);

  const handleOpenPreview = useCallback(() => {
    if (!surveyId) return;
    const previewUrl = `/survey-preview/${surveyId}?preview=true`;
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  }, [surveyId]);

  const handleSendDeploymentEmail = useCallback(() => {
    const recipient = notificationEmail.trim();
    if (!recipient) {
      toast({ title: "이메일 주소 필요", description: "담당자 이메일을 입력해 주세요.", variant: "destructive" });
      return;
    }
    const previewUrl = surveyId ? `${window.location.origin}/survey-preview/${surveyId}` : "";
    const subject = `[설문 배포 안내] ${title || "교육 설문"}`;
    const bodyLines = [
      "안녕하세요.",
      `설문 "${title || "교육 설문"}"이 배포되었습니다.`,
      previewUrl ? `설문 링크: ${previewUrl}` : "",
      "응답 기간과 안내 문구를 확인한 뒤 공유 부탁드립니다.",
    ].filter(Boolean);
    const mailto = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;
    window.open(mailto, "_blank");
    toast({ title: "메일 작성 창 열림", description: `${recipient} 주소로 새 메일을 작성합니다.` });
  }, [notificationEmail, surveyId, title, toast]);

  const handleGoToManagement = useCallback(() => {
    setPostDeployDialogOpen(false);
    navigate("/dashboard/surveys");
  }, [navigate]);

  const handleDismissWarnings = useCallback(() => {
    setDeploymentWarnings([]);
  }, []);

  const saveBasic = async () => {
    if (!surveyId) return;
    if (!educationYear || !educationRound || !educationDay || !courseName) {
      toast({ title: "필수값 누락", description: "교육연도, 차수, 일차, 과정명은 필수입니다.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { startLocal, endLocal } = getDefaultStartEndLocal();
      const payload = {
        education_year: educationYear, education_round: educationRound, education_day: educationDay,
        course_name: courseName, title,
        start_date: toSafeISOString(startAt || startLocal),
        end_date: toSafeISOString(endAt || endLocal),
        description,
        
        // 분반 관련 필드
        is_grouped: isGrouped,
        group_type: isGrouped ? (groupType || null) : null,
        group_number: isGrouped ? (groupNumber ?? null) : null,
        is_final_survey: isFinalSurvey,
      };
      const { error } = await supabase.from("surveys").update(payload).eq("id", surveyId);
      if (error) throw error;
      toast({ title: "기본 정보 저장", description: "저장되었습니다." });
      await loadSurvey();
    } catch (e: any) {
      toast({ title: "저장 실패", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /* ───────────────────────────── questions CRUD ──────────────────────────── */
  const handleAddQuestion = () => { setEditingQuestion(null); setQuestionDialogOpen(true); };
  const handleEditQuestion = (q: SurveyQuestion) => { setEditingQuestion(q); setQuestionDialogOpen(true); };
  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('이 질문을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('survey_questions').delete().eq('id', id);
    if (error) { toast({ title: "삭제 실패", description: error.message, variant: "destructive" }); return; }
    toast({ title: "성공", description: "질문이 삭제되었습니다." });
    loadQuestions();
  };
  
  // 멀티 셀렉션 핸들러들
  const handleToggleMultiSelect = () => {
    setIsMultiSelectMode(!isMultiSelectMode);
    setSelectedQuestions(new Set());
  };
  
  const handleSelectQuestion = (questionId: string) => {
    const newSelected = new Set(selectedQuestions);
    if (newSelected.has(questionId)) {
      newSelected.delete(questionId);
    } else {
      newSelected.add(questionId);
    }
    setSelectedQuestions(newSelected);
  };
  
  const handleSelectAllQuestions = () => {
    if (selectedQuestions.size === questions.length) {
      setSelectedQuestions(new Set());
    } else {
      setSelectedQuestions(new Set(questions.map(q => q.id)));
    }
  };
  
  const handleBulkDeleteQuestions = async () => {
    if (selectedQuestions.size === 0) return;
    
    if (!confirm(`선택한 ${selectedQuestions.size}개의 질문을 삭제하시겠습니까?`)) return;
    
    try {
      const { error } = await supabase
        .from('survey_questions')
        .delete()
        .in('id', Array.from(selectedQuestions));
        
      if (error) throw error;
      
      toast({ title: "성공", description: `${selectedQuestions.size}개의 질문이 삭제되었습니다.` });
      setSelectedQuestions(new Set());
      setIsMultiSelectMode(false);
      loadQuestions();
    } catch (e: any) {
      toast({ title: "삭제 실패", description: e.message, variant: "destructive" });
    }
  };
  
  const handleQuestionSave = () => { setQuestionDialogOpen(false); loadQuestions(); };

  // 새로운 템플릿 적용 함수
  const handleApplySelectedTemplates = async () => {
    try {
      setLoadingTemplate(true);
      console.log('Applying selected templates:', templateSelections);
      
      const appliedSessions: string[] = [];
      
      for (const [sessionId, templateId] of Object.entries(templateSelections)) {
        if (templateId && templateId !== '' && templateId !== 'none') {
          await applyTemplateToSession(templateId, sessionId);
          const session = sessions.find(s => s.id === sessionId);
          appliedSessions.push(session?.course?.title || session?.session_name || '세션');
        }
      }
      
      // 템플릿 적용 후 질문과 섹션 다시 로드
      console.log('Reloading questions and sections after template application');
      await Promise.all([loadQuestions(), loadSections()]);
      console.log('Reload completed');
      
      setTemplateSelectOpen(false);
      setTemplateSelections({});
      
      toast({
        title: "템플릿 적용 완료",
        description: `${appliedSessions.length}개 과목에 템플릿이 적용되었습니다.`
      });
      
    } catch (error: any) {
      console.error('Template application error:', error);
      toast({
        title: "템플릿 적용 실패",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoadingTemplate(false);
    }
  };

  /* ───────────────────────────── sections CRUD ───────────────────────────── */
  const handleAddSection = () => { setSectionForm({ name: "", description: "" }); setEditingSection(null); setSectionDialogOpen(true); };
  const handleEditSection = (section: Section) => { setEditingSection(section); setSectionForm({ name: section.name, description: section.description || "" }); setSectionDialogOpen(true); };
  const handleSaveSection = async () => {
    if (!surveyId || !sectionForm.name.trim()) return;
    if (editingSection) {
      const { error } = await supabase.from('survey_sections').update({
        name: sectionForm.name, description: sectionForm.description || null
      }).eq('id', editingSection.id);
      if (error) { toast({ title: "수정 실패", description: error.message, variant: "destructive" }); return; }
      toast({ title: "성공", description: "섹션이 수정되었습니다." });
    } else {
      const { error } = await supabase.from('survey_sections').insert({
        survey_id: surveyId, name: sectionForm.name, description: sectionForm.description || null, order_index: sections.length
      });
      if (error) { toast({ title: "추가 실패", description: error.message, variant: "destructive" }); return; }
      toast({ title: "성공", description: "섹션이 추가되었습니다." });
    }
    setSectionDialogOpen(false);
    loadSections();
  };
  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('이 섹션을 삭제하시겠습니까? 섹션에 속한 질문들의 섹션 정보가 제거됩니다.')) return;
    await supabase.from('survey_questions').update({ section_id: null }).eq('section_id', sectionId);
    const { error } = await supabase.from('survey_sections').delete().eq('id', sectionId);
    if (error) { toast({ title: "삭제 실패", description: error.message, variant: "destructive" }); return; }
    toast({ title: "성공", description: "섹션이 삭제되었습니다." });
    loadSections(); loadQuestions();
  };

  /* ───────────────────────────── templates CRUD ──────────────────────────── */
  
  // 템플릿 타입 분석 함수
  const analyzeTemplateType = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return { type: 'unknown', template: null };

    const name = template.name.toLowerCase();
    
    // 강사 평가가 아닌 템플릿
    if (!template.is_course_evaluation) {
      return { type: 'non-instructor', template };
    }
    
    // 강사 평가 템플릿
    if (name.includes('이론') && name.includes('실습')) {
      return { type: 'theory-practice', template }; // 이론+실습 과정
    } else if (name.includes('이론')) {
      return { type: 'theory', template }; // 이론 과정
    } else if (name.includes('실습')) {
      return { type: 'practice', template }; // 실습 과정
    }
    
    return { type: 'instructor', template }; // 기본 강사 평가 템플릿
  };

  // 세션 분석 함수 - 강사가 같은지 다른지 판단
  const analyzeSessionInstructors = () => {
    if (sessions.length <= 1) return { hasSameInstructor: true, instructorCount: sessions.length };
    
    const instructorIds = sessions.map(s => s.instructor_id).filter(Boolean);
    const uniqueInstructorIds = [...new Set(instructorIds)];
    
    return {
      hasSameInstructor: uniqueInstructorIds.length <= 1,
      instructorCount: uniqueInstructorIds.length,
      instructors: uniqueInstructorIds
    };
  };

  const loadTemplateToSessions = async (templateId: string) => {
    if (!surveyId || sessions.length === 0) {
      toast({ title: "세션 정보 없음", description: "먼저 과목 세션을 추가해주세요.", variant: "destructive" });
      return;
    }
    
    setLoadingTemplate(true);
    try {
      const { type: templateType, template } = analyzeTemplateType(templateId);
      const sessionAnalysis = analyzeSessionInstructors();
      
      // 템플릿 질문과 섹션 가져오기
      const { data: tq } = await supabase
        .from('template_questions').select('*').eq('template_id', templateId).order('order_index');
      const { data: ts } = await supabase
        .from('template_sections').select('*').eq('template_id', templateId).order('order_index');

      // 기존 질문/섹션 삭제
      await supabase.from('survey_questions').delete().eq('survey_id', surveyId);
      await supabase.from('survey_sections').delete().eq('survey_id', surveyId);

      let appliedLogic = '';

      // 4가지 로직에 따른 처리
      if (templateType === 'non-instructor') {
        // 4. 강사 평가가 아닌 템플릿 - 전체 설문에 한 번만 적용
        appliedLogic = '강사 평가가 아닌 템플릿';
        await applyNonInstructorTemplate(tq, ts);
        
      } else if (templateType === 'theory') {
        // 1. 이론 과정 템플릿
        appliedLogic = '이론 과정 템플릿';
        await applyTheoryTemplate(tq, ts);
        
      } else if (templateType === 'practice') {
        // 2. 실습과정 템플릿 (이론과 실습 강사가 다른 경우)
        appliedLogic = '실습 과정 템플릿';
        await applyPracticeTemplate(tq, ts, sessionAnalysis);
        
      } else if (templateType === 'theory-practice') {
        // 3. 이론+실습 과정 템플릿 (강사가 같은 경우)
        appliedLogic = '이론+실습 과정 템플릿';
        await applyTheoryPracticeTemplate(tq, ts, sessionAnalysis);
        
      } else {
        // 기본 강사 평가 템플릿 - 세션별 적용
        appliedLogic = '기본 강사 평가 템플릿 (세션별)';
        await applyDefaultInstructorTemplate(tq, ts);
      }

      toast({ 
        title: "템플릿 적용 완료", 
        description: `${appliedLogic}이 적용되었습니다. (세션 ${sessions.length}개)` 
      });
      
      await loadQuestions(); 
      await loadSections();
    } catch (e: any) {
      console.error('Template application error:', e);
      toast({ title: "템플릿 적용 실패", description: e.message, variant: "destructive" });
    } finally {
      setLoadingTemplate(false);
    }
  };

  // 1. 이론 과정 템플릿 적용
  const applyTheoryTemplate = async (tq: any[], ts: any[]) => {
    for (const session of sessions) {
      const sectionMapping: Record<string, string> = {};
      
      // 이론 과정용 섹션 생성
      if (ts?.length) {
        for (const templateSection of ts) {
          const sectionName = `이론 - ${session.instructor?.name || '강사'} - ${session.course?.title || session.session_name} - ${templateSection.name}`;
          const { data: newSection } = await supabase
            .from('survey_sections')
            .insert({
              survey_id: surveyId,
              name: sectionName,
              description: templateSection.description,
              order_index: templateSection.order_index + (session.session_order * 100)
            })
            .select('*').single();
          if (newSection) {
            sectionMapping[templateSection.id] = newSection.id;
          }
        }
      }

      // 이론 과정용 질문 생성
      if (tq?.length) {
        const sessionQuestions = tq.map((q: any) => ({
          survey_id: surveyId,
          session_id: session.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options,
          is_required: q.is_required,
          order_index: q.order_index + (session.session_order * 100),
          section_id: q.section_id ? sectionMapping[q.section_id] ?? null : null,
          satisfaction_type: q.satisfaction_type ?? null,
          scope: 'session',
        }));
        
        await supabase.from('survey_questions').insert(sessionQuestions);
      }
    }
  };

  // 2. 실습과정 템플릿 적용 (이론과 실습 강사가 다른 경우)
  const applyPracticeTemplate = async (tq: any[], ts: any[], sessionAnalysis: any) => {
    // 실습 세션만 필터링 (세션명에 '실습'이 포함되거나 실습 관련 과목)
    const practiceSessions = sessions.filter(session => 
      session.session_name?.toLowerCase().includes('실습') || 
      session.course?.title?.toLowerCase().includes('실습')
    );

    const targetSessions = practiceSessions.length > 0 ? practiceSessions : sessions;

    for (const session of targetSessions) {
      const sectionMapping: Record<string, string> = {};
      
      if (ts?.length) {
        for (const templateSection of ts) {
          const sectionName = `실습 - ${session.instructor?.name || '강사'} - ${session.course?.title || session.session_name} - ${templateSection.name}`;
          const { data: newSection } = await supabase
            .from('survey_sections')
            .insert({
              survey_id: surveyId,
              name: sectionName,
              description: templateSection.description,
              order_index: templateSection.order_index + (session.session_order * 100)
            })
            .select('*').single();
          if (newSection) {
            sectionMapping[templateSection.id] = newSection.id;
          }
        }
      }

      if (tq?.length) {
        const sessionQuestions = tq.map((q: any) => ({
          survey_id: surveyId,
          session_id: session.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options,
          is_required: q.is_required,
          order_index: q.order_index + (session.session_order * 100),
          section_id: q.section_id ? sectionMapping[q.section_id] ?? null : null,
          satisfaction_type: q.satisfaction_type ?? null,
          scope: 'session',
        }));
        
        await supabase.from('survey_questions').insert(sessionQuestions);
      }
    }
  };

  // 3. 이론+실습 과정 템플릿 적용 (강사가 같은 경우)
  const applyTheoryPracticeTemplate = async (tq: any[], ts: any[], sessionAnalysis: any) => {
    if (sessionAnalysis.hasSameInstructor) {
      // 강사가 같은 경우 - 통합 평가
      const firstSession = sessions[0];
      const sectionMapping: Record<string, string> = {};
      
      if (ts?.length) {
        for (const templateSection of ts) {
          const sectionName = `이론+실습 - ${firstSession.instructor?.name || '강사'} - ${templateSection.name}`;
          const { data: newSection } = await supabase
            .from('survey_sections')
            .insert({
              survey_id: surveyId,
              name: sectionName,
              description: templateSection.description,
              order_index: templateSection.order_index
            })
            .select('*').single();
          if (newSection) {
            sectionMapping[templateSection.id] = newSection.id;
          }
        }
      }

      if (tq?.length) {
        const questions = tq.map((q: any) => ({
          survey_id: surveyId,
          session_id: null, // 전체 설문 질문
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options,
          is_required: q.is_required,
          order_index: q.order_index,
          section_id: q.section_id ? sectionMapping[q.section_id] ?? null : null,
          satisfaction_type: q.satisfaction_type ?? null,
          scope: 'operation', // 전체 설문
        }));
        
        await supabase.from('survey_questions').insert(questions);
      }
    } else {
      // 강사가 다른 경우 - 세션별 적용
      await applyDefaultInstructorTemplate(tq, ts);
    }
  };

  // 4. 강사 평가가 아닌 템플릿 적용
  const applyNonInstructorTemplate = async (tq: any[], ts: any[]) => {
    const sectionMapping: Record<string, string> = {};
    
    // 전체 설문용 섹션 생성
    if (ts?.length) {
      for (const templateSection of ts) {
        const { data: newSection } = await supabase
          .from('survey_sections')
          .insert({
            survey_id: surveyId,
            name: templateSection.name,
            description: templateSection.description,
            order_index: templateSection.order_index
          })
          .select('*').single();
        if (newSection) {
          sectionMapping[templateSection.id] = newSection.id;
        }
      }
    }

    // 전체 설문용 질문 생성
    if (tq?.length) {
      const questions = tq.map((q: any) => ({
        survey_id: surveyId,
        session_id: null, // 전체 설문 질문
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        is_required: q.is_required,
        order_index: q.order_index,
        section_id: q.section_id ? sectionMapping[q.section_id] ?? null : null,
        satisfaction_type: q.satisfaction_type ?? null,
        scope: 'operation', // 전체 설문
      }));
      
      await supabase.from('survey_questions').insert(questions);
    }
  };

  // 기본 강사 평가 템플릿 적용 (세션별)
  const applyDefaultInstructorTemplate = async (tq: any[], ts: any[]) => {
    for (const session of sessions) {
      const sectionMapping: Record<string, string> = {};
      
      if (ts?.length) {
        for (const templateSection of ts) {
          const sectionName = `${session.instructor?.name || '강사'} - ${session.course?.title || session.session_name} - ${templateSection.name}`;
          const { data: newSection } = await supabase
            .from('survey_sections')
            .insert({
              survey_id: surveyId,
              name: sectionName,
              description: templateSection.description,
              order_index: templateSection.order_index + (session.session_order * 100)
            })
            .select('*').single();
          if (newSection) {
            sectionMapping[templateSection.id] = newSection.id;
          }
        }
      }

      if (tq?.length) {
        const sessionQuestions = tq.map((q: any) => ({
          survey_id: surveyId,
          session_id: session.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options,
          is_required: q.is_required,
          order_index: q.order_index + (session.session_order * 100),
          section_id: q.section_id ? sectionMapping[q.section_id] ?? null : null,
          satisfaction_type: q.satisfaction_type ?? null,
          scope: 'session',
        }));
        
        await supabase.from('survey_questions').insert(sessionQuestions);
      }
    }
  };

  // 특정 세션에만 템플릿 적용
  const applyTemplateToSession = async (templateId: string, sessionId: string) => {
    try {
      setLoadingTemplate(true);
      console.log('Applying template to session:', { templateId, sessionId });
      
      // 선택된 세션 찾기
      const targetSession = sessions.find(s => s.id === sessionId);
      if (!targetSession) {
        toast({ title: "오류", description: "세션을 찾을 수 없습니다.", variant: "destructive" });
        return;
      }

      // 기존 전체 질문의 최대 order_index 구하기 (겹치지 않도록)
      const { data: allQuestions } = await supabase
        .from('survey_questions')
        .select('order_index')
        .eq('survey_id', surveyId!);
      
      const maxOrderIndex = allQuestions?.length 
        ? Math.max(...allQuestions.map(q => q.order_index || 0))
        : 0;

      console.log('Max existing order_index:', maxOrderIndex);

      // 템플릿 질문과 섹션 가져오기 (template_questions, template_sections 테이블에서)
      const { data: tq } = await supabase
        .from('template_questions')
        .select('*')
        .eq('template_id', templateId)
        .order('order_index');

      const { data: ts } = await supabase
        .from('template_sections')
        .select('*')
        .eq('template_id', templateId)
        .order('order_index');

      console.log('Template questions:', tq?.length, 'Template sections:', ts?.length);

      const sectionMapping: Record<string, string> = {};
      
      // 섹션 생성 (기존 순서 뒤에 추가)
      if (ts?.length) {
        for (const templateSection of ts) {
          const sectionName = `${targetSession.instructor?.name || '강사'} - ${targetSession.course?.title || targetSession.session_name} - ${templateSection.name}`;
          const { data: newSection } = await supabase
            .from('survey_sections')
            .insert({
              survey_id: surveyId,
              name: sectionName,
              description: templateSection.description,
              order_index: maxOrderIndex + templateSection.order_index + 1
            })
            .select('*').single();
          if (newSection) {
            sectionMapping[templateSection.id] = newSection.id;
            console.log('Created section:', newSection.name, 'with order_index:', newSection.order_index);
          }
        }
      }

      // 질문 생성 (기존 순서 뒤에 추가)
      if (tq?.length) {
        const sessionQuestions = tq.map((q: any) => ({
          survey_id: surveyId,
          session_id: sessionId,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options,
          is_required: q.is_required,
          order_index: maxOrderIndex + q.order_index + 1,
          section_id: q.section_id ? sectionMapping[q.section_id] ?? null : null,
          satisfaction_type: q.satisfaction_type ?? null,
          scope: 'session',
        }));
        
        console.log('Inserting questions with order_index range:', 
          Math.min(...sessionQuestions.map(q => q.order_index)), 
          'to', 
          Math.max(...sessionQuestions.map(q => q.order_index))
        );
        
        const { error } = await supabase.from('survey_questions').insert(sessionQuestions);
        if (error) {
          console.error('Question insert error:', error);
          throw error;
        }
        
        console.log('Successfully inserted', sessionQuestions.length, 'questions');
      }

      toast({ 
        title: "템플릿 적용 완료", 
        description: `${targetSession.instructor?.name || '강사'} - ${targetSession.course?.title || targetSession.session_name}에 템플릿이 적용되었습니다.` 
      });
    } catch (e: any) {
      console.error('Session template application error:', e);
      toast({ title: "템플릿 적용 실패", description: e.message, variant: "destructive" });
    } finally {
      setLoadingTemplate(false);
    }
  };

  /* ───────────────────────────── course names CRUD ───────────────────────── */
  const handleCreateCourseName = async () => {
    const name = newCourseName.trim(); if (!name) return;
    const { error } = await supabase.from("course_names").insert([{ name }]);
    if (error) { toast({ title: "추가 실패", description: error.message, variant: "destructive" }); return; }
    setNewCourseName(""); await loadCourseNames(); toast({ title: "과정명 추가", description: `"${name}" 추가됨` });
  };
  const handleRenameCourseName = async () => {
    if (!editRow) return; const newName = editRow.name.trim(); if (!newName) return;
    const old = courseNames.find(c => c.id === editRow.id)?.name || "";
    const { error: e1 } = await supabase.from("course_names").update({ name: newName }).eq("id", editRow.id);
    if (e1) { toast({ title: "변경 실패", description: e1.message, variant: "destructive" }); return; }
    const { error: e2 } = await supabase.from("surveys").update({ course_name: newName }).eq("course_name", old);
    if (e2) { toast({ title: "변경 실패", description: e2.message, variant: "destructive" }); return; }
    setEditRow(null); await loadCourseNames(); if (courseName === old) setCourseName(newName);
    toast({ title: "과정명 변경", description: `"${old}" → "${newName}"` });
  };
  const handleDeleteCourseName = async (id: string) => {
    const target = courseNames.find(c => c.id === id); if (!target) return;
    if (!confirm(`"${target.name}" 과정을 목록에서 삭제할까요? (기존 설문에는 영향 없습니다)`)) return;
    const { error } = await supabase.from("course_names").delete().eq("id", id);
    if (error) { toast({ title: "삭제 실패", description: error.message, variant: "destructive" }); return; }
    await loadCourseNames(); toast({ title: "삭제 완료", description: `"${target.name}" 삭제됨` });
  };

  /* ───────────────────────────── actions (header) ────────────────────────── */
  const desktopActions = [
    <Button key="back" variant="outline" size="sm" className="rounded-full px-3" onClick={() => navigate(-1)}>
      <ArrowLeft className="w-4 h-4 mr-1.5" /> 뒤로
    </Button>,
    <Button
      key="tpl"
      variant="outline"
      size="sm"
      className="rounded-full px-3"
      onClick={() => {
        setSelectedSessionId(null);
        setTemplateSelectOpen(true);
      }}
      disabled={loading || !survey}
    >
      <Plus className="w-4 h-4 mr-1.5" /> 템플릿 불러오기
    </Button>,
    <Button
      key="sec"
      variant="outline"
      size="sm"
      className="rounded-full px-3"
      onClick={handleAddSection}
      disabled={loading || !survey}
    >
      <Plus className="w-4 h-4 mr-1.5" /> 섹션 추가
    </Button>,
    <Button
      key="q"
      size="sm"
      className="rounded-full px-3"
      onClick={handleAddQuestion}
      disabled={loading || !survey}
    >
      <Plus className="w-4 h-4 mr-1.5" /> 질문 추가
    </Button>,
  ];

  const mobileActions = [
    <Button key="back-m" variant="outline" size="sm" className="rounded-full" onClick={() => navigate(-1)}>
      <ArrowLeft className="w-4 h-4" />
    </Button>,
    <Button key="save-m" size="sm" className="rounded-full" onClick={saveBasic} disabled={saving || loading || !survey}>
      <Save className="w-4 h-4" />
    </Button>,
    <Button key="tpl-m" variant="outline" size="sm" className="rounded-full" onClick={() => {
      setSelectedSessionId(null);
      setTemplateSelectOpen(true);
    }} disabled={loading || !survey}>
      <Plus className="w-4 h-4" />
    </Button>,
    <Button key="sec-m" variant="outline" size="sm" className="rounded-full" onClick={handleAddSection} disabled={loading || !survey}>
      <Plus className="w-4 h-4" />
    </Button>,
    <Button key="q-m" size="sm" className="rounded-full" onClick={handleAddQuestion} disabled={loading || !survey}>
      <Plus className="w-4 h-4" />
    </Button>,
  ];

  /* ─────────────────────────────── render ──────────────────────────────── */
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + 1 - i);

  const statusActionButtons = (() => {
    switch (currentWorkflowStatus) {
      case "draft":
        return (
          <>
            <Button
              variant="outline"
              onClick={handleOpenReviewChecklist}
              disabled={statusUpdating || loading || !survey}
              className="rounded-full"
            >
              <ClipboardCheck className="w-4 h-4 mr-2" /> 검수 요청하기
            </Button>
            <Button
              variant="ghost"
              onClick={handleRunValidation}
              disabled={loading}
              className="rounded-full"
            >
              <AlertCircle className="w-4 h-4 mr-2" /> 배포 전 점검
            </Button>
          </>
        );
      case "review_requested":
        return (
          <>
            <Button
              onClick={handleOpenDeployChecklist}
              disabled={statusUpdating || loading || !survey}
              className="rounded-full"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> 배포하기
            </Button>
            <Button
              variant="outline"
              onClick={handleReturnToDraft}
              disabled={statusUpdating || !survey}
              className="rounded-full"
            >
              <RefreshCcw className="w-4 h-4 mr-2" /> 초안으로 되돌리기
            </Button>
          </>
        );
      case "deployed":
        return (
          <>
            <Button
              onClick={() => setPostDeployDialogOpen(true)}
              disabled={statusUpdating}
              className="rounded-full"
            >
              <BellRing className="w-4 h-4 mr-2" /> 후속 조치 보기
            </Button>
            <Button
              variant="outline"
              onClick={handleReturnToDraft}
              disabled={statusUpdating || !survey}
              className="rounded-full"
            >
              <RefreshCcw className="w-4 h-4 mr-2" /> 수정 재요청
            </Button>
          </>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">설문 편집</h1>
        <div className="flex gap-2">
          {desktopActions.map((action, index) => (
            <div key={index}>{action}</div>
          ))}
        </div>
      </div>
      {/* ✅ AdminLayout이 padding/컨테이너를 제공하므로 내부는 바로 내용 */}
      {!survey && !loading ? (
        <div className="py-10 text-sm text-muted-foreground">해당 설문을 찾을 수 없습니다.</div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border bg-muted/40 p-4 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="uppercase tracking-wide text-xs">
                    {STATUS_META[currentWorkflowStatus].label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {survey?.status ? `DB: ${survey.status}` : "초안 상태"}
                  </span>
                </div>
                <h2 className="text-xl font-semibold">설문 상태 진행 현황</h2>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  {STATUS_META[currentWorkflowStatus].description}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {statusActionButtons}
              </div>
            </div>
            <Separator className="my-4" />
            <div className="grid gap-4 sm:grid-cols-3">
              {STATUS_FLOW.map((step, index) => {
                const meta = STATUS_META[step];
                const isCompleted = index < statusStepIndex;
                const isActive = index === statusStepIndex;
                return (
                  <div
                    key={step}
                    className={`flex items-start gap-3 rounded-xl border bg-background/80 p-3 ${
                      isActive ? 'border-primary/60 shadow-sm' : 'border-border'
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold ${
                        isActive || isCompleted
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
                    </div>
                    <div className="space-y-1">
                      <div className={`text-sm font-semibold ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {meta.label}
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {meta.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {deploymentWarnings.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>배포 전 확인이 필요한 항목이 있습니다.</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {deploymentWarnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleRunValidation} className="rounded-full">
                    <RefreshCcw className="mr-1.5 h-4 w-4" /> 다시 점검
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleDismissWarnings} className="rounded-full">
                    경고 숨기기
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* 기본 정보 */}
          <Card>
            <CardHeader><CardTitle className="text-2xl">기본 정보</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>과정명</Label>
                  <div className="flex gap-2">
                    <SearchableSelect
                      options={courseNames.map((c) => ({ value: c.name, label: c.name }))}
                      value={courseName || ""}
                      onValueChange={setCourseName}
                      placeholder="과정명을 선택하세요"
                      searchPlaceholder="과정명 검색..."
                      emptyText="검색 결과가 없습니다."
                      className="flex-1"
                    />
                    <Button variant="outline" onClick={() => setCourseMgrOpen(true)}>
                      <Settings className="w-4 h-4 mr-1" />관리
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>교육 연도</Label>
                  <Select value={String(educationYear)} onValueChange={(v) => setEducationYear(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{years.map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}</SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>차수</Label>
                  <Input type="number" min={1} value={educationRound} onChange={(e) => setEducationRound(parseInt(e.target.value || "1"))} />
                </div>

                <div className="space-y-2">
                  <Label>일차</Label>
                  <Input type="number" min={1} value={educationDay} onChange={(e) => setEducationDay(parseInt(e.target.value || "1"))} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      id="is_final_survey"
                      type="checkbox"
                      checked={isFinalSurvey}
                      onChange={(e) => setIsFinalSurvey(e.target.checked)}
                      className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary"
                    />
                    <Label htmlFor="is_final_survey" className="text-sm font-medium">
                      종료 설문 (마지막 날 설문)
                    </Label>
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>제목 (자동)</Label>
                  <Input value={title} readOnly />
                </div>

                <div className="space-y-2">
                  <Label>시작일시</Label>
                  <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>종료일시</Label>
                  <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>설명</Label>
                  <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>

              {/* 분반 설정 (영업 BS 집체교육일 때) */}
              {courseName === "영업 BS 집체교육" && (
                <Card className="border-blue-200 bg-blue-50/50 mt-4">
                  <CardHeader>
                    <CardTitle className="text-sm text-blue-800">분반 설정</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <input
                        id="is_grouped"
                        type="checkbox"
                        className="h-4 w-4 text-blue-600"
                        checked={isGrouped}
                        onChange={(e) => setIsGrouped(e.target.checked)}
                      />
                      <Label htmlFor="is_grouped" className="text-sm font-medium">
                        분반으로 운영 (조별 설문)
                      </Label>
                    </div>

                    {isGrouped && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>분반 유형</Label>
                          <select 
                            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                            value={groupType}
                            onChange={(e) => setGroupType(e.target.value)}
                          >
                            <option value="">선택하세요</option>
                            <option value="even">짝수조</option>
                            <option value="odd">홀수조</option>
                          </select>
                        </div>
                        <div>
                          <Label>조 번호</Label>
                          <Input
                            type="number"
                            min="1"
                            max="99"
                            value={groupNumber || ""}
                            onChange={(e) => setGroupNumber(Number(e.target.value) || null)}
                            placeholder="조 번호 (예: 11, 12)"
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end">
                <Button onClick={saveBasic} disabled={saving || loading || !survey}>
                  <Save className="w-4 h-4 mr-2" />기본 정보 저장
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 🔷 세션(과목/강사) 관리 */}
          {survey && (
            <SessionManager
              surveyId={survey.id}
              sessions={sessions}
              courses={courses}
              instructors={instructors}
              onSessionsChange={(next) => setSessions(next)}
            />
          )}

          {/* 질문 관리 */}
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold">질문 관리</h2>
                  <p className="text-muted-foreground">설문 질문을 추가하고 관리하세요</p>
                </div>
                <div className="hidden md:flex gap-2">
                  <Button variant="outline" onClick={() => {
                    setSelectedSessionId(null);
                    setTemplateSelectOpen(true);
                  }}>
                    <Plus className="w-4 h-4 mr-2" />템플릿 불러오기
                  </Button>
                  <Button variant="outline" onClick={handleAddSection}>
                    <Plus className="w-4 h-4 mr-2" />섹션 추가
                  </Button>
                  <Button onClick={handleAddQuestion}>
                    <Plus className="w-4 h-4 mr-2" />질문 추가
                  </Button>
                  <Button 
                    variant={isMultiSelectMode ? "default" : "outline"} 
                    onClick={handleToggleMultiSelect}
                  >
                    {isMultiSelectMode ? (
                      <>
                        <CheckSquare className="w-4 h-4 mr-2" />선택 완료
                      </>
                    ) : (
                      <>
                        <Square className="w-4 h-4 mr-2" />다중 선택
                      </>
                    )}
                  </Button>
                </div>
                <div className="md:hidden">
                  <Button variant="outline" size="icon" onClick={() => {
                    setSelectedSessionId(null);
                    setTemplateSelectOpen(true);
                  }} className="mr-2">
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleAddSection} className="mr-2">
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button size="icon" onClick={handleAddQuestion}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* 플로팅 액션 바 */}
              {isMultiSelectMode && selectedQuestions.size > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
                  <div className="bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-lg border flex items-center gap-4">
                    <span className="font-medium">{selectedQuestions.size}개 선택됨</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedQuestions(new Set());
                          setIsMultiSelectMode(false);
                        }}
                        className="rounded-full"
                      >
                        취소
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBulkDeleteQuestions}
                        className="rounded-full"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        삭제
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* 다중 선택 모드일 때 컨트롤 바 */}
              {isMultiSelectMode && questions.length > 0 && (
                <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAllQuestions}
                      >
                        {selectedQuestions.size === questions.length ? "전체 해제" : "전체 선택"}
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {selectedQuestions.size}개 선택됨
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {sections.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">질문 섹션</h3>
                  <div className="space-y-2">
                    {sections.map((section) => (
                      <div key={section.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <h4 className="font-medium">{section.name}</h4>
                          {section.description && <p className="text-sm text-muted-foreground">{section.description}</p>}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditSection(section)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDeleteSection(section.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {questions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="text-4xl mb-2">📝</div>
                  <p>아직 질문이 없습니다</p>
                  <p className="text-sm mt-1">과목 세션을 추가한 후 템플릿을 불러와 주세요</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 세션별로 그룹화하여 표시 */}
                  {sessions.map((session) => {
                    const sessionQuestions = questions.filter(q => 
                      q.scope === 'session' && 
                      (q as any).session_id === session.id
                    );
                    const sessionSections = sections.filter(s => 
                      sessionQuestions.some(q => q.section_id === s.id)
                    );
                    
                    if (sessionQuestions.length === 0) return null;
                    
                    return (
                      <div key={session.id} className="border-2 border-dashed border-muted rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                            {session.session_order + 1}
                          </div>
                          <div>
                            <h4 className="font-semibold text-lg">
                              {session.instructor?.name} - {session.course?.title || session.session_name}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {sessionQuestions.length}개 질문
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full px-3"
                          onClick={() => {
                            setSelectedSessionId(session.id);
                            setTemplateSelectOpen(true);
                          }}
                          disabled={loading}
                        >
                          <Plus className="w-4 h-4 mr-1.5" /> 템플릿 추가
                        </Button>
                      </div>
                        
                        {/* 섹션별 질문들 */}
                        {sessionSections.map((section) => {
                          const sectionQuestions = sessionQuestions.filter(q => q.section_id === section.id);
                          return (
                            <div key={section.id} className="mb-4">
                              <h5 className="font-medium text-muted-foreground mb-2 text-sm">
                                📁 {section.name}
                              </h5>
                              <div className="space-y-2 ml-4">
                                 {sectionQuestions.map((q, idx) => (
                                   <div key={q.id} className={`border rounded-lg p-3 relative bg-background ${selectedQuestions.has(q.id) ? 'ring-2 ring-primary' : ''}`}>
                                     {isMultiSelectMode && (
                                       <div className="absolute left-2 top-2 z-10">
                                         <Button
                                           variant="ghost"
                                           size="sm"
                                           className="h-6 w-6 p-0"
                                           onClick={() => handleSelectQuestion(q.id)}
                                         >
                                           {selectedQuestions.has(q.id) ? (
                                             <CheckSquare className="h-4 w-4 text-primary" />
                                           ) : (
                                             <Square className="h-4 w-4" />
                                           )}
                                         </Button>
                                       </div>
                                     )}
                                     <div className={`absolute ${isMultiSelectMode ? 'left-8' : 'left-3'} top-3 flex items-center justify-center w-5 h-5 bg-secondary text-xs font-bold rounded-full`}>
                                       {idx + 1}
                                     </div>
                                     <div className="absolute top-3 right-3 flex gap-1">
                                       <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleEditQuestion(q)}>
                                         <Edit className="h-3 w-3" />
                                       </Button>
                                       {!isMultiSelectMode && (
                                         <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700" onClick={() => handleDeleteQuestion(q.id)}>
                                           <Trash2 className="h-3 w-3" />
                                         </Button>
                                       )}
                                     </div>
                                     <div className={`${isMultiSelectMode ? 'ml-11' : 'ml-6'} mr-12`}>
                                       <p className="text-sm font-medium">
                                         {q.question_text}{q.is_required && <span className="text-red-500 ml-1">*</span>}
                                       </p>
                                       <div className="text-xs text-muted-foreground mt-1">
                                         유형: {q.question_type}
                                         {q.satisfaction_type ? ` • 만족도: ${q.satisfaction_type}` : ""}
                                       </div>
                                     </div>
                                   </div>
                                 ))}
                              </div>
                            </div>
                          );
                        })}
                        
                         {/* 섹션 없는 질문들 */}
                         {sessionQuestions.filter(q => !q.section_id).map((q, idx) => (
                           <div key={q.id} className={`border rounded-lg p-3 relative bg-background ${selectedQuestions.has(q.id) ? 'ring-2 ring-primary' : ''}`}>
                             {isMultiSelectMode && (
                               <div className="absolute left-2 top-2 z-10">
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   className="h-6 w-6 p-0"
                                   onClick={() => handleSelectQuestion(q.id)}
                                 >
                                   {selectedQuestions.has(q.id) ? (
                                     <CheckSquare className="h-4 w-4 text-primary" />
                                   ) : (
                                     <Square className="h-4 w-4" />
                                   )}
                                 </Button>
                               </div>
                             )}
                             <div className={`absolute ${isMultiSelectMode ? 'left-8' : 'left-3'} top-3 flex items-center justify-center w-5 h-5 bg-secondary text-xs font-bold rounded-full`}>
                               {idx + 1}
                             </div>
                             <div className="absolute top-3 right-3 flex gap-1">
                               <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleEditQuestion(q)}>
                                 <Edit className="h-3 w-3" />
                               </Button>
                               {!isMultiSelectMode && (
                                 <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700" onClick={() => handleDeleteQuestion(q.id)}>
                                   <Trash2 className="h-3 w-3" />
                                 </Button>
                               )}
                             </div>
                             <div className={`${isMultiSelectMode ? 'ml-11' : 'ml-6'} mr-12`}>
                               <p className="text-sm font-medium">
                                 {q.question_text}{q.is_required && <span className="text-red-500 ml-1">*</span>}
                               </p>
                               <div className="text-xs text-muted-foreground mt-1">
                                 유형: {q.question_type}
                                 {q.satisfaction_type ? ` • 만족도: ${q.satisfaction_type}` : ""}
                               </div>
                             </div>
                           </div>
                         ))}
                      </div>
                    );
                  })}
                  
                  {/* 공통 질문들 (scope: operation) */}
                  {questions.filter(q => q.scope === 'operation').length > 0 && (
                    <div className="border-2 border-dashed border-orange-200 rounded-lg p-4">
                      <h4 className="font-semibold text-lg mb-4 text-orange-700">
                        🔄 공통 질문 (전체 설문에 1회만 표시)
                      </h4>
                       <div className="space-y-2">
                         {questions.filter(q => q.scope === 'operation').map((q, idx) => (
                           <div key={q.id} className={`border rounded-lg p-3 relative bg-orange-50 ${selectedQuestions.has(q.id) ? 'ring-2 ring-primary' : ''}`}>
                             {isMultiSelectMode && (
                               <div className="absolute left-2 top-2 z-10">
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   className="h-6 w-6 p-0"
                                   onClick={() => handleSelectQuestion(q.id)}
                                 >
                                   {selectedQuestions.has(q.id) ? (
                                     <CheckSquare className="h-4 w-4 text-primary" />
                                   ) : (
                                     <Square className="h-4 w-4" />
                                   )}
                                 </Button>
                               </div>
                             )}
                             <div className={`absolute ${isMultiSelectMode ? 'left-8' : 'left-3'} top-3 flex items-center justify-center w-5 h-5 bg-orange-500 text-white text-xs font-bold rounded-full`}>
                               {idx + 1}
                             </div>
                             <div className="absolute top-3 right-3 flex gap-1">
                               <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleEditQuestion(q)}>
                                 <Edit className="h-3 w-3" />
                               </Button>
                               {!isMultiSelectMode && (
                                 <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700" onClick={() => handleDeleteQuestion(q.id)}>
                                   <Trash2 className="h-3 w-3" />
                                 </Button>
                               )}
                             </div>
                             <div className={`${isMultiSelectMode ? 'ml-11' : 'ml-6'} mr-12`}>
                               <p className="text-sm font-medium">
                                 {q.question_text}{q.is_required && <span className="text-red-500 ml-1">*</span>}
                               </p>
                               <div className="text-xs text-muted-foreground mt-1">
                                 유형: {q.question_type}
                                 {q.satisfaction_type ? ` • 만족도: ${q.satisfaction_type}` : ""}
                               </div>
                             </div>
                           </div>
                         ))}
                       </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 플로팅 액션 바 (멀티 셀렉트 모드에서만 표시) */}
          {isMultiSelectMode && (
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {selectedQuestions.size}개 선택됨
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsMultiSelectMode(false);
                    setSelectedQuestions(new Set());
                  }}
                >
                  취소
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDeleteQuestions}
                  disabled={selectedQuestions.size === 0}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  삭제 ({selectedQuestions.size})
                </Button>
              </div>
            </div>
          )}

          {/* 상태 체크리스트 다이얼로그 */}
          <Dialog open={statusChecklistOpen} onOpenChange={handleChecklistOpenChange}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{checklistContext === "review" ? "검수 요청 체크리스트" : "배포 체크리스트"}</DialogTitle>
                <DialogDescription>
                  {checklistContext === "review"
                    ? "검수 요청 전에 아래 항목을 모두 확인했는지 점검하세요."
                    : "배포 전 필수 항목을 체크하면 바로 배포 상태로 전환됩니다."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {(checklistContext === "review" ? REVIEW_CHECKLIST : DEPLOY_CHECKLIST).map((item) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3"
                    htmlFor={`check-${item.id}`}
                  >
                    <Checkbox
                      id={`check-${item.id}`}
                      checked={!!checklistState[item.id]}
                      onCheckedChange={(checked) => handleChecklistToggle(item.id, Boolean(checked))}
                    />
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{item.label}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              {checklistError && <p className="text-sm text-destructive">{checklistError}</p>}
              <DialogFooter className="gap-2">
                {checklistContext === "deploy" && (
                  <Button variant="ghost" onClick={handleOpenPreview} className="rounded-full">
                    <ExternalLink className="mr-2 h-4 w-4" /> 미리보기 열기
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => handleChecklistOpenChange(false)}
                  className="rounded-full"
                >
                  취소
                </Button>
                <Button onClick={handleChecklistConfirm} disabled={statusUpdating} className="rounded-full">
                  {statusUpdating
                    ? "처리 중..."
                    : checklistContext === "review"
                      ? "검수 요청 보내기"
                      : "배포 진행"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 배포 후 후속 조치 다이얼로그 */}
          <Dialog open={postDeployDialogOpen} onOpenChange={setPostDeployDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>배포 완료! 다음 단계를 진행하세요</DialogTitle>
                <DialogDescription>
                  담당자에게 배포 사실을 안내하고 필요한 후속 작업을 이어갈 수 있습니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="notification-email">담당자 이메일</Label>
                  <Input
                    id="notification-email"
                    type="email"
                    value={notificationEmail}
                    onChange={(e) => setNotificationEmail(e.target.value)}
                    placeholder="담당자 이메일을 입력하세요"
                  />
                  <p className="text-xs text-muted-foreground">
                    메일 작성 버튼을 클릭하면 기본 메일 앱이 열립니다.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button onClick={handleSendDeploymentEmail} className="rounded-full">
                    <Mail className="mr-2 h-4 w-4" /> 메일 작성
                  </Button>
                  <Button variant="outline" onClick={handleCopyPreviewLink} className="rounded-full">
                    <ClipboardCheck className="mr-2 h-4 w-4" /> 미리보기 링크 복사
                  </Button>
                  <Button variant="outline" onClick={handleOpenPreview} className="rounded-full">
                    <ExternalLink className="mr-2 h-4 w-4" /> 설문 미리보기
                  </Button>
                  <Button variant="ghost" onClick={handleGoToManagement} className="rounded-full">
                    <LayoutDashboard className="mr-2 h-4 w-4" /> 설문 관리로 이동
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPostDeployDialogOpen(false)} className="rounded-full">
                  닫기
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 질문 추가/편집 다이얼로그 */}
          <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingQuestion ? "질문 수정" : "질문 추가"}</DialogTitle></DialogHeader>
              <QuestionEditForm
                question={editingQuestion}
                surveyId={surveyId!}
                onSave={handleQuestionSave}
                onCancel={() => setQuestionDialogOpen(false)}
                sections={sections}
                sessions={sessions}
              />
            </DialogContent>
          </Dialog>

          {/* 템플릿 선택 다이얼로그 */}
          <Dialog open={templateSelectOpen} onOpenChange={setTemplateSelectOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>템플릿 적용</DialogTitle>
                <DialogDescription>
                  각 과목별로 적용할 템플릿을 선택하세요. 선택하지 않은 과목은 템플릿이 적용되지 않습니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {templates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    사용 가능한 템플릿이 없습니다.
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    과목/강사 정보가 없습니다. 먼저 과목과 강사를 추가해주세요.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-3">
                      {sessions.map((session) => (
                        <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium">
                              {session.course?.title || session.session_name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              강사: {session.instructor?.name || '강사명 없음'}
                            </div>
                          </div>
                          <div className="flex-shrink-0 w-48">
                            <SearchableSelect
                              options={[
                                { value: 'none', label: '선택 안함' },
                                ...templates.map((template) => ({ value: template.id, label: template.name }))
                              ]}
                              value={templateSelections[session.id] || ''}
                              onValueChange={(value) => {
                                setTemplateSelections(prev => ({
                                  ...prev,
                                  [session.id]: value
                                }));
                              }}
                              placeholder="템플릿 선택"
                              searchPlaceholder="템플릿 검색..."
                              emptyText="검색 결과가 없습니다."
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                      💡 팁: 템플릿을 적용하면 해당 과목에 새로운 질문들이 추가됩니다. 기존 질문은 유지됩니다.
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => {
                  setTemplateSelectOpen(false);
                  setTemplateSelections({});
                }}>
                  취소
                </Button>
                <Button 
                  onClick={handleApplySelectedTemplates}
                  disabled={Object.values(templateSelections).every(v => !v || v === 'none') || loadingTemplate}
                >
                  {loadingTemplate ? '적용 중...' : '템플릿 적용'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 섹션 추가/편집 다이얼로그 */}
          <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{editingSection ? "섹션 수정" : "섹션 추가"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="section-name">섹션 이름</Label>
                  <Input id="section-name" value={sectionForm.name}
                        onChange={(e) => setSectionForm(prev => ({ ...prev, name: e.target.value }))} placeholder="섹션 이름을 입력하세요" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="section-description">설명 (선택사항)</Label>
                  <Textarea id="section-description" rows={3} value={sectionForm.description}
                            onChange={(e) => setSectionForm(prev => ({ ...prev, description: e.target.value }))} placeholder="섹션 설명을 입력하세요" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSectionDialogOpen(false)}>취소</Button>
                <Button onClick={handleSaveSection} disabled={!sectionForm.name.trim()}>{editingSection ? "수정" : "추가"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 과정명 관리 다이얼로그 */}
          <Dialog open={courseMgrOpen} onOpenChange={setCourseMgrOpen}>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>과정명 관리</DialogTitle>
                <DialogDescription>과정명은 설문 제목 자동생성과 목록 필터에 사용됩니다. 이름 변경 시 기존 설문들의 과정명도 함께 업데이트됩니다.</DialogDescription>
              </DialogHeader>

              <div className="flex gap-2">
                <Input placeholder="새 과정명 입력" value={newCourseName}
                      onChange={(e) => setNewCourseName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateCourseName()} />
                <Button onClick={handleCreateCourseName}><Plus className="w-4 h-4 mr-1" />추가</Button>
              </div>

              <Separator className="my-3" />

              <div className="space-y-2 max-h-80 overflow-auto">
                {courseNames.length === 0 ? (
                  <div className="text-sm text-muted-foreground">등록된 과정명이 없습니다.</div>
                ) : (
                  courseNames.map((c) => {
                    const isEditing = editRow?.id === c.id;
                    return (
                      <div key={c.id} className="flex items-center justify-between gap-3 border rounded-md p-2">
                        {isEditing ? (
                          <Input value={editRow!.name}
                                onChange={(e) => setEditRow({ ...editRow!, name: e.target.value })}
                                onKeyDown={(e) => { if (e.key === "Enter") handleRenameCourseName(); if (e.key === "Escape") setEditRow(null); }} />
                        ) : (<div className="font-medium">{c.name}</div>)}
                        <div className="flex gap-2">
                          {isEditing ? (
                            <>
                              <Button size="sm" onClick={handleRenameCourseName}>변경</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditRow(null)}>취소</Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => setEditRow({ id: c.id, name: c.name })}>
                                <Pencil className="w-4 h-4 mr-1" />이름변경
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleDeleteCourseName(c.id)}>
                                <Trash2 className="w-4 h-4 mr-1" />삭제
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <DialogFooter><Button variant="outline" onClick={() => setCourseMgrOpen(false)}>닫기</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
