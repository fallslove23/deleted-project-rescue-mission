import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendResultsRequest {
  surveyId: string;
  recipients?: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { surveyId, recipients = ['admin', 'instructor'] }: SendResultsRequest = await req.json();
    
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get survey details
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select(`
        *,
        instructors(name, email),
        courses(title)
      `)
      .eq('id', surveyId)
      .single();

    if (surveyError || !survey) {
      throw new Error('설문을 찾을 수 없습니다.');
    }

    // Get survey responses and statistics
    const { data: responses, error: responsesError } = await supabase
      .from('survey_responses')
      .select('*')
      .eq('survey_id', surveyId);

    if (responsesError) {
      throw new Error('설문 응답을 가져오는데 실패했습니다.');
    }

    // Get question answers with question details
    const { data: questionAnswers, error: answersError } = await supabase
      .from('question_answers')
      .select(`
        *,
        survey_questions(question_text, question_type, options),
        survey_responses(respondent_email)
      `)
      .in('response_id', responses?.map(r => r.id) || []);

    if (answersError) {
      throw new Error('설문 답변을 가져오는데 실패했습니다.');
    }

    // Process statistics
    const totalResponses = responses?.length || 0;
    const questionStats = new Map();

    questionAnswers?.forEach(answer => {
      const questionId = answer.question_id;
      if (!questionStats.has(questionId)) {
        questionStats.set(questionId, {
          question: answer.survey_questions.question_text,
          type: answer.survey_questions.question_type,
          answers: []
        });
      }
      questionStats.get(questionId).answers.push(answer.answer_text || answer.answer_value);
    });

    // Generate HTML results
    let resultsHtml = `
      <h2>${survey.title} - 설문 결과</h2>
      <p><strong>과목:</strong> ${survey.courses?.title || '미지정'}</p>
      <p><strong>강사:</strong> ${survey.instructors?.name || '미지정'}</p>
      <p><strong>응답 수:</strong> ${totalResponses}건</p>
      <p><strong>교육 연도:</strong> ${survey.education_year || '미지정'}</p>
      <p><strong>교육 회차:</strong> ${survey.education_round || '미지정'}</p>
      <hr>
      <h3>문항별 결과</h3>
    `;

    for (const [questionId, stats] of questionStats) {
      resultsHtml += `
        <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h4>${stats.question}</h4>
      `;

      if (stats.type === 'rating') {
        const ratings = stats.answers.filter(a => a !== null);
        const average = ratings.length > 0 ? (ratings.reduce((sum, rating) => sum + Number(rating), 0) / ratings.length).toFixed(1) : '0';
        resultsHtml += `<p><strong>평균 점수:</strong> ${average}점 (${ratings.length}명 응답)</p>`;
      } else if (stats.type === 'single_choice' || stats.type === 'multiple_choice') {
        const answerCounts = {};
        stats.answers.forEach(answer => {
          if (answer) {
            answerCounts[answer] = (answerCounts[answer] || 0) + 1;
          }
        });
        resultsHtml += '<ul>';
        for (const [answer, count] of Object.entries(answerCounts)) {
          resultsHtml += `<li>${answer}: ${count}명</li>`;
        }
        resultsHtml += '</ul>';
      } else {
        resultsHtml += `<p>${stats.answers.length}건의 답변</p>`;
      }

      resultsHtml += '</div>';
    }

    // Collect email addresses based on selected recipients
    const emailAddresses = new Set<string>();

    // Send email to instructor if selected
    if (recipients.includes('instructor') && survey.instructors?.email) {
      emailAddresses.add(survey.instructors.email);
    }

    // Get admin and operator emails if selected
    if (recipients.includes('admin')) {
      const { data: adminUsers } = await supabase
        .from('user_roles')
        .select(`
          profiles!inner(email)
        `)
        .in('role', ['admin', 'operator'])
        .not('profiles.email', 'is', null);

      if (adminUsers) {
        adminUsers.forEach(user => {
          if (user.profiles.email) {
            emailAddresses.add(user.profiles.email);
          }
        });
      }
    }

    // Get director emails if selected
    if (recipients.includes('director')) {
      const { data: directorUsers } = await supabase
        .from('user_roles')
        .select(`
          profiles!inner(email)
        `)
        .eq('role', 'director')
        .not('profiles.email', 'is', null);

      if (directorUsers) {
        directorUsers.forEach(user => {
          if (user.profiles.email) {
            emailAddresses.add(user.profiles.email);
          }
        });
      }
    }

    // Send emails to all selected recipients
    const emailList = Array.from(emailAddresses);
    if (emailList.length > 0) {
      await resend.emails.send({
        from: "BS교육원 <noreply@bsedu.co.kr>",
        to: emailList,
        subject: `[BS교육원] ${survey.title} 설문 결과`,
        html: resultsHtml,
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: '설문 결과가 성공적으로 전송되었습니다.' }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error sending survey results:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);