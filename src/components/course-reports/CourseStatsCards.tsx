
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Users, Star } from 'lucide-react';

interface CourseStatsCardsProps {
  totalSurveys: number;
  totalResponses: number;
  instructorCount: number;
  avgSatisfaction: number;
}

const CourseStatsCards: React.FC<CourseStatsCardsProps> = ({
  totalSurveys,
  totalResponses,
  instructorCount,
  avgSatisfaction
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-primary">총 설문 수</CardTitle>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">{totalSurveys}</div>
          <p className="text-xs text-muted-foreground mt-1">개의 설문 진행</p>
        </CardContent>
      </Card>
      
      <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-primary">응답한 인원수</CardTitle>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">{totalResponses}</div>
          <p className="text-xs text-muted-foreground mt-1">명이 응답 참여</p>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-primary">참여 강사 수</CardTitle>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">{instructorCount}</div>
          <p className="text-xs text-muted-foreground mt-1">명의 강사 참여</p>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-primary">전체 평균 만족도</CardTitle>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Star className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">{avgSatisfaction.toFixed(1)}</div>
          <p className="text-xs text-muted-foreground mt-1">점 / 10점 만점</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CourseStatsCards;
