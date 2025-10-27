import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, UserCheck, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RoleSwitcher() {
  const { userRoles, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const currentView = searchParams.get('view');
  const isAdmin = userRoles.includes('admin');
  const isOperator = userRoles.includes('operator');
  const isDirector = userRoles.includes('director');
  const isInstructor = userRoles.includes('instructor');
  const isDeveloper = userRoles.includes('developer');
  
  // 관리자 역할 (admin, operator, director)
  const hasAdminRole = isAdmin || isOperator || isDirector;
  
  // 역할 전환기는 관리자이면서 강사인 경우 또는 개발자인 경우에만 표시
  const showSwitcher = (hasAdminRole && isInstructor) || isDeveloper;
  
  if (!showSwitcher) return null;

  const setView = (view: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (view) {
      params.set('view', view);
    } else {
      params.delete('view');
    }
    setSearchParams(params);
  };

  const roleOptions = [
    ...(hasAdminRole || isDeveloper ? [{
      key: 'admin',
      label: '관리자 뷰',
      icon: Shield,
      description: '전체 관리 기능'
    }] : []),
    ...(isInstructor || isDeveloper ? [{
      key: 'instructor',
      label: '강사 뷰',
      icon: UserCheck,
      description: '나의 데이터만'
    }] : []),
  ];

  const getCurrentRole = () => {
    if (currentView === 'admin') return roleOptions.find(r => r.key === 'admin');
    if (currentView === 'instructor') return roleOptions.find(r => r.key === 'instructor');
    // 기본값: 관리자 역할이 있으면 admin, 없으면 instructor
    return hasAdminRole ? roleOptions.find(r => r.key === 'admin') : roleOptions.find(r => r.key === 'instructor');
  };

  const current = getCurrentRole();

  return (
    <div className="px-3 pb-3">
      <div className="bg-sidebar-muted/50 rounded-xl p-3 shadow-neumorphic-soft">
        <div className="text-[0.7rem] font-semibold uppercase tracking-widest text-sidebar-muted-foreground mb-2">
          역할 전환
        </div>
        <div className="space-y-1">
          {roleOptions.map((role) => {
            const isActive = current?.key === role.key;
            const Icon = role.icon;
            
            return (
              <Button
                key={role.key}
                variant="ghost"
                size="sm"
                onClick={() => setView(role.key === 'admin' ? 'admin' : 'instructor')}
                className={cn(
                  "w-full justify-start gap-2 h-9 px-3 font-medium transition-all duration-200",
                  isActive
                    ? "bg-gradient-primary text-sidebar-primary-foreground shadow-purple-glow"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <div className="flex flex-col items-start">
                  <span className="text-xs leading-tight">{role.label}</span>
                  {isActive && (
                    <Badge variant="secondary" className="text-[0.6rem] h-4 px-1 mt-0.5 bg-white/20 text-white border-0">
                      {role.description}
                    </Badge>
                  )}
                </div>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}