import AdminLayout from "@/components/layouts/AdminLayout";

// src/pages/DashboardOverview.tsx
// ... (기존 import 유지)

const DashboardOverview = () => {
  // ... (기존 state와 useEffect 유지)

  return (
    <AdminLayout
      title="관리자 대시보드"
      description={isAdmin ? '시스템 관리자' : '강사'}
      loading={loading}
      desktopActions={<DesktopActions />}
      mobileActions={<MobileActions />}
    >
      <div className="space-y-6">
        {/* 주요 통계 카드들 - 스타일 개선 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent" />
            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-purple-100">
                  <FileText className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">전체 설문조사</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {loading ? "-" : stats.totalSurveys}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {isAdmin ? '전체 시스템' : '담당 강의'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-blue-100">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">진행중인 설문</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {loading ? "-" : stats.activeSurveys}
                  </span>
                </div>
                <p className="text-xs text-gray-500">현재 응답 가능</p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent" />
            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-green-100">
                  <BarChart className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">총 응답수</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {loading ? "-" : stats.totalResponses}
                  </span>
                </div>
                <p className="text-xs text-gray-500">누적 응답 수</p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent" />
            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-orange-100">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-600">최근 7일 응답</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {loading ? "-" : stats.recentResponsesCount}
                  </span>
                </div>
                <p className="text-xs text-gray-500">최근 활동</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 관리자 전용 통계 */}
        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent" />
              <CardHeader className="relative pb-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-indigo-100">
                    <Users className="h-5 w-5 text-indigo-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600">전체 강사수</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {loading ? "-" : stats.totalInstructors}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">등록된 강사</p>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-transparent" />
              <CardHeader className="relative pb-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-pink-100">
                    <BookOpen className="h-5 w-5 text-pink-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600">전체 강좌수</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {loading ? "-" : stats.totalCourses}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">개설된 강좌</p>
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent" />
              <CardHeader className="relative pb-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-teal-100">
                    <Activity className="h-5 w-5 text-teal-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-600">완료된 설문</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {loading ? "-" : stats.completedSurveys}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">설문 완료</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 차트 섹션은 기존 유지 */}
        {/* ... */}
      </div>
    </AdminLayout>
  );
};

export default DashboardOverview;
