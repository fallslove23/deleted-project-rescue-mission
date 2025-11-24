import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendResultsRequest {
  surveyId: string;
  recipients: string[];
  force?: boolean;
  previewOnly?: boolean;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr.map((x) => JSON.stringify(x)))).map((s) => JSON.parse(s));
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { surveyId, recipients = [], previewOnly }: SendResultsRequest = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1) Survey
    const { data: survey, error: surveyErr } = await supabase
      .from("surveys")
      .select("*")
      .eq("id", surveyId)
      .single();
    if (surveyErr || !survey) throw new Error("Survey not found");

    // 2) Sessions + instructors
    const { data: sessions, error: sessErr } = await supabase
      .from("survey_sessions")
      .select(`id, instructor_id, instructors (id, name, email)`) // ensure FK exists
      .eq("survey_id", surveyId);
    if (sessErr) throw new Error("Failed to fetch sessions");

    const sessionIdToInstructorId = new Map<string, string>();
    const sessionIdToInstructorName = new Map<string, string>();
    const instructorsFromSessions: Array<{ id: string; name?: string; email?: string }> = [];
    sessions?.forEach((s: any) => {
      if (s?.id && s?.instructor_id) sessionIdToInstructorId.set(s.id, s.instructor_id);
      if (s?.id && s?.instructors?.name) sessionIdToInstructorName.set(s.id, s.instructors.name);
      if (s?.instructors?.id && !instructorsFromSessions.find((i) => i.id === s.instructors.id)) {
        instructorsFromSessions.push({ id: s.instructors.id, name: s.instructors.name, email: s.instructors.email });
      }
    });

    // 3) Extra instructors
    const extraInstructors: Array<{ id: string; name?: string; email?: string }> = [];
    if (survey.instructor_id) {
      const { data: inst } = await supabase
        .from("instructors")
        .select("id, name, email")
        .eq("id", survey.instructor_id)
        .single();
      if (inst) extraInstructors.push(inst as any);
    }
    const { data: surveyInstructors } = await supabase
      .from("survey_instructors")
      .select(`instructor_id, instructors (id, name, email)`) // mapping
      .eq("survey_id", surveyId);
    surveyInstructors?.forEach((si: any) => {
      const inst = si?.instructors;
      if (inst && !extraInstructors.find((i) => i.id === inst.id)) extraInstructors.push(inst);
    });

    const allInstructors = uniq([...instructorsFromSessions, ...extraInstructors]);

    // 4) Responses (no nested)
    const { data: responses, error: respErr } = await supabase
      .from("survey_responses")
      .select("id, session_id, submitted_at, is_test")
      .eq("survey_id", surveyId)
      .neq("is_test", true);
    if (respErr) throw new Error("Failed to fetch survey responses");
    if (!responses || responses.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "응답이 없는 설문입니다. 이메일을 발송하지 않습니다.", responseCount: 0 }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const responseIds = responses.map((r: any) => r.id);

    // 5) Answers + questions
    const { data: answers, error: ansErr } = await supabase
      .from("question_answers")
      .select(`id, response_id, question_id, answer_text, answer_value,
               survey_questions (id, question_text, question_type, satisfaction_type, session_id)`)
      .in("response_id", responseIds);
    if (ansErr) throw new Error("Failed to fetch answers");

    const emailToInstructorId = new Map<string, string>();
    allInstructors.forEach((inst) => {
      if (inst.email) emailToInstructorId.set(String(inst.email).toLowerCase(), inst.id);
    });
    
    // 각 이메일의 역할을 확인하는 맵 추가
    const emailToRole = new Map<string, string>();
    
    // profiles 테이블에서 모든 사용자 정보 가져오기
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, email, instructor_id')
      .not('email', 'is', null);
    
    if (allProfiles) {
      for (const profile of allProfiles) {
        const email = String(profile.email).toLowerCase();
        
        // instructor_id가 있으면 강사
        if (profile.instructor_id) {
          emailToRole.set(email, 'instructor');
          // instructor_id로 강사 맵핑도 추가
          if (!emailToInstructorId.has(email)) {
            emailToInstructorId.set(email, profile.instructor_id);
          }
        }
      }
    }
    
    // user_roles에서 각 사용자의 역할 가져오기
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('user_id, role');
    
    if (userRoles) {
      const userIdToRole = new Map<string, string[]>();
      userRoles.forEach((ur: any) => {
        const roles = userIdToRole.get(ur.user_id) || [];
        roles.push(ur.role);
        userIdToRole.set(ur.user_id, roles);
      });
      
      // profiles와 조인하여 이메일-역할 매핑
      if (allProfiles) {
        for (const profile of allProfiles) {
          const roles = userIdToRole.get(profile.id);
          if (roles && roles.length > 0) {
            const email = String(profile.email).toLowerCase();
            // director나 admin 역할이 있으면 우선 적용
            if (roles.includes('director') || roles.includes('admin')) {
              emailToRole.set(email, roles.includes('director') ? 'director' : 'admin');
            } else if (!emailToRole.has(email)) {
              // 그 외 역할 (operator 등)
              emailToRole.set(email, roles[0]);
            }
          }
        }
      }
    }

    const buildContent = (targetInstructorId: string | null) => {
      let filteredResponseIds = new Set<string>(responseIds);
      if (targetInstructorId) {
        const sessionIds = Array.from(sessionIdToInstructorId.entries())
          .filter(([_, iid]) => iid === targetInstructorId)
          .map(([sid]) => sid);
        filteredResponseIds = new Set(
          responses.filter((r: any) => r.session_id && sessionIds.includes(r.session_id)).map((r: any) => r.id)
        );
      }

      const filteredAnswers = answers?.filter((a: any) => filteredResponseIds.has(a.response_id)) || [];

      const qaMap: Record<string, any> = {};
      filteredAnswers.forEach((a: any) => {
        const q = a.survey_questions || {};
        const qid = a.question_id;
        if (!qaMap[qid]) {
          const sessId = q.session_id || null;
          qaMap[qid] = {
            question: q.question_text,
            type: q.question_type,
            satisfaction_type: q.satisfaction_type,
            instructor: sessId ? sessionIdToInstructorName.get(sessId) || null : null,
            answers: [] as any[],
            stats: {},
          };
        }
        const row = qaMap[qid];
        const val = a.answer_value;
        const text = a.answer_text;
        if (row.type === "rating" || row.type === "scale") {
          let n: number | null = null;
          if (typeof val === "number") n = val;
          else if (typeof val === "string" && !isNaN(Number(val))) n = Number(val);
          else if (val && typeof val === "object") {
            const maybe: any = (val as any).value ?? (val as any).score ?? null;
            if (maybe != null && !isNaN(Number(maybe))) n = Number(maybe);
          } else if (typeof text === "string" && !isNaN(Number(text))) {
            n = Number(text);
          }
          if (typeof n === "number" && !isNaN(n)) row.answers.push(n);
        } else if (row.type === "multiple_choice" || row.type === "single_choice") {
          const pushChoice = (s: any) => {
            if (s == null) return;
            const v = typeof s === "object" ? (s.label ?? s.value ?? JSON.stringify(s)) : s;
            const str = String(v).trim();
            if (str) row.answers.push(str);
          };
          if (typeof text === "string" && text.trim()) pushChoice(text);
          else if (Array.isArray(val)) val.forEach(pushChoice);
          else if (typeof val === "string") pushChoice(val);
          else if (typeof val === "object" && val) pushChoice(val);
        } else if (typeof text === "string" && text.trim()) {
          row.answers.push(text.trim());
        }
      });

      Object.keys(qaMap).forEach((k) => {
        const row = qaMap[k];
        if (row.type === "rating" || row.type === "scale") {
          const nums = row.answers.filter((x: any) => typeof x === "number" && !isNaN(x));
          if (nums.length > 0) {
            const avg = nums.reduce((s: number, v: number) => s + v, 0) / nums.length;
            row.stats.average = Number(avg.toFixed(1));
            row.stats.count = nums.length;
          }
        } else if (row.type === "multiple_choice" || row.type === "single_choice") {
          const counts: Record<string, number> = {};
          row.answers.forEach((v: any) => {
            const key = String(v);
            counts[key] = (counts[key] || 0) + 1;
          });
          row.stats.distribution = counts;
        }
      });

      const ratingRows = Object.values(qaMap).filter((r: any) => r.type === "rating" || r.type === "scale");
      let avgSatisfaction: number | null = null;
      if (ratingRows.length > 0) {
        const all = ratingRows.flatMap((r: any) => r.answers.filter((x: any) => typeof x === "number" && !isNaN(x)));
        if (all.length > 0) avgSatisfaction = Number((all.reduce((s: number, v: number) => s + v, 0) / all.length).toFixed(1));
      }

      let questionSummary = "";
      let lastInstructor: string | null = null;
      
      Object.values(qaMap).forEach((qa: any) => {
        // 강사가 바뀔 때 섹션 헤더 추가
        if (qa.instructor && qa.instructor !== lastInstructor) {
          questionSummary += `
            <div style=\"margin:30px 0 20px 0;padding:12px 20px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:8px;border-left:4px solid #5a67d8;\">
              <h3 style=\"color:#ffffff;margin:0;font-size:16px;font-weight:700;display:flex;align-items:center;\">
                <span style=\"margin-right:8px;\">👨‍🏫</span>
                강사: ${qa.instructor}
              </h3>
            </div>
          `;
          lastInstructor = qa.instructor;
        }
        
        const instructorLabel = qa.instructor
          ? `<span style=\"display:inline-block;padding:2px 8px;background-color:#dbeafe;color:#1e40af;border-radius:4px;font-size:12px;font-weight:600;margin-left:8px;\">${qa.instructor}</span>`
          : "";
        questionSummary += `
          <div style=\"margin-bottom:20px;padding:15px;border:1px solid #e5e7eb;border-radius:8px;background-color:#f9fafb;\">
            <h4 style=\"color:#374151;margin:0 0 10px 0;font-size:14px;font-weight:600;\">${qa.question}${instructorLabel}</h4>
        `;
        if (qa.stats.average) {
          questionSummary += `
            <p style=\"margin:5px 0;color:#4b5563;font-size:13px;\"><strong>평균 점수:</strong> <span style=\"color:#059669;font-weight:600;\">${qa.stats.average}점</span> (${qa.stats.count}명 응답)</p>
          `;
        } else if (qa.stats.distribution) {
          questionSummary += '<div style=\"font-size:13px;color:#4b5563;\">';
          Object.entries(qa.stats.distribution).forEach(([option, count]) => {
            questionSummary += `<div style=\"margin:3px 0;\">• ${option}: <strong>${count}명</strong></div>`;
          });
          questionSummary += '</div>';
        } else if (qa.type === 'text' && qa.answers.length > 0) {
          questionSummary += `<div style=\"font-size:13px;color:#4b5563;\"><p style=\"margin:5px 0 10px 0;font-weight:600;\">${qa.answers.length}건의 응답:</p></div>`;
        }
        questionSummary += '</div>';
      });

      const instructorNames = allInstructors.map((i) => i.name).filter(Boolean).join(", ") || "미등록";
      const emailSubject = `📊 설문 결과 발송: ${survey.title || survey.course_name || '설문'}`;
      const emailHtml = `
        <div style=\"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;max-width:800px;margin:0 auto;padding:20px;background-color:#ffffff;\">
          <div style=\"text-align:center;margin-bottom:30px;padding:24px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:16px;color:#fff;\">
            <h1 style=\"margin:0 0 10px 0;font-size:22px;\">설문 결과</h1>
            <p style=\"margin:0;opacity:.9;\">${survey.title || survey.course_name || ''}</p>
          </div>
          <div style=\"background:#f8fafc;padding:16px;border-radius:8px;margin-bottom:20px;border-left:4px solid #667eea;\">
            <div style=\"color:#475569;font-size:14px;line-height:1.7\">
              <div><strong>강사명:</strong> ${instructorNames}</div>
              <div><strong>교육년도:</strong> ${survey.education_year ?? ''}년</div>
              <div><strong>교육차수:</strong> ${survey.education_round ?? ''}차</div>
            </div>
          </div>
          <div style=\"background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:20px;border-radius:8px;margin-bottom:20px;\">
            <div style=\"background:#fff;padding:16px;border-radius:8px;text-align:center;\">
              <div style=\"color:#059669;font-size:28px;font-weight:700;margin-bottom:4px;\">${avgSatisfaction !== null ? `${avgSatisfaction}점` : `${filteredResponseIds.size}명`}</div>
              <div style=\"color:#6b7280;font-size:14px;\">${avgSatisfaction !== null ? '종합 만족도' : '총 응답자 수'}</div>
            </div>
          </div>
          <div style=\"margin-bottom:24px;\">
            <h2 style=\"color:#374151;margin:0 0 20px 0;font-size:18px;font-weight:600;\">📝 문항별 분석 결과</h2>
            ${questionSummary}
          </div>
          <div style=\"background:#f1f5f9;padding:20px;border-radius:8px;text-align:center;margin-top:30px;\">
            <p style=\"margin:0 0 8px 0;color:#64748b;font-size:14px;font-weight:500;\">🔍 상세한 분석 결과는 설문 관리 시스템에서 확인하실 수 있습니다.</p>
            <p style=\"margin:0;color:#94a3b8;font-size:12px;\">이 메일은 자동으로 발송된 메일입니다. 문의사항이 있으시면 관리자에게 연락해 주세요.</p>
          </div>
        </div>`;

      return { subject: emailSubject, html: emailHtml };
    };

    if (previewOnly) {
      // 미리보기: 역할을 실제 이메일로 확장
      const expandedEmails: string[] = [];
      
      for (const recipient of recipients) {
        const recipientStr = String(recipient).toLowerCase();
        
        // 역할인 경우 해당 역할의 모든 사용자 이메일을 가져옴
        if (['admin', 'operator', 'director', 'instructor'].includes(recipientStr)) {
          if (recipientStr === 'instructor') {
            // 강사의 경우 이 설문에 연결된 강사의 이메일만 추가
            allInstructors.forEach((inst: any) => {
              if (inst.email) expandedEmails.push(inst.email);
            });
          } else {
            // 다른 역할들은 기존 로직대로
            // 1단계: user_roles에서 해당 역할의 user_id 가져오기
            const { data: userRoles } = await supabase
              .from('user_roles')
              .select('user_id')
              .eq('role', recipientStr);
            
            if (userRoles && userRoles.length > 0) {
              const userIds = userRoles.map((ur: any) => ur.user_id);
              
              // 2단계: profiles에서 해당 user_id들의 이메일 가져오기
              const { data: profiles } = await supabase
                .from('profiles')
                .select('email')
                .in('id', userIds)
                .not('email', 'is', null);
              
              if (profiles) {
                profiles.forEach((p: any) => {
                  if (p.email) expandedEmails.push(p.email);
                });
              }
            }
          }
        } else {
          // 이메일 주소인 경우 그대로 추가
          expandedEmails.push(recipient);
        }
      }
      
      // 중복 제거
      const uniqueEmails = Array.from(new Set(expandedEmails));
      
      // 미리보기: 수신자 중 강사 이메일이 있으면 해당 강사의 결과만 표시
      let previewInstructorId: string | null = null;
      
      for (const email of uniqueEmails) {
        const emailLower = email.toLowerCase();
        if (emailToInstructorId.has(emailLower)) {
          previewInstructorId = emailToInstructorId.get(emailLower) || null;
          break; // 첫 번째 강사의 결과를 미리보기로 사용
        }
      }
      
      const content = buildContent(previewInstructorId);
      return new Response(
        JSON.stringify({ 
          success: true, 
          subject: content.subject, 
          htmlContent: content.html, 
          recipients: uniqueEmails,
          previewNote: previewInstructorId 
            ? "미리보기: 강사님께는 본인의 과목 결과만 전송됩니다." 
            : "미리보기: 전체 결과가 표시됩니다."
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Prepare survey info and question analysis for email logs
    const surveyInfo = {
      year: survey.education_year,
      round: survey.education_round,
      title: survey.title || survey.course_name,
      course: survey.course_name,
      instructor: allInstructors.map((i) => i.name).filter(Boolean).join(", ") || "미등록",
      author_name: survey.created_by_name || "Unknown",
      author_email: survey.created_by_email || "Unknown",
      response_count: responses.length,
    };

    // Build question analysis from all answers for logging
    const logQaMap: Record<string, any> = {};
    answers?.forEach((a: any) => {
      const q = a.survey_questions || {};
      const qid = a.question_id;
      if (!logQaMap[qid]) {
        logQaMap[qid] = {
          question: q.question_text,
          type: q.question_type,
          satisfaction_type: q.satisfaction_type,
          answers: [] as any[],
          stats: {},
        };
      }
      const row = logQaMap[qid];
      const val = a.answer_value;
      const text = a.answer_text;
      if (row.type === "rating" || row.type === "scale") {
        let n: number | null = null;
        if (typeof val === "number") n = val;
        else if (typeof val === "string" && !isNaN(Number(val))) n = Number(val);
        else if (val && typeof val === "object") {
          const maybe: any = (val as any).value ?? (val as any).score ?? null;
          if (maybe != null && !isNaN(Number(maybe))) n = Number(maybe);
        } else if (typeof text === "string" && !isNaN(Number(text))) {
          n = Number(text);
        }
        if (typeof n === "number" && !isNaN(n)) row.answers.push(n);
      } else if (row.type === "multiple_choice" || row.type === "single_choice") {
        const pushChoice = (s: any) => {
          if (s == null) return;
          const v = typeof s === "object" ? (s.label ?? s.value ?? JSON.stringify(s)) : s;
          const str = String(v).trim();
          if (str) row.answers.push(str);
        };
        if (typeof text === "string" && text.trim()) pushChoice(text);
        else if (Array.isArray(val)) val.forEach(pushChoice);
        else if (typeof val === "string") pushChoice(val);
        else if (typeof val === "object" && val) pushChoice(val);
      } else if (typeof text === "string" && text.trim()) {
        row.answers.push(text.trim());
      }
    });

    // Calculate stats for each question
    Object.keys(logQaMap).forEach((k) => {
      const row = logQaMap[k];
      if (row.type === "rating" || row.type === "scale") {
        const nums = row.answers.filter((x: any) => typeof x === "number" && !isNaN(x));
        if (nums.length > 0) {
          const avg = nums.reduce((s: number, v: number) => s + v, 0) / nums.length;
          row.stats.average = Number(avg.toFixed(1));
          row.stats.count = nums.length;
        }
      } else if (row.type === "multiple_choice" || row.type === "single_choice") {
        const counts: Record<string, number> = {};
        row.answers.forEach((v: any) => {
          const key = String(v);
          counts[key] = (counts[key] || 0) + 1;
        });
        row.stats.distribution = counts;
      }
    });

    const questionAnalysis = logQaMap;

    const results: any[] = [];
    const sentEmails = new Set<string>(); // 중복 발송 방지
    
    for (const emailRaw of recipients) {
      const email = String(emailRaw).toLowerCase();
      
      // 역할인 경우 해당 역할의 모든 사용자 이메일로 확장
      let targetEmails: string[] = [];
      if (['admin', 'operator', 'director', 'instructor'].includes(email)) {
        if (email === 'instructor') {
          // 강사의 경우 이 설문에 연결된 강사의 이메일만
          targetEmails = allInstructors.map((inst: any) => inst.email).filter(Boolean);
        } else {
          // 다른 역할들은 기존 로직대로
          // 1단계: user_roles에서 해당 역할의 user_id 가져오기
          const { data: userRoles } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', email);
          
          if (userRoles && userRoles.length > 0) {
            const userIds = userRoles.map((ur: any) => ur.user_id);
            
            // 2단계: profiles에서 해당 user_id들의 이메일 가져오기
            const { data: profiles } = await supabase
              .from('profiles')
              .select('email')
              .in('id', userIds)
              .not('email', 'is', null);
            
            if (profiles) {
              targetEmails = profiles.map((p: any) => p.email).filter(Boolean);
            }
          }
        }
      } else {
        targetEmails = [email];
      }
      
      // 각 이메일에 발송 (중복 제거 및 rate limiting 적용)
      for (const targetEmail of targetEmails) {
        const emailLower = targetEmail.toLowerCase();
        
        // 이미 발송한 이메일은 건너뛰기
        if (sentEmails.has(emailLower)) {
          console.log(`Skipping duplicate email to ${targetEmail}`);
          continue;
        }
        sentEmails.add(emailLower);
        
        const userRole = emailToRole.get(emailLower);
        
        // director와 admin은 전체 결과, 나머지는 본인 결과만
        let instructorId: string | null = null;
        if (userRole !== 'director' && userRole !== 'admin') {
          // 강사 또는 다른 역할은 본인 결과만
          instructorId = emailToInstructorId.get(emailLower) || null;
        }
        
        const content = buildContent(instructorId);
        
        const fromAddress = Deno.env.get("RESEND_FROM_ADDRESS") || "onboarding@resend.dev";
        const replyTo = Deno.env.get("RESEND_REPLY_TO") || undefined;
        
        try {
          console.log(`Sending email to ${targetEmail} (role: ${userRole || 'unknown'}, instructorId: ${instructorId || 'none'}) from ${fromAddress}`);
          const sendRes: any = await resend.emails.send({
            from: fromAddress,
            to: [targetEmail],
            reply_to: replyTo,
            subject: content.subject,
            html: content.html,
          });
          
          if (sendRes?.error) {
            console.error(`Failed to send to ${targetEmail}:`, sendRes.error);
            results.push({ to: targetEmail, status: "failed", error: sendRes.error.message || String(sendRes.error) });
          } else {
            console.log(`Successfully sent to ${targetEmail}, ID: ${sendRes?.id}`);
            results.push({ to: targetEmail, status: "sent", emailId: sendRes?.id });
          }
          
          // Rate limiting: 초당 2개 제한을 지키기 위해 500ms 대기
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (emailErr: any) {
          console.error(`Exception sending to ${targetEmail}:`, emailErr);
          results.push({ to: targetEmail, status: "failed", error: emailErr?.message || String(emailErr) });
        }
      }
    }

    // Save to email_logs
    const sentCount = results.filter((r) => r.status === "sent").length;
    const failedCount = results.filter((r) => r.status === "failed").length;
    const recipientList = [...new Set(results.map((r) => r.to))];
    
    try {
      await supabase.from("email_logs").insert({
        survey_id: surveyId,
        recipients: recipientList,
        status: failedCount === 0 ? "success" : (sentCount > 0 ? "partial" : "failed"),
        sent_count: sentCount,
        failed_count: failedCount,
        results: { emailResults: results, survey_info: surveyInfo, question_analysis: questionAnalysis },
      });
    } catch (logErr: any) {
      console.error("Failed to save email log:", logErr);
    }

    return new Response(
      JSON.stringify({ success: true, sentCount, results }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (e: any) {
    console.error("Error in send-survey-results function:", e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message || "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
