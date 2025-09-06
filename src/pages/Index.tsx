// Index.tsx의 사이드바 메뉴 부분 수정
// SheetContent 내부의 메뉴 구조를 다음과 같이 변경

<SheetContent side="left" className="w-[280px] sm:w-80 p-4 max-w-[90vw]">
  <div className="space-y-6 mt-6 overflow-y-auto max-h-[calc(100vh-80px)]">
    {user ? (
      <>
        <div className="border-b pb-4">
          <h2 className="text-lg font-semibold text-primary">관리자 메뉴</h2>
          <p className="text-sm text-muted-foreground mt-1 break-words">환영합니다, {user.email}</p>
        </div>
        <div className="space-y-3">
          <Button onClick={() => navigate('/dashboard')} className="w-full justify-start" variant="default">
            <BarChart className="h-4 w-4 mr-2" />
            관리 대시보드
          </Button>
          
          {/* 강사 전용 메뉴 추가 */}
          <div className="border-t pt-3">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">📊 내 피드백</h3>
            <Button onClick={() => navigate('/dashboard/my-stats')} className="w-full justify-start" variant="outline">
              <TrendingUp className="h-4 w-4 mr-2" />
              나의 만족도 통계
            </Button>
            <Button onClick={() => navigate('/dashboard/course-reports')} className="w-full justify-start mt-2" variant="outline">
              <BookOpen className="h-4 w-4 mr-2" />
              과정별 결과 보고
            </Button>
          </div>

          {/* 관리 메뉴 */}
          <div className="border-t pt-3">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">🔧 관리</h3>
            <Button onClick={() => navigate('/dashboard/instructors')} className="w-full justify-start" variant="outline">
              <Users className="h-4 w-4 mr-2" />
              강사 관리
            </Button>
            <Button onClick={() => navigate('/dashboard/surveys')} className="w-full justify-start mt-2" variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              설문조사 관리
            </Button>
            <Button onClick={() => navigate('/dashboard/results')} className="w-full justify-start mt-2" variant="outline">
              <BarChart className="h-4 w-4 mr-2" />
              결과 분석
            </Button>
            <Button onClick={() => navigate('/dashboard/templates')} className="w-full justify-start mt-2" variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              템플릿 관리
            </Button>
          </div>

          {/* 기타 메뉴 */}
          <div className="border-t pt-3">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">📋 기타</h3>
            <Button onClick={() => navigate('/')} className="w-full justify-start" variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              설문 리스트
            </Button>
          </div>
        </div>
        <Button onClick={() => window.location.reload()} variant="ghost" className="w-full text-muted-foreground">
          로그아웃
        </Button>
      </>
    ) : (
      <>
        <div className="border-b pb-4">
          <h2 className="text-lg font-semibold">관리자/강사 로그인</h2>
          <p className="text-sm text-muted-foreground mt-1">설문 결과 조회 및 관리</p>
        </div>
        <Button onClick={() => navigate('/auth')} className="w-full">
          로그인하기
        </Button>
      </>
    )}
  </div>
</SheetContent>