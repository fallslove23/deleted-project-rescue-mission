import { supabase } from '@/integrations/supabase/client';

export interface CourseOption {
  value: string;  // session_id UUID
  label: string;  // "YYYY년 N차 과정명"
  course_key: string;
  year: number;
}


export interface SubjectOption {
  subject_id: string;
  subject_title: string;
  subject_position: number | null;
}

/**
 * Fetch available course options (실제 진행된 과정 세션)
 * Returns: "연도+차수+과정명" format (e.g., "2025년 7차 BS Basic")
 */
export async function fetchCourseOptions(params: {
  year?: number | null;
  search?: string | null;
}): Promise<CourseOption[]> {
  try {
    if (!params.year) {
      console.warn('fetchCourseOptions called without year parameter');
      return [];
    }

    const { data, error } = await (supabase as any).rpc('rpc_course_filter_options', {
      p_year: params.year,
    }) as { data: any[] | null; error: any };

    if (error) {
      console.error('RPC error in fetchCourseOptions:', error);
      throw error;
    }

    const options = (data ?? []).map((row: any) => ({
      value: row.value,
      label: row.label,
      course_key: row.course_key,
      year: row.year,
    }));

    // Apply client-side search filter if provided
    if (params.search && params.search.trim()) {
      const searchLower = params.search.toLowerCase();
      return options.filter((opt: CourseOption) =>
        opt.label.toLowerCase().includes(searchLower) ||
        opt.course_key.toLowerCase().includes(searchLower)
      );
    }

    return options;
  } catch (error) {
    console.error('Error in fetchCourseOptions:', error);
    // Fail-safe: return empty list to avoid blocking UI with toasts
    return [];
  }
}

/**
 * Fetch available subject options for a specific session
 * Uses new normalized structure: sessions → session_subjects → subjects
 */
export async function fetchSubjectOptions(params: {
  sessionId: string;  // Changed from courseId to sessionId
  search?: string | null;
}): Promise<SubjectOption[]> {
  try {
    const { data, error } = await supabase.rpc('rpc_subjects_for_session' as any, {
      p_session_id: params.sessionId,
    }) as { data: SubjectOption[] | null; error: any };

    if (error) {
      console.error('Failed to fetch subject options:', error);
      throw error;
    }

    const subjects = data || [];
    
    // Apply client-side search filter if provided
    if (params.search && params.search.trim()) {
      const searchLower = params.search.toLowerCase();
      return subjects.filter((opt: SubjectOption) =>
        opt.subject_title.toLowerCase().includes(searchLower)
      );
    }

    return subjects;
  } catch (error) {
    console.error('Error in fetchSubjectOptions:', error);
    throw new Error('데이터를 불러오지 못했습니다. 네트워크 또는 권한 문제일 수 있어요.');
  }
}
