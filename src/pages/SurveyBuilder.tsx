import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Pencil, Trash2, Plus, Edit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/layouts/AdminLayout";
import QuestionEditForm from "@/components/QuestionEditForm";
import { SessionManager, SurveySession } from "@/components/SessionManager";

export default function SurveyBuilder() {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);

  // … (기존 상태/로직 동일) …

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            뒤로
          </Button>
          <div className="mt-6">로딩 중...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            뒤로
          </Button>
          <div className="text-xl font-semibold">설문 편집</div>
          <div />
        </div>

        {/* 기본 정보 카드 */}
        {/* … 기존 코드 동일 … */}

        {/* 세션 관리 */}
        <SessionManager
          surveyId={surveyId!}
          sessions={[]} // 실제 state 연결
          courses={[]} // 실제 courses state 연결
          instructors={[]} // 실제 instructors state 연결
          onSessionsChange={() => {}} // 실제 핸들러 연결
        />

        {/* 질문 관리 카드 */}
        {/* … 기존 코드 동일 … */}
      </div>
    </AdminLayout>
  );
}
