import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import InstructorManagement from "./pages/InstructorManagement";
import SurveyManagement from "./pages/SurveyManagement";
import SurveyBuilder from "./pages/SurveyBuilder";
import TemplateManagement from "./pages/TemplateManagement";
import TemplateBuilder from "./pages/TemplateBuilder";
import SurveyResults from "./pages/SurveyResults";
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
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/instructors" element={
              <ProtectedRoute>
                <InstructorManagement />
              </ProtectedRoute>
            } />
            <Route path="/survey-management" element={
              <ProtectedRoute>
                <SurveyManagement />
              </ProtectedRoute>
            } />
            <Route path="/survey-builder/:surveyId" element={
              <ProtectedRoute>
                <SurveyBuilder />
              </ProtectedRoute>
            } />
            <Route path="/template-management" element={
              <ProtectedRoute>
                <TemplateManagement />
              </ProtectedRoute>
            } />
            <Route path="/template-builder/:templateId" element={
              <ProtectedRoute>
                <TemplateBuilder />
              </ProtectedRoute>
            } />
            <Route path="/results" element={
              <ProtectedRoute>
                <SurveyResults />
              </ProtectedRoute>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
