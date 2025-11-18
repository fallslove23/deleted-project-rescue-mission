import React, { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layouts';
import { useCourseReportsData } from '@/hooks/useCourseReportsData';
import { useTestDataToggle } from '@/hooks/useTestDataToggle';
import CourseStatsCards from '@/components/course-reports/CourseStatsCards';
import InstructorStatsSection from '@/components/course-reports/InstructorStatsSection';
import { KeywordCloud } from '@/components/course-reports/KeywordCloud';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const buildSessionLabel = (s: { sessionTitle: string; programName: string; turn: number }) => {
  const parts: string[] = [];
  if (s.programName) parts.push(s.programName);
  if (s.sessionTitle) parts.push(s.sessionTitle);
  if (s.turn) parts.push(`${s.turn}차`);
  return parts.join(' · ');
};

const DashboardCourseReports: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [sessionId, setSessionId] = useState<string>('');
  const [round, setRound] = useState<number | null>(null);
  const [instructorId, setInstructorId] = useState<string>('');
  const { includeTestData } = useTestDataToggle();

  const {
    summary,
    previousSummary,
    trend,
    instructorStats,
    previousInstructorStats,
    textualResponses,
    availableSessions,
    availableRounds,
    availableInstructors,
    loading,
  } = useCourseReportsData(year, sessionId, round, instructorId, includeTestData);

  const years = useMemo(() => [currentYear, currentYear - 1, currentYear - 2], [currentYear]);

  const instructorStatsMapped = useMemo(() =>
    (instructorStats || []).map((s) => ({
      instructor_id: s.instructorId || '',
      instructor_name: s.instructorName || '-'
        ,
      survey_count: s.surveyCount || 0,
      response_count: s.responseCount || 0,
      avg_satisfaction: s.avgSatisfaction ?? 0,
    })), [instructorStats]);

  const previousInstructorStatsMapped = useMemo(() =>
    (previousInstructorStats || []).map((s) => ({
      instructor_id: s.instructorId || '',
      instructor_name: s.instructorName || '-',
      survey_count: s.surveyCount || 0,
      response_count: s.responseCount || 0,
      avg_satisfaction: s.avgSatisfaction ?? 0,
    })), [previousInstructorStats]);

  return (
    <DashboardLayout
      title="강의 리포트"
      subtitle="과정/회차/강사별 상세 통계를 확인하세요"
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-6">
            <div>
              <Label className="mb-2 block">연도</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
                <SelectTrigger><SelectValue placeholder="연도 선택" /></SelectTrigger>
                <SelectContent className="z-50 bg-background border shadow-md">
                  {years.map((y) => (<SelectItem key={y} value={String(y)}>{y}년</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 block">세션(과정)</Label>
              <Select value={sessionId} onValueChange={(v) => { setSessionId(v); setRound(null); }}>
                <SelectTrigger><SelectValue placeholder="세션 선택" /></SelectTrigger>
                <SelectContent className="z-50 bg-background border shadow-md max-h-80 overflow-auto">
                  <SelectItem key="__all" value="">전체</SelectItem>
                  {availableSessions?.map((s) => (
                    <SelectItem key={s.sessionId} value={s.sessionId}>
                      {buildSessionLabel({ sessionTitle: s.sessionTitle, programName: s.programName, turn: s.turn })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 block">회차</Label>
              <Select value={round === null ? '' : String(round)} onValueChange={(v) => setRound(v ? parseInt(v, 10) : null)}>
                <SelectTrigger><SelectValue placeholder="전체" /></SelectTrigger>
                <SelectContent className="z-50 bg-background border shadow-md">
                  <SelectItem key="__all_round" value="">전체</SelectItem>
                  {(summary?.availableRounds || availableRounds || []).map((r) => (
                    <SelectItem key={r} value={String(r)}>{r}차</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 block">강사</Label>
              <Select value={instructorId} onValueChange={setInstructorId}>
                <SelectTrigger><SelectValue placeholder="전체" /></SelectTrigger>
                <SelectContent className="z-50 bg-background border shadow-md">
                  <SelectItem key="__all_instr" value="">전체</SelectItem>
                  {availableInstructors?.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {summary && (
          <CourseStatsCards
            totalSurveys={summary.totalSurveys}
            totalResponses={summary.totalResponses}
            instructorCount={summary.instructorCount}
            avgSatisfaction={summary.avgInstructorSatisfaction ?? summary.avgCourseSatisfaction ?? 0}
          />
        )}

        <InstructorStatsSection
          instructorStats={instructorStatsMapped}
          previousStats={previousInstructorStatsMapped}
          comparisonLabel={previousSummary ? `${year - 1} 비교` : '이전' }
          onInstructorClick={() => {}}
        />

        <KeywordCloud textualResponses={textualResponses || []} />
      </div>
    </DashboardLayout>
  );
};

export default DashboardCourseReports;
