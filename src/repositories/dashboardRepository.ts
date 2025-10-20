import { supabase } from '@/integrations/supabase/client';

export interface DashboardCounts {
  survey_count: number;
  respondent_count: number;
  instructor_count: number;
  avg_score: number | null;
}

/**
 * Fetch dashboard summary counts using RPC
 * @param year - Education year
 * @param sessionKey - Optional session_key UUID to filter by specific course/session
 */
export async function fetchDashboardCounts(
  year: number,
  sessionKey?: string | null
): Promise<DashboardCounts> {
  try {
    const { data, error } = await (supabase as any).rpc('rpc_dashboard_counts', {
      p_year: year,
      p_session_key: sessionKey || null,
    }) as { data: DashboardCounts[] | null; error: any };

    if (error) {
      console.error('RPC error in fetchDashboardCounts:', error);
      throw error;
    }

    // RPC returns array with single row
    const result = data?.[0] || {
      survey_count: 0,
      respondent_count: 0,
      instructor_count: 0,
      avg_score: null,
    };

    return result;
  } catch (error) {
    console.error('Error in fetchDashboardCounts:', error);
    // Fail-safe: return zeros
    return {
      survey_count: 0,
      respondent_count: 0,
      instructor_count: 0,
      avg_score: null,
    };
  }
}
