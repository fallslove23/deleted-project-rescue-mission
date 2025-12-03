import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 최대 재시도 횟수 (실패 후 더 이상 시도하지 않음)
const MAX_RETRY_COUNT = 3;

// Helper to call another Edge Function with service role
async function invokeSendResults(surveyId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  const url = `${supabaseUrl}/functions/v1/send-survey-results`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify({ surveyId, recipients: ["instructor", "director", "manager"] }),
  });

  const data = await resp.json().catch(() => ({}));
  return { status: resp.status, data };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabase = createClient(supabaseUrl, serviceKey);

    // Check if auto email sending is enabled
    const { data: settings, error: settingsError } = await supabase
      .from("cron_settings")
      .select("value")
      .eq("key", "auto_email_enabled")
      .single();

    if (settingsError) {
      console.error("Failed to check auto email setting:", settingsError);
    }

    const autoEmailEnabled = settings?.value === "true";
    
    if (!autoEmailEnabled) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Auto email sending is currently disabled",
          processed: 0,
          skipped: 0,
          details: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Ensure survey statuses are up-to-date before processing
    try {
      await supabase.rpc('update_survey_statuses');
    } catch (error) {
      console.warn('Failed to update survey statuses:', error);
    }

    // Allow optional payload: { dryRun?: boolean, limit?: number }
    let dryRun = false;
    let limit: number | undefined = undefined;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        dryRun = Boolean(body?.dryRun ?? false);
        if (body?.limit && Number.isFinite(Number(body.limit))) {
          limit = Math.max(1, Math.min(50, Number(body.limit)));
        }
      } catch (_) {
        // ignore parse errors, treat as defaults
      }
    }

    const nowIso = new Date().toISOString();

    // 1) Find surveys whose end_date has passed and likely completed
    const { data: dueSurveys, error: surveyErr } = await supabase
      .from("surveys")
      .select("id, title, education_year, education_round, end_date, status")
      .lte("end_date", nowIso)
      .eq("is_test", false)
      .in("status", ["completed", "active", "public"])
      .order("end_date", { ascending: false });

    if (surveyErr) throw surveyErr;

    if (!dueSurveys || dueSurveys.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No due surveys found",
          processed: 0,
          skipped: 0,
          details: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const surveyIds = dueSurveys.map((s) => s.id);

    // 2) Fetch email logs for those surveys to avoid duplicate sends
    // 최근 7일 이내의 모든 로그를 확인 (성공, 부분, 실패 모두)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: logs, error: logErr } = await supabase
      .from("email_logs")
      .select("survey_id, status, created_at, sent_count, failed_count")
      .in("survey_id", surveyIds)
      .gte("created_at", sevenDaysAgo);

    if (logErr) throw logErr;

    // 각 설문별로 로그 상태 분석
    const surveyLogStatus = new Map<string, {
      hasSuccess: boolean;
      hasPartial: boolean;
      failedAttempts: number;
      lastAttempt: Date | null;
    }>();
    
    logs?.forEach((l) => {
      const surveyId = String(l.survey_id);
      let status = surveyLogStatus.get(surveyId);
      if (!status) {
        status = { hasSuccess: false, hasPartial: false, failedAttempts: 0, lastAttempt: null };
        surveyLogStatus.set(surveyId, status);
      }
      
      if (l.status === "success") {
        status.hasSuccess = true;
      } else if (l.status === "partial") {
        status.hasPartial = true;
      } else if (l.status === "failed") {
        status.failedAttempts++;
      }
      
      const logDate = new Date(l.created_at);
      if (!status.lastAttempt || logDate > status.lastAttempt) {
        status.lastAttempt = logDate;
      }
    });

    // 3) Check which surveys have responses before sending
    const surveyResponseCounts = new Map<string, number>();
    for (const survey of dueSurveys) {
      const { count } = await supabase
        .from("survey_responses")
        .select("*", { count: "exact", head: true })
        .eq("survey_id", survey.id)
        .neq("is_test", true);
      surveyResponseCounts.set(survey.id, count || 0);
    }

    // 4) Filter targets to send
    let targets = dueSurveys.filter((s) => {
      const hasResponses = (surveyResponseCounts.get(s.id) || 0) > 0;
      const logStatus = surveyLogStatus.get(s.id);
      
      // 응답이 없으면 제외
      if (!hasResponses) {
        console.log(`[SKIP] Survey ${s.id}: No responses`);
        return false;
      }
      
      // 성공한 로그가 있으면 제외
      if (logStatus?.hasSuccess) {
        console.log(`[SKIP] Survey ${s.id}: Already successfully sent`);
        return false;
      }
      
      // 부분 성공한 로그가 있으면 제외 (일부라도 발송됨)
      if (logStatus?.hasPartial) {
        console.log(`[SKIP] Survey ${s.id}: Already partially sent`);
        return false;
      }
      
      // 최대 재시도 횟수를 초과하면 제외
      if (logStatus && logStatus.failedAttempts >= MAX_RETRY_COUNT) {
        console.log(`[SKIP] Survey ${s.id}: Max retry count (${MAX_RETRY_COUNT}) exceeded (${logStatus.failedAttempts} failures)`);
        return false;
      }
      
      // 마지막 시도 후 1시간 이내면 제외 (rate limiting)
      if (logStatus?.lastAttempt) {
        const timeSinceLastAttempt = Date.now() - logStatus.lastAttempt.getTime();
        const oneHourMs = 60 * 60 * 1000;
        if (timeSinceLastAttempt < oneHourMs) {
          console.log(`[SKIP] Survey ${s.id}: Last attempt was ${Math.round(timeSinceLastAttempt / 60000)} minutes ago, waiting for cooldown`);
          return false;
        }
      }
      
      return true;
    });
    
    if (limit) targets = targets.slice(0, limit);

    const skippedDetails = dueSurveys
      .filter((s) => !targets.find((t) => t.id === s.id))
      .map((s) => {
        const logStatus = surveyLogStatus.get(s.id);
        const responseCount = surveyResponseCounts.get(s.id) || 0;
        return {
          surveyId: s.id,
          title: s.title,
          responseCount,
          hasSuccess: logStatus?.hasSuccess || false,
          hasPartial: logStatus?.hasPartial || false,
          failedAttempts: logStatus?.failedAttempts || 0,
          reason: responseCount === 0 
            ? 'no_responses' 
            : logStatus?.hasSuccess 
              ? 'already_sent' 
              : logStatus?.hasPartial
                ? 'partially_sent'
                : (logStatus?.failedAttempts || 0) >= MAX_RETRY_COUNT 
                  ? 'max_retries_exceeded' 
                  : 'cooldown'
        };
      });

    if (targets.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "All due surveys already processed, have no responses, or exceeded retry limit",
          processed: 0,
          skipped: dueSurveys.length,
          skippedDetails,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!dryRun) {
      // Process emails synchronously to ensure completion
      const results = [];
      for (const s of targets) {
        try {
          const logStatus = surveyLogStatus.get(s.id);
          const attemptNum = (logStatus?.failedAttempts || 0) + 1;
          console.log(`[PROCESSING] Survey ${s.id} (${s.title}), attempt #${attemptNum}/${MAX_RETRY_COUNT}...`);
          
          const r = await invokeSendResults(s.id);
          console.log(`[RESULT] Survey ${s.id}: status=${r.status}, success=${r.status === 200}`);
          results.push({ 
            surveyId: s.id, 
            title: s.title, 
            status: r.status, 
            success: r.status === 200,
            attemptNumber: attemptNum
          });
        } catch (e: any) {
          console.error(`[ERROR] Failed to process survey ${s.id}:`, e);
          results.push({ surveyId: s.id, title: s.title, error: e?.message, success: false });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Processed ${targets.length} survey(s)`,
          processed: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          results,
          skippedDetails,
          dryRun: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: 0,
        targets: targets.map((t) => ({ 
          id: t.id, 
          title: t.title, 
          status: t.status, 
          end_date: t.end_date,
          attemptNumber: (surveyLogStatus.get(t.id)?.failedAttempts || 0) + 1
        })),
        skippedDetails,
        results: [],
        dryRun: true,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in auto-send-survey-results:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message ?? "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});