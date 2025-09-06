import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Save, Eye } from "lucide-react";

const SurveyBuilder: React.FC = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">설문 빌더</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Eye className="w-4 h-4 mr-2" />
            미리보기
          </Button>
          <Button size="sm">
            <Save className="w-4 h-4 mr-2" />
            저장
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">설문 제목</Label>
              <Input id="title" placeholder="설문 제목을 입력하세요" />
            </div>
            <div>
              <Label htmlFor="description">설문 설명</Label>
              <Textarea 
                id="description" 
                placeholder="설문에 대한 설명을 입력하세요" 
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>질문</CardTitle>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                질문 추가
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-center py-8">
              질문을 추가하여 설문을 구성해보세요.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SurveyBuilder;