// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"; // ⬅️ Navigate 추가
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import DefaultRedirect from "@/components/DefaultRedirect";
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
        <BrowserRouter>
          <Routes>
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
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={["admin", "operator"]}>
                  <DashboardOverview />
                </ProtectedRoute>
              }
            />
            {/* 결과/리포트 */}
            <Route
              path="/dashboard/results"
              element={
                <ProtectedRoute allowedRoles={["admin", "operator", "instructor", "director"]}>
                  <DashboardSurveyResults />
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

            {/* ⬇️ 설문관리: v2 페이지를 정식 경로로 */}
            <Route
              path="/surveys-v2"
              element={
                <ProtectedRoute allowedRoles={["admin", "operator"]}>
                  <SurveyManagementV2 />
                </ProtectedRoute>
              }
            />

            {/* ⬇️ 과거(v1) 경로 → v2로 리다이렉트 (하위/외부 링크 호환) */}
            <Route
              path="/dashboard/surveys"
              element={<Navigate to="/surveys-v2" replace />}
            />
            <Route
              path="/surveys"
              element={<Navigate to="/surveys-v2" replace />}
            />
            <Route
              path="/survey-management"
              element={<Navigate to="/surveys-v2" replace />}
            />

            {/* 나머지 관리 메뉴 */}
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
              path="/instructors"
              element={
                <ProtectedRoute>
                  <InstructorManagement />
                </ProtectedRoute>
              }
            />

            {/* 설문 상세/편집/참여 */}
            <Route path="/survey/:surveyId" element={<SurveyParticipate />} />
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

            {/* 템플릿/결과/분석 */}
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

            {/* 기타 */}
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

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
