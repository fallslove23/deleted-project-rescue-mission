import { supabase } from '@/integrations/supabase/client';

export interface CourseOption {
  session_id: string;
  session_title: string;
  course_title: string;
  year: number;
}

export interface SubjectOption {
  subject_id: string;
  subject_title: string;
  subject_position: number | null;
}

/**
 * Fetch available course options using session-based view
 * - Uses v_course_filter_options view based on survey sessions
 */
export async function fetchCourseOptions(params: {
  year?: number | null;
  search?: string | null;
}): Promise<CourseOption[]> {
  try {
    const { data, error } = await supabase.rpc('fn_session_filter_options', {
      p_year: params.year ?? null,
      p_search: params.search ?? null,
    });

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      session_id: row.session_id,
      session_title: row.session_title,
      course_title: row.course_title,
      year: row.year,
    }));
  } catch (error) {
    console.error('Error in fetchCourseOptions:', error);
    // Fail-safe: return empty list to avoid blocking UI with toasts
    return [];
  }
}

/**
 * Fetch available subject (session) options using RPC
 */
export async function fetchSubjectOptions(params: {
  courseId: string;
  search?: string | null;
}): Promise<SubjectOption[]> {
  try {
    const { data, error } = await supabase.rpc('fn_subject_filter_options' as any, {
      p_course_id: params.courseId,
      p_search: params.search ?? null,
    }) as { data: SubjectOption[] | null; error: any };

    if (error) {
      console.error('Failed to fetch subject options:', error);
      throw error;
    }

    // Sort by position first, then by title
    const subjects = data || [];
    const sorted = subjects.sort((a, b) => {
      if (a.subject_position !== null && b.subject_position !== null) {
        return a.subject_position - b.subject_position;
      }
      if (a.subject_position !== null) return -1;
      if (b.subject_position !== null) return 1;
      return a.subject_title.localeCompare(b.subject_title, 'ko');
    });

    return sorted;
  } catch (error) {
    console.error('Error in fetchSubjectOptions:', error);
    throw new Error('데이터를 불러오지 못했습니다. 네트워크 또는 권한 문제일 수 있어요.');
  }
}
