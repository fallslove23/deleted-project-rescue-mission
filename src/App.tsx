// src/pages/InstructorDashboard.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  TrendingUp,
  Users,
  Star,
  Calendar,
  FileText,
  Award,
  MessageSquare,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface InstructorStats {
  totalCourses: number;
  totalStudents: number;
  averageRating: number;
  completedSurveys: number;
  pendingSurveys: number;
  recentFeedback: Array<{
    courseName: string;
    rating: number;
    comment: string;
    date: string;
  }>;
  courseSummary: Array<{
    id: string;
    name: string;
    students: number;
    rating: number;
    surveyStatus: "completed" | "pending" | "not_started";
    lastActivity: string;
  }>;
}

export default function InstructorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<InstructorStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 실제로는 API 호출을 통해 강사별 데이터를 가져옴
    // 여기서는 더미 데이터 사용
    setTimeout(() => {
      setStats({
        totalCourses: 8,
        totalStudents: 142,
        averageRating: 4.7,
        completedSurveys: 6,
        pendingSurveys: 2,
        recentFeedback: [
          {
            courseName: "BS Advanced 과정",
            rating: 5,
            comment: "매우 실용적이고 도움이 되는 강의였습니다.",
            date: "2025-09-05",
          },
          {
            courseName: "BS Basic 과정",
            rating: 4,
            comment: "이해하기 쉽게 설명해주셔서 감사합니다.",
            date: "2025-09-04",
          },
          {
            courseName: "치과 감염관리",
            rating: 5,
            comment: "실무에 바로 적용할 수 있는 내용이었습니다.",
            date: "2025-09-03",
          },
        ],
        courseSummary: [
          {
            id: "1",
            name: "BS Advanced 25-6차",
            students: 24,
            rating: 4.8,
            surveyStatus: "completed",
            lastActivity: "2025-09-05",
          },
          {
            id: "2",
            name: "BS Basic 25-12차",
            students: 20,
            rating: 4.6,
            surveyStatus: "pending",
            lastActivity: "2025-09-04",
          },
          {
            id: "3",
            name: "치과 감염관리 특강",
            students: 18,
            rating: 4.9,
            surveyStatus: "completed",
            lastActivity: "2025-09-02",
          },
          {
            id: "4",
            name: "BS Advanced 25-5차",
            students: 22,
            rating: 4.7,
            surveyStatus: "not_started",
            lastActivity: "2025-08-30",
          },
        ],
      });
      setLoading(false);
    }, 1000);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default">완료</Badge>;
      case "pending":
        return <Badge variant="secondary">진행중</Badge>;
      case "not_started":
        return <Badge variant="outline">시작 전</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating) ? "text-yellow-400 fill-current" : "text-gray-300"
        }`}
      />
    ));
  };

  if (loading) {
    return (
      <DashboardLayout title="강사 대시보드" description="나의 강의 현황">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!stats) return null;

  return (
    <DashboardLayout 
      title={`${user?.email?.split('@')[0] || '강사'}님의 대시보드`}
      description="나의 강의 현황과 학습자 피드백"
    >
      <div className="space-y-6">
        {/* 주요 지표 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 강의 과정</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCourses}개</div>
              <p className="text-xs text-muted-foreground">진행 및 완료 과정</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 교육생</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalStudents}명</div>
              <p className="text-xs text-muted-foreground">누적 교육생 수</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">평균 만족도</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageRating}/5.0</div>
              <div className="flex items-center space-x-1">
                {getRatingStars(stats.averageRating)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">설문 현황</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedSurveys}개</div>
              <p className="text-xs text-muted-foreground">
                완료 {stats.completedSurveys}개, 대기 {stats.pendingSurveys}개
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="courses" className="space-y-4">
          <TabsList>
            <TabsTrigger value="courses">강의 과정</TabsTrigger>
            <TabsTrigger value="feedback">최근 피드백</TabsTrigger>
            <TabsTrigger value="analytics">상세 분석</TabsTrigger>
          </TabsList>

          <TabsContent value="courses" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>진행 과정 현황</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.courseSummary.map((course) => (
                    <div
                      key={course.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium">{course.name}</h4>
                          {getStatusBadge(course.surveyStatus)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {course.students}명
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="h-4 w-4" />
                            {course.rating}/5.0
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {course.lastActivity}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/survey-detailed-analysis/${course.id}`)}
                      >
                        <BarChart className="h-4 w-4 mr-1" />
                        결과 보기
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="feedback" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>최근 학습자 피드백</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.recentFeedback.map((feedback, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{feedback.courseName}</h4>
                        <div className="flex items-center gap-1">
                          {getRatingStars(feedback.rating)}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        "{feedback.comment}"
                      </p>
                      <p className="text-xs text-muted-foreground">{feedback.date}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">상세 통계 분석</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => navigate("/dashboard/my-stats")}
                  >
                    <span className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      개인 통계 보기
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => navigate("/dashboard/results")}
                  >
                    <span className="flex items-center gap-2">
                      <BarChart className="h-4 w-4" />
                      설문 결과 분석
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">빠른 작업</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => navigate("/surveys-v2")}
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      설문 현황 확인
                    </span>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => navigate("/")}
                  >
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      교육생 화면 보기
                    </span>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}