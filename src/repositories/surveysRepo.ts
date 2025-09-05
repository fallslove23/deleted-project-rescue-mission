// ... 기존 import/타입은 그대로 유지

export class SurveysRepository {
  // === 기존 fetchSurveyList, getAvailableYears 그대로 ===

  static async getAvailableCourseKeys(year?: number): Promise<
    { year: number; round: number; course_name: string }[]
  > {
    // 연도별 과정-차수 목록 (뷰가 없다면 원본에서 DISTINCT)
    let q = supabase
      .from('surveys')
      .select('education_year, education_round, course_name')
      .not('course_name', 'is', null);

    if (year) q = q.eq('education_year', year);

    const { data, error } = await q;
    if (error) throw error;

    const uniq = new Map<string, { year: number; round: number; course_name: string }>();
    (data ?? []).forEach((r: any) => {
      const key = `${r.education_year}-${r.education_round}-${r.course_name}`;
      if (!uniq.has(key)) {
        uniq.set(key, { year: r.education_year, round: r.education_round, course_name: r.course_name });
      }
    });
    return Array.from(uniq.values()).sort((a, b) =>
      a.year !== b.year ? b.year - a.year :
      a.round !== b.round ? a.round - b.round :
      a.course_name.localeCompare(b.course_name)
    );
  }

  static async updateStatus(id: string, status: 'draft'|'active'|'public'|'completed') {
    const { error } = await supabase.from('surveys').update({ status }).eq('id', id);
    if (error) throw error;
  }

  static async duplicateSurvey(id: string, titleSuffix = ' (복사본)') {
    // 서버 RPC/함수가 있으면 그걸 쓰고, 없으면 최소 필드만 복제
    const { data: src, error: e1 } = await supabase.from('surveys').select('*').eq('id', id).single();
    if (e1) throw e1;

    const payload = {
      ...src,
      id: undefined,            // PK 제거
      title: (src.title ?? '무제') + titleSuffix,
      status: 'draft',
      created_at: undefined,
      updated_at: undefined,
    };
    const { data: created, error: e2 } = await supabase.from('surveys').insert([payload]).select().single();
    if (e2) throw e2;
    return created;
  }

  static async deleteSurvey(id: string) {
    const { error } = await supabase.from('surveys').delete().eq('id', id);
    if (error) throw error;
  }
}
