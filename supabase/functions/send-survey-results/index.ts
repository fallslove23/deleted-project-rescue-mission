import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendResultsRequest {
  surveyId: string;
  recipients: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { surveyId, recipients }: SendResultsRequest = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch survey data with instructor and course info
    const { data: survey, error: surveyError } = await supabaseClient
      .from("surveys")
      .select(`
        *,
        instructors (name, email),
        courses (title)
      `)
      .eq("id", surveyId)
      .single();

    if (surveyError || !survey) {
      throw new Error("Survey not found");
    }

    // Resolve recipients (support role tokens and defaults)
    const inputRecipients = Array.isArray(recipients) ? recipients : [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const roleTokens = inputRecipients
      .map((r) => String(r).toLowerCase())
      .filter((r) => ["admin", "operator", "director", "instructor"].includes(r));
    const explicitEmails = inputRecipients.filter((r) => emailRegex.test(String(r)));

    const resolvedSet = new Set<string>(explicitEmails);

    // Include instructor email when requested or when no recipients provided (default)
    if (inputRecipients.length === 0 || roleTokens.includes("instructor")) {
      const instructorEmail = survey.instructors?.email as string | undefined;
      if (instructorEmail && emailRegex.test(instructorEmail)) {
        resolvedSet.add(instructorEmail);
      }
    }

    // Determine which roles to include
    let rolesForQuery: string[] = [];
    if (inputRecipients.length === 0) {
      rolesForQuery = ["admin"]; // default: send to admins
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
        const { data: profs } = await supabaseClient
          .from("profiles")
          .select("email")
          .in("id", ids);
        profs?.forEach((p: any) => {
          if (p.email && emailRegex.test(p.email)) resolvedSet.add(p.email);
        });
      }
    }

    const finalRecipients = Array.from(resolvedSet);
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

    const fromAddress = "BS교육원 설문시스템 <onboarding@resend.dev>";

    // Fetch survey responses and analysis
    const { data: responses } = await supabaseClient
      .from("survey_responses")
      .select("*")
      .eq("survey_id", surveyId);

    const { data: questions } = await supabaseClient
      .from("survey_questions")
      .select("*")
      .eq("survey_id", surveyId)
      .order("order_index");

    const { data: answers } = await supabaseClient
      .from("question_answers")
      .select(`
        *,
        survey_questions (question_text, question_type, options)
      `)
      .in("response_id", responses?.map(r => r.id) || []);

    const responseCount = responses?.length || 0;
    const instructorName = survey.instructors?.name || '강사';
    const courseTitle = survey.courses?.title || '강의';

    // Generate question analysis
    const questionAnalysis: Record<string, any> = {};
    answers?.forEach(answer => {
      const questionId = answer.question_id;
      if (!questionAnalysis[questionId]) {
        questionAnalysis[questionId] = {
          question: answer.survey_questions.question_text,
          type: answer.survey_questions.question_type,
          answers: [],
          stats: {}
        };
      }
      questionAnalysis[questionId].answers.push(answer.answer_text || answer.answer_value);
    });

    // Calculate statistics for each question
    Object.keys(questionAnalysis).forEach(questionId => {
      const qa = questionAnalysis[questionId];
      if (qa.type === 'rating' || qa.type === 'scale') {
        const numericAnswers = qa.answers.filter(a => a !== null && !isNaN(a)).map(Number);
        if (numericAnswers.length > 0) {
          qa.stats.average = (numericAnswers.reduce((sum, val) => sum + val, 0) / numericAnswers.length).toFixed(1);
          qa.stats.count = numericAnswers.length;
        }
      } else if (qa.type === 'multiple_choice' || qa.type === 'single_choice') {
        const counts: Record<string, number> = {};
        qa.answers.forEach(answer => {
          if (answer) {
            counts[answer] = (counts[answer] || 0) + 1;
          }
        });
        qa.stats.distribution = counts;
      }
    });

    // Send emails to recipients
    const emailResults = [];
    const failedEmails = [];

    for (const email of finalRecipients) {
      try {
        let questionSummary = '';
        Object.values(questionAnalysis).forEach((qa: any) => {
          questionSummary += `
            <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #f9fafb;">
              <h4 style="color: #374151; margin: 0 0 10px 0; font-size: 14px; font-weight: 600;">${qa.question}</h4>
          `;
          
          if (qa.stats.average) {
            questionSummary += `
              <p style="margin: 5px 0; color: #4b5563; font-size: 13px;">
                <strong>평균 점수:</strong> <span style="color: #059669; font-weight: 600;">${qa.stats.average}점</span> 
                (${qa.stats.count}명 응답)
              </p>
            `;
          } else if (qa.stats.distribution) {
            questionSummary += '<div style="font-size: 13px; color: #4b5563;">';
            Object.entries(qa.stats.distribution).forEach(([option, count]) => {
              questionSummary += `<div style="margin: 3px 0;">• ${option}: <strong>${count}명</strong></div>`;
            });
            questionSummary += '</div>';
          } else {
            questionSummary += `<p style="margin: 5px 0; color: #4b5563; font-size: 13px;">${qa.answers.length}건의 응답</p>`;
          }
          
          questionSummary += '</div>';
        });

        const emailResponse = await resend.emails.send({
          from: fromAddress,
          to: [email],
          subject: `📊 설문 결과 발송: ${survey.title}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
              <!-- Header -->
              <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px;">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">📊 설문 결과 알림</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">BS교육원 설문 시스템</p>
              </div>
              
              <!-- Survey Info -->
              <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
                <h2 style="color: #1e40af; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">📋 설문 정보</h2>
                <div style="display: grid; gap: 12px;">
                  <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-weight: 500;">설문 제목</span>
                    <span style="color: #334155; font-weight: 600;">${survey.title}</span>
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
                    <span style="color: #334155; font-weight: 600;">${survey.education_year}년</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-weight: 500;">교육차수</span>
                    <span style="color: #334155; font-weight: 600;">${survey.education_round}차</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                    <span style="color: #64748b; font-weight: 500;">총 응답 수</span>
                    <span style="color: #059669; font-weight: 700; font-size: 16px;">${responseCount}명</span>
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
          `,
        });

        emailResults.push({
          to: email,
          status: 'sent',
          messageId: emailResponse.data?.id
        });

      } catch (emailError) {
        console.error(`Failed to send email to ${email}:`, emailError);
        failedEmails.push(email);
        emailResults.push({
          to: email,
          status: 'failed',
          error: (emailError as any)?.message ?? 'Unknown error'
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
          recipients: finalRecipients,
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
              response_count: responseCount
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
        success: true,
        sent: successCount,
        failed: failureCount,
        total: finalRecipients.length,
        recipients: finalRecipients,
        results: emailResults,
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