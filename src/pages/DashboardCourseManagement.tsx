// src/pages/DashboardCourseManagement.tsx
// ⚠️ 상위(Dashboard.tsx)에서 이미 DashboardLayout으로 감싸므로
// 이 컴포넌트는 "콘텐츠만" 렌더합니다.
import React from 'react';

// 필요 시 아래 주석 해제해서 실제 화면을 넣으세요.
// import CourseManagement from './CourseManagement';

export default function DashboardCourseManagement() {
  return (
    <div className="p-1">
      {/* 실제 과목 관리 UI 렌더링 */}
      {/* <CourseManagement /> */}
      <div className="text-sm text-muted-foreground">
        TODO: 과목/과정 관리 화면 렌더링 (CourseManagement 연결)
      </div>
    </div>
  );
}
