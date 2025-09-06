import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import DefaultRedirect from "@/components/DefaultRedirect";
import { SidebarProvider } from "@/components/ui/sidebar";

// ✅ 관리자 레이아웃 (SidebarProvider 없음!)
import AdminShell from "@/components/layouts/AdminShell";

// pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ChangePassword from "./pages/ChangePassword";
import DashboardOverview from "./pages/DashboardOverview";
import DashboardSurveyManagement from "./pages/DashboardSurveyManagement";
import DashboardSurveyResults from "./pages/DashboardSurveyResults";
import DashboardCourseReports from "./pages/DashboardCourseReports";
import DashboardInstructorManagement from "./pages/DashboardInstructorManagement";
import DashboardTemplateManagement from "./pages/DashboardTemplateManagement";
import DashboardMyStats from "./pages/DashboardMyStats";
import DashboardEmailLogs from "./pages/DashboardEmailLogs";
import DashboardSystemLogs from "./pages/DashboardSystemLogs";
import DashboardUserManagement from "./pages/DashboardUserManagement";
import DashboardCourseManagement from "./pages/DashboardCourseManagement";
import DashboardCourseStatistics from "./pages/DashboardCourseStatistics";
import InstructorManagement from "./pages/InstructorManagement";
import SurveyManagement from "./pages/SurveyManagement";
import SurveyManagementV2 from "./pages/SurveyManagementV2";
import SurveyBuilder from "./pages/SurveyBuilder";
import SurveyParticipate from "./pages/SurveyParticipate";
import SurveyPreview from "./pages/SurveyPreview";
import TemplateManagement from "./pages/TemplateManagement";
import TemplateBuilder from "./pages/TemplateBuilder";
import SurveyResults from "./pages/SurveyResults";
import SurveyDetailedAnalysis from "./pages/SurveyDetailedAnalysis";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />

        {/* ⛑️ 전역 Sidebar 컨텍스트: 여기서 한 번만 */}
        <SidebarProvider>
          <BrowserRouter>
            <Routes>
              {/* 퍼블릭/인증 영역: 사이드바 없음 */}
              <Route
                path="/"
                element={
                  <>
                    <Index />
                    <DefaultRedirect />
                  </>
                }
              />
              <Route path="/auth" element={<Auth />} />
              <Route
                path="/default-redirect"
                element={
                  <ProtectedRoute>
                    <DefaultRedirect />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/change-password"
                element={
                  <ProtectedRoute>
                    <ChangePassword />
                  </ProtectedRoute>
                }
              />

              {/* ================================
                   관리자 영역: AdminShell로 래핑
                 ================================= */}
              <Route element={<AdminShell />}>
                {/* 대시보드 계열 */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "operator"]}>
                      <DashboardOverview />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/surveys"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "operator"]}>
                      <DashboardSurveyManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/results"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "operator", "instructor", "director"]}>
                      <DashboardSurveyResults />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/instructors"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "operator"]}>
                      <DashboardInstructorManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/courses"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "operator"]}>
                      <DashboardCourseManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/course-statistics"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "operator"]}>
                      <DashboardCourseStatistics />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/templates"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "operator"]}>
                      <DashboardTemplateManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/my-stats"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "operator", "instructor", "director"]}>
                      <DashboardMyStats />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/email-logs"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "operator"]}>
                      <DashboardEmailLogs />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/system-logs"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <DashboardSystemLogs />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/users"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <DashboardUserManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/course-reports"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "operator", "director"]}>
                      <DashboardCourseReports />
                    </ProtectedRoute>
                  }
                />

                {/* 관리/설문 계열 */}
                <Route
                  path="/instructors"
                  element={
                    <ProtectedRoute>
                      <InstructorManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/surveys"
                  element={
                    <ProtectedRoute>
                      <SurveyManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/survey-management"
                  element={
                    <ProtectedRoute>
                      <SurveyManagement />
                    </ProtectedRoute>
                  }
                />

                {/* ✅ V2 페이지 (사이드바 보이게) */}
                <Route
                  path="/surveys-v2"
                  element={
                    <ProtectedRoute>
                      <SurveyManagementV2 />
                    </ProtectedRoute>
                  }
                />

                {/* 프리뷰/빌더/템플릿/결과 등도 관리자 쉘 안에 두면 사이드바 유지 */}
                <Route
                  path="/survey-preview/:surveyId"
                  element={
                    <ProtectedRoute>
                      <SurveyPreview />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/survey-builder/:surveyId"
                  element={
                    <ProtectedRoute>
                      <SurveyBuilder />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/template-management"
                  element={
                    <ProtectedRoute>
                      <TemplateManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/template-builder/:templateId"
                  element={
                    <ProtectedRoute>
                      <TemplateBuilder />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/results"
                  element={
                    <ProtectedRoute>
                      <SurveyResults />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/survey-results"
                  element={
                    <ProtectedRoute>
                      <SurveyResults />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/survey-detailed-analysis/:surveyId"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "operator", "instructor", "director"]}>
                      <SurveyDetailedAnalysis />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/detailed-analysis/:surveyId"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "operator", "instructor", "director"]}>
                      <SurveyDetailedAnalysis />
                    </ProtectedRoute>
                  }
                />

                {/* 학생 페이지도 관리자 쉘 내부에 두면 사이드바가 보입니다.
                   필요 없다면 이 라우트만 쉘 밖으로 이동하세요. */}
                <Route
                  path="/student"
                  element={
                    <ProtectedRoute allowedRoles={["admin", "operator", "instructor", "director"]}>
                      <Index />
                    </ProtectedRoute>
                  }
                />
              </Route>
              {/* ===== 관리자 영역 끝 ===== */}

              {/* 설문 참여는 퍼블릭/외부 링크라면 쉘 밖(사이드바 없음)이 자연스럽습니다 */}
              <Route path="/survey/:surveyId" element={<SurveyParticipate />} />

              {/* catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </SidebarProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
