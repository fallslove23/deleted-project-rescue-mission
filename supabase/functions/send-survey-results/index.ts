import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendResultsRequest {
  surveyId: string;
  recipients: string[];
  force?: boolean;
  previewOnly?: boolean;
  // Optional: limit instructor recipients to specific instructor IDs for multi-instructor surveys
  targetInstructorIds?: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Edge function called with request");
    
    const { surveyId, recipients, force, previewOnly, targetInstructorIds }: SendResultsRequest = await req.json();
    console.log("Parsed request:", { surveyId, recipients, force, previewOnly, targetInstructorIdsCount: targetInstructorIds?.length || 0 });

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    console.log("Resend API key check:", resendApiKey ? "✓ Key found" : "✗ Key missing");
    
    if (!resendApiKey) {
      console.error("RESEND_API_KEY environment variable not found");
      return new Response(
        JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch survey data
    const { data: survey, error: surveyError } = await supabaseClient
      .from("surveys")
      .select("*")
      .eq("id", surveyId)
      .single();

    if (surveyError || !survey) {
      console.error("Survey fetch error:", surveyError);
      throw new Error("Survey not found");
    }

    // Fetch instructor info separately (surveys can have multiple instructors)
    let instructorInfo: { id?: string; name?: string; email?: string } | null = null;
    let allInstructors: Array<{ id?: string; name?: string; email?: string }> = [];
    
    // First try direct instructor_id if available
    if (survey.instructor_id) {
      const { data: instructor } = await supabaseClient
        .from("instructors")
        .select("id, name, email")
        .eq("id", survey.instructor_id)
        .single();
      
      if (instructor) {
        instructorInfo = instructor as any;
        allInstructors.push(instructor as any);
      }
    }
    
    // Also try survey_instructors mapping to get all instructors
    const { data: surveyInstructors } = await supabaseClient
      .from("survey_instructors")
      .select(`
        instructor_id,
        instructors (id, name, email)
      `)
      .eq("survey_id", surveyId);
    
    if (surveyInstructors && surveyInstructors.length > 0) {
      surveyInstructors.forEach((si: any) => {
        if (si.instructors) {
          const inst = si.instructors as any;
          // 중복 제거 (이미 추가된 강사는 제외)
          if (!allInstructors.some(existing => existing.email === inst.email)) {
            allInstructors.push(inst);
          }
          // 첫 번째 강사를 기본 instructorInfo로 설정 (이전 호환성)
          if (!instructorInfo) {
            instructorInfo = inst;
          }
        }
      });
    }

    // If caller specified a subset of instructors, filter to those only
    if (Array.isArray(targetInstructorIds) && targetInstructorIds.length > 0) {
      const targetSet = new Set(targetInstructorIds);
      allInstructors = allInstructors.filter((i) => i.id && targetSet.has(String(i.id)));
      if (!allInstructors.find((i) => i.email === instructorInfo?.email)) {
        instructorInfo = allInstructors[0] || instructorInfo;
      }
    }

    // Fetch course info if available
    let courseInfo: { title?: string } | null = null;
    if (survey.course_id) {
      const { data: course } = await supabaseClient
        .from("courses")
        .select("title")
        .eq("id", survey.course_id)
        .single();
      
      if (course) {
        courseInfo = course;
      }
    }

    // Merge the fetched data into survey object for backward compatibility
    const surveyWithRelations = {
      ...survey,
      instructors: instructorInfo,
      courses: courseInfo
    };

    // Idempotency & dedup guard (force=true이면 건너뜀)
    // 1) 과거 로그 조회: 전체 성공이면 즉시 건너뜀, 부분 성공이면 이미 보낸 수신자는 제외하고 진행
    let alreadySentSet = new Set<string>();
    if (!force && !previewOnly) {
      const { data: priorLogs } = await supabaseClient
        .from("email_logs")
        .select("id, status, created_at, results")
        .eq("survey_id", surveyId)
        .order("created_at", { ascending: false })
        .limit(20);

      const hasFullSuccess = priorLogs?.some((l: any) => l.status === "success");
      if (hasFullSuccess) {
        console.log("Existing full success email log found, skipping send (use force=true to override)");
        return new Response(
          JSON.stringify({
            success: true,
            alreadySent: true,
            message: "이미 모든 수신자에게 성공적으로 발송된 설문입니다. 재전송하려면 '강제 재전송' 옵션을 선택하세요.",
            surveyId,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // 부분 성공 혹은 실패 기록이 있으면, 이미 성공적으로 전송된 이메일은 재전송하지 않도록 수집
      priorLogs?.forEach((log: any) => {
        try {
          const emailResults = log?.results?.emailResults as Array<any> | undefined;
          emailResults?.forEach((r) => {
            if (r?.status === "sent" && r?.to) alreadySentSet.add(String(r.to).toLowerCase());
          });
        } catch (_) {
          // ignore JSON structure differences
        }
      });
    } else if (force) {
      console.log("Force resend enabled - ignoring previous send history");
    }

    // Resolve recipients (support role tokens and defaults)
    const inputRecipients = Array.isArray(recipients) ? recipients : [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const roleTokens = inputRecipients
      .map((r) => String(r).toLowerCase())
      .filter((r) => ["admin", "operator", "director", "instructor"].includes(r));
    const explicitEmails = inputRecipients.filter((r) => emailRegex.test(String(r)));

    const resolvedSet = new Set<string>(explicitEmails);
    const recipientNames = new Map<string, string>(); // 이메일 -> 이름 매핑

    // Include instructor emails when requested or when no recipients provided (default)
    // 모든 강사에게 발송 (여러 명일 경우 모두 포함)
    if (inputRecipients.length === 0 || roleTokens.includes("instructor")) {
      allInstructors.forEach((instructor) => {
        const instructorEmail = instructor.email;
        const instructorName = instructor.name;
        if (instructorEmail && emailRegex.test(instructorEmail)) {
          resolvedSet.add(instructorEmail);
          if (instructorName) {
            recipientNames.set(instructorEmail, instructorName);
          }
        }
      });
    }

    // Determine which roles to include
    let rolesForQuery: string[] = [];
    if (inputRecipients.length === 0) {
      // 기본값: 해당 설문의 강사에게만 발송 (admin 제거)
      rolesForQuery = [];
    } else {
      ["admin", "operator", "director"].forEach((r) => {
        if (roleTokens.includes(r)) rolesForQuery.push(r);
      });
    }

    if (rolesForQuery.length > 0) {
      const { data: roleRows, error: roleErr } = await supabaseClient
        .from("user_roles")
        .select("user_id, role")
        .in("role", rolesForQuery as any);

      if (!roleErr && roleRows && roleRows.length > 0) {
        const ids = Array.from(new Set(roleRows.map((r: any) => r.user_id)));
        
        // 프로필 정보 가져오기 (instructors는 별도 조회)
        const { data: profs } = await supabaseClient
          .from("profiles")
          .select("id, email, instructor_id")
          .in("id", ids);

        if (profs && profs.length > 0) {
          // 강사 정보를 가진 사용자의 instructor_id 수집
          const instructorIds = profs
            .map((p: any) => p.instructor_id)
            .filter((id: any) => id != null);

          // 강사 정보를 별도로 조회 (instructor_id가 잘못된 경우 대비)
          let instructorMap = new Map<string, string>();
          if (instructorIds.length > 0) {
            const { data: instructors } = await supabaseClient
              .from("instructors")
              .select("id, name")
              .in("id", instructorIds);

            instructors?.forEach((inst: any) => {
              if (inst.id && inst.name) {
                instructorMap.set(inst.id, inst.name);
              }
            });
          }

          profs.forEach((p: any) => {
            if (p.email && emailRegex.test(p.email)) {
              resolvedSet.add(p.email);
              
              // 이름 설정: 강사 이름이 있으면 강사명, 없으면 역할명
              let name = '';
              if (p.instructor_id && instructorMap.has(p.instructor_id)) {
                name = instructorMap.get(p.instructor_id) || '';
              } else {
                // 해당 사용자의 역할 찾기
                const userRoles = roleRows.filter((r: any) => r.user_id === p.id);
                const roleNames = userRoles.map((r: any) => {
                  switch(r.role) {
                    case 'admin': return '관리자';
                    case 'operator': return '운영자';
                    case 'director': return '조직장';
                    case 'instructor': return '강사';
                    default: return r.role;
                  }
                });
                name = roleNames.length > 0 ? roleNames.join(', ') : '수신자';
              }
              
              if (name) {
                recipientNames.set(p.email, name);
              }
            }
          });
        }
      }
    }

    const finalRecipients = Array.from(resolvedSet).map((e) => e.toLowerCase());
    if (finalRecipients.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "유효한 수신자 이메일을 찾을 수 없습니다. (도메인 검증 또는 수신자 선택을 확인하세요)",
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 이미 성공적으로 발송된 이메일 주소는 재발송하지 않음
    const recipientsToSend = finalRecipients.filter((email) => !alreadySentSet.has(email));
    if (recipientsToSend.length === 0 && !force) {
      return new Response(
        JSON.stringify({
          success: true,
          alreadySent: true,
          message: "이미 모든 수신자에게 발송 완료되어 재발송을 건너뜁니다.",
          surveyId,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Sender and reply-to addresses (use secrets; fallback to Resend sandbox)
    const FROM_ADDRESS = Deno.env.get("RESEND_FROM_ADDRESS") || "onboarding@resend.dev";
    const REPLY_TO_EMAIL = Deno.env.get("RESEND_REPLY_TO") || FROM_ADDRESS;

    // Display name mapping for author based on reply-to email
    const SENDER_DISPLAY_MAP: Record<string, string> = {
      "sseduadmin@osstem.com": "교육운영팀",
      "admin@osstem.com": "교육운영팀",
    };
    const authorDisplayName = SENDER_DISPLAY_MAP[REPLY_TO_EMAIL.toLowerCase()] ?? REPLY_TO_EMAIL;

    // Fetch survey responses and analysis
    const { data: responses } = await supabaseClient
      .from("survey_responses")
      .select("*")
      .eq("survey_id", surveyId)
      .neq("is_test", true);

    // 응답이 없는 경우 이메일을 보내지 않음
    if (!responses || responses.length === 0) {
      console.log("No survey responses found, skipping email send");
      return new Response(
        JSON.stringify({
          success: false,
          error: "응답이 없는 설문입니다. 이메일을 발송하지 않습니다.",
          responseCount: 0
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: questions } = await supabaseClient
      .from("survey_questions")
      .select("*, session_id")
      .eq("survey_id", surveyId)
      .order("order_index");

    // survey_sessions 정보 조회 (강사 정보 포함)
    const { data: surveySessions } = await supabaseClient
      .from("survey_sessions")
      .select(`
        id,
        session_name,
        instructor_id,
        instructors (id, name, email)
      `)
      .eq("survey_id", surveyId);

    // 세션별 강사 매핑 생성
    const sessionInstructorMap = new Map<string, { id: string; name: string; email: string | null }>();
    surveySessions?.forEach((session: any) => {
      if (session.instructor_id && session.instructors) {
        sessionInstructorMap.set(session.id, {
          id: session.instructors.id,
          name: session.instructors.name,
          email: session.instructors.email
        });
      }
    });

    const { data: answers } = await supabaseClient
      .from("question_answers")
      .select(`
        *,
        survey_questions (question_text, question_type, satisfaction_type, options, session_id)
      `)
      .in("response_id", responses?.map(r => r.id) || []);

    const responseCount = responses?.length || 0;
    const instructorName = surveyWithRelations.instructors?.name || '미등록';
    const courseTitle = surveyWithRelations.courses?.title || surveyWithRelations.course_name || '강의';

    // 강사별로 질문 분석 그룹화
    const questionAnalysisByInstructor: Record<string, Record<string, any>> = {};
    const commonQuestions: Record<string, any> = {}; // session_id가 없는 공통 질문들
    answers?.forEach((answer: any) => {
      const q = answer.survey_questions || {};
      const questionId = answer.question_id;
      const sessionId = q.session_id;
      
      // 세션이 있는 경우 해당 강사의 분석 그룹에 추가, 없으면 공통 질문으로
      let targetAnalysis: Record<string, any>;
      if (sessionId && sessionInstructorMap.has(sessionId)) {
        const instructor = sessionInstructorMap.get(sessionId)!;
        const instructorKey = instructor.id;
        
        if (!questionAnalysisByInstructor[instructorKey]) {
          questionAnalysisByInstructor[instructorKey] = {};
        }
        targetAnalysis = questionAnalysisByInstructor[instructorKey];
      } else {
        targetAnalysis = commonQuestions;
      }
      
      if (!targetAnalysis[questionId]) {
        targetAnalysis[questionId] = {
          question: q.question_text,
          type: q.question_type,
          satisfaction_type: q.satisfaction_type,
          sessionId: sessionId,
          answers: [] as any[],
          stats: {}
        };
      }

      const qa = targetAnalysis[questionId];
      const val = answer.answer_value;
      const text = answer.answer_text;

      if (qa.type === 'rating' || qa.type === 'scale') {
        let n: number | null = null;
        if (typeof val === 'number') n = val;
        else if (typeof val === 'string' && !isNaN(Number(val))) n = Number(val);
        else if (val && typeof val === 'object') {
          const maybe: any = (val as any).value ?? (val as any).score ?? null;
          if (maybe != null && !isNaN(Number(maybe))) n = Number(maybe);
        } else if (typeof text === 'string' && !isNaN(Number(text))) {
          n = Number(text);
        }
        if (typeof n === 'number' && !isNaN(n)) qa.answers.push(n);
      } else if (qa.type === 'multiple_choice' || qa.type === 'single_choice') {
        const pushChoice = (s: any) => {
          if (s === null || typeof s === 'undefined') return;
          const v = typeof s === 'object' ? (s.label ?? s.value ?? JSON.stringify(s)) : s;
          const str = String(v).trim();
          if (str) qa.answers.push(str);
        };
        if (typeof text === 'string' && text.trim()) pushChoice(text);
        else if (Array.isArray(val)) val.forEach(pushChoice);
        else if (typeof val === 'string') pushChoice(val);
        else if (typeof val === 'object' && val) pushChoice(val);
      } else {
        if (typeof text === 'string' && text.trim()) qa.answers.push(text.trim());
      }
    });

    // Calculate statistics for each question (공통 질문)
    const calculateStats = (analysis: Record<string, any>) => {
      Object.keys(analysis).forEach((qid) => {
        const qa = analysis[qid];
        if (qa.type === 'rating' || qa.type === 'scale') {
          const numericAnswers: number[] = qa.answers.filter((a: any) => typeof a === 'number' && !isNaN(a));
          if (numericAnswers.length > 0) {
            const avg = numericAnswers.reduce((sum: number, val: number) => sum + val, 0) / numericAnswers.length;
            qa.stats.average = Number(avg.toFixed(1));
            qa.stats.count = numericAnswers.length;
          }
        } else if (qa.type === 'multiple_choice' || qa.type === 'single_choice') {
          const counts: Record<string, number> = {};
          qa.answers.forEach((answer: any) => {
            if (answer) {
              const key = String(answer);
              counts[key] = (counts[key] || 0) + 1;
            }
          });
          qa.stats.distribution = counts;
        }
      });
    };
    
    // 공통 질문 통계 계산
    calculateStats(commonQuestions);
    
    // 각 강사별 질문 통계 계산
    Object.keys(questionAnalysisByInstructor).forEach((instructorId) => {
      calculateStats(questionAnalysisByInstructor[instructorId]);
    });

    // Send emails to recipients
    const emailResults = [];
    const failedEmails = [];

    console.log("Sending emails to recipients:", recipientsToSend);
    
    // Helper function to generate question summary HTML
    const generateQuestionSummaryHtml = (analysis: Record<string, any>) => {
      let summary = '';
      Object.values(analysis).forEach((qa: any) => {
        summary += `
          <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #f9fafb;">
            <h4 style="color: #374151; margin: 0 0 10px 0; font-size: 14px; font-weight: 600;">${qa.question}</h4>
        `;
        
        if (qa.stats.average) {
          summary += `
            <p style="margin: 5px 0; color: #4b5563; font-size: 13px;">
              <strong>평균 점수:</strong> <span style="color: #059669; font-weight: 600;">${qa.stats.average}점</span> 
              (${qa.stats.count}명 응답)
            </p>
          `;
        } else if (qa.stats.distribution) {
          summary += '<div style="font-size: 13px; color: #4b5563;">';
          Object.entries(qa.stats.distribution).forEach(([option, count]) => {
            summary += `<div style="margin: 3px 0;">• ${option}: <strong>${count}명</strong></div>`;
          });
          summary += '</div>';
        } else if (qa.type === 'text' && qa.answers.length > 0) {
          // 주관식 응답 표시
          summary += `
            <div style="font-size: 13px; color: #4b5563;">
              <p style="margin: 5px 0 10px 0; font-weight: 600;">${qa.answers.length}건의 응답:</p>
              <div style="max-height: 400px; overflow-y: auto; border-left: 3px solid #e5e7eb; padding-left: 12px;">
          `;
          qa.answers.forEach((answer: string, index: number) => {
            const escapedAnswer = String(answer)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;')
              .replace(/\n/g, '<br>');
            summary += `
              <div style="margin: 8px 0; padding: 10px; background-color: white; border-radius: 6px; border: 1px solid #e5e7eb;">
                <span style="display: inline-block; padding: 2px 6px; background-color: #dbeafe; color: #1e40af; border-radius: 4px; font-size: 11px; font-weight: 600; margin-bottom: 6px;">응답 ${index + 1}</span>
                <div style="color: #374151; line-height: 1.6;">${escapedAnswer}</div>
              </div>
            `;
          });
          summary += '</div></div>';
        } else {
          summary += `<p style="margin: 5px 0; color: #4b5563; font-size: 13px;">${qa.answers.length}건의 응답</p>`;
        }
        
        summary += '</div>';
      });
      return summary;
    };
    
    // Generate email content for preview or sending
    let questionSummary = '';
    
    // 공통 질문이 있으면 먼저 표시
    if (Object.keys(commonQuestions).length > 0) {
      questionSummary += `
        <div style="margin-bottom: 30px;">
          <h3 style="color: #1f2937; font-size: 16px; font-weight: 700; margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb;">
            📋 공통 문항
          </h3>
          ${generateQuestionSummaryHtml(commonQuestions)}
        </div>
      `;
    }
    
    // 강사별로 질문 표시
    if (Object.keys(questionAnalysisByInstructor).length > 0) {
      Object.entries(questionAnalysisByInstructor).forEach(([instructorId, analysis]) => {
        const instructor = Array.from(sessionInstructorMap.values()).find(i => i.id === instructorId);
        const instructorDisplayName = instructor?.name || '강사';
        
        questionSummary += `
          <div style="margin-bottom: 30px;">
            <h3 style="color: #1f2937; font-size: 16px; font-weight: 700; margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #3b82f6; display: flex; align-items: center;">
              <span style="display: inline-block; width: 8px; height: 24px; background-color: #3b82f6; margin-right: 10px; border-radius: 2px;"></span>
              👨‍🏫 ${instructorDisplayName} 강사님 평가
            </h3>
            ${generateQuestionSummaryHtml(analysis)}
          </div>
        `;
      });
    }

    const emailSubject = `📊 설문 결과 발송: ${surveyWithRelations.title}`;
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px; padding: 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background: rgba(255, 255, 255, 0.15); border-radius: 12px; margin-bottom: 12px; backdrop-filter: blur(10px);">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z" fill="white" opacity="0.9"/>
            </svg>
          </div>
          <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">📊 설문 결과 알림</h1>
          <p style="color: rgba(255,255,255,0.95); margin: 10px 0 0 0; font-size: 15px; font-weight: 500;">SS교육연구소 설문 시스템</p>
        </div>
        
        <!-- Survey Info -->
        <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
          <h2 style="color: #1e40af; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">📋 설문 정보</h2>
          <div style="display: grid; gap: 12px;">
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
              <span style="color: #64748b; font-weight: 500;">설문 제목</span>
              <span style="color: #334155; font-weight: 600;">${surveyWithRelations.title}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
              <span style="color: #64748b; font-weight: 500;">강사명</span>
              <span style="color: #334155; font-weight: 600;">${instructorName}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
              <span style="color: #64748b; font-weight: 500;">강의명</span>
              <span style="color: #334155; font-weight: 600;">${courseTitle}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
              <span style="color: #64748b; font-weight: 500;">교육년도</span>
              <span style="color: #334155; font-weight: 600;">${surveyWithRelations.education_year}년</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
              <span style="color: #64748b; font-weight: 500;">교육차수</span>
              <span style="color: #334155; font-weight: 600;">${surveyWithRelations.education_round}차</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0;">
              <span style="color: #64748b; font-weight: 500;">총 응답 수</span>
              <span style="color: #059669; font-weight: 700; font-size: 16px;">${responseCount}명</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0;">
              <span style="color: #64748b; font-weight: 500;">작성자</span>
              <span style="color: #334155; font-weight: 600;">${authorDisplayName} (${REPLY_TO_EMAIL})</span>
            </div>
          </div>
        </div>

        <!-- Statistics -->
        <div style="background-color: #ecfdf5; padding: 24px; border-radius: 12px; margin-bottom: 24px; border-left: 4px solid #10b981;">
          <h2 style="color: #047857; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">📈 주요 통계</h2>
          <div style="display: grid; gap: 12px;">
            <div style="background-color: white; padding: 16px; border-radius: 8px; text-align: center;">
              <div style="color: #059669; font-size: 28px; font-weight: 700; margin-bottom: 4px;">${responseCount}</div>
              <div style="color: #6b7280; font-size: 14px;">총 응답자 수</div>
            </div>
            <div style="color: #374151; font-size: 14px; line-height: 1.5;">
              <strong>설문 기간:</strong> ${survey.start_date ? new Date(survey.start_date).toLocaleDateString('ko-KR') : '미정'} ~ ${survey.end_date ? new Date(survey.end_date).toLocaleDateString('ko-KR') : '미정'}
            </div>
          </div>
        </div>

        <!-- Question Analysis -->
        <div style="margin-bottom: 24px;">
          <h2 style="color: #374151; margin: 0 0 20px 0; font-size: 18px; font-weight: 600;">📝 문항별 분석 결과</h2>
          ${questionSummary}
        </div>

        <!-- Footer -->
        <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; text-align: center; margin-top: 30px;">
          <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px; font-weight: 500;">
            🔍 상세한 분석 결과는 설문 관리 시스템에서 확인하실 수 있습니다.
          </p>
          <p style="margin: 0; color: #94a3b8; font-size: 12px;">
            이 메일은 자동으로 발송된 메일입니다. 문의사항이 있으시면 관리자에게 연락해 주세요.
          </p>
        </div>
      </div>
    `;

    // Generate plain text version
    const generateQuestionSummaryText = (analysis: Record<string, any>) => {
      let text = '';
      Object.values(analysis).forEach((qa: any) => {
        text += `${qa.question}\n`;
        if (qa.stats.average) {
          text += `평균 점수: ${qa.stats.average}점 (${qa.stats.count}명 응답)\n`;
        } else if (qa.stats.distribution) {
          Object.entries(qa.stats.distribution).forEach(([option, count]) => {
            text += `• ${option}: ${count}명\n`;
          });
        } else {
          text += `${qa.answers.length}건의 응답\n`;
        }
        text += `\n`;
      });
      return text;
    };
    
    let textContent = `설문 결과 발송: ${surveyWithRelations.title}\n\n`;
    textContent += `=== 설문 정보 ===\n`;
    textContent += `설문 제목: ${surveyWithRelations.title}\n`;
    textContent += `강사명: ${instructorName}\n`;
    textContent += `강의명: ${courseTitle}\n`;
    textContent += `교육년도: ${surveyWithRelations.education_year}년\n`;
    textContent += `교육차수: ${surveyWithRelations.education_round}차\n`;
    textContent += `총 응답 수: ${responseCount}명\n\n`;
    textContent += `=== 문항별 분석 결과 ===\n\n`;
    
    // 공통 질문이 있으면 먼저 표시
    if (Object.keys(commonQuestions).length > 0) {
      textContent += `📋 공통 문항\n`;
      textContent += `${'='.repeat(50)}\n\n`;
      textContent += generateQuestionSummaryText(commonQuestions);
    }
    
    // 강사별로 질문 표시
    if (Object.keys(questionAnalysisByInstructor).length > 0) {
      Object.entries(questionAnalysisByInstructor).forEach(([instructorId, analysis]) => {
        const instructor = Array.from(sessionInstructorMap.values()).find(i => i.id === instructorId);
        const instructorDisplayName = instructor?.name || '강사';
        
        textContent += `👨‍🏫 ${instructorDisplayName} 강사님 평가\n`;
        textContent += `${'='.repeat(50)}\n\n`;
        textContent += generateQuestionSummaryText(analysis);
      });
    }

    // If preview only, return the email content without sending
    if (previewOnly) {
      console.log("Preview mode - returning email content without sending");
      return new Response(
        JSON.stringify({
          subject: emailSubject,
          htmlContent: emailHtml,
          textContent: textContent,
          recipients: recipientsToSend,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    for (const email of recipientsToSend) {
      try {
        console.log(`Attempting to send email to: ${email}`);
        
        // Check for common Resend setup issues first
        if (!resendApiKey || typeof resendApiKey !== 'string' || resendApiKey.trim() === '') {
          throw new Error('RESEND_API_KEY is missing or empty. Please check your environment configuration.');
        }
        
        if (!resendApiKey.startsWith('re_')) {
          throw new Error('Invalid Resend API key format. API key should start with "re_". Please check your RESEND_API_KEY.');
        }
        
        const emailResponse = await resend.emails.send({
          from: FROM_ADDRESS,
          to: [email],
          reply_to: REPLY_TO_EMAIL,
          subject: emailSubject,
          html: emailHtml,
        });

        console.log(`Resend API response for ${email}:`, emailResponse);
        if ((emailResponse as any)?.error) {
          const err: any = (emailResponse as any).error;
          console.error(`Resend reported an error for ${email}:`, err);

          // Map common Resend errors to actionable messages
          const status = err?.statusCode;
          let friendly = err?.message || 'Unknown Resend error';
          if (status === 401) {
            friendly = 'Resend 401: API 키가 올바르지 않거나 권한이 없습니다. (RESEND_API_KEY 확인)';
          } else if (status === 403) {
            friendly = 'Resend 403: 샌드박스 발신자(onboarding@resend.dev)는 "Test Emails" 허용 목록 또는 검증된 도메인으로만 전송 가능합니다. 수신자 이메일을 Resend > Settings > Test Emails에 추가하시거나 도메인을 검증하세요.';
          }

          failedEmails.push(email);
          emailResults.push({
            to: email,
            name: recipientNames.get(email) || email.split('@')[0],
            status: 'failed',
            error: friendly,
            errorCode: status
          });
        } else {
          emailResults.push({
            to: email,
            name: recipientNames.get(email) || email.split('@')[0], // 이름이 없으면 이메일 앞부분 사용
            status: 'sent',
            messageId: (emailResponse as any)?.data?.id
          });
        }

      } catch (emailError) {
        console.error(`Failed to send email to ${email}:`, emailError);
        console.error("Detailed error:", JSON.stringify(emailError, null, 2));
        const status = (emailError as any)?.statusCode || (emailError as any)?.code;
        let friendly = (emailError as any)?.message ?? 'Unknown error';
        if (status === 401) {
          friendly = 'Resend 401: API 키가 올바르지 않거나 권한이 없습니다. (RESEND_API_KEY 확인)';
        } else if (status === 403) {
          friendly = 'Resend 403: 샌드박스 발신자(onboarding@resend.dev)는 "Test Emails" 허용 목록 또는 검증된 도메인으로만 전송 가능합니다. 수신자 이메일을 Resend > Settings > Test Emails에 추가하시거나 도메인을 검증하세요.';
        }
        failedEmails.push(email);
        emailResults.push({
          to: email,
          name: recipientNames.get(email) || email.split('@')[0],
          status: 'failed',
          error: friendly,
          errorCode: status
        });
      }
    }

    const successCount = emailResults.filter((r: any) => r.status === 'sent').length;
    const failureCount = emailResults.filter((r: any) => r.status === 'failed').length;
    
    // Log email sending results to database
    const logStatus = failureCount === 0 ? 'success' : 
                      successCount === 0 ? 'failed' : 'partial';

    try {
      const { error: logError } = await supabaseClient
        .from('email_logs')
        .insert({
          survey_id: surveyId,
          recipients: recipientsToSend,
          status: logStatus,
          sent_count: successCount,
          failed_count: failureCount,
          results: {
            emailResults,
            survey_info: {
              title: survey.title,
              instructor: instructorName,
              course: courseTitle,
              year: survey.education_year,
              round: survey.education_round,
              response_count: responseCount,
              author_name: authorDisplayName,
              author_email: REPLY_TO_EMAIL
            },
            question_analysis: questionAnalysis
          },
          error: failedEmails.length > 0 ? `Failed to send to: ${failedEmails.join(', ')}` : null
        });

      if (logError) {
        console.error('Failed to log email results:', logError);
      }
    } catch (logError) {
      console.error('Failed to log email results:', logError);
    }

    return new Response(
      JSON.stringify({
        success: logStatus === 'success',
        sent: successCount,
        failed: failureCount,
        total: recipientsToSend.length,
        recipients: recipientsToSend,
        results: emailResults,
        recipientNames: Object.fromEntries(recipientNames), // 이름 매핑 정보 포함
        message: failureCount === 0 
          ? '모든 수신자에게 성공적으로 전송되었습니다.'
          : successCount === 0 
          ? '모든 전송이 실패했습니다.'
          : `${successCount}건 성공, ${failureCount}건 실패`
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-survey-results function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);