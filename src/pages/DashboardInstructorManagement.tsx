import React from 'react';
import { DashboardLayout } from '@/components/layouts';
import { UserCheck, Plus, RefreshCw, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import InstructorManagement from './InstructorManagement';

const DashboardInstructorManagement = () => {
  const handleAddInstructor = () => {
    console.log('Add instructor clicked - 기능 연결 필요');
  };

  const handleSyncUsers = () => {
    console.log('Sync users clicked - 기능 연결 필요');
  };

  const handleRefresh = () => {
    console.log('Refresh clicked - 기능 연결 필요');
  };

  const actions = [
    <Button key="refresh" variant="outline" size="sm" onClick={handleRefresh}>
      <RefreshCw className="h-4 w-4 mr-2" />
      새로고침
    </Button>,
    <Button key="sync" variant="outline" size="sm" onClick={handleSyncUsers}>
      <UserPlus className="h-4 w-4 mr-2" />
      계정 동기화
    </Button>,
    <Button key="add" size="sm" onClick={handleAddInstructor}>
      <Plus className="h-4 w-4 mr-2" />
      새 강사 추가
    </Button>
  ];

  return (
    <DashboardLayout
      title="강사 관리"
      subtitle="강사 정보 등록 및 관리"
      icon={<UserCheck className="h-5 w-5 text-white" />}
      actions={actions}
    >
      <InstructorManagement 
        showActions={false} 
        onAddInstructor={handleAddInstructor}
        onSyncUsers={handleSyncUsers}
        onRefresh={handleRefresh}
      />
    </DashboardLayout>
  );
};

export default DashboardInstructorManagement;
