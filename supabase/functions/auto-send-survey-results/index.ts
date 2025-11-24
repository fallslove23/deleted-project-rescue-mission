import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    body: JSON.stringify({ surveyId, recipients: ["instructor", "director", "admin"] }), // default recipients: instructor + director + admin
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
    // Include both 'completed' and 'active' to avoid missing cases where status wasn't flipped
    const { data: dueSurveys, error: surveyErr } = await supabase
      .from("surveys")
      .select("id, title, education_year, education_round, end_date, status")
      .lte("end_date", nowIso)
      .eq("is_test", false)
      .in("status", ["completed", "active", "public"]) // be tolerant and include public
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
    const { data: logs, error: logErr } = await supabase
      .from("email_logs")
      .select("survey_id, status, created_at")
      .in("survey_id", surveyIds);

    if (logErr) throw logErr;

    // 각 설문에 대해 가장 최근 로그만 확인
    const latestLogBysurvey = new Map<string, any>();
    logs?.forEach((l) => {
      const surveyId = String(l.survey_id);
      const existing = latestLogBysurvey.get(surveyId);
      if (!existing || new Date(l.created_at) > new Date(existing.created_at)) {
        latestLogBysurvey.set(surveyId, l);
      }
    });

    const hasSuccessfulLog = new Map<string, boolean>();
    const partialLogCounts = new Map<string, number>();
    
    latestLogBysurvey.forEach((l, surveyId) => {
      // 가장 최근 로그가 success 또는 partial이면 재발송하지 않음
      if (l.status === "success" || l.status === "partial") {
        hasSuccessfulLog.set(surveyId, true);
      }
      if (l.status === "partial") {
        partialLogCounts.set(surveyId, (partialLogCounts.get(surveyId) ?? 0) + 1);
      }
    });

    // 3) Check which surveys have responses before sending
    const surveyResponseCounts = new Map<string, number>();
    for (const survey of dueSurveys) {
      const { count } = await supabase
        .from("survey_responses")
        .select("*", { count: "exact", head: true })
        .eq("survey_id", survey.id);
      surveyResponseCounts.set(survey.id, count || 0);
    }

    // 4) Filter targets to send (exclude surveys without responses and already sent)
    let targets = dueSurveys.filter((s) => {
      const hasResponses = (surveyResponseCounts.get(s.id) || 0) > 0;
      const alreadySent = hasSuccessfulLog.get(s.id);
      return hasResponses && !alreadySent;
    });
    if (limit) targets = targets.slice(0, limit);

    if (targets.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "All due surveys already processed or have no responses",
          processed: 0,
          skipped: dueSurveys.length,
          details: [],
          partialLogs: Array.from(partialLogCounts.entries()).map(([surveyId, count]) => ({
            surveyId,
            count,
          })),
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!dryRun) {
      // Process emails synchronously to ensure completion
      const results = [];
      for (const s of targets) {
        try {
          console.log(`Processing survey ${s.id} (${s.title})...`);
          const r = await invokeSendResults(s.id);
          console.log(`Survey ${s.id} processed: ${r.status}`);
          results.push({ surveyId: s.id, title: s.title, status: r.status, success: r.status === 200 });
        } catch (e: any) {
          console.error(`Failed to process survey ${s.id}:`, e);
          results.push({ surveyId: s.id, title: s.title, error: e?.message, success: false });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Sent emails for ${targets.length} survey(s)`,
          processed: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          results,
          dryRun: false,
          partialLogs: Array.from(partialLogCounts.entries()).map(([surveyId, count]) => ({
            surveyId,
            count,
          })),
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: 0,
        targets: targets.map((t) => ({ id: t.id, title: t.title, status: t.status, end_date: t.end_date })),
        results: [],
        dryRun: true,
        partialLogs: Array.from(partialLogCounts.entries()).map(([surveyId, count]) => ({
          surveyId,
          count,
        })),
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
