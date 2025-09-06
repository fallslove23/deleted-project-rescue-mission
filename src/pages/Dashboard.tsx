import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';

// 확실히 존재하는 컴포넌트들만 import
import InstructorManagement from '@/pages/InstructorManagement';
import UserManagement from '@/pages/UserManagement';
import SurveyResults from '@/pages/SurveyResults';
import TemplateManagement from '@/pages/TemplateManagement';
import SystemLogs from '@/pages/SystemLogs';
import PersonalDashboard from '@/pages/PersonalDashboard';

// 임시 컴포넌트들 (실제 파일이 없는 경우)
const CourseReports = () => (
  <div className="p-6">
    <h2 className="text-2xl font-bold mb-4">과정별 결과보고</h2>
    <p className="text-gray-600">과정별 종합 보고서 페이지입니다.</p>
  </div>
);

const CourseManagement = () => (
  <div className="p-6">
    <h2 className="text-2xl font-bold mb-4">과목관리</h2>
    <p className="text-gray-600">교육과정 및 과목 관리 페이지입니다.</p>
  </div>
);

const EmailLogs = () => (
  <div className="p-6">
    <h2 className="text-2xl font-bold mb-4">이메일 로그</h2>
    <p className="text-gray-600">이메일 발송 기록 페이지입니다.</p>
  </div>
);

// 개요 페이지 임시 컴포넌트
const DashboardOverview = () => (
  <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <div className="p-6 bg-white rounded-lg shadow border">
        <h3 className="font-semibold text-gray-600">전체 설문</h3>
        <p className="text-3xl font-bold text-primary mt-2">24</p>
        <p className="text-sm text-gray-500 mt-1">+2 이번 주</p>
      </div>
      <div className="p-6 bg-white rounded-lg shadow border">
        <h3 className="font-semibold text-gray-600">활성 강사</h3>
        <p className="text-3xl font-bold text-green-600 mt-2">12</p>
        <p className="text-sm text-gray-500 mt-1">+1 신규</p>
      </div>
      <div className="p-6 bg-white rounded-lg shadow border">
        <h3 className="font-semibold text-gray-600">진행중 과정</h3>
        <p className="text-3xl font-bold text-blue-600 mt-2">8</p>
        <p className="text-sm text-gray-500 mt-1">3개 완료 예정</p>
      </div>
      <div className="p-6 bg-white rounded-lg shadow border">
        <h3 className="font-semibold text-gray-600">평균 응답률</h3>
        <p className="text-3xl font-bold text-purple-600 mt-2">87%</p>
        <p className="text-sm text-gray-500 mt-1">↑ 5% 지난달 대비</p>
      </div>
    </div>
    
    <div className="grid gap-6 md:grid-cols-2">
      <div className="p-6 bg-white rounded-lg shadow border">
        <h3 className="font-semibold mb-4">최근 활동</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm">새 설문 생성</span>
            <span className="text-xs text-gray-500">2시간 전</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">강사 계정 추가</span>
            <span className="text-xs text-gray-500">5시간 전</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">과정 통계 업데이트</span>
            <span className="text-xs text-gray-500">1일 전</span>
          </div>
        </div>
      </div>
      
      <div className="p-6 bg-white rounded-lg shadow border">
        <h3 className="font-semibold mb-4">시스템 상태</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm">서버 상태</span>
            <span className="text-sm text-green-600 font-medium">정상</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">데이터베이스</span>
            <span className="text-sm text-green-600 font-medium">정상</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">이메일 서비스</span>
            <span className="text-sm text-green-600 font-medium">정상</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// 페이지별 메타데이터
const pageMetadata: Record<string, { title: string; description: string }> = {
  '/dashboard': { title: '관리자 대시보드', description: '시스템 종합 현황' },
  '/dashboard/results': { title: '결과분석', description: '설문 결과 분석 및 통계' },
  '/dashboard/course-reports': { title: '결과보고', description: '과정별 종합 보고서' },
  '/dashboard/instructors': { title: '강사관리', description: '강사 정보 및 권한 관리' },
  '/dashboard/users': { title: '사용자관리', description: '시스템 사용자 관리' },
  '/dashboard/courses': { title: '과목관리', description: '교육과정 및 과목 관리' },
  '/dashboard/course-statistics': { title: '통계관리', description: '과정별 상세 통계' },
  '/dashboard/templates': { title: '템플릿관리', description: '설문 템플릿 관리' },
  '/dashboard/email-logs': { title: '이메일 로그', description: '이메일 발송 기록' },
  '/dashboard/system-logs': { title: '시스템 로그', description: '시스템 활동 기록' },
};

function Dashboard() {
  const location = useLocation();
  const currentPage = pageMetadata[location.pathname] || pageMetadata['/dashboard'];

  return (
    <DashboardLayout title={currentPage.title} description={currentPage.description}>
      <Routes>
        <Route path="/" element={<DashboardOverview />} />
        <Route path="/results" element={<SurveyResults />} />
        <Route path="/course-reports" element={<CourseReports />} />
        <Route path="/instructors" element={<InstructorManagement showPageHeader={false} />} />
        <Route path="/users" element={<UserManagement showPageHeader={false} />} />
        <Route path="/courses" element={<CourseManagement />} />
        <Route path="/course-statistics" element={<PersonalDashboard />} />
        <Route path="/templates" element={<TemplateManagement showPageHeader={false} />} />
        <Route path="/email-logs" element={<EmailLogs />} />
        <Route path="/system-logs" element={<SystemLogs />} />
      </Routes>
    </DashboardLayout>
  );
}

export default Dashboard;