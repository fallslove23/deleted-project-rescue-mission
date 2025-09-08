import React from 'react';
import { DashboardLayout } from '@/components/layouts';
import { Database, Download, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';

const DashboardCumulativeData = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  const [filterCourse, setFilterCourse] = useState('all');

  const handleExport = () => {
    // CSV 내보내기 로직
    console.log('Exporting cumulative data...');
  };

  const actions = (
    <>
      <Button onClick={handleExport} variant="outline" size="sm">
        <Download className="h-4 w-4 mr-2" />
        CSV 내보내기
      </Button>
    </>
  );

  return (
    <DashboardLayout
      title="누적 데이터"
      subtitle="전체 설문 응답 데이터 조회 및 분석"
      icon={<Database className="h-5 w-5 text-white" />}
      actions={actions}
    >
      <div className="space-y-6">
        {/* 필터 섹션 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              데이터 필터
            </CardTitle>
            <CardDescription>
              원하는 조건으로 데이터를 필터링하여 조회할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">검색어</label>
                <Input
                  placeholder="강사명, 과정명 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">연도</label>
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="연도 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="2024">2024년</SelectItem>
                    <SelectItem value="2023">2023년</SelectItem>
                    <SelectItem value="2022">2022년</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">과정</label>
                <Select value={filterCourse} onValueChange={setFilterCourse}>
                  <SelectTrigger>
                    <SelectValue placeholder="과정 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="java">Java 개발</SelectItem>
                    <SelectItem value="python">Python 개발</SelectItem>
                    <SelectItem value="react">React 개발</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button className="w-full">
                  <Filter className="h-4 w-4 mr-2" />
                  필터 적용
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 통계 요약 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">총 응답 수</p>
                  <p className="text-2xl font-bold">1,234</p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Database className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">평균 만족도</p>
                  <p className="text-2xl font-bold">4.2</p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-green-600 font-bold">★</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">참여 강사</p>
                  <p className="text-2xl font-bold">45</p>
                </div>
                <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-purple-600 font-bold">👩‍🏫</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">진행 과정</p>
                  <p className="text-2xl font-bold">28</p>
                </div>
                <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <span className="text-orange-600 font-bold">📚</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 데이터 테이블 */}
        <Card>
          <CardHeader>
            <CardTitle>누적 데이터 목록</CardTitle>
            <CardDescription>
              설문 응답 데이터를 테이블 형태로 확인할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <div className="p-4 text-center text-muted-foreground">
                데이터 테이블이 여기에 표시됩니다.
                <br />
                실제 구현 시 DataTable 컴포넌트를 사용하여 페이지네이션, 정렬 등의 기능을 제공합니다.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DashboardCumulativeData;
